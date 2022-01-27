import GameServer from "@/server/session/gameServer";

// TODO find better way of storing path / port, synced with webpack config
// TODO perhaps environment variables?
const server = new GameServer("dist/client", 3001);
const gameId = server.startNewGame();