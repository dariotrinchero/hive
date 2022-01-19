import type { AdjFunc, BFSResults, Filter, Stringify, VertexSet } from "@/types/backEnd/graph";

export default class GraphUtils<V> {
    private stringify: Stringify<V>;

    public constructor(stringify?: Stringify<V>) {
        this.stringify = stringify || ((vertex: V) => JSON.stringify(vertex));
    }

    private *bfs(source: V, adj: AdjFunc<V>, maxDist?: number, collect?: Filter<V>): Generator<V, BFSResults<V>> {
        // initialize results
        const edgeTo: VertexSet<V> = {};
        const distance: { [v: string]: number; } = {};
        let connectedCount = 0;

        // mark & queue source
        const queue: V[] = [];
        distance[this.stringify(source)] = 0;
        queue.push(source);

        // process items on queue
        while (queue.length > 0) {
            const v: V = queue.shift() as V;
            const vDist: number = distance[this.stringify(v)];
            if (maxDist && vDist >= maxDist) break;

            // process unmarked adjacencies
            for (const w of adj(v, vDist)) {
                const wStr = this.stringify(w);
                if (typeof distance[wStr] !== "undefined") continue;

                // record new vertex
                edgeTo[wStr] = v;
                distance[wStr] = vDist + 1;
                connectedCount++;
                if (!collect || collect(w, vDist + 1)) yield w; // never collects 'source'

                queue.push(w);
            }
        }

        return { connectedCount, distance, edgeTo };
    }

    public *walkNSteps(source: V, adj: AdjFunc<V>, steps: number): Generator<V> {
        let currSet: VertexSet<V> = { [this.stringify(source)]: source };

        for (let distance = 0; distance < steps; distance++) {
            // take another step
            const nextSet: VertexSet<V> = {};
            for (const v of Object.values(currSet)) {
                for (const w of adj(v, distance)) {
                    const wStr = this.stringify(w); // may stringify a vertex multiple times
                    if (!nextSet[wStr]) {
                        if (distance === steps - 1) yield w;
                        nextSet[wStr] = w;
                    }
                }
            }

            // update set of visited vertices
            currSet = { ...nextSet };
        }
    }

    public countConnected(source: V, adj: AdjFunc<V>): number {
        const generator = this.bfs(source, adj);
        let next = generator.next();

        // since we omit a Filter<V>, this will always run 1 iteration
        while (!next.done) next = generator.next();
        return next.value.connectedCount;
    }

    public *collect(source: V, adj: AdjFunc<V>, maxDist?: number, collect?: Filter<V>): Generator<V> {
        yield* this.bfs(source, adj, maxDist, collect);
    }
}