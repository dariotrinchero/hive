export type Stringify<V> = (vertex: V) => string;

export type Adj<V> = (vertex: V) => V[];
export type BFSAdj<V> = (vertex: V, distance: number) => V[];
export type Filter<V> = (vertex: V, distance: number) => boolean;

export type EdgeTo<V> = {
    [vertex: string]: {
        previous: V,
        isEndpoint: boolean;
    };
};
export type PathMap<V> = (vertex: V) => V[];

export interface BFSResults<V> {
    distance: { [vertex: string]: number; }; // undefined distance means unreached vertex
    edgeTo: EdgeTo<V>;
}