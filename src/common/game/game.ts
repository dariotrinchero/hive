import { invertColor, pieceInventory } from "@/common/game/piece";
import GraphUtils from "@/common/game/graph";
import HexGrid from "@/common/game/hexGrid";

import type {
    CanMoveErrorMsg,
    CanPlaceErrorMsg,
    GetMovementResult,
    GetMoveQuery,
    GetMoveResult,
    GetPillbugError,
    GetPillbugResult,
    GetPlacementResult,
    MovementError,
    MovementErrorMsg,
    MovementResult,
    MovementType,
    MoveOptions,
    PassError,
    PassResult,
    PlacementError,
    PlacementErrorMsg,
    PlacementResult,
    TurnAttempt,
    TurnResult
} from "@/types/common/game/outcomes";
import type { Piece, PieceColor, PieceCount, PieceType } from "@/types/common/game/piece";
import type { GameState } from "@/types/common/socket";
import type {
    GameStatus,
    LastMoveDestination,
    MoveGen,
    PlacementCount,
    PlayerInventories,
    SuccessOr,
    SuccessPillbugOr
} from "@/types/common/game/game";
import type { BFSAdj, Filter, IsCutVertex, PathMap } from "@/types/common/game/graph";
import type { LatticeCoords } from "@/types/common/game/hexGrid";

export default class HiveGame extends HexGrid {
    // graph algorithms
    private static readonly graphUtils = new GraphUtils<LatticeCoords>(pos => pos.join(","));
    private isCutVertex?: IsCutVertex<LatticeCoords>;

    // game state
    private turnCount: number;
    private currTurnColor: PieceColor;
    private movedLastTurn: LastMoveDestination;

    // inferrable from state
    private placementCount: PlacementCount;
    private playerInventories: PlayerInventories;
    private gameStatus: GameStatus;

    // optional tournament rule (see https://boardgamegeek.com/wiki/page/Hive_FAQ#toc5)
    private noFirstQueen: boolean;

    public constructor(colorToStart?: PieceColor, noFirstQueen?: boolean) {
        super();
        this.playerInventories = {
            Black: { ...pieceInventory },
            White: { ...pieceInventory }
        };
        const init: GameState = HiveGame.initialState(colorToStart);
        this.currTurnColor = init.currTurnColor;
        this.movedLastTurn = init.movedLastTurn;
        this.turnCount = init.turnCount;
        this.posToPiece = init.posToPiece;
        this.placementCount = { Black: 0, White: 0 };
        this.gameStatus = "Ongoing";
        this.noFirstQueen = noFirstQueen || false;
    }

    // ===================================================================================================
    //  Public-facing API functions
    // ===================================================================================================

    public static initialState(colorToStart?: PieceColor): GameState {
        return {
            currTurnColor: colorToStart || "Black",
            movedLastTurn: { Black: null, White: null },
            posToPiece: {},
            turnCount: 0
        };
    }

    /**
     * Obtain game instance from given game state.
     * 
     * @param state desired game state
     * @returns instance of HiveGame with the given state
     */
    public static fromState(state: GameState): HiveGame {
        const game = new HiveGame();
        game.turnCount = state.turnCount;
        game.currTurnColor = state.currTurnColor;
        game.movedLastTurn = state.movedLastTurn;
        game.posToPiece = state.posToPiece;

        // infer other game state variables
        HiveGame.entriesOfPosRecord(game.posToPiece).forEach(([pos, piece]) => {
            const recordPiece = (currPiece: Piece) => {
                if (currPiece.covering) recordPiece(currPiece.covering);
                game.setPos(pos, currPiece);
                game.placementCount[currPiece.color]++;
                game.playerInventories[currPiece.color][currPiece.type]--;
            };
            recordPiece(piece);
        });

        game.gameStatus = game.checkGameStatus();
        return game;
    }

    public getState(): GameState {
        const { currTurnColor, movedLastTurn, posToPiece, turnCount } = this;
        return { currTurnColor, movedLastTurn, posToPiece, turnCount };
    }

    public getInventory(color: PieceColor): PieceCount { return this.playerInventories[color]; }

    public setNoFirstQueen(nfq: boolean): void { this.noFirstQueen = nfq; }

    public setColorToStart(color: PieceColor): void {
        if (this.turnCount === 0) this.currTurnColor = color;
    }

    /**
     * Process given turn request & perform appropriate actions.
     * 
     * @param turn object encoding details of turn request
     * @returns discriminated union indicating attempted turn action with details of success or failure
     */
    public processTurn(turn: TurnAttempt): TurnResult {
        // handle specific turn attempt
        if ("turnType" in turn) {
            if (turn.turnType === "Pass") return this.passTurn();
            else if (turn.turnType === "Movement") return this.movePiece(turn.piece, turn.destination);
            return this.placePiece(turn.piece, turn.destination);
        }

        // handle generic turn attempt
        const pieceIsOnBoard = this.getPosOf(turn.piece);

        // throw error on invalid destination
        const pos = this.relToAbs(turn.destination);
        if (!pos) return {
            message: "ErrInvalidDestination",
            status: "Error",
            turnType: pieceIsOnBoard ? "Movement" : "Placement"
        };

        if (pieceIsOnBoard) return this.movePiece(turn.piece, pos);
        return this.placePiece(turn.piece, pos);
    }

    /**
     * Get all possible legal moves of specified type ("Movement" / "Placement") for given piece.
     * 
     * @param query details of piece and move type
     * @returns discriminated union containing either valid move locations or error details
     */
    public getMoves(query: GetMoveQuery): GetMoveResult {
        if (query.turnType === "Movement") return this.getMovements(query.piece, query.colorOverride);
        return this.getPlacements(query.piece, query.colorOverride);
    }

    /**
     * Check whether game has ended, and if so in what outcome.
     * 
     * @returns whether game is ongoing; otherwise outcome of game
     */
    public checkGameStatus(): GameStatus {
        const blackBeePos = this.getPosOf({ color: "Black", index: 1, type: "QueenBee" });
        const whiteBeePos = this.getPosOf({ color: "White", index: 1, type: "QueenBee" });
        if (!blackBeePos || !whiteBeePos) return "Ongoing";

        const blackSurrounded: boolean = this.adjPieceCoords(blackBeePos).length === 6;
        const whiteSurrounded: boolean = this.adjPieceCoords(whiteBeePos).length === 6;
        if (blackSurrounded && whiteSurrounded) return "Draw";
        if (blackSurrounded) return "WhiteWin";
        if (whiteSurrounded) return "BlackWin";
        return "Ongoing";
    }

    // ===================================================================================================
    //  Internal helper functions
    // ===================================================================================================

    /**
     * Advance current turn, check for game-ending conditions & record last move; also invalidate 
     * precomputed cut vertices (used to check one-hive rule).
     * 
     * @param moveDest destination of movement in last turn, if any
     */
    private advanceTurn(moveDest?: LatticeCoords): void {
        this.turnCount++;
        this.isCutVertex = undefined;
        this.movedLastTurn[this.currTurnColor] = moveDest || null;
        this.currTurnColor = invertColor(this.currTurnColor);
        this.gameStatus = this.checkGameStatus();
    }

    /**
     * Return whether piece at given position is immobile (due to moving on prior turn).
     * 
     * @param pos position of piece to check
     * @returns whether piece is immobile
     */
    private isImmobile(pos: LatticeCoords): boolean {
        const oppLastMove = this.movedLastTurn[invertColor(this.currTurnColor)];
        return oppLastMove !== null && HiveGame.eqPos(oppLastMove, pos);
    }

    /**
     * Check whether given piece may be placed at all (irrespective of where).
     * 
     * @param piece piece to check the legality of placing
     * @param colorOverride overrides current color to move (used for premoves)
     * @returns whether given piece may legally be placed this turn
     */
    private pieceMayBePlaced(piece: Piece, colorOverride?: PieceColor): SuccessOr<CanPlaceErrorMsg> {
        const colorToMove = colorOverride || this.currTurnColor;

        // immediate rejections
        if (this.gameStatus !== "Ongoing") return "ErrGameOver";
        if (colorToMove !== piece.color) return "ErrOutOfTurn";

        // reject if out of pieces
        if (this.playerInventories[piece.color][piece.type] <= 0) return "ErrOutOfPieces";

        // reject if 4th placement is anything but queen (if unplayed)
        const mustBeQueen = this.placementCount[piece.color] === 3
            && this.playerInventories[piece.color].QueenBee === 1
            && piece.type !== "QueenBee";
        if (mustBeQueen) return "ErrMustBeQueen";

        // reject queen on 1st placement (if this optional rule is enabled)
        const cannotBeQueen = this.placementCount[piece.color] === 0
            && piece.type === "QueenBee"
            && this.noFirstQueen;
        if (cannotBeQueen) return "ErrCannotBeQueen";

        return "Success";
    }

    /**
     * Get all possible placement locations for given piece, or error if placing given piece this
     * turn is illegal.
     * 
     * @param piece piece to find valid placement locations for
     * @param colorOverride overrides current color to move (used for premoves)
     * @returns discriminated union containing either valid placement locations or error details
     */
    private getPlacements(piece: Piece, colorOverride?: PieceColor): GetPlacementResult {
        // check that placement is legal
        const mayBePlaced = this.pieceMayBePlaced(piece, colorOverride);
        if (mayBePlaced !== "Success") return {
            message: mayBePlaced,
            status: "Error",
            turnType: "Placement"
        };

        // get valid placement spots
        let options: MoveOptions;
        if (this.turnCount === 0) options = { "0,0": "Normal" };
        else if (this.turnCount === 1) options = Object.fromEntries(this.adjCoords([0, 0])
            .map(pos => [pos.join(","), "Normal"]));
        else options = Object.fromEntries(Object.values(this.getAllPosOf(piece.color))
            .flat()
            .flatMap(pos => this.adjCoords(pos))
            .filter(pos => !this.getPieceAt(pos)
                && this.adjPieces(pos).every(p => p.color === piece.color))
            .map(pos => [pos.join(","), "Normal"]));

        return Object.keys(options).length
            ? { options, piece, status: "Success", turnType: "Placement" }
            : {
                message: "ErrNoValidPlacementTargets",
                status: "Error",
                turnType: "Placement"
            };
    }

    /**
     * Check whether placement of given piece at given position is legal.
     * 
     * @param piece piece to place
     * @param destination position at which to place
     * @returns success, or error message indicating reason for illegality
     */
    private checkPlacement(piece: Piece, destination: LatticeCoords): SuccessOr<PlacementErrorMsg> {
        // check that piece may be placed at all
        const mayBePlaced = this.pieceMayBePlaced(piece);
        if (mayBePlaced !== "Success") return mayBePlaced;

        // always accept first placement if not out-of-turn
        if (this.turnCount === 0) return "Success";

        // immediate rejections
        if (this.getPieceAt(destination)) return "ErrDestinationOccupied";
        if (this.adjPieceCoords(destination).length === 0) return "ErrOneHiveRule";

        // reject if touching opposing color (after second placement)
        const illegalNeighbour = this.placementCount[piece.color] > 0
            && this.adjPieces(destination).some(p => p.color !== piece.color);
        if (illegalNeighbour) return "ErrTouchesOppColor";

        return "Success";
    }

    /**
     * Attempt to place given piece at given location.
     * 
     * @param piece piece to place
     * @param destination position at which to place
     * @returns discriminated union indicating success or failure with details in each case
     */
    private placePiece(piece: Piece, destination: LatticeCoords): PlacementResult {
        const err: Pick<PlacementError, "status" | "turnType"> = {
            status: "Error",
            turnType: "Placement"
        };

        // report any placement errors
        const message = this.checkPlacement(piece, destination);
        if (message !== "Success") return { ...err, message };

        // spawn piece
        this.setPos(destination, piece);
        piece.height = 1;
        piece.covering = undefined;

        // advance turn
        this.placementCount[piece.color]++;
        this.playerInventories[piece.color][piece.type] -= 1;
        this.advanceTurn();

        return { destination, piece, status: "Success", turnType: "Placement" };
    }

    /**
     * Get positions of adjacent pillbugs that are capable of being mounted by given piece.
     * 
     * @param piece piece which is to be moved by pillbug
     * @param fromPos initial position of piece, adjacent to which we seek pillbugs
     * @param colorToMove current color to move
     * @returns discriminated union containing either valid pillbug positions or error details
     */
    private findPillbugs(piece: Piece, fromPos: LatticeCoords, colorToMove: PieceColor): GetPillbugResult {
        const err: Pick<GetPillbugError, "status"> = { status: "Error" };

        // find adjacent pillbugs / mosquitoes (which are touching pillbugs) of current colour
        const pillbugPositions = this.adjPieceCoords(fromPos).filter(adjPos => {
            const adjPiece = this.getPieceAt(adjPos);
            if (adjPiece?.color !== colorToMove) return false;

            return adjPiece.type === "Pillbug"
                || adjPiece.type === "Mosquito"
                && this.adjPieces(adjPos).some(p => p.type === "Pillbug");
        });
        if (!pillbugPositions.length) return { ...err, message: "ErrNoPillbugTouching" };

        // disregard immobile pillbugs (which moved last turn)
        const mobilePillbugs = pillbugPositions.filter(pos => !this.isImmobile(pos));
        if (!mobilePillbugs.length) return { ...err, message: "ErrPillbugMovedLastTurn" };

        // may not affect stacked pieces
        if (piece.covering) return { ...err, message: "ErrPillbugCannotTargetStack" };

        // freedom-to-move rule must not block piece from mounting pillbug
        const mountable = (pillbugPos: LatticeCoords) =>
            this.adjMounts(fromPos as LatticeCoords, fromPos, false)
                .some(p => HiveGame.eqPos(p, pillbugPos));
        const options = pillbugPositions.filter(mountable);
        if (!options.length) return { ...err, message: "ErrGateBlocksPillbugMount" };

        return { options, piece, status: "Success" };
    }

    /**
     * Check that moving given piece from given (old) location obeys the one-hive rule.
     * 
     * @param piece piece to move
     * @param fromPos location of piece prior to move
     * @returns whether moving given piece keeps hive connected
     */
    private checkOneHive(piece: Piece, fromPos: LatticeCoords): boolean {
        // accept if piece is stacked
        if (piece.covering) return true;

        if (!this.isCutVertex) {
            // shortcut to accept if all adjacent pieces already mutually connect
            let lastSeenSpace = true;
            let groupsSeen = 0;
            const adjacent: LatticeCoords[] = this.adjCoords(fromPos);
            adjacent.forEach(pos => {
                if (this.getPieceAt(pos)) {
                    if (lastSeenSpace) groupsSeen++;
                    lastSeenSpace = false;
                } else lastSeenSpace = true;
            });
            if (!lastSeenSpace && this.getPieceAt(adjacent[0])) groupsSeen--; // if we began in connected group
            if (groupsSeen === 1) return true;

            // otherwise recompute all cut vertices
            this.isCutVertex = HiveGame.graphUtils.getCutVertices(fromPos, pos => this.adjPieceCoords(pos));
        }
        return !this.isCutVertex(fromPos);
    }

    /**
     * Check that given piece may legally move from given (old) location. Also update given piece to include any
     * information about its height and pieces below it, as this is needed for movement.
     * 
     * @param piece piece to move
     * @param fromPos location of piece prior to move
     * @param colorOverride overrides current color to move (used for premoves)
     * @returns success, or error message indicating reason for illegality
     */
    private pieceMayMove(piece: Piece, fromPos?: LatticeCoords, colorOverride?: PieceColor): SuccessPillbugOr<CanMoveErrorMsg> {
        const colorToMove = colorOverride || this.currTurnColor;

        // basic rejections
        if (this.gameStatus !== "Ongoing") return "ErrGameOver";
        if (this.playerInventories[colorToMove].QueenBee === 1) return "ErrQueenUnplayed";

        // get position of piece & check that piece is actually there
        fromPos = fromPos || this.getPosOf(piece);
        if (!fromPos) return "ErrInvalidMovingPiece";
        const pieceAtFromPos = this.getPieceAt(fromPos);
        if (!pieceAtFromPos) return "ErrInvalidMovingPiece";
        if (!HiveGame.eqPiece(piece, pieceAtFromPos)) return "ErrCovered";

        // populate piece with covering info
        piece.covering = pieceAtFromPos.covering;
        piece.height = pieceAtFromPos.height;

        // externalized checks
        if (this.isImmobile(fromPos)) return "ErrPieceMovedLastTurn";
        if (!this.checkOneHive(piece, fromPos)) return "ErrOneHiveRule";
        if (colorToMove !== piece.color) {
            // to move piece of opponent color, there must be valid pillbugs adjacent
            const adjPillbugs = this.findPillbugs(piece, fromPos, colorToMove);
            return adjPillbugs.status === "Success" ? "PillbugOnly" : adjPillbugs.message;
        }

        return "Success";
    }

    /**
     * Generate all legal moves for given piece starting at given location, ignoring moves which make use
     * of the pillbug special ability. The lazy/online generator approach is to speed up checking legality
     * of a move, where we can stop generating early upon finding the move of interest.
     * 
     * @param piece piece to move
     * @param fromPos location of piece prior to move
     * @param mosqOverride if given piece is a mosquito, treat it as this type instead
     * @yields legal moves
     * @returns function mapping each destination to array of intermediate positions (encoding paths taken)
     */
    private *genStandardMoves(piece: Piece, fromPos?: LatticeCoords, mosqOverride?: PieceType): MoveGen {
        fromPos = fromPos || this.getPosOf(piece);
        if (!fromPos) return () => [];

        // construct appropriate move generator for each piece type
        let generator: MoveGen;
        const type = piece.type === "Mosquito" && mosqOverride ? mosqOverride : piece.type;

        if (type === "Mosquito") {
            generator = piece.covering
                // move like beetle while on hive
                ? this.genStandardMoves(piece, fromPos, "Beetle")

                // else merge adjacent non-mosquitoes' moves
                : GraphUtils.mergeGenerators(
                    ...this.adjPieces(fromPos)
                        .filter(p => p.type !== "Mosquito")
                        .map(p => this.genStandardMoves(piece, fromPos, p.type))
                );
        }

        else if (type === "Grasshopper") {
            // merge straight-line moves in each of 3 directions
            generator = GraphUtils.mergeGenerators(
                ...[0, 1, 2].map(i =>
                    HiveGame.graphUtils.genShortestPaths(
                        fromPos as LatticeCoords,
                        (pos) => {
                            if (!this.getPieceAt(pos)) return [];
                            const adj = this.adjCoords(pos);
                            return [adj[i], adj[(i + 3) % 6]];
                        },
                        undefined,
                        (pos, distance) => distance > 1 && !this.getPieceAt(pos)
                    ))
            );
        }

        else if (type === "Ladybug") {
            // walk 3 steps on hive, forcefully dismounting on last step
            generator = HiveGame.graphUtils.genLengthNPaths(
                fromPos,
                (pos, distance) => this.adjMounts(pos, fromPos, distance === 2),
                3
            );
        }

        else {
            // all other movement can be calculated in single call to genShortestPaths()
            let maxDist: number | undefined;
            let isEndpoint: Filter<LatticeCoords> | undefined;
            let adjFunc: BFSAdj<LatticeCoords> = pos => this.adjSlideSpaces(pos, fromPos);

            if (type === "QueenBee" || type === "Pillbug") {
                maxDist = 1;
            } else if (type === "Spider") {
                isEndpoint = (_p, distance) => distance === 3;
                maxDist = 3;
            } else if (type === "Beetle") {
                adjFunc = (pos) => this.adjMounts(pos, fromPos)
                    .concat(piece.covering ? [] : this.adjSlideSpaces(pos, fromPos));
                maxDist = 1;
            }

            generator = HiveGame.graphUtils.genShortestPaths(fromPos, adjFunc, maxDist, isEndpoint);
        }

        // yield moves & return path information
        let next: IteratorResult<LatticeCoords, PathMap<LatticeCoords>>;
        next = generator.next();
        while (!next.done) {
            yield next.value;
            next = generator.next();
        }
        return next.value;
    }

    /**
     * Generate all legal moves of given piece which start at given (old) location and which make use of the
     * special ability of a neighbouring pillbug (or mosquito touching pillbug). The lazy/online generator
     * approach is for syntactic consistency with the regular legal move generation.
     * 
     * @see genStandardMoves
     * @param piece piece to move
     * @param fromPos location of piece prior to move
     * @param colorOverride overrides current color to move (used for premoves)
     * @yields legal moves that use pillbug ability
     * @returns function mapping each destination to array of intermediate positions (encoding paths taken)
     */
    private *genPillbugMoves(piece: Piece, fromPos?: LatticeCoords, colorOverride?: PieceColor): MoveGen {
        const colorToMove = colorOverride || this.currTurnColor;
        fromPos = fromPos || this.getPosOf(piece);
        if (!fromPos) return () => [];

        const adjPillbugs = this.findPillbugs(piece, fromPos, colorToMove);
        if (adjPillbugs.status !== "Success") return () => [];

        // yield dismount points from all mountable pillbugs & return path map
        const { options } = adjPillbugs;
        const destinations: LatticeCoords[][] = options.map(pillbugPos =>
            this.adjMounts(pillbugPos, fromPos, true));

        yield* destinations.flat();
        return (vertex: LatticeCoords) => {
            const index = destinations.findIndex(list => list.some(pos => HiveGame.eqPos(pos, vertex)));
            if (index < 0) return [];
            return [options[index], fromPos as LatticeCoords];
        };
    }

    /**
     * Get all possible destinations to which given piece can legally move, normally or (potentially) using
     * pillbug special ability. Returns valid moves in a map from position to move type ("Normal" / "Pillbug"),
     * encoding positions in comma-delimited strings.
     * 
     * @param piece piece which is to move
     * @param colorOverride overrides current color to move (used for premoves)
     * @returns discriminated union containing either valid movement destinations or details of error
     */
    private getMovements(piece: Piece, colorOverride?: PieceColor): GetMovementResult {
        // check that piece can move at all
        const mayMove = this.pieceMayMove(piece, undefined, colorOverride);
        if (mayMove !== "Success" && mayMove !== "PillbugOnly") return {
            message: mayMove,
            status: "Error",
            turnType: "Movement"
        };

        // collect all legal moves (de-duplicating & prefering normal moves to pillbug ones)
        const pathMaps: PathMap<LatticeCoords>[] = [];
        const options: MoveOptions = {};
        const collectMoves = (movementType: MovementType) => {
            const generator = movementType === "Pillbug"
                ? this.genPillbugMoves(piece, undefined, colorOverride)
                : this.genStandardMoves(piece);
            let next = generator.next();
            while (!next.done) {
                const posStr = next.value.join(",");
                if (!options[posStr]) options[posStr] = movementType;
                next = generator.next();
            }
            pathMaps.push(next.value);
        };

        if (mayMove !== "PillbugOnly") collectMoves("Normal");
        collectMoves("Pillbug");

        // throw error if no legal moves are found
        return Object.keys(options).length
            ? {
                options,
                pathMap: GraphUtils.mergePaths(...pathMaps),
                piece,
                status: "Success",
                turnType: "Movement"
            } : {
                message: "ErrNoValidMoveDestinations",
                status: "Error",
                turnType: "Movement"
            };
    }

    /**
     * Check that moving given piece from given location to given location is legal.
     * 
     * @param piece piece to move
     * @param fromPos location of piece prior to move
     * @param toPos location of piece after move
     * @returns success, or error message indicating reason for illegality
     */
    private checkMovement(piece: Piece, fromPos: LatticeCoords, toPos: LatticeCoords): SuccessPillbugOr<MovementErrorMsg> {
        // check that piece can move at all
        const mayMove = this.pieceMayMove(piece, fromPos);
        if (mayMove !== "Success" && mayMove !== "PillbugOnly") return mayMove;

        // check that destination is valid
        if (HiveGame.eqPos(fromPos, toPos)) return "ErrAlreadyThere";
        if (this.adjPieceCoords(toPos, piece.covering ? undefined : fromPos).length === 0) return "ErrOneHiveRule";
        if (this.getPieceAt(toPos) && piece.type !== "Beetle" && piece.type !== "Mosquito") return "ErrDestinationOccupied";

        // check piece-specific movement rules
        const obeysMovementRules = (allMoves: boolean) => {
            let gen = this.genPillbugMoves(piece, fromPos);
            if (allMoves) gen = GraphUtils.mergeGenerators(gen, this.genStandardMoves(piece, fromPos));
            for (const dest of gen) {
                if (HiveGame.eqPos(dest, toPos)) return true;
            }
            return false;
        };

        if (mayMove === "PillbugOnly" && !obeysMovementRules(false)) return "ErrInvalidPillbugAbilityMovement";
        if (!obeysMovementRules(true)) return `ErrViolates${piece.type}Movement`;

        return mayMove;
    }

    /**
     * Attempt to move given piece to given destination.
     * 
     * @param piece piece to move
     * @param destination destination to which to move piece
     * @returns discriminated union indicating success or failure with details in each case
     */
    private movePiece(piece: Piece, destination: LatticeCoords): MovementResult {
        const err: Pick<MovementError, "status" | "turnType"> = {
            status: "Error",
            turnType: "Movement"
        };

        // report any movement errors
        const fromPos = this.getPosOf(piece);
        if (!fromPos) return { ...err, message: "ErrInvalidMovingPiece" };
        const message = this.checkMovement(piece, fromPos, destination);
        if (message !== "Success" && message !== "PillbugOnly") return { ...err, message };

        // update covering info
        this.setPos(fromPos, piece.covering);
        piece.covering = this.getPieceAt(destination);
        piece.height = 1 + (piece.covering?.height || 0);

        // move piece & advance turn
        this.setPos(destination, piece);
        this.advanceTurn(destination);

        return { destination, origin: fromPos, piece, status: "Success", turnType: "Movement" };
    }

    /**
     * Pass current turn without action. This is only a valid action when no legal moves remain
     * (see https://boardgamegeek.com/wiki/page/Hive_FAQ#toc7).
     * 
     * @returns discriminated union indicating pass action with details of success or failure
     */
    private passTurn(): PassResult {
        const err: Pick<PassError, "status" | "message" | "turnType"> = {
            message: "ErrValidMovesRemain",
            status: "Error",
            turnType: "Pass"
        };

        // check for any legal moves using placement
        for (const [type, num] of Object.entries(this.playerInventories[this.currTurnColor])) {
            if (!num) continue;
            const piece: Piece = { color: this.currTurnColor, type: type as PieceType };

            // TODO there are similarities between this and the analogous part below:
            const outcome = this.getPlacements(piece);
            if (outcome.status !== "Error") {
                const option = HiveGame.entriesOfPosRecord(outcome.options)[0][0];
                const destination = this.absToRel(option);
                if (destination) return { ...err, exampleMove: { destination, piece } };
            }
        }

        // check for legal moves that use movement
        const allPiecePositions = Object.values(this.pieceToPos[this.currTurnColor])
            .concat(Object.values(this.pieceToPos[invertColor(this.currTurnColor)]));
        // first check pieces of current color, since these are more likely to have moves
        for (const positions of allPiecePositions) {
            for (const pos of positions) {
                const piece = this.getPieceAt(pos);
                if (!piece) break;

                const outcome = this.getMovements(piece);
                if (outcome.status !== "Error") {
                    const option = HiveGame.entriesOfPosRecord(outcome.options)[0][0];
                    const destination = this.absToRel(option);
                    if (destination) return { ...err, exampleMove: { destination, piece } };
                }
            }
        }

        this.advanceTurn();
        return { status: "Success", turnType: "Pass" };
    }
}