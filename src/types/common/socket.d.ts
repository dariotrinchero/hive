import type { MovementOutcome, TurnOutcome, TurnRequest } from "@/types/common/turn";
import type { Piece, PieceColor } from "@/types/common/piece";
import type { LastMoveDestination } from "@/types/common/game/game";
import type { LatticeCoords, PosToPiece } from "@/types/common/game/hexGrid";

export interface GameState {
    turnCount: number;
    currTurnColor: PieceColor;
    movedLastTurn: LastMoveDestination;
    posToPiece: PosToPiece;
}

// turn request (client-server-related) error message types
type TurnEventErrorMsg = "ErrSpectator"
    | "ErrInvalidGameId"
    | "ErrNeedOpponentOnline";

interface EventErrorBase {
    status: "Error";
    message: TurnEventErrorMsg;
}

export interface TurnEventError extends EventErrorBase {
    turnType: "Unknown";
}

export interface MovementEventError extends EventErrorBase {
    turnType: "Movement";
}

export type TurnEventOutcome = TurnOutcome | TurnEventError;
export type MovementEventOutcome = MovementOutcome | MovementEventError;

// event types
export interface ServerToClient {
    "player disconnected": () => void;
    "player connected": () => void;

    "spectator connected": () => void;
    "spectator disconnected": () => void;

    "player turn": (out: TurnOutcome, hash: string) => void;

    "spectating": () => void;

    "session": (sessionId: string) => void;
    "game state": (state: GameState, hash: string) => void;
}

export interface ClientToServer {
    "turn request": (req: TurnRequest, callback: (out: TurnEventOutcome, hash: string) => void) => void;
    "game state request": (callback: (state: GameState) => void) => void;
    "move request": (piece: Piece, destination: LatticeCoords, callback: (out: MovementEventOutcome, hash: string) => void) => void;
}

export interface InterServer {
    ping: () => void;
}

export interface SocketData {
    sessionId: string;
}