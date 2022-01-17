import {
    MovementError,
    MovementSuccess,
    PlacementError,
    PlacementSuccess,
    TurnOutcome,
    TurnRequest
} from "@/types/common/turn";
import { Piece, PieceColor, PieceType } from "@/types/common/piece";

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
import { Filter } from "@/types/backEnd/graph";
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
        super(HiveGame.playSpaceSize, [0, 0]); // TODO change for midpoint

        this.playerInventories = {
            Black: { ...HiveGame.startingInventory },
            White: { ...HiveGame.startingInventory }
        };
        this.movedLastTurn = { Black: null, White: null };
        this.placementCount = { Black: 0, White: 0 };
        this.turnCount = 0;
        this.gameStatus = "Ongoing";
    }

    public currentTurn(): PieceColor {
        return this.currTurnColor;
    }

    public nextTurn(): PieceColor {
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
        return oppLastMove !== null && HiveGame.equalPos(oppLastMove, pos);
    }

    private checkPlacement(piece: Piece, pos: LatticeCoords): PlacementCheckOutcome {
        // always accept first placement
        if (this.turnCount === 0) return "Success";

        // basic immediate rejections
        if (this.gameStatus !== "Ongoing") return "ErrGameOver";
        if (this.currTurnColor !== piece.color) return "ErrOutOfTurn";
        if (this.getPieceAtPos(pos) !== null) return "ErrDestinationOccupied";
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
        if (!destination) return {
            message: "ErrInvalidDestination",
            status: "Error",
            turnType: "Placement"
        };

        const checkOutcome = this.checkPlacement(piece, destination);
        if (checkOutcome !== "Success") return {
            message: checkOutcome,
            status: "Error",
            turnType: "Placement"
        };

        // spawn piece
        piece.index = this.piecePositions.addPiece(piece, destination);
        this.setPieceAtPos(destination, piece);

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
        return this.adjCoords(pos).filter((pos, i, arr) => {
            const minusOne: LatticeCoords = arr[(i + 5) % 6];
            const plusOne: LatticeCoords = arr[(i + 1) % 6];
            const shouldIgnore = (pos: LatticeCoords) => ignore && HiveGame.equalPos(pos, ignore);

            let validSlide = this.getPieceAtPos(pos) === null || shouldIgnore(pos);
            if (this.getPieceAtPos(minusOne) === null || shouldIgnore(minusOne)) {
                validSlide &&= this.getPieceAtPos(plusOne) !== null && !shouldIgnore(plusOne);
            } else {
                validSlide &&= this.getPieceAtPos(plusOne) === null || shouldIgnore(plusOne);
            }
            return validSlide;
        });
    }

    private checkOneHive(fromPos: LatticeCoords): boolean {
        // accept if all adjacent pieces already connect with each other
        let lastSeenSpace = true;
        let groupsSeen = 0;
        const adjacent: LatticeCoords[] = this.adjCoords(fromPos);
        adjacent.forEach(pos => {
            if (this.getPieceAtPos(pos) !== null) {
                if (lastSeenSpace) groupsSeen++;
                lastSeenSpace = false;
            } else lastSeenSpace = true;
        });
        if (!lastSeenSpace && this.getPieceAtPos(adjacent[0]) !== null) groupsSeen--; // if we began in connected group
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

        // TODO reject if piece is covered...

        if (this.isImmobile(fromPos)) return "ErrPieceMovedLastTurn";
        if (!this.checkOneHive(fromPos)) return "ErrOneHiveRule";

        if (this.currTurnColor !== piece.color) return "OnlyByPillbug";
        return "Success";
    }

    // TODO yields duplicate moves sometimes
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
                    if (p.type !== "Mosquito") {
                        yield* this.getMoves(piece, fromPos, p.type);
                    }
                }
            }
        } else if (type === "Grasshopper") {
            for (const i of [0, 1, 2, 3, 4, 5]) {
                yield* HiveGame.graphUtils.collect(
                    fromPos,
                    (pos) => this.getPieceAtPos(pos) ? [this.adjCoords(pos)[i]] : [],
                    (pos, distance) => distance > 1 && !this.getPieceAtPos(pos)
                );
            }
        } else if (type === "Beetle") {
            // TODO add mounting / dismounting
            // TODO beetle may not mount / dismount / move through a second-level gate
            yield* HiveGame.graphUtils.collect(
                fromPos,
                (pos) => this.adjSlideSpaces(pos, fromPos),
                undefined,
                1
            );
        } else if (type === "Ladybug") {
            // TODO ladybug may not mount / dismount / move through a second-level gate
            yield* HiveGame.graphUtils.walkNSteps(
                fromPos,
                (pos, distance) => {
                    if (distance < 2) return this.adjPieceCoords(pos, fromPos);
                    else if (distance === 2) return this.adjSpaceCoords(pos);
                    return [];
                },
                3
            );
        } else { // all simple sliding pieces
            let maxDist;
            let filter: Filter<LatticeCoords> | undefined;
            if (type === "QueenBee" || type === "Pillbug") maxDist = 1;
            else if (type === "Spider") {
                filter = (_pos, distance) => distance === 3;
                maxDist = 3;
            }
            yield* HiveGame.graphUtils.collect(
                fromPos,
                (pos) => this.adjSlideSpaces(pos, fromPos),
                filter,
                maxDist
            );
        }
    }

    // TODO assumes piece CAN MOVE: canMove() should always be called before this method to confirm this
    public getPillbugMoves(piece: Piece, fromPos?: LatticeCoords): LatticeCoords[] {
        // pillbug cannot move stacked pieces
        if (piece.covering) return [];

        // TODO pillbug may not yeet through a second-level gate

        fromPos = fromPos || this.piecePositions.getPiece(piece) || undefined;
        if (!fromPos) return [];

        const pillbugPos = this.adjPieceCoords(fromPos).find(adjPos => {
            // immobile pillbug / mosquito cannot use special ability
            if (this.isImmobile(adjPos)) return false;

            const adjPiece = this.getPieceAtPos(adjPos);
            if (adjPiece?.color !== this.currTurnColor) return false;

            return adjPiece.type === "Pillbug"
                || adjPiece.type === "Mosquito"
                && this.adjPieces(adjPos).some(p => p.type === "Pillbug");
        });

        if (!pillbugPos) return [];
        return this.adjSpaceCoords(pillbugPos);
    }

    private checkPieceMovement(piece: Piece, fromPos: LatticeCoords, toPos: LatticeCoords): boolean {
        for (const pos of this.getMoves(piece, fromPos)) {
            if (HiveGame.equalPos(pos, toPos)) return true;
        }
        return false;
    }

    private checkPillbugMove(piece: Piece, fromPos: LatticeCoords, toPos: LatticeCoords): boolean {
        return this.getPillbugMoves(piece, fromPos).some(pos => HiveGame.equalPos(pos, toPos));
    }

    private checkMove(piece: Piece, fromPos: LatticeCoords, toPos: LatticeCoords): MovementCheckOutcome {
        const canMove = this.pieceMayMove(piece, fromPos);
        const validPillbugMove = this.checkPillbugMove(piece, fromPos, toPos);

        if (canMove === "OnlyByPillbug") {
            if (!validPillbugMove) return "ErrOutOfTurn";
        } else if (canMove !== "Success") return canMove;

        if (HiveGame.equalPos(fromPos, toPos)) return "ErrAlreadyThere";
        if (this.adjPieceCoords(toPos, fromPos).length === 0) return "ErrOneHiveRule";
        if (this.getPieceAtPos(toPos) !== null && piece.type !== "Beetle" && piece.type !== "Mosquito") return "ErrDestinationOccupied";
        if (!validPillbugMove && !this.checkPieceMovement(piece, fromPos, toPos)) return `ErrViolates${piece.type}Movement`;

        return canMove;
    }

    public movePiece(piece: Piece, destination: LatticeCoords | null): MovementSuccess | MovementError {
        // TODO find some way of merging first two checks with checkMove(), as this is redundant
        if (!destination) return {
            message: "ErrInvalidDestination",
            status: "Error",
            turnType: "Movement"
        };
        const fromPos = this.piecePositions.getPiece(piece);
        if (!fromPos) return {
            message: "ErrInvalidMovingPiece",
            status: "Error",
            turnType: "Movement"
        };
        const checkOutcome = this.checkMove(piece, fromPos, destination);
        if (checkOutcome !== "Success" && checkOutcome !== "OnlyByPillbug") return {
            message: checkOutcome,
            status: "Error",
            turnType: "Movement"
        };

        this.piecePositions.setPiece(piece, destination);
        this.setPieceAtPos(fromPos, null);
        this.setPieceAtPos(destination, piece);
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
        if (turn === "Pass") { // TODO reject pass if moves are available?
            this.advanceTurn();
            return { status: "Success", turnType: "Pass" };
        }

        // perform placement / movement
        const pos = this.getAbsolutePos(turn.destination);
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