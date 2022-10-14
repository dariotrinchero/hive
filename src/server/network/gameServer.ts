import express, { Express } from "express";
import bodyParser from "body-parser";
import { createServer, Server as HTTPServer } from "http";
import { Server as IOServer } from "socket.io";

import Routes from "@/common/routes";
import GameManager from "@/server/gameManager";
import RequestValidator from "@/server/network/requestValidator";

import type { NewGameRequest } from "@/types/server/gameServer";

export default class GameServer {
    // network-related properties
    private readonly httpServer: HTTPServer;
    private readonly port: number;
    private readonly baseURL: URL;

    // game-related properties
    private readonly gameManager: GameManager;

    public constructor(staticAssetPath: string, port?: number) {
        const app: Express = express();
        this.httpServer = createServer(app);
        this.gameManager = new GameManager(new IOServer(this.httpServer));
        this.setupRoutes(app, staticAssetPath);

        if (port) this.port = port;
        else if (process.env.PORT) this.port = parseInt(process.env.PORT, 10);
        else this.port = 3001;

        this.baseURL = new URL(`http://localhost:${this.port}`);
    }

    public startServer(): void {
        this.httpServer.listen(this.port, () =>
            console.log(`Serving & listening on port ${this.port}.`));
    }

    private setupRoutes(app: Express, staticAssetPath: string): void {
        const jsonParser = bodyParser.json();

        app.post(Routes.newGame(), jsonParser, RequestValidator.newGameValidator, (req, res) => {
            const { colorAssignmentRule, gameRules, startingColor } = req.body as NewGameRequest;
            const gameId = this.gameManager.createGame(
                colorAssignmentRule,
                startingColor,
                gameRules,

                // TODO this makes it impossible to create multiple games when running in dev mode:
                process.env.GAME_ID
            );

            const gameURL = new URL(Routes.joinGame(gameId), this.baseURL);
            res.status(201).send(`Created game at: ${gameURL.toString()}`);
        });

        app.delete(Routes.deleteGame(":gameId"), (req, res) => {
            const deleted = this.gameManager.deleteGame(req.params.gameId);
            if (deleted) res.sendStatus(204);
            // 404 is correct status for DELETE on non-existent resource;
            // see https://stackoverflow.com/a/6440374
            else res.status(404).send("No game with given ID.");
        });

        // TODO add routes here for other REST API methods

        // middleware to validate game ID
        app.get(Routes.joinGame(":gameId"), (req, res, next) => {
            if (!this.gameManager.gameExists(req.params.gameId))
                return res.status(404).send("No game with given ID.");
            return next();
        });
        // serve static assets
        app.use(Routes.joinGame(":gameId"), express.static(staticAssetPath));
    }
}