import { Fragment, h } from "preact";

import "@/client/styles/Placeholder";

import type { BaseTileProps } from "@/types/client/tile";
import type { MovementType } from "@/types/common/game/outcomes";

export interface PlaceholderProps extends BaseTileProps {
    movementType: MovementType;
    handleMouseEnter: () => void;
}

const mouseDown = (e: MouseEvent) =>
    e.stopImmediatePropagation(); // prevent interfering with parent component

const Placeholder: (props: PlaceholderProps) => h.JSX.Element = props => {
    return (
        <Fragment>
            <use
                class={`placeholder ${props.movementType === "Pillbug" ? "pillbug" : ""}`}
                xlinkHref="#placeholder"
                transform={`translate(${props.pos.join(",")})`}
                onMouseDown={mouseDown}
                onMouseUp={props.handleClick}
                onMouseEnter={props.handleMouseEnter}
            />
        </Fragment>
    );
};

export default Placeholder;