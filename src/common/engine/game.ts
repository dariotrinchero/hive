import { fullInventory, invertColor } from "@/common/engine/piece";
import GraphUtils from "@/common/engine/graph";
import HexGrid from "@/common/engine/hexGrid";

import type {
    CanMoveErrorMsg,
    CanPlaceErrorMsg,
    CommonErrorMsg,
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
} from "@/types/common/engine/outcomes";
import type { ExpansionPieceType, Piece, PieceColor, PieceCount, PieceType } from "@/types/common/engine/piece";
import type { GameState } from "@/types/common/socket";
import type {
    GameStatus,
    LastMoveDestination,
    MoveGen,
    OkOr,
    OkPillbugOr,
    OptionalGameRules,
    PlacementCount,
    PlayerInventories
} from "@/types/common/engine/game";
import type { BFSAdj, Filter, IsCutVertex, PathMap } from "@/types/common/engine/graph";
import type { LatticeCoords } from "@/types/common/engine/hexGrid";

/**
 * Complete implementation of the rules of Hive (documented in included links) with public API
 * functions to get available moves or make moves. Each such API function returns a rich result
 * type with details of the enacted move or potential errors.
 * 
 * @see {@link https://www.ultraboardgames.com/hive/game-rules.php}
 * @see {@link https://www.ultraboardgames.com/hive/additional-hive-pieces.php}
 * @see {@link https://boardgamegeek.com/wiki/page/Hive_FAQ}
 */
export default class HiveGame extends HexGrid {
    // graph algorithms
    private static readonly graphUtils = new GraphUtils<LatticeCoords>(pos => pos.join(","));
    private isCutVertex?: IsCutVertex<LatticeCoords>;

    // optional game rules
    private rules: OptionalGameRules;

    // game state
    private turnCount: number;
    private currTurnColor: PieceColor;
    private movedLastTurn: LastMoveDestination;

    // inferrable from state
    private placementCount: PlacementCount;
    private playerInventories: PlayerInventories;
    private gameStatus: GameStatus;

    public constructor(colorToStart?: PieceColor, rules?: OptionalGameRules) {
        super();

        // set local properties
        const init: GameState = HiveGame.initialState(colorToStart);
        this.currTurnColor = init.currTurnColor;
        this.movedLastTurn = init.movedLastTurn;
        this.turnCount = init.turnCount;
        this.posToPiece = init.posToPiece;
        this.placementCount = { Black: 0, White: 0 };
        this.gameStatus = "Ongoing";

        // set optional rules
        this.rules = rules || {
            expansions: {
                Ladybug: true,
                Mosquito: true,
                Pillbug: true
            },
            noFirstQueen: false
        };

        // exclude unused expansion pieces from inventory
        const inventory: PieceCount = Object.fromEntries(
            Object.entries(fullInventory).filter(entry => {
                if (!(entry[0] in this.rules.expansions)) return true;
                const expansion = entry[0] as ExpansionPieceType;
                return this.rules.expansions[expansion];
            })
        ) as PieceCount;
        this.playerInventories = {
            Black: { ...inventory },
            White: { ...inventory }
        };
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
     * Obtain game instance from given game state, with given optional rules
     * 
     * @param state desired game state
     * @param rules optional rules to set for returned instance
     * @returns instance of HiveGame with given state & rules
     */
    public static fromState(state: GameState, rules?: OptionalGameRules): HiveGame {
        const game = new HiveGame(undefined, rules);
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

    public getRules(): OptionalGameRules {
        return this.rules;
    }

    public getInventory(): PlayerInventories {
        return this.playerInventories;
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
            message: "InvalidDestination",
            status: "Err",
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
        if (query.turnType === "Movement") return this.getMovements(query.piece, query.currCol);
        return this.getPlacements(query.piece, query.currCol);
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
     * Check whether given piece may be involved in any move (ie. movement or placement) at all.
     * 
     * @param piece piece to check the legality of using in a turn
     * @returns whether given piece may be moved or placed this turn
     */
    private pieceMayMove(piece: Piece): OkOr<CommonErrorMsg> {
        if (this.gameStatus !== "Ongoing") return "GameOver";

        // reject if piece is from omitted expansion
        if (piece.type in this.rules.expansions) {
            const expansion = piece.type as keyof OptionalGameRules["expansions"];
            if (!this.rules.expansions[expansion]) return `${expansion}Omitted`;
        }
        return "Ok";
    }

    /**
     * Check whether given piece may be placed at all (irrespective of where).
     * 
     * @param piece piece to check the legality of placing
     * @param currCol overrides current color to move (used for premoves)
     * @returns whether given piece may legally be placed this turn
     */
    private pieceMayBePlaced(piece: Piece, currCol?: PieceColor): OkOr<CanPlaceErrorMsg> {
        const colorToMove = currCol || this.currTurnColor;

        // basic rejections
        const mayMove = this.pieceMayMove(piece);
        if (mayMove !== "Ok") return mayMove;
        if (colorToMove !== piece.color) return "OutOfTurn";

        // reject if out of pieces
        if (!this.playerInventories[piece.color][piece.type]) return "OutOfPieces";

        // reject if 4th placement is anything but queen (if unplayed)
        const mustBeQueen = this.placementCount[piece.color] === 3
            && this.playerInventories[piece.color].QueenBee === 1
            && piece.type !== "QueenBee";
        if (mustBeQueen) return "MustBeQueen";

        // reject queen on 1st placement (if this optional rule is enabled)
        const cannotBeQueen = this.placementCount[piece.color] === 0
            && piece.type === "QueenBee"
            && this.rules.noFirstQueen;
        if (cannotBeQueen) return "CannotBeQueen";

        return "Ok";
    }

    /**
     * Get all possible placement locations for given piece, or error if placing given piece this
     * turn is illegal.
     * 
     * @param piece piece to find valid placement locations for
     * @param currCol overrides current color to move (used for premoves)
     * @returns discriminated union containing either valid placement locations or error details
     */
    private getPlacements(piece: Piece, currCol?: PieceColor): GetPlacementResult {
        // check that placement is legal
        const mayBePlaced = this.pieceMayBePlaced(piece, currCol);
        if (mayBePlaced !== "Ok") return {
            message: mayBePlaced,
            status: "Err",
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
            ? { options, piece, status: "Ok", turnType: "Placement" }
            : {
                message: "NoPlacementTargets",
                status: "Err",
                turnType: "Placement"
            };
    }

    /**
     * Check whether placement of given piece at given position is legal.
     * 
     * @param piece piece to place
     * @param destination position at which to place
     * @returns "Ok" or error message indicating reason for illegality
     */
    private checkPlacement(piece: Piece, destination: LatticeCoords): OkOr<PlacementErrorMsg> {
        // check that piece may be placed at all
        const mayBePlaced = this.pieceMayBePlaced(piece);
        if (mayBePlaced !== "Ok") return mayBePlaced;

        // always accept first placement if not out-of-turn
        if (this.turnCount === 0) return "Ok";

        // immediate rejections
        if (this.getPieceAt(destination)) return "DestinationOccupied";
        if (this.adjPieceCoords(destination).length === 0) return "OneHiveRule";

        // reject if touching opposing color (after second placement)
        const illegalNeighbour = this.placementCount[piece.color] > 0
            && this.adjPieces(destination).some(p => p.color !== piece.color);
        if (illegalNeighbour) return "TouchesOppColor";

        return "Ok";
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
            status: "Err",
            turnType: "Placement"
        };

        // report any placement errors
        const message = this.checkPlacement(piece, destination);
        if (message !== "Ok") return { ...err, message };

        // spawn piece
        this.setPos(destination, piece);
        piece.height = 1;
        piece.covering = undefined;

        // advance turn
        this.placementCount[piece.color]++;
        this.playerInventories[piece.color][piece.type] -= 1;
        this.advanceTurn();

        return { destination, piece, status: "Ok", turnType: "Placement" };
    }

    /**
     * Get positions of adjacent pillbugs that are capable of being mounted by given piece.
     * 
     * @param piece piece which is to be moved by pillbug
     * @param from initial position of piece, adjacent to which we seek pillbugs
     * @param currCol current color to move
     * @returns discriminated union containing either valid pillbug positions or error details
     */
    private findPillbugs(piece: Piece, from: LatticeCoords, currCol: PieceColor): GetPillbugResult {
        const err: Pick<GetPillbugError, "status"> = { status: "Err" };

        // find adjacent pillbugs / mosquitoes (which are touching pillbugs) of current colour
        const pillbugPositions = this.adjPieceCoords(from).filter(adjPos => {
            const adjPiece = this.getPieceAt(adjPos);
            if (adjPiece?.color !== currCol) return false;

            return adjPiece.type === "Pillbug"
                || adjPiece.type === "Mosquito"
                && this.adjPieces(adjPos).some(p => p.type === "Pillbug");
        });
        if (!pillbugPositions.length) return { ...err, message: "NoPillbugTouching" };

        // disregard immobile pillbugs (which moved last turn)
        const mobilePillbugs = pillbugPositions.filter(pos => !this.isImmobile(pos));
        if (!mobilePillbugs.length) return { ...err, message: "PillbugJustMoved" };

        // may not affect stacked pieces
        if (piece.covering) return { ...err, message: "PillbugCannotTargetStack" };

        // freedom-to-move rule must not block piece from mounting pillbug
        const mountable = (pillbugPos: LatticeCoords) =>
            this.adjMounts(from as LatticeCoords, from, false)
                .some(p => HiveGame.eqPos(p, pillbugPos));
        const options = pillbugPositions.filter(mountable);
        if (!options.length) return { ...err, message: "GateBlocksPillbugMount" };

        return { options, piece, status: "Ok" };
    }

    /**
     * Check that moving given piece from given (old) location obeys the one-hive rule.
     * 
     * @param piece piece to move
     * @param from location of piece prior to move
     * @returns whether moving given piece keeps hive connected
     */
    private checkOneHive(piece: Piece, from: LatticeCoords): boolean {
        // accept if piece is stacked
        if (piece.covering) return true;

        if (!this.isCutVertex) {
            // shortcut to accept if all adjacent pieces already mutually connect
            let lastSeenSpace = true;
            let groupsSeen = 0;
            const adjacent: LatticeCoords[] = this.adjCoords(from);
            adjacent.forEach(pos => {
                if (this.getPieceAt(pos)) {
                    if (lastSeenSpace) groupsSeen++;
                    lastSeenSpace = false;
                } else lastSeenSpace = true;
            });
            if (!lastSeenSpace && this.getPieceAt(adjacent[0])) groupsSeen--; // if we began in connected group
            if (groupsSeen === 1) return true;

            // otherwise recompute all cut vertices
            this.isCutVertex = HiveGame.graphUtils.getCutVertices(from, pos => this.adjPieceCoords(pos));
        }
        return !this.isCutVertex(from);
    }

    /**
     * Check that given piece may legally move from given (old) location. Also update given piece to include any
     * information about its height and pieces below it, as this is needed for movement.
     * 
     * @param piece piece to move
     * @param from location of piece prior to move
     * @param currCol overrides current color to move (used for premoves)
     * @returns "Ok", "PillbugOnly", or error message indicating reason for illegality
     */
    private pieceMayBeMoved(piece: Piece, from?: LatticeCoords, currCol?: PieceColor): OkPillbugOr<CanMoveErrorMsg> {
        const colorToMove = currCol || this.currTurnColor;

        // basic rejections
        const mayMove = this.pieceMayMove(piece);
        if (mayMove !== "Ok") return mayMove;
        if (this.playerInventories[colorToMove].QueenBee === 1) return "QueenUnplayed";

        // get position of piece & check that piece is actually there
        from = from || this.getPosOf(piece);
        if (!from) return "InvalidMovingPiece";
        const pieceAtFromPos = this.getPieceAt(from);
        if (!pieceAtFromPos) return "InvalidMovingPiece";
        if (!HiveGame.eqPiece(piece, pieceAtFromPos)) return "Covered";

        // populate piece with covering info
        piece.covering = pieceAtFromPos.covering;
        piece.height = pieceAtFromPos.height;

        // externalized checks
        if (this.isImmobile(from)) return "PieceJustMoved";
        if (!this.checkOneHive(piece, from)) return "OneHiveRule";
        if (colorToMove !== piece.color) {
            // to move piece of opponent color, there must be valid pillbugs adjacent
            const adjPillbugs = this.findPillbugs(piece, from, colorToMove);
            return adjPillbugs.status === "Ok" ? "PillbugOnly" : adjPillbugs.message;
        }

        return "Ok";
    }

    /**
     * Generate all legal moves for given piece starting at given location, ignoring moves which make use
     * of the pillbug special ability. The lazy/online generator approach is to speed up checking legality
     * of a move, where we can stop generating early upon finding the move of interest.
     * 
     * @param piece piece to move
     * @param from location of piece prior to move
     * @param mosqOverride if given piece is a mosquito, treat it as this type instead
     * @yields legal moves
     * @returns function mapping each destination to array of intermediate positions (encoding paths taken)
     */
    private *genStandardMoves(piece: Piece, from?: LatticeCoords, mosqOverride?: PieceType): MoveGen {
        from = from || this.getPosOf(piece);
        if (!from) return () => [];

        // construct appropriate move generator for each piece type
        let generator: MoveGen;
        const type = piece.type === "Mosquito" && mosqOverride ? mosqOverride : piece.type;

        if (type === "Mosquito") {
            generator = piece.covering
                // move like beetle while on hive
                ? this.genStandardMoves(piece, from, "Beetle")

                // else merge adjacent non-mosquitoes' moves
                : GraphUtils.mergeGenerators(
                    ...this.adjPieces(from)
                        .filter(p => p.type !== "Mosquito")
                        .map(p => this.genStandardMoves(piece, from, p.type))
                );
        }

        else if (type === "Grasshopper") {
            // merge straight-line moves in each of 3 directions
            generator = GraphUtils.mergeGenerators(
                ...[0, 1, 2].map(i =>
                    HiveGame.graphUtils.genShortestPaths(
                        from as LatticeCoords,
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
                from,
                (pos, distance) => this.adjMounts(pos, from, distance === 2),
                3
            );
        }

        else {
            // all other movement can be calculated in single call to genShortestPaths()
            let maxDist: number | undefined;
            let isEndpoint: Filter<LatticeCoords> | undefined;
            let adjFunc: BFSAdj<LatticeCoords> = pos => this.adjSlideSpaces(pos, from);

            if (type === "QueenBee" || type === "Pillbug") {
                maxDist = 1;
            } else if (type === "Spider") {
                isEndpoint = (_p, distance) => distance === 3;
                maxDist = 3;
            } else if (type === "Beetle") {
                adjFunc = (pos) => this.adjMounts(pos, from)
                    .concat(piece.covering ? [] : this.adjSlideSpaces(pos, from));
                maxDist = 1;
            }

            generator = HiveGame.graphUtils.genShortestPaths(from, adjFunc, maxDist, isEndpoint);
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
     * @param from location of piece prior to move
     * @param currCol overrides current color to move (used for premoves)
     * @yields legal moves that use pillbug ability
     * @returns function mapping each destination to array of intermediate positions (encoding paths taken)
     */
    private *genPillbugMoves(piece: Piece, from?: LatticeCoords, currCol?: PieceColor): MoveGen {
        const colorToMove = currCol || this.currTurnColor;
        from = from || this.getPosOf(piece);
        if (!from) return () => [];

        const adjPillbugs = this.findPillbugs(piece, from, colorToMove);
        if (adjPillbugs.status !== "Ok") return () => [];

        // yield dismount points from all mountable pillbugs & return path map
        const { options } = adjPillbugs;
        const destinations: LatticeCoords[][] = options.map(pillbugPos =>
            this.adjMounts(pillbugPos, from, true));

        yield* destinations.flat();
        return (vertex: LatticeCoords) => {
            const index = destinations.findIndex(list => list.some(pos => HiveGame.eqPos(pos, vertex)));
            if (index < 0) return [];
            return [options[index], from as LatticeCoords];
        };
    }

    /**
     * Get all possible destinations to which given piece can legally move, normally or (potentially) using
     * pillbug special ability. Returns valid moves in a map from position to move type ("Normal" / "Pillbug"),
     * encoding positions in comma-delimited strings.
     * 
     * @param piece piece which is to move
     * @param currCol overrides current color to move (used for premoves)
     * @returns discriminated union containing either valid movement destinations or details of error
     */
    private getMovements(piece: Piece, currCol?: PieceColor): GetMovementResult {
        // check that piece can move at all
        const mayMove = this.pieceMayBeMoved(piece, undefined, currCol);
        if (mayMove !== "Ok" && mayMove !== "PillbugOnly") return {
            message: mayMove,
            status: "Err",
            turnType: "Movement"
        };

        // collect all legal moves (de-duplicating & prefering normal moves to pillbug ones)
        const pathMaps: PathMap<LatticeCoords>[] = [];
        const options: MoveOptions = {};
        const collectMoves = (movementType: MovementType) => {
            const generator = movementType === "Pillbug"
                ? this.genPillbugMoves(piece, undefined, currCol)
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
                status: "Ok",
                turnType: "Movement"
            } : {
                message: "NoMoveDestinations",
                status: "Err",
                turnType: "Movement"
            };
    }

    /**
     * Check that moving given piece from given location to given location is legal.
     * 
     * @param piece piece to move
     * @param from location of piece prior to move
     * @param to location of piece after move
     * @returns "Ok", "PillbugOnly", or error message indicating reason for illegality
     */
    private checkMovement(piece: Piece, from: LatticeCoords, to: LatticeCoords): OkPillbugOr<MovementErrorMsg> {
        // check that piece can move at all
        const mayMove = this.pieceMayBeMoved(piece, from);
        if (mayMove !== "Ok" && mayMove !== "PillbugOnly") return mayMove;

        // check that destination is valid
        if (HiveGame.eqPos(from, to)) return "AlreadyThere";
        if (this.adjPieceCoords(to, piece.covering ? undefined : from).length === 0) return "OneHiveRule";
        if (this.getPieceAt(to) && piece.type !== "Beetle" && piece.type !== "Mosquito") return "DestinationOccupied";

        // check piece-specific movement rules
        const obeysMovementRules = (allMoves: boolean) => {
            let gen = this.genPillbugMoves(piece, from);
            if (allMoves) gen = GraphUtils.mergeGenerators(gen, this.genStandardMoves(piece, from));
            for (const dest of gen) {
                if (HiveGame.eqPos(dest, to)) return true;
            }
            return false;
        };

        if (mayMove === "PillbugOnly" && !obeysMovementRules(false)) return "InvalidPillbugAbilityMovement";
        if (!obeysMovementRules(true)) return `Invalid${piece.type}Movement`;

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
            status: "Err",
            turnType: "Movement"
        };

        // report any movement errors
        const from = this.getPosOf(piece);
        if (!from) return { ...err, message: "InvalidMovingPiece" };
        const message = this.checkMovement(piece, from, destination);
        if (message !== "Ok" && message !== "PillbugOnly") return { ...err, message };

        // update covering info
        this.setPos(from, piece.covering);
        piece.covering = this.getPieceAt(destination);
        piece.height = 1 + (piece.covering?.height || 0);

        // move piece & advance turn
        this.setPos(destination, piece);
        this.advanceTurn(destination);

        return { destination, origin: from, piece, status: "Ok", turnType: "Movement" };
    }

    /**
     * Pass current turn without action. This is only a valid action when no legal moves remain
     * (see https://boardgamegeek.com/wiki/page/Hive_FAQ#toc7).
     * 
     * @returns discriminated union indicating pass action with details of success or failure
     */
    private passTurn(): PassResult {
        const err: Pick<PassError, "status" | "message" | "turnType"> = {
            message: "LegalMovesRemain",
            status: "Err",
            turnType: "Pass"
        };

        // check for any legal moves using placement
        for (const [type, num] of Object.entries(this.playerInventories[this.currTurnColor])) {
            if (!num) continue;
            const piece: Piece = { color: this.currTurnColor, type: type as PieceType };

            // TODO there are similarities between this and the analogous part below:
            const outcome = this.getPlacements(piece);
            if (outcome.status !== "Err") {
                const option = HiveGame.entriesOfPosRecord(outcome.options)[0][0];
                return { ...err, exampleMove: { destination: this.absToRel(option), piece } };
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
                if (outcome.status !== "Err") {
                    const option = HiveGame.entriesOfPosRecord(outcome.options)[0][0];
                    return { ...err, exampleMove: { destination: this.absToRel(option), piece } };
                }
            }
        }

        this.advanceTurn();
        return { status: "Ok", turnType: "Pass" };
    }
}