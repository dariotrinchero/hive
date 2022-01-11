import { GameStatus, MovementOutcome, PlacementOutcome } from "@/types/common/status";
import { Piece, PieceColor } from "@/types/common/piece";
import { LatticeCoords } from "@/types/common/piece";
import { Inventory, PieceSpace, PlayerInventories, PlacementCount, PlayerPiecePositions } from "@/types/logic/game";
import GraphUtils from "./graph";
import { BFSResults } from "@/types/logic/graph";

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

export default class HiveGame {
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
    private static adjacencies = [
        // anticlockwise around reference from o-->
        [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]
    ] as const;

    private playArea: PieceSpace[][];
    private piecePositions: PlayerPiecePositions;

    private playerInventories: PlayerInventories;
    private placementCount: PlacementCount;

    private turnCount: number;
    private currTurnColor: PieceColor = "Black";
    private gameStatus: GameStatus;

    public constructor() {
        const playSpaceSize: number = 2 * Object.values(HiveGame.startingInventory)
            .reduce((a, b) => a + b, 0) + 2;
        this.playArea = new Array<Array<PieceSpace>>(playSpaceSize);
        for (var i = 0; i < playSpaceSize; i++) {
            this.playArea[i] = new Array<PieceSpace>(playSpaceSize).fill(null);
        }

        const piecePositionsEntries = Object.keys(Bugs).map(bug => [bug, []]);
        this.piecePositions = {
            Black: Object.fromEntries(piecePositionsEntries),
            White: Object.fromEntries(piecePositionsEntries)
        };
        this.playerInventories = {
            Black: { ...HiveGame.startingInventory },
            White: { ...HiveGame.startingInventory }
        };
        this.placementCount = { Black: 0, White: 0 };
        this.turnCount = 0;
        this.gameStatus = "Ongoing";
    }

    public getFromPos(pos: LatticeCoords): PieceSpace {
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

    private adjCoords(pos: LatticeCoords): LatticeCoords[] {
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

    private checkSpawn(u: number, v: number, piece: Piece): PlacementOutcome {
        // always accept first placement
        if (this.turnCount === 0) return "Success";

        // basic immediate rejections
        if (this.currTurnColor !== piece.color) return "ErrOutOfTurn";
        if (this.getFromPos({ u, v }) !== null) return "ErrDestinationOccupied";
        if (this.playerInventories[piece.color][piece.type] <= 0) return "ErrOutOfPieces";
        if (this.adjPieceCoords({ u, v }).length === 0) return "ErrOneHiveRule";

        // reject if 4th placement is anything but queen (if unplayed)
        if (this.placementCount[piece.color] === 3 && this.playerInventories[piece.color].QueenBee === 1
            && piece.type !== "QueenBee") {
            return "ErrMustBeQueen";
        }

        // reject if touching opposing color (after second placement)
        if (this.placementCount[piece.color] > 0
            && this.adjPieces({ u, v }).some(p => p.color !== piece.color)) {
            return "ErrTouchesOppColor";
        }
        return "Success";
    }

    public spawnPiece(u: number, v: number, piece: Piece): PlacementOutcome {
        const outcome: PlacementOutcome = this.checkSpawn(u, v, piece);
        if (outcome === "Success") {
            if (this.turnCount === 0) this.currTurnColor = piece.color;
            const positions = this.piecePositions[piece.color][piece.type];
            positions.push({ u, v });
            piece.index = positions.length;
            this.setAtPos({ u, v }, piece);
            this.placementCount[piece.color] += 1;
            this.playerInventories[piece.color][piece.type] -= 1;
            this.advanceTurn();
        }
        return outcome;
    }

    private checkOneHive(fromPos: LatticeCoords, toPos: LatticeCoords): boolean {
        const adjIgnoringFromPos = (pos: LatticeCoords) => this.adjPieceCoords(pos)
            .filter(p => !this.equalPos(fromPos, p));

        // reject if destination is not touching hive
        if (adjIgnoringFromPos(toPos).length === 0) return false;

        // accept all beetle moves starting on top of hive
        // TODO

        // accept if all adjacent pieces already connect with each other
        let lastSeenSpace: boolean = true;
        let groupsSeen: number = 0;
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
        const bfsResults: BFSResults<LatticeCoords> = GraphUtils.bfs(this.adjPieceCoords(fromPos)[0], adjIgnoringFromPos);
        return bfsResults.connectedCount === this.placementCount.Black + this.placementCount.White - 2;
    }

    private checkFreedomToMove(fromPos: LatticeCoords, toPos: LatticeCoords): boolean {
        // TODO NOTE that a beetle may not mount / dismount through a second-level gate
        return true;
    }

    private checkGrasshopperMove(fromPos: LatticeCoords, toPos: LatticeCoords): boolean {
        // check that gradient of movement line is 0, infinity, or -1
        // TODO the below does not account for wrapping
        // const deltaU: number = toPos.u - fromPos.u;
        // const deltaV: number = toPos.v - fromPos.v;
        // if (deltaU !== 0 && deltaV !== 0 && deltaU / deltaV !== -1) return false;

        // check that all spaces jumped over are occupied
        // TODO
        return true;
    }

    private checkQueenBeeMove(fromPos: LatticeCoords, toPos: LatticeCoords): boolean {
        return this.adjCoords(fromPos).some(p => this.equalPos(p, toPos));
    }

    private checkMove(fromPos: LatticeCoords, toPos: LatticeCoords): MovementOutcome {
        // reject if no piece is at given position
        if (this.getFromPos(fromPos) === null) return "ErrNoPieceFound";
        const piece: Piece = this.getFromPos(fromPos) as Piece;

        // reject if destination coincides with origin
        if (this.equalPos(fromPos, toPos)) return "ErrAlreadyThere";

        // reject if destination already contains piece (except for beetles)
        if (this.getFromPos(toPos) !== null && piece.type !== "Beetle") return "ErrDestinationOccupied";

        // reject if out-of-turn
        if (this.currTurnColor !== piece.color) return "ErrOutOfTurn";

        // reject if queen is unplayed
        if (this.playerInventories[piece.color].QueenBee === 1) return "ErrQueenUnplayed";

        // reject if move defies piece-specific movement rules
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

        // reject if violates freedom-to-move rule
        if (!this.checkFreedomToMove(fromPos, toPos)) return "ErrFreedomToMoveRule";

        // reject if violates one-hive rule
        if (!this.checkOneHive(fromPos, toPos)) return "ErrOneHiveRule";

        return "Success";
    }

    public movePiece(fromPos: LatticeCoords, toPos: LatticeCoords): MovementOutcome {
        const outcome: MovementOutcome = this.checkMove(fromPos, toPos);
        if (outcome === "Success") {
            const piece: Piece = this.getFromPos(fromPos) as Piece;
            const positions = this.piecePositions[piece.color][piece.type];
            positions[piece.index || positions.length - 1] = toPos;
            this.setAtPos(fromPos, null);
            this.setAtPos(toPos, piece);
            this.advanceTurn();
        }
        return outcome;
    }

    public checkGameStatus(): GameStatus {
        const blackBeePos: LatticeCoords[] = this.piecePositions.Black.QueenBee;
        const whiteBeePos: LatticeCoords[] = this.piecePositions.White.QueenBee;
        if (blackBeePos.length === 0 || whiteBeePos.length === 0) return "Ongoing";
        const blackSurrounded: boolean = this.adjPieceCoords(blackBeePos[0]).length === 6;
        const whiteSurrounded: boolean = this.adjPieceCoords(whiteBeePos[0]).length === 6;
        if (blackSurrounded && whiteSurrounded) return "Draw";
        if (blackSurrounded) return "WhiteWin";
        return "BlackWin";
    }
}