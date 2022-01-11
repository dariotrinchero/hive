import { PieceType } from "@/types/common/piece";

type CommonOutcome = "Success"
    | "ErrOutOfTurn"
    | "ErrDestinationOccupied"
    | "ErrOneHiveRule";

export type PlacementOutcome = CommonOutcome
    | "ErrMustBeQueen"
    | "ErrTouchesOppColor"
    | "ErrOutOfPieces";

type PieceMovementError = `ErrViolates${PieceType}Movement`;

export type MovementOutcome = CommonOutcome
    | PieceMovementError
    | "ErrQueenUnplayed"
    | "ErrFreedomToMoveRule"
    | "ErrNoPieceFound"
    | "ErrAlreadyThere";

export type TurnOutcome = PlacementOutcome | MovementOutcome;

export type GameStatus = "Ongoing" | "BlackWin" | "WhiteWin" | "Draw";