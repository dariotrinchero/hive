import * as d3 from "d3";

import { Piece, PieceColor, PieceType } from "@/types/common/piece";
import { TurnOutcome, TurnRequest } from "@/types/common/turn";

import Notation, { ParseError } from "@/frontEnd/notation";

import { GroupHandle, ScreenCoords, SelectedPiece, SVGContainer, TilePos } from "@/types/frontEnd/board";

import HiveGame from "@/backEnd/game";
import HexGrid from "@/backEnd/hexGrid";

import { LatticeCoords, RelativePosition } from "@/types/backEnd/hexGrid";

// import icons from "@/ui/icons.svg";

export default class Board extends HexGrid<TilePos> {
    private static svgContainer: SVGContainer;
    private static game: HiveGame;

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
        placeholder: "#e50bbd55",
        placeholderHover: "#e50bbd33",
        selected: "#b80fc7"
    };

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

    // selection tracking
    private selectedTile: SelectedPiece;
    private placeholders: GroupHandle[] = [];

    public constructor(width: number, height: number, hexRad: number, cornerRad: number, hexRadGap: number) {
        super({ u: 0, v: 0 });

        Board.svgContainer = d3
            .select("svg")
            .attr("style", `outline: thin solid ${Board.uiColors.placeholder};`)
            .attr("width", width)
            .attr("height", height);
        Board.game = new HiveGame();

        this.width = width;
        this.height = height;
        this.hexRadius = hexRad;
        this.hexRadGap = hexRadGap;

        this.gappedHexRad = hexRad + hexRadGap;
        this.horSpacing = Math.sqrt(3) * this.gappedHexRad;
        this.vertSpacing = 1.5 * this.gappedHexRad;
        this.hexPath = Board.getRoundedHexPath(hexRad, cornerRad);

        this.selectedTile = null;

        // TODO: Find a good way of adding SVG defs to index.html in this constructor
        // d3.xml(icons).then(data => {
        //     const svg = document.body.getElementsByTagName("svg")[0];
        //     svg.insertBefore(data.documentElement.children[0], svg.firstChild);
        // }).catch(error => throw new Error(`Unable to initialize board UI due to error: ${error}`));
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

        const outcome: TurnOutcome = Board.game.processTurn(turn);
        if (outcome.status === "Success") {
            if (outcome.turnType === "Placement") this.spawnTile(outcome.piece, outcome.destination);
            else if (outcome.turnType === "Movement") this.moveTile(outcome.piece, outcome.destination);
        }

        console.log(outcome);
        return outcome;
    }

    private spawnTile(piece: Piece, destination: RelativePosition): void {
        // get destination location
        const pos = this.getDestinationPos(destination);
        if (!pos) throw new Error("Cannot find tile spawn destination");

        // spawn tile
        const { x, y } = this.convertCoordinates(pos);
        const handle = Board.svgContainer
            .append("g")
            .attr("transform", `translate(${x},${y})`);
        const hex = handle
            .append("path")
            .attr("d", this.hexPath.toString())
            .style("fill", Board.tileColorMap[piece.color])
            .style("stroke-width", `${this.hexRadGap * Math.sqrt(3)}px`);

        // TODO similar code to game.ts
        const positions = this.piecePositions[piece.color][piece.type];
        positions.push({ ...pos, handle });

        // bind mouse events
        handle.on("mouseenter", () => {
            if (!this.selectedTile) hex.style("stroke", Board.uiColors.hover);
        });
        handle.on("mouseleave", () => {
            if (!this.selectedTile) hex.style("stroke", "none");
        });
        handle.on("click", () => {
            if (!this.selectedTile) {
                this.selectedTile = { piece, tilePos: { ...pos, handle } };
                hex.style("stroke", Board.uiColors.selected);
            } else if (this.selectedTile.tilePos.u === pos.u && this.selectedTile.tilePos.v === pos.v) {
                hex.style("stroke", Board.uiColors.hover);
                this.selectedTile = null;
            }
        });

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

    public spawnPlaceholder(destination: RelativePosition): void {
        //  get position
        const pos = this.getDestinationPos(destination);
        if (!pos) throw new Error("Cannot find tile spawn destination");

        // spawn placeholder
        const { x, y } = this.convertCoordinates(pos);
        const handle = Board.svgContainer
            .append("g")
            .style("stroke", Board.uiColors.placeholder)
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

        // bind mouse events
        handle.on("mouseenter", () => handle.style("fill", Board.uiColors.placeholderHover));
        handle.on("mouseleave", () => handle.style("fill", "#ffffff00"));
        handle.on("click", () => {
            if (!this.selectedTile) {
                console.error("Placeholder clicked with no selected tile.");
            } else {
                this.processTurn({ destination, piece: this.selectedTile.piece });
                this.selectedTile.tilePos.handle.selectChild("path").style("stroke", "none");
                this.selectedTile = null;
            }
        });

        this.placeholders.push(handle);
    }

    private moveTile(piece: Piece, destination: RelativePosition): void {
        // get tile pos
        const tilePos = this.getExistingPiecePos(piece);
        if (!tilePos) throw new Error("Cannot find current tile position");

        // get destination
        const toPos = this.getDestinationPos(destination);
        if (!toPos) throw new Error("Cannot find tile spawn destination");

        // move tile
        const { x, y } = this.convertCoordinates(toPos);
        tilePos.handle.attr("transform", `translate(${x},${y})`);
        this.setExistingPiecePos(piece, { ...toPos, handle: tilePos.handle });

        // delete all placeholders
        this.placeholders.forEach(placeholder => placeholder.remove());
        this.placeholders = [];
    }

    /**
     * Convert between lattice coordinates - integer coefficients for lattice base
     * vectors (joining centers of adjacent hexagons lying along the horizontal and
     * along a pi/3 elevation), and screen-space xy-coordinates used by SVG.
     * 
     * @param pos position of tile in lattice coordinates
     * @returns position of tile in SVG rectilinear coordinates
     */
    private convertCoordinates(pos: LatticeCoords): ScreenCoords {
        return {
            x: this.horSpacing * (pos.u + pos.v / 2) + this.width / 2,
            y: this.vertSpacing * pos.v + 1.0 * this.height / 2
        };
    }
}