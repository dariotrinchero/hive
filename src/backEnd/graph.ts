import { AdjFunc, BFSResults, Filter, Stringify } from "@/types/backEnd/graph";

export default class GraphUtils<V> {
    private stringify: Stringify<V>;

    public constructor(stringify?: Stringify<V>) {
        this.stringify = stringify || ((vertex: V) => JSON.stringify(vertex));
    }

    private *bfs(source: V, adj: AdjFunc<V>, collect?: Filter<V>, maxDist?: number): Generator<V, BFSResults<V>> {
        // initialize results
        const edgeTo: { [v: string]: V; } = {};
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

            // enqueue unmarked adjacencies
            for (const w of adj(v, vDist)) {
                const wStr = this.stringify(w);
                if (typeof distance[wStr] === "undefined") { // w unmarked
                    edgeTo[wStr] = v;
                    distance[wStr] = vDist + 1;
                    connectedCount++;

                    queue.push(w);
                    if (!collect || collect(w, vDist + 1)) yield w;
                }
            }
        }

        return { connectedCount, distance, edgeTo };
    }

    public *walkNSteps(source: V, adj: AdjFunc<V>, steps: number): Generator<V, void, undefined> {
        let reached: V[] = [source];

        // perform all steps but one
        for (let distance = 0; distance < steps - 1; distance++) {
            const nextSet: { [v: string]: V; } = {};
            for (const v of reached) {
                for (const w of adj(v, distance)) nextSet[this.stringify(w)] = w;
            }
            reached = [...Object.values(nextSet)];
        }

        // perform last step online
        for (const v of reached) {
            for (const w of adj(v, steps - 1)) yield w;
        }
    }

    public countConnected(source: V, adj: AdjFunc<V>): number {
        const generator = this.bfs(source, adj);
        let next;
        do next = generator.next();
        while (!next.done);
        return next.value.connectedCount;
    }

    public *collect(source: V, adj: AdjFunc<V>, collect?: Filter<V>, maxDist?: number): Generator<V> {
        yield* this.bfs(source, adj, collect, maxDist);
    }
}