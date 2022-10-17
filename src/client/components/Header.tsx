import type { h, VNode } from "preact";

import "@/client/styles/components/Header";

import type { ClientColor } from "@/types/client/gameClient";
import type { PieceColor } from "@/types/common/engine/piece";

import type { GamePageStatus } from "@/client/pages/Game";

export interface HeaderProps {
    status: GamePageStatus;
    playerColor: ClientColor;
    currTurnColor: PieceColor;
}

export default function Header(props: HeaderProps): VNode {
    let title: string;
    if (props.status === "NonExistent") title = "Invalid game";
    else if (props.status === "Pending") title = "...waiting for opponent";
    else title = props.playerColor;

    let subtitle: string | h.JSX.Element;
    if (props.status === "BlackWin") subtitle = "Game over: black won";
    else if (props.status === "WhiteWin") subtitle = "Game over: white won";
    else if (props.status === "Draw") subtitle = "Game ended in draw";
    else if (props.status !== "NonExistent" && props.playerColor === props.currTurnColor) subtitle = "Your turn";
    else subtitle = (<span>&nbsp;</span>);

    return (
        <header>
            <h2>{title}</h2>
            <span>{subtitle}</span>
        </header>
    );
}