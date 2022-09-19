export type SVGCoords = [number, number];

export default class ConvertCoords {
    /**
     * Map screen coordinates to corresponding SVG coordinates using coordinate tranform matrix (CTM).
     * This is needed when the SVG is scaled according to the viewBox attribute.
     * 
     * @param svg the svg element into whose coordinates we convert
     * @param x x coordinate in screen space
     * @param y y coordinate in screen space
     * @returns corresponding position in SVG coorindate system
     */
    public static screenToSVG(svg: SVGSVGElement, x: number, y: number): SVGCoords {
        const screenCTM = svg.getScreenCTM();
        const mappedCoords = new DOMPoint(x, y).matrixTransform(screenCTM?.inverse());
        return [mappedCoords.x, mappedCoords.y];
    }

    /**
     * Convert lattice coordinates (ie. integer coefficients u, v for hexagonal lattice base vectors)
     * to ordinary cartesian coordinates used by SVG, assuming (globally standard & fixed) hexagon radius
     * of 100.
     * 
     * @param hexGap gap between adjacent hexagons' circumcircles
     * @param u coefficient of horizontal lattice base vector
     * @param v coefficient of lattice base vector along pi/3 inclination
     * @returns position of tile in SVG rectilinear coordinates
     */
    public static hexLatticeToSVG(hexGap: number, u: number, v: number): SVGCoords {
        const radPlusGap = 100 + hexGap;
        return [Math.sqrt(3) * radPlusGap * (u + v / 2), 1.5 * radPlusGap * v];
    }
}