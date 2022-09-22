import type { Namespace, Socket } from "socket.io";

import type HiveGame from "@/common/game/game";

import type { PieceColor } from "@/types/common/game/piece";
import type { ClientToServer, ClientType, InterServer, ServerToClient, SocketData } from "@/types/common/socket";

export type OnlineSessions = {
    [sessionId: string]: boolean;
};

// starting color & color assignment
export type StartingColor = PieceColor | "Random";
export type ColorAssignmentRule = `FirstJoinIs${PieceColor}`
    | "Random"
    | {
        sessionId: string;
        color: PieceColor;
    };

// game details
export interface GameDetails {
    game: HiveGame;
    nsp: Namespace<ClientToServer, ServerToClient, InterServer, SocketData>;
    online: Record<ClientType, OnlineSessions>;
    playerColors: {
        byId: { [sessionId: string]: PieceColor; };
        rule: ColorAssignmentRule;
    },
    startingColor: PieceColor;
    noFirstQueen: boolean;
}
export type ActiveGames = {
    [gameId: string]: GameDetails;
};

// client details
export type IOSocket = Socket<ClientToServer, ServerToClient, InterServer, SocketData>;

interface ClientDetailBase {
    sessionId: string;
    clientType: ClientType;
    gameId: string;
    gameDetails: GameDetails;
    socket: IOSocket;
}

interface PlayerDetails extends ClientDetailBase {
    clientType: "Player";
    color: PieceColor;
}

interface SpectatorDetails extends ClientDetailBase {
    clientType: "Spectator";
}

export type ClientDetails = PlayerDetails | SpectatorDetails;