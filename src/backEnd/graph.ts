import { AdjFunc, BFSResults, Stringify } from "@/types/backEnd/graph";

export default class GraphUtils {
    public static bfs<V>(source: V, adj: AdjFunc<V>, stringify?: Stringify<V>): BFSResults<V> {
        stringify = stringify || ((vertex: V) => JSON.stringify(vertex));

        const edgeTo: { [edge: string]: V; } = {};
        const marked: { [edge: string]: boolean; } = {};
        const queue: V[] = [];

        let connectedCount = 0;
        marked[stringify(source)] = true;
        queue.push(source);
        while (queue.length > 0) {
            const v: V = queue.shift() as V;
            for (const w of adj(v)) {
                if (!marked[stringify(w)]) {
                    edgeTo[stringify(w)] = v;
                    marked[stringify(w)] = true;
                    queue.push(w);
                    connectedCount += 1;
                }
            }
        }

        return { connectedCount, edgeTo, marked, source };
    }
}