import type {
    ErrorBase,
    MovementBase,
    MovementResult,
    TurnAttempt,
    TurnResult
} from "@/types/common/game/outcomes";
import type { Piece, PieceColor } from "@/types/common/game/piece";
import type { LastMoveDestination } from "@/types/common/game/game";
import type { LatticeCoords, PosToPiece } from "@/types/common/game/hexGrid";

// turn request (client-server-related) error message types
type TurnRequestErrorMsg = "ErrSpectator"
    | "ErrInvalidGameId"
    | "ErrNeedOpponentOnline"
    | "ErrOutOfTurn";

export interface TurnRequestErrorBase extends ErrorBase {
    message: TurnRequestErrorMsg;
}
interface TurnRequestError extends TurnRequestErrorBase {
    turnType: "Unknown";
}
type MovementRequestError = TurnRequestErrorBase & MovementBase;

export type TurnRequestOutcome = TurnResult | TurnRequestError;
export type MovementRequestOutcome = MovementResult | MovementRequestError;

// player session
export type ClientType = "Player" | "Spectator";

interface SessionBase {
    sessionId: string;
    startingColor: PieceColor;
    spectating: boolean;
}

interface SpectatorSession extends SessionBase {
    spectating: true;
}

interface PlayerSession extends SessionBase {
    spectating: false;
    color: PieceColor;
    noFirstQueen: boolean;
}

export type ClientSession = PlayerSession | SpectatorSession;

// game state
export interface GameState {
    // TODO make game history (ie. notation of past moves) part of state
    turnCount: number;
    currTurnColor: PieceColor;
    movedLastTurn: LastMoveDestination;
    posToPiece: PosToPiece;
}

// socket events
type ConnectionEvents = Record<`${ClientType} ${"dis" | ""}connected`, () => void>;

export interface ServerToClient extends ConnectionEvents {
    "player turn": (out: TurnResult, hash: string) => void;
    "session": (session: ClientSession) => void;
    "game state": (state: GameState, hash: string) => void;
}

export interface ClientToServer {
    "turn request": (req: TurnAttempt, callback: (out: TurnRequestOutcome, hash: string) => void) => void;
    "game state request": (callback: (state: GameState) => void) => void;
    "move request": (piece: Piece, dest: LatticeCoords, callback: (out: MovementRequestOutcome, hash: string) => void) => void;
}

export interface InterServer {
    ping: () => void;
}

export interface SocketData {
    sessionId: string;
}