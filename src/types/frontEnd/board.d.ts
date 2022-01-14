import { Piece } from "@/types/common/piece";
import { LatticeCoords } from "@/types/backEnd/hexGrid";

// SVG element handles
export type SVGContainer = d3.Selection<d3.BaseType, unknown, HTMLElement, unknown>;
export type GroupHandle = d3.Selection<SVGGElement, unknown, HTMLElement, unknown>;

export type SelectedTile = null | {
    piece: Piece;
    pos: LatticeCoords;
}

export type ScreenCoords = [number, number];