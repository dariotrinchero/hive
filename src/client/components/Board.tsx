// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Component, createRef, Fragment, h, RefObject } from "preact";

import "@/client/styles/Board";

import type { ScreenCoords, SelectedPiece } from "@/types/client/board";
import type { LatticeCoords, PosToPiece } from "@/types/common/game/hexGrid";
import type { MoveGenerator } from "@/types/common/game/game";
import type { PathMap } from "@/types/common/game/graph";
import type { Piece } from "@/types/common/piece";
import type { MoveAvailability } from "@/client/sockets/gameClient";

import GraphUtils from "@/common/game/graph";

import Tile, { HexDimensions, PieceTileState } from "@/client/components/Tile";

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
        from: SelectedPiece;
        to: LatticeCoords;
        viaPillbug: boolean;
        pathMap: PathMap<LatticeCoords>;
        placeholders: { [pos: string]: boolean; };
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
                from: null,
                pathMap: () => [],
                placeholders: {},
                to: [0, 0],
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
     * Call appropriate methods to retrieve all legal moves for given piece (either using or ignoring special
     * power of an adjacent pillbug, as specified); record a placeholder at each legal move destination, and
     * merge legal move paths with global PathMap object; finally, return whether any legal moves were found.
     * 
     * @param piece piece for which to process legal moves
     * @param viaPillbug if true/false, check for moves specifically using/ignoring pillbug special ability
     * @returns whether any legal moves were found (and processed)
     */
    private processMoves(piece: Piece, viaPillbug: boolean): boolean {
        const { placeholders, pathMap } = this.state.movePreview;

        const generator = this.props.getMoves(piece, viaPillbug);
        let next = generator.next();
        let hasLegalMoves = false;
        while (!next.done) {
            const posStr: string = next.value.join(",");
            if (typeof placeholders[posStr] === "undefined") placeholders[posStr] = viaPillbug;
            hasLegalMoves = true;
            next = generator.next();
        }

        this.setState({
            movePreview: {
                ...this.state.movePreview,
                pathMap: GraphUtils.mergePathMaps(pathMap, next.value),
                placeholders
            }
        });
        return hasLegalMoves;
    }

    /**
     * Reset selection, delete all placeholders, reset movement paths, and clear selection outline.
     */
    private clearSelection(): void {
        this.setState({
            movePreview: {
                ...this.state.movePreview,
                from: null,
                pathMap: () => [],
                placeholders: {}
            }
        });
    }

    /**
     * Update transform-related state (pan & zoom) according to given values.
     * 
     * @param panDelta increment to add to current pan 
     * @param newZoom value to which to set zoom
     */
    private updateTransform(panDelta: [number, number], newZoom?: number): void {
        const { pan, zoom } = this.state.transform;
        pan[0] += panDelta[0];
        pan[1] += panDelta[1];

        this.setState({
            transform: { ...this.state.transform, pan, zoom: newZoom || zoom }
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

    /**
     * Render tiles for each of the active placeholders.
     * 
     * @returns Fragment containing a child Tile for each placeholder on the board
     */
    private renderPlaceholders(): h.JSX.Element {
        const placeholderClick = (pos: LatticeCoords) => {
            if (this.state.movePreview.from) {
                this.props.doMove(this.state.movePreview.from.piece, pos);
                this.clearSelection();
            }
        };
        const placeholderHover = (pos: LatticeCoords, viaPillbug: boolean) => {
            this.setState({
                movePreview: { ...this.state.movePreview, to: pos, viaPillbug }
            });
        };

        return (
            <Fragment>{
                Object.entries(this.state.movePreview.placeholders).map(([posStr, viaPillbug]) => {
                    const pos = posStr.split(",").map(str => parseInt(str)) as LatticeCoords;
                    return (
                        <Tile
                            size={hexDimensions}
                            tile={{ type: "Placeholder", viaPillbug }}
                            pos={this.convertCoordinates(...pos)}
                            handleClick={placeholderClick.bind(this, pos)}
                            handleMouseEnter={placeholderHover.bind(this, pos, viaPillbug)}
                        />
                    );
                })
            }</Fragment>
        );
    }

    /**
     * Render tiles for each of the current game pieces.
     * 
     * @param props props of this component, containing current piece tile positions
     * @returns Fragment containing a child Tile for each piece tile on the board
     */
    private renderPieceTiles(props: BoardProps): h.JSX.Element {
        const isSelected = (pos: LatticeCoords) =>
            this.state.movePreview.from?.pos[0] === pos[0]
            && this.state.movePreview.from.pos[1] === pos[1];

        const pieceTileClick = (piece: Piece, pos: LatticeCoords) => {
            if (!this.state.movePreview.from) {
                // process legal moves if any exist
                const { outcome } = this.props.checkForMove(piece); // TODO this does not distinguish premoves
                let hasLegalMoves = false;
                if (outcome === "Success" || outcome === "OnlyByPillbug") {
                    if (outcome === "Success" && this.processMoves(piece, false)) hasLegalMoves = true;
                    if (this.processMoves(piece, true)) hasLegalMoves = true;
                }

                // select tile if it has legal moves
                if (hasLegalMoves) {
                    this.setState({
                        movePreview: { ...this.state.movePreview, from: { piece, pos } }
                    });
                } else {
                    // this.shakeTile(handle); // TODO trigger CSS animation
                    console.error(`No legal moves: ${outcome}`);
                }
            } else if (isSelected(pos)) this.clearSelection();
        };

        // TODO PosToPiece only records the topmost piece in a stack
        // we should probably also render the ones below
        return (
            <Fragment>{
                Object.entries(props.piecePositions).map(([posStr, piece]) => {
                    // TODO this next line is duplicated a lot across the codebase
                    const pos = posStr.split(",").map(str => parseInt(str)) as LatticeCoords;

                    let state: PieceTileState = "Inactive";
                    if (props.interactable) {
                        if (isSelected(pos)) state = "Selected";
                        else if (!this.state.movePreview.from) state = "Normal";
                    }

                    return (
                        <Tile
                            size={hexDimensions}
                            tile={{ ...piece, state }}
                            pos={this.convertCoordinates(...pos)}
                            handleClick={pieceTileClick.bind(this, piece, pos)}
                        />
                    );
                })
            }</Fragment>
        );
    }

    public override render(props: BoardProps): h.JSX.Element {
        // panning logic
        const { pan, zoom } = this.state.transform;
        const makeHandler = (newDragging: (b: number) => boolean) =>
            (e: MouseEvent) => this.setState({
                transform: { ...this.state.transform, dragging: newDragging(e.button) }
            });
        const mouseDown = makeHandler(b => this.state.transform.dragging || b <= 1);
        const mouseUp = makeHandler(b => this.state.transform.dragging && b > 1);
        const mouseLeave = makeHandler(() => false);
        const mouseMove = (e: MouseEvent) => {
            if (this.state.transform.dragging)
                this.updateTransform([e.movementX, e.movementY]);
        };

        // move path logic
        const { to, pathMap } = this.state.movePreview;
        const coordMap = (p: LatticeCoords) => this.convertCoordinates(...p).join(",");
        const movePath = `M${coordMap(to)}L` + pathMap(to).map(coordMap).join("L");

        return (
            <svg
                id="board"
                width="100%"
                height="100%"
                ref={this.boardRef}
                onMouseDown={mouseDown}
                onMouseUp={mouseUp}
                onMouseLeave={mouseLeave}
                onMouseMove={mouseMove}
                onWheel={this.handleZoom.bind(this)}
            >
                <g transform={`translate(${pan.join(",")})scale(${zoom})`}>
                    <path
                        class={`move-path ${this.state.movePreview.viaPillbug ? "pillbug" : ""}`}
                        d={movePath}
                    />
                    {this.renderPieceTiles(props)}
                    {this.renderPlaceholders()}
                </g>
            </svg>
        );
    }
}