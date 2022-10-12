import { h, VNode } from "preact";

import "@/client/styles/Inventory";

import { invertColor, pieceColors } from "@/common/engine/piece";
import Notation from "@/common/engine/notation";

import type {
    Piece,
    PieceColor,
    PieceType
} from "@/types/common/engine/piece";
import type { PlayerInventories } from "@/types/common/engine/game";
import type { ClientColor } from "@/types/client/gameClient";

import Tabs from "@/client/components/Tabs";

export interface InventoryProps {
    playerColor: ClientColor;
    inventories: PlayerInventories;
    renderTile: (piece: Piece, inactive?: boolean) => VNode;
}

function Inventory(props: InventoryProps): VNode {
    /**
     * Render contents of inventory tab for given player color.
     * 
     * @param color player color whose inventory to render
     * @returns CSS grid representing contents of given player's inventory
     */
    function renderContent(color: PieceColor): VNode {
        return (
            <div id="inventory-panel">
                {Object.entries(props.inventories[color])
                    .filter(entry => entry[1] > 0)
                    .map(([type, amount]) => {
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
                    })}
            </div>
        );
    }

    const colors = props.playerColor === "Spectator"
        ? pieceColors
        : [props.playerColor, invertColor(props.playerColor)];
    return (
        <Tabs
            noFrame
            tabDefs={colors.map(color => ({
                content: renderContent(color),
                title: color
            }))}
        />
    );
}

export default Inventory;