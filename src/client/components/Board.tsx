import { Fragment, h, VNode } from "preact";
import { useContext, useLayoutEffect, useState } from "preact/hooks";

import "@/client/styles/Board";

import type { LatticeCoords, PosToPiece } from "@/types/common/engine/hexGrid";
import type { PathMap } from "@/types/common/engine/graph";
import type { PlayerInventories } from "@/types/common/engine/game";
import type { Piece, PieceColor } from "@/types/common/engine/piece";
import type {
    GetMoveResult,
    MovementType,
    MoveOptions,
    MoveType,
    TurnResult
} from "@/types/common/engine/outcomes";

import HexGrid from "@/common/engine/hexGrid";
import Notation from "@/common/engine/notation";
import ConvertCoords, { SVGCoords } from "@/client/utility/convertCoords";
import { invertColor } from "@/common/engine/piece";

import { UISettingContext, WithPremove } from "@/client/components/GameUI";

import Inventory from "@/client/components/Inventory";
import Placeholder from "@/client/components/Placeholder";
import Tile, { TileState } from "@/client/components/Tile";
import ViewPort from "@/client/components/ViewPort";
import Tabs from "@/client/components/Tabs";

export interface BoardProps {
    origin?: LatticeCoords;

    // game state
    piecePositions: PosToPiece;
    turnCount: number;
    lastTurn?: TurnResult;

    interactivity?: {
        // player inventory
        playerColor: PieceColor;
        inventory: PlayerInventories;

        // click handlers
        getMoves: (piece: Piece, turnType: MoveType) => WithPremove<GetMoveResult>;
        attemptMove: (piece: Piece, destination: LatticeCoords, turnType: MoveType) => void;
    };
}

// TODO make this a setting
const viewRange: [number, number] = [5.3, 5.3];

interface SpecialTile {
    // tile with special state (eg. selected, just placed, shaking, etc)
    piece: Piece;
    pos: LatticeCoords;
    turnType: MoveType; // whether piece is on board / inventory
    state: TileState; // special state of this tile
    animateFrom?: SVGCoords;
}
interface Placeholders {
    options: MoveOptions;
    pathMap?: PathMap<LatticeCoords>;
}
interface HoveredPlaceholder {
    type: MovementType;
    pos: LatticeCoords;
}

const initHovered: HoveredPlaceholder = { pos: [NaN, NaN], type: "Normal" };
const initPlaceholders: Placeholders = { options: {} };

export default function Board(props: BoardProps): VNode {
    const { hexGap } = useContext(UISettingContext);
    const svgCoords = (p: LatticeCoords) => ConvertCoords.hexLatticeToSVG(hexGap, ...p);

    // placeholder state
    const [hovered, setHovered] = useState<HoveredPlaceholder>(initHovered);
    const [placeholders, setPlaceholders] = useState<Placeholders>(initPlaceholders);

    // clicked tile state
    const [specialTile, setSpecialTile] = useState<SpecialTile>();
    const [shakeKey, setShakeKey] = useState(1); // used to force remount & restart CSS animation

    useLayoutEffect(() => {
        // advance turn by clearing selection & animating last turn
        clearSelection(true);
        if (props.lastTurn?.status === "Ok" && props.lastTurn.turnType !== "Pass") {
            const { destination, piece, turnType } = props.lastTurn;
            setSpecialTile({
                animateFrom: turnType === "Movement" ? props.lastTurn.origin : undefined,
                piece,
                pos: destination,
                state: turnType === "Movement" ? "Sliding" : "Dropping",
                turnType: "Movement"
            });
        }
    }, [props.turnCount, props.lastTurn]);

    /**
     * Reset state pertaining to user selections, including placeholders, hovered placeholder,
     * and special tile (optionally preserving the latter).
     * 
     * @param preserveSpecialTile whether to keep the state of the special tile
     */
    function clearSelection(preserveSpecialTile?: boolean): void {
        if (!preserveSpecialTile) setSpecialTile(undefined);
        setHovered(initHovered);
        setPlaceholders(initPlaceholders);
    }

    /**
     * Render move path, representing path to be taken for currently-selected move.
     * 
     * @returns SVG path element representing move path
     */
    function renderMovePath(): VNode | undefined {
        if (!placeholders.pathMap) return;
        const { pos, type } = hovered;
        const movePath = `M${[pos].concat(placeholders.pathMap(pos))
            .map(p => svgCoords(p).join(",")).join("L")}`;
        return <path class={`move-path ${type}`} d={movePath} />;
    }

    /**
     * Render tile for each active placeholder, as long as board is interactive.
     * 
     * @param moveType whether placeholders are for movement or placement selection
     * @returns array containing Placeholder component for each placeholder on board
     */
    function renderPlaceholders(moveType: MoveType): VNode[] {
        if (!props.interactivity || specialTile?.turnType !== moveType) return [];
        return HexGrid.entriesOfPosRecord(placeholders.options).map(([pos, type]) => {
            const handleClick = () => {
                props.interactivity?.attemptMove(specialTile.piece, pos, moveType);
                clearSelection();
            };
            return (
                <Placeholder
                    key={`${pos.join(",")}${type}`}
                    pos={svgCoords(pos)}
                    handleClick={handleClick}
                    handleMouseEnter={() => setHovered({ pos, type })}
                    type={type}
                />
            );
        });
    }

    /**
     * Handle user clicking tile corresponding to given piece at given position. Specifically,
     * either select/deselect piece, in the former case retrieving & storing available moves.
     * Shake tile if attempting to select a tile with no available moves.
     * 
     * @param piece piece represented by clicked tile
     * @param pos position of clicked tile (if on board)
     * @param moveType move type of which piece is capable (ie. whether it is placed yet)
     */
    function handleTileClick(piece: Piece, pos: LatticeCoords, moveType: MoveType): void {
        if (!props.interactivity) return;

        if (specialTile?.state === "Selected"
            && HexGrid.eqPiece(specialTile.piece, piece)) clearSelection();
        else {
            clearSelection(true);
            const { outcome, premove } = props.interactivity.getMoves(piece, moveType);

            if (outcome.status === "Ok") {
                setSpecialTile({ ...outcome, pos, state: "Selected" });
                setPlaceholders({ ...outcome });
            } else {
                setSpecialTile({ ...outcome, piece, pos, state: "Shaking" });
                setShakeKey((prev: number) => -prev);
                console.error(`No legal moves; getMoves() gave message: ${outcome.message}`);
            }
        }
    }

    /**
     * Render single given piece tile.
     * 
     * @param piece the piece to render
     * @param pos position of tile (in lattice coordinates)
     * @param moveType move type of which piece is capable (ie. whether it is placed yet)
     * @param inactive whether tile should be inactive
     * @returns Tile representing given piece at given location
     */
    function renderTile(piece: Piece, pos: LatticeCoords, moveType: MoveType, inactive?: boolean): VNode {
        let state: TileState = "Inactive";
        if (props.interactivity && !inactive) {
            if (specialTile?.turnType === moveType
                && HexGrid.eqPiece(piece, specialTile.piece)) state = specialTile.state;
            else if (specialTile?.state !== "Selected" || moveType === "Placement") state = "Normal";
        }
        return (
            <Tile
                key={`${Notation.pieceToString(piece)}${state === "Shaking" ? shakeKey : ""}`}
                piece={piece}
                pos={svgCoords(pos)}
                slideFrom={specialTile?.animateFrom && svgCoords(specialTile.animateFrom)}
                handleClick={() => handleTileClick(piece, pos, moveType)}
                state={state}
            />
        );
    }

    /**
     * Render tiles for each of the current game pieces; ensures last-moved tile always renders
     * last (ie. on top).
     * 
     * @returns Fragment containing a child Tile for each piece tile on the board
     */
    function renderTiles(): VNode {
        const slidingTile = ({ piece, pos }: NonNullable<SpecialTile>) => (
            <Fragment>
                {piece.covering && renderTile(piece.covering, pos, "Movement", true)}
                {renderTile(piece, pos, "Movement")}
            </Fragment>
        );
        return (
            <Fragment>
                {HexGrid.entriesOfPosRecord(props.piecePositions).map(([pos, piece]) => {
                    if (specialTile?.state === "Sliding"
                        && HexGrid.eqPiece(piece, specialTile.piece)) return;
                    return renderTile(piece, pos, "Movement");
                })}
                {specialTile?.state === "Sliding" && slidingTile(specialTile)}
            </Fragment>
        );
    }

    /**
     * Render tabbed board overlay, containing player inventories & move history.
     * 
     * @returns absolutely-positioned div containing inventory & history tabs
     */
    function renderOverlay(): VNode | undefined {
        if (!props.interactivity) return;
        return (
            <div id="board-overlay">
                <Tabs
                    collapseAt="30em"
                    tabDefs={[
                        {
                            content: (
                                <Inventory
                                    playerColor={props.interactivity.playerColor}
                                    inventory={props.interactivity.inventory}
                                    renderTile={renderInvTile}
                                />
                            ),
                            title: "Inventory"
                        },
                        {
                            content: (
                                <a
                                    href="something"
                                    role="button"
                                    class="button1"
                                >
                                    Concede
                                </a>
                            ),
                            title: "History"
                        },
                        {
                            content: (
                                <h1>
                                    TODO
                                </h1>
                            ),
                            title: "Chat"
                        }
                    ]}
                />
            </div>
        );
    }

    const renderInvTile = (piece: Piece, inactive?: boolean) =>
        renderTile(piece, [0, 0], "Placement", inactive);
    return (
        <div id="board">
            {renderOverlay()}
            <ViewPort
                viewRange={viewRange}
                origin={props.origin ? svgCoords(props.origin) : [0, 0]}
                interactable={props.turnCount > 0}
            >
                {renderTiles()}
                {renderPlaceholders("Movement")}
                {renderPlaceholders("Placement")}
                {renderMovePath()}
            </ViewPort>
        </div>
    );
}