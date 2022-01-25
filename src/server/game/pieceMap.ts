import HiveGame, { Bugs } from "@/server/game/game";

import type { Piece, PieceColor, PieceType } from "@/types/common/piece";

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

    public static equalPiece(piece1: Piece, piece2: Piece): boolean {
        return piece1.color === piece2.color
            && piece1.type === piece2.type
            && piece1.index === piece2.index;
    }

    public getPiece(piece: Piece): T | null {
        const record = this.record[piece.color][piece.type];
        if (!piece.index) {
            if (HiveGame.startingInventory[piece.type] > 1) return null;
            piece.index = 1;
        }
        if (record.length < piece.index) return null;
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

    public getAllOfColor(color: PieceColor): Record<PieceType, T[]> {
        return this.record[color];
    }
}

