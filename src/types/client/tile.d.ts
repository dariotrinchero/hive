import type { ScreenCoords } from "@/client/components/Board";
import type { HexDimensions } from "@/client/components/TileDefs";

export interface BaseTileProps {
    size: HexDimensions;
    pos: ScreenCoords;
    handleClick: () => void;
}