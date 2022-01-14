import { Piece } from "@/types/common/piece";

import { Direction, LatticeCoords, RelativePosition } from "@/types/backEnd/hexGrid";

import PieceMap from "@/util/pieceMap";

export enum PlanarDirection {
    // anticlockwise around reference (represented 'o') from o-->
    "o-", "o/", "\\o", "-o", "/o", "o\\"
}

export default class HexGrid {
    private static adjacencies = [
        // anticlockwise around reference from o-->
        [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]
    ] as const;

    private hexGrid: (Piece | null)[][];

    private defaultCell: LatticeCoords;
    protected piecePositions: PieceMap<LatticeCoords>;

    public constructor(gridSize: number, defaultCell?: LatticeCoords) {
        this.defaultCell = defaultCell || [0, 0];
        this.piecePositions = new PieceMap<LatticeCoords>();

        this.hexGrid = new Array<Array<Piece | null>>(gridSize);
        for (let i = 0; i < gridSize; i++) {
            this.hexGrid[i] = new Array<Piece | null>(gridSize).fill(null);
        }
    }

    public static equalPos(pos1: LatticeCoords, pos2: LatticeCoords) {
        return pos1[0] === pos2[0] && pos1[1] === pos2[1];
    }

    public getPieceAtPos(pos: LatticeCoords): Piece | null {
        pos = this.mod(pos);
        return this.hexGrid[pos[0]][pos[1]];
    }

    public setPieceAtPos(pos: LatticeCoords, piece: Piece | null): void {
        pos = this.mod(pos);
        this.hexGrid[pos[0]][pos[1]] = piece;
    }

    private mod(pos: LatticeCoords): LatticeCoords {
        const len: number = this.hexGrid.length;
        const m = (coord: number) => (coord % len + len) % len;
        return [m(pos[0]), m(pos[1])];
    }

    public adjCoords(pos: LatticeCoords): LatticeCoords[] {
        return HexGrid.adjacencies.map(([du, dv]) => [pos[0] + du, pos[1] + dv]);
    }

    public adjPieceCoords(pos: LatticeCoords): LatticeCoords[] {
        return this.adjCoords(pos).filter(pos => this.getPieceAtPos(pos) !== null);
    }

    public adjPieces(pos: LatticeCoords): Piece[] {
        return this.adjPieceCoords(pos).map(pos => this.getPieceAtPos(pos) as Piece);
    }

    public getAbsolutePos(relativePos: RelativePosition): LatticeCoords | null {
        if (relativePos === "Anywhere") return this.defaultCell;

        const refPos = this.piecePositions.getPiece(relativePos.referencePiece);
        if (!refPos) return null;

        if (relativePos.direction === "Above") return refPos;
        else return this.adjCoords(refPos)[PlanarDirection[relativePos.direction]];
    }

    public getRelativePos(pos: LatticeCoords): RelativePosition | null {
        // if pos already points to piece
        const piece = this.getPieceAtPos(pos);
        if (piece) return { direction: "Above", referencePiece: piece };

        // if pos is empty space
        let referencePiece: Piece | undefined;
        let directionIndex = -1;
        this.adjCoords(pos).find((p, i) => {
            const piece = this.getPieceAtPos(p);
            if (piece) {
                referencePiece = piece;
                directionIndex = i;
                return true;
            }
        });
        if (referencePiece) return {
            direction: PlanarDirection[(directionIndex + 3) % 6] as Direction,
            referencePiece
        };

        return null;
    }
}