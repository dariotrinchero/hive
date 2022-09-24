import { Fragment, h } from "preact";

import icons from "@/client/icons.json";

import type { PieceType } from "@/types/common/game/piece";
import type { HexDimensions } from "@/types/client/tile";

export interface TileDefsProps {
    dims: HexDimensions;
    omit?: {
        placeholder?: boolean;
        bugs?: boolean;
    };
}

const bugPaths: Record<PieceType, string> = icons;

/**
 * Get path definition for hexagon of given radius, with rounded corners of given radius.
 *
 * @param hexRad radius of circle in which un-rounded hexagon fits snugly
 * @param cornerRad radius of circle arcs to use for rounding corners (cuts off corner)
 * @returns path definition (attribute 'd' of SVG <path> element)
 */
const roundedHexPath: (hexRad: number, cornerRad: number) => string = (hexRad, cornerRad) => {
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
};

/**
 * Render bug icon paths, each with ID set to the bug type.
 * 
 * @param props props for this component, including whether to define bug paths
 * @returns Fragment containing a child path for each bug type
 */
const renderBugDefs: (props: TileDefsProps) => h.JSX.Element = props => (
    <Fragment>
        {!props.omit?.bugs &&
            Object.entries(bugPaths).map(([bug, path]) =>
                <path key={bug} id={bug} d={path} />)
        }
    </Fragment>
);

/**
 * Render placeholder group (with ID #placeholder).
 * 
 * @param props props for this component, including whether to define placeholders
 * @returns Fragment containing a child group containing prototypical placeholder
 */
const renderPlaceholderDefs: (props: TileDefsProps) => h.JSX.Element = props => (
    <Fragment>
        {!props.omit?.placeholder &&
            <g
                id="placeholder"
                style={`stroke-width: ${0.7 * props.dims.gap}px`}
            >
                {[0.95, 0.6].map((scale, index) =>
                    <use
                        key={index}
                        xlinkHref="#rounded-hex"
                        transform={`scale(${scale})`}
                        style={index === 0 ? "stroke-dasharray:10,6" : ""}
                    />
                )}
            </g>
        }
    </Fragment>
);

const TileDefs: (props: TileDefsProps) => h.JSX.Element = props => {
    return (
        <defs>
            <g
                id="outlined-rounded-hex"
                style={`stroke-width:${props.dims.gap * Math.sqrt(3)};`}
            >
                <path
                    id="rounded-hex"
                    d={roundedHexPath(100, props.dims.cornerRad)} // hex radius is globally fixed to 100
                />
            </g>
            {renderPlaceholderDefs(props)}
            {renderBugDefs(props)}
        </defs>
    );
};

export default TileDefs;