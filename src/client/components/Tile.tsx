import { Fragment, h } from "preact";

import "@/client/styles/PieceTile";

import type { Piece, PieceColor } from "@/types/common/game/piece";
import type { BaseTileProps } from "@/types/client/tile";
import { useContext } from "preact/hooks";

import { UISettingContext } from "@/client/components/GameUI";

export type TileState = "Normal" | "Inactive" | "Selected" | "Shaking";
export interface TileProps extends BaseTileProps {
    piece: Piece;
    state: TileState;
    showBadge?: boolean;
}

// TODO make these settings
const infoBadgeRadius = 90 / 6;
const infoBadgeMinInset = 120 / 6;

function renderInfoBadge(cornerRad: number, color: PieceColor, content: string): h.JSX.Element {
    const sqrt3: number = Math.sqrt(3);
    const inset: number = Math.max(cornerRad, infoBadgeMinInset);
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
                {content}
            </text>
        </g>
    );
}

// TODO add optional circle on tile with number for stack height / amount in inventory
function Tile(props: TileProps): h.JSX.Element {
    const hexDims = useContext(UISettingContext);

    const { height, type, color } = props.piece;
    const mouseDown = (e: MouseEvent) => {
        e.stopImmediatePropagation(); // prevent interfering with parent component
        if (props.state !== "Inactive" && props.handleClick) props.handleClick();
    };

    return (
        <Fragment>
            <g
                class={`tile ${props.state}`}
                style={`translate: ${props.pos.join("px ")}px`}
                onMouseDown={props.handleClick && mouseDown}
            >
                <use xlinkHref="#outlined-rounded-hex" class={color} />
                <use xlinkHref={`#${type}`} />
                {(props.showBadge || typeof props.showBadge === "undefined" && height && height > 1)
                    && renderInfoBadge(hexDims.cornerRad, color, `${height || 1}`)}
            </g>
        </Fragment>
    );
}

export default Tile;