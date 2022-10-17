/**
 * Tiny utility class with static methods to get API routes.
 */
export default class Routes {
    /**
     * Route for home page.
     */
    public static readonly home = "/";

    /**
     * Route for POST method API request to create new game.
     */
    public static readonly newGame = "/api/new-game/";

    /**
     * Route for DELETE method API request to delete existing game.
     * 
     * @param gameId UUID of game
     * @returns route for API call to delete given game
     */
    public static deleteGame(gameId: string): string {
        return `/api/delete-game/${gameId}/`;
    }

    /**
     * Route to join game with given game ID.
     * 
     * @param gameId UUID of game
     * @returns route of page to join given game
     */
    public static joinGame(gameId: string): string {
        return `/game/${gameId}/`;
    }
}