import { io, Socket } from "socket.io-client";

import Board from "@/client/ui/board";
import Notation, { ParseError } from "@/client/ui/notation";
import sum from "@/common/objectHash";
import HiveGame from "@/common/game/game";

import type { ClientToServer, GameState, ServerToClient, TurnEventOutcome } from "@/types/common/socket";
import type { TurnOutcome, TurnRequest } from "@/types/common/turn";
import type { LatticeCoords } from "@/types/common/game/hexGrid";
import type { Piece, PieceColor } from "@/types/common/piece";
import type { MovementCheckOutcome } from "@/types/common/game/game";

interface MovementCheckOutcomePremove {
    outcome: MovementCheckOutcome;
    premove: boolean;
}

// TODO determine this based on screen size?
const hexRad = 90;

export default class GameClient {
    // networking related
    private socket: Socket<ServerToClient, ClientToServer>;
    private timeout: number;

    // game related
    public game: HiveGame = new HiveGame();
    private board: Board = new Board(this, hexRad, hexRad / 6, hexRad / 18);

    private playerColor?: PieceColor;
    private startingColor?: PieceColor;

    constructor(timeout?: number) {
        this.socket = io(document.location.pathname, {
            auth: { sessionId: localStorage.getItem("sessionId") }
        });
        this.timeout = timeout || 5000;
        this.bindSocketEvents();
    }

    private bindSocketEvents() {
        this.socket.on("connect", () => {
            void this.processTurns(
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
            localStorage.setItem("sessionId", session.sessionId);

            if (session.spectating) {
                console.error("Game full; joined as spectator.");
                this.board.setInteractable(false);
            } else {
                this.playerColor = session.color;
                this.startingColor = session.startingColor;
            }

            this.game.setColorToStart(session.startingColor);
        });

        this.socket.on("connect_error", err => {
            // TODO display error to user
            // TODO this is not getting run?
            console.error(`Error connecting: ${err.message}`);
        });

        this.socket.on("player turn", (outcome, hash) => {
            if (outcome.status === "Error") return;
            if (outcome.turnType === "Pass") this.game.passTurn(); // TODO UI should also show turn # etc
            else {
                const { piece, destination } = outcome;
                if (outcome.turnType === "Movement") this.game.movePiece(piece, destination);
                else this.game.placePiece(piece, destination);

                // check hash & request state sync in case of mismatch
                if (hash !== sum(this.game.getState())) this.syncState();
                else {
                    if (outcome.turnType === "Movement") this.board.moveTile(piece, destination);
                    else this.board.spawnTile(piece, destination);
                }
            }

            // TODO send pending premove request here
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
     * Helper function to race any given promise against the established timeout.
     * 
     * @param promise the promise to race against a timeout
     * @returns a new promise of the same type as that given which rejects if time runs out
     */
    private raceTimeout<T>(promise: Promise<T>): Promise<T> { // TODO delete this function?
        const timeout: Promise<T> = new Promise((_resolve, reject) =>
            setTimeout(() => reject("Request timed out."), this.timeout));
        return Promise.race([timeout, promise]);
    }

    // TODO find some way of merging these functions...

    public async processTurns(...turn: TurnRequest[]): Promise<TurnOutcome[]>;
    public async processTurns(...turnNotation: string[]): Promise<(TurnOutcome | ParseError)[]>;
    public async processTurns(...turnOrNotation: string[] | TurnRequest[]): Promise<(TurnEventOutcome | ParseError)[]> {
        const result: (TurnEventOutcome | ParseError)[] = [];
        for (const tON of turnOrNotation) {
            let turn: TurnRequest | ParseError;
            if (typeof tON === "string") {
                turn = Notation.stringToTurnRequest(tON);
                if (turn === "ParseError") {
                    result.push("ParseError");
                    continue;
                }
            } else turn = tON;

            const [outcome, hash] = await this.makeTurnRequest(turn);
            console.log(outcome);
            console.log(`New hash: ${hash}`);

            if (outcome.status === "Success") {
                this.game.processTurn(turn);
                if (hash !== sum(this.game.getState())) this.syncState();
                else {
                    if (outcome.turnType === "Placement") this.board.spawnTile(outcome.piece, outcome.destination);
                    else if (outcome.turnType === "Movement") this.board.moveTile(outcome.piece, outcome.destination);
                }

            }

            result.push(outcome);
        }
        return result;
    }

    private makeTurnRequest(req: TurnRequest): Promise<[TurnEventOutcome, string]> {
        return new Promise(resolve =>
            this.socket.emit("turn request", req, (outcome, hash) => resolve([outcome, hash])));
    }

    public makeMoveRequest(piece: Piece, destination: LatticeCoords): void {
        this.socket.emit("move request", piece, destination, (outcome, hash) => {
            console.log(outcome);
            console.log(`New hash: ${hash}`);

            if (outcome.status === "Success") {
                this.game.movePiece(piece, destination);
                if (hash !== sum(this.game.getState())) this.syncState();
                else this.board.moveTile(piece, destination);
            }
        });
    }

    public checkPieceForMove(piece: Piece): MovementCheckOutcomePremove {
        return {
            outcome: this.game.checkPieceForMove(piece, undefined, this.playerColor),
            premove: this.playerColor !== this.game.getCurrTurnColor()
        };
    }

    private syncState(): void {
        console.log("Requesting state sync.");
        this.socket.emit("game state request", state => this.loadState(state));
    }

    private loadState(state: GameState): void {
        console.log(`Loading state with client-side hash ${sum(state)}:`);

        this.board.clearBoard();
        this.game = HiveGame.fromState(state);

        Object.entries(state.posToPiece).forEach(([posStr, piece]) => {
            const pos = posStr.split(",").map(str => parseInt(str)) as LatticeCoords;
            const recordPiece = (currPiece: Piece) => {
                if (currPiece.covering) recordPiece(currPiece.covering);
                this.board.spawnTile(currPiece, pos);
            };
            recordPiece(piece);
        });

        console.log(`Loaded state has client-side hash ${sum(this.game.getState())}:`);
    }
}