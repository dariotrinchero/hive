import GameServer from "@/server/session/gameServer";

let port = 3001;
let gameId;

// read port & gameId from args if available (defined in package.json)
if (process.argv.length >= 4) {
    port = parseInt(process.argv[2], 10);
    gameId = process.argv[3];
}

// optional rule disabling queen placement on first move
const noFirstQueen = true;

const server = new GameServer("dist/client", port);
gameId = server.createGame("FirstJoinIsWhite", "Black", noFirstQueen, gameId);
console.log(`http://localhost:${port}/game/${gameId}/`);