import { h, VNode } from "preact";

import "@/client/styles/components/Placeholder";

import type { BaseTileProps } from "@/types/client/tile";
import type { MovementType } from "@/types/common/engine/outcomes";

export interface PlaceholderProps extends BaseTileProps {
    type: MovementType;
    handleMouseEnter?: () => void;
}

const mouseDown = (e: h.JSX.TargetedMouseEvent<SVGUseElement>) => e.stopImmediatePropagation();

function Placeholder(props: PlaceholderProps): VNode {
    const keyDown = (e: h.JSX.TargetedKeyboardEvent<SVGUseElement>) => {
        if ((e.key === "Enter" || e.key === " ") && props.handleClick) props.handleClick();
    };

    return (
        <use
            class={`placeholder ${props.type}`}
            xlinkHref="#placeholder"
            transform={`translate(${props.pos.join(",")})`}
            onMouseDown={mouseDown}
            onMouseUp={props.handleClick}
            onMouseEnter={props.handleMouseEnter}
            onKeyDown={keyDown}
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore (see https://github.com/preactjs/preact/issues/1061)
            tabindex={0}
        />
    );
}

export default Placeholder;