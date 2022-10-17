import type { h, VNode } from "preact";

import "@/client/styles/pages/Error404";

import Routes from "@/common/routes";

export default function Error404(): VNode {
    document.title = "404 Not Found"; // TODO this is an evil side-effect; make it a hook

    // TODO make these links actually point to what they claim
    return (
        <main>
            <h1>Page not found.</h1>
            <p>
                Consider:
                <ul>
                    <li><a href="javascript:history.back()">returning</a> from whence you came</li>
                    <li>going <a href={Routes.home}>home</a></li>
                    <li>starting a <a href={Routes.home}>new game</a></li>
                    <li><a href={Routes.home}>spectating</a> a game</li>
                </ul>
            </p>
        </main>
    );
}