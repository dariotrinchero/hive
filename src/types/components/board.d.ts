import { LatticeCoords  } from "@/types/common/piece";

export type SVGContainer = d3.Selection<d3.BaseType, unknown, HTMLElement, unknown>;

export interface ScreenCoords {
    x: number;
    y: number;
}

type SVGGroup = d3.Selection<SVGGElement, unknown, HTMLElement, unknown>;

export interface Tile {
    tileHandle: SVGGroup;
    pos: LatticeCoords;
}

export interface PieceTile extends Tile {
    piece: Piece;
}