import type { Piece, PieceColor, PieceType } from "@/types/common/game/piece";
import type { LatticeCoords, RelativePosition } from "@/types/common/game/hexGrid";
import type { PathMap } from "@/types/common/game/graph";

export type MoveType = "Placement" | "Movement";
export type MovementType = "Normal" | "Pillbug";
export type TurnType = "Pass" | MoveType;
type ResultStatus = "Success" | "Error";

// turn type base interfaces
interface TurnBase { turnType: TurnType; }
interface MoveBase extends TurnBase { turnType: MoveType; }
interface PassBase extends TurnBase { turnType: "Pass"; }
interface PlacementBase extends MoveBase { turnType: "Placement"; }
interface MovementBase extends MoveBase { turnType: "Movement"; }

// result base interfaces
interface ResultBase { status: ResultStatus; }
interface SuccessBase extends ResultBase { status: "Success"; }
export interface ErrorBase extends ResultBase {
    status: "Error";
    message: string;
}

// move specification base interface
interface MoveSpecification<Coordinates extends LatticeCoords | RelativePosition> {
    piece: Piece;
    destination: Coordinates;
}

// success base interfaces
type MoveSuccessBase = MoveBase & SuccessBase & MoveSpecification<LatticeCoords>;

interface GetSuccessBase<T> extends SuccessBase {
    options: T;
}

// turn attempt types
export type GenericTurnAttempt = PassBase | MoveSpecification<RelativePosition>; // turnType must be inferred
export type SpecificTurnAttempt = PassBase | MoveBase & MoveSpecification<LatticeCoords>;
export type TurnAttempt = GenericTurnAttempt | SpecificTurnAttempt;

// turn attempt / lookup error message types
type PassErrorMsg =
    | "ErrValidMovesRemain";

type GetPillbugErrorMsg =
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

type GetPlacementErrorMsg =
    | CanPlaceErrorMsg
    | "ErrNoValidPlacementTargets";

type GetMovementErrorMsg =
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
    exampleMove: MoveSpecification<RelativePosition>;
}
export interface PlacementError extends PlacementBase, ErrorBase {
    message: PlacementErrorMsg;
}
export interface MovementError extends MovementBase, ErrorBase {
    message: MovementErrorMsg;
}

export type PlacementResult = PlacementSuccess | PlacementError;
export type MovementResult = MovementSuccess | MovementError;
export type MoveResult = PlacementResult | MovementResult;
export type PassResult = PassSuccess | PassError;
export type TurnResult = PassResult | MoveResult;

// legal move lookup query types
export interface GetMoveQuery extends MoveBase {
    piece: Piece;
    colorOverride?: PieceColor;
}

// legal move lookup result types
export type MoveOptions = { [pos: string]: MovementType; };

type GetPlacementSuccess = PlacementBase & GetSuccessBase<MoveOptions>;
interface GetMovementSuccess extends MovementBase, GetSuccessBase<MoveOptions> {
    pathMap: PathMap<LatticeCoords>;
}

interface GetPlacementError extends PlacementBase, ErrorBase {
    message: GetPlacementErrorMsg;
}
interface GetMovementError extends MovementBase, ErrorBase {
    message: GetMovementErrorMsg;
}

export type GetPlacementResult = GetPlacementSuccess | GetPlacementError;
export type GetMovementResult = GetMovementSuccess | GetMovementError;
export type GetMoveResult = GetPlacementResult | GetMovementResult;

// adjacent pillbug mount lookup result types
export interface GetPillbugError extends ErrorBase {
    message: GetPillbugErrorMsg;
}

export type GetPillbugResult = GetPillbugError | GetSuccessBase<LatticeCoords[]>;