const { default: GraphUtils } = require("@/common/game/graph");

const graphUtils = new GraphUtils(v => v);

class StringGraph {
    adjacencies = {};
    vertexSet = {};

    constructor(adjPairs, directed) {
        adjPairs.forEach(([v1num, v2num]) => {
            const v1 = `${v1num}`;
            const v2 = `${v2num}`;

            if (!this.adjacencies[v1]) this.adjacencies[v1] = [];
            this.adjacencies[v1].push(v2);
            
            if (!directed) {
                if (!this.adjacencies[v2]) this.adjacencies[v2] = [];
                this.adjacencies[v2].push(v1);
            }

            this.vertexSet[v1] = true;
            this.vertexSet[v2] = true;
        });
    }

    adj(vertex) { return this.adjacencies[vertex] || []; }
    isAdj(from, to) { return this.adjacencies[from]?.indexOf(to) !== -1 }
    vertices() { return Object.keys(this.vertexSet); }
}

const getYieldedAndReturned = generator => {
    const yielded = [];
    let next = generator.next();
    while (!next.done) {
        yielded.push(next.value);
        next = generator.next();
    }
    return { yielded, returned: next.value };
};

// https://commons.wikimedia.org/wiki/File:Graph-Biconnected-Components.svg
const graph1 = new StringGraph([
    [0, 2], [0, 3], [2, 4], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [7, 9], [7, 10],
    [10, 11], [10, 12], [12, 13], [13, 14], [13, 9], [14, 9]
]);

const graph2 = new StringGraph([
    [0, 2], [2, 3], [0, 3], [3, 4], [4, 5], [4, 6], [5, 10], [6, 10], [6, 7], [7, 8],
    [8, 9], [7, 9], [10, 11], [11, 12], [10, 12]
]);

const graph3 = new StringGraph([
    [0, 1], [1, 2], [2, 1], [0, 2], [1, 3], [2, 3], [3, 4], [4, 3], [4, 0],
    [2, 4], [4, 5], [0, 5], [5, 6], [3, 6], [6, 4], [6, 7], [3, 7], [7, 8],
    [8, 6], [4, 8], [5, 8]
], true);

// trivial case: undirected linear chain
const graph4 = new StringGraph([[0, 2], [2, 3], [3, 4], [4, 5], [5, 6]]);

// trivial case: undirected cycle
const graph5 = new StringGraph([[0, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]]);

// trivial case: outwardly-directed starlike tree
const graph6 = new StringGraph([
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15]
], true);

// trivial case: undirected star tree
const graph7 = new StringGraph([[0, 1], [0, 2], [0, 3], [0, 4]]);

// trivial case: directed cycle
const graph8 = new StringGraph([[0, 1], [1, 2], [2, 0]], true);

const allGraphs = [graph1, graph2, graph3, graph4, graph5, graph6, graph8, graph7];

it("Correctly calculates cut vertices", () => {
    const expectCutVertices = (graph, expected) => {
        const isCutVertex = graphUtils.getCutVertices("0", v => graph.adj(v));
        let cutVertices = graph.vertices().filter(isCutVertex).sort();
        expect(cutVertices).toEqual(expected);
    };
    expectCutVertices(graph1, ["10", "4", "5", "6", "7"]);
    expectCutVertices(graph2, ["10", "3", "4", "6", "7"]);
    expectCutVertices(graph4, ["2", "3", "4", "5"]);
    expectCutVertices(graph5, []);
});

describe("When generating length-N paths", () => {
    const expectYielded = (graph, dist, expected) => {
        const generator = graphUtils.generateLengthNPaths("0", v => graph.adj(v), dist);
        const yielded = getYieldedAndReturned(generator).yielded.sort();
        expect(yielded).toEqual(expected.sort());
    };

    const checkPathMap = (graph, dist) => {
        const generator = graphUtils.generateLengthNPaths("0", v => graph.adj(v), dist);
        const { yielded, returned } = getYieldedAndReturned(generator);
        graph.vertices().forEach(v => {
            if (yielded.indexOf(v) === -1) expect(returned(v)).toHaveLength(0);
            else {
                const path = returned(v);
                expect(path).toHaveLength(dist);
                expect(path.at(-1)).toEqual("0"); // path always starts at source
                for (let i = path.length - 1; i >= 0; i--) { // check path has valid adjacencies
                    expect(graph.isAdj(path[i], i ? path[i - 1] : v)).toBeTruthy();
                }
            }
        });
    };
    
    it("yields vertices reachable in N-steps", () => {
        expectYielded(graph3, 1, ["1", "2", "5"]);
        expectYielded(graph3, 2, ["1", "2", "3", "4", "6", "8"]);
        expectYielded(graph3, 3, ["0", "1", "2", "3", "4", "5", "6", "7", "8"]);
        expectYielded(graph6, 4, ["12", "4", "8"]);
        expectYielded(graph6, 3, ["11", "15", "3", "7"]);
        expectYielded(graph7, 3, ["1", "2", "3", "4"]);
        expectYielded(graph7, 4, ["0"]);
        expectYielded(graph7, 13, ["1", "2", "3", "4"]);
        expectYielded(graph7, 8, ["0"]);
        expectYielded(graph8, 1, ["1"]);
        expectYielded(graph8, 2, ["2"]);
        expectYielded(graph8, 3, ["0"]);
        expectYielded(graph8, 4, ["1"]);
    });

    it("returns valid length-N path to each yielded vertex", () => {
        checkPathMap(graph3, 1);
        checkPathMap(graph3, 2);
        checkPathMap(graph3, 3);
        checkPathMap(graph6, 4);
        checkPathMap(graph6, 3);
        checkPathMap(graph7, 3);
        checkPathMap(graph7, 8);
        checkPathMap(graph8, 1);
        checkPathMap(graph8, 4);
    });
});

describe("When generating shortest paths", () => {
    const expectYielded = (graph, dist, filter, expected) => {
        const generator = graphUtils.generateShortestPaths("0", v => graph.adj(v), dist, filter);
        const yielded = getYieldedAndReturned(generator).yielded.sort();
        expect(yielded).toEqual(expected.sort());
    };

    const checkPathMap = (graph, dist, filter) => {
        const generator = graphUtils.generateShortestPaths("0", v => graph.adj(v), dist, filter);
        const { yielded, returned } = getYieldedAndReturned(generator);
        graph.vertices().forEach(v => {
            if (yielded.indexOf(v) === -1) expect(returned(v)).toHaveLength(0);
            else {
                const path = returned(v);
                expect(path.length).toBeGreaterThan(0);
                expect(path.at(-1)).toEqual("0"); // path always starts at source
                for (let i = path.length - 1; i >= 0; i--) { // check path has valid adjacencies
                    expect(graph.isAdj(path[i], i ? path[i - 1] : v)).toBeTruthy();
                }
            }
        });
    };

    const expectReachesAll = (graph, dist, filter) => {
        const vertices = graph.vertices();
        vertices.splice(vertices.indexOf("0"), 1);
        expectYielded(graph, dist, filter, vertices);
    };

    it("yields reached vertices except source", () => {
        allGraphs.forEach(g => expectReachesAll(g));
    });

    it("respects maximum distance", () => {
        expectYielded(graph1, 1, undefined, ["2", "3"]);
        expectYielded(graph1, 6, undefined, ["2", "3", "4", "5", "6", "7", "8", "9", "10"]);
        expectReachesAll(graph1, 7);
        expectYielded(graph7, 0, undefined, []);
        expectReachesAll(graph7, 1);
    });

    it("respects the filter", () => {
        const filter1 = (v, dist) => v === "2" || dist === 6;
        expectYielded(graph1, undefined, filter1, ["2", "8", "9", "10"]);
        expectYielded(graph1, 5, filter1, ["2"]);
        const filter2 = (v, dist) => v === "1" || dist > 3;
        expectYielded(graph6, undefined, filter2, ["1", "4", "8", "12"]);
    });

    it("returns shortest valid path to each yielded vertex", () => {
        const filter = (v, dist) => dist === 1 || parseInt(v) % 2 === 0;
        allGraphs.forEach(g => checkPathMap(g, undefined, filter));

        const generator = graphUtils.generateShortestPaths("0", v => graph3.adj(v));
        const { returned } = getYieldedAndReturned(generator);
        expect(returned("5")).toEqual(["0"]);
        expect(returned("1")).toEqual(["0"]);
        expect(returned("6")).toEqual(["5", "0"]);
        expect(returned("8")).toEqual(["5", "0"]);
    });
});

describe("When merging move paths", () => {
    it("produces the first possible non-zero path", () => {
        const path1 = v => ({ "1": ["2", "3"] })[v] || [];
        const path2 = v => ({ "2": ["3"] })[v] || [];
        const path3 = v => ({ "1": ["5"] })[v] || [];
        const merged = GraphUtils.mergePathMaps(path1, path2, path3);
        expect(merged("1")).toEqual(["2", "3"]);
        expect(merged("2")).toEqual(["3"]);
        expect(merged("3")).toEqual([]);
    });
});

describe("When merging generators", () => {
    it("yields from each in turn", () => {
        const path1 = v => ({ "1": ["2", "3"] })[v] || [];
        const path2 = v => ({ "2": ["3"] })[v] || [];
        const path3 = v => ({ "1": ["5"] })[v] || [];
        function *gen1() { yield "3"; return path1; }
        function *gen2() { yield* ["2", "4"]; return path2; }
        function *gen3() { yield "8"; return path3; }
        
        const merged = GraphUtils.mergeGenerators(gen1(), gen2(), gen3());
        const { yielded, returned } = getYieldedAndReturned(merged);
        expect(yielded).toEqual(["3", "2", "4", "8"]);
        expect(returned("1")).toEqual(["2", "3"]);
        expect(returned("2")).toEqual(["3"]);
        expect(returned("3")).toEqual([]);
    });
});