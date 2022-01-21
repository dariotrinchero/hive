import PieceMap from "@/util/pieceMap";
import GraphUtils from "@/backEnd/graph";
import HexGrid from "@/backEnd/hexGrid";

import type {
    MovementError,
    MovementSuccess,
    PlacementError,
    PlacementSuccess,
    TurnOutcome,
    TurnRequest
} from "@/types/common/turn";
import type { Piece, PieceColor, PieceType } from "@/types/common/piece";
import type {
    GameStatus,
    Inventory,
    LastMoveDestination,
    MovementCheckOutcome,
    PillbugMoves,
    PlacementCheckOutcome,
    PlacementCount,
    PlayerInventories
} from "@/types/backEnd/game";
import type { AdjFunc, Filter, PathMap } from "@/types/backEnd/graph";
import type { LatticeCoords } from "@/types/backEnd/hexGrid";

export enum Players {
    "Black",
    "White"
}

export enum Bugs {
    "Ant",
    "Beetle",
    "Grasshopper",
    "Ladybug",
    "Mosquito",
    "Pillbug",
    "QueenBee",
    "Spider"
}

export default class HiveGame extends HexGrid {
    public static startingInventory: Inventory = {
        Ant: 3,
        Beetle: 2,
        Grasshopper: 3,
        Ladybug: 1,
        Mosquito: 1,
        Pillbug: 1,
        QueenBee: 1,
        Spider: 2
    };
    private static playSpaceSize = 2 * Object.values(HiveGame.startingInventory)
        .reduce((a, b) => a + b, 0) + 2; // total pieces plus 2 adjacent spaces

    private static graphUtils = new GraphUtils<LatticeCoords>(pos => pos.join(","));

    private playerInventories: PlayerInventories;
    private placementCount: PlacementCount;
    private turnCount: number;
    private currTurnColor: PieceColor = "Black";
    private movedLastTurn: LastMoveDestination;
    private gameStatus: GameStatus;

    public constructor() {
        super(HiveGame.playSpaceSize);

        this.playerInventories = {
            Black: { ...HiveGame.startingInventory },
            White: { ...HiveGame.startingInventory }
        };
        this.movedLastTurn = { Black: null, White: null };
        this.placementCount = { Black: 0, White: 0 };
        this.turnCount = 0;
        this.gameStatus = "Ongoing";
    }

    public currTurn(): PieceColor {
        return this.currTurnColor;
    }

    private nextTurn(): PieceColor {
        return this.currTurnColor === "Black" ? "White" : "Black";
    }

    /**
     * Advance current turn, checking for game-ending conditions & recording last move.
     * 
     * @param moveDest destination of movement in last turn, if any
     */
    private advanceTurn(moveDest?: LatticeCoords): void {
        this.turnCount++;
        this.movedLastTurn[this.currTurnColor] = moveDest || null;
        this.currTurnColor = this.nextTurn();
        this.gameStatus = this.checkGameStatus();
    }

    /**
     * Return whether piece at given position is immobile (due to having been moved on prior turn).
     * 
     * @param pos position of piece to check
     * @returns whether piece is immobile
     */
    private isImmobile(pos: LatticeCoords): boolean {
        const oppLastMove = this.movedLastTurn[this.nextTurn()];
        return oppLastMove !== null && HiveGame.eqPos(oppLastMove, pos);
    }

    /**
     * Return list of all valid placement spots for the given color.
     * 
     * @param color the color to place
     * @returns list of valid placement locations
     */
    public getLegalPlacements(color: PieceColor): LatticeCoords[] {
        return Object.values(this.piecePositions.getAllOfColor(color))
            .flat()
            .flatMap(pos => this.adjCoords(pos))
            .filter(pos => !this.getAt(pos)
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
        // always accept first placement
        if (this.turnCount === 0) return "Success";

        // basic immediate rejections
        if (this.gameStatus !== "Ongoing") return "ErrGameOver";
        if (this.currTurnColor !== piece.color) return "ErrOutOfTurn";
        if (this.getAt(pos) !== null) return "ErrDestinationOccupied";
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
    public placePiece(piece: Piece, destination: LatticeCoords | null): PlacementSuccess | PlacementError {
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
        piece.index = this.piecePositions.addPiece(piece, destination);
        piece.height = 1;
        this.setAt(destination, piece);

        // advance turn
        if (this.turnCount === 0) this.currTurnColor = piece.color;
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

            let validSlide: boolean | undefined = this.getAt(adjPos) === null;
            if (!this.getAt(gatePos[0]) || shouldIgnore(gatePos[0])) {
                validSlide &&= this.getAt(gatePos[1]) !== null && !shouldIgnore(gatePos[1]);
            } else {
                validSlide &&= this.getAt(gatePos[1]) === null || shouldIgnore(gatePos[1]);
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
        let height = this.getAt(pos)?.height || 0;
        if (ignore && HiveGame.eqPos(pos, ignore)) height -= 1;

        return this.adjCoords(pos).filter((adjPos, i, arr) => {
            if (ignore && HiveGame.eqPos(adjPos, ignore)) return false;

            const gateHeights = [5, 1].map(d => this.getAt(arr[(i + d) % 6])?.height || 0);
            const destination = this.getAt(adjPos);

            let validMount = Math.min(...gateHeights) <= Math.max(height, destination?.height || 0);
            if (dismount === true) validMount &&= !destination;
            else if (dismount === false) validMount &&= destination !== null;
            else validMount &&= (destination !== null || height >= 1);
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
            if (this.getAt(pos) !== null) {
                if (lastSeenSpace) groupsSeen++;
                lastSeenSpace = false;
            } else lastSeenSpace = true;
        });
        if (!lastSeenSpace && this.getAt(adjacent[0]) !== null) groupsSeen--; // if we began in connected group
        if (groupsSeen === 1) return true;

        // reject if removing piece from original location disconnects 
        return HiveGame.graphUtils.countConnected(
            this.adjPieceCoords(fromPos)[0],
            (pos) => this.adjPieceCoords(pos, fromPos)
        ) === this.placementCount.Black + this.placementCount.White - 2;
    }

    /**
     * Check that given piece may legally move from given (old) location. Also update given piece to include any
     * information about its height and pieces below it, as this is needed for movement.
     * 
     * @param piece piece to move
     * @param fromPos location of piece prior to move
     * @returns success, or error message indicating reason for illegality
     */
    public checkPieceForMove(piece: Piece, fromPos?: LatticeCoords): MovementCheckOutcome {
        // basic rejections
        if (this.gameStatus !== "Ongoing") return "ErrGameOver";
        if (this.playerInventories[this.currTurnColor].QueenBee === 1) return "ErrQueenUnplayed";

        // get position of piece & check that piece is actually there
        fromPos = fromPos || this.piecePositions.getPiece(piece) || undefined;
        if (!fromPos) return "ErrInvalidMovingPiece";
        const pieceAtFromPos = this.getAt(fromPos);
        if (!pieceAtFromPos) return "ErrInvalidMovingPiece";
        if (!PieceMap.equalPiece(piece, pieceAtFromPos)) return "ErrCovered";

        // populate piece with covering info
        piece.covering = pieceAtFromPos.covering;
        piece.height = pieceAtFromPos.height;

        // externalized checks
        if (this.isImmobile(fromPos)) return "ErrPieceMovedLastTurn";
        if (!this.checkOneHive(piece, fromPos)) return "ErrOneHiveRule";

        return this.currTurnColor === piece.color ? "Success" : "OnlyByPillbug";
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
        fromPos = fromPos || this.piecePositions.getPiece(piece) || undefined;
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
                            if (!this.getAt(pos)) return [];
                            const adj = this.adjCoords(pos);
                            return [adj[i], adj[(i + 3) % 6]];
                        },
                        undefined,
                        (pos, distance) => distance > 1 && !this.getAt(pos)
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
            let adjFunc: AdjFunc<LatticeCoords> = (pos) => this.adjSlideSpaces(pos, fromPos);

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
        fromPos = fromPos || this.piecePositions.getPiece(piece) || undefined;
        if (!fromPos) return emptyResult;

        // may not affect stacked pieces
        if (piece.covering) return emptyResult;

        // find adjacent non-immobilized pillbug / mosquito of current turn colour
        const pillbugPositions = this.adjPieceCoords(fromPos).filter(adjPos => {
            if (this.isImmobile(adjPos)) return false;

            const adjPiece = this.getAt(adjPos);
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
        if (this.getAt(toPos) && piece.type !== "Beetle" && piece.type !== "Mosquito") return "ErrDestinationOccupied";
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
    public movePiece(piece: Piece, destination: LatticeCoords | null): MovementSuccess | MovementError {
        const errorTemplate: MovementError = {
            message: "ErrInvalidDestination",
            status: "Error",
            turnType: "Movement"
        };

        // report any movement errors
        if (!destination) return errorTemplate;
        const fromPos = this.piecePositions.getPiece(piece);
        if (!fromPos) return { ...errorTemplate, message: "ErrInvalidMovingPiece" };
        const message = this.checkMove(piece, fromPos, destination);
        if (message !== "Success" && message !== "OnlyByPillbug") return { ...errorTemplate, message };

        // handle covered pieces in old and/or new locations
        this.setAt(fromPos, piece.covering || null);
        piece.covering = this.getAt(destination) || undefined;
        piece.height = 1 + (piece.covering?.height || 0);

        // move piece & advance turn
        this.setAt(destination, piece);
        this.piecePositions.setPiece(piece, destination);
        this.advanceTurn(destination);

        return { destination, piece, status: "Success", turnType: "Movement" };
    }

    /**
     * Process given turn request & perform corresponding actions.
     * 
     * @param turn object encoding details of turn request
     * @returns discriminated union indicate turn action with success or failure & details
     */
    public processTurn(turn: TurnRequest): TurnOutcome {
        // handle passed turn
        if (turn === "Pass") { // TODO reject pass if moves are available (https://boardgamegeek.com/wiki/page/Hive_FAQ#toc7)
            this.advanceTurn();
            return { status: "Success", turnType: "Pass" };
        }

        // perform placement / movement
        const pos = this.relToAbs(turn.destination);
        if (!this.piecePositions.getPiece(turn.piece)) return this.placePiece(turn.piece, pos);
        else return this.movePiece(turn.piece, pos);
    }

    /**
     * Check whether game has ended, and if so in what outcome.
     * 
     * @returns whether game is ongoing; otherwise outcome of game
     */
    public checkGameStatus(): GameStatus {
        const blackBeePos = this.piecePositions.getPiece({ color: "Black", index: 1, type: "QueenBee" });
        const whiteBeePos = this.piecePositions.getPiece({ color: "White", index: 1, type: "QueenBee" });
        if (!blackBeePos || !whiteBeePos) return "Ongoing";

        const blackSurrounded: boolean = this.adjPieceCoords(blackBeePos).length === 6;
        const whiteSurrounded: boolean = this.adjPieceCoords(whiteBeePos).length === 6;
        if (blackSurrounded && whiteSurrounded) return "Draw";
        if (blackSurrounded) return "WhiteWin";
        if (whiteSurrounded) return "BlackWin";
        return "Ongoing";
    }
}