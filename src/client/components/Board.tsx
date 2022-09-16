import { Component, createRef, Fragment, h, RefObject } from "preact";

import "@/client/styles/Board";

import type { LatticeCoords, PosToPiece } from "@/types/common/game/hexGrid";
import type { MoveGenerator } from "@/types/common/game/game";
import type { PathMap } from "@/types/common/game/graph";
import type { Piece } from "@/types/common/piece";

import GraphUtils from "@/common/game/graph";
import HexGrid from "@/common/game/hexGrid";
import Notation from "@/client/utility/notation";


import type { MoveAvailability } from "@/client/components/GameContainer";
import type { HexDimensions } from "@/client/components/TileDefs";

import Placeholder from "@/client/components/Placeholder";
import PieceTile, { PieceTileState } from "@/client/components/PieceTile";
export type ScreenCoords = [number, number];

export interface BoardProps {
    // board layout
    piecePositions: PosToPiece;

    // interactivity
    interactable: boolean;
    checkForMove: (piece: Piece) => MoveAvailability;
    getMoves: (piece: Piece, viaPillbug: boolean) => MoveGenerator;
    doMove: (piece: Piece, destination: LatticeCoords) => void;
}

interface BoardState {
    dimensions: { // screen dimensions of rendered board
        height: number;
        width: number;
    };
    movePreview: { // selecting piece & previewing move
        from: LatticeCoords;
        to: LatticeCoords;
        viaPillbug: boolean;
        pathMap: PathMap<LatticeCoords>;
        placeholders: {
            [pos: string]: boolean; // true/false represent pillbug/normal placeholder
        };
        tileShake: LatticeCoords;
    };
    transform: { // pan & zoom tracking
        pan: ScreenCoords;
        dragging: boolean;
        zoom: number;
    };
}

// TODO determine this based on screen size, or make it a setting
const defaultHexRadius = 90;
const hexDimensions: HexDimensions = {
    cornerRad: defaultHexRadius / 6,
    gap: defaultHexRadius / 18,
    radius: defaultHexRadius
};

export default class Board extends Component<BoardProps, BoardState> {
    // reference to the SVG tag for calculating board dimensions
    private boardRef: RefObject<SVGSVGElement> = createRef();

    // precalculated quantities
    private horSpacing: number;
    private vertSpacing: number;

    public constructor() {
        super();
        this.state = {
            dimensions: {
                height: 666,
                width: 1920
            },
            movePreview: {
                from: [NaN, NaN],
                pathMap: () => [],
                placeholders: {},
                tileShake: [NaN, NaN],
                to: [NaN, NaN],
                viaPillbug: false
            },
            transform: {
                dragging: false,
                pan: [0, 0],
                zoom: 1
            }
        };

        // calculate tile spacings
        const radPlusGap = hexDimensions.radius + hexDimensions.gap;
        this.horSpacing = Math.sqrt(3) * radPlusGap;
        this.vertSpacing = 1.5 * radPlusGap;
    }

    /**
     * When the component has mounted, find the size of the svg tag's bounding rectangle & save this
     * in the state.
     */
    public override componentDidMount(): void {
        if (this.boardRef.current) {
            const { width, height } = this.boardRef.current.getBoundingClientRect();
            this.setState({ dimensions: { height, width } });
        }
    }

    public override componentDidUpdate(prevProps: Readonly<BoardProps>): void {
        // TODO clear the selection IF AND ONLY IF the board position has changed
        // TODO this is going to be inefficient to test every time though...
        // this.clearSelection();
    }

    /**
     * Convert between lattice coordinates - integer coefficients for lattice base vectors
     * (joining centers of adjacent hexagons lying along the horizontal and along a pi/3 elevation),
     * and screen-space xy-coordinates used by SVG.
     * 
     * @param u coefficient of horizontal lattice base vector
     * @param v coefficient of lattice base vector along pi/3 elevation
     * @returns position of tile in SVG rectilinear coordinates
     */
    private convertCoordinates(u: number, v: number): ScreenCoords {
        const { width, height } = this.state.dimensions;
        return [
            this.horSpacing * (u + v / 2) + width / 2,
            this.vertSpacing * v + height / 2
        ];
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
            const { pathMap, placeholders } = state.movePreview;
            return {
                movePreview: {
                    ...state.movePreview,
                    pathMap: GraphUtils.mergePathMaps(pathMap, newPathMap),
                    // older (non-pillbug) placeholders take preference here:
                    placeholders: { ...newPlaceholders, ...placeholders }
                }
            };
        });

        return hasLegalMoves;
    }

    /**
     * Reset selection, delete all placeholders, reset movement paths, and clear selection outline.
     */
    private clearSelection(): void {
        this.setState((state: BoardState) => ({
            movePreview: {
                ...state.movePreview,
                from: [NaN, NaN],
                pathMap: () => [],
                placeholders: {},
                to: [NaN, NaN]
            }
        }));
    }

    /**
     * Update transform-related state (pan & zoom) according to given values.
     * 
     * @param panDelta increment to add to current pan 
     * @param newZoom value to which to set zoom
     */
    private updateTransform(panDelta: [number, number], newZoom?: number): void {
        this.setState((state: BoardState) => {
            const { pan, zoom } = state.transform;
            pan[0] += panDelta[0];
            pan[1] += panDelta[1];
            return {
                transform: { ...state.transform, pan, zoom: newZoom || zoom }
            };
        });
    }

    /**
     * Update transform-related state (pan & zoom) to handle scrolling event (zooming).
     * We also update pan in order to have zoom be centered on the cursor.
     * 
     * @param e wheel event representing user scrolling to adjust zoom
     */
    private handleZoom(e: WheelEvent): void {
        e.preventDefault();

        const { pan, zoom } = this.state.transform;
        const nextZoom = Math.min(Math.max(0.25, zoom + e.deltaY * -0.0005), 2);
        const ratio = 1 - nextZoom / zoom;

        this.updateTransform([
            (e.clientX - pan[0]) * ratio,
            (e.clientY - pan[1]) * ratio
        ], nextZoom);
    }

    private shakeTile(pos: LatticeCoords): void {
        this.setState(
            (state: BoardState) => ({
                movePreview: { ...state.movePreview, tileShake: [NaN, NaN] }
            }),
            () => this.forceUpdate()
        );
        this.setState(
            (state: BoardState) => ({
                movePreview: { ...state.movePreview, tileShake: pos }
            }),
            () => this.forceUpdate()
        );
    }

    private handlePlaceholderClick = (pos: LatticeCoords) => {
        const { from } = this.state.movePreview;
        if (from) {
            const piece = this.props.piecePositions[from.join(",")];
            if (piece) {
                this.props.doMove(piece, pos);
                this.clearSelection();
            } else {
                // TODO this should never be reachable, but currently is, when:
                // 1. p1 clicks their piece next to p2's pillbug for premove
                // 2. p2 uses their move to move p1's piece (invalidating 'from' on p1's side)
                // 3. p1 clicks the (now-redundant) placeholder
                // Show error to user (and patch the above specific case)
                console.error("Piece to move is no longer in its expected starting location.");
            }
        }
    };
    private handlePlaceholderHover = (pos: LatticeCoords, viaPillbug: boolean) => {
        this.setState((state: BoardState) => ({
            movePreview: { ...state.movePreview, to: pos, viaPillbug }
        }));
    };

    /**
     * Render tiles for each of the active placeholders.
     * 
     * @returns Fragment containing a child Tile for each placeholder on the board
     */
    private renderPlaceholders(): h.JSX.Element {
        return (
            <Fragment>{
                Object.entries(this.state.movePreview.placeholders).map(([posStr, viaPillbug]) => {
                    const pos = posStr.split(",").map(str => parseInt(str)) as LatticeCoords;
                    return (
                        <Placeholder
                            key={`${posStr}${viaPillbug ? "pillbug" : ""}`} // TODO sensible key?
                            size={hexDimensions}
                            pos={this.convertCoordinates(...pos)}
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
        const { from } = this.state.movePreview;
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
            if (hasLegalMoves) {
                this.setState((state: BoardState) => ({
                    movePreview: { ...state.movePreview, from: pos }
                }));
            } else {
                this.shakeTile(pos);
                console.error(`No legal moves: ${outcome}`);
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
        // TODO PosToPiece only records the topmost piece in a stack
        // we should probably also render the ones below
        const { from, tileShake } = this.state.movePreview;
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

                    return (
                        <PieceTile
                            // TODO without this, all pieces animate at once, but with it nothing animates:
                            key={Notation.pieceToString(piece)}
                            size={hexDimensions}
                            piece={piece}
                            pos={this.convertCoordinates(...pos)}
                            handleClick={this.handlePieceTileClick.bind(this, piece, pos)}
                            state={state}
                        />
                    );
                })
            }</Fragment>
        );
    }

    private getMouseHandler = (updateDragging: (button: number, oldDragging: boolean) => boolean) =>
        (e: MouseEvent) => this.setState((state: BoardState) => ({
            transform: {
                ...state.transform,
                dragging: updateDragging(e.button, state.transform.dragging)
            }
        }));
    private handleMouseDown = this.getMouseHandler((b, d) => d || b <= 1);
    private handleMouseUp = this.getMouseHandler((b, d) => d && b > 1);
    private handleMouseLeave = this.getMouseHandler(() => false);
    private handleMouseMove = (e: MouseEvent) => {
        if (this.state.transform.dragging)
            this.updateTransform([e.movementX, e.movementY]);
    };

    public override render(props: BoardProps): h.JSX.Element {
        const { pan, zoom } = this.state.transform;
        const { to, pathMap } = this.state.movePreview;
        const movePath = "M" + [to].concat(pathMap(to))
            .map(p => this.convertCoordinates(...p).join(",")).join("L");

        return (
            <svg
                id="board"
                width="100%"
                height="100%"
                ref={this.boardRef}
                onMouseDown={this.handleMouseDown.bind(this)}
                onMouseUp={this.handleMouseUp.bind(this)}
                onMouseLeave={this.handleMouseLeave.bind(this)}
                onMouseMove={this.handleMouseMove.bind(this)}
                onWheel={this.handleZoom.bind(this)}
            >
                <g transform={`translate(${pan.join(",")})scale(${zoom})`}>
                    {this.renderPieceTiles(props)}
                    {this.renderPlaceholders()}
                    <path
                        class={`move-path ${this.state.movePreview.viaPillbug ? "pillbug" : ""}`}
                        d={movePath}
                    />
                </g>
            </svg>
        );
    }
}