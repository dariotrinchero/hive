import express from "express";
import expressWs from "express-ws";

export default abstract class GameServer {
    public static start(staticAssetPath: string) {
        const instance = expressWs(express());

        // serve static assets from /
        const app = instance.app;
        app.use(express.static(staticAssetPath));

        // serve websocket API from /api
        const wsServer = instance.getWss();
        app.ws("/api", (ws, req) => {
            console.log("New connection!");

            ws.on("close", () => {
                console.log("A connection was closed!");
            });

            ws.on("message", (msg: string) => {
                ws.send(msg);
            });
        });

        // Listen on port 3001
        app.listen(3001, () => {
            console.log("listening on port 3001");
        });
    }
}