import type { PieceColor, PieceCount } from "@/types/common/engine/piece";

export const pieceColors = [
    "Black",
    "White"
] as const;

export const expansionBugs = [
    "Ladybug",
    "Mosquito",
    "Pillbug"
] as const;

export const baseGameBugs = [
    "Ant",
    "Beetle",
    "Grasshopper",
    "QueenBee",
    "Spider"
] as const;

export const allBugs = [
    ...baseGameBugs,
    ...expansionBugs
] as const;

export const fullInventory: Required<PieceCount> = {
    Ant: 3,
    Beetle: 2,
    Grasshopper: 3,
    Ladybug: 1,
    Mosquito: 1,
    Pillbug: 1,
    QueenBee: 1,
    Spider: 2
} as const;

export const invertColor = (color: PieceColor): PieceColor => color === "Black" ? "White" : "Black";