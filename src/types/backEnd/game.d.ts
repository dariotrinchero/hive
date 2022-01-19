import { PieceColor, PieceType } from "@/types/common/piece";
import { MovementErrorMsg, PlacementErrorMsg } from "@/types/common/turn";
import { LatticeCoords } from "@/types/backEnd/hexGrid";

// player trackers
export type Inventory = Record<PieceType, number>;
export type PlayerInventories = Record<PieceColor, Inventory>;

export type LastMoveDestination = Record<PieceColor, LatticeCoords | null>;

export type PlacementCount = Record<PieceColor, number>;

// game trackers
export type GameStatus = "Ongoing" | "BlackWin" | "WhiteWin" | "Draw";

// turn check outcomes
export type PlacementCheckOutcome = "Success" | PlacementErrorMsg;
export type MovementCheckOutcome = "Success" | "OnlyByPillbug" | MovementErrorMsg;