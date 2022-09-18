import type { Piece, PieceType } from "@/types/common/piece";
import type {  LatticeCoords, RelativePosition } from "@/types/common/game/hexGrid";

// turn request types
interface MoveBase {
    piece: Piece;
}

interface GenericMove extends MoveBase {
    destination: RelativePosition;
}

export type GenericTurnRequest = "Pass" | GenericMove;

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

export type PillbugMovementErrorMsg = "ErrNoPillbugTouching"
    | "ErrPillbugMovedLastTurn"
    | "ErrPillbugCannotTargetStack"
    | "ErrGateBlocksPillbugMount";

export type MovementErrorMsg = CommonErrorMsg
    | PillbugMovementErrorMsg
    | `ErrViolates${PieceType}Movement`
    | "ErrQueenUnplayed"
    | "ErrCovered"
    | "ErrInvalidMovingPiece"
    | "ErrPieceMovedLastTurn"
    | "ErrAlreadyThere";

// turn outcome (discriminated union) types
interface PlacementBase {
    turnType: "Placement";
}

interface MovementBase {
    turnType: "Movement";
}

interface GenericMoveSuccess extends MoveBase {
    destination: LatticeCoords;
}

export interface PlacementSuccess extends PlacementBase, GenericMoveSuccess {
    status: "Success";
}

export interface MovementSuccess extends MovementBase, GenericMoveSuccess {
    status: "Success";
}

export interface PassSuccess {
    turnType: "Pass";
    status: "Success";
}

export interface PlacementError extends PlacementBase {
    status: "Error";
    message: PlacementErrorMsg;
}

export interface MovementError extends MovementBase {
    status: "Error";
    message: MovementErrorMsg;
}

export type PlacementOutcome = PlacementSuccess | PlacementError;
export type MovementOutcome = MovementSuccess | MovementError;
export type GenericTurnOutcome = PassSuccess | PlacementOutcome | MovementOutcome;