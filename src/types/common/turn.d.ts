import { Piece, PieceType } from "@/types/common/piece";
import { RelativePosition } from "@/types/backEnd/hexGrid";

// turn request types
interface GenericMove {
    piece: Piece;
    destination: RelativePosition;
}

export type TurnRequest = "Pass" | GenericMove;

// turn error message types
type CommonErrorMsg = "ErrOutOfTurn"
    | "ErrGameOver"
    | "ErrDestinationOccupied"
    | "ErrOneHiveRule"
    | "ErrInvalidDestination";

export type PlacementErrorMsg = CommonErrorMsg
    | "ErrMustBeQueen"
    | "ErrTouchesOppColor"
    | "ErrOutOfPieces";

export type MovementErrorMsg = CommonErrorMsg
    | `ErrViolates${PieceType}Movement`
    | "ErrQueenUnplayed"
    | "ErrFreedomToMoveRule"
    | "ErrInvalidMovingPiece"
    | "ErrAlreadyThere";

// turn outcome (discriminated union) types
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