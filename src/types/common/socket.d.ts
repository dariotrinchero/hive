import type { TurnOutcome, TurnRequest } from "@/types/common/turn";

export interface ServerToClient {
    "opponent disconnected": () => void;
    "opponent connected": () => void;
    "opponent turn": (out: TurnOutcome) => void;
    "game full": () => void;
}

export interface ClientToServer {
    "turn request": (req: TurnRequest, callback: (out: TurnOutcome) => void) => void;
}

export interface InterServer {
    // TODO
    ping: () => void;
}

export interface SocketData {
    gameId: string;
}