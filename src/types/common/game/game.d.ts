import type { Inventory, PieceColor } from "@/types/common/piece";
import type { MovementErrorMsg, PillbugMovementErrorMsg, PlacementErrorMsg } from "@/types/common/turn";
import type { LatticeCoords } from "@/types/common/game/hexGrid";
import type { PathMap } from "@/types/common/game/graph";

// game state
export type LastMoveDestination = Record<PieceColor, LatticeCoords | null>;

// trackers inferable from game state
export type PlayerInventories = Record<PieceColor, Inventory>;
export type PlacementCount = Record<PieceColor, number>;
export type GameStatus = "Ongoing" | `${PieceColor}Win` | "Draw";

// turn check outcomes
export type PlacementCheckOutcome = "Success" | PlacementErrorMsg;
export type MovementCheckOutcome = "Success" | "OnlyByPillbug" | MovementErrorMsg;
export type PillbugMovementCheckOutcome = "Success" | PillbugMovementErrorMsg;

// move generator
export type MoveGenerator = Generator<LatticeCoords, PathMap<LatticeCoords>, undefined>;

// adjacent pillbug check outcome
interface AdjPillbugBase {
    status: PillbugMovementCheckOutcome;
}
interface AdjPillbugError extends AdjPillbugBase {
    status: PillbugMovementErrorMsg;
}
interface AdjPillbugSuccess extends AdjPillbugBase {
    status: "Success";
    validPillbugs: LatticeCoords[];
}
export type AdjPillbugs = AdjPillbugError | AdjPillbugSuccess;