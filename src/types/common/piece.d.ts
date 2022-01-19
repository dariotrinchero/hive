import { Bugs, Players } from "@/backEnd/game";

export type PieceColor = keyof typeof Players;

export type PieceType = keyof typeof Bugs;

export interface Piece {
    type: PieceType;
    color: PieceColor;
    index?: number;

    // for pieces on the hive:
    covering?: Piece;
    height?: number;
}