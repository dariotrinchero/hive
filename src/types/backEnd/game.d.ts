import { PieceColor, PieceType } from "@/types/common/piece";

export type Inventory = Record<PieceType, number>;
export type PlayerInventories = Record<PieceColor, Inventory>;

export type PlacementCount = Record<PieceColor, number>;

export type GameStatus = "Ongoing" | "BlackWin" | "WhiteWin" | "Draw";