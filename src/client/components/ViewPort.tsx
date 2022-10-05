import { ComponentChildren, h } from "preact";
import { useRef, useState } from "preact/hooks";

import ConvertCoords, { SVGCoords } from "@/client/utility/convertCoords";

export interface ViewPortProps {
    panAndZoom?: boolean;
    viewRange: [number, number]; // unzoomed, measured in hexagon radii
    children?: ComponentChildren;
}

interface Transform {
    pan: SVGCoords;
    zoom: number;
}

export default function ViewPort(props: ViewPortProps): h.JSX.Element {
    const svgRef = useRef<SVGSVGElement>(null);

    const [dragStart, setDragStart] = useState<SVGCoords>([NaN, NaN]);
    const [transform, setTransform] = useState<Transform>({
        pan: [ // hex radius is globally fixed to 100
            -100 * props.viewRange[0],
            -100 * props.viewRange[1]
        ],
        zoom: 1
    });

    /**
     * Get mouse cursor coordinates from given mouse event, in the SVG coordinate system.
     * Falls back on returning screen-space coordinates if the SVG to which we have a global
     * reference does not exist.
     * 
     * @param e mouse event, containing screen-space coordinates
     * @returns position at which mouse event occurred in SVG coordinates
     */
    function mouseCoords(e: MouseEvent): SVGCoords {
        const eventCoords: [number, number] = [e.clientX, e.clientY];
        return svgRef.current
            ? ConvertCoords.screenToSVG(svgRef.current, ...eventCoords)
            : eventCoords;
    }

    /**
     * Update transform-related state (pan & zoom) to handle scrolling event (zooming).
     * We update pan in order to have zoom be centered on the cursor.
     * 
     * @param e wheel event representing user scrolling to adjust zoom
     */
    function handleZoom(e: WheelEvent): void {
        e.preventDefault();
        const mouse = mouseCoords(e);
        setTransform((prevTransform: Transform) => {
            const { pan, zoom } = prevTransform;
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
    function handlePan(e: MouseEvent): void {
        const mouse = mouseCoords(e);
        setTransform((prevTransform: Transform) => ({
            ...prevTransform,
            pan: prevTransform.pan.map((p, i) => p + dragStart[i] - mouse[i]) as SVGCoords
        }));
    }

    const getHandler = (pos: (e: MouseEvent) => SVGCoords, maxButton?: number) =>
        (e: MouseEvent) => {
            if (!maxButton || e.button <= maxButton) setDragStart(pos(e));
        };
    const handleMouseDown = getHandler(e => mouseCoords(e), 1);
    const handleMouseUp = getHandler(() => [NaN, NaN], 1);
    const handleMouseLeave = getHandler(() => [NaN, NaN]);

    const vbSize = props.viewRange.map(r => 200 * r / transform.zoom);
    const handlers = props.panAndZoom ? {
        onMouseDown: handleMouseDown,
        onMouseLeave: handleMouseLeave,
        onMouseMove: isNaN(dragStart[0]) ? undefined : handlePan,
        onMouseUp: handleMouseUp,
        onWheel: handleZoom
    } : {};

    return (
        <svg
            width="100%"
            height="100%"
            viewBox={[...transform.pan, ...vbSize].join(" ")}
            ref={svgRef}
            {...handlers}
        >
            {props.children}
        </svg>
    );
}