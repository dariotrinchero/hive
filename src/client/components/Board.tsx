import { Component, Fragment, h } from "preact";

import "@/client/styles/Board";

import type { LatticeCoords, PosToPiece } from "@/types/common/game/hexGrid";
import type { MoveGenerator } from "@/types/common/game/game";
import type { PathMap } from "@/types/common/game/graph";
import type { Piece, PieceColor } from "@/types/common/piece";
import type { HexDimensions } from "@/types/client/tile";

import type { MoveAvailability } from "@/client/components/GameUI";

import GraphUtils from "@/common/game/graph";
import HexGrid from "@/common/game/hexGrid";
import Notation from "@/client/utility/notation";
import ConvertCoords from "@/client/utility/convertCoords";


import Placeholder from "@/client/components/Placeholder";
import PieceTile, { PieceTileState } from "@/client/components/PieceTile";
import TileContainer from "@/client/components/TileContainer";

export interface BoardProps {
    // board layout
    piecePositions: PosToPiece;
    currTurnColor: PieceColor;

    // interactivity
    interactable: boolean;
    checkForMove: (piece: Piece) => MoveAvailability;
    getMoves: (piece: Piece, viaPillbug: boolean) => MoveGenerator;
    doMove: (piece: Piece, destination: LatticeCoords) => void;
}

interface BoardState {
    from: LatticeCoords;
    to: LatticeCoords;
    viaPillbug: boolean;
    pathMap: PathMap<LatticeCoords>;
    placeholders: {
        [pos: string]: boolean; // true/false represent pillbug/normal placeholder
    };
    tileShake: LatticeCoords;
}

// TODO make this into a setting
const hexDims: HexDimensions = { cornerRad: 100 / 6, gap: 100 / 18 };

export default class Board extends Component<BoardProps, BoardState> {
    // precalculated quantities
    private horSpacing: number;
    private vertSpacing: number;

    public constructor() {
        super();
        this.state = Board.initialState();

        // calculate tile spacings
        const radPlusGap = 1 + hexDims.gap; // hex radius always fixed to 1
        this.horSpacing = Math.sqrt(3) * radPlusGap;
        this.vertSpacing = 1.5 * radPlusGap;
    }

    private static initialState(): BoardState {
        return {
            from: [NaN, NaN],
            pathMap: () => [],
            placeholders: {},
            tileShake: [NaN, NaN],
            to: [NaN, NaN],
            viaPillbug: false
        };
    }

    /**
     * Detect when the turn has advanced & clear the selection.
     * 
     * @param previousProps previous component properties, including turn color
     */
    public override componentDidUpdate(previousProps: Readonly<BoardProps>): void {
        if (previousProps.currTurnColor !== this.props.currTurnColor) {
            this.clearSelection();
        }
    }

    /**
     * Call appropriate methods to retrieve all legal moves for given piece (either using or ignoring
     * special power of an adjacent pillbug, as specified); record a placeholder at each legal move 
     * destination, and merge legal move paths with global PathMap object; finally, return whether any 
     * legal moves were found.
     * 
     * @param piece piece for which to process legal moves
     * @param viaPillbug if true/false, check for moves specifically using/ignoring pillbug ability
     * @returns whether any legal moves were found (and processed)
     */
    private processMoves(piece: Piece, viaPillbug: boolean): boolean {
        const newPlaceholders: { [pos: string]: boolean; } = {};

        const generator = this.props.getMoves(piece, viaPillbug);
        let next = generator.next();
        let hasLegalMoves = false;
        while (!next.done) {
            const posStr: string = next.value.join(",");
            if (typeof newPlaceholders[posStr] === "undefined") newPlaceholders[posStr] = viaPillbug;
            hasLegalMoves = true;
            next = generator.next();
        }
        const newPathMap: PathMap<LatticeCoords> = next.value;

        this.setState((state: BoardState) => {
            const { pathMap, placeholders } = state;
            return {
                pathMap: GraphUtils.mergePathMaps(pathMap, newPathMap),
                // older (non-pillbug) placeholders take preference here:
                placeholders: { ...newPlaceholders, ...placeholders }
            };
        });

        return hasLegalMoves;
    }

    /**
     * Reset selection & movement path, and clear all placeholders.
     */
    private clearSelection(): void {
        this.setState(Board.initialState());
    }

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

    private handlePlaceholderClick = (pos: LatticeCoords) => {
        const { from } = this.state;
        if (from) {
            const piece = this.props.piecePositions[from.join(",")];
            if (piece) this.props.doMove(piece, pos);
            else {
                // TODO should never be reachable; still, show error to user
                console.error("Piece to move is no longer in its expected starting location.");
            }
            this.clearSelection();
        }
    };
    private handlePlaceholderHover = (pos: LatticeCoords, viaPillbug: boolean) => {
        this.setState({ to: pos, viaPillbug });
    };

    /**
     * Render tiles for each of the active placeholders.
     * 
     * @returns Fragment containing a child Tile for each placeholder on the board
     */
    private renderPlaceholders(): h.JSX.Element {
        return (
            <Fragment>{
                Object.entries(this.state.placeholders).map(([posStr, viaPillbug]) => {
                    const pos = posStr.split(",").map(str => parseInt(str)) as LatticeCoords;
                    return (
                        <Placeholder
                            key={`${posStr}${viaPillbug ? "pillbug" : ""}`}
                            pos={ConvertCoords.hexLatticeToSVG(hexDims.gap, ...pos)}
                            handleClick={this.handlePlaceholderClick.bind(this, pos)}
                            handleMouseEnter={this.handlePlaceholderHover.bind(this, pos, viaPillbug)}
                            viaPillbug={viaPillbug}
                        />
                    );
                })
            }</Fragment>
        );
    }

    private handlePieceTileClick = (piece: Piece, pos: LatticeCoords) => {
        const { from } = this.state;
        if (isNaN(from[0])) {
            // process legal moves if any exist
            const { outcome } = this.props.checkForMove(piece); // TODO does not distinguish premoves
            let hasLegalMoves = false;
            if (outcome === "Success" || outcome === "OnlyByPillbug") {
                if (outcome === "Success") {
                    if (this.processMoves(piece, false)) hasLegalMoves = true;
                }
                if (this.processMoves(piece, true)) hasLegalMoves = true;
            }

            // select tile if it has legal moves
            if (hasLegalMoves) this.setState({ from: pos, tileShake: [NaN, NaN] });
            else {
                this.shakeTile(pos);
                console.error(`No legal moves. Piece may move: ${outcome}`);
            }
        } else if (HexGrid.eqPos(pos, from)) this.clearSelection();
    };

    /**
     * Render tiles for each of the current game pieces.
     * 
     * @param props props of this component, containing current piece tile positions
     * @returns Fragment containing a child Tile for each piece tile on the board
     */
    private renderPieceTiles(props: BoardProps): h.JSX.Element {
        // TODO PosToPiece only records topmost piece in stack; we should render the others
        const { from, tileShake } = this.state;
        return (
            <Fragment>{
                Object.entries(props.piecePositions).map(([posStr, piece]) => {
                    // TODO this next line is duplicated a lot across the codebase
                    const pos = posStr.split(",").map(str => parseInt(str)) as LatticeCoords;

                    let state: PieceTileState = "Inactive";
                    if (props.interactable) {
                        if (HexGrid.eqPos(pos, tileShake)) state = "Shaking";
                        else if (HexGrid.eqPos(pos, from)) state = "Selected";
                        else if (isNaN(from[0])) state = "Normal";
                    }

                    // key changes for shaking tiles to force remount (needed to restart CSS animations)
                    // see: https://css-tricks.com/restart-css-animation/
                    const key = `${Notation.pieceToString(piece)}${state === "Shaking" ? "~" : ""}`;

                    return (
                        <PieceTile
                            // TODO without key, all pieces transition at once, but with one nothing transitions
                            key={key}
                            strokeWidth={hexDims.gap * Math.sqrt(3)}
                            piece={piece}
                            pos={ConvertCoords.hexLatticeToSVG(hexDims.gap, ...pos)}
                            handleClick={this.handlePieceTileClick.bind(this, piece, pos)}
                            state={state}
                        />
                    );
                })
            }</Fragment>
        );
    }

    public override render(props: BoardProps): h.JSX.Element {
        const { to, pathMap, viaPillbug } = this.state;
        const movePath = "M" + [to].concat(pathMap(to))
            .map(p => ConvertCoords.hexLatticeToSVG(hexDims.gap, ...p).join(","))
            .join("L");

        return (
            <TileContainer
                initViewboxBound={5}
                panAndZoom={true}
                hexDims={hexDims}
            >
                {this.renderPieceTiles(props)}
                {this.renderPlaceholders()}
                <path
                    class={`move-path ${viaPillbug ? "pillbug" : ""}`}
                    d={movePath}
                />
            </TileContainer>
        );
    }
}