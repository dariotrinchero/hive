import { io, Socket } from "socket.io-client";

import Notation, { ParseError } from "@/client/utility/notation";
import AudioPlayer, { SoundEffect } from "@/client/utility/audioPlayer";

import sum from "@/common/objectHash";
import HiveGame from "@/common/game/game";

import type { PlayerColor, ReRenderFn } from "@/types/client/gameClient";
import type { ClientToServer, GameState, ServerToClient, TurnRequestResult } from "@/types/common/socket";
import type { GenericTurnAttempt, SpecificTurnAttempt, TurnAttempt, TurnResult } from "@/types/common/game/outcomes";

// key used to persist session ID in local storage
const localStorageSessionIdName = "sessionId";

export default class GameClient {
    // networking-related
    private readonly socket: Socket<ServerToClient, ClientToServer>;

    // game-related
    public game: HiveGame = new HiveGame();
    private playerColor: PlayerColor;
    private bothJoined: boolean;

    // pending premove
    private premove?: SpecificTurnAttempt;

    // rendering callback
    private readonly rerender: (res?: TurnResult) => void;

    constructor(rerender: ReRenderFn) {
        this.playerColor = "Spectator";
        this.bothJoined = false;
        this.rerender = res => rerender(this.game.getState(), this.bothJoined, res);

        this.socket = io(document.location.pathname, {
            auth: { sessionId: localStorage.getItem(localStorageSessionIdName) }
        });
        this.bindSocketEvents();
    }

    public getPlayerColor(): PlayerColor { return this.playerColor; }

    private bindSocketEvents() {
        this.socket.on("connect", () => {
            // TODO do anything here?
        });

        this.socket.prependAny((...args) => console.log(args)); // TODO for dev debugging only

        this.socket.on("game state", state => this.loadState(state));

        this.socket.on("session", session => {
            this.socket.auth = { sessionId: session.sessionId };
            localStorage.setItem(localStorageSessionIdName, session.sessionId);

            if (session.spectating) {
                console.error("Game full; joined as spectator.");
                this.playerColor = "Spectator";
            } else {
                this.playerColor = session.color;
                this.game.setNoFirstQueen(session.noFirstQueen);
            }

            this.bothJoined = session.bothJoined;
            this.game.setColorToStart(session.startingColor);
            this.rerender();
        });

        this.socket.on("connect_error", err => {
            console.error("Error connecting", err); // TODO display error to user

            // environment variable set in package.json & injected by webpack
            if (process.env.AUTOKILL) window.close();
        });

        this.socket.on("player turn", (result, hash) => {            
            if (result.status === "Error") return;
            this.game.processTurn(result);
            this.syncLocalGame(hash, result);
            if (this.premove) void this.submitTurnRequest(this.premove); // dispatch pending premove
        });

        this.socket.on("Player connected", () => {
            // TODO handle connect
            this.bothJoined = true;
            this.rerender();
        });

        this.socket.on("Player disconnected", () => {
            // TODO handle disconnect
        });

        this.socket.on("Spectator connected", () => {
            // TODO handle connect
        });

        this.socket.on("Spectator disconnected", () => {
            // TODO handle disconnect
        });
    }

    /**
     * Helper function to race any given promise against given timeout.
     * 
     * @param promise the promise to race against a timeout
     * @param timeout the time to wait before rejecting the given promise
     * @returns a new promise of the same type as that given which rejects if time runs out
     */
    private raceTimeout<T>(promise: Promise<T>, timeout?: number): Promise<T> { // TODO delete this function?
        const delayedReject: Promise<T> = new Promise((_resolve, reject) =>
            setTimeout(() => reject("Request timed out."), timeout || 5000));
        return Promise.race([delayedReject, promise]);
    }

    public async processTurns(...turn: GenericTurnAttempt[]): Promise<TurnResult[]>;
    public async processTurns(...turnNotation: string[]): Promise<(TurnResult | ParseError)[]>;
    public async processTurns(...turnOrNotation: string[] | GenericTurnAttempt[]): Promise<(TurnRequestResult | ParseError)[]> {
        const results: (TurnRequestResult | ParseError)[] = [];
        for (const tON of turnOrNotation) {
            let turn: GenericTurnAttempt | ParseError;
            if (typeof tON === "string") {
                turn = Notation.stringToTurnAttempt(tON);
                if (turn === "ParseError") {
                    results.push("ParseError");
                    continue;
                }
            } else turn = tON;

            const result = await this.submitTurnRequest(turn);
            results.push(result);
        }
        return results;
    }

    private submitTurnRequest(req: TurnAttempt): Promise<TurnRequestResult> {
        this.cancelPremove();
        return new Promise(resolve => {
            this.socket.emit("turn request", req, (result, hash) => {
                console.log(result);
                console.log(`New hash: ${hash}`);

                if (result.status === "Success") {
                    this.game.processTurn(result);
                    this.syncLocalGame(hash, result);
                }

                resolve(result);
            });
        });
    }

    /**
     * Queue a move which will either be requested (from server) immediately, if it is this player's
     * turn, or registered as a premove to be taken as soon as possible.
     * 
     * @param req the move attempt to queue
     */
    public queueMove(req: SpecificTurnAttempt): void {
        if (this.playerColor === this.game.getState().currTurnColor) {
            void this.submitTurnRequest(req);
        } else this.premove = req;
    }

    public cancelPremove(): void {
        this.premove = undefined;
    }

    private syncLocalGame(expectedHash: string, result?: TurnResult): void {
        AudioPlayer.play(SoundEffect.TileDropping);

        if (expectedHash !== sum(this.game.getState())) {
            console.warn("Local state out-of-sync with server; retrieving serverside state");
            this.socket.emit("game state request", state => this.loadState(state));
        } else this.rerender(result);
    }

    private loadState(state: GameState): void {
        console.warn(`Loading state with client-side hash ${sum(state)}`);
        this.game = HiveGame.fromState(state);
        this.rerender();
        console.warn(`Loaded state has client-side hash ${sum(this.game.getState())}`);
    }
}