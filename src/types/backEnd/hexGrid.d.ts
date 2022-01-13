import { Piece, PieceColor, PieceType } from "@/types/common/piece";
import { PlanarDirection } from "@/backEnd/hexGrid";

// absolute grid positioning
export interface LatticeCoords {
    u: number;
    v: number;
}

// relative grid positioning
export type Direction = keyof typeof PlanarDirection | "Above";
export type RelativePosition = "Anywhere" | {
    referencePiece: Piece;
    direction: Direction;
};

export type PiecePositions<T extends LatticeCoords> = Record<PieceType, T[]>;
export type PlayerPiecePositions<T> = Record<PieceColor, PiecePositions<T>>;