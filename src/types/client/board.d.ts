import type { Piece } from "@/types/common/piece";
import type { LatticeCoords } from "@/types/common/game/hexGrid";

export type SelectedPiece = null | {
    piece: Piece;
    pos: LatticeCoords;
}

export type ScreenCoords = [number, number];