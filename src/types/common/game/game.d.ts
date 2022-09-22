import type { Inventory, PieceColor } from "@/types/common/game/piece";
import type { LatticeCoords } from "@/types/common/game/hexGrid";
import type { PathMap } from "@/types/common/game/graph";

// game state
export type LastMoveDestination = Record<PieceColor, LatticeCoords | null>;

// trackers inferable from game state
export type PlayerInventories = Record<PieceColor, Inventory>;
export type PlacementCount = Record<PieceColor, number>;
export type GameStatus = "Ongoing" | `${PieceColor}Win` | "Draw";

// move check status types
export type SuccessOr<Err> = "Success" | Err;
export type SuccessPillbugOr<Err> = "PillbugOnly" | SuccessOr<Err>;

// move generator
export type MoveGen = Generator<LatticeCoords, PathMap<LatticeCoords>, undefined>;