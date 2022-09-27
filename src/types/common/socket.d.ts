import type {
    ErrorBase,
    TurnAttempt,
    TurnResult,
    TurnType
} from "@/types/common/game/outcomes";
import type { PieceColor } from "@/types/common/game/piece";
import type { LastMoveDestination } from "@/types/common/game/game";
import type { PosToPiece } from "@/types/common/game/hexGrid";

// turn request (client-server-related) error message types
export type TurnRequestErrorMsg = "ErrSpectator"
    | "ErrInvalidGameId"
    | "ErrNeedOpponentOnline"
    | "ErrOutOfTurn";

interface TurnRequestError extends ErrorBase {
    turnType: TurnType | "Unknown";
    message: TurnRequestErrorMsg;
}
export type TurnRequestResult = TurnResult | TurnRequestError;

// client session
export type ClientType = "Player" | "Spectator";

interface SessionBase {
    sessionId: string;
    startingColor: PieceColor;
    bothJoined: boolean; // whether both players have joined
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
    "game state request": (callback: (state: GameState) => void) => void;
    "turn request": (req: TurnAttempt, callback: (out: TurnRequestResult, hash: string) => void) => void;
}

export interface InterServer {
    ping: () => void;
}

export interface SocketData {
    sessionId: string;
}