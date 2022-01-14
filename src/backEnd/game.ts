import {
    MovementError,
    MovementErrorMsg,
    MovementSuccess,
    PlacementError,
    PlacementErrorMsg,
    PlacementSuccess,
    TurnOutcome,
    TurnRequest
} from "@/types/common/turn";
import { Piece, PieceColor } from "@/types/common/piece";

import GraphUtils from "@/backEnd/graph";
import HexGrid from "@/backEnd/hexGrid";

import {
    GameStatus,
    Inventory,
    PlacementCount,
    PlayerInventories
} from "@/types/backEnd/game";
import { BFSResults } from "@/types/backEnd/graph";
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

    private playerInventories: PlayerInventories;
    private placementCount: PlacementCount;

    private turnCount: number;
    private currTurnColor: PieceColor = "Black";
    private gameStatus: GameStatus;

    public constructor() {
        super(HiveGame.playSpaceSize, [0, 0]); // TODO change for midpoint

        this.playerInventories = {
            Black: { ...HiveGame.startingInventory },
            White: { ...HiveGame.startingInventory }
        };
        this.placementCount = { Black: 0, White: 0 };
        this.turnCount = 0;
        this.gameStatus = "Ongoing";
    }

    private advanceTurn(): void {
        this.turnCount += 1;
        this.currTurnColor = this.currTurnColor === "Black" ? "White" : "Black";
        this.gameStatus = this.checkGameStatus();
    }

    private checkPlacement(piece: Piece, pos: LatticeCoords): "Success" | PlacementErrorMsg {
        // always accept first placement
        if (this.turnCount === 0) return "Success";

        // basic immediate rejections
        if (this.gameStatus !== "Ongoing") return "ErrGameOver";
        if (this.currTurnColor !== piece.color) return "ErrOutOfTurn";
        if (this.getPieceAtPos(pos) !== null) return "ErrDestinationOccupied";
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
        this.placementCount[piece.color] += 1;
        this.playerInventories[piece.color][piece.type] -= 1;
        this.advanceTurn();

        return {
            destination,
            piece,
            status: "Success",
            turnType: "Placement"
        };
    }

    private checkOneHive(fromPos: LatticeCoords): boolean {
        // accept if all adjacent pieces already connect with each other
        let lastSeenSpace = true;
        let groupsSeen = 0;
        const adjacent: LatticeCoords[] = this.adjCoords(fromPos);
        adjacent.forEach(pos => {
            if (this.getPieceAtPos(pos) !== null) {
                if (lastSeenSpace) groupsSeen += 1;
                lastSeenSpace = false;
            } else lastSeenSpace = true;
        });
        if (!lastSeenSpace && this.getPieceAtPos(adjacent[0]) !== null) groupsSeen -= 1; // if we began in connected group
        if (groupsSeen === 1) return true;

        // reject if removing piece from original location disconnects hive
        const adjIgnoringFromPos = (pos: LatticeCoords) => this.adjPieceCoords(pos)
            .filter(p => !HiveGame.equalPos(fromPos, p));
        const stringify = (pos: LatticeCoords) => pos.join(",");
        const bfsResults: BFSResults<LatticeCoords> = GraphUtils.bfs(
            this.adjPieceCoords(fromPos)[0],
            adjIgnoringFromPos,
            stringify
        );
        return bfsResults.connectedCount === this.placementCount.Black + this.placementCount.White - 2;
    }

    private checkFreedomToMove(fromPos: LatticeCoords, toPos: LatticeCoords): boolean {
        // TODO NOTE that a beetle may not mount / dismount through a second-level gate
        return true;
    }

    private checkGrasshopperMove(fromPos: LatticeCoords, toPos: LatticeCoords): boolean {
        // TODO
        return true;
    }

    private checkQueenBeeMove(fromPos: LatticeCoords, toPos: LatticeCoords): boolean {
        return this.adjCoords(fromPos).some(p => HiveGame.equalPos(p, toPos));
    }

    private checkMove(piece: Piece, fromPos: LatticeCoords, toPos: LatticeCoords): "Success" | MovementErrorMsg {
        // basic immediate rejections
        if (this.gameStatus !== "Ongoing") return "ErrGameOver";
        if (HiveGame.equalPos(fromPos, toPos)) return "ErrAlreadyThere";
        if (this.getPieceAtPos(toPos) !== null && piece.type !== "Beetle") return "ErrDestinationOccupied";
        if (this.currTurnColor !== piece.color) return "ErrOutOfTurn";
        if (this.playerInventories[piece.color].QueenBee === 1) return "ErrQueenUnplayed";

        // piece-specific movement rules
        let validPieceMovement: boolean;
        switch (piece.type) {
            case "Ant":
                validPieceMovement = true; // TODO
                break;
            case "Beetle":
                validPieceMovement = true; // TODO
                break;
            case "Grasshopper":
                validPieceMovement = this.checkGrasshopperMove(fromPos, toPos);
                break;
            case "Ladybug":
                validPieceMovement = true; // TODO
                break;
            case "Mosquito":
                validPieceMovement = true; // TODO
                break;
            case "Pillbug":
                validPieceMovement = true; // TODO
                break;
            case "QueenBee":
                validPieceMovement = this.checkQueenBeeMove(fromPos, toPos);
                break;
            case "Spider":
                validPieceMovement = true; // TODO
                break;
        }
        if (!validPieceMovement) return `ErrViolates${piece.type}Movement`;

        // freedom-to-move & one-hive rules
        if (!this.checkFreedomToMove(fromPos, toPos)) return "ErrFreedomToMoveRule";
        if (!this.checkOneHive(fromPos)) return "ErrOneHiveRule";

        return "Success";
    }

    public movePiece(piece: Piece, destination: LatticeCoords | null): MovementSuccess | MovementError {
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
        if (checkOutcome !== "Success") return {
            message: checkOutcome,
            status: "Error",
            turnType: "Movement"
        };

        this.piecePositions.setPiece(piece, destination);
        this.setPieceAtPos(fromPos, null);
        this.setPieceAtPos(destination, piece);
        this.advanceTurn();

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