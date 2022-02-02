import GameServer from "@/server/session/gameServer";

// TODO find better way of storing path / port, synced with webpack config (ENV variables?)
const port = 3001;
const server = new GameServer("dist/client", port);
const gameId = server.createGame("FirstJoinIsWhite", "Black");
console.log(`http://localhost:${port}/game/${gameId}/`);