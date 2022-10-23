[![Node.js CI](https://github.com/Doormango/hive/actions/workflows/node.js.yml/badge.svg)](https://github.com/Doormango/hive/actions/workflows/node.js.yml)

# Hive
This is a minimal web implementation of the two-player abstract strategy game Hive.

## Project structure

The project consists of two components, which are compiled (mostly) separately:
- Preact & Socket.io **client** code, which runs in a browser, is found in
    ```src/client```,
    and has entry point
    ```src/client/app.tsx```
- Express & Socket.io **server** code, which runs in Node.js, is found in
    ```src/server```,
    and has entry point
    ```src/server/index.ts```

**The client** serves as a Hive **viewer** - that is, it shows the current state of the game & allows interaction - and handles API calls and websocket connections with the server to enable synchronous multiplayer.

**The server** manages the state of active games, and hosts a REST API for creating/deleting games. It also relays real-time moves between clients over websockets.

Some code is **shared** by the client and server - namely, that in
```src/common```. This is mainly the Hive **engine** - that is, the logic that understands the rules of Hive, presenting an API to make moves, get legal moves, etc. The engine code runs on both client and server because the
1. *server* should be authoratative on the game state, and enforce legality of moves
2. *client* should be able to quickly compute & display legal moves without having to query the server

Since the game state is distributed, we need additional code to maintiain parity. Whenever there is a disagreement, the server is authoratative; the client requests and loads the server-side game state.

Shared Typescript type & interface definitions are in ```src/types```, the structure of which mostly mimics that of ```src```. Finally, unit tests are in ```test```.

## Running locally

### 1. Cloning & installing

Clone the reposistory with
```bash
git clone git@github.com:Doormango/hive.git; cd hive
```
then, install dependencies with
```bash
npm i
```

Note that this project was developed and tested with Node.js version v16.17.0.

### 2. Compiling & running in development mode

Now to compile & bundle both the client and server code, run
```bash
npm start
```
which will recompile whenever the source files change, and should automatically launch the game URL in the default browser. This game will attempt to connect over websockets to a local Node.js server, which must be launched separately. To start the Node server, run
```bash
npm run serve-dev
```
which will also re-launch the server whenever the compiled server code changes.

Note that `npm start` will serve the client page using Webpack DevServer (and not the Node Express server included in the source), since this enables hot reloading. Webpack DevServer runs on a different port to the Node server, and simply *proxies* websocket connections & API calls to the port of the Node server, allowing the two to coexist. However, this means that none of the *Express* routing / middleware pertaining to serving the client page (such as the 404 error message, etc) will be run with the above commands.

There is also the alternative script
```bash
npm run watch
```
which will compile & bundle both client and server code (and recompile upon source code changes), but will not launch anything (neither the client webpage nor the Node server). This is useful to check whether code changes compile without spawning spurious browser windows.

### 3. Playing the game locally

To actually play the game, you will need to open the game URL in two different browser sessions (which will act as the 2 players). Running ```npm start``` should automatically open one game session - I recommend just copying this URL into a separate private browsing window to act as the second game session.

## One Script to Rule Them All

There is a problem with the development workflow as described in the previous section; namely, the scripts ```npm start``` and ```npm run serve-dev``` almost always need to be running in tandem. This causes some annoyances:

1. two terminal windows are needed to keep both scripts running
2. we must ensure never to launch or kill one script without the other
3. we must ensure never to have two running instances of either script
4. since ```npm start``` always spawns a new browser window, we must manually close the orphaned browser tabs whenever killing either script 

**There is a script which addresses all of these issues** using ```tmux```:
```bash
npm run tmux
```
This will create a new ```tmux``` session named "```hive```" (or attach to it if it already exists), in which two panes are launched (or restarted if they already exist), each running one of the aforementioned scripts. The entire ```tmux``` session is automatically killed whenever either script exits. This way we ensure that both commands spawn, persist, and die together.

We also pass an additional environment variable, ```AUTOKILL```, to Webpack, the value of which is read by a custom Webpack plugin and used to replace all occurrences of ```process.env.AUTOKILL``` in the compiled webpage code. The game client checks this value, and if it is defined will automatically kill the browser tab whenever the connection to the websocket server is dropped.

This *almost* solves the issue of orphaned brower tabs. Firefox currently does not allow tabs which were not programmatically spawned to close themselves. Therefore, the browser tab which is automatically opened by Webpack will happily kill itself when needed, but to get the private browsing tab to close, we need to also programmatically spawn this tab.

The current workaround is as follows: when ```tmux``` launches, it will also open a third pane, and *send* (but not run) the command
```bash
firefox --private-window http://localhost:$npm_package_config_devServerPort/game/$npm_package_config_devGameId/'
```
to open a second copy of the game in a Firefox private browsing window. When we want the second player to join, we can simply press enter to run this command. Not only does this allow the new tab to later kill itself, it is also easier than manually copying the URL to a new private browsing window.

## Running unit tests

To run all tests and print coverage with Jest, simply run
```bash
npm t
```

## Building & running for production

The script
```bash
npm run build
```
will automatically lint, test, compile, and bundle the project in development mode, where minification is active, and source mappings are disabled.

After building in this way, the script
```bash
npm run serve
```
will launch the Node server to serve the static client page via Express, and handle incoming websocket connections.
