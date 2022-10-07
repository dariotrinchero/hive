import type { Piece, PieceColor, PieceType } from "@/types/common/engine/piece";
import type { LatticeCoords, RelativePosition } from "@/types/common/engine/hexGrid";
import type { PathMap } from "@/types/common/engine/graph";

export type MoveType = "Placement" | "Movement";
export type MovementType = "Normal" | "Pillbug";
export type TurnType = "Pass" | MoveType;
type ResultStatus = "Ok" | "Error";

// turn type base interfaces
interface TurnBase { turnType: TurnType; }
interface MoveBase extends TurnBase { turnType: MoveType; }
interface PassBase extends TurnBase { turnType: "Pass"; }
interface PlacementBase extends MoveBase { turnType: "Placement"; }
interface MovementBase extends MoveBase { turnType: "Movement"; }

// result base interfaces
interface ResultBase { status: ResultStatus; }
interface OkBase extends ResultBase { status: "Ok"; }
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
type MoveOkBase = MoveBase & OkBase & MoveSpecification<LatticeCoords>;

interface GetOkBase<T> extends OkBase {
    piece: Piece;
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
type PassOk = PassBase & OkBase;
type PlacementOk = PlacementBase & MoveOkBase;
type MovementOk = MovementBase & MoveOkBase & {
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

export type PlacementResult = PlacementOk | PlacementError;
export type MovementResult = MovementOk | MovementError;
export type MoveResult = PlacementResult | MovementResult;
export type PassResult = PassOk | PassError;
export type TurnResult = PassResult | MoveResult;

// legal move lookup query types
export interface GetMoveQuery extends MoveBase {
    piece: Piece;
    colorOverride?: PieceColor;
}

// legal move lookup result types
export type MoveOptions = { [pos: string]: MovementType; };

type GetPlacementOk = PlacementBase & GetOkBase<MoveOptions>;
interface GetMovementOk extends MovementBase, GetOkBase<MoveOptions> {
    pathMap: PathMap<LatticeCoords>;
}

interface GetPlacementError extends PlacementBase, ErrorBase {
    message: GetPlacementErrorMsg;
}
interface GetMovementError extends MovementBase, ErrorBase {
    message: GetMovementErrorMsg;
}

export type GetPlacementResult = GetPlacementOk | GetPlacementError;
export type GetMovementResult = GetMovementOk | GetMovementError;
export type GetMoveResult = GetPlacementResult | GetMovementResult;

// adjacent pillbug mount lookup result types
export interface GetPillbugError extends ErrorBase {
    message: GetPillbugErrorMsg;
}

export type GetPillbugResult = GetPillbugError | GetOkBase<LatticeCoords[]>;