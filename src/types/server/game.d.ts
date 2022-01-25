import type { PieceColor, PieceType } from "@/types/common/piece";
import type { MovementErrorMsg, PlacementErrorMsg } from "@/types/common/turn";
import type { LatticeCoords } from "@/types/server/hexGrid";
import type { PathMap } from "@/types/server/graph";

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

// pillbug moves
export interface PillbugMoves {
    destinations: LatticeCoords[];
    pathMap: PathMap<LatticeCoords>;
}