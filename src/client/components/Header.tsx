import { h, VNode } from "preact";

import "@/client/styles/components/Header";

import type { ClientColor } from "@/types/client/gameClient";
import type { PieceColor } from "@/types/common/engine/piece";

export interface HeaderProps {
    started: boolean;
    playerColor: ClientColor;
    currTurnColor: PieceColor;
}

export default function Header(props: HeaderProps): VNode {
    return (
        <header>
            <h2>{props.started ? props.playerColor : "...waiting for opponent"}</h2>
            <span>{props.playerColor === props.currTurnColor ? "Your turn" : <span>&nbsp;</span>}</span>
        </header>
    );
}