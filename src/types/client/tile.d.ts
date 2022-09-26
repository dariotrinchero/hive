import type { SVGCoords } from "@/client/utility/convertCoords";

// parent interface for PieceTile & Placeholder props
export interface BaseTileProps {
    pos: SVGCoords;
    handleClick?: () => void;
}