import * as d3 from 'd3';
import { LatticeCoords, Piece, PieceColor, PieceType } from "@/types/common/piece";
import { MovementOutcome, PlacementOutcome } from "@/types/common/status";
import { PieceTile, ScreenCoords, SVGContainer, SVGGroup, SVGPath, Tile } from "@/types/components/board";
import HiveGame from "@/logic/game";
// import icons from "@/ui/icons.svg";

export default class Board {
    private static svgContainer: SVGContainer;
    private static game: HiveGame;

    // static lookup-tables
    private static tileColorMap: { [color in PieceColor]: string } = {
        Black: "#535049",
        White: "#f3ecde"
    };
    private static bugColorMap: { [bug in PieceType]: string } = {
        Ant: "#009ddc",
        Beetle: "#8a7ffc",
        Grasshopper: "#40ab48",
        Ladybug: "#d03749",
        Mosquito: "#9ba1a9",
        Pillbug: "#0be5cc",
        QueenBee: "#f3b034",
        Spider: "#c1563e"
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
        selected: "#b80fc7",
        placeholder: "#e50bbd55",
        placeholderHover: "#e50bbd33"
    };

    // user-defined dimensions
    private hexRadius: number;
    private hexRadGap: number;

    // precalculated quantities
    private gappedHexRad: number;
    private horSpacing: number;
    private vertSpacing: number;
    private hexPoints: number[][];

    // selection tracking
    private selectedTile?: PieceTile;
    private placeholders: Tile[] = [];

    public constructor(width: number, height: number, hexRad: number, hexRadGap: number) {
        // TODO add option for rounded corners
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
        this.hexPoints = d3.range(8).map(i => {
            const theta = i * Math.PI / 3;
            return [hexRad * Math.sin(theta), hexRad * Math.cos(theta)];
        });

        // TODO: Find a good way of adding SVG defs to index.html in this constructor
        // d3.xml(icons).then(data => {
        //     const svg = document.body.getElementsByTagName("svg")[0];
        //     svg.insertBefore(data.documentElement.children[0], svg.firstChild);
        // }).catch(error => console.error(`Unable to initialize board UI due to error: ${error}`));
    }

    private addHexToGroup(group: SVGGroup): SVGPath {
        return group.selectAll("path.area")
            .data([this.hexPoints])
            .enter()
            .append("path")
            .attr("d", d3.line());
    }

    /**
     * Spawn tile at given coordinates corresponding to given Piece.
     * 
     * @param u TODO
     * @param v TODO
     * @param piece piece represented by tile
     * @returns TODO
     */
    public spawnTile(u: number, v: number, piece: Piece): PieceTile | PlacementOutcome {
        // ask game to spawn piece & exit if illegal
        const outcome: PlacementOutcome = Board.game.spawnPiece(u, v, piece);
        console.log(outcome);
        if (outcome !== "Success") return outcome;

        // spawn piece
        const { x, y } = this.convertCoordinates({ u, v });
        const tileHandle = Board.svgContainer
            .append("g")
            .attr("transform", `translate(${x},${y})`);
        const hex = this.addHexToGroup(tileHandle)
            .style("fill", Board.tileColorMap[piece.color])
            .style("stroke-width", `${this.hexRadGap * Math.sqrt(3)}px`);

        // bind mouse events
        tileHandle.on("mouseenter", () => {
            if (typeof this.selectedTile === "undefined") {
                hex.style("stroke", Board.uiColors.hover);
            }
        });
        tileHandle.on("mouseleave", () => {
            if (typeof this.selectedTile === "undefined") {
                hex.style("stroke", "none");
            }
        });
        tileHandle.on("click", () => {
            if (typeof this.selectedTile === "undefined") {
                this.selectedTile = { pos: { u, v }, piece, tileHandle };
                hex.style("stroke", Board.uiColors.selected);
            } else if (this.selectedTile.pos.u === u && this.selectedTile.pos.v === v) {
                hex.style("stroke", Board.uiColors.hover);
                this.selectedTile = undefined;
            }
        });

        // add centered bug icon
        const bug = tileHandle.append("use")
            .attr("xlink:href", `#${piece.type}`)
            .style("fill", Board.bugColorMap[piece.type])
            .style("stroke", Board.bugColorMap[piece.type]);

        let bugBBox = bug.node()?.getBoundingClientRect();
        if (bugBBox) {
            bug.attr("transform", `scale(${Board.bugScaleMap[piece.type] * this.hexRadius / bugBBox.height})` +
                `translate(-${bugBBox.width / 2 - 2},-${bugBBox.height / 2})`); // why 2px off for x translation?
        } else {
            console.error("Cannot determine bug icon bounding box.");
        }

        return ({ piece, pos: { u, v }, tileHandle });
    }

    /**
     * Spawn placeholder at given coordinates to represent placement location.
     * 
     * @param u TODO
     * @param v TODO
     * @returns TODO
     */
    public spawnPlaceholder(u: number, v: number): Tile {
        // spawn placeholder
        const { x, y } = this.convertCoordinates({ u, v });
        const tileHandle = Board.svgContainer
            .append("g")
            .style("stroke", Board.uiColors.placeholder)
            .style("stroke-width", `${0.6 * this.hexRadGap}px`)
            .style("fill", "#ffffff00")
            .attr("transform", `translate(${x},${y})`);
        [0.95, 0.6].forEach((scale, index) => {
            const outline = this.addHexToGroup(tileHandle)
                .attr("transform", `scale(${scale})`);
            if (index === 0) outline.style("stroke-dasharray", ("8, 4"));
        });

        // bind mouse events
        tileHandle.on("mouseenter", () => tileHandle.style("fill", Board.uiColors.placeholderHover));
        tileHandle.on("mouseleave", () => tileHandle.style("fill", "#ffffff00"));
        tileHandle.on("click", () => {
            if (typeof this.selectedTile === "undefined") {
                console.error("Placeholder clicked with no selected tile.");
            } else {
                this.moveTile(this.selectedTile, { u, v });
                this.selectedTile.tileHandle.selectChild("path").style("stroke", "none");
                this.selectedTile = undefined;
            }
        });

        const tile: Tile = { pos: { u, v }, tileHandle };
        this.placeholders.push(tile);
        return tile;
    }

    private moveTile(tile: PieceTile, toPos: LatticeCoords): MovementOutcome {
        // ask game to move piece & exit if illegal
        const outcome: MovementOutcome = Board.game.movePiece(tile.pos, toPos);
        console.log(outcome);
        if (outcome !== "Success") return outcome;

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
        return {
            x: this.horSpacing * (pos.u + pos.v / 2) + 1.5 * this.horSpacing,
            y: this.vertSpacing * pos.v + 2.5 * this.gappedHexRad
        };
    }
}