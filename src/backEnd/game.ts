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
    PieceSpace,
    PlacementCount,
    PlayerInventories
} from "@/types/backEnd/game";
import { BFSResults } from "@/types/backEnd/graph";
import { LatticeCoords, RelativePosition } from "@/types/backEnd/hexGrid";

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

export default class HiveGame extends HexGrid<LatticeCoords> {
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

    private playArea: PieceSpace[][];

    private playerInventories: PlayerInventories;
    private placementCount: PlacementCount;

    private turnCount: number;
    private currTurnColor: PieceColor = "Black";
    private gameStatus: GameStatus;

    public constructor() {
        super({ u: 0, v: 0 }); // TODO change for midpoint

        const playSpaceSize: number = 2 * Object.values(HiveGame.startingInventory)
            .reduce((a, b) => a + b, 0) + 2;
        this.playArea = new Array<Array<PieceSpace>>(playSpaceSize);
        for (let i = 0; i < playSpaceSize; i++) {
            this.playArea[i] = new Array<PieceSpace>(playSpaceSize).fill(null);
        }

        this.playerInventories = {
            Black: { ...HiveGame.startingInventory },
            White: { ...HiveGame.startingInventory }
        };
        this.placementCount = { Black: 0, White: 0 };
        this.turnCount = 0;
        this.gameStatus = "Ongoing";
    }

    private getFromPos(pos: LatticeCoords): PieceSpace {
        // TODO this does not handle beetles mounting / dismounting
        pos = this.mod(pos);
        return this.playArea[pos.u][pos.v];
    }

    private setAtPos(pos: LatticeCoords, piece: PieceSpace): void {
        // TODO this does not handle beetles mounting / dismounting
        pos = this.mod(pos);
        this.playArea[pos.u][pos.v] = piece;
    }

    private mod(pos: LatticeCoords): LatticeCoords {
        const len: number = this.playArea.length;
        const m = (coord: number) => (coord % len + len) % len;
        return { u: m(pos.u), v: m(pos.v) };
    }

    private equalPos(pos1: LatticeCoords, pos2: LatticeCoords) {
        pos1 = this.mod(pos1);
        pos2 = this.mod(pos2);
        return pos1.u === pos2.u && pos1.v === pos2.v;
    }

    protected override adjCoords(pos: LatticeCoords): LatticeCoords[] {
        return HiveGame.adjacencies.map(([du, dv]) => this.mod({ u: pos.u + du, v: pos.v + dv }));
    }

    private adjPieceCoords(pos: LatticeCoords): LatticeCoords[] {
        return this.adjCoords(pos).filter(pos => this.getFromPos(pos) !== null);
    }

    private adjPieces(pos: LatticeCoords): Piece[] {
        return this.adjPieceCoords(pos).map(pos => this.getFromPos(pos) as Piece);
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
        if (this.getFromPos(pos) !== null) return "ErrDestinationOccupied";
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

    public placePiece(piece: Piece, destination: RelativePosition): PlacementSuccess | PlacementError {
        const pos = this.getDestinationPos(destination);
        if (!pos) return {
            message: "ErrInvalidDestination",
            status: "Error",
            turnType: "Placement"
        };
        const checkOutcome = this.checkPlacement(piece, pos);
        if (checkOutcome !== "Success") return {
            message: checkOutcome,
            status: "Error",
            turnType: "Placement"
        };

        // spawn piece
        const positions = this.piecePositions[piece.color][piece.type];
        positions.push(pos);
        piece.index = positions.length;
        this.setAtPos(pos, piece);

        // advance turn
        if (this.turnCount === 0) this.currTurnColor = piece.color;
        this.placementCount[piece.color] += 1;
        this.playerInventories[piece.color][piece.type] -= 1;
        this.advanceTurn();

        return { destination, piece: piece, status: "Success", turnType: "Placement" };
    }

    private checkOneHive(fromPos: LatticeCoords): boolean {
        // accept if all adjacent pieces already connect with each other
        let lastSeenSpace = true;
        let groupsSeen = 0;
        const adjacent: LatticeCoords[] = this.adjCoords(fromPos);
        adjacent.forEach(pos => {
            if (this.getFromPos(pos) !== null) {
                if (lastSeenSpace) groupsSeen += 1;
                lastSeenSpace = false;
            } else lastSeenSpace = true;
        });
        if (!lastSeenSpace && this.getFromPos(adjacent[0]) !== null) groupsSeen -= 1; // if we began in connected group
        if (groupsSeen === 1) return true;

        // reject if removing piece from original location disconnects hive
        const adjIgnoringFromPos = (pos: LatticeCoords) => this.adjPieceCoords(pos)
            .filter(p => !this.equalPos(fromPos, p));
        const bfsResults: BFSResults<LatticeCoords> = GraphUtils.bfs(this.adjPieceCoords(fromPos)[0], adjIgnoringFromPos);
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
        return this.adjCoords(fromPos).some(p => this.equalPos(p, toPos));
    }

    private checkMove(piece: Piece, fromPos: LatticeCoords, toPos: LatticeCoords): "Success" | MovementErrorMsg {
        // basic immediate rejections
        if (this.gameStatus !== "Ongoing") return "ErrGameOver";
        if (this.equalPos(fromPos, toPos)) return "ErrAlreadyThere";
        if (this.getFromPos(toPos) !== null && piece.type !== "Beetle") return "ErrDestinationOccupied";
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

    public movePiece(piece: Piece, destination: RelativePosition): MovementSuccess | MovementError {
        const fromPos = this.getExistingPiecePos(piece);
        if (!fromPos) return {
            message: "ErrInvalidMovingPiece",
            status: "Error",
            turnType: "Movement"
        };
        const toPos = this.getDestinationPos(destination);
        if (!toPos) return {
            message: "ErrInvalidDestination",
            status: "Error",
            turnType: "Movement"
        };
        const checkOutcome = this.checkMove(piece, fromPos, toPos);
        if (checkOutcome !== "Success") return {
            message: checkOutcome,
            status: "Error",
            turnType: "Movement"
        };

        this.setExistingPiecePos(piece, toPos);
        this.setAtPos(fromPos, null);
        this.setAtPos(toPos, piece);
        this.advanceTurn();

        return { destination, piece, status: "Success", turnType: "Movement" };
    }

    public processTurn(turn: TurnRequest): TurnOutcome {
        // handle passed turn
        if (turn === "Pass") { // TODO reject pass if moves are available?
            this.advanceTurn();
            return { status: "Success", turnType: "Pass" };
        }

        // perform placement / movement
        const { piece, destination } = turn;
        if (!this.getExistingPiecePos(piece)) return this.placePiece(piece, destination);
        else return this.movePiece(piece, destination);
    }

    public checkGameStatus(): GameStatus {
        const blackBeePos: LatticeCoords[] = this.piecePositions.Black.QueenBee;
        const whiteBeePos: LatticeCoords[] = this.piecePositions.White.QueenBee;
        if (blackBeePos.length === 0 || whiteBeePos.length === 0) return "Ongoing";

        const blackSurrounded: boolean = this.adjPieceCoords(blackBeePos[0]).length === 6;
        const whiteSurrounded: boolean = this.adjPieceCoords(whiteBeePos[0]).length === 6;
        if (blackSurrounded && whiteSurrounded) return "Draw";
        if (blackSurrounded) return "WhiteWin";
        if (whiteSurrounded) return "BlackWin";
        return "Ongoing";
    }
}