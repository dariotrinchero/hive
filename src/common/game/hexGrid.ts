import { pieceInventory } from "@/common/piece";
import { Bugs } from "@/common/piece";

import type { Piece, PieceColor, PieceType } from "@/types/common/piece";
import type { Direction, LatticeCoords, PieceToPos, PosToPiece, RelativePosition } from "@/types/common/game/hexGrid";

export enum PlanarDirection {
    // anticlockwise around reference (represented 'o') from o-->
    "o-", "o/", "\\o", "-o", "/o", "o\\"
}

export default abstract class HexGrid {
    private static adjacencies = [
        // anticlockwise around reference from o-->
        [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]
    ] as const;

    protected posToPiece: PosToPiece = {};
    protected pieceToPos: PieceToPos;

    protected constructor() {
        const emptyRecord = () => Object.fromEntries(
            Object.keys(Bugs).map(bug => [bug, new Array<LatticeCoords>()])
        ) as Record<PieceType, LatticeCoords[]>;
        this.pieceToPos = {
            Black: emptyRecord(),
            White: emptyRecord()
        };
    }

    protected static eqPos(pos1: LatticeCoords, pos2: LatticeCoords) {
        return pos1[0] === pos2[0] && pos1[1] === pos2[1];
    }

    protected static eqPiece(piece1: Piece, piece2: Piece): boolean {
        return piece1.color === piece2.color
            && piece1.type === piece2.type
            && piece1.index === piece2.index;
    }

    protected getPieceAt(pos: LatticeCoords): Piece | undefined {
        return this.posToPiece[pos.join(",")];
    }

    protected getPosOf(piece: Piece): LatticeCoords | undefined {
        const record = this.pieceToPos[piece.color][piece.type];
        if (!piece.index) {
            if (pieceInventory[piece.type] > 1) return;
            piece.index = 1;
        }
        if (record.length < piece.index) return;
        return record[piece.index - 1];
    }

    protected getAllPosOf(color: PieceColor): Record<PieceType, LatticeCoords[]> {
        return this.pieceToPos[color];
    }

    protected setPos(pos: LatticeCoords, piece?: Piece): void {
        if (!piece) delete this.posToPiece[pos.join(",")];
        else {
            this.posToPiece[pos.join(",")] = piece;

            const pieceToPos = this.pieceToPos[piece.color][piece.type];
            if (piece.index) pieceToPos[piece.index - 1] = pos;
            else {
                pieceToPos.push(pos);
                piece.index = pieceToPos.length;
            }
        }
    }

    protected adjCoords(pos: LatticeCoords): LatticeCoords[] {
        return HexGrid.adjacencies.map(([du, dv]) => [pos[0] + du, pos[1] + dv]);
    }

    protected adjPieceCoords(pos: LatticeCoords, ignore?: LatticeCoords): LatticeCoords[] {
        return this.adjCoords(pos).filter(pos =>
            this.getPieceAt(pos) && !(ignore && HexGrid.eqPos(pos, ignore)));
    }

    protected adjPieces(pos: LatticeCoords): Piece[] {
        return this.adjPieceCoords(pos).map(pos => this.getPieceAt(pos) as Piece);
    }

    protected relToAbs(pos: RelativePosition): LatticeCoords | undefined {
        if (pos === "Anywhere") return [0, 0];

        const refPos = this.getPosOf(pos.referencePiece);
        if (!refPos) return;

        if (pos.direction === "Above") return refPos;
        else return this.adjCoords(refPos)[PlanarDirection[pos.direction]];
    }

    protected absToRel(pos: LatticeCoords): RelativePosition | undefined {
        // if pos already points to piece
        const piece = this.getPieceAt(pos);
        if (piece) return { direction: "Above", referencePiece: piece };

        // if pos is empty space
        let referencePiece: Piece | undefined;
        let directionIndex = -1;
        this.adjCoords(pos).find((p, i) => {
            const piece = this.getPieceAt(p);
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

        return;
    }
}