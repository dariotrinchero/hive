import type { Piece, PieceType } from "@/types/common/game/piece";
import type { LatticeCoords, RelativePosition } from "@/types/common/game/hexGrid";
import type { PathMap } from "@/types/common/game/graph";

export type MoveType = "Placement" | "Movement";
export type MovementType = "Normal" | "Pillbug";
export type TurnType = "Pass" | MoveType;
export type ResultStatus = "Success" | "Error";

// general turn type base interfaces
interface TurnBase { turnType: TurnType; }
interface MoveBase extends TurnBase { turnType: MoveType; }
export interface PassBase extends TurnBase { turnType: "Pass"; }
export interface PlacementBase extends MoveBase { turnType: "Placement"; }
export interface MovementBase extends MoveBase { turnType: "Movement"; }

// general result base interfaces
interface ResultBase { status: ResultStatus; }
export interface SuccessBase extends ResultBase { status: "Success"; }
export interface ErrorBase extends ResultBase {
    status: "Error";
    message: string;
}

// more specific base interfaces
interface MoveSuccessBase extends MoveBase, SuccessBase {
    piece: Piece;
    destination: LatticeCoords;
}

interface GetSuccessBase<T> extends SuccessBase {
    options: T;
}

// turn attempt types
interface MoveAttempt {
    // no turnType: game logic determines whether attempt is movement / placement
    piece: Piece;
    destination: RelativePosition;
}
export type TurnAttempt = "Pass" | MoveAttempt;

// turn attempt / lookup error message types
type PassErrorMsg =
    | "ErrValidMovesRemain";

export type GetPillbugErrorMsg =
    | "ErrNoPillbugTouching"
    | "ErrPillbugMovedLastTurn"
    | "ErrPillbugCannotTargetStack"
    | "ErrGateBlocksPillbugMount";

type CommonErrorMsg =
    | "ErrGameOver";
type CommonDestErrorMsg =
    | "ErrInvalidDestination"
    | "ErrDestinationOccupied";
type OneHiveErrorMsg =
    | "ErrOneHiveRule";

export type CanPlaceErrorMsg =
    | CommonErrorMsg
    | "ErrOutOfTurn"
    | "ErrOutOfPieces"
    | "ErrCannotBeQueen" // for optional tournament rule
    | "ErrMustBeQueen";

export type CanMoveErrorMsg =
    | CommonErrorMsg
    | GetPillbugErrorMsg
    | OneHiveErrorMsg
    | "ErrQueenUnplayed"
    | "ErrInvalidMovingPiece"
    | "ErrCovered"
    | "ErrPieceMovedLastTurn";

export type GetPlacementErrorMsg =
    | CanPlaceErrorMsg
    | "ErrNoValidPlacementTargets";

export type GetMovementErrorMsg =
    | CanMoveErrorMsg
    | "ErrNoValidMoveDestinations";

export type PlacementErrorMsg =
    | CommonDestErrorMsg
    | CanPlaceErrorMsg
    | OneHiveErrorMsg
    | "ErrTouchesOppColor";

export type MovementErrorMsg =
    | CommonDestErrorMsg
    | CanMoveErrorMsg
    | "ErrAlreadyThere"
    | "ErrInvalidPillbugAbilityMovement"
    | `ErrViolates${PieceType}Movement`;

// turn attempt result types
type PassSuccess = PassBase & SuccessBase;
type PlacementSuccess = PlacementBase & MoveSuccessBase;
type MovementSuccess = MovementBase & MoveSuccessBase & {
    origin: LatticeCoords;
};

export interface PassError extends PassBase, ErrorBase {
    message: PassErrorMsg;
    exampleMove: MoveAttempt;
}
export interface PlacementError extends PlacementBase, ErrorBase {
    message: PlacementErrorMsg;
}
export interface MovementError extends MovementBase, ErrorBase {
    message: MovementErrorMsg;
}

export type PlacementResult = PlacementSuccess | PlacementError;
export type MovementResult = MovementSuccess | MovementError;
export type PassResult = PassSuccess | PassError;
export type TurnResult = PassResult | PlacementResult | MovementResult;

// legal move lookup result types
type GetPlacementSuccess = PlacementBase & GetSuccessBase<LatticeCoords[]>;

export type MovementOptions = { [pos: string]: MovementType; };
interface GetMovementSuccess extends MovementBase, GetSuccessBase<MovementOptions> {
    pathMap: PathMap<LatticeCoords>;
}

export interface GetPlacementError extends PlacementBase, ErrorBase {
    message: GetPlacementErrorMsg;
}
export interface GetMovementError extends MovementBase, ErrorBase {
    message: GetMovementErrorMsg;
}

export type GetPlacementResult = GetPlacementSuccess | GetPlacementError;
export type GetMovementResult = GetMovementSuccess | GetMovementError;

// adjacent pillbug mount lookup result types
export interface GetPillbugError extends ErrorBase {
    message: GetPillbugErrorMsg;
}

export type GetPillbugResult = GetPillbugError | GetSuccessBase<LatticeCoords[]>;