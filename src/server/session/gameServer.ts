import express from "express";
import { createServer, Server as HTTPServer } from "http";
import { Server } from "socket.io";
import { randomUUID as uuidv4 } from "node:crypto";

import sum from "@/common/objectHash";
import { invertColor } from "@/common/engine/piece";
import HiveGame from "@/common/engine/game";
import Routes from "@/server/session/routes";

import type { PieceColor } from "@/types/common/engine/piece";
import type {
    ClientSession,
    ClientToServer,
    InterServer,
    ServerToClient,
    SocketData,
    TurnRequestErrorMsg,
    TurnRequestResult
} from "@/types/common/socket";
import type {
    ActiveGames,
    ClientDetails,
    ColorAssignmentRule,
    GameDetails,
    IONamespace,
    IOSocket,
    StartingColor
} from "@/types/server/gameServer";
import type { TurnAttempt } from "@/types/common/engine/outcomes";
import type { OptionalGameRules } from "@/types/common/engine/game";

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

    // ===================================================================================================
    //  Public-facing API functions
    // ===================================================================================================

    /**
     * Create new game with given rules; this includes creating a valid route & socket namespace
     * associated with the game ID so players can connect.
     * 
     * @see createNamespace
     * @param colorAssignmentRule rule specifying how piece colors are assigned to players
     * @param startingColor rule specifying the color to play first
     * @param rules optional game rules, such as which expansion pieces are used
     * @param gameId specify the ID (and thereby URL) of the new game (default is random UUID)
     * @returns the ID of the newly-created game
     */
    public createGame(
        colorAssignmentRule: ColorAssignmentRule,
        startingColor: StartingColor,
        rules?: OptionalGameRules,
        gameId?: string
    ): string {
        gameId ||= uuidv4();
        if (startingColor === "Random") startingColor = Math.random() <= 0.5 ? "Black" : "White";

        // TODO make it possible to disable some expansions
        this.activeGames[gameId] = {
            game: new HiveGame(startingColor, rules),
            nsp: this.createNamespace(gameId),
            online: {
                Player: {},
                Spectator: {}
            },
            playerColors: {
                byId: {},
                rule: colorAssignmentRule
            }
        };
        return gameId;
    }

    /**
     * Delete namespace associated with game, disconnecting existing sockets & removing active
     * listeners, then remove all game details from list of active games.
     * 
     * @param gameId UUID of game to delete
     */
    public deleteGame(gameId: string): void {
        const nsp = this.activeGames[gameId].nsp;
        nsp.disconnectSockets();
        nsp.removeAllListeners();
        this.io._nsps.delete(Routes.getGameRoute(gameId));
        delete this.activeGames[gameId];
    }

    // ===================================================================================================
    //  Internal helper functions
    // ===================================================================================================

    /**
     * Create a Socket.io 'namespace', to which clients navigating to the URL associated with
     * given game ID are automatically addded. This allows socket events to be broadcasted to
     * these clients, and not those of other games.
     * 
     * @param gameId the ID of the game for which to create a namespace
     * @returns the newly-created Socket.io namespace
     */
    private createNamespace(gameId: string): IONamespace {
        const nsp = this.io.of(Routes.getGameRoute(gameId));
        nsp.use((socket, next) => { // socket middleware to inject user session ID
            const sessionId = socket.handshake.auth.sessionId as string | null;
            socket.data.sessionId = sessionId || uuidv4();
            next();
        });
        nsp.on("connection", socket => this.setupSocket(this.getClientDetails(gameId, socket)));
        return nsp;
    }

    /**
     * Get details of client connecting to a game, such as whether they are spectating or
     * their color if not. These details are inferred from the game details, together with
     * the browser session ID of the client (stored in their socket data).
     * 
     * @param gameId game being joined by client
     * @param socket client's socket (with session ID injected by namespace middleware)
     * @returns details of newly-joined client
     */
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

    /**
     * Determine the color of the player with given session ID, either directly from game details
     * (if game already has session IDs associated with colors, such as for a player who momentarily
     * disconnected then rejoined), or using the color assignment rule specified on game creation.
     * 
     * @param playerColors record of assigned player colors, and assignment rule for new sessions
     * @param sessionId UUID identifying player (stored in their browser session)
     * @returns the color associated with given player
     */
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

    /**
     * Handle connection of new client to a game by running once-off initialization and
     * setting up handlers for future socket events.
     * 
     * Note that client details are assumed valid (& unchanged) for future events. This
     * is because deleting a game deletes its namespace & route, & disconnects existing
     * sockets, so as long as we can connect, client details should never be invalid/stale.
     * 
     * @see handleConnection
     * @param client details of client (including game they are joining)
     */
    private setupSocket(client: ClientDetails): void {
        const { gameDetails, socket } = client;
        this.handleConnection(client);
        socket.on("disconnecting", reason => this.handleDisconnection(client, reason));
        socket.on("game state request", callback => callback(gameDetails.game.getState()));
        socket.on("turn request", (req, callback) =>
            callback(...this.handleTurnReq(client, req)));
    }

    /**
     * Run once-off initialization code for connection of new client to a game, including
     * sending new client their session details & the current game state, & notifying
     * existing clients of new connection.
     * 
     * @param client details of client (including game they are joining)
     */
    private handleConnection(client: ClientDetails): void {
        const { clientType, gameDetails, gameId, sessionId, socket } = client;

        // register client as online
        if (typeof gameDetails.online[clientType][sessionId] === "undefined")
            gameDetails.online[clientType][sessionId] = 0;
        gameDetails.online[clientType][sessionId]++;

        // send new client their session details
        const spectatorSession: ClientSession = {
            bothJoined: Object.keys(gameDetails.online.Player).length > 1,
            rules: gameDetails.game.getRules(),
            sessionId,
            spectating: true,
            state: gameDetails.game.getState()
        };
        if (clientType === "Spectator") socket.emit("session", spectatorSession);
        else socket.emit("session", {
            ...spectatorSession,
            color: client.color,
            spectating: false
        });

        // join game room & notify any other members
        console.log(`${clientType} ${sessionId} connected`);
        void socket.join(gameId);
        socket.to(gameId).emit(`${clientType} connected`);
    }

    private handleDisconnection(client: ClientDetails, reason: string): void {
        const { clientType, gameDetails, gameId, sessionId, socket } = client;
        console.log(`${clientType} ${sessionId} disconnected for reason ${reason}`);
        socket.to(gameId).emit(`${clientType} disconnected`);
        if (gameDetails.online[clientType][sessionId])
            gameDetails.online[clientType][sessionId]--;

        // TODO delete game after a while if both players disconnect
    }

    /**
     * Process given turn request made by given client, by first checking whether client may make
     * turn requests at all, and if so attempting turn on client's game.
     * 
     * @param client details of client (including game they belong to)
     * @param req turn request to process
     * @returns tuple containing result and hash of game state post-request
     */
    private handleTurnReq(client: ClientDetails, req: TurnAttempt): [TurnRequestResult, string] {
        const { clientType, gameDetails, gameId, socket } = client;

        let message: TurnRequestErrorMsg | undefined;
        let hash = sum(gameDetails.game.getState());
        const { currTurnColor, turnCount } = gameDetails.game.getState();

        // reject if client may not take turn
        if (!this.activeGames[gameId]) message = "ErrInvalidGameId";
        else if (clientType === "Spectator") message = "ErrSpectator";
        else if (client.color !== currTurnColor) message = "ErrOutOfTurn";
        else {
            const bothOnline = Object.values(gameDetails.online.Player).every(p => p);
            if (turnCount === 0 && !bothOnline) {
                message = "ErrNeedOpponentOnline"; // require both players online for first move
            }
        }
        if (message) return [{ message, status: "Err", turnType: "Unknown" }, hash];

        // attempt turn
        const result = gameDetails.game.processTurn(req);
        hash = sum(gameDetails.game.getState());
        if (result.status === "Ok") {
            socket.broadcast.to(gameId).emit("player turn", result, hash);
        }
        return [result, hash];
    }
}