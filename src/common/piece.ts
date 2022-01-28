import type { Inventory } from "@/types/common/piece";

export enum Colors {
    Black,
    White
}

export enum Bugs {
    Ant,
    Beetle,
    Grasshopper,
    Ladybug,
    Mosquito,
    Pillbug,
    QueenBee,
    Spider
}

export const pieceInventory: Inventory = {
    Ant: 3,
    Beetle: 2,
    Grasshopper: 3,
    Ladybug: 1,
    Mosquito: 1,
    Pillbug: 1,
    QueenBee: 1,
    Spider: 2
};