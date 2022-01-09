import Board from "@/components/board";

const board = new Board(1500, 800, 90, 5);
board.spawnTile(0, 0, { color: "Black", type: "Ant" });
board.spawnTile(1, 0, { color: "Black", type: "Beetle" });
board.spawnTile(2, 0, { color: "White", type: "Grasshopper" });
board.spawnTile(0, 1, { color: "White", type: "Ladybug" });
board.spawnTile(3, 0, { color: "Black", type: "Mosquito" });
board.spawnTile(1, 1, { color: "White", type: "Pillbug" });
board.spawnTile(-1, 2, { color: "White", type: "QueenBee" });
board.spawnTile(0, -1, { color: "Black", type: "Spider" });
board.spawnPlaceholder(0, 2);