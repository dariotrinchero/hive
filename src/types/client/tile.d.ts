import type { SVGCoords } from "@/client/utility/convertCoords";

// parent interface for PieceTile & Placeholder props
export interface BaseTileProps {
    pos: SVGCoords;
    handleClick: () => void;
}

// tile dimensions in SVG-coordinates
export interface HexDimensions {
    // hex radius is globally fixed to 100;
    // these are percentages thereof (ie. in range [0,100])
    cornerRad: number;
    gap: number;
}