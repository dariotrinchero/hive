import express from "express";
import { createServer, Server as HTTPServer } from "http";
import { Namespace, Server, Socket } from "socket.io";
import HiveGame from "@/server/game/game";

import type {
    ClientToServer,
    InterServer,
    ServerToClient,
    SocketData
} from "@/types/common/socket";

type GameSessions = {
    [gameId: string]: {
        game: HiveGame;
        nsp: Namespace<ClientToServer, ServerToClient, InterServer, SocketData>;
        openSockets: Socket<ClientToServer, ServerToClient, InterServer, SocketData>[];
    };
};

const gamePath = (gameId: string) => `/game/${gameId}/`;

export default class GameServer {
    private sessions: GameSessions = {};
    private httpServer: HTTPServer;
    private io: Server<ClientToServer, ServerToClient, InterServer, SocketData>;

    public constructor(staticAssetPath: string, port: number) {
        const app = express();
        this.httpServer = createServer(app);
        this.io = new Server<ClientToServer, ServerToClient, InterServer, SocketData>(this.httpServer);

        // middleware to grab game ID
        app.get(gamePath(":gameId"), (request, response, next) => {
            // get game ID from route parameter
            const gameId = request.params.gameId;
            if (!this.sessions[gameId]) next("No such game ID.");

            // pass to next middleware function
            next();
        });

        // middleware to serve game client static assets
        app.use(gamePath(":gameId"), express.static(staticAssetPath));

        // listen on port
        this.httpServer.listen(port, () => {
            console.log(`serving & listening on port ${port}`);
        });
    }

    public startNewGame(): string {
        // TODO generate some kind of UUID
        const gameId = "TEST";

        const nsp = this.io.of(gamePath(gameId));
        this.sessions[gameId] = {
            game: new HiveGame(),
            nsp,
            openSockets: []
        };

        // serve websocket API
        nsp.on("connection", socket => {
            console.log(`a user connected to game: ${gameId}`);

            // reject if there are already two players in game
            if (this.sessions[gameId].openSockets.length >= 2) {
                // TODO maybe add new connections as spectators, tracking these clients separately
                // & rejecting any moves they attempt...
                socket.emit("game full");
                socket.disconnect();
                return;
            }

            // join game room & notify any other players
            void socket.join(gameId);
            socket.to(gameId).emit("opponent connected");
            this.sessions[gameId].openSockets.push(socket);

            socket.on("disconnecting", () =>
                socket.to(gameId).emit("opponent disconnected"));

            socket.on("disconnect", reason => {
                console.log(`user disconnected from game ${gameId} for reason ${reason}`);
            });

            socket.on("turn request", (req, callback) => {
                if (!this.sessions[gameId]) throw new Error("Game ID is no longer valid."); // TODO should this throw?
                const outcome = this.sessions[gameId].game.processTurn(req);

                callback(outcome);
                if (outcome.status === "Success") socket.broadcast.to(gameId).emit("opponent turn", outcome);
            });
        });

        return gameId;
    }
}