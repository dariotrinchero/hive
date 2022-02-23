import type { Inventory, PieceColor } from "@/types/common/piece";
import type { MovementErrorMsg, PlacementErrorMsg } from "@/types/common/turn";
import type { LatticeCoords } from "@/types/common/game/hexGrid";
import type { PathMap } from "@/types/common/game/graph";

// game state
export type LastMoveDestination = Record<PieceColor, LatticeCoords | null>;

// trackers inferable from game state
export type PlayerInventories = Record<PieceColor, Inventory>;
export type PlacementCount = Record<PieceColor, number>;
export type GameStatus = "Ongoing" | "BlackWin" | "WhiteWin" | "Draw";

// turn check outcomes
export type PlacementCheckOutcome = "Success" | PlacementErrorMsg;
export type MovementCheckOutcome = "Success" | "OnlyByPillbug" | MovementErrorMsg;

// move generator
export type MoveGenerator = Generator<LatticeCoords, PathMap<LatticeCoords>, undefined>;