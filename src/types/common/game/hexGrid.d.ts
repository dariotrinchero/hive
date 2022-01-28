import type { Piece, PieceColor, PieceType } from "@/types/common/piece";
import { PlanarDirection } from "@/common/game/hexGrid";

// absolute grid positioning
export type LatticeCoords = [number, number];
export type PieceToPos = Record<PieceColor, Record<PieceType, LatticeCoords[]>>;
export type PosToPiece = { [pos: string]: Piece; };

// relative grid positioning
export type Direction = keyof typeof PlanarDirection | "Above";
export type RelativePosition = "Anywhere" | {
    referencePiece: Piece;
    direction: Direction;
};