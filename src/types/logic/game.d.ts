import { LatticeCoords, Piece, PieceColor, PieceType } from "@/types/common/piece";

export type PieceSpace = Piece | null;

export type Inventory = Record<PieceType, number>;
export type PlayerInventories = Record<PieceColor, Inventory>;

export type PlacementCount = Record<PieceColor, number>;

export type PiecePositions<T extends LatticeCoords> = Record<PieceType, T[]>;
export type PlayerPiecePositions<T> = Record<PieceColor, PiecePositions<T>>;

export type GameStatus = "Ongoing" | "BlackWin" | "WhiteWin" | "Draw";