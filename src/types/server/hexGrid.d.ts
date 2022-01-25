import type { Piece } from "@/types/common/piece";
import { PlanarDirection } from "@/server/game/hexGrid";

// absolute grid positioning
export type LatticeCoords = [number, number];

// relative grid positioning
export type Direction = keyof typeof PlanarDirection | "Above";
export type RelativePosition = "Anywhere" | {
    referencePiece: Piece;
    direction: Direction;
};