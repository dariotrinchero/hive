import { h } from "preact";

import "@/client/styles/Placeholder";

import type { BaseTileProps } from "@/types/client/tile";
import type { MovementType } from "@/types/common/game/outcomes";

export interface PlaceholderProps extends BaseTileProps {
    type: MovementType;
    handleMouseEnter?: () => void;
}

const mouseDown = (e: MouseEvent) =>
    e.stopImmediatePropagation(); // prevent interfering with parent component

function Placeholder(props: PlaceholderProps): h.JSX.Element {
    return (
        <use
            class={`placeholder ${props.type}`}
            xlinkHref="#placeholder"
            transform={`translate(${props.pos.join(",")})`}
            onMouseDown={mouseDown}
            onMouseUp={props.handleClick}
            onMouseEnter={props.handleMouseEnter}
        />
    );
}

export default Placeholder;