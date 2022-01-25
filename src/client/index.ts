import Board from "@/client/ui/board";

const hexRad = 90;
const board = new Board(hexRad, hexRad / 6, hexRad / 18);

board.processTurn("bA .");
board.processTurn("wG bA1-");
board.processTurn("bB /bA1");
board.processTurn("wL wG1-");
board.processTurn("bM -bA1");
board.processTurn("wP wG1\\");
board.processTurn("bQ \\bA1");
board.processTurn("wQ wG1/");
board.processTurn("bS bB1\\");
board.processTurn("wB wP-");
board.processTurn("bB \\bM");
// board.processTurn("wM wP\\");
// board.processTurn("wL bQ1-"); // move

const socket = new WebSocket("ws://" + window.location.host + "/api");

socket.onerror = m => {
    console.log("Error");
};

socket.onclose = m => {
    console.log("Closed for reason: " + m.reason);
};

socket.onopen = m => {
    console.log("Websocket connection open");
};

socket.onmessage = m => {
    console.log(m.data);
};
