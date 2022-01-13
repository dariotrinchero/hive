import { Piece } from "@/types/common/piece";
import { LatticeCoords } from "@/types/backEnd/hexGrid";

// SVG element handles
export type SVGContainer = d3.Selection<d3.BaseType, unknown, HTMLElement, unknown>;
type GroupHandle = d3.Selection<SVGGElement, unknown, HTMLElement, unknown>;

// selection tracking
export type SelectedPiece = null | {
    tilePos: TilePos;
    piece: Piece;
}

// hex-grid positioning
export interface TilePos extends LatticeCoords {
    handle: GroupHandle;
}

export interface ScreenCoords {
    x: number;
    y: number;
}