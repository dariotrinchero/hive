export type PieceColor = "Black" | "White";

export type PieceType = "Ant" | "Beetle" | "Grasshopper" | "Ladybug" | "Mosquito" | "Pillbug" | "QueenBee" | "Spider";

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