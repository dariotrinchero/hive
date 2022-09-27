import { h } from "preact";

import type {
    Piece,
    PieceColor,
    PieceCount,
    PieceType
} from "@/types/common/game/piece";

import HexGrid from "@/common/game/hexGrid";
import ConvertCoords from "@/client/utility/convertCoords";

import ViewPort from "@/client/components/ViewPort";
import Tile, { TileState } from "@/client/components/Tile";

export interface InventoryProps {
    playerColor: PieceColor;
    inventory: PieceCount;

    // interactivity
    selected?: Piece;
    selectPiece: (piece: Piece) => void;
}

const hexGap = 100 / 18;

function Inventory(props: InventoryProps): h.JSX.Element {
    return (
        <div id="inventory-panel">
            <ViewPort viewRange={[2, 4.15]}>
                {Object.entries(props.inventory).map(([type, amount], index) => {
                    const pos: [number, number] = [
                        ConvertCoords.hexLatticeToSVG(hexGap, Math.floor(index / 4) - 0.5, 0)[0],
                        (index % 4 - 1) * (200 + hexGap) - 50
                    ];
                    const piece: Piece = { color: props.playerColor, height: amount, type: type as PieceType };
                    const handleTileClick = () => props.selectPiece(piece);

                    let state: TileState = "Normal";
                    if (props.selected) {
                        if (HexGrid.eqPiece(piece, props.selected)) state = "Selected";
                    }

                    if (amount > 0) return (
                        <Tile
                            key={type}
                            handleClick={handleTileClick}
                            piece={piece}
                            pos={pos}
                            state={state}
                            showBadge={true}
                        />
                    );
                })}
            </ViewPort>
        </div>
    );
}

export default Inventory;