import { Component, createRef, h, RefObject } from "preact";

import type { HexDimensions } from "@/types/client/tile";

import ConvertCoords, { SVGCoords } from "@/client/utility/convertCoords";

import TileDefs from "@/client/components/TileDefs";

export interface TileContainerProps {
    panAndZoom: boolean;
    initViewboxBound: number; // measured in hexagon radii
    hexDims?: HexDimensions; // if undefined, do not render TileDefs
}

interface TileContainerState {
    dragAnchor: SVGCoords;
    pan: SVGCoords;
    zoom: number;
    zoomOffset: SVGCoords;
}

export default class TileContainer extends Component<TileContainerProps, TileContainerState> {
    private svgRef: RefObject<SVGSVGElement> = createRef();

    public constructor() {
        super();
        this.state = {
            dragAnchor: [NaN, NaN],
            pan: [0, 0],
            zoom: 1,
            zoomOffset: [0, 0]
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
     * Update transform-related state (zoomOffset & zoom) to handle scrolling event (zooming).
     * We update zoomOffset in order to have zoom be centered on the cursor.
     * 
     * @param e wheel event representing user scrolling to adjust zoom
     */
    private handleZoom(e: WheelEvent): void {
        e.preventDefault();
        const svgCoords = this.mouseCoords(e);

        this.setState((state: TileContainerState) => {
            const { zoom } = state;
            const nextZoom = Math.min(Math.max(0.25, zoom + e.deltaY * -0.0008), 2);
            const ratio = 1 - nextZoom / zoom;
            const zoomOffset = state.zoomOffset.map((offset, i) =>
                offset + (svgCoords[i] - offset) * ratio) as SVGCoords;

            return { zoom: nextZoom, zoomOffset };
        });
    }

    /**
     * Update transform-related state (pan) to handle click-dragging (panning).
     * 
     * @param e mouse event representing mouse moving (while button 0 or 1 is held)
     */
    private handlePan(e: MouseEvent): void {
        const mouseCoords = this.mouseCoords(e);
        this.setState((state: TileContainerState) => ({
            pan: state.pan.map((p, i) =>
                p + mouseCoords[i] - state.dragAnchor[i]) as SVGCoords
        }));
    }

    private getHandler = (anchor: (e: MouseEvent) => SVGCoords, maxButton?: number) =>
        (e: MouseEvent) => {
            if (!maxButton || e.button <= maxButton) this.setState({ dragAnchor: anchor(e) });
        };
    private handleMouseDown = this.getHandler(e => this.mouseCoords(e), 1);
    private handleMouseUp = this.getHandler(() => [NaN, NaN], 1);
    private handleMouseLeave = this.getHandler(() => [NaN, NaN]);

    public override render(props: TileContainerProps): h.JSX.Element {
        const { pan, zoom, zoomOffset } = this.state;

        const bound = props.initViewboxBound * 100; // hex radius is globally fixed to 100
        const viewbox: number[] = [
            -bound - pan[0],
            -bound - pan[1] + 0.5,
            2 * bound,
            2 * bound
        ];

        const handlers = props.panAndZoom ? {
            onMouseDown: this.handleMouseDown.bind(this),
            onMouseLeave: this.handleMouseLeave.bind(this),
            onMouseMove: isNaN(this.state.dragAnchor[0]) ? undefined : this.handlePan.bind(this),
            onMouseUp: this.handleMouseUp.bind(this),
            onWheel: this.handleZoom.bind(this)
        } : {};

        return (
            <svg
                width="100%"
                height="100%"
                viewBox={viewbox.join(" ")}
                ref={this.svgRef}
                {...handlers}
            >
                <g transform={`translate(${zoomOffset.join(",")})scale(${zoom})`}>
                    {props.hexDims ? <TileDefs {...props.hexDims} /> : undefined}
                    {this.props.children}
                </g>
            </svg>
        );
    }
}