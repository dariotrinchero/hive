import { Piece, PieceType } from "@/types/common/piece";
import { PlanarDirection } from "@/logic/notation";

// Turn request types:
export type Direction = keyof typeof PlanarDirection | "Above";

export type MoveDestination = "Anywhere" | {
    referencePiece: Piece;
    direction: Direction;
};

interface GenericMove {
    piece: Piece;
    destination: MoveDestination;
}

export type TurnRequest = "Pass" | GenericMove;

// Turn error message types:
type CommonErrorMsg = "ErrOutOfTurn"
    | "ErrGameOver"
    | "ErrDestinationOccupied"
    | "ErrOneHiveRule"
    | "ErrInvalidDestination";

export type PlacementErrorMsg = CommonErrorMsg
    | "ErrMustBeQueen"
    | "ErrTouchesOppColor"
    | "ErrOutOfPieces";

type PieceMovementErrorMsg = `ErrViolates${PieceType}Movement`;

export type MovementErrorMsg = CommonErrorMsg
    | PieceMovementErrorMsg
    | "ErrQueenUnplayed"
    | "ErrFreedomToMoveRule"
    | "ErrInvalidMovingPiece"
    | "ErrAlreadyThere";

// Turn outcome discriminated union types
interface PlacementOutcome {
    turnType: "Placement";
}

interface MovementOutcome {
    turnType: "Movement";
}

export interface PlacementSuccess extends PlacementOutcome, GenericMove {
    status: "Success";
}

export interface MovementSuccess extends MovementOutcome, GenericMove {
    status: "Success";
}

export interface PassSuccess {
    turnType: "Pass";
    status: "Success";
}

export interface PlacementError extends PlacementOutcome {
    status: "Error";
    message: PlacementErrorMsg;
}

export interface MovementError extends MovementOutcome {
    status: "Error";
    message: MovementErrorMsg;
}

export type TurnOutcome = PassSuccess | PlacementSuccess | PlacementError | MovementSuccess | MovementError;