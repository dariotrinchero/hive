import { Fragment, h } from "preact";
import { useRef, useState } from "preact/hooks";

import HiveGame from "@/common/game/game";
import GameClient from "@/client/utility/gameClient";

import type { Piece, PieceColor } from "@/types/common/game/piece";
import type { GetMoveResult } from "@/types/common/game/outcomes";
import type { GameState } from "@/types/common/socket";
import type { PlayerColor } from "@/types/client/gameClient";
import type { LatticeCoords } from "@/types/common/game/hexGrid";

import Board, { BoardProps } from "@/client/components/Board";
import Spinner from "@/client/components/Spinner";
import InventoryPanel from "@/client/components/InventoryPanel";
import TileDefs from "@/client/components/TileDefs";

export interface WithPremove<T extends GetMoveResult> {
    outcome: T;
    premove: boolean;
}

interface HexDimensions {
    cornerRad: number;
    hexGap: number;
}

export default function GameUI() {
    // TODO it is wasteful to duplicate game state here & in HiveGame object, but maybe sensible for
    // clean separation of rendering & game logic? Is there a better pattern for this?
    const [gameState, setGameState] = useState<GameState>(HiveGame.initialState());
    const [hexDims] = useState<HexDimensions>({ cornerRad: 100 / 6, hexGap: 100 / 18 });

    const gameClient = useRef<GameClient>(new GameClient(state => setGameState(state)));

    function addPremove<T extends GetMoveResult>(
        getMove: (piece: Piece, colOverride: PieceColor) => T,
        playerColor: PieceColor
    ): (piece: Piece) => WithPremove<T> {
        return (piece: Piece) => ({
            outcome: getMove(piece, playerColor),
            premove: playerColor !== gameState.currTurnColor
        });
    }

    // TODO any better way of writing all this repetative junk?
    const getMovements = (piece: Piece, colOverride: PieceColor) =>
        gameClient.current.game.getMovements(piece, colOverride);
    const getPlacements = (piece: Piece, colOverride: PieceColor) =>
        gameClient.current.game.getPlacements(piece, colOverride);
    const attemptMove = (piece: Piece, dest: LatticeCoords) =>
        gameClient.current.queueMove(piece, dest);

    function renderBoardArea(): h.JSX.Element {
        if (!gameStarted) return <Spinner />;

        const boardCallbacks: BoardProps["interactivity"] = playerColor !== "Spectator"
            ? {
                attemptMove,
                getMovements: addPremove(getMovements, playerColor),
                getPlacements: addPremove(getPlacements, playerColor)
            } : undefined;

        return (
            <Fragment>
                <Board
                    piecePositions={gameState.posToPiece}
                    turnCount={gameState.turnCount}
                    interactivity={boardCallbacks}
                    hexGap={hexDims.hexGap}
                />
                {playerColor !== "Spectator" &&
                    <InventoryPanel
                        playerColor={playerColor}
                        inventory={gameClient.current.game.getInventory(playerColor)}
                    />
                }
            </Fragment>
        );
    }

    // TODO checking 'playerColor' is an unreliable method of checking for game having begun:
    // player color is set as soon as client connects, only Preact has not re-rendered by then;
    // improve this by having game / gameClient be aware of whether game is "pending"
    const playerColor: PlayerColor = gameClient.current.getPlayerColor();
    const gameStarted: boolean = playerColor !== "Spectator";

    return (
        <Fragment>
            <h1>{gameStarted ? playerColor : "...waiting for opponent"}</h1>
            <span>{playerColor === gameState.currTurnColor ? "Your turn" : <span>&nbsp;</span>}</span>
            <TileDefs {...hexDims} onlyRoundedHex={!gameStarted} />
            {renderBoardArea()}
        </Fragment>
    );
}