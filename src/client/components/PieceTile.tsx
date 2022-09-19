import { Fragment, h } from "preact";

import "@/client/styles/PieceTile";

import type { Piece, PieceColor, PieceType } from "@/types/common/piece";
import type { BaseTileProps } from "@/types/client/tile";

export type PieceTileState = "Normal" | "Inactive" | "Selected" | "Shaking";
export interface PieceTileProps extends BaseTileProps {
    piece: Piece;
    state: PieceTileState;
    strokeWidth: number; // for highlighted tiles
}

const stateToClass: Record<PieceTileState, string> = {
    // class names used to apply CSS styling to piece tiles based on state
    "Inactive": "",
    "Normal": "active",
    "Selected": "selected",
    "Shaking": "active animated"
};

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

const bugTransforms: Record<PieceType, {
    scale: number; // best-looking relative scaling
    offset: [number, number]; // offest to center unscaled bug
}> = {
    Ant: { offset: [-60.02500, -62.88333], scale: 1.03351 },
    Beetle: { offset: [-40.8, -71.35833], scale: 1.05544 },
    Grasshopper: { offset: [-26.50833, -80.25], scale: 0.99999 },
    Ladybug: { offset: [-63.96667, -57.4], scale: 1.05577 },
    Mosquito: { offset: [-48.57500, -68.91666], scale: 1.11111 },
    Pillbug: { offset: [-43.86667, -66.34167], scale: 1.05793 },
    QueenBee: { offset: [-67.19167, -43.91666], scale: 1.16655 },
    Spider: { offset: [-38.31667, -68.51666], scale: 1.11138 }
};

const mouseDown = (props: PieceTileProps, e: MouseEvent) => {
    e.stopImmediatePropagation(); // prevent interfering with parent component
    if (props.state !== "Inactive") props.handleClick();
};

const PieceTile: (props: PieceTileProps) => h.JSX.Element = props => {
    const { type, color } = props.piece;
    const { scale, offset } = bugTransforms[type];

    return (
        <Fragment>
            <g
                class={`tile ${stateToClass[props.state]}`}
                style={`translate: ${props.pos.join("px ")}px`}
                onMouseDown={mouseDown.bind(this, props)}
            >
                <use
                    xlinkHref="#hex"
                    fill={tileColors[color]}
                    style={`stroke-width: ${props.strokeWidth}`}
                />
                <use
                    xlinkHref={`#${type}`}
                    transform={`scale(${scale})translate(${offset[0]},${offset[1]})`}
                    fill={bugColors[type]}
                    stroke={bugColors[type]}
                    style={`stroke-width: ${type === "Pillbug" ? 1 : 0}`}
                />
            </g>
        </Fragment>
    );
};

export default PieceTile;