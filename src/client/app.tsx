import { h, render, VNode } from "preact";
import { Route, Router } from "preact-router";

import Routes from "@/common/routes";

import Home from "@/client/pages/Home";
import Game from "@/client/pages/Game";
import Error404 from "@/client/pages/Error404";

const Main: () => VNode = () => (
    <Router>
        <Route path={Routes.home} component={Home} />
        <Route path={Routes.joinGame(":gameId")} component={Game} />
        <Route component={Error404} default />
    </Router>
);

render(
    <Main />,
    document.body
);