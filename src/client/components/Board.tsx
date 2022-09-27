import { Fragment, h } from "preact";
import { useContext, useEffect, useState } from "preact/hooks";

import "@/client/styles/Board";

import type { LatticeCoords, PosToPiece } from "@/types/common/game/hexGrid";
import type { PathMap } from "@/types/common/game/graph";
import type { Piece, PieceColor, PieceCount } from "@/types/common/game/piece";
import type {
    GetMoveResult,
    MovementType,
    MoveOptions,
    MoveType
} from "@/types/common/game/outcomes";

import HexGrid from "@/common/game/hexGrid";
import Notation from "@/client/utility/notation";
import ConvertCoords from "@/client/utility/convertCoords";

import { UISettingContext, WithPremove } from "@/client/components/GameUI";

import Inventory from "@/client/components/Inventory";
import Placeholder from "@/client/components/Placeholder";
import Tile, { TileState } from "@/client/components/Tile";
import ViewPort from "@/client/components/ViewPort";

export interface BoardProps {
    // game state
    piecePositions: PosToPiece;
    turnCount: number;

    interactivity?: {
        // player inventory
        playerColor: PieceColor;
        inventory: PieceCount;

        // click handlers
        getMoves: (piece: Piece, turnType: MoveType) => WithPremove<GetMoveResult>;
        attemptMove: (piece: Piece, destination: LatticeCoords, turnType: MoveType) => void;
    };
}

interface Selected {
    piece?: Piece;
    options: MoveOptions;
    turnType: MoveType;
    pathMap?: PathMap<LatticeCoords>;
}
interface HoveredPlaceholder {
    type: MovementType;
    pos: LatticeCoords;
}
interface ShakingTile {
    piece?: Piece;
    key: number; // used to trigger remount to repeat animations
}

const initSelected: Selected = { options: {}, turnType: "Movement" };
const initPlaceholder: HoveredPlaceholder = { pos: [NaN, NaN], type: "Normal" };
const initShaking: ShakingTile = { key: 1 };

export default function Board(props: BoardProps): h.JSX.Element {
    const [selected, setSelected] = useState<Selected>(initSelected);
    const [placeholder, setHover] = useState<HoveredPlaceholder>(initPlaceholder);
    const [shaking, setShaking] = useState<ShakingTile>(initShaking);

    const hexDims = useContext(UISettingContext);

    useEffect(resetState, [props.turnCount]);

    function resetState(): void {
        setSelected(initSelected);
        setHover(initPlaceholder);
        setShaking((prev: ShakingTile) => ({ key: prev.key }));
    }

    function renderMovePath(): h.JSX.Element | undefined {
        if (!selected.pathMap) return;
        const { pos, type } = placeholder;
        const movePath = `M${[pos].concat(selected.pathMap(pos))
            .map(p => ConvertCoords.hexLatticeToSVG(hexDims.hexGap, ...p).join(","))
            .join("L")}`;
        return <path class={`move-path ${type}`} d={movePath} />;
    }

    function handlePlaceholderClick(turnType: MoveType, pos: LatticeCoords): void {
        if (selected.piece) {
            props.interactivity?.attemptMove(selected.piece, pos, turnType);
            resetState();
        }
    }

    /**
     * Render tile for each active placeholder, as long as board is interactive.
     * 
     * @param options TODO
     * @param turnType TODO
     * @returns Fragment containing child Tile for each placeholder on board
     */
    function renderPlaceholders(options: MoveOptions, turnType: MoveType): h.JSX.Element | undefined {
        if (!props.interactivity || selected.turnType !== turnType) return;
        return (
            <Fragment>
                {HexGrid.entriesOfPosRecord(options).map(([pos, type]) => {
                    const handleClick = () => handlePlaceholderClick(turnType, pos);
                    const handleMouseEnter = () => setHover({ pos, type });
                    return (
                        <Placeholder
                            key={`${pos.join(",")}${type}`}
                            pos={ConvertCoords.hexLatticeToSVG(hexDims.hexGap, ...pos)}
                            handleClick={handleClick}
                            handleMouseEnter={handleMouseEnter}
                            type={type}
                        />
                    );
                })}
            </Fragment>
        );
    }

    function handleTileClick(piece: Piece, turnType: MoveType): void {
        if (!props.interactivity) return;

        resetState();
        if (!selected.piece || turnType === "Placement" && !HexGrid.eqPiece(selected.piece, piece)) {
            const { outcome, premove } = props.interactivity.getMoves(piece, turnType);

            if (outcome.status === "Success") {
                setSelected({ ...outcome, piece });
                setShaking(initShaking);
            } else {
                if (turnType === "Movement")
                    setShaking((prev: ShakingTile) => ({ key: -prev.key, piece }));
                console.error(`No legal moves; getMoves() returned message: ${outcome.message}`);
            }
        }
    }

    /**
     * Render tiles for each of the current game pieces.
     * 
     * @returns Fragment containing a child Tile for each piece tile on the board
     */
    function renderPieceTiles(): h.JSX.Element {
        return (
            <Fragment>
                {HexGrid.entriesOfPosRecord(props.piecePositions).map(([pos, piece]) => {
                    let state: TileState = "Inactive";
                    if (props.interactivity) {
                        if (shaking.piece && HexGrid.eqPiece(piece, shaking.piece)) state = "Shaking";
                        else if (!selected.piece) state = "Normal";
                        else if (selected.turnType === "Movement" &&
                            HexGrid.eqPiece(piece, selected.piece)) state = "Selected";
                    }

                    // key must change for shaking tiles to force remount & restart CSS animation
                    // see: https://css-tricks.com/restart-css-animation/
                    const key = `${Notation.pieceToString(piece)}${state === "Shaking" ? shaking.key : ""}`;
                    const handleClick = () => handleTileClick(piece, "Movement");

                    return (
                        <Tile
                            // TODO without key, all pieces transition at once, but with one nothing transitions
                            key={key}
                            piece={piece}
                            pos={ConvertCoords.hexLatticeToSVG(hexDims.hexGap, ...pos)}
                            handleClick={handleClick}
                            state={state}
                        />
                    );
                })}
            </Fragment>
        );
    }

    const handleInventoryClick = (piece: Piece) => handleTileClick(piece, "Placement");

    return (
        <div id="board">
            {props.interactivity &&
                <Inventory
                    {...props.interactivity}
                    selected={selected.turnType === "Placement" ? selected.piece : undefined}
                    selectPiece={handleInventoryClick}
                />}
            <div id="board-panel">
                <ViewPort
                    viewRange={[5.3, 5.3]}
                    panAndZoom={true}
                >
                    {renderPieceTiles()}
                    {renderPlaceholders(selected.options, "Movement")}
                    {renderPlaceholders(selected.options, "Placement")}
                    {renderMovePath()}
                </ViewPort>
            </div>
        </div>
    );
}