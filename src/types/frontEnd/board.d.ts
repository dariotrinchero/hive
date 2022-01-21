import type { BaseType, Selection } from "d3-selection";

import type { Piece } from "@/types/common/piece";
import type { LatticeCoords } from "@/types/backEnd/hexGrid";
import type { PathMap } from "@/types/backEnd/graph";

export type Sel<T extends BaseType> = Selection<T, unknown, HTMLElement, unknown>; // shorter form for selection types

export type SelectedPiece = null | {
    piece: Piece;
    pos: LatticeCoords;
}

export type ScreenCoords = [number, number];

export interface MovePaths {
    normal: PathMap<LatticeCoords>;
    pillbug: PathMap<LatticeCoords>;
}