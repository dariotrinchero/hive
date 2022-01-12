import { LatticeCoords, Piece, PieceType } from "@/types/common/piece";
import { PlanarDirection } from "@/logic/notation";

// Turn request types:
export type Direction = keyof typeof PlanarDirection | "Above";

export type MoveDestination = "Anywhere" | {
    referencePiece: Piece;
    direction: Direction;
};

export type TurnRequest = "Pass" | {
    movingPiece: Piece;
    destination: MoveDestination;
};

// Turn error message types:
type CommonErrorMsg = "ErrOutOfTurn"
    | "ErrDestinationOccupied"
    | "ErrOneHiveRule";

export type PlacementErrorMsg = CommonErrorMsg
    | "ErrMustBeQueen"
    | "ErrTouchesOppColor"
    | "ErrOutOfPieces";

type PieceMovementErrorMsg = `ErrViolates${PieceType}Movement`;

export type MovementErrorMsg = CommonErrorMsg
    | PieceMovementErrorMsg
    | "ErrQueenUnplayed"
    | "ErrFreedomToMoveRule"
    | "ErrNoPieceFound"
    | "ErrAlreadyThere";

// Turn outcome discriminated union types
interface PlacementOutcome {
    turnType: "Placement";
}

interface MovementOutcome {
    turnType: "Movement";
}

export interface PlacementSuccess extends PlacementOutcome {
    outcome: "Success";
    piece: Piece;
    pos: LatticeCoords;
}

export interface MovementSuccess extends MovementOutcome {
    outcome: "Success";
    piece: Piece;
    fromPos: LatticeCoords;
    toPos: LatticeCoords;
}

export interface PassSuccess {
    turnType: "Pass";
    outcome: "Success";
}

export interface PlacementError extends PlacementOutcome {
    outcome: "Error";
    message: PlacementErrorMsg;
}

export interface MovementError extends MovementOutcome {
    outcome: "Error";
    message: MovementErrorMsg;
}

export type TurnOutcome = PassSuccess | PlacementSuccess | PlacementError | MovementSuccess | MovementError;