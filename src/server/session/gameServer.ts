import express from "express";
import { createServer, Server as HTTPServer } from "http";
import { Namespace, Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

import sum from "@/common/objectHash";
import HiveGame from "@/common/game/game";

import type {
    ClientToServer,
    InterServer,
    MovementEventError,
    ServerToClient,
    SocketData,
    TurnEventOutcome
} from "@/types/common/socket";
import type { ActiveGames } from "@/types/server/gameServer";
import type { TurnOutcome } from "@/types/common/turn";

const gamePath = (gameId: string) => `/game/${gameId}/`;

export default class GameServer {
    private activeGames: ActiveGames = {};
    private httpServer: HTTPServer;
    private io: Server<ClientToServer, ServerToClient, InterServer, SocketData>;

    public constructor(staticAssetPath: string, port: number) {
        const app = express();
        this.httpServer = createServer(app);
        this.io = new Server(this.httpServer);

        // middleware to validate game ID
        app.get(gamePath(":gameId"), (request, _response, next) => {
            if (!this.activeGames[request.params.gameId]) next("No such game ID.");
            next();
        });

        // middleware to serve game client static assets
        app.use(gamePath(":gameId"), express.static(staticAssetPath));

        // listen on port
        this.httpServer.listen(port, () =>
            console.log(`serving & listening on port ${port}`));
    }

    private getWSNamespace(gameId: string): Namespace<ClientToServer, ServerToClient, InterServer, SocketData> {
        const nsp = this.io.of(gamePath(gameId));

        // socket middleware to inject user session ID
        nsp.use((socket, next) => {
            const sessionId = socket.handshake.auth.sessionId as string | null;
            socket.data.sessionId = sessionId || uuidv4();
            next();
        });

        nsp.on("connection", socket => {
            // notify client of their session ID
            const sessionId = socket.data.sessionId as string;
            socket.emit("session", sessionId);

            // compute some helpful constants
            const activeGame = this.activeGames[gameId];
            const players = activeGame.playerSessions;
            const isSpectator = Object.keys(players).length >= 2 && typeof players[sessionId] === "undefined";
            const sessionList = activeGame[isSpectator ? "spectatorSessions" : "playerSessions"];
            const memberType = isSpectator ? "spectator" : "player";

            // deny multiple connections from same session
            if (sessionList[sessionId]) {
                // TODO should this be denied? Maybe we could just keep count?
                // Either way, notify user before disconnecting...
                socket.disconnect();
                return;
            }

            // join game room & notify any other members
            console.log(`${memberType} ${sessionId} connected`);
            if (isSpectator) socket.emit("spectating");
            void socket.join(gameId);
            socket.to(gameId).emit(`${memberType} connected`);
            sessionList[sessionId] = true;

            // send current game state to new client
            if (activeGame.game.getTurnCount() > 0) {
                socket.emit("game state", activeGame.game.getState(), sum(activeGame.game.getState()));
            }

            socket.on("disconnecting", reason => {
                console.log(`${memberType} ${sessionId} disconnected for reason ${reason}`);
                socket.to(gameId).emit(`${memberType} disconnected`);
                sessionList[sessionId] = false;
                // TODO delete game after a while if both players disconnect
            });

            // recompute game state hash & broadcast turn outcome
            const handleTurnOutcome = <T extends TurnOutcome>(outcome: T, callback: (out: T, hash: string) => void) => {
                const hash = sum(activeGame.game.getState());
                callback(outcome, hash);
                if (outcome.status === "Success") {
                    socket.broadcast.to(gameId).emit("player turn", outcome, hash);
                }
            };

            // TODO merge common code in the following:

            socket.on("turn request", (req, callback) => {
                const err: TurnEventOutcome = {
                    message: "ErrInvalidGameId",
                    status: "Error",
                    turnType: "Unknown"
                };
                if (!this.activeGames[gameId]) return callback(err, "");

                const hash = sum(activeGame.game.getState());
                if (isSpectator) return callback({ ...err, message: "ErrSpectator" }, hash);

                // require both players to be online for first move
                const playersOnline = Object.values(players);
                const bothOnline = playersOnline.length >= 2 && playersOnline.every(b => b);
                if (!bothOnline && activeGame.game.getTurnCount() === 0) {
                    return callback({ ...err, message: "ErrNeedOpponentOnline" }, hash);
                }

                handleTurnOutcome(activeGame.game.processTurn(req), callback);
            });

            socket.on("move request", (piece, destination, callback) => {
                const err: MovementEventError = {
                    message: "ErrInvalidGameId",
                    status: "Error",
                    turnType: "Movement"
                };
                if (!this.activeGames[gameId]) return callback(err, "");

                const hash = sum(activeGame.game.getState());
                if (isSpectator) return callback({ ...err, message: "ErrSpectator" }, hash);

                handleTurnOutcome(activeGame.game.movePiece(piece, destination), callback);
            });

            socket.on("game state request", callback => {
                // TODO include the possibility of game ID being invalid
                callback(activeGame.game.getState());
            });
        });

        return nsp;
    }

    public startNewGame(): string {
        const gameId = uuidv4();
        this.activeGames[gameId] = {
            game: new HiveGame(),
            nsp: this.getWSNamespace(gameId),
            playerSessions: {},
            spectatorSessions: {}
        };
        return gameId;
    }
}