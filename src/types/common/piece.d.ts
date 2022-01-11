import { Players, Bugs } from "@/logic/game";

export type PieceColor = keyof typeof Players;

export type PieceType = keyof typeof Bugs;

export interface Piece {
    type: PieceType;
    color: PieceColor;
    index?: number;
    covering?: Piece; // for beetles
}

export interface LatticeCoords {
    u: number;
    v: number;
}