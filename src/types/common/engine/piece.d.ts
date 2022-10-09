import type { allBugs, baseGameBugs, expansionBugs, pieceColors } from "@/common/engine/piece";

export type PieceColor = typeof pieceColors[number];

export type BaseGamePieceType = typeof baseGameBugs[number];
export type ExpansionPieceType = typeof expansionBugs[number];
export type PieceType = typeof allBugs[number];

export type PieceCount =
    & Record<BaseGamePieceType, number>
    & Partial<Record<ExpansionPieceType, number>>;

export interface Piece {
    type: PieceType;
    color: PieceColor;
    index?: number;

    // for pieces on the hive:
    covering?: Piece;
    height?: number;
}