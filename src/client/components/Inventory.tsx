import { h } from "preact";

import "@/client/styles/Inventory";

import type {
    Piece,
    PieceColor,
    PieceCount,
    PieceType
} from "@/types/common/game/piece";

import ViewPort from "@/client/components/ViewPort";

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
                    <ViewPort viewRange={[1.05, 1.05]}>
                        {props.renderTile({
                            color: props.playerColor,
                            height: amount,
                            type: type as PieceType
                        })}
                    </ViewPort>
                );
            })}
        </div>
    );
}

export default Inventory;