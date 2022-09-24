import { Component, Fragment, h } from "preact";

import HiveGame from "@/common/game/game";
import GameClient from "@/client/utility/gameClient";

import type { Piece, PieceColor } from "@/types/common/game/piece";
import type { GetMovementResult } from "@/types/common/game/outcomes";
import type { GameState } from "@/types/common/socket";

import Board, { BoardProps } from "@/client/components/Board";
import Spinner from "@/client/components/Spinner";
import InventoryPanel from "@/client/components/InventoryPanel";

export interface MoveAvailability {
    outcome: GetMovementResult;
    premove: boolean;
}

// TODO it is wasteful to duplicate game state here & in HiveGame object, but maybe sensible for
// clean separation of rendering & game logic?
type GameUIProps = Record<string, never>;
type GameUIState = GameState;

export default class GameUI extends Component<GameUIProps, GameUIState> {
    private readonly client: GameClient;

    public constructor() {
        super();
        this.state = { ...HiveGame.initialState() };

        const refreshRendering = () => this.setState({ ...this.client.game.getState() });
        this.client = new GameClient(refreshRendering);
    }

    private getMoves(playerColor: PieceColor, piece: Piece): MoveAvailability {
        return {
            outcome: this.client.game.getMovements(piece, playerColor),
            premove: playerColor !== this.client.game.getCurrTurnColor()
        };
    }

    public override render(): h.JSX.Element {
        // TODO checking playerColor is an unreliable method of checking for game having begun:
        // player color is set as soon as client connects, only Preact has not re-rendered by then;
        // improve this by having game / gameClient be aware of whether game is "pending"
        const playerColor: PieceColor | "Spectating" = this.client.getPlayerColor();

        const boardCallbacks: BoardProps["interactivity"] = playerColor !== "Spectating"
            ? {
                attemptMove: this.client.queueMove.bind(this.client),
                getMoves: this.getMoves.bind(this, playerColor)
            } : undefined;

        return (
            <Fragment>
                <h1>{playerColor === "Spectating" ? "...waiting for opponent" : playerColor}</h1>
                <span>{playerColor === this.client.game.getCurrTurnColor() ? "Your turn" : <span>&nbsp;</span>}</span>
                {playerColor !== "Spectating"
                    ? <Board
                        piecePositions={this.state.posToPiece}
                        currTurnColor={this.state.currTurnColor}
                        interactivity={boardCallbacks}
                    />
                    : <Spinner />
                }
                {playerColor !== "Spectating" &&
                    <InventoryPanel
                        playerColor={playerColor}
                        inventory={this.client.game.getInventory(playerColor)}
                    />
                }
            </Fragment>
        );
    }
}