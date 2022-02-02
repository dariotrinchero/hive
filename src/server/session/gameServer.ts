import express from "express";
import { createServer, Server as HTTPServer } from "http";
import { Namespace, Server } from "socket.io";
import { v4 as uuidv4 } from "uuid";

import sum from "@/common/objectHash";
import { invertColor } from "@/common/piece";
import HiveGame from "@/common/game/game";
import Routes from "@/server/session/routes";

import type {
    ClientToServer,
    EventErrorBase,
    InterServer,
    MovementEventOutcome,
    ServerToClient,
    SocketData,
    TurnEventOutcome
} from "@/types/common/socket";
import type {
    ActiveGames,
    ClientDetails,
    ColorAssignmentRule,
    GameDetails,
    IOSocket,
    StartingColor
} from "@/types/server/gameServer";
import type { TurnOutcome } from "@/types/common/turn";
import type { PieceColor } from "@/types/common/piece";

export default class GameServer {
    private activeGames: ActiveGames = {};
    private httpServer: HTTPServer;
    private io: Server<ClientToServer, ServerToClient, InterServer, SocketData>;

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
        else {
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
            } else {
                if (sessionId === rule.sessionId) color = rule.color;
                else color = invertColor(rule.color);
            }

            // store color by session ID for future
            return colorById[sessionId] = color;
        }
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

        // send new client their session details
        const common = { sessionId, startingColor: gameDetails.startingColor };
        if (clientType === "Spectator") socket.emit("session", { ...common, spectating: true });
        else socket.emit("session", { ...common, color: clientDetails.color, spectating: false });

        // join game room & notify any other members
        console.log(`${clientType} ${sessionId} connected`);
        void socket.join(gameId);
        socket.to(gameId).emit(`${clientType} connected`);
        gameDetails.online[clientType][sessionId] = true;

        // send current game state to new client
        if (gameDetails.game.getTurnCount() > 0) {
            const state = gameDetails.game.getState();
            socket.emit("game state", state, sum(state));
        }
    }

    private checkClientForTurn<T extends EventErrorBase>(
        clientDetails: ClientDetails,
        errTemplate: T,
        oldHash: string,
        callback: (out: T, hash: string) => void,
    ): boolean {
        const { clientType, gameDetails: { online, game }, gameId } = clientDetails;

        if (!this.activeGames[gameId]) {
            // ensure valid game ID
            callback(errTemplate, "");
        } else if (clientType === "Spectator") {
            // reject spectator moves
            callback({ ...errTemplate, message: "ErrSpectator" }, oldHash);
        } else if (clientDetails.color !== game.getCurrTurnColor()) {
            // reject if out-of-turn
            callback({ ...errTemplate, message: "ErrOutOfTurn" }, oldHash);
        } else {
            const onlineFlags = Object.values(online.Player);
            if (game.getTurnCount() === 0 && !(onlineFlags[0] && onlineFlags[1])) {
                // require both players to be online for first move
                callback({ ...errTemplate, message: "ErrNeedOpponentOnline" }, oldHash);
            } else return true;
        }

        return false;
    }

    private handleTurnOutcome<T extends TurnOutcome>(
        clientDetails: ClientDetails,
        outcome: T,
        callback: (out: T, hash: string) => void
    ) {
        const { gameDetails: { game }, gameId, socket } = clientDetails;
        const newHash = sum(game.getState());
        callback(outcome, newHash);
        if (outcome.status === "Success") {
            socket.broadcast.to(gameId).emit("player turn", outcome, newHash);
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
            const err: TurnEventOutcome = {
                message: "ErrInvalidGameId",
                status: "Error",
                turnType: "Unknown"
            };
            if (this.checkClientForTurn(clientDetails, err, sum(gameDetails.game.getState()), callback)) {
                this.handleTurnOutcome(clientDetails, gameDetails.game.processTurn(req), callback);
            }
        });

        socket.on("move request", (piece, destination, callback) => {
            const err: MovementEventOutcome = {
                message: "ErrInvalidGameId",
                status: "Error",
                turnType: "Movement"
            };
            if (this.checkClientForTurn(clientDetails, err, sum(gameDetails.game.getState()), callback)) {
                this.handleTurnOutcome(clientDetails, gameDetails.game.movePiece(piece, destination), callback);
            }
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

    public createGame(colorAssignmentRule: ColorAssignmentRule, startingColor: StartingColor): string {
        const gameId = uuidv4();
        if (startingColor === "Random") startingColor = Math.random() <= 0.5 ? "Black" : "White";

        this.activeGames[gameId] = {
            game: new HiveGame(startingColor),
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