import type { OptionalGameRules } from "@/types/common/engine/game";

import GameServer from "@/server/session/gameServer";

let port = 3001;
let gameId: string | undefined;

// read port & gameId from args if available (defined in package.json)
if (process.argv.length >= 4) {
    port = parseInt(process.argv[2], 10);
    gameId = process.argv[3];
}

// optional game rules
const rules: OptionalGameRules = {
    expansions: {
        Ladybug: true,
        Mosquito: true,
        Pillbug: true
    },
    noFirstQueen: true
};

const server = new GameServer("dist/client", port);
gameId = server.createGame("FirstJoinIsWhite", "Black", rules, gameId);
console.log(`http://localhost:${port}/game/${gameId}/`);