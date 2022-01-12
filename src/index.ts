import Board from "@/components/board";

const hexRad = 90;
const board = new Board(1600, 900, hexRad, hexRad / 6, hexRad / 18);
board.processTurn("bA .");
board.processTurn("wG bA1-");
board.processTurn("bB /bA1");
board.processTurn("wL wG1-");
board.processTurn("bM -bA1");
board.processTurn("wP wG1\\");
board.processTurn("bQ \\bA1");
board.processTurn("wQ wG1/");
board.processTurn("bS bB1\\");
// board.processTurn("wL1 bS1-"); // move
board.spawnPlaceholder({ direction: "o-", referencePiece: { color: "Black", index: 1, type: "Spider" } });