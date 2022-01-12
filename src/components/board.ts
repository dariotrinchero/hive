import * as d3 from "d3";
import { LatticeCoords, Piece, PieceColor, PieceType } from "@/types/common/piece";
import { TurnRequest } from "@/types/common/turn";
import { MovementErrorMsg, PlacementErrorMsg, TurnOutcome } from "@/types/common/turn";
import { PieceTile, ScreenCoords, SVGContainer, Tile } from "@/types/components/board";

import HiveGame from "@/logic/game";
import Notation, { ParseError } from "@/logic/notation";
// import icons from "@/ui/icons.svg";

export default class Board {
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
    private static uiColors: { [element: string]: string; } = {
        hover: "#e50bbd99",
        placeholder: "#e50bbd55",
        placeholderHover: "#e50bbd33",
        selected: "#b80fc7"
    };

    // user-defined dimensions
    private hexRadius: number;
    private hexRadGap: number;

    // precalculated quantities
    private gappedHexRad: number;
    private horSpacing: number;
    private vertSpacing: number;
    private hexPath: d3.Path;

    // selection tracking
    private selectedTile: PieceTile | null;
    private placeholders: Tile[] = [];

    public constructor(width: number, height: number, hexRad: number, cornerRad: number, hexRadGap: number) {
        Board.svgContainer = d3
            .select("svg")
            .attr("width", width)
            .attr("height", height);
        Board.game = new HiveGame();

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
        // }).catch(error => console.error(`Unable to initialize board UI due to error: ${error}`));
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

    public placeTile(u: number, v: number, pieceStr: string): "Success" | PlacementErrorMsg | ParseError {
        const piece: Piece | ParseError = Notation.stringToPiece(pieceStr);
        if (piece === "ParseError") return "ParseError";
        return this.spawnTile({ u, v }, piece);
    }

    public makeMove(moveStr: string): TurnOutcome | ParseError {
        const move: TurnRequest | ParseError = Notation.stringToMove(moveStr);
        if (move === "ParseError") return "ParseError";

        // TODO find destination coords and place
        return "ParseError";
    }

    private spawnTile(pos: LatticeCoords, piece: Piece): "Success" | PlacementErrorMsg {
        // ask game to spawn piece & exit if illegal
        const placement = Board.game.placePiece(pos, piece);
        if (placement.outcome !== "Success") return placement.message;

        // spawn tile
        const { x, y } = this.convertCoordinates(pos);
        const tileHandle = Board.svgContainer
            .append("g")
            .attr("transform", `translate(${x},${y})`);
        const hex = tileHandle
            .append("path")
            .attr("d", this.hexPath.toString())
            .style("fill", Board.tileColorMap[piece.color])
            .style("stroke-width", `${this.hexRadGap * Math.sqrt(3)}px`);

        // bind mouse events
        tileHandle.on("mouseenter", () => {
            if (!this.selectedTile) hex.style("stroke", Board.uiColors.hover);
        });
        tileHandle.on("mouseleave", () => {
            if (!this.selectedTile) hex.style("stroke", "none");
        });
        tileHandle.on("click", () => {
            if (this.selectedTile === null) {
                this.selectedTile = { piece, pos, tileHandle };
                hex.style("stroke", Board.uiColors.selected);
            } else if (Board.game.equalPos(this.selectedTile.pos, pos)) {
                hex.style("stroke", Board.uiColors.hover);
                this.selectedTile = null;
            }
        });

        // add centered bug icon
        const bug = tileHandle.append("use")
            .attr("xlink:href", `#${piece.type}`)
            .style("fill", Board.bugColorMap[piece.type])
            .style("stroke", Board.bugColorMap[piece.type]);

        const bugBBox = bug.node()?.getBoundingClientRect();
        if (bugBBox) {
            const scale: number = Board.bugScaleMap[piece.type] * this.hexRadius / bugBBox.height;
            // TODO why 2px off for x translation?
            bug.attr("transform", `scale(${scale})translate(-${bugBBox.width / 2 - 2},-${bugBBox.height / 2})`);
        } else {
            console.error("Cannot determine bug icon bounding box.");
        }

        return "Success";
    }

    public spawnPlaceholder(pos: LatticeCoords): Tile {
        // spawn placeholder
        const { x, y } = this.convertCoordinates(pos);
        const tileHandle = Board.svgContainer
            .append("g")
            .style("stroke", Board.uiColors.placeholder)
            .style("stroke-width", `${0.6 * this.hexRadGap}px`)
            .style("fill", "#ffffff00")
            .attr("transform", `translate(${x},${y})`);
        [0.95, 0.6].forEach((scale, index) => {
            const outline = tileHandle
                .append("path")
                .attr("d", this.hexPath.toString())
                .attr("transform", `scale(${scale})`);
            if (index === 0) outline.style("stroke-dasharray", ("8, 4"));
        });

        // bind mouse events
        tileHandle.on("mouseenter", () => tileHandle.style("fill", Board.uiColors.placeholderHover));
        tileHandle.on("mouseleave", () => tileHandle.style("fill", "#ffffff00"));
        tileHandle.on("click", () => {
            if (this.selectedTile === null) {
                console.error("Placeholder clicked with no selected tile.");
            } else {
                this.moveTile(this.selectedTile, pos);
                this.selectedTile.tileHandle.selectChild("path").style("stroke", "none");
                this.selectedTile = null;
            }
        });

        const tile: Tile = { pos, tileHandle };
        this.placeholders.push(tile);
        return tile;
    }

    private moveTile(tile: PieceTile, toPos: LatticeCoords): "Success" | MovementErrorMsg {
        // ask game to move piece & exit if illegal
        const movement = Board.game.movePiece(tile.pos, toPos);
        if (movement.outcome !== "Success") return movement.message;

        // move tile
        const { x, y } = this.convertCoordinates(toPos);
        tile.pos = toPos;
        tile.tileHandle.attr("transform", `translate(${x},${y})`);

        // delete all placeholders
        this.placeholders.forEach(ph => ph.tileHandle.remove());
        this.placeholders = [];

        return "Success";
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
        // TODO let LatticeCoords be on torus, and hence add relevant offsets here
        return {
            x: this.horSpacing * (pos.u + pos.v / 2) + 1.5 * this.horSpacing,
            y: this.vertSpacing * pos.v + 2.5 * this.gappedHexRad
        };
    }
}