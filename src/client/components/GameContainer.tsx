import { Component, h } from "preact";

import HiveGame from "@/common/game/game";
import GameClient from "@/client/utility/gameClient";

import type { Piece, PieceColor } from "@/types/common/piece";
import type { MovementCheckOutcome } from "@/types/common/game/game";
import type { GameState } from "@/types/common/socket";

import Board from "@/client/components/Board";

export interface MoveAvailability {
    outcome: MovementCheckOutcome;
    premove: boolean;
}

// TODO maybe it is wasteful to duplicate this data here and in the HiveGame object, but
// maybe it is sensible for having clean separation of rendering & game logic?
interface GameContainerState extends GameState {
    spectating: boolean;
}

export default class GameContainer extends Component<Record<string, never>, GameContainerState> {
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

    public checkForMove(piece: Piece): MoveAvailability {
        const playerColor: PieceColor | undefined = this.client.getPlayerColor();
        return {
            outcome: this.client.game.checkPieceForMove(piece, undefined, playerColor),
            premove: playerColor !== this.client.game.getCurrTurnColor()
        };
    }

    public override render(): h.JSX.Element {
        const getMoves = (piece: Piece, viaPillbug: boolean) =>
            this.client.game.generateLegalMoves(piece, viaPillbug, this.client.getPlayerColor());

        return (
            // TODO add other game-related components here
            <Board
                interactable={!this.state.spectating}
                piecePositions={this.state.posToPiece}
                getMoves={getMoves}
                checkForMove={this.checkForMove.bind(this)}
                doMove={this.client.queueMove.bind(this.client)}
            />
        );
    }
}