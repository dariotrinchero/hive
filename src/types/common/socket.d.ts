import type { MovementOutcome, TurnOutcome, TurnRequest } from "@/types/common/turn";
import type { Piece, PieceColor } from "@/types/common/piece";
import type { LastMoveDestination } from "@/types/common/game/game";
import type { LatticeCoords, PosToPiece } from "@/types/common/game/hexGrid";

// turn request (client-server-related) error message types
type TurnEventErrorMsg = "ErrSpectator"
    | "ErrInvalidGameId"
    | "ErrNeedOpponentOnline"
    | "ErrOutOfTurn";

export interface EventErrorBase {
    status: "Error";
    message: TurnEventErrorMsg;
}

interface TurnEventError extends EventErrorBase {
    turnType: "Unknown";
}

interface MovementEventError extends EventErrorBase {
    turnType: "Movement";
}

export type TurnEventOutcome = TurnOutcome | TurnEventError;
export type MovementEventOutcome = MovementOutcome | MovementEventError;

// player session
export type ClientType = "Player" | "Spectator";

interface SessionBase {
    sessionId: string;
    startingColor: PieceColor;
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
    turnCount: number;
    currTurnColor: PieceColor;
    movedLastTurn: LastMoveDestination;
    posToPiece: PosToPiece;
}

// socket events
type ConnectionEvents = Record<`${ClientType} ${"dis" | ""}connected`, () => void>;

export interface ServerToClient extends ConnectionEvents {
    "player turn": (out: TurnOutcome, hash: string) => void;
    "session": (session: ClientSession) => void;
    "game state": (state: GameState, hash: string) => void;
}

export interface ClientToServer {
    "turn request": (req: TurnRequest, callback: (out: TurnEventOutcome, hash: string) => void) => void;
    "game state request": (callback: (state: GameState) => void) => void;
    "move request": (piece: Piece, dest: LatticeCoords, callback: (out: MovementEventOutcome, hash: string) => void) => void;
}

export interface InterServer {
    ping: () => void;
}

export interface SocketData {
    sessionId: string;
}