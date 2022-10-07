export type Stringify<V> = (vertex: V) => string;

export type Adj<V> = (vertex: V) => V[];
export type BFSAdj<V> = (vertex: V, distance: number) => V[];
export type Filter<V> = (vertex: V, distance: number) => boolean;

export type BFSResults<V> = {
    [vertex: string]: { // undefined value means unreached vertex
        distance: number;
        previous?: V, // undefined for source
        passedFilter: boolean;
    };
};
export type PathMap<V> = (vertex: V) => V[];

export type IsCutVertex<V> = (vertex: V) => boolean;