const crypto = require("node:crypto");

const { default: RequestValidator } = require("@/server/network/requestValidator");

describe("When validating new game request", () => {
    let mockNext;
    let mockSend;
    let mockStatus;
    let mockResponse;

    const expectOutcome = (successes, failures) => {
        expect(mockNext).toBeCalledTimes(successes);
        expect(mockStatus).toBeCalledTimes(failures);
        expect(mockSend).toBeCalledTimes(failures);
        for (let n = 1; n <= failures; n++) {
            expect(mockStatus).toHaveBeenNthCalledWith(n, 400);
            expect(mockSend).toHaveBeenNthCalledWith(n, "Ill-formed new-game request.");
        }
    };

    const req = {
        colorAssignmentRule: "FirstJoinIsWhite",
        gameRules: { expansions: { Ladybug: true, Mosquito: true, Pillbug: true }, noFirstQueen: true },
        startingColor: "Black"
    };

    beforeEach(() => {
        mockNext = jest.fn();
        mockSend = jest.fn(msg => msg);
        mockStatus = jest.fn(code => ({ code, send: mockSend }));
        mockResponse = { status: mockStatus };
    });

    it("Accepts any valid starting color", () => {
        RequestValidator.newGameValidator({ body: req }, mockResponse, mockNext);
        RequestValidator.newGameValidator({ body: { ...req, startingColor: "White" } }, mockResponse, mockNext);
        RequestValidator.newGameValidator({ body: { ...req, startingColor: "Random" } }, mockResponse, mockNext);
        expectOutcome(3, 0);
    });

    it("Accepts valid string-type color assignment rules", () => {
        RequestValidator.newGameValidator({ body: req }, mockResponse, mockNext);
        RequestValidator.newGameValidator({ body: { ...req, colorAssignmentRule: "FirstJoinIsBlack" } }, mockResponse, mockNext);
        RequestValidator.newGameValidator({ body: { ...req, colorAssignmentRule: "Random" } }, mockResponse, mockNext);
        expectOutcome(3, 0);
    });

    it("Accepts valid object color assignment rule", () => {
        let colorAssignmentRule = { sessionId: crypto.randomUUID(), color: "Black" };
        RequestValidator.newGameValidator({ body: { ...req, colorAssignmentRule } }, mockResponse, mockNext);
        colorAssignmentRule = { sessionId: crypto.randomUUID(), color: "White" };
        RequestValidator.newGameValidator({ body: { ...req, colorAssignmentRule } }, mockResponse, mockNext);
        expectOutcome(2, 0);
    });

    it("Accepts missing game rules", () => {
        RequestValidator.newGameValidator({ body: { ...req, gameRules: undefined } }, mockResponse, mockNext);
        expectOutcome(1, 0);
    });

    it("Accepts valid object game rules", () => {
        RequestValidator.newGameValidator({ body: req }, mockResponse, mockNext);
        let gameRules = { expansions: { Ladybug: false, Mosquito: true, Pillbug: false }, noFirstQueen: false };
        RequestValidator.newGameValidator({ body: { ...req, gameRules } }, mockResponse, mockNext);
        expectOutcome(2, 0);
    });

    it("Rejects invalid starting color", () => {
        RequestValidator.newGameValidator({ body: { ...req, startingColor: undefined } }, mockResponse, mockNext);
        RequestValidator.newGameValidator({ body: { ...req, startingColor: null } }, mockResponse, mockNext);
        RequestValidator.newGameValidator({ body: { ...req, startingColor: "some string" } }, mockResponse, mockNext);
        RequestValidator.newGameValidator({ body: { ...req, startingColor: "black" } }, mockResponse, mockNext);
        RequestValidator.newGameValidator({ body: { ...req, startingColor: "random" } }, mockResponse, mockNext);
        expectOutcome(0, 5);
    });

    it("Rejects invalid color assignment rule", () => {
        RequestValidator.newGameValidator({ body: { ...req, colorAssignmentRule: undefined } }, mockResponse, mockNext);
        RequestValidator.newGameValidator({ body: { ...req, colorAssignmentRule: null } }, mockResponse, mockNext);
        RequestValidator.newGameValidator({ body: { ...req, colorAssignmentRule: "some string" } }, mockResponse, mockNext);
        RequestValidator.newGameValidator({ body: { ...req, colorAssignmentRule: "FirstJoinIsblack" } }, mockResponse, mockNext);
        RequestValidator.newGameValidator({ body: { ...req, colorAssignmentRule: "random" } }, mockResponse, mockNext);
        RequestValidator.newGameValidator({ body: { ...req, colorAssignmentRule: {} } }, mockResponse, mockNext);
        let colorAssignmentRule = { sessionId: crypto.randomUUID(), color: "black" };
        RequestValidator.newGameValidator({ body: { ...req, colorAssignmentRule } }, mockResponse, mockNext);
        colorAssignmentRule = { color: "White" };
        RequestValidator.newGameValidator({ body: { ...req, colorAssignmentRule } }, mockResponse, mockNext);
        colorAssignmentRule = { sessionId: crypto.randomUUID() };
        RequestValidator.newGameValidator({ body: { ...req, colorAssignmentRule } }, mockResponse, mockNext);
        colorAssignmentRule = { sessionId: null, color: "White" };
        RequestValidator.newGameValidator({ body: { ...req, colorAssignmentRule } }, mockResponse, mockNext);
        colorAssignmentRule = { sessionId: "some-string", color: "White" };
        RequestValidator.newGameValidator({ body: { ...req, colorAssignmentRule } }, mockResponse, mockNext);
        expectOutcome(0, 11);
    });

    it("Rejects invalid game rules", () => {
        let gameRules = { expansions: { Ladybug: false, Pillbug: false }, noFirstQueen: false };
        RequestValidator.newGameValidator({ body: { ...req, gameRules } }, mockResponse, mockNext);
        gameRules = { expansions: { Ladybug: false, Mosquito: true, Pillbug: null }, noFirstQueen: false };
        RequestValidator.newGameValidator({ body: { ...req, gameRules } }, mockResponse, mockNext);
        gameRules = { expansions: { Ladybug: false, Mosquito: true, Pillbug: false }, noFirstQueen: 0 };
        RequestValidator.newGameValidator({ body: { ...req, gameRules } }, mockResponse, mockNext);
        gameRules = { noFirstQueen: false };
        RequestValidator.newGameValidator({ body: { ...req, gameRules } }, mockResponse, mockNext);
        gameRules = { expansions: { Ladybug: false, Mosquito: true, Pillbug: {} }, noFirstQueen: false };
        RequestValidator.newGameValidator({ body: { ...req, gameRules } }, mockResponse, mockNext);
        gameRules = { expansions: {}, noFirstQueen: false };
        RequestValidator.newGameValidator({ body: { ...req, gameRules } }, mockResponse, mockNext);
        gameRules = { expansions: { Ladybug: false, Mosquito: true, Pillbug: false } };
        RequestValidator.newGameValidator({ body: { ...req, gameRules } }, mockResponse, mockNext);
        expectOutcome(0, 7);
    });

    it("Rejects game requests missing required fields", () => {
        let req = { colorAssignmentRule: "FirstJoinIsWhite", startingColor: "Black" };
        RequestValidator.newGameValidator({ body: req }, mockResponse, mockNext);
        expectOutcome(1, 0);
        req = {
            colorAssignmentRule: "FirstJoinIsWhite",
            gameRules: { expansions: { Ladybug: true, Mosquito: true, Pillbug: true }, noFirstQueen: true }
        };
        RequestValidator.newGameValidator({ body: req }, mockResponse, mockNext);
        req = {
            gameRules: { expansions: { Ladybug: true, Mosquito: true, Pillbug: true }, noFirstQueen: true },
            startingColor: "Black"
        };
        RequestValidator.newGameValidator({ body: req }, mockResponse, mockNext);
        expectOutcome(1, 2);
    });

    it("Rejects if any objects have additional keys", () => {
        RequestValidator.newGameValidator({ body: { ...req, donkey: "kong" } }, mockResponse, mockNext);
        let colorAssignmentRule = { sessionId: crypto.randomUUID(), toes: 2, color: "Black" };
        RequestValidator.newGameValidator({ body: { ...req, colorAssignmentRule } }, mockResponse, mockNext);
        let gameRules = { expansions: { Ladybug: false, Mosquito: true, Pillbug: false, Horse: false }, noFirstQueen: false };
        RequestValidator.newGameValidator({ body: { ...req, gameRules } }, mockResponse, mockNext);
        expectOutcome(0, 3);
    });
});