import { PieceColor, PieceType } from "@/types/common/piece";

export type Inventory = {
    [bug in PieceType]: number;
};

export type PlayerInventories = {
    [color in PieceColor]: Inventory;
};

export type PlacementCount = {
    [color in PieceColor]: number;
};