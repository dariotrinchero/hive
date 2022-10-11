import { h, VNode } from "preact";

import "@/client/styles/Inventory";

import { invertColor } from "@/common/engine/piece";
import Notation from "@/common/engine/notation";

import type {
    Piece,
    PieceColor,
    PieceType
} from "@/types/common/engine/piece";
import type { PlayerInventories } from "@/types/common/engine/game";

import Tabs from "@/client/components/Tabs";

export interface InventoryProps {
    playerColor: PieceColor;
    inventory: PlayerInventories;
    renderTile: (piece: Piece, inactive?: boolean) => VNode;
}

function Inventory(props: InventoryProps): VNode {
    function renderTabContent(color: PieceColor): VNode {
        return (
            <div id="inventory-panel">
                {Object.entries(props.inventory[color]).map(([type, amount]) => {
                    if (amount > 0) {
                        const piece = { color, height: amount, type: type as PieceType };
                        const key = `${Notation.pieceToString(piece)}x${amount}`;
                        return (
                            <svg
                                viewBox={"-103 -103 206 206"} // TODO must be adjusted to fit Tile stroke width
                                alt={key}
                                aria-label={key}
                                key={key}
                            >
                                {props.renderTile(piece, color !== props.playerColor)}
                            </svg>
                        );
                    }
                })}
            </div>
        );
    }

    return (
        <Tabs
            noFrame
            tabDefs={
                [props.playerColor, invertColor(props.playerColor)].map(color => ({
                    content: renderTabContent(color),
                    title: color
                }))
            }
        />
    );
}

export default Inventory;