import type { Namespace } from "socket.io";

import type HiveGame from "@/common/game/game";

import type { ClientToServer, InterServer, ServerToClient, SocketData } from "@/types/common/socket";

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