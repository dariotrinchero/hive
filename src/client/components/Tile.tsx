import { Component, Fragment, h } from "preact";

import "@/client/styles/Tile";

import * as icons from "@/client/icons.json";

import type { Piece, PieceColor, PieceType } from "@/types/common/piece";
import type { ScreenCoords } from "@/types/client/board";

interface PlaceholderTile {
    type: "Placeholder";
    viaPillbug?: boolean;
}

export type PieceTileState = "Normal" | "Inactive" | "Selected"
interface PieceTile extends Piece {
    state: PieceTileState;
}
const tileStateToClass: Record<PieceTileState, string> = {
    // class names used to apply CSS styling to tiles based on state
    "Inactive": "",
    "Normal": "active",
    "Selected": "selected"
};

export interface HexDimensions {
    radius: number;
    gap: number;
    cornerRad: number;
}

export interface TileProps {
    // tile details
    size: HexDimensions;
    tile: PieceTile | PlaceholderTile;
    pos: ScreenCoords;

    // interactivity
    handleClick: () => void;
    handleMouseEnter?: () => void;
}

const bugPaths: Record<PieceType, string> = icons;
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

interface BugTransform {
    scale: number;
    offset: [number, number];
}
const bugTransforms: Record<PieceType, BugTransform> = {
    // offset required to center each (unscaled) bug & best-looking relative scaling
    // (scale is this * hexRad / 100)
    Ant: { offset: [-60.02500, -62.88333], scale: 1.03351 },
    Beetle: { offset: [-40.8, -71.35833], scale: 1.05544 },
    Grasshopper: { offset: [-26.50833, -80.25], scale: 0.99999 },
    Ladybug: { offset: [-63.96667, -57.4], scale: 1.05577 },
    Mosquito: { offset: [-48.57500, -68.91666], scale: 1.11111 },
    Pillbug: { offset: [-43.86667, -66.34167], scale: 1.05793 },
    QueenBee: { offset: [-67.19167, -43.91666], scale: 1.16655 },
    Spider: { offset: [-38.31667, -68.51666], scale: 1.11138 }
};

export default class Tile extends Component<TileProps> {
    // flags to remember the first tile (which needs to render defs)
    private static atLeastOneTile = false;
    private firstTile;

    public constructor() {
        super();
        this.firstTile = !Tile.atLeastOneTile;
        Tile.atLeastOneTile = true;
    }

    /**
     * Return path definition for hexagon of given radius, with rounded corners of given radius.
     *
     * @param hexRad radius of circle in which un-rounded hexagon fits snugly
     * @param cornerRad radius of circle arcs to use for rounding corners (cuts off corner)
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

    /**
     * Render SVG <defs> tag containing various definitions to be referenced later by <use> tags -
     * specifically, define the rounded hex path, placeholder, and each bug icon path. This is only
     * rendered by the first instance of the Tile class.
     * 
     * @param size hex grid dimensions
     * @returns populated SVG defs tag
     */
    private renderSVGDefs(size: HexDimensions): h.JSX.Element {
        return (
            <defs>
                <path id="hex" d={Tile.roundedHexPath(size.radius, size.cornerRad)} />
                <g
                    id="placeholder"
                    style={`stroke-width: ${0.6 * size.gap}`}
                >
                    {[0.95, 0.6].map((scale, index) =>
                        <use
                            key={index}
                            xlinkHref="#hex"
                            transform={`scale(${scale})`}
                            style={index === 0 ? "stroke-dasharray: 8,4" : ""}
                        />
                    )}
                </g>
                {Object.entries(bugPaths).map(([bug, path]) => <path key={bug} id={bug} d={path} />)}
            </defs>
        );
    }

    /**
     * Render tile representing game piece.
     * 
     * @param piece game piece represented by tile
     * @param pos screen-space coordinates of piece tile
     * @returns SVG group representing piece tile
     */
    private renderPieceTile(piece: PieceTile, pos: ScreenCoords): h.JSX.Element {
        const { type, color, state } = piece;
        const { scale, offset } = bugTransforms[type];

        const mouseDown = (e: MouseEvent) => {
            e.stopImmediatePropagation(); // prevent interfering with Board
            if (state !== "Inactive") this.props.handleClick();
        };

        return (
            <g
                class={`tile ${tileStateToClass[state]}`}
                transform={`translate(${pos.join(",")})`}
                onMouseDown={mouseDown}
                onMouseEnter={this.props.handleMouseEnter}
            >
                <use
                    xlinkHref="#hex"
                    fill={tileColors[color]}
                    style={`stroke-width: ${this.props.size.gap * Math.sqrt(3)}`}
                />
                <use
                    xlinkHref={`#${type}`}
                    transform={`scale(${scale * this.props.size.radius / 100})`
                        + `translate(${offset[0]},${offset[1]})`}
                    fill={bugColors[type]}
                    stroke={bugColors[type]}
                    style={`stroke-width: ${type === "Pillbug" ? 1 : 0}`}
                />
            </g>
        );
    }

    /**
     * Render tile placeholder, representing an empty position that a tile may occupy.
     * 
     * @param pos screen-space coordinates of placeholder
     * @param viaPillbug whether placeholder represents a move using pillbug special ability
     * @returns SVG use tag referencing a group which represents the placeholder
     */
    private renderPlaceholder(pos: ScreenCoords, viaPillbug?: boolean): h.JSX.Element {
        const mouseDown = (e: MouseEvent) =>
            e.stopImmediatePropagation(); // prevent interfering with Board

        return (
            <use
                class={`placeholder ${viaPillbug ? "pillbug" : ""}`}
                xlinkHref="#placeholder"
                transform={`translate(${pos.join(",")})`}
                onMouseDown={mouseDown}
                onMouseUp={this.props.handleClick}
                onMouseEnter={this.props.handleMouseEnter}
            />
        );
    }

    public override render(props: TileProps): h.JSX.Element {
        return (
            <Fragment>
                {this.firstTile ? this.renderSVGDefs(props.size) : null}
                {props.tile.type === "Placeholder"
                    ? this.renderPlaceholder(props.pos, props.tile.viaPillbug)
                    : this.renderPieceTile(props.tile, props.pos)}
            </Fragment>
        );
    }
}