// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Component, h } from "preact";

import HiveGame from "@/common/game/game";
import GameClient from "@/client/sockets/gameClient";

import type { GameState } from "@/types/common/socket";

import Board from "@/client/components/Board";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface GameContainerProps {
    // TODO
}

interface GameContainerState extends GameState {
    spectating: boolean;
}

export default class GameContainer extends Component<GameContainerProps, GameContainerState> {
    private game: HiveGame;
    private gameClient: GameClient;

    public constructor() {
        super();

        this.game = new HiveGame();

        this.state = {
            ...this.game.getState(),
            spectating: false
        };

        this.gameClient = new GameClient(
            this.game,
            () => this.setState({ spectating: true }),
            (state: GameState) => this.setState({ ...state }) // TODO which has precedence?
        );
    }



    public override render(): h.JSX.Element {
        return (
            <Board
                interactable={!this.state.spectating}
                piecePositions={this.state.posToPiece}
                // TODO are these bindings correct?
                doMove={this.gameClient.makeMoveOrPremove.bind(this.gameClient)}
                getMoves={this.gameClient.generateLegalMoves.bind(this.gameClient)}
                checkForMove={this.gameClient.checkPieceForMove.bind(this.gameClient)}
            />
        );
    }
}