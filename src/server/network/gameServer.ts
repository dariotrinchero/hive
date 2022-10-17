import express, { Express, RequestHandler } from "express";
import bodyParser from "body-parser";
import { createServer, Server as HTTPServer } from "http";
import { Server as IOServer } from "socket.io";

import Routes from "@/common/routes";
import GameManager from "@/server/gameManager";
import RequestValidator from "@/server/network/requestValidator";

import type {
    NewGameRequest,
    NewGameResponse
} from "@/types/server/gameServer";

export default class GameServer {
    private readonly httpServer: HTTPServer;
    private readonly port: number;
    private readonly gameManager: GameManager;

    public constructor(staticAssetPath: string, port?: number) {
        const app: Express = express();
        this.httpServer = createServer(app);
        this.gameManager = new GameManager(new IOServer(this.httpServer));
        this.setupRoutes(app, staticAssetPath);

        if (port) this.port = port;
        else if (process.env.PORT) this.port = parseInt(process.env.PORT, 10);
        else this.port = 3001;
    }

    /**
     * Launch game server by beginning to listen for requests.
     */
    public startServer(): void {
        this.httpServer.listen(this.port, () =>
            console.log(`Serving & listening on port ${this.port}.`));
    }

    /**
     * Set up allowed routes for HTTP requests, including for REST API and serving static assets.
     * 
     * @param app the Express app for which to configure routes
     * @param staticAssetPath path to local directory containing (bundled) static assets to serve
     */
    private setupRoutes(app: Express, staticAssetPath: string): void {
        // API routes
        app.post(Routes.newGame, bodyParser.json(),
            RequestValidator.newGameValidator, this.handleNewGame);
        app.delete(Routes.deleteGame(":gameId"), this.handleDeleteGame);

        // middleware to set code to 404 (but proceed anyway) for invalid game IDs
        app.get(Routes.joinGame(":gameId"), (req, res, next) => {
            if (!this.gameManager.gameExists(req.params.gameId)) res.status(404);
            return next();
        });

        // static asset routes
        const staticAssetHandler = express.static(staticAssetPath);
        app.use(
            [
                Routes.joinGame(":gameId"),
                Routes.home
            ],
            staticAssetHandler
        );

        // fallthrough 404 route
        app.use("*", (_req, res, next) => {
            res.status(404);
            next();
        }, staticAssetHandler);

        // TODO add general error handler
        // https://expressjs.com/en/guide/error-handling.html
        // https://stackoverflow.com/questions/50218878/typescript-express-error-function
    }

    /**
     * Handle POST request for creation of new game.
     * 
     * @param req creation POST request with (validated) body of type {@link NewGameRequest}
     * @param res response; status set to 201 ("Created") & body to type {@link NewGameResponse}
     */
    private handleNewGame: RequestHandler = (req, res) => {
        const { colorAssignmentRule, gameRules, startingColor } = req.body as NewGameRequest;
        const gameId = this.gameManager.createGame(
            colorAssignmentRule,
            startingColor,
            gameRules,
            // TODO this makes it impossible to create multiple games when running in dev mode:
            process.env.GAME_ID
        );
        const responseBody: NewGameResponse = { colorAssignmentRule, gameId, gameRules, startingColor };
        res.status(201)
            .location(Routes.joinGame(gameId))
            .send(responseBody);
    };

    /**
     * Handle DELETE request for deletion of existing game.
     * 
     * @param req deletion request with targetted game ID in request URL parameters
     * @param res response; status set to 204 ("No Content") if successful or 404 ("Not Found")
     *            if game with given ID does not exist
     */
    private handleDeleteGame: RequestHandler = (req, res) => {
        const deleted = this.gameManager.deleteGame(req.params.gameId);
        if (deleted) res.sendStatus(204);
        // 404 is correct status for DELETE on non-existent resource;
        // see https://stackoverflow.com/a/6440374
        else res.status(404).send("No game with given ID.");
    };
}