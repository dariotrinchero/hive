import {
    MovementError,
    MovementSuccess,
    PlacementError,
    PlacementSuccess,
    TurnOutcome,
    TurnRequest
} from "@/types/common/turn";
import { Piece, PieceColor, PieceType } from "@/types/common/piece";

import PieceMap from "@/util/pieceMap";
import GraphUtils from "@/backEnd/graph";
import HexGrid from "@/backEnd/hexGrid";

import {
    GameStatus,
    Inventory,
    LastMoveDestination,
    MovementCheckOutcome,
    PlacementCheckOutcome,
    PlacementCount,
    PlayerInventories
} from "@/types/backEnd/game";
import { AdjFunc, Filter } from "@/types/backEnd/graph";
import { LatticeCoords } from "@/types/backEnd/hexGrid";

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

    private advanceTurn(moveDest?: LatticeCoords): void {
        this.turnCount++;
        this.movedLastTurn[this.currTurnColor] = moveDest || null;
        this.currTurnColor = this.nextTurn();
        this.gameStatus = this.checkGameStatus();
    }

    private isImmobile(pos: LatticeCoords): boolean {
        const oppLastMove = this.movedLastTurn[this.nextTurn()];
        return oppLastMove !== null && HiveGame.eqPos(oppLastMove, pos);
    }

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
        if (this.placementCount[piece.color] === 3 && this.playerInventories[piece.color].QueenBee === 1
            && piece.type !== "QueenBee") {
            return "ErrMustBeQueen";
        }

        // reject if touching opposing color (after second placement)
        if (this.placementCount[piece.color] > 0
            && this.adjPieces(pos).some(p => p.color !== piece.color)) {
            return "ErrTouchesOppColor";
        }
        return "Success";
    }

    public placePiece(piece: Piece, destination: LatticeCoords | null): PlacementSuccess | PlacementError {
        const error: PlacementError = {
            message: "ErrInvalidDestination",
            status: "Error",
            turnType: "Placement"
        };
        if (!destination) return error;

        const message = this.checkPlacement(piece, destination);
        if (message !== "Success") return { ...error, message };

        // spawn piece
        piece.index = this.piecePositions.addPiece(piece, destination);
        piece.height = 1;
        this.setAt(destination, piece);

        // advance turn
        if (this.turnCount === 0) this.currTurnColor = piece.color;
        this.placementCount[piece.color]++;
        this.playerInventories[piece.color][piece.type] -= 1;
        this.advanceTurn();

        return {
            destination,
            piece,
            status: "Success",
            turnType: "Placement"
        };
    }

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

    public pieceMayMove(piece: Piece, fromPos?: LatticeCoords): MovementCheckOutcome {
        if (this.gameStatus !== "Ongoing") return "ErrGameOver";
        if (this.playerInventories[this.currTurnColor].QueenBee === 1) return "ErrQueenUnplayed";

        fromPos = fromPos || this.piecePositions.getPiece(piece) || undefined;
        if (!fromPos) return "ErrInvalidMovingPiece";

        const pieceAtFromPos = this.getAt(fromPos);
        if (!pieceAtFromPos) return "ErrInvalidMovingPiece";
        if (!PieceMap.equalPiece(piece, pieceAtFromPos)) return "ErrCovered";

        if (this.isImmobile(fromPos)) return "ErrPieceMovedLastTurn";
        if (!this.checkOneHive(piece, fromPos)) return "ErrOneHiveRule";

        if (this.currTurnColor !== piece.color) return "OnlyByPillbug";
        return "Success";
    }

    public *getMoves(piece: Piece, fromPos?: LatticeCoords, mosquitoTypeOverride?: PieceType): Generator<LatticeCoords, void, undefined> {
        fromPos = fromPos || this.piecePositions.getPiece(piece) || undefined;
        if (!fromPos) return;
        const type = piece.type === "Mosquito" && mosquitoTypeOverride
            ? mosquitoTypeOverride
            : piece.type;

        if (type === "Mosquito") {
            if (piece.covering) yield* this.getMoves(piece, fromPos, "Beetle");
            else {
                for (const p of this.adjPieces(fromPos)) {
                    if (p.type !== "Mosquito") yield* this.getMoves(piece, fromPos, p.type);
                }
            }
        } else if (type === "Grasshopper") {
            for (let i = 0; i < 3; i++) {
                yield* HiveGame.graphUtils.collect(
                    fromPos,
                    (pos) => {
                        if (!this.getAt(pos)) return [];
                        const adj = this.adjCoords(pos);
                        return [adj[i], adj[(i + 3) % 6]];
                    },
                    undefined,
                    (pos, distance) => distance > 1 && !this.getAt(pos)
                );
            }
        } else if (type === "Ladybug") {
            yield* HiveGame.graphUtils.walkNSteps(
                fromPos,
                (pos, distance) => this.adjMounts(pos, fromPos, distance === 2),
                3
            );
        } else {
            let adjFunc: AdjFunc<LatticeCoords> = (pos) => this.adjSlideSpaces(pos, fromPos);
            let maxDist;
            let filter: Filter<LatticeCoords> | undefined;

            if (type === "QueenBee" || type === "Pillbug") {
                maxDist = 1;
            } else if (type === "Spider") {
                filter = (_p, distance) => distance === 3;
                maxDist = 3;
            } else if (type === "Beetle") {
                adjFunc = (pos) => this.adjMounts(pos, fromPos)
                    .concat(piece.covering ? [] : this.adjSlideSpaces(pos, fromPos));
                maxDist = 1;
            }

            yield* HiveGame.graphUtils.collect(fromPos, adjFunc, maxDist, filter);
        }
    }

    public getPillbugMoves(piece: Piece, fromPos?: LatticeCoords): LatticeCoords[] {
        if (piece.covering) return []; // cannot move stacked pieces

        fromPos = fromPos || this.piecePositions.getPiece(piece) || undefined;
        if (!fromPos) return [];

        const pillbugPos = this.adjPieceCoords(fromPos).find(adjPos => {
            if (this.isImmobile(adjPos)) return false; // immobility disallows special ability

            const adjPiece = this.getAt(adjPos);
            if (adjPiece?.color !== this.currTurnColor) return false;

            return adjPiece.type === "Pillbug"
                || adjPiece.type === "Mosquito"
                && this.adjPieces(adjPos).some(p => p.type === "Pillbug");
        });
        if (!pillbugPos) return [];

        const mayMountPillbug = this.adjMounts(fromPos, fromPos, false)
            .some(p => HiveGame.eqPos(p, pillbugPos));
        if (!mayMountPillbug) return [];

        return this.adjMounts(pillbugPos, fromPos, true);
    }

    private checkPieceMovement(piece: Piece, fromPos: LatticeCoords, toPos: LatticeCoords): boolean {
        for (const pos of this.getMoves(piece, fromPos)) {
            if (HiveGame.eqPos(pos, toPos)) return true;
        }
        return false;
    }

    private checkPillbugMove(piece: Piece, fromPos: LatticeCoords, toPos: LatticeCoords): boolean {
        return this.getPillbugMoves(piece, fromPos).some(pos => HiveGame.eqPos(pos, toPos));
    }

    private checkMove(piece: Piece, fromPos: LatticeCoords, toPos: LatticeCoords): MovementCheckOutcome {
        const canMove = this.pieceMayMove(piece, fromPos);
        const validPillbugMove = this.checkPillbugMove(piece, fromPos, toPos);

        if (canMove === "OnlyByPillbug") {
            if (!validPillbugMove) return "ErrOutOfTurn";
        } else if (canMove !== "Success") return canMove;

        if (HiveGame.eqPos(fromPos, toPos)) return "ErrAlreadyThere";
        if (this.adjPieceCoords(toPos, piece.covering ? undefined : fromPos).length === 0) return "ErrOneHiveRule";
        if (this.getAt(toPos) !== null && piece.type !== "Beetle" && piece.type !== "Mosquito") return "ErrDestinationOccupied";
        if (!validPillbugMove && !this.checkPieceMovement(piece, fromPos, toPos)) return `ErrViolates${piece.type}Movement`;

        return canMove;
    }

    public movePiece(piece: Piece, destination: LatticeCoords | null): MovementSuccess | MovementError {
        const error: MovementError = {
            message: "ErrInvalidDestination",
            status: "Error",
            turnType: "Movement"
        };
        if (!destination) return error;

        const fromPos = this.piecePositions.getPiece(piece);
        if (!fromPos) return { ...error, message: "ErrInvalidMovingPiece" };

        const message = this.checkMove(piece, fromPos, destination);
        if (message !== "Success" && message !== "OnlyByPillbug") return { ...error, message };

        this.piecePositions.setPiece(piece, destination);
        this.setAt(fromPos, piece.covering || null);
        piece.covering = this.getAt(destination) || undefined;
        piece.height = 1 + (piece.covering?.height || 0);
        this.setAt(destination, piece);
        this.advanceTurn(destination);

        return {
            destination,
            piece,
            status: "Success",
            turnType: "Movement"
        };
    }

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