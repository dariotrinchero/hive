import { Piece } from "@/types/common/piece";

import { Bugs } from "@/backEnd/game";
import { LatticeCoords, PiecePositions, PlayerPiecePositions, RelativePosition } from "@/types/backEnd/hexGrid";

export enum PlanarDirection {
    // anticlockwise around reference (represented 'o') from o-->
    "o-", "o/", "\\o", "-o", "/o", "o\\"
}

export default class HexGrid<Cell extends LatticeCoords> {
    protected static adjacencies = [
        // anticlockwise around reference from o-->
        [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]
    ] as const;

    protected defaultCell: LatticeCoords;
    protected piecePositions: PlayerPiecePositions<Cell>;

    protected constructor(defaultCell: LatticeCoords) {
        this.defaultCell = defaultCell;

        const startingPositions = () => Object.fromEntries(
            Object.keys(Bugs).map(bug => [bug, new Array<Cell>()])
        ) as PiecePositions<Cell>;
        this.piecePositions = {
            Black: startingPositions(),
            White: startingPositions()
        };
    }

    protected adjCoords(pos: LatticeCoords): LatticeCoords[] {
        return HexGrid.adjacencies.map(([du, dv]) => ({ u: pos.u + du, v: pos.v + dv }));
    }

    protected getExistingPiecePos(piece: Piece): Cell | null {
        const samePiecePositions = this.piecePositions[piece.color][piece.type];
        if (!piece.index || samePiecePositions.length < piece.index) return null;
        return samePiecePositions[piece.index - 1];
    }

    protected setExistingPiecePos(piece: Piece, pos: Cell): void {
        // unsafe if piece.index does not exist or is too large
        const samePiecePositions = this.piecePositions[piece.color][piece.type];
        samePiecePositions[piece.index as number - 1] = pos;
    }

    protected getDestinationPos(destination: RelativePosition): LatticeCoords | null {
        if (destination === "Anywhere") return this.defaultCell;

        const refPos = this.getExistingPiecePos(destination.referencePiece);
        if (!refPos) return null;

        if (destination.direction === "Above") return refPos;
        else return this.adjCoords(refPos)[PlanarDirection[destination.direction]];
    }
}