import type { PieceColor, PieceCount } from "@/types/common/engine/piece";
import type { LatticeCoords } from "@/types/common/engine/hexGrid";
import type { PathMap } from "@/types/common/engine/graph";

// game state
export type LastMoveDestination = Record<PieceColor, LatticeCoords | null>;

// trackers inferable from game state
export type PlayerInventories = Record<PieceColor, PieceCount>;
export type PlacementCount = Record<PieceColor, number>;
export type GameStatus = "Ongoing" | `${PieceColor}Win` | "Draw";

// move check status types
export type OkOr<Err> = "Ok" | Err;
export type OkPillbugOr<Err> = "PillbugOnly" | OkOr<Err>;

// move generator
export type MoveGen = Generator<LatticeCoords, PathMap<LatticeCoords>, undefined>;