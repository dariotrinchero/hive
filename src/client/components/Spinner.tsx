import { h } from "preact";

import "@/client/styles/Spinner";

import type { HexDimensions } from "@/types/client/tile";

import ConvertCoords from "@/client/utility/convertCoords";

import TileContainer from "@/client/components/TileContainer";

const hexDims: HexDimensions = { cornerRad: 100 / 6, gap: 100 / 18 };
const shift = ConvertCoords.hexLatticeToSVG(hexDims.gap, 1, 0);
const pivot = ConvertCoords.hexLatticeToSVG(hexDims.gap, -2, 1).map(c => c / 3);
const style = `translate: ${shift.join("px ")}px;`
    + `transform-origin: ${pivot.join("px ")}px`;

const Spinner: () => h.JSX.Element = () => (
    <TileContainer
        initViewboxBound={8}
        panAndZoom={false}
        hexDims={hexDims}
    >
        <g class="spinner">
            <use xlinkHref="#hex" />
            <use
                xlinkHref="#hex"
                class="rolling"
                style={style}
            />
        </g>
    </TileContainer>
);

export default Spinner;