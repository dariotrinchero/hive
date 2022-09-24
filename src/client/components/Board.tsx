import { Component, Fragment, h } from "preact";

import "@/client/styles/Board";

import type { LatticeCoords, PosToPiece } from "@/types/common/game/hexGrid";
import type { PathMap } from "@/types/common/game/graph";
import type { Piece, PieceColor } from "@/types/common/game/piece";
import type { MovementOptions, MovementType } from "@/types/common/game/outcomes";
import type { HexDimensions } from "@/types/client/tile";

import type { MoveAvailability } from "@/client/components/GameUI";

import HexGrid from "@/common/game/hexGrid";
import Notation from "@/client/utility/notation";
import ConvertCoords from "@/client/utility/convertCoords";

import Placeholder from "@/client/components/Placeholder";
import PieceTile, { PieceTileState } from "@/client/components/PieceTile";
import TileContainer from "@/client/components/TileContainer";

type GetMoveFn = (piece: Piece) => MoveAvailability;
type DoMoveFn = (piece: Piece, destination: LatticeCoords) => void;

export interface BoardProps {
    // board layout
    piecePositions: PosToPiece;
    currTurnColor: PieceColor;

    // potential interactivity
    interactivity?: {
        getMoves: GetMoveFn;
        attemptMove: DoMoveFn;
    };
}

interface BoardState {
    from: LatticeCoords;
    to: LatticeCoords;
    moveType: MovementType;
    pathMap: PathMap<LatticeCoords>;
    placeholders: MovementOptions;
    tileShake: LatticeCoords;
}

// TODO make this into a setting
const hexDims: HexDimensions = { cornerRad: 100 / 6, gap: 100 / 18 };

export default class Board extends Component<BoardProps, BoardState> {
    public constructor() {
        super();
        this.state = Board.initialState();
    }

    /**
     * Detect when the turn has advanced & clear the selection.
     * 
     * @param previousProps previous component properties, including turn color
     */
    public override componentDidUpdate(previousProps: Readonly<BoardProps>): void {
        if (previousProps.currTurnColor !== this.props.currTurnColor) {
            this.resetState();
        }
    }

    private static initialState(): BoardState {
        return {
            from: [NaN, NaN],
            moveType: "Normal",
            pathMap: () => [],
            placeholders: {},
            tileShake: [NaN, NaN],
            to: [NaN, NaN]
        };
    }

    private resetState(): void { this.setState(Board.initialState()); }

    /**
     * Update state to trigger addition of a class to specified piece tile which in
     * turn causes it to shake. This is used to indicate an invalid tile selection.
     * 
     * @param pos position of tile to apply shake animation to
     */
    private shakeTile(pos: LatticeCoords): void {
        this.setState(
            { tileShake: [NaN, NaN] },
            () => this.setState({ tileShake: pos })
        );
    }

    private handlePlaceholderClick = (attemptMove: DoMoveFn, pos: LatticeCoords) => {
        const { from } = this.state;
        if (from) {
            const piece = this.props.piecePositions[from.join(",")];
            if (piece) attemptMove(piece, pos);
            else {
                // TODO should never be reachable; still, show error to user
                console.error("Piece to move is no longer in its expected starting location.");
            }
            this.resetState();
        }
    };
    private handlePlaceholderHover = (pos: LatticeCoords, type: MovementType) =>
        this.setState({ moveType: type, to: pos });

    /**
     * Render move path & tile for each active placeholder, as long as board is interactive.
     * 
     * @param props props of this component, containing interactivity callbacks
     * @returns Fragment containing move path & child Tile for each placeholder on board
     */
    private renderPlaceholdersAndPath(props: BoardProps): h.JSX.Element | undefined {
        if (!props.interactivity) return;

        const { to, pathMap, moveType: pathMapType } = this.state;
        const { attemptMove } = props.interactivity;
        const movePath = "M" + [to].concat(pathMap(to))
            .map(p => ConvertCoords.hexLatticeToSVG(hexDims.gap, ...p).join(","))
            .join("L");

        return (
            <Fragment>
                {HexGrid.entriesOfPosRecord(this.state.placeholders).map(([pos, type]) => (
                    <Placeholder
                        key={`${pos.join(",")}${type}`}
                        pos={ConvertCoords.hexLatticeToSVG(hexDims.gap, ...pos)}
                        handleClick={this.handlePlaceholderClick.bind(this, attemptMove, pos)}
                        handleMouseEnter={this.handlePlaceholderHover.bind(this, pos, type)}
                        type={type}
                    />
                ))}
                <path class={`move-path ${pathMapType}`} d={movePath} />
            </Fragment>
        );
    }

    private handlePieceTileClick = (getMoves: GetMoveFn, piece: Piece, pos: LatticeCoords) => {
        const { from } = this.state;
        if (isNaN(from[0])) { // clicking unselected piece
            const { outcome } = getMoves(piece); // TODO does not distinguish premoves
            if (outcome.status === "Success") {
                const { pathMap, options } = outcome;
                this.setState({ from: pos, pathMap, placeholders: options, tileShake: [NaN, NaN] });
            } else {
                this.shakeTile(pos);
                console.error(`No legal moves; getMoves() returned message: ${outcome.message}`);
            }
        } else if (HexGrid.eqPos(pos, from)) this.resetState();
    };

    /**
     * Render tiles for each of the current game pieces.
     * 
     * @param props props of this component, containing current piece tile positions
     * @returns Fragment containing a child Tile for each piece tile on the board
     */
    private renderPieceTiles(props: BoardProps): h.JSX.Element {
        const { from, tileShake } = this.state;
        return (
            <Fragment>{
                HexGrid.entriesOfPosRecord(props.piecePositions).map(([pos, piece]) => {
                    let state: PieceTileState = "Inactive";
                    if (props.interactivity) {
                        if (HexGrid.eqPos(pos, tileShake)) state = "Shaking";
                        else if (HexGrid.eqPos(pos, from)) state = "Selected";
                        else if (isNaN(from[0])) state = "Normal";
                    }

                    // key changes for shaking tiles to force remount (needed to restart CSS animations)
                    // see: https://css-tricks.com/restart-css-animation/
                    const key = `${Notation.pieceToString(piece)}${state === "Shaking" ? "~" : ""}`;
                    const handleClick = props.interactivity &&
                        this.handlePieceTileClick.bind(this, props.interactivity.getMoves, piece, pos);

                    return (
                        <PieceTile
                            // TODO without key, all pieces transition at once, but with one nothing transitions
                            key={key}
                            piece={piece}
                            pos={ConvertCoords.hexLatticeToSVG(hexDims.gap, ...pos)}
                            handleClick={handleClick}
                            state={state}
                        />
                    );
                })
            }</Fragment>
        );
    }

    public override render(props: BoardProps): h.JSX.Element {
        return (
            <TileContainer
                viewRange={5.3}
                panAndZoom={true}
                hexDims={hexDims}
            >
                {this.renderPieceTiles(props)}
                {this.renderPlaceholdersAndPath(props)}
            </TileContainer>
        );
    }
}