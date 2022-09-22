import { Component, Fragment, h } from "preact";

import HiveGame from "@/common/game/game";
import GameClient from "@/client/utility/gameClient";

import type { Piece, PieceColor } from "@/types/common/game/piece";
import type { GetMovementResult } from "@/types/common/game/outcomes";
import type { GameState } from "@/types/common/socket";

import Board from "@/client/components/Board";
import Spinner from "./Spinner";

export interface MoveAvailability {
    outcome: GetMovementResult;
    premove: boolean;
}

// TODO maybe it is wasteful to duplicate this data here and in the HiveGame object, but
// maybe it is sensible for having clean separation of rendering & game logic?
interface GameUIState extends GameState {
    spectating: boolean;
}

export default class GameUI extends Component<Record<string, never>, GameUIState> {
    private readonly client: GameClient;

    public constructor() {
        super();
        this.state = {
            ...HiveGame.initialState(),
            spectating: false
        };

        const spectate = () => this.setState({ spectating: true });
        const refreshRendering = () => this.setState({
            ...this.client.game.getState()
        });

        this.client = new GameClient(spectate, refreshRendering);
    }

    private getMoves(piece: Piece): MoveAvailability {
        const playerColor: PieceColor | undefined = this.client.getPlayerColor();
        return {
            outcome: this.client.game.getMovements(piece, playerColor),
            premove: playerColor !== this.client.game.getCurrTurnColor()
        };
    }

    public override render(): h.JSX.Element {
        // TODO this is an unreliable method of checking for game having begun:
        // player color is set as soon as client connects, only Preact has not re-rendered by then;
        // improve this by having game / gameClient be aware of whether game is "pending"
        const playerColor: PieceColor | undefined = this.client.getPlayerColor();
        return (
            <Fragment>
                <h1>{playerColor || "...waiting for opponent"}</h1>
                <span>{playerColor === this.client.game.getCurrTurnColor() ? "Your turn" : <span>&nbsp;</span>}</span>
                {playerColor
                    ? <Board
                        interactable={!this.state.spectating}
                        piecePositions={this.state.posToPiece}
                        currTurnColor={this.state.currTurnColor}
                        getMoves={this.getMoves.bind(this)}
                        attemptMove={this.client.queueMove.bind(this.client)}
                    />
                    : <Spinner />}
            </Fragment>
        );
    }
}