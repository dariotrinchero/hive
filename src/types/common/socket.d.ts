import type { TurnOutcome, TurnRequest } from "@/types/common/turn";
import type { PieceColor } from "@/types/common/piece";
import type { LastMoveDestination } from "@/types/common/game/game";
import type { PieceToPos } from "@/types/common/game/hexGrid";
import type { TurnEventOutcome } from "@/types/server/gameServer";

interface GameState {
    turnCount: number;
    currTurnColor: PieceColor;
    movedLastTurn: LastMoveDestination;
    positionMap: PieceToPos; // NOT GOOD ENOUGH: encodes no info about order of stacked pieces
}

export interface ServerToClient {
    "player disconnected": () => void;
    "player connected": () => void;

    "spectator connected": () => void;
    "spectator disconnected": () => void;

    "player turn": (out: TurnOutcome) => void;

    "spectating": () => void;

    "session": (sessionId: string) => void;
    // "game state": (state: GameState) => void;
}

export interface ClientToServer {
    "turn request": (req: TurnRequest, callback: (out: TurnEventOutcome) => void) => void;
    // "game state request": (callback: (state: GameState) => void) => void;
}

export interface InterServer {
    ping: () => void;
}

export interface SocketData {
    sessionId: string;
}