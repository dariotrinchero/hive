import type {
    Adj,
    BFSAdj,
    BFSResults,
    Filter,
    IsCutVertex,
    PathMap,
    Stringify
} from "@/types/common/engine/graph";

/**
 * Utility class containing static functions implementing graph algorithms helpful for generating /
 * validating Hive moves. Included is breadth-first-search to find shortest paths, an algorithm to
 * find paths of specified length N, and Tarjan & Hopcroft algorithm for finding cut vertices.
 * 
 * Results are generated online where possible to allow caller logic to short-circuit algorithms;
 * we thus also include methods to merge resulting generators & path maps.
 */
export default class GraphUtils<V> {
    private readonly stringify: Stringify<V>;

    public constructor(stringify?: Stringify<V>) {
        this.stringify = stringify || ((vertex: V) => JSON.stringify(vertex));
    }

    /**
     * Merge several given path maps (functions mapping a vertex to a list of vertices, representing a
     * "path" to the given vertex), m1,...,mn, into a single new path map, m. The new map m sends an
     * input vertex v to the first path of non-zero length in the list m1(v),...,mn(v), or otherwise
     * to the zero-length path, [].
     * 
     * @param paths array of path maps to merge
     * @returns path map obtained by merging all of the given path maps in the way described above
     */
    public static mergePaths<V>(...paths: PathMap<V>[]): PathMap<V> {
        return (vertex: V) => {
            // return first path provided by any path-function collected
            for (const path of paths) {
                const pathResult = path(vertex);
                if (pathResult.length !== 0) return pathResult;
            }
            return [];
        };
    }

    /**
     * Merge several given generators, all yielding vertices and returning path maps (functions mapping
     * a vertex to a list of vertices, representing a "path" to the given vertex), into a single generator
     * which yields successively from each of those given. Finally, return a new path map which is the
     * result of merging all of those returned by the given generators.
     * 
     * @see mergePaths
     * @param generators array of generators to merge
     * @yields all vertices yielded by each of the given generators in turn
     * @returns path map obtained by merging all of the path maps returned by the given generators
     */
    public static *mergeGenerators<V>(...generators: Generator<V, PathMap<V>>[]): Generator<V, PathMap<V>> {
        const paths: PathMap<V>[] = [];

        for (const generator of generators) {
            // yield from each generator in turn
            let next: IteratorResult<V, PathMap<V>>;
            next = generator.next();
            while (!next.done) {
                yield next.value;
                next = generator.next();
            }
            // collect path functions
            paths.push(next.value);
        }

        return GraphUtils.mergePaths(...paths);
    }

    /**
     * Performs breadth-first search (BFS) from given source vertex, yielding all vertices (except source
     * vertex itself) reached within some given maximum distance for which given filter function returns true.
     * Also aggregates results in lookup table which stores, for each reached vertex, its distance from the
     * source, the previous vertex in the BFS tree, and whether it passed the filter.
     * 
     * @param source vertex in graph at which to begin search, and from which distance is measured
     * @param adj adjacency function defining graph (may depend both on a vertex and its distance from source)
     * @param maxDist maximum distance from source vertex within which to search
     * @param filter filter function determining which reached vertices are yielded
     * @yields all reached vertices which pass the filter function
     * @returns record aggregating information for each reached vertex, including previous vertex in BFS tree
     */
    private *bfs(source: V, adj: BFSAdj<V>, maxDist?: number, filter?: Filter<V>): Generator<V, BFSResults<V>> {
        const results: BFSResults<V> = {};

        // mark & queue source
        const queue: V[] = [source];
        results[this.stringify(source)] = { distance: 0, passedFilter: false };

        // process items on queue
        while (queue.length > 0) {
            const v: V = queue.shift() as V;
            const vDist: number = results[this.stringify(v)].distance;
            if (typeof maxDist !== "undefined" && vDist >= maxDist) break;

            // process unmarked adjacencies
            for (const w of adj(v, vDist)) {
                const wStr = this.stringify(w);
                if (typeof results[wStr] !== "undefined") continue;

                // yield (if applicable) then record new vertex
                let yielded = false;
                if (!filter || filter(w, vDist + 1)) {
                    yield w;
                    yielded = true;
                }
                results[wStr] = { distance: vDist + 1, passedFilter: yielded, previous: v };

                queue.push(w);
            }
        }

        return results;
    }

    /**
     * Performs breadth-first search (BFS) from given source vertex, yielding all vertices (except source
     * vertex itself) reached within some given maximum distance for which given filter function returns true.
     * Returns function mapping any yielded vertex to a list of vertices, representing the shortest path from
     * the source vertex to that given.
     * 
     * @param source vertex in graph at which to begin search, and from which distance is measured
     * @param adj adjacency function defining graph (may depend both on a vertex and its distance from source)
     * @param maxDist maximum distance from source vertex within which to search
     * @param filter filter function determining which reached vertices are yielded
     * @yields all reached vertices which pass the filter function
     * @returns map to get shortest path from source vertex to given yielded vertex
     */
    public *genShortestPaths(source: V, adj: BFSAdj<V>, maxDist?: number, filter?: Filter<V>): Generator<V, PathMap<V>> {
        // yield valid endpoints
        const generator = this.bfs(source, adj, maxDist, filter);
        let next = generator.next();
        while (!next.done) {
            yield next.value;
            next = generator.next();
        }

        const bfsResults = next.value;
        return (vertex: V) => {
            // there is no path to invalid endpoint
            const vStr = this.stringify(vertex);
            if (!bfsResults[vStr]?.passedFilter) return [];

            // build path from steps taken
            const path: V[] = [];
            let currVertex = bfsResults[vStr].previous;
            while (currVertex) {
                path.push(currVertex);
                currVertex = bfsResults[this.stringify(currVertex)]?.previous;
            }
            return path;
        };
    }

    /**
     * Explores given number of steps out in any direction from (given) source vertex. Yields all vertices
     * reachable within so many steps. Revisiting edges is allowed - in particular, for an undirected graph
     * we may traverse the same edge even on successive steps. Returns function mapping any yielded vertex
     * to a list of vertices, representing a length-'steps' path from the source vertex to that given; if
     * many such paths exist, an arbitrary one is selected.
     * 
     * @param source vertex in graph at which to begin search, and from which steps are counted
     * @param adj adjacency function defining graph (may depend both on a vertex and current step count)
     * @param steps number of steps to take from source vertex, assumed > 0
     * @yields all vertices reached within given number of steps
     * @returns map to get (any possible) length-'steps' path from source vertex to given yielded vertex
     */
    public *genLengthNPaths(source: V, adj: BFSAdj<V>, steps: number): Generator<V, PathMap<V>> {
        let currSet: { [v: string]: V; } = { [this.stringify(source)]: source };
        const edgeTo: { [v: string]: V; } = {};

        for (let distance = 0; distance < steps; distance++) {
            // take another step
            const nextSet: { [v: string]: V; } = {};
            for (const v of Object.values(currSet)) {
                for (const w of adj(v, distance)) {
                    const wStr = this.stringify(w); // may stringify a vertex multiple times
                    if (!nextSet[wStr]) {
                        if (distance === steps - 1) yield w;
                        nextSet[wStr] = w;
                    }
                    edgeTo[`${wStr},${distance}`] = v;
                }
            }
            // update set of visited vertices
            currSet = { ...nextSet };
        }

        return (vertex: V) => {
            // build path from steps taken
            const path: V[] = [];
            let distance = steps - 1;
            let currVertex = edgeTo[`${this.stringify(vertex)},${distance--}`];
            while (currVertex) {
                path.push(currVertex);
                currVertex = edgeTo[`${this.stringify(currVertex)},${distance--}`];
            }
            return path;
        };
    }

    /**
     * Find all 'cut vertices' - ie. vertices whose removal increases the number of connected components
     * of graph (as opposed to 'biconnected' vertices) - using algorithm by Tarjan & Hopcroft (see link).
     * 
     * @link https://en.wikipedia.org/wiki/Biconnected_component
     * @param source any vertex in graph at which to begin search
     * @param adj adjacency function defining graph
     * @returns function to test whether given vertex is a cut vertex (connected to source vertex)
     */
    public getCutVertices(source: V, adj: Adj<V>): IsCutVertex<V> {
        // initialize data structures
        const depth: { [v: string]: number; } = {};
        const lowpoint: { [v: string]: number; } = {};
        const parent: { [v: string]: string; } = {};
        const cutVertices: { [v: string]: boolean; } = {};

        // define recursive Tarjan & Hopcroft algorithm
        const tarjanHopcroft = (v: V, d: number) => {
            const vStr: string = this.stringify(v);
            depth[vStr] = d;
            lowpoint[vStr] = d;

            let childCount = 0;
            let isCutVertex = false;

            adj(v).forEach(w => {
                const wStr: string = this.stringify(w);
                if (typeof depth[wStr] === "undefined") { // if not visited
                    parent[wStr] = vStr;
                    tarjanHopcroft(w, d + 1);

                    childCount++;
                    isCutVertex ||= lowpoint[wStr] >= depth[vStr];

                    lowpoint[vStr] = Math.min(lowpoint[vStr], lowpoint[wStr]);
                } else if (wStr !== parent[vStr]) {
                    lowpoint[vStr] = Math.min(lowpoint[vStr], depth[wStr]);
                }
            });

            if (parent[vStr] && isCutVertex
                || !parent[vStr] && childCount > 1) cutVertices[vStr] = true;
        };

        tarjanHopcroft(source, 0);
        return (v: V) => cutVertices[this.stringify(v)] || false;
    }
}