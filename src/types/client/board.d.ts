import type { BaseType, Selection } from "d3-selection";

import type { Piece } from "@/types/common/piece";
import type { LatticeCoords } from "@/types/common/game/hexGrid";

export type Sel<T extends BaseType> = Selection<T, unknown, HTMLElement, unknown>; // shorter form for selection types

export type SelectedPiece = null | {
    piece: Piece;
    pos: LatticeCoords;
    hex: Sel<BaseType>;
}

export type ScreenCoords = [number, number];