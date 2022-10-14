import type { ExpansionPieceType, PieceColor, PieceCount } from "@/types/common/engine/piece";
import type { LatticeCoords } from "@/types/common/engine/hexGrid";
import type { PathMap } from "@/types/common/engine/graph";

// optional game rules
// NOTE when changing this type, we MUST update RequestValidator
export interface OptionalGameRules {
    noFirstQueen: boolean; // see https://boardgamegeek.com/wiki/page/Hive_FAQ#toc5
    expansions: Record<ExpansionPieceType, boolean>;
}

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