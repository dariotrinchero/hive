import { select, selectAll } from "d3-selection";
import { easeCubic, easeLinear } from "d3-ease";
import "d3-transition";

import type GameClient from "@/client/sockets/gameClient";
import Notation from "@/client/ui/notation";
import * as icons from "@/client/ui/icons.json";

import type { Piece, PieceColor, PieceType } from "@/types/common/piece";
import type { LatticeCoords } from "@/types/common/game/hexGrid";
import type { MovePaths, ScreenCoords, Sel, SelectedPiece } from "@/types/client/board";

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
            selected: "#e50bbd99"
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
    private movePaths: MovePaths = { normal: () => [], pillbug: () => [] };
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

        // define rounded hex path
        defs.append("path")
            .attr("id", "hex")
            .attr("d", Board.roundedHexPath(hexRadius, cornerRad));
        Board.definePlaceholder(defs, 0.6 * hexRadGap);

        // create path object for showing bug movement paths
        const dashLen: [number, number] = [16, 12];
        this.movePathHandle = this.playArea.append("path")
            .style("fill", "none")
            .style("stroke-width", "8px")
            .style("stroke-dasharray", dashLen.join(","))
            .style("pointer-events", "none");

        const animate = () => this.movePathHandle
            .transition()
            .ease(easeLinear)
            .duration(2000)
            .styleTween("stroke-dashoffset", () => t => `${t * (dashLen[0] + dashLen[1])}`)
            .on("end", animate);
        animate();

        // precalculate other dimensions
        const playAreaBBox = svgContainer.node()?.getBoundingClientRect();
        this.width = playAreaBBox?.width || 1920;
        this.height = playAreaBBox?.height || 666;
        this.horSpacing = Math.sqrt(3) * (hexRadius + hexRadGap);
        this.vertSpacing = 1.5 * (hexRadius + hexRadGap);
    }

    /**
     * Get path definition string for a hexagon of given radius with rounded corners of given radius.
     * 
     * @param hexRad radius of circle in which un-rounded hexagon fits snugly
     * @param cornerRad radius of circle arcs to use for rounding corners (cuts off corner)
     * @returns SVG path definition string ('d' attribute of <path>) for rounded hexagon
     */
    private static roundedHexPath(hexRad: number, cornerRad: number): string {
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
        return hexPath + "Z"; // close path
    }

    private static definePlaceholder(defs: Sel<SVGDefsElement>, strokeWidth: number): void {
        const handle = defs.append("g")
            .attr("id", "placeholder")
            .style("stroke-width", `${strokeWidth}px`);
        [0.95, 0.6].forEach((scale, index) => {
            const outline = handle.append("use")
                .attr("xlink:href", "#hex")
                .attr("transform", `scale(${scale})`);
            if (index === 0) outline.style("stroke-dasharray", "8,4");
        });
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

    public setInteractable(interactable: boolean): void {
        this.interactable = interactable;
        if (!interactable) this.clearPlaceholders();
    }

    /**
     * Spawn tile representing given piece at given location. 
     *
     * @param piece piece (color & insect-type) which tile should represent
     * @param pos position of tile in lattice coordinates
     */
    public spawnTile(piece: Piece, pos: LatticeCoords): void {
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
        if (this.interactable) this.bindTile(piece, handle, pos); // bind mouse events

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
            + `translate(-${width / 2 - 2 * strokeWidth},-${height / 2})`);
    }

    private bindTile(piece: Piece, handle: Sel<SVGGElement>, pos: LatticeCoords): void {
        const thisIsSelected = () => this.selectedPiece?.pos[0] === pos[0]
            && this.selectedPiece.pos[1] === pos[1];
        const hex = handle.selectChild("use");

        handle.on("mouseenter", () => {
            if (!this.selectedPiece || thisIsSelected()) {
                hex.style("stroke", Board.colors.outline.hover);
                handle.style("cursor", "pointer");
            } else {
                handle.style("cursor", "default");
            }
        });

        handle.on("mouseleave", () => {
            if (!this.selectedPiece) {
                hex.style("stroke", "none");
            } else if (thisIsSelected()) {
                hex.style("stroke", Board.colors.outline.selected);
            }
        });

        handle.on("mousedown", (e: MouseEvent) => {
            e.stopImmediatePropagation();

            if (!this.selectedPiece) {
                const checkOutcome = this.gameClient.checkPieceForMove(piece);
                let hasLegalMoves = false;

                // spawn regular placeholders
                if (checkOutcome.outcome === "Success") {
                    const generator = this.gameClient.game.generateLegalMoves(piece);
                    let next = generator.next();
                    while (!next.done) {
                        this.spawnPlaceholder(next.value, checkOutcome.premove);
                        hasLegalMoves = true;
                        next = generator.next();
                    }
                    this.movePaths.normal = next.value;
                }

                // spawn pillbug special-move placeholders
                if (checkOutcome.outcome === "Success" || checkOutcome.outcome === "OnlyByPillbug") {
                    const pillbugMoves = this.gameClient.game.getPillbugMoves(piece);
                    for (const dest of pillbugMoves.destinations) {
                        this.spawnPlaceholder(dest, true, checkOutcome.premove);
                        hasLegalMoves = true;
                    }
                    this.movePaths.pillbug = pillbugMoves.pathMap;
                }

                // select tile if it has legal moves
                if (hasLegalMoves) {
                    this.selectedPiece = { piece, pos };
                    hex.style("stroke", Board.colors.outline.selected);
                } else {
                    // handle clicking of piece with no legal moves
                    const transform = handle.attr("transform");
                    let shakes = 3;
                    const animate = () => {
                        if (shakes-- > 0) handle.transition()
                            .duration(90)
                            .attrTween("transform", () => t => `${transform} rotate(${5.5 * Math.sin(t * Math.PI)})`)
                            .on("end", animate);
                        else handle.attr("transform", transform);
                    };
                    if (!transform.match(/rotate/g)) animate();

                    console.error(`No legal moves: checkPieceForMove() returned ${checkOutcome.outcome}`);
                }
            } else if (thisIsSelected()) {
                hex.style("stroke", Board.colors.outline.hover);
                this.selectedPiece = null;
                this.clearPlaceholders();
            }
        });
    }

    private spawnPlaceholder(pos: LatticeCoords, pillbug?: boolean, premove?: boolean): void {
        // TODO handle special behaviour for premoves

        if (!this.placeholderSet[pos.join(",")]) {
            const [x, y] = this.convertCoordinates(...pos);
            const handle = this.playArea.append("use")
                .attr("xlink:href", "#placeholder")
                .attr("class", "placeholder")
                .style("stroke", Board.colors.placeholder[pillbug ? "pillbug" : "base"])
                .style("fill", "#ffffff00")
                .attr("transform", `translate(${x},${y})`);

            if (this.interactable) this.bindPlaceholder(pos, handle, pillbug);
            this.placeholderSet[pos.join(",")] = true;
        }
    }

    private clearPlaceholders(): void {
        selectAll(".placeholder").remove();
        this.placeholderSet = {};
        this.movePaths = { normal: () => [], pillbug: () => [] };
        this.movePathHandle.attr("d", "");
    }

    public clearBoard(): void {
        this.clearPlaceholders();
        selectAll(".tile").remove();
    }

    private bindPlaceholder(pos: LatticeCoords, handle: Sel<SVGUseElement>, pillbug?: boolean): void {
        handle.on("mouseenter", () => {
            if (this.selectedPiece) {
                handle.style("fill", Board.colors.placeholder[pillbug ? "pillbugHover" : "hover"]);
                handle.style("cursor", "pointer");

                const coordMap = (p: LatticeCoords) => this.convertCoordinates(...p).join(",");
                this.movePathHandle
                    .raise()
                    .style("stroke", Board.colors.path[pillbug ? "pillbug" : "base"])
                    .attr("d", `M${coordMap(pos)}L`
                        + this.movePaths[pillbug ? "pillbug" : "normal"](pos).map(coordMap).join("L"));
            }
        });

        handle.on("mouseleave", () => {
            handle.style("fill", "#ffffff00");
            handle.style("cursor", "default");
        });

        handle.on("mousedown", (e: MouseEvent) => e.stopImmediatePropagation());
        handle.on("mouseup", () => {
            if (this.selectedPiece) {
                this.gameClient.makeMoveRequest(this.selectedPiece.piece, pos);
                this.selectedPiece = null;
                this.clearPlaceholders();
            }
        });
    }

    public moveTile(piece: Piece, destination: LatticeCoords): void {
        let [x, y] = this.convertCoordinates(...destination);
        if (piece.height && piece.height > 1) {
            // TODO render this better
            x += this.hexRadGap * (piece.height - 1);
            y -= this.hexRadGap * (piece.height - 1);
        }

        const handle = select(`#${Notation.pieceToString(piece)}`)
            .raise();
        handle.selectChild("use")
            .style("stroke", "none");
        handle.transition()
            .duration(150)
            .ease(easeCubic)
            .attr("transform", `translate(${x},${y})`);
    }

    /**
     * Convert between lattice coordinates - integer coefficients for lattice base
     * vectors (joining centers of adjacent hexagons lying along the horizontal and
     * along a pi/3 elevation), and screen-space xy-coordinates used by SVG.
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