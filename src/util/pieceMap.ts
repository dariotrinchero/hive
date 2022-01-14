import { Piece, PieceColor, PieceType } from "@/types/common/piece";
import { Bugs } from "@/backEnd/game";

export default class PieceMap<T> {
    private record: Record<PieceColor, Record<PieceType, T[]>>;

    public constructor() {
        const emptyRecord = () => Object.fromEntries(
            Object.keys(Bugs).map(bug => [bug, new Array<T>()])
        ) as Record<PieceType, T[]>;
        this.record = {
            Black: emptyRecord(),
            White: emptyRecord()
        };
    }

    public getPiece(piece: Piece): T | null {
        const record = this.record[piece.color][piece.type];
        if (!piece.index || record.length < piece.index) return null;
        return record[piece.index - 1];
    }

    public setPiece(piece: Piece, data: T): void {
        // unsafe if piece.index does not exist or is too large
        this.record[piece.color][piece.type][piece.index as number - 1] = data;
    }

    public addPiece(piece: Piece, data: T): number {
        const record = this.record[piece.color][piece.type];
        record.push(data);
        return record.length;
    }
}

