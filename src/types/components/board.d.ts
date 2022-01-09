export type SVGContainer = d3.Selection<d3.BaseType, unknown, HTMLElement, unknown>;

export type SVGGroup = d3.Selection<SVGGElement, unknown, HTMLElement, unknown>;

export type SVGPath = d3.Selection<SVGPathElement, number[][], SVGGElement, unknown>;

export interface ScreenCoords {
    x: number;
    y: number;
}

export interface Tile {
    tileHandle: SVGGroup;
    pos: LatticeCoords;
}

export interface PieceTile extends Tile {
    piece: Piece
}