import type { PieceColor } from "@/types/common/engine/piece";
import type { GameUIState } from "@/client/pages/Game";

export type ClientColor = PieceColor | "Spectator";

export type ReRenderFn = (state: GameUIState, recenter: boolean) => void;