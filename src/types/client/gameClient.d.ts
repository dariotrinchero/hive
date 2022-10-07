import type { PieceColor } from "@/types/common/engine/piece";
import type { TurnResult } from "@/types/common/engine/outcomes";
import type { GameState } from "@/types/common/socket";

export type PlayerColor = PieceColor | "Spectator";

export type ReRenderFn = (state: GameState, started: boolean, res?: TurnResult) => void;