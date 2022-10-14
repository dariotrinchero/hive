import { ComponentChildren, h, VNode } from "preact";
import { useEffect, useState } from "preact/hooks";

import ConvertCoords, { SVGCoords } from "@/client/utility/convertCoords";

export interface ViewPortProps {
    viewRange: [number, number]; // unzoomed, measured in hexagon radii
    origin: SVGCoords;
    interactable?: boolean;
    children: ComponentChildren;
}

interface Transform {
    pan: SVGCoords;
    zoom: number;
}

export default function ViewPort(props: ViewPortProps): VNode {
    const [dragStart, setDragStart] = useState<SVGCoords>([NaN, NaN]);
    const [transform, setTransform] = useState<Transform>({
        pan: [
            -100 * props.viewRange[0],
            -100 * props.viewRange[1]
        ],
        zoom: 1
    });

    useEffect(() => setTransform(transform => ({
        ...transform,
        pan: [
            -100 * props.viewRange[0] + props.origin[0],
            -100 * props.viewRange[1] + props.origin[1]
        ]
        // eslint-disable-next-line react-hooks/exhaustive-deps
    })), [props.origin[0], props.origin[1], props.viewRange[0], props.viewRange[1]]);

    /**
     * Get mouse cursor coordinates from given mouse event, in SVG coordinate system.
     * 
     * @param e mouse event, containing screen-space coordinates
     * @returns position at which mouse event occurred in SVG coordinates
     */
    function mouseCoords(e: h.JSX.TargetedMouseEvent<SVGSVGElement>): SVGCoords {
        return ConvertCoords.screenToSVG(e.currentTarget, e.clientX, e.clientY);
    }

    /**
     * Update transform-related state (pan & zoom) to handle scrolling event (zooming).
     * We update pan in order to have zoom be centered on the cursor.
     * 
     * @param e wheel event representing user scrolling to adjust zoom
     */
    function handleZoom(e: h.JSX.TargetedWheelEvent<SVGSVGElement>): void {
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
    function handlePan(e: h.JSX.TargetedMouseEvent<SVGSVGElement>): void {
        const mouse = mouseCoords(e);
        setTransform((prevTransform: Transform) => ({
            ...prevTransform,
            pan: prevTransform.pan.map((p, i) => p + dragStart[i] - mouse[i]) as SVGCoords
        }));
    }

    const getHandler = (pos?: SVGCoords, maxButton?: number) =>
        (e: h.JSX.TargetedMouseEvent<SVGSVGElement>) => {
            if (!maxButton || e.button <= maxButton) setDragStart(pos || mouseCoords(e));
        };
    const handleMouseDown = getHandler(undefined, 1);
    const handleMouseUp = getHandler([NaN, NaN], 1);
    const handleMouseLeave = getHandler([NaN, NaN]);

    const vbSize = props.viewRange.map(r => 200 * r / transform.zoom);
    const handlers = props.interactable ? {
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
            {...handlers}
        >
            {props.children}
        </svg>
    );
}