import { h } from "preact";

import type {
    Piece,
    PieceColor,
    PieceCount,
    PieceType
} from "@/types/common/game/piece";

import ConvertCoords, { SVGCoords } from "@/client/utility/convertCoords";

import ViewPort from "@/client/components/ViewPort";

export interface InventoryProps {
    playerColor: PieceColor;
    inventory: PieceCount;
    renderTile: (piece: Piece, pos: SVGCoords) => h.JSX.Element;
}

const hexGap = 100 / 18;

function Inventory(props: InventoryProps): h.JSX.Element {
    return (
        <div id="inventory-panel">
            <ViewPort viewRange={[2, 4.15]}>
                {Object.entries(props.inventory).map(([type, amount], index) => {
                    if (amount > 0) return props.renderTile(
                        {
                            color: props.playerColor,
                            height: amount,
                            type: type as PieceType },
                        [
                            ConvertCoords.hexLatticeToSVG(hexGap, Math.floor(index / 4) - 0.5, 0)[0],
                            (index % 4 - 1) * (200 + hexGap) - 50
                        ]
                    );
                })}
            </ViewPort>
        </div>
    );
}

export default Inventory;