import express from "express";
import { createServer, Server as HTTPServer } from "http";
import { Namespace, Server } from "socket.io";
import { randomUUID as uuidv4 } from "node:crypto";

import sum from "@/common/objectHash";
import { invertColor } from "@/common/game/piece";
import HiveGame from "@/common/game/game";
import Routes from "@/server/session/routes";

import type { PieceColor } from "@/types/common/game/piece";
import type {
    ClientToServer,
    InterServer,
    ServerToClient,
    SocketData,
    TurnRequestErrorMsg
} from "@/types/common/socket";
import type {
    ActiveGames,
    ClientDetails,
    ColorAssignmentRule,
    GameDetails,
    IOSocket,
    StartingColor
} from "@/types/server/gameServer";

export default class GameServer {
    private readonly activeGames: ActiveGames = {};
    private readonly httpServer: HTTPServer;
    private readonly io: Server<ClientToServer, ServerToClient, InterServer, SocketData>;

    public constructor(staticAssetPath: string, port: number) {
        const app = express();
        this.httpServer = createServer(app);
        this.io = new Server(this.httpServer);

        // set up middleware to validate game ID & serve static assets
        app.get(Routes.getGameRoute(":gameId"), (request, _response, next) => {
            if (!this.activeGames[request.params.gameId]) return next("No such game ID.");
            return next();
        });
        app.use(Routes.getGameRoute(":gameId"), express.static(staticAssetPath));

        // listen on port
        this.httpServer.listen(port, () =>
            console.log(`serving & listening on port ${port}`));
    }

    private assignPlayerColor(playerColors: GameDetails["playerColors"], sessionId: string): PieceColor {
        const colorById = playerColors.byId;
        if (colorById[sessionId]) return colorById[sessionId];

        // This client has not joined previously (as colorById[sessionId] is unset)
        // & only one other could have joined (as this client is a "Player");
        // hence this suffices to test for the second player:
        const isSecondPlayer = Object.keys(colorById).length !== 0;

        let color: PieceColor;
        const rule = playerColors.rule;
        if (rule === "Random") {
            if (isSecondPlayer) color = invertColor(Object.values(colorById)[0]);
            else color = Math.random() <= 0.5 ? "Black" : "White";
        } else if (rule === "FirstJoinIsBlack" || rule === "FirstJoinIsWhite") {
            const firstIsBlack = rule === "FirstJoinIsBlack";
            if (isSecondPlayer) color = firstIsBlack ? "White" : "Black";
            else color = firstIsBlack ? "Black" : "White";
        } else if (sessionId === rule.sessionId) color = rule.color;
        else color = invertColor(rule.color);

        // store color by session ID for future
        return colorById[sessionId] = color;
    }

    private getClientDetails(gameId: string, socket: IOSocket): ClientDetails {
        const sessionId = socket.data.sessionId as string;
        const gameDetails = this.activeGames[gameId];
        const common = { gameDetails, gameId, sessionId, socket };

        const isSpectator = Object.keys(gameDetails.online.Player).length >= 2
            && typeof gameDetails.online.Player[sessionId] === "undefined";
        if (isSpectator) return { ...common, clientType: "Spectator" };

        const color = this.assignPlayerColor(gameDetails.playerColors, sessionId);
        return { ...common, clientType: "Player", color };
    }

    private handleConnection(clientDetails: ClientDetails): void {
        const { clientType, gameDetails, gameId, sessionId, socket } = clientDetails;

        // deny multiple connections from same session ID
        if (gameDetails.online[clientType][sessionId]) {
            // TODO should this be denied? Maybe we could just keep count?
            // Either way, notify user before disconnecting...
            socket.disconnect();
            return;
        }
        gameDetails.online[clientType][sessionId] = true;

        // send new client their session details
        const bothJoined = Object.keys(gameDetails.online.Player).length > 1;
        const common = { bothJoined, sessionId, startingColor: gameDetails.startingColor };
        if (clientType === "Spectator") socket.emit("session", { ...common, spectating: true });
        else socket.emit("session", {
            ...common,
            color: clientDetails.color,
            noFirstQueen: gameDetails.noFirstQueen,
            spectating: false
        });

        // join game room & notify any other members
        console.log(`${clientType} ${sessionId} connected`);
        void socket.join(gameId);
        socket.to(gameId).emit(`${clientType} connected`);

        // send current game state to new client
        if (gameDetails.game.getState().turnCount > 0) {
            const state = gameDetails.game.getState();
            socket.emit("game state", state, sum(state));
        }
    }

    private setupSocket(clientDetails: ClientDetails): void {
        const { clientType, gameDetails, gameId, sessionId, socket } = clientDetails;

        this.handleConnection(clientDetails);

        socket.on("disconnecting", reason => {
            console.log(`${clientType} ${sessionId} disconnected for reason ${reason}`);
            socket.to(gameId).emit(`${clientType} disconnected`);
            gameDetails.online[clientType][sessionId] = false;

            // TODO delete game after a while if both players disconnect
        });

        socket.on("turn request", (req, callback) => {
            let msg: TurnRequestErrorMsg | undefined;
            const oldHash = sum(gameDetails.game.getState());
            const { currTurnColor, turnCount } = gameDetails.game.getState();

            // reject if client may not take turn
            if (!this.activeGames[gameId]) msg = "ErrInvalidGameId";
            else if (clientType === "Spectator") msg = "ErrSpectator";
            else if (clientDetails.color !== currTurnColor) msg = "ErrOutOfTurn";
            else {
                const bothOnline = Object.values(gameDetails.online.Player).every(p => p);
                if (turnCount === 0 && !bothOnline) {
                    msg = "ErrNeedOpponentOnline"; // require both players online for first move
                }
            }

            if (!msg) {
                // attempt to take turn
                const outcome = gameDetails.game.processTurn(req);
                const newHash = sum(gameDetails.game.getState());

                callback(outcome, newHash);
                if (outcome.status === "Success") {
                    socket.broadcast.to(gameId).emit("player turn", outcome, newHash);
                }
            } else callback({ message: msg, status: "Error", turnType: "Unknown" }, oldHash);
        });

        socket.on("game state request", callback => {
            // TODO include the possibility of game ID being invalid
            callback(gameDetails.game.getState());
        });
    }

    private createNamespace(gameId: string): Namespace<ClientToServer, ServerToClient, InterServer, SocketData> {
        const nsp = this.io.of(Routes.getGameRoute(gameId));
        nsp.use((socket, next) => { // socket middleware to inject user session ID
            const sessionId = socket.handshake.auth.sessionId as string | null;
            socket.data.sessionId = sessionId || uuidv4();
            next();
        });
        nsp.on("connection", socket =>
            this.setupSocket(this.getClientDetails(gameId, socket)));
        return nsp;
    }

    private deleteNamespace(gameId: string): void {
        const nsp = this.activeGames[gameId].nsp;
        nsp.disconnectSockets();
        nsp.removeAllListeners();
        this.io._nsps.delete(Routes.getGameRoute(gameId));
    }

    public createGame(
        colorAssignmentRule: ColorAssignmentRule,
        startingColor: StartingColor,
        noFirstQueen?: boolean,
        gameId?: string
    ): string {
        gameId ||= uuidv4();
        if (startingColor === "Random") startingColor = Math.random() <= 0.5 ? "Black" : "White";

        this.activeGames[gameId] = {
            game: new HiveGame(startingColor),
            noFirstQueen: noFirstQueen || false,
            nsp: this.createNamespace(gameId),
            online: {
                Player: {},
                Spectator: {}
            },
            playerColors: {
                byId: {},
                rule: colorAssignmentRule
            },
            startingColor
        };
        return gameId;
    }

    public deleteGame(gameId: string): void {
        this.deleteNamespace(gameId);
        delete this.activeGames[gameId];
    }
}