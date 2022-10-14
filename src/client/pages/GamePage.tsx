import { createContext, h, VNode } from "preact";
import { useMemo, useState } from "preact/hooks";

import "@/client/styles/pages/GamePage";

import HiveGame from "@/common/engine/game";
import GameClient from "@/client/utility/gameClient";
import HexGrid from "@/common/engine/hexGrid";
import ConvertCoords, { SVGCoords } from "@/client/utility/convertCoords";
import Notation from "@/common/engine/notation";

import type { Piece } from "@/types/common/engine/piece";
import type { MoveOptions, TurnResult } from "@/types/common/engine/outcomes";
import type { GameState } from "@/types/common/socket";
import type { ClientColor } from "@/types/client/gameClient";
import type { LatticeCoords, PosToPiece } from "@/types/common/engine/hexGrid";
import type { PathMap } from "@/types/common/engine/graph";

import Board from "@/client/components/Board";
import Spinner from "@/client/components/Spinner";
import HexDefs from "@/client/components/HexDefs";
import Header from "@/client/components/Header";
import Inventory from "@/client/components/Inventory";
import Tabs from "@/client/components/Tabs";
import Tile, { TileState } from "@/client/components/Tile";

type TileParent = "Inventory" | "Board";
interface SpecialTile {
    // tile with special state (eg. selected, just placed, shaking, etc)
    piece: Piece;
    pos: LatticeCoords;
    parent: TileParent;
    state: TileState; // special state of this tile
    animateFrom?: SVGCoords;
}

export interface Placeholders {
    options: MoveOptions;
    pathMap?: PathMap<LatticeCoords>;
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

const initPlaceholders: Placeholders = { options: {} };
const initUISettings: UISettings = { cornerRad: 100 / 6, hexGap: 100 / 18 };

export const UISettingContext = createContext<UISettings>(initUISettings);

export default function GamePage(): VNode {
    const [boardOrigin, setBoardOrigin] = useState<LatticeCoords>([0, 0]);
    const [placeholders, setPlaceholders] = useState<Placeholders>(initPlaceholders);
    const [specialTile, setSpecialTile] = useState<SpecialTile>();
    const [shakeKey, setShakeKey] = useState(1); // used to force remount & restart CSS animation

    const [gameState, setGameState] = useState<GameUIState>({
        ...HiveGame.initialState(),
        lastTurn: undefined,
        started: false
    });

    // TODO add ability to modify these settings
    const [uiSettings] = useState<UISettings>(initUISettings);
    const svgCoords = (p: LatticeCoords) => ConvertCoords.hexLatticeToSVG(uiSettings.hexGap, ...p);

    const gameClient: GameClient = useMemo(() => new GameClient(
        (state, recenter) => {
            if (recenter) setBoardOrigin(averagePos(state.posToPiece));
            setGameState(state);
            clearSelection();

            if (state.lastTurn?.status === "Ok" && state.lastTurn.turnType !== "Pass") {
                const { destination, piece, turnType } = state.lastTurn;
                setSpecialTile({
                    animateFrom: turnType === "Movement" ? state.lastTurn.origin : undefined,
                    parent: "Board",
                    piece,
                    pos: destination,
                    state: turnType === "Movement" ? "Sliding" : "Dropping"
                });
            }
        }
    ), []);

    const playerColor: ClientColor = gameClient.getPlayerColor();

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

    /**
     * Reset state pertaining to user selections, including placeholders & special tile.
     */
    function clearSelection(): void {
        setSpecialTile(undefined);
        setPlaceholders(initPlaceholders);
    }

    /**
     * Handle user clicking tile corresponding to given piece at given position. Specifically,
     * either select/deselect piece, in the former case retrieving & storing available moves.
     * Shake tile if attempting to select a tile with no available moves.
     * 
     * @param piece piece represented by clicked tile
     * @param pos position of clicked tile (if on board)
     * @param parent parent component of tile (board / inventory)
     */
    function handleTileClick(piece: Piece, pos: LatticeCoords, parent: TileParent): void {
        if (playerColor === "Spectator") return;

        if (specialTile?.state === "Selected"
            && HexGrid.eqPiece(specialTile.piece, piece)) clearSelection();
        else {
            setPlaceholders(initPlaceholders);
            const outcome = gameClient.game.getMoves({
                currCol: playerColor,
                piece,
                turnType: parent === "Inventory" ? "Placement" : "Movement"
            });
            const premove = playerColor !== gameState.currTurnColor;

            if (outcome.status === "Ok") {
                setSpecialTile({ ...outcome, parent, pos, state: "Selected" });
                setPlaceholders({ ...outcome });
            } else {
                setSpecialTile({ ...outcome, parent, piece, pos, state: "Shaking" });
                setShakeKey((prev: number) => -prev);
                console.error(`No legal moves; getMoves() gave message: ${outcome.message}`);
            }
        }
    }

    /**
     * Render single given piece tile.
     * 
     * @param piece the piece to render
     * @param pos position of tile (in lattice coordinates)
     * @param parent parent component of tile (board / inventory)
     * @param inactive whether tile should be inactive
     * @returns Tile representing given piece at given location
     */
    function renderTile(piece: Piece, pos: LatticeCoords, parent: TileParent, inactive?: boolean): VNode {
        let state: TileState = "Inactive";
        if (playerColor !== "Spectator" && !inactive) {
            if (specialTile?.parent === parent
                && HexGrid.eqPiece(piece, specialTile.piece)) state = specialTile.state;
            else if (specialTile?.state !== "Selected" || parent === "Inventory") state = "Normal";
        }
        return (
            <Tile
                key={`${Notation.pieceToString(piece)}${state === "Shaking" ? shakeKey : ""}`}
                piece={piece}
                pos={svgCoords(pos)}
                slideFrom={specialTile?.animateFrom && svgCoords(specialTile.animateFrom)}
                handleClick={() => handleTileClick(piece, pos, parent)}
                state={state}
            />
        );
    }

    /**
     * Render tabbed board overlay, containing player inventories & move history.
     * 
     * @returns absolutely-positioned div containing inventory & history tabs
     */
    function renderOverlay(): VNode {
        const renderInvTile = (piece: Piece, inactive?: boolean) =>
            renderTile(piece, [0, 0], "Inventory", inactive);
        return (
            <div id="overlay">
                <Tabs
                    collapseAt="30em"
                    tabDefs={[
                        {
                            content: (
                                <Inventory
                                    playerColor={playerColor}
                                    inventories={gameClient.game.getInventory()}
                                    renderTile={renderInvTile}
                                />
                            ),
                            title: "Inventory"
                        },
                        {
                            content: (
                                <a
                                    href="something"
                                    role="button"
                                    class="button1"
                                >
                                    Concede
                                </a>
                            ),
                            title: "History"
                        },
                        {
                            content: (
                                <h1>
                                    TODO
                                </h1>
                            ),
                            title: "Chat"
                        }
                    ]}
                />
            </div>
        );
    }

    function renderPlayArea(): VNode {
        if (!gameState.started) return <Spinner />;
        const renderBoardTile = (piece: Piece, pos: LatticeCoords, inactive?: boolean) =>
            renderTile(piece, pos, "Board", inactive);
        const attemptMove = (destination: LatticeCoords) => {
            clearSelection();
            if (!specialTile?.piece) return;
            gameClient.queueMove({
                destination,
                piece: specialTile.piece,
                turnType: specialTile.parent === "Board" ? "Movement" : "Placement"
            });
        };

        return (
            <div id="play-area">
                {renderOverlay()}
                <Board
                    origin={boardOrigin}
                    allowPan={gameState.turnCount > 0}
                    placeholders={placeholders}
                    handlePlaceholderClick={attemptMove}
                    pieces={gameState.posToPiece}
                    sliding={specialTile?.state === "Sliding" ? specialTile.piece : undefined}
                    renderTile={renderBoardTile}
                />
            </div>
        );
    }

    return (
        <UISettingContext.Provider value={uiSettings}>
            <Header
                currTurnColor={gameState.currTurnColor}
                playerColor={playerColor}
                started={gameState.started}
            />
            <HexDefs />
            {renderPlayArea()}
        </UISettingContext.Provider>
    );
}