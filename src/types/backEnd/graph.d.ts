export type Stringify<V> = (vertex: V) => string;

export type AdjFunc<V> = (vertex: V, distance: number) => V[];
export type Filter<V> = (vertex: V, distance: number) => boolean;

export type VertexSet<V> = { [v: string]: V; };

export interface BFSResults<V> {
    distance: { [v: string]: number; }; // undefined distance means unreached vertex
    edgeTo: VertexSet<V>;
    connectedCount: number;
}