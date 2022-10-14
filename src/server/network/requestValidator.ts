import type { RequestHandler } from "express";

import type { NewGameRequest } from "@/types/server/gameServer";
import type { ColorAssignmentRule, StartingColor } from "@/types/server/gameManager";
import type { OptionalGameRules } from "@/types/common/engine/game";

type UUIDv4 = string;

/**
 * Utility class containing static methods to perform runtime type validation of various object
 * types that are to be (de)serialized for network transmission. These type guards are used to
 * implement Express request handler middleware to validate the server-side payloads of our API
 * requests.
 * 
 * @see {@link https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates}
 */
export default class RequestValidator {
    // TODO should we add tests that objects do not contain additional unexpected keys?

    /**
     * Get request handler that checks whether request body (assumed to be exist) is a valid
     * instance of {@link NewGameRequest} - that is, a valid payload for the API POST request
     * that creates a new game.
     * 
     * @param req request to validate
     * @param res corresponding response
     * @param next function to continue to next Express middleware
     * @returns Express request handler that validates payload of new game POST requests
     */
    public static newGameValidator: RequestHandler = (req, res, next) => {
        if (this.isNewGameRequest(req.body)) return next();
        res.status(400).send("Ill-formed new-game request.");
    };

    /**
     * Test whether unknown type is an object containing exactly given keys (and no others).
     * 
     * @param obj unknown variable to test
     * @param keys exhaustive list of keys given object should contain
     * @returns whether given variable is an object with exactly given keys
     */
    private static hasKeys<T extends readonly string[]>(obj: unknown, ...keys: T):
        obj is Record<T[number], unknown> {
        if (typeof obj !== "object" || obj === null) return false;
        for (const field of keys) {
            if (!(field in obj)) return false;
        }
        return Object.keys(obj).length === keys.length;
    }

    /**
     * Test whether unknown type is a valid UUIDv4 string.
     * 
     * @param str unknown variable to test
     * @returns whether given variable is a valid UUIDv4 string
     */
    private static isUUIDv4(str: unknown): str is UUIDv4 {
        return typeof str === "string"
            && str.length === 36
            && /^[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}$/i.test(str);
    }

    /**
     * Test whether unknown type is valid instance of {@link StartingColor}.
     * 
     * @param col unknown variable to test
     * @returns whether given vairable is valid instance of {@link StartingColor}
     */
    private static isStartingColor(col: unknown): col is StartingColor {
        return col === "White" || col === "Black" || col === "Random";
    }

    /**
     * Test whether unknown type is valid instance of {@link ColorAssignmentRule}.
     * 
     * @param rule unknown variable to test
     * @returns whether given vairable is valid instance of {@link ColorAssignmentRule}
     */
    private static isColorAssignmentRule(rule: unknown): rule is ColorAssignmentRule {
        if (this.hasKeys(rule, "sessionId", "color")) {
            const { color, sessionId } = rule;
            return (color === "White" || color === "Black") && this.isUUIDv4(sessionId);
        }
        return rule === "FirstJoinIsWhite" || rule === "FirstJoinIsBlack" || rule === "Random";
    }

    /**
     * Test whether unknown type is valid instance of {@link OptionalGameRules}.
     * 
     * @param rules unknown variable to test
     * @returns whether given vairable is valid instance of {@link OptionalGameRules}
     */
    private static isOptionalGameRules(rules: unknown): rules is OptionalGameRules {
        if (!this.hasKeys(rules, "noFirstQueen", "expansions")) return false;
        const { expansions, noFirstQueen } = rules;
        if (typeof noFirstQueen !== "boolean") return false;

        if (!this.hasKeys(expansions, "Ladybug", "Mosquito", "Pillbug")) return false;
        const { Ladybug, Mosquito, Pillbug } = expansions;
        return typeof Ladybug === "boolean"
            && typeof Mosquito === "boolean"
            && typeof Pillbug === "boolean";
    }

    /**
     * Test whether unknown type is valid instance of {@link NewGameRequest}.
     * 
     * @param body unknown variable to test
     * @returns whether given vairable is valid instance of {@link NewGameRequest}
     */
    private static isNewGameRequest(body: unknown): body is NewGameRequest {
        if (this.hasKeys(body, "colorAssignmentRule", "gameRules", "startingColor")) {
            const { colorAssignmentRule, gameRules, startingColor } = body;
            return this.isStartingColor(startingColor)
                && this.isColorAssignmentRule(colorAssignmentRule)
                && (typeof gameRules === "undefined" || this.isOptionalGameRules(gameRules));
        } else if (this.hasKeys(body, "colorAssignmentRule", "startingColor")) {
            const { colorAssignmentRule, startingColor } = body;
            return this.isStartingColor(startingColor)
                && this.isColorAssignmentRule(colorAssignmentRule);
        }
        return false;
    }
}