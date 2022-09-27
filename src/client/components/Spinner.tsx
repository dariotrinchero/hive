import { h } from "preact";

import "@/client/styles/Spinner";

import ConvertCoords from "@/client/utility/convertCoords";

import ViewPort from "@/client/components/ViewPort";

const hexGap = 100 / 18;

const shift = ConvertCoords.hexLatticeToSVG(hexGap, 1, 0);
const pivot = ConvertCoords.hexLatticeToSVG(hexGap, -2 / 3, 1 / 3);
const style = `translate: ${shift.join("px ")}px;`
    + `transform-origin: ${pivot.join("px ")}px`;

function Spinner(): h.JSX.Element {
    return (
        <ViewPort viewRange={[8, 8]}>
            <g class="spinner">
                <use xlinkHref="#rounded-hex" />
                <use
                    xlinkHref="#rounded-hex"
                    class="rolling"
                    style={style}
                />
            </g>
        </ViewPort>
    );
}

export default Spinner;