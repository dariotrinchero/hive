# Hive
This is a minimal web implementation of the two-player abstract strategy game Hive.

## Project structure

The project consists of two components, which are compiled (mostly) separately:
- client code, which runs in a browser, is found in
    ```src/client```,
    and has entry point
    ```src/client/app.tsx```
- server code, which runs in Node.js, is found in
    ```src/server```,
    and has entry point
    ```src/server/index.ts```

Some code is shared by the client and server - namely, that in
```src/common```. This consists mainly of the game logic. The game logic code is duplicated in this way because the
1. *server* should be authoratative on the game state, and enforce legality of moves
2. *client* should be able to quickly compute & display legal moves without having to query the server

Since the game state is distributed, we need additional code to maintiain parity. Whenever there is a disagreement, the server is authoratative; the client requests and loads the server-side game state.

Shared Typescript type & interface definitions are in ```src/types```, the structure of which mostly mimics that of ```src```. Finally, unit tests are in ```test```.

## Compiling & running for development

First, install dependencies with
```bash
    npm i
```
Now to compile & bundle both the client and server code, run
```bash
    npm start
```
which will recompile whenever the source files change, and should automatically launch a game. Finally, to launch the Express server, which manages the websocket connections, run
```bash
    npm run serve-dev
```
which will re-launch the server whenever the compiled server code changes.

To actually play the game, you will need to open the game URL in two different browser sessions (which will act as the 2 players). I recommend just copying the URL into a private browsing window.

## Running unit tests

To run all tests and print coverage with Jest, simply run
```bash
    npm t
```