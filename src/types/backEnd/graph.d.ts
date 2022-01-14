export type AdjFunc<V> = (vertex: V) => V[];
export type Stringify<V> = (vertex: V) => string;

export interface BFSResults<V> { // V is type of vertices
    source: V;
    marked: { [edge: string]: boolean };
    edgeTo: { [edge: string]: V };
    connectedCount: number;
}