import { LatticeCoords, Piece } from "@/types/common/piece";

export type SVGContainer = d3.Selection<d3.BaseType, unknown, HTMLElement, unknown>;

export interface ScreenCoords {
    x: number;
    y: number;
}

type GroupHandle = d3.Selection<SVGGElement, unknown, HTMLElement, unknown>;

export interface TilePos extends LatticeCoords {
    handle: GroupHandle;
}

export type SelectedPiece = null | {
    tilePos: TilePos;
    piece: Piece;
}