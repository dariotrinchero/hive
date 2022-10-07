import { h } from "preact";

import "@/client/styles/Header";

import type { PlayerColor } from "@/types/client/gameClient";
import type { PieceColor } from "@/types/common/engine/piece";

export interface HeaderProps {
    started: boolean;
    playerColor: PlayerColor;
    currTurnColor: PieceColor;
}

export default function Header(props: HeaderProps): h.JSX.Element {
    return (
        <header>
            <h2>{props.started ? props.playerColor : "...waiting for opponent"}</h2>
            <span>{props.playerColor === props.currTurnColor ? "Your turn" : <span>&nbsp;</span>}</span>
        </header>
    );
}