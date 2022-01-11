const { default: HiveGame } = require("@/logic/game");

let game = null;

describe("When new piece is placed", () => {
    beforeEach(() => game = new HiveGame());

    it("updates the board", () => {
        const pos = { u: 0, v: 0 };
        expect(game.getFromPos(pos)).toBeNull();
        expect(game.spawnPiece(pos.u, pos.v, { color: "Black", type: "Grasshopper" })).toBe("Success");
        const piece = game.getFromPos(pos);
        expect(piece).not.toBeNull();
        expect(piece.color).toBe("Black");
        expect(piece.type).toBe("Grasshopper");
    });

    it("rejects if out-of-turn", () => {
        expect(game.spawnPiece(0, 0, { color: "Black", type: "Grasshopper" })).toBe("Success");
        expect(game.spawnPiece(0, 1, { color: "Black", type: "Ant" })).toBe("ErrOutOfTurn");
        game = new HiveGame();
        expect(game.spawnPiece(0, 0, { color: "White", type: "QueenBee" })).toBe("Success");
        expect(game.spawnPiece(0, 1, { color: "White", type: "Beetle" })).toBe("ErrOutOfTurn");
    });

    it("rejects if player lacks inventory", () => {
        expect(game.spawnPiece(0, 3, { color: "Black", type: "Beetle" })).toBe("Success");
        expect(game.spawnPiece(0, 4, { color: "White", type: "Grasshopper" })).toBe("Success");
        expect(game.spawnPiece(0, 2, { color: "Black", type: "Beetle" })).toBe("Success");
        expect(game.spawnPiece(0, 5, { color: "White", type: "QueenBee" })).toBe("Success");
        expect(game.spawnPiece(0, 1, { color: "Black", type: "Beetle" })).toBe("ErrOutOfPieces");
    });

    it("rejects if destination is occupied", () => {
        expect(game.spawnPiece(2, 3, { color: "Black", type: "Beetle" })).toBe("Success");
        expect(game.spawnPiece(2, 3, { color: "White", type: "Grasshopper" })).toBe("ErrDestinationOccupied");
    });

    it("rejects if placement is disconnected", () => {
        expect(game.spawnPiece(2, 3, { color: "Black", type: "Beetle" })).toBe("Success");
        expect(game.spawnPiece(6, 1, { color: "White", type: "Grasshopper" })).toBe("ErrOneHiveRule");
    });

    it("rejects if destination borders opposing color", () => {
        expect(game.spawnPiece(0, 0, { color: "Black", type: "Beetle" })).toBe("Success");
        expect(game.spawnPiece(0, 1, { color: "White", type: "Grasshopper" })).toBe("Success");
        expect(game.spawnPiece(1, 0, { color: "Black", type: "Grasshopper" })).toBe("ErrTouchesOppColor");
        expect(game.spawnPiece(-1, 0, { color: "Black", type: "Grasshopper" })).toBe("Success");
        expect(game.spawnPiece(1, 0, { color: "White", type: "Grasshopper" })).toBe("ErrTouchesOppColor");
        expect(game.spawnPiece(1, 1, { color: "White", type: "Grasshopper" })).toBe("Success");
    });

    it("rejects anything but queen if is unplayed by 4th placement", () => {
        expect(game.spawnPiece(0, 3, { color: "Black", type: "Beetle" })).toBe("Success");
        expect(game.spawnPiece(0, 4, { color: "White", type: "Grasshopper" })).toBe("Success");
        expect(game.spawnPiece(0, 2, { color: "Black", type: "Beetle" })).toBe("Success");
        expect(game.spawnPiece(0, 5, { color: "White", type: "QueenBee" })).toBe("Success");
        expect(game.spawnPiece(0, 1, { color: "Black", type: "Spider" })).toBe("Success");
        expect(game.spawnPiece(0, 6, { color: "White", type: "Spider" })).toBe("Success");
        expect(game.spawnPiece(0, 0, { color: "Black", type: "Spider" })).toBe("ErrMustBeQueen");
        expect(game.spawnPiece(0, 0, { color: "Black", type: "QueenBee" })).toBe("Success");
        expect(game.spawnPiece(0, 7, { color: "White", type: "Spider" })).toBe("Success");
    });
});

describe("When piece is moved", () => {
    const pos = { u: 0, v: 0 };
    beforeEach(() => game = new HiveGame());

    it("updates the board", () => {
        const fromPos = { u: 0, v: 0 };
        const toPos = { u: 0, v: 1 };
        game.spawnPiece(fromPos.u, fromPos.v, { color: "Black", type: "QueenBee" });
        game.spawnPiece(fromPos.u + 1, fromPos.v, { color: "White", type: "QueenBee" });
        expect(game.getFromPos(fromPos)).not.toBeNull();
        expect(game.getFromPos(toPos)).toBeNull();
        expect(game.movePiece(fromPos, toPos)).toBe("Success");
        expect(game.getFromPos(fromPos)).toBeNull();
        const piece = game.getFromPos(toPos);
        expect(piece).not.toBeNull();
        expect(piece.color).toBe("Black");
        expect(piece.type).toBe("QueenBee");
    });

    it("rejects if no piece is found", () => {
        expect(game.movePiece(pos, { u: 1, v: 0 })).toBe("ErrNoPieceFound");
    });

    it("rejects if destination is the same as origin", () => {
        game.spawnPiece(pos.u, pos.v, { color: "Black", type: "Beetle" });
        expect(game.movePiece(pos, pos)).toBe("ErrAlreadyThere");
    });

    it("rejects if destination is occupied (except for beetles)", () => {
        game.spawnPiece(0, 0, { color: "Black", type: "QueenBee" });
        game.spawnPiece(-1, 0, { color: "White", type: "QueenBee" });
        game.spawnPiece(0, 1, { color: "Black", type: "Grasshopper" });
        game.spawnPiece(-2, 0, { color: "White", type: "Beetle" });
        game.spawnPiece(1, 0, { color: "Black", type: "Beetle" });
        game.spawnPiece(-3, 0, { color: "White", type: "Beetle" });
        expect(game.movePiece({ u: 0, v: 1 }, pos)).toBe("ErrDestinationOccupied");
        expect(game.movePiece({ u: 1, v: 0 }, pos)).toBe("Success");
    });

    it("rejects if out-of-turn", () => {
        game.spawnPiece(0, 0, { color: "Black", type: "QueenBee" });
        game.spawnPiece(1, 0, { color: "White", type: "QueenBee" });
        expect(game.movePiece(pos, { u: 0, v: 1 })).toBe("Success");
        expect(game.movePiece({ u: 0, v: 1 }, pos)).toBe("ErrOutOfTurn");
    });

    it("rejects if queen is unplayed", () => {
        game.spawnPiece(0, 0, { color: "Black", type: "QueenBee" });
        game.spawnPiece(1, 0, { color: "White", type: "Beetle" });
        expect(game.movePiece(pos, { u: 0, v: 1 })).toBe("Success");
        expect(game.movePiece({ u: 1, v: 0 }, pos)).toBe("ErrQueenUnplayed");
    });

    it("rejects if one-hive rule is violated", () => {
        game.spawnPiece(0, 1, { color: "Black", type: "QueenBee" });
        game.spawnPiece(1, 0, { color: "White", type: "QueenBee" });
        expect(game.movePiece({ u: 0, v: 1 }, { u: 0, v: 2 })).toBe("ErrOneHiveRule"); // destination disconnected
        game.spawnPiece(-1, 1, { color: "Black", type: "Ant" });
        game.spawnPiece(1, -1, { color: "White", type: "Ant" });
        game.spawnPiece(-1, 0, { color: "Black", type: "Ant" });
        game.spawnPiece(2, 0, { color: "White", type: "Ant" });
        game.spawnPiece(0, 2, { color: "Black", type: "Ant" });
        expect(game.movePiece({ u: 2, v: 0 }, { u: 0, v: -1 })).toBe("Success");
        expect(game.movePiece({ u: 0, v: 2 }, { u: -2, v: 2 })).toBe("Success");
        expect(game.movePiece({ u: 0, v: -1 }, { u: -2, v: 1 })).toBe("Success");
        game.spawnPiece(0, 2, { color: "Black", type: "Grasshopper" }); // change turn
        expect(game.movePiece({ u: -2, v: 1 }, { u: -1, v: -1 })).toBe("Success");
        expect(game.movePiece({ u: -1, v: 0 }, { u: 0, v: -1 })).toBe("ErrOneHiveRule"); // disconnects "in-transit"
        expect(game.movePiece({ u: -2, v: 2 }, { u: -1, v: -2 })).toBe("Success");
        expect(game.movePiece({ u: -1, v: -1 }, { u: 2, v: 0 })).toBe("ErrOneHiveRule"); // disconnects
    });

    it("rejects if piece is queen & queen movement is violated", () => {
        game.spawnPiece(0, 1, { color: "Black", type: "QueenBee" });
        game.spawnPiece(1, 0, { color: "White", type: "QueenBee" });
        expect(game.movePiece({ u: 0, v: 1 }, { u: 1, v: -1 })).toBe("ErrViolatesQueenBeeMovement");
        expect(game.movePiece({ u: 0, v: 1 }, { u: 2, v: -1 })).toBe("ErrViolatesQueenBeeMovement");
        expect(game.movePiece({ u: 0, v: 1 }, { u: 0, v: 0 })).toBe("Success");
    });
});