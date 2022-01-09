import { BFSResults } from "@/types/logic/graph";

export default class GraphUtils {
    public static bfs<V>(source: V, adj: (vertex: V) => V[]): BFSResults<V> {
        const edgeTo = new Map<V, V>();
        const marked = new Map<V, boolean>();
        const connectedCount: number = 0;

        const queue: V[] = [];
        marked.set(source, true);
        queue.push(source);
        while (queue.length > 0) {
            const v: V = queue.shift() as V;
            adj(v).forEach((w: V) => {
                if (!marked.get(w)) {
                    edgeTo.set(w, v);
                    marked.set(w, true);
                    queue.push(w);
                }
            });
        }

        return { source, edgeTo, marked, connectedCount };
    }
}