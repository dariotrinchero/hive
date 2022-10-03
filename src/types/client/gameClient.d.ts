import type { PieceColor } from "@/types/common/game/piece";
import type { TurnResult } from "@/types/common/game/outcomes";
import type { GameState } from "@/types/common/socket";

export type PlayerColor = PieceColor | "Spectator";

export type ReRenderFn = (state: GameState, started: boolean, res?: TurnResult) => void;