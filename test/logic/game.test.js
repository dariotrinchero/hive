const { default: HiveGame } = require("@/logic/game");

let game = null;

const b = "Black";
const w = "White";

describe("When new piece is placed", () => {
    beforeEach(() => game = new HiveGame());

    it("updates the board", () => {
        const pos = { u: 0, v: 0 };
        expect(game.getFromPos(pos)).toBeNull();
        expect(game.placePiece(pos, { color: b, type: "Grasshopper" }).outcome).toBe("Success");
        const piece = game.getFromPos(pos);
        expect(piece).not.toBeNull();
        expect(piece.color).toBe(b);
        expect(piece.type).toBe("Grasshopper");
    });

    it("correctly sets the index", () => {
        // TODO
    });

    it("rejects if out-of-turn", () => {
        expect(game.placePiece({ u: 0, v: 0 }, { color: b, type: "Grasshopper" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 0, v: 1 }, { color: b, type: "Ant" }).message).toBe("ErrOutOfTurn");
        game = new HiveGame();
        expect(game.placePiece({ u: 0, v: 0 }, { color: w, type: "QueenBee" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 0, v: 1 }, { color: w, type: "Beetle" }).message).toBe("ErrOutOfTurn");
    });

    it("rejects if player lacks inventory", () => {
        expect(game.placePiece({ u: 0, v: 3 }, { color: b, type: "Beetle" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 0, v: 4 }, { color: w, type: "Grasshopper" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 0, v: 2 }, { color: b, type: "Beetle" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 0, v: 5 }, { color: w, type: "QueenBee" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 0, v: 1 }, { color: b, type: "Beetle" }).message).toBe("ErrOutOfPieces");
    });

    it("rejects if destination is occupied", () => {
        expect(game.placePiece({ u: 2, v: 3 }, { color: b, type: "Beetle" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 2, v: 3 }, { color: w, type: "Grasshopper" }).message).toBe("ErrDestinationOccupied");
    });

    it("rejects if placement is disconnected", () => {
        expect(game.placePiece({ u: 2, v: 3 }, { color: b, type: "Beetle" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 6, v: 1 }, { color: w, type: "Grasshopper" }).message).toBe("ErrOneHiveRule");
    });

    it("rejects if destination borders opposing color", () => {
        expect(game.placePiece({ u: 0, v: 0 }, { color: b, type: "Beetle" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 0, v: 1 }, { color: w, type: "Grasshopper" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 1, v: 0 }, { color: b, type: "Grasshopper" }).message).toBe("ErrTouchesOppColor");
        expect(game.placePiece({ u: -1, v: 0 }, { color: b, type: "Grasshopper" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 1, v: 0 }, { color: w, type: "Grasshopper" }).message).toBe("ErrTouchesOppColor");
        expect(game.placePiece({ u: 1, v: 1 }, { color: w, type: "Grasshopper" }).outcome).toBe("Success");
    });

    it("rejects anything but queen if is unplayed by 4th placement", () => {
        expect(game.placePiece({ u: 0, v: 3 }, { color: b, type: "Beetle" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 0, v: 4 }, { color: w, type: "Grasshopper" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 0, v: 2 }, { color: b, type: "Beetle" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 0, v: 5 }, { color: w, type: "QueenBee" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 0, v: 1 }, { color: b, type: "Spider" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 0, v: 6 }, { color: w, type: "Spider" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 0, v: 0 }, { color: b, type: "Spider" }).message).toBe("ErrMustBeQueen");
        expect(game.placePiece({ u: 0, v: 0 }, { color: b, type: "QueenBee" }).outcome).toBe("Success");
        expect(game.placePiece({ u: 0, v: 7 }, { color: w, type: "Spider" }).outcome).toBe("Success");
    });
});

describe("When piece is moved", () => {
    const pos = { u: 0, v: 0 };
    beforeEach(() => game = new HiveGame());

    it("updates the board", () => {
        const fromPos = { u: 0, v: 0 };
        const toPos = { u: 0, v: 1 };
        game.placePiece(fromPos, { color: b, type: "QueenBee" });
        game.placePiece({ u: fromPos.u + 1, v: fromPos.v }, { color: w, type: "QueenBee" });
        expect(game.getFromPos(fromPos)).not.toBeNull();
        expect(game.getFromPos(toPos)).toBeNull();
        expect(game.movePiece(fromPos, toPos).outcome).toBe("Success");
        expect(game.getFromPos(fromPos)).toBeNull();
        const piece = game.getFromPos(toPos);
        expect(piece).not.toBeNull();
        expect(piece.color).toBe(b);
        expect(piece.type).toBe("QueenBee");
    });

    it("rejects if no piece is found", () => {
        expect(game.movePiece(pos, { u: 1, v: 0 }).message).toBe("ErrNoPieceFound");
    });

    it("rejects if destination is the same as origin", () => {
        game.placePiece(pos, { color: b, type: "Beetle" });
        expect(game.movePiece(pos, pos).message).toBe("ErrAlreadyThere");
    });

    it("rejects if destination is occupied (except for beetles)", () => {
        game.placePiece({ u: 0, v: 0 }, { color: b, type: "QueenBee" });
        game.placePiece({ u: -1, v: 0 }, { color: w, type: "QueenBee" });
        game.placePiece({ u: 0, v: 1 }, { color: b, type: "Grasshopper" });
        game.placePiece({ u: -2, v: 0 }, { color: w, type: "Beetle" });
        game.placePiece({ u: 1, v: 0 }, { color: b, type: "Beetle" });
        game.placePiece({ u: -3, v: 0 }, { color: w, type: "Beetle" });
        expect(game.movePiece({ u: 0, v: 1 }, pos).message).toBe("ErrDestinationOccupied");
        expect(game.movePiece({ u: 1, v: 0 }, pos).outcome).toBe("Success");
    });

    it("rejects if out-of-turn", () => {
        game.placePiece({ u: 0, v: 0 }, { color: b, type: "QueenBee" });
        game.placePiece({ u: 1, v: 0 }, { color: w, type: "QueenBee" });
        expect(game.movePiece(pos, { u: 0, v: 1 }).outcome).toBe("Success");
        expect(game.movePiece({ u: 0, v: 1 }, pos).message).toBe("ErrOutOfTurn");
    });

    it("rejects if queen is unplayed", () => {
        game.placePiece({ u: 0, v: 0 }, { color: b, type: "QueenBee" });
        game.placePiece({ u: 1, v: 0 }, { color: w, type: "Beetle" });
        expect(game.movePiece(pos, { u: 0, v: 1 }).outcome).toBe("Success");
        expect(game.movePiece({ u: 1, v: 0 }, pos).message).toBe("ErrQueenUnplayed");
    });

    it("rejects if one-hive rule is violated", () => {
        game.placePiece({ u: 0, v: 1 }, { color: b, type: "QueenBee" });
        game.placePiece({ u: 1, v: 0 }, { color: w, type: "QueenBee" });
        expect(game.movePiece({ u: 0, v: 1 }, { u: 0, v: 2 }).message).toBe("ErrOneHiveRule"); // destination disconnected
        game.placePiece({ u: -1, v: 1 }, { color: b, type: "Ant" });
        game.placePiece({ u: 1, v: -1 }, { color: w, type: "Ant" });
        game.placePiece({ u: -1, v: 0 }, { color: b, type: "Ant" });
        game.placePiece({ u: 2, v: 0 }, { color: w, type: "Ant" });
        game.placePiece({ u: 0, v: 2 }, { color: b, type: "Ant" });
        expect(game.movePiece({ u: 2, v: 0 }, { u: 0, v: -1 }).outcome).toBe("Success");
        expect(game.movePiece({ u: 0, v: 2 }, { u: -2, v: 2 }).outcome).toBe("Success");
        expect(game.movePiece({ u: 0, v: -1 }, { u: -2, v: 1 }).outcome).toBe("Success");
        game.placePiece({ u: 0, v: 2 }, { color: b, type: "Grasshopper" }); // change turn
        expect(game.movePiece({ u: -2, v: 1 }, { u: -1, v: -1 }).outcome).toBe("Success");
        expect(game.movePiece({ u: -1, v: 0 }, { u: 0, v: -1 }).message).toBe("ErrOneHiveRule"); // disconnects "in-transit"
        expect(game.movePiece({ u: -2, v: 2 }, { u: -1, v: -2 }).outcome).toBe("Success");
        expect(game.movePiece({ u: -1, v: -1 }, { u: 2, v: 0 }).message).toBe("ErrOneHiveRule"); // disconnects
    });

    it("rejects if piece is queen & queen movement is violated", () => {
        game.placePiece({ u: 0, v: 1 }, { color: b, type: "QueenBee" });
        game.placePiece({ u: 1, v: 0 }, { color: w, type: "QueenBee" });
        expect(game.movePiece({ u: 0, v: 1 }, { u: 1, v: -1 }).message).toBe("ErrViolatesQueenBeeMovement");
        expect(game.movePiece({ u: 0, v: 1 }, { u: 2, v: -1 }).message).toBe("ErrViolatesQueenBeeMovement");
        expect(game.movePiece({ u: 0, v: 1 }, { u: 0, v: 0 }).outcome).toBe("Success");
    });
});