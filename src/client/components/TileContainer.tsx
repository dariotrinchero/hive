import { Component, createRef, h, RefObject } from "preact";

import type { HexDimensions } from "@/types/client/tile";

import ConvertCoords, { SVGCoords } from "@/client/utility/convertCoords";

import TileDefs from "@/client/components/TileDefs";

export interface TileContainerProps {
    panAndZoom: boolean;
    viewRange: number; // unzoomed, measured in hexagon radii
    hexDims?: HexDimensions; // if undefined, do not render TileDefs
    // TODO add ability to pass on 'omit' tag to inner <TileDefs>
}

interface TileContainerState {
    dragStart: SVGCoords;
    pan: SVGCoords;
    zoom: number;
}

export default class TileContainer extends Component<TileContainerProps, TileContainerState> {
    private svgRef: RefObject<SVGSVGElement> = createRef();

    public constructor(props: TileContainerProps) {
        super();
        this.state = {
            dragStart: [NaN, NaN],
            pan: [ // hex radius is globally fixed to 100
                -100 * props.viewRange,
                -100 * (props.viewRange - 0.5)
            ],
            zoom: 1
        };
    }

    /**
     * Get mouse cursor coordinates from given mouse event, in the SVG coordinate system.
     * Falls back on returning screen-space coordinates if the SVG to which we have a global
     * reference does not exist.
     * 
     * @param e mouse event, containing screen-space coordinates
     * @returns position at which mouse event occurred in SVG coordinates
     */
    private mouseCoords(e: MouseEvent): SVGCoords {
        const eventCoords: [number, number] = [e.clientX, e.clientY];
        return this.svgRef.current
            ? ConvertCoords.screenToSVG(this.svgRef.current, ...eventCoords)
            : eventCoords;
    }

    /**
     * Update transform-related state (pan & zoom) to handle scrolling event (zooming).
     * We update pan in order to have zoom be centered on the cursor.
     * 
     * @param e wheel event representing user scrolling to adjust zoom
     */
    private handleZoom(e: WheelEvent): void {
        e.preventDefault();
        const mouse = this.mouseCoords(e);
        this.setState((state: TileContainerState) => {
            const { pan, zoom } = state;
            const nextZoom = Math.min(Math.max(0.25, zoom + e.deltaY * -0.0008), 2);
            const ratio = 1 - zoom / nextZoom;
            return {
                pan: pan.map((p, i) => p + ratio * (mouse[i] - p)) as SVGCoords,
                zoom: nextZoom
            };
        });
    }

    /**
     * Update transform-related state (pan) to handle click-dragging (panning).
     * 
     * @param e mouse event representing mouse moving (while button 0 or 1 is held)
     */
    private handlePan(e: MouseEvent): void {
        const mouse = this.mouseCoords(e);
        this.setState((state: TileContainerState) => ({
            pan: state.pan.map((p, i) =>
                p + state.dragStart[i] - mouse[i]) as SVGCoords
        }));
    }

    private getHandler = (pos: (e: MouseEvent) => SVGCoords, maxButton?: number) =>
        (e: MouseEvent) => {
            if (!maxButton || e.button <= maxButton) this.setState({ dragStart: pos(e) });
        };
    private handleMouseDown = this.getHandler(e => this.mouseCoords(e), 1);
    private handleMouseUp = this.getHandler(() => [NaN, NaN], 1);
    private handleMouseLeave = this.getHandler(() => [NaN, NaN]);

    public override render(props: TileContainerProps): h.JSX.Element {
        const { dragStart, pan, zoom } = this.state;
        const vbSize = 200 * props.viewRange / zoom;
        const handlers = props.panAndZoom ? {
            onMouseDown: this.handleMouseDown.bind(this),
            onMouseLeave: this.handleMouseLeave.bind(this),
            onMouseMove: isNaN(dragStart[0]) ? undefined : this.handlePan.bind(this),
            onMouseUp: this.handleMouseUp.bind(this),
            onWheel: this.handleZoom.bind(this)
        } : {};

        return (
            <svg
                width="100%"
                height="100%"
                viewBox={[...pan, vbSize, vbSize].join(" ")}
                ref={this.svgRef}
                {...handlers}
            >
                {props.hexDims ? <TileDefs dims={props.hexDims} /> : undefined}
                {this.props.children}
            </svg>
        );
    }
}