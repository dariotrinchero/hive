import { invertColor, pieceInventory } from "@/common/piece";
import GraphUtils from "@/common/game/graph";
import HexGrid from "@/common/game/hexGrid";

import type {
    MovementError,
    MovementOutcome,
    PassSuccess,
    PlacementError,
    PlacementOutcome,
    TurnOutcome,
    TurnRequest
} from "@/types/common/turn";
import type { Piece, PieceColor, PieceType } from "@/types/common/piece";
import type { GameState } from "@/types/common/socket";
import type {
    GameStatus,
    LastMoveDestination,
    MovementCheckOutcome,
    PillbugMoves,
    PlacementCheckOutcome,
    PlacementCount,
    PlayerInventories
} from "@/types/common/game/game";
import type { BFSAdj, Filter, PathMap } from "@/types/common/game/graph";
import type { LatticeCoords } from "@/types/common/game/hexGrid";

export default class HiveGame extends HexGrid {
    private static graphUtils = new GraphUtils<LatticeCoords>(pos => pos.join(","));

    // game state
    private turnCount: number;
    private currTurnColor: PieceColor;
    private movedLastTurn: LastMoveDestination;

    // inferrable from state
    private placementCount: PlacementCount;
    private playerInventories: PlayerInventories;
    private gameStatus: GameStatus;

    public constructor(colorToStart?: PieceColor) {
        super();
        this.playerInventories = {
            Black: { ...pieceInventory },
            White: { ...pieceInventory }
        };
        this.currTurnColor = colorToStart || "Black";
        this.movedLastTurn = { Black: null, White: null };
        this.placementCount = { Black: 0, White: 0 };
        this.turnCount = 0;
        this.gameStatus = "Ongoing";
    }

    public static fromState(state: GameState): HiveGame {
        const game = new HiveGame("Black");
        game.turnCount = state.turnCount;
        game.currTurnColor = state.currTurnColor;
        game.movedLastTurn = state.movedLastTurn;
        game.posToPiece = state.posToPiece;

        // infer other game state variables
        Object.entries(game.posToPiece).forEach(([posStr, piece]) => {
            const pos = posStr.split(",").map(str => parseInt(str)) as LatticeCoords;
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
        return {
            currTurnColor: this.currTurnColor,
            movedLastTurn: this.movedLastTurn,
            posToPiece: this.posToPiece,
            turnCount: this.turnCount
        };
    }

    public getCurrTurnColor(): PieceColor {
        return this.currTurnColor;
    }

    private getNextTurnColor(): PieceColor {
        return invertColor(this.currTurnColor);
    }

    public getTurnCount(): number {
        return this.turnCount;
    }

    public setColorToStart(color: PieceColor): void {
        if (this.turnCount === 0) this.currTurnColor = color;
    }

    /**
     * Advance current turn, checking for game-ending conditions & recording last move.
     * 
     * @param moveDest destination of movement in last turn, if any
     */
    private advanceTurn(moveDest?: LatticeCoords): void {
        this.turnCount++;
        this.movedLastTurn[this.currTurnColor] = moveDest || null;
        this.currTurnColor = this.getNextTurnColor();
        this.gameStatus = this.checkGameStatus();
    }

    /**
     * Return whether piece at given position is immobile (due to having been moved on prior turn).
     * 
     * @param pos position of piece to check
     * @returns whether piece is immobile
     */
    private isImmobile(pos: LatticeCoords): boolean {
        const oppLastMove = this.movedLastTurn[this.getNextTurnColor()];
        return oppLastMove !== null && HiveGame.eqPos(oppLastMove, pos);
    }

    /**
     * Return list of all valid placement spots for the given color.
     * 
     * @param color the color to place
     * @returns list of valid placement locations
     */
    public getLegalPlacements(color: PieceColor): LatticeCoords[] {
        return Object.values(this.getAllPosOf(color))
            .flat()
            .flatMap(pos => this.adjCoords(pos))
            .filter(pos => !this.getPieceAt(pos)
                && this.adjPieces(pos).every(piece => piece.color === color));
    }

    /**
     * Check whether placement of given piece at given position is legal.
     * 
     * @param piece piece to place
     * @param pos position at which to place
     * @returns success, or error message indicating reason for illegality
     */
    private checkPlacement(piece: Piece, pos: LatticeCoords): PlacementCheckOutcome {
        // basic immediate rejections
        if (this.gameStatus !== "Ongoing") return "ErrGameOver";
        if (this.currTurnColor !== piece.color) return "ErrOutOfTurn";

        // always accept first placement if not out-of-turn
        if (this.turnCount === 0) return "Success";

        // more immediate rejections
        if (this.getPieceAt(pos)) return "ErrDestinationOccupied";
        if (this.adjPieceCoords(pos).length === 0) return "ErrOneHiveRule";
        if (this.playerInventories[piece.color][piece.type] <= 0) return "ErrOutOfPieces";

        // reject if 4th placement is anything but queen (if unplayed)
        const mustBeQueen = this.placementCount[piece.color] === 3
            && this.playerInventories[piece.color].QueenBee === 1
            && piece.type !== "QueenBee";
        if (mustBeQueen) return "ErrMustBeQueen";

        // reject if touching opposing color (after second placement)
        const illegalNeighbour = this.placementCount[piece.color] > 0
            && this.adjPieces(pos).some(p => p.color !== piece.color);
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
    public placePiece(piece: Piece, destination?: LatticeCoords): PlacementOutcome {
        const errorTemplate: PlacementError = {
            message: "ErrInvalidDestination",
            status: "Error",
            turnType: "Placement"
        };

        // report any placement errors
        if (!destination) return errorTemplate;
        const message = this.checkPlacement(piece, destination);
        if (message !== "Success") return { ...errorTemplate, message };

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
     * Get adjacent positions that a piece is able to slide into, keeping contact with hive.
     * 
     * @param pos position from which to find adjacencies
     * @param ignore position which should be treated as empty (eg. position of piece in transit)
     * @returns adjacent valid slide positions
     */
    private adjSlideSpaces(pos: LatticeCoords, ignore?: LatticeCoords): LatticeCoords[] {
        return this.adjCoords(pos).filter((adjPos, i, arr) => {
            const gatePos = [5, 1].map(d => arr[(i + d) % 6]);
            const shouldIgnore = (adjPos: LatticeCoords) => ignore && HiveGame.eqPos(adjPos, ignore);

            let validSlide: boolean | undefined = !this.getPieceAt(adjPos);
            if (!this.getPieceAt(gatePos[0]) || shouldIgnore(gatePos[0])) {
                validSlide &&= this.getPieceAt(gatePos[1]) && !shouldIgnore(gatePos[1]);
            } else {
                validSlide &&= !this.getPieceAt(gatePos[1]) || shouldIgnore(gatePos[1]);
            }
            return validSlide;
        });
    }

    /**
     * Get adjacent positions that a piece is able to climb up/down onto, obeying freedom-to-move rule.
     * 
     * @param pos position from which to find adjacencies
     * @param ignore position which should be treated as containing one fewer piece (eg. position of piece in transit)
     * @param dismount if true/false, only return moves that specifically do/don't dismount the hive;
     *                 otherwise returns all kind of moves along top of hive
     * @returns adjacent valid mount positions
     */
    private adjMounts(pos: LatticeCoords, ignore?: LatticeCoords, dismount?: boolean): LatticeCoords[] {
        let height = this.getPieceAt(pos)?.height || 0;
        if (ignore && HiveGame.eqPos(pos, ignore)) height -= 1;

        return this.adjCoords(pos).filter((adjPos, i, arr) => {
            if (ignore && HiveGame.eqPos(adjPos, ignore)) return false;

            const gateHeights = [5, 1].map(d => this.getPieceAt(arr[(i + d) % 6])?.height || 0);
            const destination = this.getPieceAt(adjPos);

            let validMount: boolean | undefined = Math.min(...gateHeights) <= Math.max(height, destination?.height || 0);
            if (dismount === true) validMount &&= !destination;
            else if (dismount === false) validMount &&= typeof destination !== "undefined";
            else validMount &&= typeof destination !== "undefined" || height >= 1;
            return validMount;
        });
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

        // accept if all adjacent pieces already connect with each other
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

        // reject if removing piece from original location disconnects 
        return !HiveGame.graphUtils.isArticulationPoint(fromPos, (pos) => this.adjPieceCoords(pos));
    }

    /**
     * Check that given piece may legally move from given (old) location. Also update given piece to include any
     * information about its height and pieces below it, as this is needed for movement.
     * 
     * @param piece piece to move
     * @param fromPos location of piece prior to move
     * @param colorOverride overrides current color to move (used by client to compute premoves during opposing turn)
     * @returns success, or error message indicating reason for illegality
     */
    public checkPieceForMove(piece: Piece, fromPos?: LatticeCoords, colorOverride?: PieceColor): MovementCheckOutcome {
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

        return colorToMove === piece.color ? "Success" : "OnlyByPillbug";
    }

    /**
     * Generate all legal moves for given piece starting at given location. The lazy/online generator
     * approach is to speed up checking legality of a move, where we can stop generating early upon
     * finding the move of interest.
     * 
     * @see checkBugMovement
     * @param piece piece to move
     * @param fromPos location of piece prior to move
     * @param mosqOverride if given piece is a mosquito, treat it as this type instead
     * @yields legal moves
     * @returns function mapping each destination to array of intermediate positions (encoding paths taken)
     */
    public *generateLegalMoves(
        piece: Piece,
        fromPos?: LatticeCoords,
        mosqOverride?: PieceType
    ): Generator<LatticeCoords, PathMap<LatticeCoords>> {
        fromPos = fromPos || this.getPosOf(piece);
        if (!fromPos) return () => [];

        // construct appropriate move generator for each piece type
        let generator: Generator<LatticeCoords, PathMap<LatticeCoords>>;
        const type = piece.type === "Mosquito" && mosqOverride ? mosqOverride : piece.type;

        if (type === "Mosquito") {
            generator = piece.covering
                // move like beetle while on hive
                ? this.generateLegalMoves(piece, fromPos, "Beetle")

                // else merge adjacent non-mosquitoes' moves
                : GraphUtils.mergeGenerators(
                    ...this.adjPieces(fromPos)
                        .filter(p => p.type !== "Mosquito")
                        .map(p => this.generateLegalMoves(piece, fromPos, p.type))
                );
        }

        else if (type === "Grasshopper") {
            // merge straight-line moves in each of 3 directions
            generator = GraphUtils.mergeGenerators(
                ...[0, 1, 2].map(i =>
                    HiveGame.graphUtils.generatePaths(
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
            generator = HiveGame.graphUtils.generateLengthNPaths(
                fromPos,
                (pos, distance) => this.adjMounts(pos, fromPos, distance === 2),
                3
            );
        }

        else {
            // all other movement can be calculated in single call to generatePaths()
            let maxDist: number | undefined;
            let isEndpoint: Filter<LatticeCoords> | undefined;
            let adjFunc: BFSAdj<LatticeCoords> = (pos) => this.adjSlideSpaces(pos, fromPos);

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

            generator = HiveGame.graphUtils.generatePaths(fromPos, adjFunc, maxDist, isEndpoint);
        }

        // generate moves & return path information
        let next: IteratorResult<LatticeCoords, PathMap<LatticeCoords>>;
        next = generator.next();
        while (!next.done) {
            yield next.value;
            next = generator.next();
        }
        return next.value;
    }

    /**
     * Get any legal moves of given piece, starting at given (old) location, which make use of the special ability
     * of a neighbouring pillbug (or mosquito touching pillbug).
     * 
     * @param piece piece to move
     * @param fromPos location of piece prior to move
     * @returns array of legal moves of given piece over some adjacent pillbug, as well as path map
     */
    public getPillbugMoves(piece: Piece, fromPos?: LatticeCoords): PillbugMoves {
        const emptyResult: PillbugMoves = { destinations: [], pathMap: () => [] };
        fromPos = fromPos || this.getPosOf(piece);
        if (!fromPos) return emptyResult;

        // may not affect stacked pieces
        if (piece.covering) return emptyResult;

        // find adjacent non-immobilized pillbug / mosquito of current turn colour
        const pillbugPositions = this.adjPieceCoords(fromPos).filter(adjPos => {
            if (this.isImmobile(adjPos)) return false;

            const adjPiece = this.getPieceAt(adjPos);
            if (adjPiece?.color !== this.currTurnColor) return false;

            return adjPiece.type === "Pillbug"
                || adjPiece.type === "Mosquito"
                && this.adjPieces(adjPos).some(p => p.type === "Pillbug");
        });

        // freedom-to-move rule must not block piece from mounting pillbug
        const mountable = (pillbugPos: LatticeCoords) =>
            this.adjMounts(fromPos as LatticeCoords, fromPos, false)
                .some(p => HiveGame.eqPos(p, pillbugPos));
        const mountablePillbugs = pillbugPositions.filter(mountable);

        // return dismount points from all mountable pillbugs
        const destinations: LatticeCoords[][] = mountablePillbugs.map(pillbugPos =>
            this.adjMounts(pillbugPos, fromPos, true));
        const pathMap: PathMap<LatticeCoords> = (vertex: LatticeCoords) => {
            const index = destinations.findIndex(list => list.some(pos => HiveGame.eqPos(pos, vertex)));
            if (index < 0) return [];
            return [mountablePillbugs[index], fromPos as LatticeCoords];
        };
        return { destinations: destinations.flat(), pathMap };
    }

    /**
     * Check that moving given piece from given location to given location obeys specific movement rules for the
     * type of bug represented the piece.
     * 
     * @param piece piece to move
     * @param fromPos location of piece prior to move
     * @param toPos location of piece after move
     * @returns whether move is consistent with piece's specific movement patterns
     */
    private checkBugMovement(piece: Piece, fromPos: LatticeCoords, toPos: LatticeCoords): boolean {
        const generator = this.generateLegalMoves(piece, fromPos);
        let next = generator.next();
        while (!next.done) {
            if (HiveGame.eqPos(next.value, toPos)) return true;
            next = generator.next();
        }
        return false;
    }

    /**
     * Check that moving given piece from given location to given location is legal.
     * 
     * @param piece piece to move
     * @param fromPos location of piece prior to move
     * @param toPos location of piece after move
     * @returns success, or error message indicating reason for illegality
     */
    private checkMove(piece: Piece, fromPos: LatticeCoords, toPos: LatticeCoords): MovementCheckOutcome {
        const pieceCanMove = this.checkPieceForMove(piece, fromPos);
        const validPillbugMove = this.getPillbugMoves(piece, fromPos).destinations
            .some(pos => HiveGame.eqPos(pos, toPos));

        // check that piece can move at all
        if (pieceCanMove === "OnlyByPillbug") {
            if (!validPillbugMove) return "ErrOutOfTurn";
        } else if (pieceCanMove !== "Success") return pieceCanMove;

        // check that destination is valid
        if (HiveGame.eqPos(fromPos, toPos)) return "ErrAlreadyThere";
        if (this.adjPieceCoords(toPos, piece.covering ? undefined : fromPos).length === 0) return "ErrOneHiveRule";
        if (this.getPieceAt(toPos) && piece.type !== "Beetle" && piece.type !== "Mosquito") return "ErrDestinationOccupied";
        if (!validPillbugMove && !this.checkBugMovement(piece, fromPos, toPos)) return `ErrViolates${piece.type}Movement`;

        return pieceCanMove;
    }

    /**
     * Attempt to move given piece to given destination.
     * 
     * @param piece piece to move
     * @param destination destination of move
     * @returns discriminated union indicating success or failure with details in each case
     */
    public movePiece(piece: Piece, destination?: LatticeCoords): MovementOutcome {
        const errorTemplate: MovementError = {
            message: "ErrInvalidDestination",
            status: "Error",
            turnType: "Movement"
        };

        // report any movement errors
        if (!destination) return errorTemplate;
        const fromPos = this.getPosOf(piece);
        if (!fromPos) return { ...errorTemplate, message: "ErrInvalidMovingPiece" };
        const message = this.checkMove(piece, fromPos, destination);
        if (message !== "Success" && message !== "OnlyByPillbug") return { ...errorTemplate, message };

        // update covering info
        this.setPos(fromPos, piece.covering);
        piece.covering = this.getPieceAt(destination);
        piece.height = 1 + (piece.covering?.height || 0);

        // move piece & advance turn
        this.setPos(destination, piece);
        this.advanceTurn(destination);

        return { destination, piece, status: "Success", turnType: "Movement" };
    }

    /**
     * Pass the current turn without action (as when no moves are available).
     * 
     * @returns discriminated union indicating pass action with success or failure & details
     */
    public passTurn(): PassSuccess {
        // TODO reject pass if moves are available (https://boardgamegeek.com/wiki/page/Hive_FAQ#toc7)
        this.advanceTurn();
        return { status: "Success", turnType: "Pass" };
    }

    /**
     * Process given turn request & perform corresponding actions.
     * 
     * @param turn object encoding details of turn request
     * @returns discriminated union indicating turn action with success or failure & details
     */
    public processTurn(turn: TurnRequest): TurnOutcome {
        if (turn === "Pass") return this.passTurn();

        const pos = this.relToAbs(turn.destination);
        if (!this.getPosOf(turn.piece)) return this.placePiece(turn.piece, pos);
        else return this.movePiece(turn.piece, pos);
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
}