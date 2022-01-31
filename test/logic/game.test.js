const { default: HiveGame } = require("@/common/game/game");
const { default: Notation } = require("@/client/ui/notation");

let game = null;

const forceMove = (notation) => {
    turn = Notation.stringToTurnRequest(notation);
    return game.movePiece(turn.piece, game.relToAbs(turn.destination));
};

function processTurns() {
    let result;
    for (const notation of arguments) {
        result = game.processTurn(Notation.stringToTurnRequest(notation));
    }
    return result;
}

const expectSuccess = (turn) =>
    expect(processTurns(turn).status).toBe("Success");

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
        expectSuccess("bG .");
        expectError("bA bG1-", "ErrOutOfTurn");
        game = new HiveGame();
        expectSuccess("wQ .");
        expectError("wB wQ-", "ErrOutOfTurn");
    });

    it("rejects if player lacks inventory", () => {
        expectSuccess("bB .");
        expectSuccess("wG -bB1");
        expectSuccess("bB bB1-");
        expectSuccess("wQ -wG1");
        expectError("bB bB2-", "ErrOutOfPieces");
    });

    it("rejects if destination is on top of hive", () => {
        expectSuccess("bB .");
        expectError("wG bB1", "ErrDestinationOccupied");
    });

    it("rejects if destination is occupied", () => {
        expectSuccess("bB .");
        expectSuccess("wG -bB1");
        expectError("bG wG1-", "ErrDestinationOccupied");
    });

    it("rejects if destination does not exist", () => {
        expectSuccess("bB .");
        expectError("wG bB2-", "ErrInvalidDestination");
    });

    it("rejects if destination reference piece is under-specified", () => {
        expectSuccess("bB .");
        expectError("wG bB-", "ErrInvalidDestination");
    });

    it("rejects if destination borders opposing color", () => {
        expectSuccess("bB .");
        expectSuccess("wG bB1-");
        expectError("bG bB1\\", "ErrTouchesOppColor");
        expectSuccess("bG -bB1");
        expectError("wG bB1\\", "ErrTouchesOppColor");
        expectSuccess("wG wG1-");
    });

    it("rejects anything but queen if is unplayed by 4th placement", () => {
        expectSuccess("bB .");
        expectSuccess("wG bB1-");
        expectSuccess("bB -bB1");
        expectSuccess("wQ wG1-");
        expectSuccess("bS -bB2");
        expectSuccess("wS wQ-");
        expectError("bS -bS1", "ErrMustBeQueen");
        expectSuccess("bQ -bS1");
        expectSuccess("wS wS1-");
    });
});

describe("When piece is moved", () => {
    beforeEach(() => game = new HiveGame());

    it("rejects if game is over", () => {
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
        expect(forceMove("bQ wB\\").message).toBe("ErrInvalidDestination");
    });

    it("rejects if destination is the same as origin", () => {
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
        expectSuccess("bB1 wQ-");
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
        expectSuccess("bB1 bQ");
    });

    it("rejects if out-of-turn", () => {
        processTurns(
            "bQ .",
            "wQ -bQ",
            "bA bQ-",
            "wA -wQ"
        );
        expectSuccess("bA1 wQ\\");
        expectError("bQ bA1-", "ErrOutOfTurn");
    });

    it("rejects if queen is unplayed", () => {
        processTurns(
            "bQ .",
            "wB -bQ"
        );
        expectSuccess("bQ wB1\\");
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
        expectSuccess("wA2 -wA1");
        expectSuccess("bA3 /bA1");
        expectSuccess("wA2 -bA1");
        processTurns("bG bQ\\"); // change turn
        expectSuccess("wA2 \\bA2");
        expectError("bA2 -wA1", "ErrOneHiveRule"); // disconnects "in-transit"
        expectSuccess("bA3 \\wA2");
        expectError("wA2 wQ-", "ErrOneHiveRule"); // disconnects
    });

    it("correctly handles queen bee movement", () => {
        setupStandardGame();
        expectError("wQ wL-", "ErrViolatesQueenBeeMovement");
        expectError("wQ bQ/", "ErrViolatesQueenBeeMovement");
        expectSuccess("wQ \\wG1");
        expectError("bQ bA1\\", "ErrViolatesQueenBeeMovement");
        expectError("bQ wQ/", "ErrViolatesQueenBeeMovement");
        expectError("bQ \\bB2", "ErrViolatesQueenBeeMovement");
        expectSuccess("bQ bB2/");
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
        expectSuccess("bS1 wP\\");
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
        expectSuccess("bS1 /wG1"); // walks past gate
    });

    it("correctly handles one-hive rule with mounted pieces", () => {
        setupStandardGame();
        expectSuccess("wQ bQ-");
        expectSuccess("bM wQ-");
        expectSuccess("wB1 /wP");
        expectSuccess("bB2 bQ");
        expectSuccess("wB1 bS1");
    });

    // TODO add more specific bug movement checks
    // TODO add pillbug immobilization checks; test that it only applies on the very next turn, even if pillbug-user subsequently
    // places or passes instead of moving
    // TODO test how pillbug interacts with unplayed queen
    // TODO can mosquito steal movement of beetle from adjacent mounted mosquito?
    // TODO test that special moves of adjacent pillbug + mosquito combine
});

// TODO test that pass is rejected while other moves are available

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