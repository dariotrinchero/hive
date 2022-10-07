import { h } from "preact";

import icons from "@/client/assets/icons.json";

import type { PieceType } from "@/types/common/engine/piece";
import { useContext, useEffect, useState } from "preact/hooks";

import { UISettingContext } from "@/client/components/GameUI";

function HexDefs(): h.JSX.Element {
    const [bugPaths, setBugPaths] = useState<Record<PieceType, string>>();

    useEffect(() => {
        fetch(icons)
            .then(response => response.json())
            .then(json => setBugPaths(json as Record<PieceType, string>))
            .catch(err => console.error("Error while fetching bug icons:", err));
    }, []);

    const { cornerRad } = useContext(UISettingContext);

    /**
     * Get path definition for hexagon of fixed radius 100, with rounded corners of radius
     * given by props.
     *
     * @returns path definition (attribute 'd' of SVG <path> element)
     */
    function roundedHexPath(): string {
        const thirdPi: number = Math.PI / 3;
        const innerRad: number = 100 - 2 * cornerRad / Math.sqrt(3);

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
        return `${hexPath}Z`; // close path
    }

    /**
     * Render placeholder group (with ID #placeholder).
     * 
     * @returns Fragment containing a child group containing prototypical placeholder
     */
    function renderPlaceholderDef(): h.JSX.Element {
        return (
            <g id="placeholder">
                {[0.95, 0.6].map((scale, index) =>
                    <use
                        key={index}
                        xlinkHref="#rounded-hex"
                        transform={`scale(${scale})`}
                        style={index === 0 ? "stroke-dasharray: 10,6" : ""}
                    />
                )}
            </g>
        );
    }

    return (
        <svg width={0} height={0}>
            <defs>
                <path
                    id="rounded-hex"
                    d={roundedHexPath()}
                />
                {bugPaths && Object.entries(bugPaths).map(
                    ([bug, path]) => <path key={bug} id={bug} d={path} />
                )}
                {renderPlaceholderDef()}
            </defs>
        </svg>
    );
}

export default HexDefs;