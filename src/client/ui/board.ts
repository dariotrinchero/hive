import { select, selectAll } from "d3-selection";
import { easeCubic, easeLinear } from "d3-ease";
import "d3-transition";

import type GameClient from "@/client/sockets/gameClient";
import Notation from "@/client/ui/notation";
import * as icons from "@/client/ui/icons.json";

import type { Piece, PieceColor, PieceType } from "@/types/common/piece";
import type { LatticeCoords } from "@/types/common/game/hexGrid";
import type { ScreenCoords, Sel, SelectedPiece } from "@/types/client/board";
import type { PathMap } from "@/types/common/game/graph";
import GraphUtils from "@/common/game/graph";

const bugColors: Record<PieceType, string> = {
    Ant: "#0fa9f0",
    Beetle: "#8779b9",
    Grasshopper: "#2fbc3d",
    Ladybug: "#d72833",
    Mosquito: "#a6a6a6",
    Pillbug: "#49ad92",
    QueenBee: "#fcb336",
    Spider: "#9f622d"
};
const tileColors: Record<PieceColor, string> = {
    Black: "#363430",
    White: "#f3ecde"
};

export default class Board {
    // static lookup-tables
    private static bugScales: Record<PieceType, number> = {
        // ratio of bugHeight/hexRadius which looks best for each bug
        Ant: 1.29981,
        Beetle: 1.50629,
        Grasshopper: 1.60499,
        Ladybug: 1.21203,
        Mosquito: 1.53148,
        Pillbug: 1.40370,
        QueenBee: 1.02462,
        Spider: 1.52296
    };
    private static colors = {
        bug: bugColors,
        outline: {
            base: "none",
            hover: "#e50bbd99",
            selected: "#b80fc7"
        },
        path: {
            base: "#b80fc755",
            pillbug: "#46a088bb"
        },
        placeholder: {
            base: "#e50bbd77",
            hover: "#e50bbd33",
            pillbug: "#49ad92bb",
            pillbugHover: "#49ad9277"
        },
        tile: tileColors
    };

    private playArea: Sel<SVGGElement>;
    private gameClient: GameClient;

    // user-defined dimensions
    private hexRadius: number;
    private hexRadGap: number;

    // precalculated quantities
    private width: number;
    private height: number;
    private horSpacing: number;
    private vertSpacing: number;

    // selection tracking
    private interactable = true;
    private selectedPiece: SelectedPiece = null;
    private placeholderSet: { [pos: string]: boolean; } = {};
    private movePaths: PathMap<LatticeCoords> = () => [];
    private movePathHandle: Sel<SVGPathElement>;

    // pan & zoom tracking
    private pan: ScreenCoords = [0, 0];
    private dragging = false;
    private zoom = 1;

    public constructor(
        gameClient: GameClient,
        hexRadius: number,
        cornerRad: number,
        hexRadGap: number,
    ) {
        // set user-defined fields
        this.gameClient = gameClient;
        this.hexRadius = hexRadius;
        this.hexRadGap = hexRadGap;

        // create containers
        const svgContainer = select("body")
            .append("svg")
            .attr("width", "100%")
            .attr("height", "100%");
        this.bindPanAndZoom(svgContainer);
        this.playArea = svgContainer.append("g");

        // define bug icon paths
        const defs = svgContainer.append("defs");
        Object.entries(icons).forEach(([bug, path]) =>
            defs.append("path")
                .attr("id", bug)
                .attr("d", path));

        // define rounded hex path & placeholder
        Board.defineRoundedHex(defs, hexRadius, cornerRad);
        Board.definePlaceholder(defs, 0.6 * hexRadGap);

        // create element for bug movement paths
        this.movePathHandle = this.createMovePath(8, 2000);

        // precalculate other dimensions
        const playAreaBBox = svgContainer.node()?.getBoundingClientRect();
        this.width = playAreaBBox?.width || 1920;
        this.height = playAreaBBox?.height || 666;
        this.horSpacing = Math.sqrt(3) * (hexRadius + hexRadGap);
        this.vertSpacing = 1.5 * (hexRadius + hexRadGap);
    }

    /**
     * Add definition for hexagon of given radius, with rounded corners of given radius, to given
     * SVG 'defs' element for later reference by ID "hex".
     *
     * @param defs SVG defs element to which to append rounded hex definition
     * @param hexRad radius of circle in which un-rounded hexagon fits snugly
     * @param cornerRad radius of circle arcs to use for rounding corners (cuts off corner)
     */
    private static defineRoundedHex(defs: Sel<SVGDefsElement>, hexRad: number, cornerRad: number): void {
        const thirdPi: number = Math.PI / 3;
        const innerRad: number = hexRad - 2 * cornerRad / Math.sqrt(3);

        let hexPath = "";
        for (let i = 0; i < 6; i++) {
            const theta: number = i * thirdPi;
            const [[x1, y1], [x2, y2]] = [1, -1].map((d: number) => [
                innerRad * Math.sin(theta) + cornerRad * Math.sin(theta - d * thirdPi / 2),
                innerRad * Math.cos(theta) + cornerRad * Math.cos(theta - d * thirdPi / 2)
            ]);

            hexPath += `${i ? "L" : "M"}${x1},${y1}` // move/line to (x1,y1)
                + `A${cornerRad},${cornerRad},0,0,0,${x2},${y2}`; // arc to (x2,y2)
        }
        hexPath += "Z"; // close path

        defs.append("path")
            .attr("id", "hex")
            .attr("d", hexPath);
    }

    /**
     * Add definition of placeholders to given SVG 'defs' element for later reference by ID "placeholder".
     * 
     * @param defs SVG defs element to which to append placeholder definition
     * @param strokeWidth stroke width to use for placeholders
     */
    private static definePlaceholder(defs: Sel<SVGDefsElement>, strokeWidth: number): void {
        const groupHandle = defs.append("g")
            .attr("id", "placeholder")
            .style("stroke-width", `${strokeWidth}px`);
        [0.95, 0.6].forEach((scale, index) => {
            const outline = groupHandle.append("use")
                .attr("xlink:href", "#hex")
                .attr("transform", `scale(${scale})`);
            if (index === 0) outline.style("stroke-dasharray", "8,4");
        });
    }

    /**
     * Create SVG path element for use in displaying movement paths of bug tiles; configure dash animation
     * on this path; add path to play area; finally, return path.
     * 
     * @param strokeWidth stroke width of path
     * @param animDuration duration for animation of dashes 'sliding' along path
     * @returns handle for newly-created path element
     */
    private createMovePath(strokeWidth: number, animDuration: number): Sel<SVGPathElement> {
        const dashLen: [number, number] = [16, 12];
        const pathHandle = this.playArea.append("path")
            .style("fill", "none")
            .style("stroke-width", `${strokeWidth}px`)
            .style("stroke-dasharray", dashLen.join(","))
            .style("pointer-events", "none");

        const animate = () => pathHandle
            .transition()
            .ease(easeLinear)
            .duration(animDuration)
            .styleTween("stroke-dashoffset", () => t => `${t * (dashLen[0] + dashLen[1])}`)
            .on("end", animate);
        animate();
        return pathHandle;
    }

    /**
     * Create event bindings on given SVG container that react to zooming via scroll wheel and panning via
     * clicking and dragging.
     * 
     * @param svgContainer SVG container on which to create bindings
     */
    private bindPanAndZoom(svgContainer: Sel<SVGSVGElement>): void {
        svgContainer.on("mousedown", (e: MouseEvent) => this.dragging ||= e.button <= 1);
        svgContainer.on("mouseup", (e: MouseEvent) => this.dragging &&= e.button > 1);
        svgContainer.on("mouseleave", () => this.dragging = false);

        svgContainer.on("mousemove", (e: MouseEvent) => {
            if (this.dragging) {
                this.pan[0] += e.movementX;
                this.pan[1] += e.movementY;
                this.playArea.attr("transform", `translate(${this.pan[0]},${this.pan[1]})scale(${this.zoom})`);
            }
        });

        svgContainer.on("wheel", (e: WheelEvent) => {
            e.preventDefault();

            // limit zoom between 0.25 and 2
            let nextZoom = this.zoom + e.deltaY * -0.0005;
            nextZoom = Math.min(Math.max(0.25, nextZoom), 2);

            // math to center zoom on cursor
            const ratio = 1 - nextZoom / this.zoom;
            this.zoom = nextZoom;
            this.pan[0] += (e.clientX - this.pan[0]) * ratio;
            this.pan[1] += (e.clientY - this.pan[1]) * ratio;
            this.playArea.attr("transform", `translate(${this.pan[0]},${this.pan[1]})scale(${this.zoom})`);
        });
    }

    /**
     * Set global flag which determines whether the board is interactable or not - that is, whether tiles
     * / placeholders can be clicked.
     * 
     * @param interactable whether board is interactable
     */
    public setInteractable(interactable: boolean): void {
        this.interactable = interactable;
        if (!interactable) this.clearSelection();
    }

    /**
     * Spawn tile representing given piece at given location.
     *
     * @param piece piece (color & insect-type) which tile should represent
     * @param pos position of tile in lattice coordinates
     */
    public spawnTile(piece: Piece, pos: LatticeCoords): void {
        this.clearSelection();

        // spawn tile
        const [x, y] = this.convertCoordinates(...pos);
        const handle = this.playArea
            .append("g")
            .attr("class", "tile")
            .attr("id", Notation.pieceToString(piece))
            .attr("transform", `translate(${x},${y})`);
        handle.append("use")
            .attr("xlink:href", "#hex")
            .style("fill", Board.colors.tile[piece.color])
            .style("stroke-width", `${this.hexRadGap * Math.sqrt(3)}px`);
        if (this.interactable) this.bindTile(handle, piece, pos); // bind mouse events

        // add centered bug icon
        const strokeWidth = piece.type === "Pillbug" ? 1 : 0;
        const bugColor = Board.colors.bug[piece.type];
        const bug = handle.append("use")
            .attr("xlink:href", `#${piece.type}`)
            .style("fill", bugColor)
            .style("stroke", bugColor)
            .style("stroke-width", `${strokeWidth}px`);

        const { height, width } = bug.node()?.getBoundingClientRect() || { height: 120, width: 100 };
        const scale: number = Board.bugScales[piece.type] * this.hexRadius / height;
        bug.attr("transform", `scale(${scale})`
            + `translate(-${width / 2 - 2 * strokeWidth},-${height / 2})scale(${this.zoom})`);
    }

    private bindTile(handle: Sel<SVGGElement>, piece: Piece, pos: LatticeCoords): void {
        const thisIsSelected = () => this.selectedPiece?.pos[0] === pos[0]
            && this.selectedPiece.pos[1] === pos[1];
        const hex = handle.selectChild("use");

        handle.on("mouseenter", () => {
            if (!this.selectedPiece || thisIsSelected()) {
                hex.style("stroke", Board.colors.outline.hover);
                handle.style("cursor", "pointer");
            } else handle.style("cursor", "default");
        });

        handle.on("mouseleave", () => {
            if (!this.selectedPiece) {
                hex.style("stroke", Board.colors.outline.base);
            } else if (thisIsSelected()) {
                hex.style("stroke", Board.colors.outline.selected);
            }
        });

        handle.on("mousedown", (e: MouseEvent) => {
            e.stopImmediatePropagation();
            this.gameClient.cancelPremove();
            // TODO visually clear any premove indicators as well

            if (!this.selectedPiece) {
                // process legal moves if any exist
                const { outcome, premove } = this.gameClient.checkPieceForMove(piece);
                let hasLegalMoves = false;
                if (outcome === "Success" || outcome === "OnlyByPillbug") {
                    if (outcome === "Success") {
                        if (this.processLegalMoves(piece, false, premove)) hasLegalMoves = true;
                    }
                    if (this.processLegalMoves(piece, true, premove)) hasLegalMoves = true;
                }

                // select tile if it has legal moves
                if (hasLegalMoves) {
                    this.selectedPiece = { hex, piece, pos };
                    hex.style("stroke", Board.colors.outline.selected);
                } else {
                    this.shakeTile(handle);
                    console.error(`No legal moves: ${outcome}`);
                }
            } else if (thisIsSelected()) {
                this.clearSelection();
                hex.style("stroke", Board.colors.outline.hover);
            }
        });
    }

    /**
     * Animate tile with given handle to "shake" (rotate back and forth by small increment), to indicate
     * some user error (such as clicking tile with no legal moves).
     * 
     * @param handle selection handle containing tile
     * @param shakes number of full shake cycles to animate
     */
    private shakeTile(handle: Sel<SVGGElement>, shakes?: number): void {
        const transform = handle.attr("transform");
        let iterations = shakes || 3;
        const animate = () => {
            if (iterations-- > 0) handle.transition()
                .duration(90)
                .attrTween("transform", () => t => `${transform} rotate(${5.5 * Math.sin(t * Math.PI)})`)
                .on("end", animate);
            else handle.attr("transform", transform);
        };
        if (!transform.match(/rotate/g)) animate();
    }

    /**
     * Call appropriate methods to retrieve all legal moves for given piece (either using or ignoring special
     * power of an adjacent pillbug, as specified); spawn a placeholder at each legal move destination, and
     * merge legal move paths with global PathMap object; finally, return whether any legal moves were found.
     * 
     * @param piece piece for which to process legal moves
     * @param viaPillbug if true/false, check for moves specifically using/ignoring pillbug special ability
     * @param premove whether moves are being considered out-of-turn as premoves
     * @returns whether any legal moves were found (and processed)
     */
    private processLegalMoves(piece: Piece, viaPillbug: boolean, premove: boolean): boolean {
        const generator = this.gameClient.generateLegalMoves(piece, viaPillbug);
        let next = generator.next();
        let hasLegalMoves = false;
        while (!next.done) {
            this.spawnPlaceholder(next.value, viaPillbug, premove);
            hasLegalMoves = true;
            next = generator.next();
        }
        this.movePaths = GraphUtils.mergePathMaps(this.movePaths, next.value);
        return hasLegalMoves;
    }

    private spawnPlaceholder(pos: LatticeCoords, viaPillbug: boolean, premove: boolean): void {
        // TODO color premove placeholders differently

        if (!this.placeholderSet[pos.join(",")]) {
            const [x, y] = this.convertCoordinates(...pos);
            const handle = this.playArea.append("use")
                .attr("xlink:href", "#placeholder")
                .attr("class", "placeholder")
                .style("stroke", Board.colors.placeholder[viaPillbug ? "pillbug" : "base"])
                .style("fill", "#ffffff00")
                .attr("transform", `translate(${x},${y})`);

            if (this.interactable) this.bindPlaceholder(pos, handle, viaPillbug, premove);
            this.placeholderSet[pos.join(",")] = true;
        }
    }

    private bindPlaceholder(pos: LatticeCoords, handle: Sel<SVGUseElement>, viaPillbug: boolean, premove: boolean): void {
        // TODO color premove placeholders differently

        handle.on("mouseenter", () => {
            if (this.selectedPiece) {
                handle.style("fill", Board.colors.placeholder[viaPillbug ? "pillbugHover" : "hover"]);
                handle.style("cursor", "pointer");

                const coordMap = (p: LatticeCoords) => this.convertCoordinates(...p).join(",");
                this.movePathHandle
                    .raise()
                    .style("stroke", Board.colors.path[viaPillbug ? "pillbug" : "base"])
                    .attr("d", `M${coordMap(pos)}L` + this.movePaths(pos).map(coordMap).join("L"));
            }
        });

        handle.on("mouseleave", () => {
            handle.style("fill", "#ffffff00");
            handle.style("cursor", "default");
        });

        handle.on("mousedown", (e: MouseEvent) => e.stopImmediatePropagation());
        handle.on("mouseup", () => {
            if (this.selectedPiece) {
                this.gameClient.makeMoveOrPremove(this.selectedPiece.piece, pos);
                this.clearSelection();
            }
        });
    }

    /**
     * Reset selection, delete all placeholders, reset movement paths, and clear selection outline.
     */
    private clearSelection(): void {
        selectAll(".placeholder").remove();
        this.selectedPiece?.hex.style("stroke", Board.colors.outline.base);
        this.selectedPiece = null;
        this.placeholderSet = {};
        this.movePaths = () => [];
        this.movePathHandle.attr("d", "");
    }

    /**
     * Remove all tiles and placeholders, effectively resetting board visually.
     */
    public clearBoard(): void {
        this.clearSelection();
        selectAll(".tile").remove();
    }

    public moveTile(piece: Piece, destination: LatticeCoords): void {
        this.clearSelection();

        let [x, y] = this.convertCoordinates(...destination);
        if (piece.height && piece.height > 1) {
            // TODO render this better
            x += this.hexRadGap * (piece.height - 1);
            y -= this.hexRadGap * (piece.height - 1);
        }

        const handle = select(`#${Notation.pieceToString(piece)}`)
            .raise();
        handle.selectChild("use")
            .style("stroke", Board.colors.outline.base);
        handle.transition()
            .duration(150)
            .ease(easeCubic)
            .attr("transform", `translate(${x},${y})`);
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
        return [
            this.horSpacing * (u + v / 2) + this.width / 2,
            this.vertSpacing * v + this.height / 2
        ];
    }
}