import { createContext, h } from "preact";
import { useRef, useState } from "preact/hooks";

import "@/client/styles/GameUI";

import HiveGame from "@/common/engine/game";
import GameClient from "@/client/utility/gameClient";

import type { Piece, PieceColor } from "@/types/common/engine/piece";
import type { GetMoveResult, MoveType, TurnResult } from "@/types/common/engine/outcomes";
import type { GameState } from "@/types/common/socket";
import type { PlayerColor } from "@/types/client/gameClient";
import type { LatticeCoords, PosToPiece } from "@/types/common/engine/hexGrid";

import Board, { BoardProps } from "@/client/components/Board";
import Spinner from "@/client/components/Spinner";
import HexDefs from "@/client/components/HexDefs";
import Header from "@/client/components/Header";
import HexGrid from "@/common/engine/hexGrid";

export interface WithPremove<T extends GetMoveResult> {
    outcome: T;
    premove: boolean;
}

export interface GameUIState extends GameState {
    started: boolean;
    lastTurn: TurnResult | undefined;
}

// TODO include other global settings in here
interface UISettings {
    cornerRad: number;
    hexGap: number;
}
const initUISettings: UISettings = { cornerRad: 100 / 6, hexGap: 100 / 18 };
export const UISettingContext = createContext<UISettings>(initUISettings);

export default function GameUI() {
    const gameClient = useRef<GameClient>(new GameClient(
        (state, recenter) => {
            if (recenter) setBoardOrigin(averagePos(state.posToPiece));
            setUIState(state);
        }
    ));

    // TODO it is wasteful to duplicate game state here & in HiveGame object, but maybe sensible for
    // clean separation of rendering & game logic? Is there a better pattern for this?
    const [uiState, setUIState] = useState<GameUIState>({
        ...HiveGame.initialState(),
        lastTurn: undefined,
        started: false
    });

    const [boardOrigin, setBoardOrigin] = useState<LatticeCoords>([0, 0]);

    // TODO add ability to modify these settings
    const [uiSettings] = useState<UISettings>(initUISettings);

    /**
     * Calculate average position (center of mass) of all pieces.
     * 
     * @returns averate position of pieces (in lattice coordinates)
     */
    function averagePos(posToPiece: PosToPiece): LatticeCoords {
        const average: LatticeCoords = [0, 0];
        const length = Object.keys(posToPiece).length || 1;

        HexGrid.entriesOfPosRecord(posToPiece).forEach(entry => {
            average[0] += entry[0][0];
            average[1] += entry[0][1];
        });
        average[0] /= length;
        average[1] /= length;
        return average;
    }

    const attemptMove = (piece: Piece, destination: LatticeCoords, turnType: MoveType) =>
        gameClient.current.queueMove({ destination, piece, turnType });
    const getMoves = (currCol: PieceColor) => (piece: Piece, turnType: MoveType) => ({
        outcome: gameClient.current.game.getMoves({ currCol, piece, turnType }),
        premove: currCol !== uiState.currTurnColor
    });

    const playerColor: PlayerColor = gameClient.current.getPlayerColor();
    const boardInteractivity: BoardProps["interactivity"] = playerColor !== "Spectator"
        ? {
            attemptMove,
            getMoves: getMoves(playerColor),
            inventory: gameClient.current.game.getInventory(playerColor),
            playerColor
        } : undefined;

    return (
        <UISettingContext.Provider value={uiSettings}>
            <Header
                currTurnColor={uiState.currTurnColor}
                playerColor={playerColor}
                started={uiState.started}
            />
            <HexDefs />
            {!uiState.started
                ? <Spinner />
                : <Board
                    origin={boardOrigin}
                    lastTurn={uiState.lastTurn}
                    piecePositions={uiState.posToPiece}
                    turnCount={uiState.turnCount}
                    interactivity={boardInteractivity}
                />
            }
        </UISettingContext.Provider>
    );
}