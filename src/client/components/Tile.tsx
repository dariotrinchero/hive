import { Fragment, h } from "preact";
import { useContext } from "preact/hooks";

import "@/client/styles/Tile";

import type { Piece } from "@/types/common/game/piece";
import type { BaseTileProps } from "@/types/client/tile";
import type { SVGCoords } from "@/client/utility/convertCoords";

import { UISettingContext } from "@/client/components/GameUI";

export type TileState = "Normal" | "Inactive" | "Selected" | "Shaking" | "Sliding" | "Dropping";
export interface TileProps extends BaseTileProps {
    piece: Piece;
    state: TileState;
    slideFrom?: SVGCoords;
}

// TODO make these settings
const infoBadgeRadius = 90 / 6;
const infoBadgeMinInset = 120 / 6;

function Tile(props: TileProps): h.JSX.Element {
    const hexDims = useContext(UISettingContext);

    const { height, type, color } = props.piece;

    function renderInfoBadge(): h.JSX.Element | undefined {
        if (!height || height < 2) return;

        const sqrt3: number = Math.sqrt(3);
        const inset: number = Math.max(hexDims.cornerRad, infoBadgeMinInset);
        const scaledOvershoot: number = 0.9 * (inset - infoBadgeMinInset);
        const halfRad: number = 50 - inset / sqrt3;
        const [cx, cy] = [
            sqrt3 * halfRad + scaledOvershoot,
            -halfRad - 0.5 * scaledOvershoot
        ];

        return (
            <g id="info-badge" class={color}>
                <circle cx={cx} cy={cy} r={infoBadgeRadius} />
                <text dominant-baseline="central" x={cx} y={cy}>
                    {height}
                </text>
            </g>
        );
    }

    const mouseDown = (e: MouseEvent) => {
        e.stopImmediatePropagation(); // prevent interfering with parent component
        if (props.state !== "Inactive" && props.handleClick) props.handleClick();
    };
    const translate = `translate: ${props.pos.join("px ")}px`;

    return (
        <Fragment>
            {props.slideFrom && <style>{`
                @keyframes tileslide {
                    from { translate: ${props.slideFrom.join("px ")}px }
                    to { ${translate} }
                }
            `}</style>}
            <g
                class={`tile ${props.state}`}
                style={translate}
                onMouseDown={props.handleClick && mouseDown}
            >
                <use xlinkHref="#outlined-rounded-hex" class={color} />
                <use xlinkHref={`#${type}`} />
                {renderInfoBadge()}
            </g>
        </Fragment>
    );
}

export default Tile;