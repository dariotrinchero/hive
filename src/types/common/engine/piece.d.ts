import type { Bugs, Colors } from "@/common/engine/piece";

export type PieceColor = keyof typeof Colors;

export type PieceType = keyof typeof Bugs;

export type PieceCount = Record<PieceType, number>;

export interface Piece {
    type: PieceType;
    color: PieceColor;
    index?: number;

    // for pieces on the hive:
    covering?: Piece;
    height?: number;
}