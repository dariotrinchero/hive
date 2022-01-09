import { MovementOutcome, PlacementOutcome } from "@/types/common/status";
import { Piece, PieceColor } from "@/types/common/piece";
import { LatticeCoords } from "@/types/common/piece";
import { Inventory, PlayerInventories, PlacementCount } from "@/types/logic/game";
import GraphUtils from "./graph";
import { BFSResults } from "@/types/logic/graph";

type PieceSpace = Piece | null;

export default class HiveGame {
    private playArea: PieceSpace[][];

    private static startingInventory: Inventory = {
        Ant: 3,
        Beetle: 2,
        Grasshopper: 3,
        Ladybug: 1,
        Mosquito: 1,
        Pillbug: 1,
        QueenBee: 1,
        Spider: 2
    };
    private static adjacencies: number[][] = [
        // from right adjacency anticlockwise
        [1, 0],
        [1, -1],
        [0, -1],
        [-1, 0],
        [-1, 1],
        [0, 1]
    ];

    private playerInventories: PlayerInventories;
    private startingPiecePos?: LatticeCoords;
    private placementCount: PlacementCount;
    private turnCount: number;
    private currTurnColor: PieceColor = "Black";

    public constructor() {
        const playSpaceSize: number = 2 * Object.values(HiveGame.startingInventory)
            .reduce((a, b) => a + b, 0) + 2;
        this.playArea = new Array<Array<PieceSpace>>(playSpaceSize);
        for (var i = 0; i < playSpaceSize; i++) {
            this.playArea[i] = new Array<PieceSpace>(playSpaceSize).fill(null);
        }

        this.playerInventories = {
            Black: { ...HiveGame.startingInventory },
            White: { ...HiveGame.startingInventory }
        };
        this.placementCount = { Black: 0, White: 0 };
        this.turnCount = 0;
    }

    public getPos(pos: LatticeCoords): PieceSpace {
        return this.playArea[this.mod(pos.u)][this.mod(pos.v)];
    }

    private setPos(pos: LatticeCoords, piece: PieceSpace): void {
        this.playArea[this.mod(pos.u)][this.mod(pos.v)] = piece;
    }

    private mod(coord: number): number {
        const len: number = this.playArea.length;
        return (coord % len + len) % len;
    }

    private adjPieceCoords(pos: LatticeCoords): LatticeCoords[] {
        return HiveGame.adjacencies
            .map(([du, dv]) => ({ u: this.mod(pos.u + du), v: this.mod(pos.v + dv) }))
            .filter((pos: LatticeCoords) => this.getPos(pos) !== null);
    }

    private advanceTurn(): void {
        this.turnCount += 1;
        this.currTurnColor = this.currTurnColor === "Black" ? "White" : "Black";
    }

    private checkSpawn(u: number, v: number, piece: Piece): PlacementOutcome {
        // always accept first placement
        if (this.turnCount === 0) return "Success";

        // reject if out-of-turn
        if (this.currTurnColor !== piece.color) return "ErrOutOfTurn";

        // reject if player lacks inventory
        if (this.playerInventories[piece.color][piece.type] <= 0) return "ErrOutOfPieces";

        // reject disconnected placements after first placement
        if (this.adjPieceCoords({ u, v }).length === 0) return "ErrDisconnected";

        // reject if 4th placement is anything but queen (if unplayed)
        if (this.placementCount[piece.color] === 3 && this.playerInventories[piece.color].QueenBee === 1
            && piece.type !== "QueenBee") {
            return "ErrMustBeQueen";
        }

        // reject if touching opposing color (after second placement)
        if (this.placementCount[piece.color] > 0) {
            const touchesOppColor: boolean = this.adjPieceCoords({ u, v })
                .map((pos: LatticeCoords) => this.getPos(pos))
                .some((p: PieceSpace) => p?.color !== piece.color);
            if (touchesOppColor) return "ErrTouchesOppColor";
        }
        return "Success";
    }

    public spawnPiece(u: number, v: number, piece: Piece): PlacementOutcome {
        const outcome: PlacementOutcome = this.checkSpawn(u, v, piece);
        if (outcome === "Success") {
            if (this.turnCount === 0) {
                this.currTurnColor = piece.color;
                this.startingPiecePos = { u, v };
            }
            this.setPos({ u, v }, piece);
            this.placementCount[piece.color] += 1;
            this.playerInventories[piece.color][piece.type] -= 1;
            this.advanceTurn();
        }
        return outcome;
    }

    private checkOneHive(fromPos: LatticeCoords, toPos: LatticeCoords): boolean {
        // reject if destination is not touching hive
        // TODO

        // accept if all adjacent pieces already connect
        const { u, v } = fromPos;
        let lastSeenSpace: boolean = true;
        let groupsSeen: number = 0;
        HiveGame.adjacencies.forEach(([du, dv]) => {
            if (this.getPos({ u: u + du, v: v + dv }) !== null) {
                if (lastSeenSpace) groupsSeen += 1;
                lastSeenSpace = false;
            } else {
                lastSeenSpace = true;
            }
        });
        if (!lastSeenSpace && this.getPos({ u: u + 1, v }) !== null) {
            // in this case, we began looking in the middle of a connected group
            groupsSeen -= 1;
        }
        if (groupsSeen === 1) {
            console.log("Shortcutted One-Hive test.");
            return true;
        }

        // reject if removing piece from original location disconnects hive
        const adjIgnoringFromPos = (pos: LatticeCoords) => this.adjPieceCoords(pos)
            .filter((pos: LatticeCoords) => pos.u !== fromPos.u || pos.v !== fromPos.v);
        const bfsResults: BFSResults<LatticeCoords> = GraphUtils.bfs(this.adjPieceCoords(fromPos)[0], adjIgnoringFromPos);
        return bfsResults.connectedCount === this.placementCount.Black + this.placementCount.White;
    }

    private checkMove(fromPos: LatticeCoords, toPos: LatticeCoords): MovementOutcome {
        // reject if no piece is at given position
        if (this.getPos(fromPos) === null) return "ErrNoPieceFound";
        const piece: Piece = this.getPos(fromPos) as Piece;

        // reject if out-of-turn
        if (this.currTurnColor !== piece.color) return "ErrOutOfTurn";

        // reject if queen has yet to be played
        if (this.playerInventories[piece.color].QueenBee === 1) return "ErrQueenNotPlaced";

        // reject if move defies piece-specific movement rules
        // TODO
        if (false) {
            return "ErrViolatesPieceMovement";
        }

        // reject if violates freedom-to-move rule
        // TODO
        if (false) {
            return "ErrFreedomToMoveRule";
        }

        // reject if violates one-hive rule
        if (!this.checkOneHive(fromPos, toPos)) return "ErrOneHiveRule";

        return "Success";
    }

    public movePiece(fromPos: LatticeCoords, toPos: LatticeCoords): MovementOutcome {
        const outcome: MovementOutcome = this.checkMove(fromPos, toPos);
        if (outcome === "Success") {
            const piece: Piece = this.getPos(fromPos) as Piece;
            this.setPos(fromPos, null);
            this.setPos(toPos, piece);
            this.advanceTurn();
        }
        return outcome;
    }
}