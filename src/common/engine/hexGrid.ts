import { Bugs, pieceInventory } from "@/common/engine/piece";

import type { Piece, PieceColor, PieceType } from "@/types/common/engine/piece";
import type { Direction, LatticeCoords, PieceToPos, PosToPiece, RelativePosition } from "@/types/common/engine/hexGrid";

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
    protected readonly pieceToPos: PieceToPos;

    protected constructor() {
        const emptyRecord = () => Object.fromEntries(
            Object.keys(Bugs).map(bug => [bug, new Array<LatticeCoords>()])
        ) as Record<PieceType, LatticeCoords[]>;
        this.pieceToPos = {
            Black: emptyRecord(),
            White: emptyRecord()
        };
    }

    public static eqPos(pos1: LatticeCoords, pos2: LatticeCoords) {
        return pos1[0] === pos2[0] && pos1[1] === pos2[1];
    }

    public static eqPiece(piece1: Piece, piece2: Piece): boolean {
        return piece1.color === piece2.color
            && piece1.type === piece2.type
            && piece1.index === piece2.index;
    }

    public static entriesOfPosRecord<T>(posToX: Record<string, T>): [LatticeCoords, T][] {
        return Object.entries(posToX).map(([posStr, value]) =>
            [posStr.split(",").map(str => parseInt(str, 10)) as LatticeCoords, value]);
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

    /**
     * Get adjacent positions that a piece is able to slide into, keeping contact with hive.
     * 
     * @param pos position from which to find adjacencies
     * @param ignore position to treat as empty (eg. position of piece in transit)
     * @returns adjacent valid slide positions
     */
    protected adjSlideSpaces(pos: LatticeCoords, ignore?: LatticeCoords): LatticeCoords[] {
        return this.adjCoords(pos).filter((adjPos, i, arr) => {
            const gatePos = [5, 1].map(d => arr[(i + d) % 6]);
            const shouldIgnore = (adjPos: LatticeCoords) => ignore && HexGrid.eqPos(adjPos, ignore);

            let canSlide: boolean | undefined = !this.getPieceAt(adjPos);
            if (!this.getPieceAt(gatePos[0]) || shouldIgnore(gatePos[0])) {
                canSlide &&= this.getPieceAt(gatePos[1]) && !shouldIgnore(gatePos[1]);
            } else {
                canSlide &&= !this.getPieceAt(gatePos[1]) || shouldIgnore(gatePos[1]);
            }
            return canSlide;
        });
    }

    /**
     * Get adjacent positions that a piece is able to climb up/down onto, obeying freedom-to-move rule.
     * 
     * @param pos position from which to find adjacencies
     * @param ignore position to treat as containing one fewer piece (eg. position of piece in transit)
     * @param dismount if true/false, only return moves that specifically do/don't dismount the hive;
     *                 otherwise returns all kind of moves along top of hive
     * @returns adjacent valid mount positions
     */
    protected adjMounts(pos: LatticeCoords, ignore?: LatticeCoords, dismount?: boolean): LatticeCoords[] {
        let height = this.getPieceAt(pos)?.height || 0;
        if (ignore && HexGrid.eqPos(pos, ignore)) height -= 1;

        return this.adjCoords(pos).filter((adjPos, i, arr) => {
            if (ignore && HexGrid.eqPos(adjPos, ignore)) return false;

            const gateHeights = [5, 1].map(d => this.getPieceAt(arr[(i + d) % 6])?.height || 0);
            const destination = this.getPieceAt(adjPos);

            let canMount: boolean | undefined = Math.min(...gateHeights)
                <= Math.max(height, destination?.height || 0);
            if (dismount === true) canMount &&= !destination;
            else if (dismount === false) canMount &&= typeof destination !== "undefined";
            else canMount &&= typeof destination !== "undefined" || height >= 1;
            return canMount;
        });
    }

    /**
     * Convert from given relative position (ie. relative to reference piece) to the equivalent
     * absolute position (lattice coordinates).
     * 
     * @param pos position in relative coordinates
     * @returns equivalent position in absolute (lattice) coordinates
     */
    public relToAbs(pos: RelativePosition): LatticeCoords | undefined {
        if (pos === "Anywhere") return [0, 0];

        const refPos = this.getPosOf(pos.referencePiece);
        if (!refPos) return;

        if (pos.direction === "Above") return refPos;
        return this.adjCoords(refPos)[PlanarDirection[pos.direction]];
    }

    /**
     * Convert from given absolute position (lattice coordinates) to (one possible) equivalent
     * relative position (ie. relative to reference piece); returns "Anywhere" if no reference
     * pieces are adjacent to given position.
     * 
     * @param pos position in absolute (lattice) coordinates
     * @returns equivalent position in relative coordinates
     */
    public absToRel(pos: LatticeCoords): RelativePosition {
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

        // if pos is not next to anything
        return "Anywhere";
    }
}