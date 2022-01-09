export type TurnOutcome = "Success" | "ErrOutOfTurn";

export type PlacementOutcome = TurnOutcome
    | "ErrDisconnected"
    | "ErrMustBeQueen"
    | "ErrTouchesOppColor"
    | "ErrOutOfPieces";

export type MovementOutcome = TurnOutcome
    | "ErrQueenNotPlaced"
    | "ErrOneHiveRule"
    | "ErrFreedomToMoveRule"
    | "ErrViolatesPieceMovement"
    | "ErrNoPieceFound";