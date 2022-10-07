import { h } from "preact";

import "@/client/styles/Inventory";

import type {
    Piece,
    PieceColor,
    PieceCount,
    PieceType
} from "@/types/common/engine/piece";

export interface InventoryProps {
    playerColor: PieceColor;
    inventory: PieceCount;
    renderTile: (piece: Piece) => h.JSX.Element;
}

function Inventory(props: InventoryProps): h.JSX.Element {
    return (
        <div id="inventory-panel">
            {Object.entries(props.inventory).map(([type, amount]) => {
                if (amount > 0) return (
                    <svg viewBox={"-100 -100 200 200"}>
                        {props.renderTile({
                            color: props.playerColor,
                            height: amount,
                            type: type as PieceType
                        })}
                    </svg>
                );
            })}
        </div>
    );
}

export default Inventory;