import { Direction, TurnRequest } from "@/types/common/turn";
import HiveGame, { Bugs, Players } from "@/logic/game";
import { Piece, PieceColor, PieceType } from "@/types/common/piece";

export type ParseError = "ParseError";

export enum PlanarDirection {
    // anticlockwise around reference (represented 'o') from o-->
    "o-",
    "o/",
    "\\o",
    "-o",
    "/o",
    "o\\"
}

export default class Notation {
    private static charToPieceType(char: string): PieceType | ParseError {
        const bugs: string[] = Object.keys(Bugs);
        const type = bugs.slice(-bugs.length / 2) // first 1/2 of keys are indices
            .find(bug => bug.charAt(0) === char);
        if (!type) return "ParseError";
        return type as PieceType;
    }

    private static charToPieceColor(char: string): PieceColor | ParseError {
        const colors: string[] = Object.keys(Players);
        const color = colors.slice(-colors.length / 2) // first 1/2 of keys are indices
            .find(c => c.charAt(0).toLowerCase() === char);
        if (!color) return "ParseError";
        return color as PieceColor;
    }

    public static stringToPiece(notation: string): Piece | ParseError {
        if (notation.length < 2) return "ParseError";

        const color = Notation.charToPieceColor(notation.charAt(0));
        if (color === "ParseError") return "ParseError";
        const type = Notation.charToPieceType(notation.charAt(1));
        if (type === "ParseError") return "ParseError";

        let index = 0;
        if (notation.length >= 3) {
            index = parseInt(notation.slice(2));
            if (isNaN(index) || HiveGame.startingInventory[type] < index) return "ParseError";
            return { color, index, type };
        }

        return { color, type };
    }

    public static pieceToString(piece: Piece): string {
        const prefix = `${piece.color.charAt(0).toLowerCase()}${piece.type.charAt(0)}`;
        if (piece.index && HiveGame.startingInventory[piece.type] !== 1) return `${prefix}${piece.index}`;
        return prefix;
    }

    public static stringToMove(notation: string): TurnRequest | ParseError {
        // special pass move
        if (notation.toLowerCase() === "pass") return "Pass";

        // get moving piece
        const split: string[] = notation.split(" ");
        if (split.length > 2) return "ParseError";
        const movingPiece: Piece | ParseError = Notation.stringToPiece(split[0]);
        if (movingPiece === "ParseError") return "ParseError";

        // special notation for first move
        if (split[1] === ".") return { destination: "Anywhere", movingPiece };

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
            movingPiece
        };
    }

    public static moveToString(move: TurnRequest): string {
        if (move === "Pass") return "pass";
        let destination = ".";
        if (move.destination !== "Anywhere") {
            destination = Notation.pieceToString(move.destination.referencePiece);
            if (move.destination.direction !== "Above") {
                destination = move.destination.direction.replace("o", destination);
            }
        }
        return `${Notation.pieceToString(move.movingPiece)} ${destination}`;
    }
}