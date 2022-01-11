import { PlanarDirection } from "@/logic/notation";

export type ParseError = "ParseError";

export type Direction = keyof typeof PlanarDirection | "Above";

export type Move = "Pass" | {
    movingPiece: Piece;
    referencePiece?: Piece;
    direction?: Direction;
};