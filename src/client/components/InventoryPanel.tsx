import { h } from "preact";

import type { Inventory, PieceColor, PieceType } from "@/types/common/game/piece";

import ConvertCoords from "@/client/utility/convertCoords";

import ViewPort from "@/client/components/ViewPort";
import PieceTile from "@/client/components/PieceTile";

export interface InventoryProps {
    playerColor: PieceColor;
    inventory: Inventory;
}

const hexGap = 100 / 18;

const handleTileClick = () => {
    return;
};

function InventoryPanel(props: InventoryProps): h.JSX.Element {
    return (
        <ViewPort viewRange={3}>
            {Object.entries(props.inventory).map(([type, amount], index) => {
                <PieceTile
                    handleClick={handleTileClick}
                    piece={{ color: props.playerColor, type: type as PieceType }}
                    pos={ConvertCoords.hexLatticeToSVG(hexGap, 0, index)}
                    state={"Normal"}
                />;
            })}
        </ViewPort>
    );
}

export default InventoryPanel;