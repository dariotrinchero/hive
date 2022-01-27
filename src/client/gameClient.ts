import { io, Socket } from "socket.io-client";

import Board from "@/client/ui/board";

import type { ClientToServer, ServerToClient } from "@/types/common/socket";
import type { TurnOutcome, TurnRequest } from "@/types/common/turn";

const hexRad = 90;

export default class GameClient {
    private socket: Socket<ServerToClient, ClientToServer>;
    private timeout: number;
    private board: Board;

    constructor(timeout: number) {
        this.socket = io(document.location.pathname);
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

        this.socket.on("game full", () => {
            // TODO display error to user
            console.error("Game full");
        });

        this.socket.on("connect_error", err => {
            // TODO display error to user
            console.error(`Error connecting: ${err.message}`);
        });

        this.socket.on("opponent turn", outcome => {
            // TODO handle turn
        });

        this.socket.on("opponent connected", () => {
            // TODO handle connect
        });

        this.socket.on("opponent disconnected", () => {
            // TODO handle disconnect
        });
    }

    private raceTimeout<T>(promise: Promise<T>): Promise<T> {
        const timeout: Promise<T> = new Promise((_resolve, reject) =>
            setTimeout(() => reject("Request timed out."), this.timeout));
        return Promise.race([timeout, promise]);
    }

    public async makeTurnRequest(req: TurnRequest): Promise<TurnOutcome> {
        const outcome: Promise<TurnOutcome> = new Promise(resolve =>
            this.socket.emit("turn request", req, outcome => resolve(outcome)));
        return this.raceTimeout(outcome);
    }
}