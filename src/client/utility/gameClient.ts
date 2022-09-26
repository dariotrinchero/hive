import { io, Socket } from "socket.io-client";

import Notation, { ParseError } from "@/client/utility/notation";
import sum from "@/common/objectHash";
import HiveGame from "@/common/game/game";

import type { ClientToServer, GameState, ServerToClient, TurnRequestOutcome } from "@/types/common/socket";
import type { TurnAttempt, TurnResult } from "@/types/common/game/outcomes";
import type { LatticeCoords } from "@/types/common/game/hexGrid";
import type { Piece } from "@/types/common/game/piece";
import type { PlayerColor } from "@/types/client/gameClient";

interface Premove {
    piece: Piece;
    destination: LatticeCoords;
}

// key used to persist session ID in local storage
const localStorageSessionIdName = "sessionId";

export default class GameClient {
    // networking-related
    private readonly socket: Socket<ServerToClient, ClientToServer>;

    // game-related
    public game: HiveGame = new HiveGame();
    private playerColor: PlayerColor;
    private premove?: Premove;

    // callbacks for rendering
    private readonly refreshRendering: (state: GameState) => void;

    constructor(refreshRendering: (state: GameState) => void) {
        this.playerColor = "Spectator";
        this.refreshRendering = refreshRendering;

        this.socket = io(document.location.pathname, {
            auth: { sessionId: localStorage.getItem(localStorageSessionIdName) }
        });
        this.bindSocketEvents();
    }

    public getPlayerColor(): PlayerColor {
        return this.playerColor;
    }

    private bindSocketEvents() {
        this.socket.on("connect", () => {
            void this.processTurns( // TODO for dev debugging only
                "bA .",
                "wG bA1-",
                "bB /bA1",
                "wL wG1-",
                "bM -bA1",
                "wP wG1\\",
                "bQ \\bA1",
                "wQ wG1/",
                "bS bB1\\",
                "wB wP-",
                "bB \\bM"
            );
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

            this.game.setColorToStart(session.startingColor);
        });

        this.socket.on("connect_error", err => {
            console.error("Error connecting", err); // TODO display error to user

            // environment variable set in package.json & injected by webpack
            if (process.env.AUTOKILL) window.close();
        });

        this.socket.on("player turn", (outcome, hash) => {
            if (outcome.status === "Error") return;
            if (outcome.turnType === "Pass") this.game.passTurn();
            else {
                const { piece, destination } = outcome;
                if (outcome.turnType === "Movement") this.game.movePiece(piece, destination);
                else this.game.placePiece(piece, destination);
                this.syncLocalGame(hash);
            }

            // dispatch any pending premove
            if (this.premove) this.submitMoveRequest(this.premove.piece, this.premove.destination);
        });

        this.socket.on("Player connected", () => {
            // TODO handle connect
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

    // TODO find some way of merging these functions...

    public async processTurns(...turn: TurnAttempt[]): Promise<TurnResult[]>;
    public async processTurns(...turnNotation: string[]): Promise<(TurnResult | ParseError)[]>;
    public async processTurns(...turnOrNotation: string[] | TurnAttempt[]): Promise<(TurnRequestOutcome | ParseError)[]> {
        const result: (TurnRequestOutcome | ParseError)[] = [];
        for (const tON of turnOrNotation) {
            let turn: TurnAttempt | ParseError;
            if (typeof tON === "string") {
                turn = Notation.stringToTurnRequest(tON);
                if (turn === "ParseError") {
                    result.push("ParseError");
                    continue;
                }
            } else turn = tON;

            const [outcome, hash] = await this.submitTurnRequest(turn);
            console.log(outcome);
            console.log(`New hash: ${hash}`);

            if (outcome.status === "Success") {
                this.game.processTurn(turn);
                this.syncLocalGame(hash);
            }

            result.push(outcome);
        }
        return result;
    }

    private submitTurnRequest(req: TurnAttempt): Promise<[TurnRequestOutcome, string]> {
        return new Promise(resolve =>
            this.socket.emit("turn request", req, (outcome, hash) => resolve([outcome, hash])));
    }

    private submitMoveRequest(piece: Piece, destination: LatticeCoords): void {
        this.cancelPremove();
        this.socket.emit("move request", piece, destination, (outcome, hash) => {
            console.log(outcome);
            console.log(`New hash: ${hash}`);

            if (outcome.status === "Success") {
                this.game.movePiece(piece, destination);
                this.syncLocalGame(hash);
            }
        });
    }

    /**
     * Queue a move which will either be requested (from server) immediately, if it is this player's
     * turn, or registered as a premove to be taken as soon as possible.
     * 
     * @param piece the piece to move
     * @param destination the intended destination for the moving piece
     */
    public queueMove(piece: Piece, destination: LatticeCoords): void {
        if (this.playerColor === this.game.getCurrTurnColor()) {
            this.submitMoveRequest(piece, destination);
        } else this.premove = { destination, piece };
    }

    public cancelPremove(): void {
        this.premove = undefined;
    }

    private syncLocalGame(expectedHash: string): void {
        if (expectedHash !== sum(this.game.getState())) {
            console.warn("Local state out-of-sync with server; retrieving serverside state");
            this.socket.emit("game state request", state => this.loadState(state));
        } else this.refreshRendering(this.game.getState());
    }

    private loadState(state: GameState): void {
        console.warn(`Loading state with client-side hash ${sum(state)}`);
        this.game = HiveGame.fromState(state);
        this.refreshRendering(this.game.getState());
        console.warn(`Loaded state has client-side hash ${sum(this.game.getState())}`);
    }
}