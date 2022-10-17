import type { h, VNode } from "preact";
import { useContext } from "preact/hooks";

import "@/client/styles/components/Tile";

import type { Piece } from "@/types/common/engine/piece";
import type { BaseTileProps } from "@/types/client/tile";
import type { SVGCoords } from "@/client/utility/convertCoords";

import { UISettingContext } from "@/client/pages/Game";

export type TileStatus = "Normal" | "Inactive" | "Selected" | "Shaking" | "Sliding" | "Dropping";
export interface TileProps extends BaseTileProps {
    piece: Piece;
    status: TileStatus;
    slideFrom?: SVGCoords;
}

// TODO make these settings
const infoBadgeRadius = 90 / 6;
const infoBadgeMinInset = 120 / 6;

export default function Tile(props: TileProps): VNode {
    const { cornerRad } = useContext(UISettingContext);

    const { height, type, color } = props.piece;

    function renderInfoBadge(): VNode | undefined {
        if (!height || height < 2) return;

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
                    {height}
                </text>
            </g>
        );
    }

    const mouseDown = (e?: h.JSX.TargetedMouseEvent<SVGGElement>) => {
        e?.stopImmediatePropagation();
        if (props.status !== "Inactive" && props.handleClick) props.handleClick();
    };
    const keyDown = (e: h.JSX.TargetedKeyboardEvent<SVGGElement>) => {
        if (e.key === "Enter" || e.key === " ") mouseDown();
    };
    const translate = `translate: ${props.pos.join("px ")}px`;

    return (
        <>
            {props.slideFrom && <style>{`
                @keyframes tileslide {
                    from { translate: ${props.slideFrom.join("px ")}px }
                    to { ${translate} }
                }
            `}</style>}
            <g
                class={`tile ${props.status}`}
                style={translate}
                onMouseDown={props.handleClick && mouseDown}
                role="button"
                onKeyDown={props.handleClick && keyDown}
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore (see https://github.com/preactjs/preact/issues/1061)
                tabindex={props.status !== "Inactive" ? 0 : -1}
            >
                <use xlinkHref="#rounded-hex" class={color} />
                <use xlinkHref={`#${type}`} />
                {renderInfoBadge()}
            </g>
        </>
    );
}