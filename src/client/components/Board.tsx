import { Fragment, h } from "preact";
import { useEffect, useState } from "preact/hooks";

import "@/client/styles/Board";

import type { LatticeCoords, PosToPiece } from "@/types/common/game/hexGrid";
import type { PathMap } from "@/types/common/game/graph";
import type { Piece } from "@/types/common/game/piece";
import type { GetMovementResult, GetPlacementResult, MovementOptions, MovementType } from "@/types/common/game/outcomes";

import type { WithPremove } from "@/client/components/GameUI";

import HexGrid from "@/common/game/hexGrid";
import Notation from "@/client/utility/notation";
import ConvertCoords from "@/client/utility/convertCoords";

import Placeholder from "@/client/components/Placeholder";
import PieceTile, { PieceTileState } from "@/client/components/PieceTile";
import ViewPort from "@/client/components/ViewPort";

type GetMovementFn = (piece: Piece) => WithPremove<GetMovementResult>;
type GetPlacementFn = (piece: Piece) => WithPremove<GetPlacementResult>;
type DoMoveFn = (piece: Piece, destination: LatticeCoords) => void;

export interface BoardProps {
    // game state
    piecePositions: PosToPiece;
    turnCount: number;

    // tile spacing
    hexGap: number;

    // potential interactivity
    interactivity?: {
        getMovements: GetMovementFn;
        getPlacements: GetPlacementFn;
        attemptMove: DoMoveFn;
    };
}

interface StateBase { pos: LatticeCoords; }

interface CurrTile extends StateBase {
    pathMap: PathMap<LatticeCoords>;
    options: MovementOptions;
}
interface CurrPlaceholder extends StateBase {
    type: MovementType;
}
interface ShakingTile extends StateBase {
    parity: number;
}

const initTile: CurrTile = { options: {}, pathMap: () => [], pos: [NaN, NaN] };
const initPlaceholder: CurrPlaceholder = { pos: [NaN, NaN], type: "Normal" };
const initShaking: ShakingTile = { parity: 1, pos: [NaN, NaN] };

export default function Board(props: BoardProps): h.JSX.Element {
    const [currTile, setSelected] = useState<CurrTile>(initTile);
    const [currPlaceholder, setHover] = useState<CurrPlaceholder>(initPlaceholder);
    const [shaking, setShaking] = useState<ShakingTile>(initShaking);

    useEffect(resetState, [props.turnCount]);

    function resetState(): void {
        setSelected(initTile);
        setHover(initPlaceholder);
        setShaking(initShaking);
    }

    function handlePlaceholderClick(attemptMove: DoMoveFn, pos: LatticeCoords): void {
        if (currTile.pos) {
            const piece = props.piecePositions[currTile.pos.join(",")];
            if (piece) attemptMove(piece, pos);
            else {
                // TODO should never be reachable; still, show error to user
                console.error("Piece to move is no longer in its expected starting location.");
            }
            resetState();
        }
    }

    /**
     * Render move path & tile for each active placeholder, as long as board is interactive.
     * 
     * @param props props of this component, containing interactivity callbacks
     * @returns Fragment containing move path & child Tile for each placeholder on board
     */
    function renderPlaceholdersAndPath(props: BoardProps): h.JSX.Element | undefined {
        if (!props.interactivity) return;
        const { attemptMove } = props.interactivity;

        const { pos, type } = currPlaceholder;
        const movePath = `M${[pos].concat(currTile.pathMap(pos))
            .map(p => ConvertCoords.hexLatticeToSVG(props.hexGap, ...p).join(","))
            .join("L")}`;

        return (
            <Fragment>
                {HexGrid.entriesOfPosRecord(currTile.options).map(([pos, type]) => {
                    const handleClick = () => handlePlaceholderClick(attemptMove, pos);
                    const handleMouseEnter = () => setHover({ pos, type });

                    return (
                        <Placeholder
                            key={`${pos.join(",")}${type}`}
                            pos={ConvertCoords.hexLatticeToSVG(props.hexGap, ...pos)}
                            handleClick={handleClick}
                            handleMouseEnter={handleMouseEnter}
                            type={type}
                        />
                    );
                })}
                <path class={`move-path ${type}`} d={movePath} />
            </Fragment>
        );
    }

    function handlePieceTileClick(piece: Piece, pos: LatticeCoords): void {
        if (!props.interactivity) return;

        if (isNaN(currTile.pos[0])) { // clicking unselected piece
            const { outcome } = props.interactivity.getMovements(piece); // TODO does not distinguish premoves

            if (outcome.status === "Success") {
                const { pathMap, options } = outcome;
                setSelected({ options, pathMap, pos });
                setShaking(initShaking);
            } else {
                setShaking((prev: ShakingTile) => ({ parity: -prev.parity, pos }));
                console.error(`No legal moves; getMoves() returned message: ${outcome.message}`);
            }
        } else if (HexGrid.eqPos(pos, currTile.pos)) resetState();
    }

    /**
     * Render tiles for each of the current game pieces.
     * 
     * @param props props of this component, containing current piece tile positions
     * @returns Fragment containing a child Tile for each piece tile on the board
     */
    function renderPieceTiles(props: BoardProps): h.JSX.Element {
        return (
            <Fragment>{
                HexGrid.entriesOfPosRecord(props.piecePositions).map(([pos, piece]) => {
                    let state: PieceTileState = "Inactive";
                    if (props.interactivity) {
                        if (HexGrid.eqPos(pos, shaking.pos)) state = "Shaking";
                        else if (isNaN(currTile.pos[0])) state = "Normal";
                        else if (HexGrid.eqPos(pos, currTile.pos)) state = "Selected";
                    }

                    // key must change for shaking tiles to force remount & restart CSS animation
                    // see: https://css-tricks.com/restart-css-animation/
                    const key = `${Notation.pieceToString(piece)}${state === "Shaking" ? shaking.parity : ""}`;
                    const handleClick = () => handlePieceTileClick(piece, pos);

                    return (
                        <PieceTile
                            // TODO without key, all pieces transition at once, but with one nothing transitions
                            key={key}
                            piece={piece}
                            pos={ConvertCoords.hexLatticeToSVG(props.hexGap, ...pos)}
                            handleClick={handleClick}
                            state={state}
                        />
                    );
                })
            }</Fragment>
        );
    }

    return (
        <ViewPort
            viewRange={5.3}
            panAndZoom={true}
        >
            {renderPieceTiles(props)}
            {renderPlaceholdersAndPath(props)}
        </ViewPort>
    );
}