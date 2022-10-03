import { createContext, h } from "preact";
import { useRef, useState } from "preact/hooks";

import HiveGame from "@/common/game/game";
import GameClient from "@/client/utility/gameClient";

import type { Piece, PieceColor } from "@/types/common/game/piece";
import type { GetMoveResult, MoveType, TurnResult } from "@/types/common/game/outcomes";
import type { GameState } from "@/types/common/socket";
import type { PlayerColor } from "@/types/client/gameClient";
import type { LatticeCoords } from "@/types/common/game/hexGrid";

import Board, { BoardProps } from "@/client/components/Board";
import Spinner from "@/client/components/Spinner";
import HexDefs from "@/client/components/HexDefs";

export interface WithPremove<T extends GetMoveResult> {
    outcome: T;
    premove: boolean;
}

interface HexDimensions {
    cornerRad: number;
    hexGap: number;
}

const initHexDims: HexDimensions = { cornerRad: 100 / 6, hexGap: 100 / 18 };

// TODO include other global settings in here
export const UISettingContext = createContext<HexDimensions>(initHexDims);

export default function GameUI() {
    // TODO it is wasteful to duplicate game state here & in HiveGame object, but maybe sensible for
    // clean separation of rendering & game logic? Is there a better pattern for this?
    const [gameState, setGameState] = useState<GameState>(HiveGame.initialState());
    const [started, setStarted] = useState(false);
    const [lastTurn, setLastTurn] = useState<TurnResult>();
    const [hexDims] = useState<HexDimensions>(initHexDims);

    const gameClient = useRef<GameClient>(new GameClient(
        (state, started, result?) => {
            setLastTurn(result);
            setGameState(state);
            setStarted(started);
        }
    ));

    const attemptMove = (piece: Piece, destination: LatticeCoords, turnType: MoveType) =>
        gameClient.current.queueMove({ destination, piece, turnType });
    const getMoves = (colorOverride: PieceColor) => (piece: Piece, turnType: MoveType) => ({
        outcome: gameClient.current.game.getMoves({ colorOverride, piece, turnType }),
        premove: colorOverride !== gameState.currTurnColor
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
        <UISettingContext.Provider value={hexDims}>
            <header>
                <h1>{started ? playerColor : "...waiting for opponent"}</h1>
                <span>{playerColor === gameState.currTurnColor ? "Your turn" : <span>&nbsp;</span>}</span>
            </header>
            <HexDefs />
            {!started
                ? <Spinner />
                : <Board
                    lastTurn={lastTurn}
                    piecePositions={gameState.posToPiece}
                    turnCount={gameState.turnCount}
                    interactivity={boardInteractivity}
                />}
        </UISettingContext.Provider>
    );
}