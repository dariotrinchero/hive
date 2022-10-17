import type { h, VNode } from "preact";
import { useEffect, useState } from "preact/hooks";

import Routes from "@/common/routes";

import type { NewGameRequest } from "@/types/server/gameServer";

const reqBody: NewGameRequest = {
    colorAssignmentRule: "FirstJoinIsWhite",
    gameRules: {
        expansions: {
            Ladybug: true,
            Mosquito: true,
            Pillbug: true
        },
        noFirstQueen: true
    },
    startingColor: "White"
};
const newGameReq: RequestInit = {
    body: JSON.stringify(reqBody),
    credentials: "same-origin",
    headers: {
        "Content-Type": "application/json"
    },
    method: "POST",
    mode: "cors",
    redirect: "follow"
};

export default function Home(): VNode {
    const [location, setLocation] = useState<string>();
    const [ok, setOk] = useState(false);

    useEffect(() => {
        fetch(Routes.newGame, newGameReq)
            .then(res => {
                setOk(res.ok);
                setLocation(res.headers.get("Location") || undefined);
            })
            .catch(err => setLocation(`Failed to create game due to error ${JSON.stringify(err)}`));
    }, []);

    return (
        <main>
            <h1>Game creation outcome</h1>
            <p>{ok ? (<a href={location}>Success!</a>) : location}</p>
        </main>
    );
}