import { BFSResults } from "@/types/backEnd/graph";

export default class GraphUtils {
    public static bfs<V>(source: V, adj: (vertex: V) => V[]): BFSResults<V> {
        const edgeTo: { [edge: string]: V; } = {};
        const marked: { [edge: string]: boolean; } = {};
        const queue: V[] = [];

        let connectedCount = 0;
        marked[JSON.stringify(source)] = true;
        queue.push(source);
        while (queue.length > 0) {
            const v: V = queue.shift() as V;
            adj(v).forEach((w: V) => {
                if (!marked[JSON.stringify(w)]) {
                    edgeTo[JSON.stringify(w)] = v;
                    marked[JSON.stringify(w)] = true;
                    queue.push(w);
                    connectedCount += 1;
                }
            });
        }

        return { connectedCount, edgeTo, marked, source };
    }
}