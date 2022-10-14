import type { Namespace, Server, Socket } from "socket.io";

import type HiveGame from "@/common/engine/game";

import type { PieceColor } from "@/types/common/engine/piece";
import type {
    ClientToServer,
    ClientType,
    InterServer,
    ServerToClient,
    SocketData
} from "@/types/common/socket";

// starting color & color assignment
// NOTE when changing either of next two types, we MUST update RequestValidator
export type StartingColor = PieceColor | "Random";
export type ColorAssignmentRule = `FirstJoinIs${PieceColor}`
    | "Random"
    | {
        sessionId: string;
        color: PieceColor;
    };

// game details
export type OnlineSessions = {
    [sessionId: string]: number; // counts # connections client has open
};

export interface GameDetails {
    game: HiveGame;
    nsp: Namespace<ClientToServer, ServerToClient, InterServer, SocketData>;
    online: Record<ClientType, OnlineSessions>;
    playerColors: {
        byId: { [sessionId: string]: PieceColor; };
        rule: ColorAssignmentRule;
    };
}

// socket.io type aliases
export type IOServer = Server<ClientToServer, ServerToClient, InterServer, SocketData>;
export type IOSocket = Socket<ClientToServer, ServerToClient, InterServer, SocketData>;
export type IONamespace = Namespace<ClientToServer, ServerToClient, InterServer, SocketData>;

// client details
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