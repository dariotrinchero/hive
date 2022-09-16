import type { Adj, BFSAdj, BFSResults, EdgeTo, Filter, PathMap, Stringify } from "@/types/common/game/graph";

export default class GraphUtils<V> {
    private readonly stringify: Stringify<V>;

    public constructor(stringify?: Stringify<V>) {
        this.stringify = stringify || ((vertex: V) => JSON.stringify(vertex));
    }

    public static mergePathMaps<V>(...paths: PathMap<V>[]): PathMap<V> {
        return (vertex: V) => {
            // return first path provided by any path-function collected
            for (const path of paths) {
                const pathResult = path(vertex);
                if (pathResult.length !== 0) return pathResult;
            }
            return [];
        };
    }

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

        return GraphUtils.mergePathMaps(...paths);
    }

    // NOTE (intentionally) never yields 'source'
    private *bfs(source: V, adj: BFSAdj<V>, maxDist?: number, isEndpoint?: Filter<V>): Generator<V, BFSResults<V>> {
        // initialize results
        const edgeTo: EdgeTo<V> = {};
        const distance: { [v: string]: number; } = {};

        // mark & queue source
        const queue: V[] = [source];
        distance[this.stringify(source)] = 0;

        // process items on queue
        while (queue.length > 0) {
            const v: V = queue.shift() as V;
            const vDist: number = distance[this.stringify(v)];
            if (maxDist && vDist >= maxDist) break;

            // process unmarked adjacencies
            for (const w of adj(v, vDist)) {
                const wStr = this.stringify(w);
                if (typeof distance[wStr] !== "undefined") continue;

                // yield (if applicable) then record new vertex
                let yielded = false;
                if (isEndpoint && isEndpoint(w, vDist + 1)) {
                    yield w;
                    yielded = true;
                }
                edgeTo[wStr] = { isEndpoint: yielded, previous: v };
                distance[wStr] = vDist + 1;

                queue.push(w);
            }
        }

        return { distance, edgeTo };
    }

    public *generatePaths(source: V, adj: BFSAdj<V>, maxDist?: number, isEndpoint?: Filter<V>): Generator<V, PathMap<V>> {
        // yield valid endpoints
        const generator = this.bfs(source, adj, maxDist, isEndpoint || (() => true));
        let next = generator.next();
        while (!next.done) {
            yield next.value;
            next = generator.next();
        }

        const edgeTo = next.value.edgeTo;
        return (vertex: V) => {
            // there is no path to invalid endpoint
            const vStr = this.stringify(vertex);
            if (!edgeTo[vStr] || !edgeTo[vStr].isEndpoint) return [];

            // build path from steps taken
            const path: V[] = [];
            let currVertex = edgeTo[vStr].previous;
            while (currVertex) {
                path.push(currVertex);
                currVertex = edgeTo[this.stringify(currVertex)]?.previous;
            }
            return path;
        };
    }

    public *generateLengthNPaths(source: V, adj: BFSAdj<V>, steps: number): Generator<V, PathMap<V>> {
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
            let distance = 2;
            let currVertex = edgeTo[`${this.stringify(vertex)},${distance--}`];
            while (currVertex) {
                path.push(currVertex);
                currVertex = edgeTo[`${this.stringify(currVertex)},${distance--}`];
            }
            return path;
        };
    }

    // TODO use Tarjan & Hopcroft's algorithm to compute ALL articulation points in a single DFS, then store
    // this data & refresh it each move (see https://en.wikipedia.org/wiki/Biconnected_component).

    /**
     * Determine whether the given vertex is an articulation point - that is, a point whose removal increases
     * the number of connected components of the graph - as opposed to a biconnected vertex.
     * 
     * @param source vertex to test
     * @returns whether given vertex is an articulation point
     */
    public isArticulationPoint(source: V, adj: Adj<V>): boolean {
        // initialize data structures
        const marked: { [v: string]: boolean; } = {};
        marked[this.stringify(source)] = true;
        const stack: V[] = adj(source);

        const sourceAdj = stack.length;
        let sourceDFSChildren = 0;

        // process items on stack
        while (stack.length > 0) {
            const v: V = stack.pop() as V;
            const vStr = this.stringify(v);
            if (marked[vStr]) continue;

            // count children of source in DFS tree
            if (stack.length < sourceAdj) sourceDFSChildren++;

            // mark vertex & push all adjacencies
            marked[vStr] = true;
            adj(v).forEach(w => stack.push(w));
        }

        return sourceDFSChildren > 1;
    }
}