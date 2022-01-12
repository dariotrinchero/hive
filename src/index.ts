import Board from "@/components/board";

const board = new Board(1500, 800, 90, 15, 5);
board.placeTile(0, 0, "bA");
board.placeTile(1, 0, "wG");
board.placeTile(-1, 1, "bB");
board.placeTile(2, 0, "wL");
board.placeTile(-1, 0, "bM");
board.placeTile(1, 1, "wP");
board.placeTile(0, -1, "bQ");
board.placeTile(2, -1, "wQ");
board.placeTile(-1, 2, "bS");
board.spawnPlaceholder({ u: 0, v: 2 });