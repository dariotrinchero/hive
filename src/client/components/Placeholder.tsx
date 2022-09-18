import { Fragment, h } from "preact";

import "@/client/styles/Placeholder";

import type { BaseTileProps } from "@/types/client/tile";

export interface PlaceholderProps extends BaseTileProps {
    viaPillbug: boolean;
    handleMouseEnter: () => void;
}

const mouseDown = (e: MouseEvent) =>
    e.stopImmediatePropagation(); // prevent interfering with parent component

const Placeholder: (props: PlaceholderProps) => h.JSX.Element = props => {
    return (
        <Fragment>
            <use
                class={`placeholder ${props.viaPillbug ? "pillbug" : ""}`}
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