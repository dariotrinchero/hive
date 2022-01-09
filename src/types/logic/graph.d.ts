export interface BFSResults<V> { // V is type of vertices
    source: V;
    marked: Map<V, boolean>;
    edgeTo: Map<V, V>;
    connectedCount: number;
}