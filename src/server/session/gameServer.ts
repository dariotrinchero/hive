import express from "express";
import { createServer, Server as HTTPServer } from "http";
import { Namespace, Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

import HiveGame from "@/common/game/game";

import type {
    ClientToServer,
    InterServer,
    ServerToClient,
    SocketData
} from "@/types/common/socket";
import type { ActiveGames, TurnEventOutcome } from "@/types/server/gameServer";

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

            // determine if client is player or spectator
            const players = this.activeGames[gameId].playerSessions;
            const isSpectator = Object.keys(players).length >= 2 && typeof players[sessionId] === "undefined";
            const sessionList = this.activeGames[gameId][isSpectator ? "spectatorSessions" : "playerSessions"];
            const memberType = isSpectator ? "spectator" : "player";
            if (isSpectator) socket.emit("spectating");

            // deny multiple connections from same session
            if (sessionList[sessionId]) {
                // TODO should this be denied? Maybe we could just keep count?
                // Either way, notify user before disconnecting...
                socket.disconnect();
                return;
            }

            // join game room & notify any other members
            console.log(`${memberType} ${sessionId} connected`);
            void socket.join(gameId);
            socket.to(gameId).emit(`${memberType} connected`);
            sessionList[sessionId] = true;

            socket.on("disconnecting", reason => {
                console.log(`${memberType} ${sessionId} disconnected for reason ${reason}`);
                socket.to(gameId).emit(`${memberType} disconnected`);
                sessionList[sessionId] = false;
                // TODO delete game after a while if both players disconnect
            });

            socket.on("turn request", (req, callback) => {
                const err: TurnEventOutcome = {
                    message: "ErrInvalidGameId",
                    status: "Error",
                    turnType: "Unknown"
                };
                if (!this.activeGames[gameId]) callback(err);
                if (isSpectator) callback({ ...err, message: "ErrSpectator" });

                // require both players to be online for first move
                const playersOnline = Object.values(players);
                const bothOnline = playersOnline.length >= 2 && playersOnline.every(b => b);
                if (!bothOnline && this.activeGames[gameId].game.getTurnCount() === 0) {
                    callback({ ...err, message: "ErrNeedOpponentOnline" });
                }

                // hand request to game & forward outcome
                const outcome = this.activeGames[gameId].game.processTurn(req);
                callback(outcome);
                if (outcome.status === "Success") {
                    socket.broadcast.to(gameId).emit("player turn", outcome);
                }
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