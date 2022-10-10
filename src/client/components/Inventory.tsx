import { h, VNode } from "preact";

import "@/client/styles/Inventory";

import type {
    Piece,
    PieceColor,
    PieceType
} from "@/types/common/engine/piece";
import type { PlayerInventories } from "@/types/common/engine/game";

export interface InventoryProps {
    playerColor: PieceColor;
    inventory: PlayerInventories;
    inactive?: boolean;
    renderTile: (piece: Piece, inactive?: boolean) => VNode;
}

function Inventory(props: InventoryProps): VNode {
    return (
        <div id="inventory-panel">
            {Object.entries(props.inventory[props.playerColor]).map(([type, amount]) => {
                if (amount > 0) return (
                    <svg
                        viewBox={"-103 -103 206 206"} // TODO must be adjusted to fit Tile stroke width
                    >
                        {props.renderTile(
                            {
                                color: props.playerColor,
                                height: amount,
                                type: type as PieceType
                            },
                            props.inactive
                        )}
                    </svg>
                );
            })}
        </div>
    );
}

export default Inventory;