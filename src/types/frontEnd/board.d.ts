import type { Selection } from "d3-selection";

import type { Piece } from "@/types/common/piece";
import type { LatticeCoords } from "@/types/backEnd/hexGrid";

// SVG element handles
export type SVGContainer = Selection<SVGSVGElement, unknown, HTMLElement, unknown>;
export type GroupHandle = Selection<SVGGElement, unknown, HTMLElement, unknown>;

export type SelectedPiece = null | {
    piece: Piece;
    pos: LatticeCoords;
}

export type ScreenCoords = [number, number];