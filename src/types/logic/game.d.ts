import { LatticeCoords, Piece, PieceColor, PieceType } from "@/types/common/piece";

export type IntCoord = number;

export type PieceSpace = Piece | null;

export type Inventory = Record<PieceType, number>;
export type PlayerInventories = Record<PieceColor, Inventory>;

export type PlacementCount = Record<PieceColor, number>;

export type PiecePositions = Record<PieceType, LatticeCoords | null>;
export type PlayerPiecePositions = Record<PieceColor, PiecePositions>;

export type QueenPos = {
    [color in PieceColor]: LatticeCoords | null;
}