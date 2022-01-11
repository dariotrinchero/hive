import { Piece, PieceColor, PieceType } from "@/types/common/piece";
import HiveGame, { Bugs, Players } from "@/logic/game";
import { Direction, Move, ParseError } from "@/types/logic/notation";

export enum PlanarDirection {
    // anticlockwise around reference (represented 'o') from o-->
    "o-",
    "o/",
    "\\o",
    "-o",
    "/o",
    "o\\"
};

export default class Notation {
    private static charToPieceType(char: string): PieceType | ParseError {
        const bugs: string[] = Object.keys(Bugs);
        const type: PieceType = bugs.slice(-bugs.length / 2) // first 1/2 of keys are indices
            .find(bug => bug.charAt(0) === char) as keyof typeof Bugs;
        if (!type) return "ParseError";
        return type;
    }

    private static charToPieceColor(char: string): PieceColor | ParseError {
        const colors: string[] = Object.keys(Players);
        const color: PieceColor = colors.slice(-colors.length / 2) // first 1/2 of keys are indices
            .find(c => c.charAt(0).toLowerCase() === char) as keyof typeof Players;
        if (!color) return "ParseError";
        return color;
    }

    public static stringToPiece(notation: string): Piece | ParseError {
        if (notation.length < 2) return "ParseError";

        const color = Notation.charToPieceColor(notation.charAt(0));
        if (color === "ParseError") return "ParseError";
        const type = Notation.charToPieceType(notation.charAt(1));
        if (type === "ParseError") return "ParseError";

        let index: number = 0;
        if (notation.length >= 3) {
            index = parseInt(notation.slice(2));
            if (isNaN(index) || HiveGame.startingInventory[type] < index) return "ParseError";
            return { type, color, index };
        }

        return { type, color };
    }

    public static pieceToString(piece: Piece): string {
        const prefix: string = `${piece.color.charAt(0).toLowerCase()}${piece.type.charAt(0)}`;
        if (piece.index && HiveGame.startingInventory[piece.type] !== 1) return `${prefix}${piece.index}`;
        return prefix;
    }

    public static stringToMove(notation: string): Move | ParseError {
        // TODO support special notation for first move and "pass"
        const split: string[] = notation.split(" ");
        if (split.length > 2) return "ParseError";

        const movingPiece: Piece | ParseError = Notation.stringToPiece(split[0]);
        if (movingPiece === "ParseError") return "ParseError";

        const matches = split[1].match(/^([/\\-])?(\w+)([/\\-])?$/i);
        if (!matches || matches[1] && matches[3]) return "ParseError";

        const referencePiece: Piece | ParseError = Notation.stringToPiece(matches[2]);
        if (referencePiece === "ParseError") return "ParseError";

        let direction: Direction;
        if (!matches[1] && !matches[3]) direction = "Above";
        else direction = `${matches[1] || ""}o${matches[3] || ""}` as Direction;

        return { movingPiece, referencePiece, direction };
    }
}