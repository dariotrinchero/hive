import { Bugs, Colors, pieceInventory } from "@/common/engine/piece";

import type HexGrid from "@/common/engine/hexGrid";

import type { Piece, PieceColor, PieceType } from "@/types/common/engine/piece";
import type { GenericTurnAttempt, SpecificTurnAttempt } from "@/types/common/engine/outcomes";
import type { Direction } from "@/types/common/engine/hexGrid";

export type ParseError = "ParseError";

export default class Notation {

    /**
     * Convert a piece character into the corresponding piece type;
     * eg. "B" -> Beetle, "G" -> Grasshopper, etc
     * 
     * @param char single character representing a piece type
     * @returns piece type corresponding to given character
     */
    private static charToPieceType(char: string): PieceType | ParseError {
        const bugs: string[] = Object.keys(Bugs);
        const type = bugs.slice(-bugs.length / 2) // first 1/2 of keys are indices
            .find(bug => bug.charAt(0) === char);
        if (!type) return "ParseError";
        return type as PieceType;
    }

    /**
     * Convert a color character into the correpsonding piece color;
     * eg. "w" -> White, "b" -> "Black"
     * 
     * @param char single character representing a piece color
     * @returns piece color corresponding to given character
     */
    private static charToPieceColor(char: string): PieceColor | ParseError {
        const colors: string[] = Object.keys(Colors);
        const color = colors.slice(-colors.length / 2) // first 1/2 of keys are indices
            .find(c => c.charAt(0).toLowerCase() === char);
        if (!color) return "ParseError";
        return color as PieceColor;
    }

    /**
     * Convert string representing a piece into the corresponding piece object;
     * eg. "wG2" -> { type: "Grasshopper", color: "White", index: 2 }
     * 
     * @param notation 2- or 3-character string representing a piece
     * @returns piece object corresponding to given string
     */
    public static stringToPiece(notation: string): Piece | ParseError {
        if (notation.length < 2) return "ParseError";

        const color = Notation.charToPieceColor(notation.charAt(0));
        if (color === "ParseError") return "ParseError";
        const type = Notation.charToPieceType(notation.charAt(1));
        if (type === "ParseError") return "ParseError";

        if (notation.length >= 3) {
            const index = parseInt(notation.slice(2), 10);
            if (isNaN(index) || pieceInventory[type] < index) return "ParseError";
            return { color, index, type };
        }

        return { color, type };
    }

    /**
     * Get the notational representation of given piece.
     * 
     * @param piece a piece object
     * @returns notation string representing given piece
     */
    public static pieceToString(piece: Piece): string {
        const prefix = `${piece.color.charAt(0).toLowerCase()}${piece.type.charAt(0)}`;
        if (piece.index && pieceInventory[piece.type] !== 1) return `${prefix}${piece.index}`;
        return prefix;
    }

    /**
     * Convert given notation string representing a turn into corresponding turn attempt object;
     * eg. "wP bA1-" -> {
     *          piece: [white pillbug],
     *          destination: { referencePiece: [black ant 1], direction: "o-" }
     *      }
     * 
     * @param notation "pass" or 2-word string encoding moving piece & location (relative to reference piece)
     * @returns turn attempt object corresponding to given turn notation
     */
    public static stringToGenericTurn(notation: string): GenericTurnAttempt | ParseError {
        // special pass move
        if (notation.toLowerCase() === "pass") return { turnType: "Pass" };

        // get moving piece
        const split: string[] = notation.split(" ");
        if (split.length !== 2) return "ParseError";
        const movingPiece: Piece | ParseError = Notation.stringToPiece(split[0]);
        if (movingPiece === "ParseError") return "ParseError";

        // special notation for first move
        if (split[1] === ".") return {
            destination: "Anywhere",
            piece: movingPiece
        };

        const matches = split[1].match(/^([/\\-])?(\w+)([/\\-])?$/i);
        if (!matches || matches[1] && matches[3]) return "ParseError";

        // get reference piece
        const referencePiece: Piece | ParseError = Notation.stringToPiece(matches[2]);
        if (referencePiece === "ParseError") return "ParseError";

        // get direction
        let direction: Direction;
        if (!matches[1] && !matches[3]) direction = "Above";
        else direction = `${matches[1] || ""}o${matches[3] || ""}` as Direction;

        return {
            destination: { direction, referencePiece },
            piece: movingPiece
        };
    }

    /**
     * Get the notational representation of given generic (ie. using relative coordinates)
     * turn attempt.
     * 
     * @param turn a generic turn attempt object
     * @returns notation string representing given turn
     */
    public static genericTurnToString(turn: GenericTurnAttempt): string {
        if ("turnType" in turn) return "pass";
        let destination = ".";
        if (turn.destination !== "Anywhere") {
            destination = Notation.pieceToString(turn.destination.referencePiece);
            if (turn.destination.direction !== "Above") {
                destination = turn.destination.direction.replace("o", destination);
            }
        }
        return `${Notation.pieceToString(turn.piece)} ${destination}`;
    }

    /**
     * Get the notational representation of given specific (ie. using absolute lattice
     * coordinates) turn attempt; an instance of HexGrid is needed to convert lattice coordinates
     * to relative coordinates used by notation.
     * 
     * @param turn a specific turn attempt object
     * @param grid instance of HexGrid used to convert to relative coordinates
     * @returns notation string representing given turn
     */
    public static specificTurnToString(turn: SpecificTurnAttempt, grid: HexGrid): string {
        if (turn.turnType === "Pass") return "pass";
        const destination = grid.absToRel(turn.destination);
        return this.genericTurnToString({ ...turn, destination });
    }
}