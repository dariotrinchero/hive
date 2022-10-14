import type { OptionalGameRules } from "@/types/common/engine/game";
import type { ColorAssignmentRule, StartingColor } from "@/types/server/gameManager";

export interface NewGameRequest {
    colorAssignmentRule: ColorAssignmentRule;
    startingColor: StartingColor;
    gameRules?: OptionalGameRules;
}