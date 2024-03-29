import type { h, VNode } from "preact";
import { useContext, useLayoutEffect, useState } from "preact/hooks";

import "@/client/styles/components/Board";

import type { LatticeCoords, PosToPiece } from "@/types/common/engine/hexGrid";
import type { Piece } from "@/types/common/engine/piece";
import type { MovementType } from "@/types/common/engine/outcomes";

import HexGrid from "@/common/engine/hexGrid";
import ConvertCoords from "@/client/utility/convertCoords";

import { Placeholders, UISettingContext } from "@/client/pages/Game";

import Placeholder from "@/client/components/Placeholder";
import ViewPort from "@/client/components/ViewPort";

export interface BoardProps {
    // viewport
    origin?: LatticeCoords;
    allowPan: boolean;

    // pieces
    pieces: PosToPiece;
    sliding?: Piece;
    renderTile: (piece: Piece, pos: LatticeCoords, inactive?: boolean) => VNode;

    // placeholders
    placeholders: Placeholders;
    handlePlaceholderClick: (pos: LatticeCoords) => void;
}

// TODO make this vary with screen width
const viewRange: [number, number] = [1.3, 6.0];

interface HoveredPlaceholder {
    type: MovementType;
    pos: LatticeCoords;
}
const initHovered: HoveredPlaceholder = { pos: [NaN, NaN], type: "Normal" };

export default function Board(props: BoardProps): VNode {
    const { hexGap } = useContext(UISettingContext);
    const svgCoords = (p: LatticeCoords) => ConvertCoords.hexLatticeToSVG(hexGap, ...p);

    const [hovered, setHovered] = useState<HoveredPlaceholder>(initHovered);
    useLayoutEffect(() => {
        if (!Object.keys(props.placeholders.options).length) setHovered(initHovered);
    }, [props.placeholders]);

    /**
     * Render move path, representing path to be taken for highlighted move.
     * 
     * @returns SVG path element representing move path
     */
    function renderMovePath(): VNode | undefined {
        if (!props.placeholders.pathMap) return;
        const { pos, type } = hovered;
        const movePath = `M${[pos].concat(props.placeholders.pathMap(pos))
            .map(p => svgCoords(p).join(",")).join("L")}`;
        return <path class={`move-path ${type}`} d={movePath} />;
    }

    /**
     * Render active placeholders.
     * 
     * @returns array containing Placeholder component for each placeholder on board
     */
    function renderPlaceholders(): VNode[] {
        return HexGrid.entriesOfPosRecord(props.placeholders.options).map(([pos, type]) => (
            <Placeholder
                key={`${pos.join(",")}${type}`}
                pos={svgCoords(pos)}
                handleClick={() => props.handlePlaceholderClick(pos)}
                handleMouseEnter={() => setHovered({ pos, type })}
                type={type}
            />
        ));
    }

    /**
     * Render tiles for each of the current game pieces, ensuring sliding tile renders last
     * (ie. on top).
     * 
     * @returns fragment containing a child Tile for each piece on board
     */
    function renderTiles(): VNode {
        let slidingPos: LatticeCoords;
        const slidingTile = (piece: Piece) => (
            <>
                {piece.covering && props.renderTile(piece.covering, slidingPos, true)}
                {props.renderTile(piece, slidingPos)}
            </>
        );

        return (
            <>
                {HexGrid.entriesOfPosRecord(props.pieces).map(([pos, piece]) => {
                    if (props.sliding && HexGrid.eqPiece(piece, props.sliding)) {
                        slidingPos = pos;
                        return;
                    }
                    return props.renderTile(piece, pos);
                })}
                {props.sliding && slidingTile(props.sliding)}
            </>
        );
    }

    return (
        <div id="board">
            <ViewPort
                viewRange={viewRange}
                origin={props.origin ? svgCoords(props.origin) : [0, 0]}
                interactable={props.allowPan}
            >
                {renderTiles()}
                {renderPlaceholders()}
                {renderMovePath()}
            </ViewPort>
        </div>
    );
}