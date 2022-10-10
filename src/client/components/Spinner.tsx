import { h, VNode } from "preact";

import "@/client/styles/Spinner";

import ConvertCoords from "@/client/utility/convertCoords";

const hexGap = 100 / 18;

const shift = ConvertCoords.hexLatticeToSVG(hexGap, 1, 0);
const pivot = ConvertCoords.hexLatticeToSVG(hexGap, -2 / 3, 1 / 3);
const style = `translate: ${shift.join("px ")}px;`
    + `transform-origin: ${pivot.join("px ")}px`;

function Spinner(): VNode {
    return (
        <svg viewBox="-800 -800 1600 1600" width="100%" height="100%">
            <g class="spinner">
                <use xlinkHref="#rounded-hex" />
                <use
                    xlinkHref="#rounded-hex"
                    class="rolling"
                    style={style}
                />
            </g>
        </svg>
    );
}

export default Spinner;