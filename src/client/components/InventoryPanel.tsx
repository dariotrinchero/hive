import { h } from "preact";

import type { Inventory, PieceColor, PieceType } from "@/types/common/game/piece";
import type { HexDimensions } from "@/types/client/tile";

import ConvertCoords from "@/client/utility/convertCoords";

import TileContainer from "@/client/components/TileContainer";
import PieceTile from "./PieceTile";

export interface InventoryProps {
    playerColor: PieceColor;
    inventory: Inventory;
}

// TODO make this consistent with Board by passing from GameUI into both via props?
const hexDims: HexDimensions = { cornerRad: 100 / 6, gap: 100 / 18 };

const handleTileClick = () => {
    return;
};

const InventoryPanel: (props: InventoryProps) => h.JSX.Element = props => {
    return (
        <TileContainer
            hexDims={hexDims}
            panAndZoom={false}
            viewRange={3}
        >
            {Object.entries(props.inventory).map(([type, amount], index) => {
                <PieceTile
                    handleClick={handleTileClick}
                    piece={{ color: props.playerColor, type: type as PieceType }}
                    pos={ConvertCoords.hexLatticeToSVG(hexDims.gap, 0, index)}
                    state={"Normal"}
                />;
            })}
        </TileContainer>
    );
};

export default InventoryPanel;