export default class Routes {
    /**
     * Get the route for the game with the given game ID.
     * 
     * @param gameId UUID of game
     * @returns route for given game
     */
    public static getGameRoute(gameId: string): string {
        return `/game/${gameId}/`;
    }
}