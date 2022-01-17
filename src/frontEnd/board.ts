import * as d3 from "d3";

import { Piece, PieceColor, PieceType } from "@/types/common/piece";
import { TurnOutcome, TurnRequest } from "@/types/common/turn";

import Notation, { ParseError } from "@/frontEnd/notation";

import { GroupHandle, ScreenCoords, SelectedTile, SVGContainer } from "@/types/frontEnd/board";

import { LatticeCoords } from "@/types/backEnd/hexGrid";

import HiveGame from "@/backEnd/game";

import PieceMap from "@/util/pieceMap";

// import icons from "@/ui/icons.svg";

export default class Board {
    // static lookup-tables
    private static tileColorMap: { [color in PieceColor]: string } = {
        Black: "#363430",
        White: "#f3ecde"
    };
    private static bugColorMap: { [bug in PieceType]: string } = {
        Ant: "#0fa9f0",
        Beetle: "#8779b9",
        Grasshopper: "#2fbc3d",
        Ladybug: "#d72833",
        Mosquito: "#a6a6a6",
        Pillbug: "#49ad92",
        QueenBee: "#fcb336",
        Spider: "#9f622d"
    };
    private static bugScaleMap: { [bug in PieceType]: number } = {
        // ratio bugHeight/hexRadius which looks best for each bug
        Ant: 1.29981,
        Beetle: 1.50629,
        Grasshopper: 1.60499,
        Ladybug: 1.21203,
        Mosquito: 1.53148,
        Pillbug: 1.40370,
        QueenBee: 1.02462,
        Spider: 1.52296
    };
    private static uiColors = {
        hover: "#e50bbd99",
        pillbugPlaceholder: "#49ad9299",
        placeholder: "#e50bbd55",
        placeholderHover: "#e50bbd33",
        selected: "#b80fc7"
    };

    private game: HiveGame;

    // user-defined dimensions
    private width: number;
    private height: number;
    private hexRadius: number;
    private hexRadGap: number;

    // precalculated quantities
    private gappedHexRad: number;
    private horSpacing: number;
    private vertSpacing: number;
    private hexPath: d3.Path;

    // SVG element handles
    private tileGroup: GroupHandle;
    private selectedTile: SelectedTile;
    private placeholders: GroupHandle[] = [];
    private pieceHandles: PieceMap<GroupHandle>;

    // pan & zoom tracking
    private pan: ScreenCoords;
    private dragging: boolean;
    private zoom: number;

    public constructor(width: number, height: number, hexRad: number, cornerRad: number, hexRadGap: number) {
        this.game = new HiveGame();

        const svgContainer = d3
            .select("svg")
            .attr("style", `outline: thin solid ${Board.uiColors.placeholder};`)
            .attr("width", width)
            .attr("height", height);
        this.tileGroup = svgContainer.append("g");
        this.pieceHandles = new PieceMap<GroupHandle>();

        // user-defined dimensions
        this.width = width;
        this.height = height;
        this.hexRadius = hexRad;
        this.hexRadGap = hexRadGap;

        // precalculated quantities
        this.gappedHexRad = hexRad + hexRadGap;
        this.horSpacing = Math.sqrt(3) * this.gappedHexRad;
        this.vertSpacing = 1.5 * this.gappedHexRad;
        this.hexPath = Board.getRoundedHexPath(hexRad, cornerRad);

        this.selectedTile = null;

        // pan & zoom tracking
        this.pan = [0, 0];
        this.dragging = false;
        this.zoom = 1;
        this.bindPanAndZoom(svgContainer);

        // TODO: Find a good way of adding SVG defs to index.html in this constructor
        // d3.xml(icons).then(data => {
        //     const svg = document.body.getElementsByTagName("svg")[0];
        //     svg.insertBefore(data.documentElement.children[0], svg.firstChild);
        // }).catch(error => throw new Error(`Unable to initialize board UI due to error: ${error}`));
    }

    private bindPanAndZoom(svgContainer: SVGContainer) {
        svgContainer.on("mousedown", (e: MouseEvent) => {
            if (e.button === 1) this.dragging = true;
        });

        svgContainer.on("mouseup", (e: MouseEvent) => {
            if (e.button === 1) this.dragging = false;
        });

        svgContainer.on("mouseleave", () => this.dragging = false);

        svgContainer.on("mousemove", (e: MouseEvent) => {
            if (this.dragging) {
                this.pan[0] += e.movementX;
                this.pan[1] += e.movementY;
                this.tileGroup.attr("transform", `translate(${this.pan[0]},${this.pan[1]})scale(${this.zoom})`);
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
            this.tileGroup.attr("transform", `translate(${this.pan[0]},${this.pan[1]})scale(${this.zoom})`);
        });

    }

    private static getRoundedHexPath(hexRad: number, cornerRad: number): d3.Path {
        const thirdPi: number = Math.PI / 3;
        const innerRad: number = hexRad - cornerRad;
        const path: d3.Path = d3.path();

        d3.range(6).forEach(i => {
            const theta: number = i * thirdPi;
            const sin: number = Math.sin(theta);
            const cos: number = Math.cos(theta);
            const pts: number[][] = [1, -1].map((d: number) => [
                innerRad * sin + cornerRad * Math.sin(theta - d * thirdPi),
                innerRad * cos + cornerRad * Math.cos(theta - d * thirdPi)
            ]);
            if (i === 0) path.moveTo(pts[0][0], pts[0][1]);
            else path.lineTo(pts[0][0], pts[0][1]);
            path.arcTo(hexRad * sin, hexRad * cos, pts[1][0], pts[1][1], cornerRad);
        });
        path.closePath();
        return path;
    }

    public processTurn(turn: TurnRequest): TurnOutcome;
    public processTurn(turnNotation: string): TurnOutcome | ParseError;
    public processTurn(turnOrNotation: string | TurnRequest): TurnOutcome | ParseError {
        let turn: TurnRequest | ParseError;
        if (typeof turnOrNotation === "string") {
            turn = Notation.stringToTurnRequest(turnOrNotation);
            if (turn === "ParseError") return "ParseError";
        } else turn = turnOrNotation;

        const outcome: TurnOutcome = this.game.processTurn(turn);
        if (outcome.status === "Success") {
            if (outcome.turnType === "Placement") this.spawnTile(outcome.piece, outcome.destination);
            else if (outcome.turnType === "Movement") this.moveTile(outcome.piece, outcome.destination);
        }

        console.log(outcome);
        return outcome;
    }

    private spawnTile(piece: Piece, pos: LatticeCoords): void {
        // spawn tile
        const [x, y] = this.convertCoordinates(...pos);
        const handle = this.tileGroup
            .append("g")
            .attr("transform", `translate(${x},${y})`);
        handle.append("path")
            .attr("d", this.hexPath.toString())
            .style("fill", Board.tileColorMap[piece.color])
            .style("stroke-width", `${this.hexRadGap * Math.sqrt(3)}px`);
        this.bindTile(piece, handle, pos); // bind mouse events
        this.pieceHandles.setPiece(piece, handle);

        // add centered bug icon
        const bug = handle.append("use")
            .attr("xlink:href", `#${piece.type}`)
            .style("fill", Board.bugColorMap[piece.type])
            .style("stroke", Board.bugColorMap[piece.type]);

        const bugBBox = bug.node()?.getBoundingClientRect();
        if (bugBBox) {
            const scale: number = Board.bugScaleMap[piece.type] * this.hexRadius / bugBBox.height;
            // TODO why 2px off for x translation?
            bug.attr("transform", `scale(${scale})translate(-${bugBBox.width / 2 - 2},-${bugBBox.height / 2})`);
        } else {
            throw new Error("Cannot determine bug icon bounding box.");
        }
    }

    private bindTile(piece: Piece, handle: GroupHandle, pos: LatticeCoords): void {
        const thisIsSelected = () => this.selectedTile?.pos[0] === pos[0]
            && this.selectedTile.pos[1] === pos[1];
        const hex = handle.selectChild("path");

        handle.on("mouseenter", () => {
            if (!this.selectedTile || thisIsSelected()) {
                hex.style("stroke", Board.uiColors.hover);
                handle.style("cursor", "pointer");
            } else {
                handle.style("cursor", "default");
            }
        });

        handle.on("mouseleave", () => {
            if (!this.selectedTile) {
                hex.style("stroke", "none");
            } else if (thisIsSelected()) {
                hex.style("stroke", Board.uiColors.selected);
            }
        });

        handle.on("click", () => {
            if (!this.selectedTile) {
                // spawn placeholders
                const canMove = this.game.pieceMayMove(piece);
                let hasLegalMoves = false;
                if (canMove === "Success") {
                    for (const pos of this.game.getMoves(piece)) {
                        this.spawnPlaceholder(pos);
                        hasLegalMoves = true;
                    }
                }
                if (canMove === "Success" || canMove === "OnlyByPillbug") {
                    // TODO spawn special pillbug move placeholders here
                    for (const pos of this.game.getPillbugMoves(piece)) {
                        this.spawnPlaceholder(pos, true);
                        hasLegalMoves = true;
                    }
                }

                // select tile if it has legal moves
                if (hasLegalMoves) {
                    this.selectedTile = { piece, pos };
                    hex.style("stroke", Board.uiColors.selected);
                } else {
                    // TODO handle clicking of piece with no legal moves
                    console.log("Clicked piece has no legal moves");
                }
            } else if (thisIsSelected()) {
                hex.style("stroke", Board.uiColors.hover);
                this.selectedTile = null;
                this.clearPlaceholders();
            }
        });
    }

    public spawnPlaceholder(pos: LatticeCoords, pillbug?: boolean): void {
        const [x, y] = this.convertCoordinates(...pos);
        const handle = this.tileGroup
            .append("g")
            .style("stroke", Board.uiColors[pillbug ? "pillbugPlaceholder" : "placeholder"])
            .style("stroke-width", `${0.6 * this.hexRadGap}px`)
            .style("fill", "#ffffff00")
            .attr("transform", `translate(${x},${y})`);
        [0.95, 0.6].forEach((scale, index) => {
            const outline = handle
                .append("path")
                .attr("d", this.hexPath.toString())
                .attr("transform", `scale(${scale})`);
            if (index === 0) outline.style("stroke-dasharray", ("8, 4"));
        });

        this.bindPlaceholder(pos, handle); // bind mouse events
        this.placeholders.push(handle);
    }

    public clearPlaceholders(): void {
        this.placeholders.forEach(placeholder => placeholder.remove());
        this.placeholders = [];
    }

    private bindPlaceholder(pos: LatticeCoords, handle: GroupHandle): void {
        handle.on("mouseenter", () => {
            if (this.selectedTile) {
                handle.style("fill", Board.uiColors.placeholderHover);
                handle.style("cursor", "pointer");
            }
        });

        handle.on("mouseleave", () => {
            handle.style("fill", "#ffffff00");
            handle.style("cursor", "default");
        });

        handle.on("click", () => {
            if (this.selectedTile) {
                this.checkThenMoveTile(this.selectedTile.piece, pos);
                this.pieceHandles.getPiece(this.selectedTile.piece)?.selectChild("path").style("stroke", "none");
                this.selectedTile = null;
                this.clearPlaceholders();
            }
        });
    }

    // TODO this could be better named...
    private checkThenMoveTile(piece: Piece, destination: LatticeCoords) {
        const outcome = this.game.movePiece(piece, destination);
        console.log(outcome);
        if (outcome.status === "Success") this.moveTile(piece, destination);
    }

    private moveTile(piece: Piece, destination: LatticeCoords): void {
        const handle = this.pieceHandles.getPiece(piece);
        if (!handle) throw new Error("Cannot find piece handle to move it.");
        const [x, y] = this.convertCoordinates(...destination);
        handle.attr("transform", `translate(${x},${y})`);
    }

    /**
     * Convert between lattice coordinates - integer coefficients for lattice base
     * vectors (joining centers of adjacent hexagons lying along the horizontal and
     * along a pi/3 elevation), and screen-space xy-coordinates used by SVG.
     * 
     * @param u TODO
     * @param v TODO
     * @returns position of tile in SVG rectilinear coordinates
     */
    private convertCoordinates(u: number, v: number): ScreenCoords {
        return [
            this.horSpacing * (u + v / 2) + this.width / 2,
            this.vertSpacing * v + this.height / 2
        ];
    }
}