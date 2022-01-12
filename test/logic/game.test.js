const { default: HiveGame } = require("@/logic/game");

let game = null;

const b = "Black";
const w = "White";
const p = (c, t, i) => ({ color: c, type: t, index: i });

const place = (piece, direction, ref) =>
    game.placePiece(piece, ref ? { referencePiece: ref, direction } : "Anywhere");

const move = (piece, direction, referencePiece) => game.movePiece(piece, { referencePiece, direction });

describe("When new piece is placed", () => {
    beforeEach(() => game = new HiveGame());

    it("rejects if game is over", () => {
        place(p(b, "QueenBee"));
        place(p(w, "QueenBee"), "o-", p(b, "QueenBee", 1));
        place(p(b, "Ant"), "-o", p(b, "QueenBee", 1));
        place(p(w, "Ant"), "o\\", p(w, "QueenBee", 1));
        place(p(b, "Ant"), "/o", p(b, "QueenBee", 1));
        place(p(w, "Ant"), "o/", p(w, "QueenBee", 1));
        place(p(b, "Ant"), "\\o", p(b, "QueenBee", 1));
        move(p(w, "Ant", 1), "/o", p(w, "QueenBee", 1));
        move(p(b, "Ant", 3), "\\o", p(w, "QueenBee", 1));
        move(p(w, "Ant", 2), "\\o", p(b, "QueenBee", 1));
        expect(place(p(b, "Grasshopper"), "-o", p(b, "Ant", 1)).message).toBe("ErrGameOver");
    });

    it("rejects if out-of-turn", () => {
        expect(place(p(b, "Grasshopper")).status).toBe("Success");
        expect(place(p(b, "Ant"), "o-", p(b, "Grasshopper", 1)).message).toBe("ErrOutOfTurn");
        game = new HiveGame();
        expect(place(p(w, "QueenBee")).status).toBe("Success");
        expect(place(p(w, "Beetle"), "o-", p(w, "QueenBee", 1)).message).toBe("ErrOutOfTurn");
    });

    it("rejects if player lacks inventory", () => {
        expect(place(p(b, "Beetle")).status).toBe("Success");
        expect(place(p(w, "Grasshopper"), "-o", p(b, "Beetle", 1)).status).toBe("Success");
        expect(place(p(b, "Beetle"), "o-", p(b, "Beetle", 1)).status).toBe("Success");
        expect(place(p(w, "QueenBee"), "-o", p(w, "Grasshopper", 1)).status).toBe("Success");
        expect(place(p(b, "Beetle"), "o-", p(b, "Beetle", 2)).message).toBe("ErrOutOfPieces");
    });

    it("rejects if destination is on top of hive", () => {
        expect(place(p(b, "Beetle")).status).toBe("Success");
        expect(place(p(w, "Grasshopper"), "Above", p(b, "Beetle", 1)).message).toBe("ErrDestinationOccupied");
    });

    it("rejects if destination is occupied", () => {
        expect(place(p(b, "Beetle")).status).toBe("Success");
        expect(place(p(w, "Grasshopper"), "-o", p(b, "Beetle", 1)).status).toBe("Success");
        expect(place(p(b, "Grasshopper"), "o-", p(w, "Grasshopper", 1)).message).toBe("ErrDestinationOccupied");
    });

    it("rejects if destination is does not exist", () => {
        expect(place(p(b, "Beetle")).status).toBe("Success");
        expect(place(p(w, "Grasshopper"), "o-", p(b, "Beetle", 2)).message).toBe("ErrInvalidDestination");
    });

    it("rejects if destination reference piece is under-specified", () => {
        expect(place(p(b, "Beetle")).status).toBe("Success");
        expect(place(p(w, "Grasshopper"), "o-", p(b, "Beetle")).message).toBe("ErrInvalidDestination");
    });

    it("rejects if destination borders opposing color", () => {
        expect(place(p(b, "Beetle")).status).toBe("Success");
        expect(place(p(w, "Grasshopper"), "o-", p(b, "Beetle", 1)).status).toBe("Success");
        expect(place(p(b, "Grasshopper"), "o\\", p(b, "Beetle", 1)).message).toBe("ErrTouchesOppColor");
        expect(place(p(b, "Grasshopper"), "-o", p(b, "Beetle", 1)).status).toBe("Success");
        expect(place(p(w, "Grasshopper"), "o\\", p(b, "Beetle", 1)).message).toBe("ErrTouchesOppColor");
        expect(place(p(w, "Grasshopper"), "o-", p(w, "Grasshopper", 1)).status).toBe("Success");
    });

    it("rejects anything but queen if is unplayed by 4th placement", () => {
        expect(place(p(b, "Beetle")).status).toBe("Success");
        expect(place(p(w, "Grasshopper"), "o-", p(b, "Beetle", 1)).status).toBe("Success");
        expect(place(p(b, "Beetle"), "-o", p(b, "Beetle", 1)).status).toBe("Success");
        expect(place(p(w, "QueenBee"),"o-", p(w, "Grasshopper", 1)).status).toBe("Success");
        expect(place(p(b, "Spider"), "-o", p(b, "Beetle", 2)).status).toBe("Success");
        expect(place(p(w, "Spider"), "o-", p(w, "QueenBee", 1)).status).toBe("Success");
        expect(place(p(b, "Spider"), "-o", p(b, "Spider", 1)).message).toBe("ErrMustBeQueen");
        expect(place(p(b, "QueenBee"), "-o", p(b, "Spider", 1)).status).toBe("Success");
        expect(place(p(w, "Spider"), "o-", p(w, "Spider", 1)).status).toBe("Success");
    });
});

describe("When piece is moved", () => {
    beforeEach(() => game = new HiveGame());

    it("rejects if game is over", () => {
        place(p(w, "QueenBee"));
        place(p(b, "QueenBee"), "o-", p(w, "QueenBee", 1));
        place(p(w, "Ant"), "-o", p(w, "QueenBee", 1));
        place(p(b, "Ant"), "o\\", p(b, "QueenBee", 1));
        place(p(w, "Ant"), "/o", p(w, "QueenBee", 1));
        place(p(b, "Ant"), "o/", p(b, "QueenBee", 1));
        place(p(w, "Ant"), "\\o", p(w, "QueenBee", 1));
        move(p(b, "Ant", 1), "/o", p(b, "QueenBee", 1));
        move(p(w, "Ant", 3), "\\o", p(b, "QueenBee", 1));
        move(p(b, "Ant", 2), "\\o", p(w, "QueenBee", 1));
        expect(move(p(w, "Ant", 1), "o-", p(b, "QueenBee", 1)).message).toBe("ErrGameOver");
    });

    it("rejects if no piece is found", () => {
        place(p(w, "Beetle"));
        expect(move(p(b, "Ant", 1), "o-", p(w, "Beetle", 1)).message).toBe("ErrInvalidMovingPiece");
    });

    it("rejects if moving piece is under-specified", () => {
        place(p(b, "QueenBee"));
        place(p(w, "Beetle"), "o-", p(b, "Beetle", 1));
        expect(move(p(b, "QueenBee"), "o\\", p(w, "Beetle")).message).toBe("ErrInvalidMovingPiece");
    });

    it("rejects if destination reference piece is under-specified", () => {
        place(p(b, "QueenBee"));
        place(p(w, "Beetle"), "o-", p(b, "Beetle", 1));
        expect(move(p(b, "QueenBee", 1), "o\\", p(w, "Beetle")).message).toBe("ErrInvalidDestination");
    });

    it("rejects if destination is the same as origin", () => {
        place(p(w, "QueenBee"));
        place(p(b, "QueenBee"), "o-", p(w, "QueenBee", 1));
        expect(move(p(b, "QueenBee", 1), "o-", p(w, "QueenBee", 1)).message).toBe("ErrAlreadyThere");
    });

    it("rejects if destination is occupied (except for beetles)", () => {
        place(p(b, "QueenBee"));
        place(p(w, "QueenBee"), "-o", p(b, "QueenBee", 1));
        place(p(b, "Grasshopper"), "o\\", p(b, "QueenBee", 1));
        place(p(w, "Beetle"), "-o", p(w, "QueenBee", 1));
        place(p(b, "Beetle"), "o-", p(b, "QueenBee", 1));
        place(p(w, "Beetle"), "-o", p(w, "Beetle", 1));
        expect(move(p(b, "Grasshopper", 1), "o-", p(w, "QueenBee", 1)).message).toBe("ErrDestinationOccupied");
        expect(move(p(b, "Beetle", 1), "o-", p(w, "QueenBee", 1)).status).toBe("Success");
    });

    it("rejects if destination is (explicitly) on top of hive (except for beetles)", () => {
        place(p(b, "QueenBee"));
        place(p(w, "QueenBee"), "-o", p(b, "QueenBee", 1));
        place(p(b, "Grasshopper"), "o\\", p(b, "QueenBee", 1));
        place(p(w, "Beetle"), "-o", p(w, "QueenBee", 1));
        place(p(b, "Beetle"), "o-", p(b, "QueenBee", 1));
        place(p(w, "Beetle"), "-o", p(w, "Beetle", 1));
        expect(move(p(b, "Grasshopper", 1), "Above", p(b, "QueenBee", 1)).message).toBe("ErrDestinationOccupied");
        expect(move(p(b, "Beetle", 1), "Above", p(b, "QueenBee", 1)).status).toBe("Success");
    });

    it("rejects if out-of-turn", () => {
        place(p(b, "QueenBee"));
        place(p(w, "QueenBee"), "-o", p(b, "QueenBee", 1));
        expect(move(p(b, "QueenBee", 1), "o\\", p(w, "QueenBee", 1)).status).toBe("Success");
        expect(move(p(b, "QueenBee", 1), "o-", p(w, "QueenBee", 1)).message).toBe("ErrOutOfTurn");
    });

    it("rejects if queen is unplayed", () => {
        place(p(b, "QueenBee"));
        place(p(w, "Beetle"), "-o", p(b, "QueenBee", 1));
        expect(move(p(b, "QueenBee", 1), "o\\", p(w, "Beetle", 1)).status).toBe("Success");
        expect(move(p(w, "Beetle", 1), "o/", p(b, "QueenBee", 1)).message).toBe("ErrQueenUnplayed");
    });

    it("rejects if one-hive rule is violated", () => {
        place(p(b, "QueenBee"));
        place(p(w, "QueenBee"), "o/", p(b, "QueenBee", 1));
        place(p(b, "Ant"), "-o", p(b, "QueenBee", 1));
        place(p(w, "Ant"), "\\o", p(w, "QueenBee", 1));
        place(p(b, "Ant"), "\\o", p(b, "Ant", 1));
        place(p(w, "Ant"), "o-", p(w, "QueenBee", 1));
        place(p(b, "Ant"), "o\\", p(b, "QueenBee", 1));
        expect(move(p(w, "Ant", 2), "-o", p(w, "Ant", 1)).status).toBe("Success");
        expect(move(p(b, "Ant", 3), "/o", p(b, "Ant", 1)).status).toBe("Success");
        expect(move(p(w, "Ant", 2), "-o", p(b, "Ant", 1)).status).toBe("Success");
        place(p(b, "Grasshopper"), "o\\", p(b, "QueenBee", 1)); // change turn
        expect(move(p(w, "Ant", 2), "\\o", p(b, "Ant", 2)).status).toBe("Success");
        expect(move(p(b, "Ant", 2), "-o", p(w, "Ant", 1)).message).toBe("ErrOneHiveRule"); // disconnects "in-transit"
        expect(move(p(b, "Ant", 3), "\\o", p(w, "Ant", 2)).status).toBe("Success");
        expect(move(p(w, "Ant", 2), "o-", p(w, "QueenBee", 1)).message).toBe("ErrOneHiveRule"); // disconnects
    });

    it("rejects if queen movement is violated", () => {
        place(p(b, "QueenBee"));
        place(p(w, "QueenBee"), "-o", p(b, "QueenBee", 1));
        expect(move(p(b, "QueenBee", 1), "-o", p(w, "QueenBee", 1)).message).toBe("ErrViolatesQueenBeeMovement");
        expect(move(p(b, "QueenBee", 1), "\\o", p(w, "QueenBee", 1)).message).toBe("ErrViolatesQueenBeeMovement");
        expect(move(p(b, "QueenBee", 1), "o/", p(w, "QueenBee", 1)).status).toBe("Success");
    });
});

describe("When the game is over", () => {
    beforeEach(() => game = new HiveGame());

    it("detects a draw", () => {
        expect(game.checkGameStatus()).toBe("Ongoing");
        place(p(b, "QueenBee"));
        place(p(w, "QueenBee"), "o-", p(b, "QueenBee", 1));
        place(p(b, "Grasshopper"), "-o", p(b, "QueenBee", 1));
        place(p(w, "Grasshopper"), "o\\", p(w, "QueenBee", 1));
        place(p(b, "Grasshopper"), "/o", p(b, "QueenBee", 1));
        place(p(w, "Grasshopper"), "o/", p(w, "QueenBee", 1));
        place(p(b, "Grasshopper"), "\\o", p(b, "QueenBee", 1));
        place(p(w, "Grasshopper"), "o-", p(w, "QueenBee", 1));
        place(p(b, "Ant"), "-o", p(b, "Grasshopper", 1));
        place(p(w, "Ant"), "o-", p(w, "Grasshopper", 3));
        move(p(b, "Ant", 1), "/o", p(w, "QueenBee", 1));
        expect(game.checkGameStatus()).toBe("Ongoing");
        move(p(w, "Ant", 1), "\\o", p(w, "QueenBee", 1));
        expect(game.checkGameStatus()).toBe("Draw");
    });

    it("detects a white victory", () => {
        expect(game.checkGameStatus()).toBe("Ongoing");
        place(p(b, "QueenBee"));
        place(p(w, "QueenBee"), "o-", p(b, "QueenBee", 1));
        place(p(b, "Ant"), "-o", p(b, "QueenBee", 1));
        place(p(w, "Ant"), "o\\", p(w, "QueenBee", 1));
        place(p(b, "Ant"), "/o", p(b, "QueenBee", 1));
        place(p(w, "Ant"), "o/", p(w, "QueenBee", 1));
        place(p(b, "Ant"), "\\o", p(b, "QueenBee", 1));
        move(p(w, "Ant", 1), "/o", p(w, "QueenBee", 1));
        move(p(b, "Ant", 3), "\\o", p(w, "QueenBee", 1));
        expect(game.checkGameStatus()).toBe("Ongoing");
        move(p(w, "Ant", 2), "\\o", p(b, "QueenBee", 1));
        expect(game.checkGameStatus()).toBe("WhiteWin");
    });

    it("detects a black victory", () => {
        expect(game.checkGameStatus()).toBe("Ongoing");
        place(p(w, "QueenBee"));
        place(p(b, "QueenBee"), "o-", p(w, "QueenBee", 1));
        place(p(w, "Ant"), "-o", p(w, "QueenBee", 1));
        place(p(b, "Ant"), "o\\", p(b, "QueenBee", 1));
        place(p(w, "Ant"), "/o", p(w, "QueenBee", 1));
        place(p(b, "Ant"), "o/", p(b, "QueenBee", 1));
        place(p(w, "Ant"), "\\o", p(w, "QueenBee", 1));
        move(p(b, "Ant", 1), "/o", p(b, "QueenBee", 1));
        move(p(w, "Ant", 3), "\\o", p(b, "QueenBee", 1));
        expect(game.checkGameStatus()).toBe("Ongoing");
        move(p(b, "Ant", 2), "\\o", p(w, "QueenBee", 1));
        expect(game.checkGameStatus()).toBe("BlackWin");
    });
});