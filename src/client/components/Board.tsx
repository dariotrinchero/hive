import { Fragment, h } from "preact";
import { useContext, useLayoutEffect, useState } from "preact/hooks";

import "@/client/styles/Board";

import type { LatticeCoords, PosToPiece } from "@/types/common/game/hexGrid";
import type { PathMap } from "@/types/common/game/graph";
import type { Piece, PieceColor, PieceCount } from "@/types/common/game/piece";
import type {
    GetMoveResult,
    MovementType,
    MoveOptions,
    MoveType,
    TurnResult
} from "@/types/common/game/outcomes";

import HexGrid from "@/common/game/hexGrid";
import Notation from "@/client/utility/notation";
import ConvertCoords, { SVGCoords } from "@/client/utility/convertCoords";

import { UISettingContext, WithPremove } from "@/client/components/GameUI";

import Inventory from "@/client/components/Inventory";
import Placeholder from "@/client/components/Placeholder";
import Tile, { TileState } from "@/client/components/Tile";
import ViewPort from "@/client/components/ViewPort";

export interface BoardProps {
    // game state
    piecePositions: PosToPiece;
    turnCount: number;
    lastTurn?: TurnResult;

    interactivity?: {
        // player inventory
        playerColor: PieceColor;
        inventory: PieceCount;

        // click handlers
        getMoves: (piece: Piece, turnType: MoveType) => WithPremove<GetMoveResult>;
        attemptMove: (piece: Piece, destination: LatticeCoords, turnType: MoveType) => void;
    };
}

interface SpecialTile {
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
type ShakeKey = number; // used to trigger remount & restart CSS animations

const initHovered: HoveredPlaceholder = { pos: [NaN, NaN], type: "Normal" };
const initPlaceholders: Placeholders = { options: {} };

export default function Board(props: BoardProps): h.JSX.Element {
    const [hovered, setHover] = useState<HoveredPlaceholder>(initHovered);
    const [placeholders, setPlaceholders] = useState<Placeholders>(initPlaceholders);
    const [special, setSpecial] = useState<SpecialTile>();
    const [shakeKey, setShakeKey] = useState<ShakeKey>(1);

    useLayoutEffect(() => {
        resetState(true);
        if (props.lastTurn?.status === "Success" && props.lastTurn.turnType !== "Pass") {
            const { destination, piece, turnType } = props.lastTurn;
            setSpecial({
                animateFrom: turnType === "Movement" ? props.lastTurn.origin : undefined,
                piece,
                pos: destination,
                state: turnType === "Movement" ? "Sliding" : "Dropping",
                turnType: "Movement"
            });
        }
    }, [props.turnCount, props.lastTurn]);

    const hexDims = useContext(UISettingContext);
    const svgCoords = (p: LatticeCoords) => ConvertCoords.hexLatticeToSVG(hexDims.hexGap, ...p);

    function resetState(preserveSpecial?: boolean): void {
        if (!preserveSpecial) setSpecial(undefined);
        setHover(initHovered);
        setPlaceholders(initPlaceholders);
    }

    /**
     * Render move path, representing path to be taken for currently-selected move.
     * 
     * @returns SVG path element representing move path
     */
    function renderMovePath(): h.JSX.Element | undefined {
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
     * @returns Fragment containing child Placeholder component for each placeholder on board
     */
    function renderPlaceholders(moveType: MoveType): h.JSX.Element | undefined {
        if (!props.interactivity || special?.turnType !== moveType) return;
        return (
            <Fragment>
                {HexGrid.entriesOfPosRecord(placeholders.options).map(([pos, type]) => {
                    const handleClick = () => {
                        props.interactivity?.attemptMove(special.piece, pos, moveType);
                        resetState();
                    };
                    return (
                        <Placeholder
                            key={`${pos.join(",")}${type}`}
                            pos={svgCoords(pos)}
                            handleClick={handleClick}
                            handleMouseEnter={() => setHover({ pos, type })}
                            type={type}
                        />
                    );
                })}
            </Fragment>
        );
    }

    function handleTileClick(piece: Piece, pos: LatticeCoords, moveType: MoveType): void {
        if (!props.interactivity) return;

        if (special?.state === "Selected" && HexGrid.eqPiece(special.piece, piece)) resetState();
        else {
            resetState(true);
            const { outcome, premove } = props.interactivity.getMoves(piece, moveType);

            if (outcome.status === "Success") {
                setSpecial({ ...outcome, pos, state: "Selected" });
                setPlaceholders({ ...outcome });
            } else {
                setSpecial({ ...outcome, piece, pos, state: "Shaking" });
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
     * @param moveType move type piece is capable of (ie. whether it is placed yet)
     * @param inactive whether tile should be inactive
     * @returns Tile representing given piece at given location
     */
    function renderTile(piece: Piece, pos: LatticeCoords, moveType: MoveType, inactive?: boolean): h.JSX.Element {
        let state: TileState = "Inactive";
        if (props.interactivity && !inactive) {
            if (special?.turnType === moveType
                && HexGrid.eqPiece(piece, special.piece)) state = special.state;
            else if (special?.state !== "Selected" || moveType === "Placement") state = "Normal";
        }
        return (
            <Tile
                key={`${Notation.pieceToString(piece)}${state === "Shaking" ? shakeKey : ""}`}
                piece={piece}
                pos={svgCoords(pos)}
                slideFrom={special?.animateFrom && svgCoords(special.animateFrom)}
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
    function renderTiles(): h.JSX.Element {
        const slidingTile = ({ piece, pos }: NonNullable<SpecialTile>) => (
            <Fragment>
                {piece.covering && renderTile(piece.covering, pos, "Movement", true)}
                {renderTile(piece, pos, "Movement")}
            </Fragment>
        );
        return (
            <Fragment>
                {HexGrid.entriesOfPosRecord(props.piecePositions).map(([pos, piece]) => {
                    if (special?.state === "Sliding" && HexGrid.eqPiece(piece, special.piece)) return;
                    return renderTile(piece, pos, "Movement");
                })}
                {special?.state === "Sliding" && slidingTile(special)}
            </Fragment>
        );
    }

    const renderInvTile = (piece: Piece) => renderTile(piece, [0, 0], "Placement");
    return (
        <div id="board">
            {props.interactivity &&
                <Inventory
                    {...props.interactivity}
                    renderTile={renderInvTile}
                />}
            <div id="board-panel">
                <ViewPort
                    viewRange={[5.3, 5.3]}
                    panAndZoom={true}
                >
                    {renderTiles()}
                    {renderPlaceholders("Movement")}
                    {renderPlaceholders("Placement")}
                    {renderMovePath()}
                </ViewPort>
            </div>
        </div>
    );
}