import { h, render } from "preact";

import Routes from "@/common/routes";

import type { NewGameRequest } from "@/types/server/gameServer";

import GamePage from "@/client/pages/GamePage";

// TODO temporary; eventually we want to make requests from a game creation form
const newGameRequest: NewGameRequest = {
    colorAssignmentRule: "FirstJoinIsWhite",
    gameRules: {
        expansions: {
            Ladybug: true,
            Mosquito: true,
            Pillbug: true
        },
        noFirstQueen: true
    },
    startingColor: "Black"
};
fetch(Routes.newGame(), {
    body: JSON.stringify(newGameRequest),
    credentials: "same-origin",
    headers: {
        "Content-Type": "application/json"
    },
    method: "POST",
    mode: "cors",
    redirect: "follow"
})
    .then(res => res.text())
    .then(message => {
        console.log(message);
        render(
            <GamePage />,
            document.body
        );
    })
    .catch(err => console.error("Failed to create game due to error", err));