import type { Namespace } from "socket.io";

import type HiveGame from "@/common/game/game";

import type { ClientToServer, InterServer, ServerToClient, SocketData } from "@/types/common/socket";
import type { TurnOutcome } from "@/types/common/turn";

export type OnlineSessions = {
    [sessionId: string]: boolean;
};

export type ActiveGames = {
    [gameId: string]: {
        game: HiveGame;
        nsp: Namespace<ClientToServer, ServerToClient, InterServer, SocketData>;
        playerSessions: OnlineSessions;
        spectatorSessions: OnlineSessions;
    };
};

// turn request (client-server-related) error message types
export type TurnEventErrorMsg = "ErrSpectator"
    | "ErrInvalidGameId"
    | "ErrNeedOpponentOnline";

export interface TurnEventError {
    status: "Error";
    turnType: "Unknown";
    message: TurnEventErrorMsg;
}

export type TurnEventOutcome = TurnOutcome | TurnEventError;