const { default: HiveGame } = require("@/common/engine/game");
const { default: Notation } = require("@/common/engine/notation");

let game = null;

const forceMove = (notation) => {
    turn = Notation.stringToGenericTurn(notation);
    return game.movePiece(turn.piece, game.relToAbs(turn.destination));
};

function processTurns() { // ordinary function so 'arguments' is defined
    let result;
    for (const notation of arguments) {
        result = game.processTurn(Notation.stringToGenericTurn(notation));
    }
    return result;
}

const expectOk = (turn) =>
    expect(processTurns(turn).status).toBe("Ok");

const expectError = (turn, message) => {
    expect(processTurns(turn).status).toBe("Error");
    expect(processTurns(turn).message).toBe(message);
};

const setupStandardGame = () => processTurns(
    "bA .",
    "wG bA1-",
    "bB /bA1",
    "wL wG1-",
    "bM -bA1",
    "wP wG1\\",
    "bQ \\bA1",
    "wQ wG1/",
    "bS bB1\\",
    "wB wP-",
    "bB \\bM"
);

describe("When new piece is placed", () => {
    beforeEach(() => game = new HiveGame());

    it("rejects if game is over", () => {
        processTurns(
            "bQ .",
            "wQ bQ-",
            "bA -bQ",
            "wA wQ\\",
            "bA /bQ",
            "wA wQ/",
            "bA \\bQ",
            "wA1 /wQ",
            "bA3 \\wQ",
            "wA2 \\bQ"
        );
        expectError("bG -bA1", "ErrGameOver");
    });

    it("rejects if out-of-turn", () => {
        expectOk("bG .");
        expectError("bA bG1-", "ErrOutOfTurn");
        game = new HiveGame("White");
        expectOk("wQ .");
        expectError("wB wQ-", "ErrOutOfTurn");
    });

    it("rejects if player lacks inventory", () => {
        expectOk("bB .");
        expectOk("wG -bB1");
        expectOk("bB bB1-");
        expectOk("wQ -wG1");
        expectError("bB bB2-", "ErrOutOfPieces");
    });

    it("rejects if destination is on top of hive", () => {
        expectOk("bB .");
        expectError("wG bB1", "ErrDestinationOccupied");
    });

    it("rejects if destination is occupied", () => {
        expectOk("bB .");
        expectOk("wG -bB1");
        expectError("bG wG1-", "ErrDestinationOccupied");
    });

    it("rejects if destination does not exist", () => {
        expectOk("bB .");
        expectError("wG bB2-", "ErrInvalidDestination");
    });

    it("rejects if destination reference piece is under-specified", () => {
        expectOk("bB .");
        expectError("wG bB-", "ErrInvalidDestination");
    });

    it("rejects if destination borders opposing color", () => {
        expectOk("bB .");
        expectOk("wG bB1-");
        expectError("bG bB1\\", "ErrTouchesOppColor");
        expectOk("bG -bB1");
        expectError("wG bB1\\", "ErrTouchesOppColor");
        expectOk("wG wG1-");
    });

    it("rejects anything but queen if is unplayed by 4th placement", () => {
        expectOk("bB .");
        expectOk("wG bB1-");
        expectOk("bB -bB1");
        expectOk("wQ wG1-");
        expectOk("bS -bB2");
        expectOk("wS wQ-");
        expectError("bS -bS1", "ErrMustBeQueen");
        expectOk("bQ -bS1");
        expectOk("wS wS1-");
    });

    // TODO add test for optional tournament rule (no queen on 1st placement)
});

describe("When piece is moved", () => {
    beforeEach(() => game = new HiveGame());

    it("rejects if game is over", () => {
        game.setColorToStart("White");
        processTurns(
            "wQ .",
            "bQ wQ-",
            "wA -wQ",
            "bA bQ\\",
            "wA /wQ",
            "bA bQ/",
            "wA \\wQ",
            "bA1 /bQ",
            "wA3 \\bQ",
            "bA2 \\wQ"
        );
        expectError("wA1 bQ-", "ErrGameOver");
    });

    it("rejects if no piece is found", () => {
        game.setColorToStart("White");
        processTurns("wB .");
        expect(forceMove("bA1 wB1").message).toBe("ErrInvalidMovingPiece");
    });

    it("rejects if moving piece is under-specified", () => {
        processTurns(
            "bQ .",
            "wB bQ-",
            "bA -bQ"
        );
        expect(forceMove("wB bQ\\").message).toBe("ErrInvalidMovingPiece");
    });

    it("rejects if destination reference piece is under-specified", () => {
        processTurns(
            "bQ .",
            "wB bQ-"
        );
        expectError("bQ wB\\", "ErrInvalidDestination");
    });

    it("rejects if destination is the same as origin", () => {
        game.setColorToStart("White");
        processTurns(
            "wQ .",
            "bQ wQ-",
            "wA -wQ"
        );
        expectError("bQ wQ-", "ErrAlreadyThere");
    });

    it("rejects if destination is occupied (except for beetles)", () => {
        processTurns(
            "bQ .",
            "wQ -bQ",
            "bG bQ\\",
            "wB -wQ",
            "bB bQ-",
            "wB -wB1"
        );
        expectError("bG1 wQ-", "ErrDestinationOccupied");
        expectOk("bB1 wQ-");
    });

    it("rejects if destination is (explicitly) on top of hive (except for beetles)", () => {
        processTurns(
            "bQ .",
            "wQ -bQ",
            "bG bQ\\",
            "wB -wQ",
            "bB bQ-",
            "wB -wB1"
        );
        expectError("bG1 bQ", "ErrDestinationOccupied");
        expectOk("bB1 bQ");
    });

    it("rejects if out-of-turn without adjacent pillbug", () => {
        processTurns(
            "bQ .",
            "wQ -bQ",
            "bA bQ-",
            "wA -wQ"
        );
        expectOk("bA1 wQ\\");
        expectError("bQ bA1-", "ErrNoPillbugTouching");
    });

    it("rejects if queen is unplayed", () => {
        processTurns(
            "bQ .",
            "wB -bQ"
        );
        expectOk("bQ wB1\\");
        expectError("wB1 bQ/", "ErrQueenUnplayed");
    });

    it("rejects if one-hive rule is violated", () => {
        processTurns(
            "bQ .",
            "wQ bQ/",
            "bA -bQ",
            "wA \\wQ",
            "bA \\bA1",
            "wA wQ-",
            "bA bQ\\"
        );
        expectOk("wA2 -wA1");
        expectOk("bA3 /bA1");
        expectOk("wA2 -bA1");
        processTurns("bG bQ\\"); // change turn
        expectOk("wA2 \\bA2");
        expectError("bA2 -wA1", "ErrOneHiveRule"); // disconnects "in-transit"
        expectOk("bA3 \\wA2");
        expectError("wA2 wQ-", "ErrOneHiveRule"); // disconnects
    });

    it("correctly handles queen bee movement", () => {
        setupStandardGame();
        expectError("wQ wL-", "ErrViolatesQueenBeeMovement");
        expectError("wQ bQ/", "ErrViolatesQueenBeeMovement");
        expectOk("wQ \\wG1");
        expectError("bQ bA1\\", "ErrViolatesQueenBeeMovement");
        expectError("bQ wQ/", "ErrViolatesQueenBeeMovement");
        expectError("bQ \\bB2", "ErrViolatesQueenBeeMovement");
        expectOk("bQ bB2/");
        processTurns( // establish gate
            "wL bQ-",
            "bS1 wP\\"
        );
        expectError("wQ bQ\\", "ErrViolatesQueenBeeMovement"); // crosses gate
    });

    it("correctly handles spider movement", () => {
        setupStandardGame();
        processTurns("wQ bQ-");
        expectError("bS1 bA1\\", "ErrViolatesSpiderMovement");
        expectError("bS1 /wP", "ErrViolatesSpiderMovement");
        expectError("bS1 /bB1", "ErrViolatesSpiderMovement");
        expectError("bS1 -bB1", "ErrViolatesSpiderMovement");
        expectOk("bS1 wP\\");
        processTurns( // establish gate
            "wB1 wL",
            "bB1 /bM",
            "wB1 wQ-",
            "bA1 bB1\\",
            "wG1 \\wQ",
            "bB2 -bM",
            "wG1 /bB1",
            "bB2 -bB1",
            "wG1 bA1-"
        );
        expectError("bS1 -wL", "ErrViolatesSpiderMovement"); // crosses gate
        expectError("bS1 bA1/", "ErrViolatesSpiderMovement"); // crosses gate
        expectOk("bS1 /wG1"); // walks past gate
    });

    it("correctly handles one-hive rule with mounted pieces", () => {
        setupStandardGame();
        expectOk("wQ bQ-");
        expectOk("bM wQ-");
        expectOk("wB1 /wP");
        expectOk("bB2 bQ");
        expectOk("wB1 bS1");
    });

    // TODO add more specific bug movement checks
    // TODO add pillbug immobilization checks; test that it only applies on the very next turn, even if pillbug-user subsequently
    // places or passes instead of moving
    // TODO test for other PillbugMovementErrorMsg outcomes
    // TODO test how pillbug interacts with unplayed queen

    // TODO can mosquito steal movement of beetle from adjacent mounted mosquito?
    // Seems no: https://boardgamegeek.com/thread/1857720/mosquito-next-mosquito-top-hive
    // We are therefore already handling mosquito-on-moquito action correctly.

    // TODO test that special moves of adjacent pillbug + mosquito combine
});

// TODO test that pass is rejected while other moves are available

// TODO add the most obvious checks of all: when getting legal movements / placements, all returned options must be legal!

describe("When the game is over", () => {
    beforeEach(() => game = new HiveGame());

    it("detects a draw", () => {
        expect(game.checkGameStatus()).toBe("Ongoing");
        processTurns(
            "bQ .",
            "wQ bQ-",
            "bG -bQ",
            "wG wQ\\",
            "bG /bQ",
            "wG wQ/",
            "bG \\bQ",
            "wG wQ-",
            "bA -bG1",
            "wA wG3-",
            "bA1 /wQ"
        );
        expect(game.checkGameStatus()).toBe("Ongoing");
        processTurns("wA1 \\wQ");
        expect(game.checkGameStatus()).toBe("Draw");
    });

    it("detects a white victory", () => {
        expect(game.checkGameStatus()).toBe("Ongoing");
        processTurns(
            "bQ .",
            "wQ bQ-",
            "bA -bQ",
            "wA wQ\\",
            "bA /bQ",
            "wA wQ/",
            "bA \\bQ",
            "wA1 /wQ",
            "bA3 \\wQ"
        );
        expect(game.checkGameStatus()).toBe("Ongoing");
        processTurns("wA2 \\bQ");
        expect(game.checkGameStatus()).toBe("WhiteWin");
    });

    it("detects a black victory", () => {
        expect(game.checkGameStatus()).toBe("Ongoing");
        game.setColorToStart("White");
        processTurns(
            "wQ .",
            "bQ wQ-",
            "wA -wQ",
            "bA bQ\\",
            "wA /wQ",
            "bA bQ/",
            "wA \\wQ",
            "bA1 /bQ",
            "wA3 \\bQ"
        );
        expect(game.checkGameStatus()).toBe("Ongoing");
        processTurns("bA2 \\wQ");
        expect(game.checkGameStatus()).toBe("BlackWin");
    });
});