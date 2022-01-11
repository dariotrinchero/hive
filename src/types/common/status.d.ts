import { PieceType } from "@/types/common/piece";

type CommonOutcome = "Success" 
    | "ErrOutOfTurn"
    | "ErrDestinationOccupied"
    | "ErrOneHiveRule";

type PieceMovementError = `ErrViolates${PieceType}Movement`;

export type PlacementOutcome = CommonOutcome
    | "ErrMustBeQueen"
    | "ErrTouchesOppColor"
    | "ErrOutOfPieces";

export type MovementOutcome = CommonOutcome
    | PieceMovementError
    | "ErrQueenUnplayed"
    | "ErrFreedomToMoveRule"
    | "ErrNoPieceFound"
    | "ErrAlreadyThere";

export type GameStatus = "Ongoing" | "BlackWin" | "WhiteWin" | "Draw";