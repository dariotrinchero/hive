import { io, Socket } from "socket.io-client";

import Board from "@/client/ui/board";

import type { ClientToServer, ServerToClient } from "@/types/common/socket";
import type { TurnRequest } from "@/types/common/turn";
import type { TurnEventOutcome } from "@/types/server/gameServer";

const hexRad = 90;

export default class GameClient {
    private socket: Socket<ServerToClient, ClientToServer>;
    private timeout: number;
    private board: Board;

    constructor(timeout: number) {
        this.socket = io(document.location.pathname, {
            auth: { sessionId: localStorage.getItem("sessionId") }
        });
        this.timeout = timeout;
        this.board = new Board(this, hexRad, hexRad / 6, hexRad / 18);

        this.socket.on("connect", () => {
            // TODO check if this is an existing game, and if so, syncronize board state with game
            void this.board.processTurn(
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

        // TODO for dev debugging only:
        this.socket.onAny((...args) => console.log(args));

        this.socket.on("session", sessionId => {
            this.socket.auth = { sessionId };
            localStorage.setItem("sessionId", sessionId);
        });

        this.socket.on("spectating", () => {
            console.error("Game full; joined as spectator.");
            this.board.setInteractable(false);
        });

        this.socket.on("connect_error", err => {
            // TODO display error to user
            // TODO this is not getting run?
            console.error(`Error connecting: ${err.message}`);
        });

        this.socket.on("player turn", outcome => {
            // TODO handle turn; this means asking the client-side game to perform the turn.
            // If the client game rejects the turn, this means a desync has happened.
            // In this case, the client should request, & subsequently load, the entire current game state, as
            // it would do when joining an active game.
        });

        this.socket.on("player connected", () => {
            // TODO handle connect
        });

        this.socket.on("player disconnected", () => {
            // TODO handle disconnect
        });
    }

    private raceTimeout<T>(promise: Promise<T>): Promise<T> {
        const timeout: Promise<T> = new Promise((_resolve, reject) =>
            setTimeout(() => reject("Request timed out."), this.timeout));
        return Promise.race([timeout, promise]);
    }

    public async makeTurnRequest(req: TurnRequest): Promise<TurnEventOutcome> {
        const outcome: Promise<TurnEventOutcome> = new Promise(resolve =>
            this.socket.emit("turn request", req, outcome => resolve(outcome)));
        return this.raceTimeout(outcome);
    }
}