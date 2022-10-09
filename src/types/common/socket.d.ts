import type {
    ErrorBase,
    TurnAttempt,
    TurnResult,
    TurnType
} from "@/types/common/engine/outcomes";
import type { PieceColor } from "@/types/common/engine/piece";
import type { LastMoveDestination, OptionalGameRules } from "@/types/common/engine/game";
import type { PosToPiece } from "@/types/common/engine/hexGrid";

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
    bothJoined: boolean; // whether both players have joined
    spectating: boolean;
    state: GameState;
    rules: OptionalGameRules;
}
interface SpectatorSession extends SessionBase {
    spectating: true;
}
interface PlayerSession extends SessionBase {
    spectating: false;
    color: PieceColor;
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
    "player turn": (result: TurnResult, hash: string) => void;
    "session": (session: ClientSession) => void;
}

export interface ClientToServer {
    "game state request": (callback: (state: GameState) => void) => void;
    "turn request": (req: TurnAttempt, callback: (result: TurnRequestResult, hash: string) => void) => void;
}

export interface InterServer {
    ping: () => void;
}

export interface SocketData {
    sessionId: string;
}