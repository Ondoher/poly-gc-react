import Grid from '../Grid.js';
import GameState from '../GameState.js';

describe('GameState', () => {
    function createLayout() {
        return {
            id: 'test-layout',
            tiles: 3,
            positions: [
                {x: 1, y: 1, z: 1},
                {x: 4, y: 1, z: 1},
                {x: 7, y: 3, z: 2},
            ],
        };
    }

    function createAdjacentLayout() {
        return {
            id: 'adjacent-layout',
            tiles: 5,
            positions: [
                {x: 4, y: 1, z: 1},
                {x: 2, y: 1, z: 1},
                {x: 6, y: 1, z: 1},
                {x: 4, y: 1, z: 2},
                {x: 4, y: 1, z: 0},
            ],
        };
    }

    function createIntersectionLayout() {
        return {
            id: 'intersection-layout',
            tiles: 4,
            positions: [
                {x: 1, y: 1, z: 1},
                {x: 1, y: 1, z: 1},
                {x: 1, y: 1, z: 2},
                {x: 7, y: 1, z: 1},
            ],
        };
    }

    it('starts with empty default state', () => {
        let gameState = new GameState();

        expect(gameState.getBoardNbr()).toBe(-1);
        expect(gameState.getLayout()).toBe(null);
        expect(gameState.getBoard()).toBe(null);
        expect(gameState.getBoardCount()).toBe(0);
        expect(gameState.getPlacedTileCount()).toBe(0);
    });

    it('supports fluent setters for core fields', () => {
        let grid = new Grid();
        let layout = createLayout();
        let board = {count: 1, pieces: [{pos: {x: 0, y: 0, z: 0}, face: 12}]};
        let solution = [0, 1];
        let gameState = new GameState();

        let returned = gameState
            .setGrid(grid)
            .setBoardNbr(42)
            .setLayout(layout)
            .setBoard(board)
            .setSolution(solution);

        expect(returned).toBe(gameState);
        expect(gameState.grid).toBe(grid);
        expect(gameState.getBoardNbr()).toBe(42);
        expect(gameState.getLayout()).toBe(layout);
        expect(gameState.getBoard()).toBe(board);
        expect(gameState.solution).toEqual(solution);
    });

    it('does nothing when configureBoard is called without a layout', () => {
        let grid = new Grid();
        let gameState = new GameState(grid);

        grid.add({x: 2, y: 2, z: 2});
        gameState.configureBoard();

        expect(gameState.getBoard()).toBe(null);
        expect(grid.has({x: 2, y: 2, z: 2})).toBe(true);
    });

    it('configures a board from the active layout and clears the grid', () => {
        let grid = new Grid();
        let layout = createLayout();
        let gameState = new GameState(grid).setLayout(layout);

        grid.add({x: 9, y: 9, z: 9});
        gameState.configureBoard();

        expect(gameState.getBoardCount()).toBe(3);
        expect(gameState.getPiece(0)).toEqual({pos: layout.positions[0], face: -1});
        expect(gameState.getPiece(1)).toEqual({pos: layout.positions[1], face: -1});
        expect(gameState.getFace(2)).toBe(-1);
        expect(gameState.getPlacedTileCount()).toBe(0);
        expect(grid.has({x: 9, y: 9, z: 9})).toBe(false);
    });

    it('reconfigures by resetting faces, placed tiles, and occupancy', () => {
        let grid = new Grid();
        let gameState = new GameState(grid).setLayout(createLayout()).configureBoard();

        gameState.setFace(0, 12);
        gameState.setFace(1, 16);
        gameState.placeTile(0);
        gameState.placeTile(1);

        gameState.configureBoard();

        expect(gameState.getFace(0)).toBe(-1);
        expect(gameState.getFace(1)).toBe(-1);
        expect(gameState.hasTile(0)).toBe(false);
        expect(gameState.hasTile(1)).toBe(false);
        expect(gameState.getPlacedTileCount()).toBe(0);
        expect(grid.has({x: 1, y: 1, z: 1})).toBe(false);
        expect(grid.has({x: 4, y: 1, z: 1})).toBe(false);
    });

    it('returns null or default values for missing tiles', () => {
        let gameState = new GameState().setLayout(createLayout()).configureBoard();

        expect(gameState.getPiece(99)).toBe(null);
        expect(gameState.getPosition(99)).toBe(null);
        expect(gameState.getTileFootprint(99)).toBe(null);
        expect(gameState.getFace(99)).toBe(-1);
        expect(gameState.hasTile(99)).toBe(false);
    });

    it('returns a mahjongg tile footprint for configured tiles', () => {
        let gameState = new GameState().setLayout(createLayout()).configureBoard();

        expect(gameState.getTileFootprint(1)).toEqual({
            x: 4,
            y: 1,
            z: 1,
            width: 2,
            height: 2,
            depth: 1,
        });
    });

    it('derives grid height from the configured tile positions', () => {
        let gameState = new GameState().setLayout(createLayout()).configureBoard();

        expect(gameState.getGridHeight()).toBe(3);
    });

    it('exposes grid occupancy queries without requiring callers to access grid directly', () => {
        let gameState = new GameState(new Grid()).setLayout(createLayout()).configureBoard();

        gameState.placeTile(0);

        expect(gameState.isOccupied({x: 1, y: 1, z: 1})).toBe(true);
        expect(gameState.isOccupied({x: 3, y: 1, z: 1})).toBe(false);
        expect(gameState.intersects({x: 1, y: 1, z: 1, width: 2, height: 2, depth: 1})).toBe(true);
        expect(gameState.intersects({x: 20, y: 20, z: 20})).toBe(false);
    });

    it('returns false from occupancy queries when no grid is attached', () => {
        let gameState = new GameState().setLayout(createLayout()).configureBoard();

        expect(gameState.isOccupied({x: 1, y: 1, z: 1})).toBe(false);
        expect(gameState.intersects({x: 1, y: 1, z: 1})).toBe(false);
    });

    it('reflects occupancy query changes after tile removal', () => {
        let gameState = new GameState(new Grid()).setLayout(createLayout()).configureBoard();

        gameState.placeTile(0);
        expect(gameState.isOccupied({x: 1, y: 1, z: 1})).toBe(true);
        expect(gameState.intersects({x: 1, y: 1, z: 1, width: 2, height: 2, depth: 1})).toBe(true);

        gameState.removeTile(0);

        expect(gameState.isOccupied({x: 1, y: 1, z: 1})).toBe(false);
        expect(gameState.intersects({x: 1, y: 1, z: 1, width: 2, height: 2, depth: 1})).toBe(false);
    });

    it('reports adjacency relationships around a placed tile', () => {
        let gameState = new GameState(new Grid()).setLayout(createLayout()).configureBoard();

        gameState.placeTile(0);

        expect(gameState.hasLeftAdjacent(0)).toBe(false);
        expect(gameState.hasRightAdjacent(0)).toBe(false);
        expect(gameState.hasAboveAdjacent(0)).toBe(false);
        expect(gameState.hasBelowAdjacent(0)).toBe(false);
    });

    it('detects left, right, above, and below adjacency from occupied neighboring space', () => {
        let grid = new Grid();
        let gameState = new GameState(grid).setLayout(createLayout()).configureBoard();

        grid.add({x: 3, y: 1, z: 1});
        grid.add({x: 6, y: 2, z: 1});
        grid.add({x: 4, y: 1, z: 2, width: 2, height: 2, depth: 1});
        grid.add({x: 4, y: 1, z: 0, width: 2, height: 2, depth: 1});

        expect(gameState.hasLeftAdjacent(1)).toBe(true);
        expect(gameState.hasRightAdjacent(1)).toBe(true);
        expect(gameState.hasAboveAdjacent(1)).toBe(true);
        expect(gameState.hasBelowAdjacent(1)).toBe(true);
    });

    it('returns false for adjacency checks on unknown tiles', () => {
        let gameState = new GameState(new Grid()).setLayout(createLayout()).configureBoard();

        expect(gameState.hasLeftAdjacent(99)).toBe(false);
        expect(gameState.hasRightAdjacent(99)).toBe(false);
        expect(gameState.hasAboveAdjacent(99)).toBe(false);
        expect(gameState.hasBelowAdjacent(99)).toBe(false);
    });

    it('counts footprint intersections against reference tiles', () => {
        let gameState = new GameState(new Grid()).setLayout(createIntersectionLayout()).configureBoard();

        expect(gameState.hasFootprintOverlap(0, 1)).toBe(true);
        expect(gameState.hasFootprintOverlap(0, 2)).toBe(true);
        expect(gameState.hasFootprintOverlap(0, 3)).toBe(false);
        expect(gameState.countHorizontalIntersections([1, 2, 3], 0)).toBe(1);
        expect(gameState.countDepthIntersections([1, 2, 3], 0)).toBe(2);
    });

    it('detects adjacency from other placed tiles', () => {
        let gameState = new GameState(new Grid()).setLayout(createAdjacentLayout()).configureBoard();

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);
        gameState.placeTile(3);
        gameState.placeTile(4);

        expect(gameState.hasLeftAdjacent(0)).toBe(true);
        expect(gameState.hasRightAdjacent(0)).toBe(true);
        expect(gameState.hasAboveAdjacent(0)).toBe(true);
        expect(gameState.hasBelowAdjacent(0)).toBe(true);
    });

    it('sets and reads tile faces', () => {
        let gameState = new GameState().setLayout(createLayout()).configureBoard();

        gameState.setFace(1, 18);

        expect(gameState.getFace(1)).toBe(18);
        expect(gameState.getPiece(1).face).toBe(18);
    });

    it('iterates over each configured tile', () => {
        let gameState = new GameState().setLayout(createLayout()).configureBoard();
        let seen = [];

        gameState.forEachTile((tile, piece) => {
            seen.push({tile, piece});
        });

        expect(seen.length).toBe(3);
        expect(seen[0].tile).toBe(0);
        expect(seen[2].tile).toBe(2);
        expect(seen[1].piece.pos).toEqual({x: 4, y: 1, z: 1});
    });

    it('places tiles onto both tile state and grid occupancy', () => {
        let grid = new Grid();
        let gameState = new GameState(grid).setLayout(createLayout()).configureBoard();

        gameState.placeTile(0);

        expect(gameState.hasTile(0)).toBe(true);
        expect(gameState.getPlacedTileCount()).toBe(1);
        expect(grid.has({x: 1, y: 1, z: 1})).toBe(true);
        expect(grid.has({x: 2, y: 1, z: 1})).toBe(true);
        expect(grid.has({x: 1, y: 2, z: 1})).toBe(true);
        expect(grid.has({x: 2, y: 2, z: 1})).toBe(true);
    });

    it('is idempotent when placing the same tile twice', () => {
        let grid = new Grid();
        let gameState = new GameState(grid).setLayout(createLayout()).configureBoard();

        gameState.placeTile(0);
        gameState.placeTile(0);

        expect(gameState.hasTile(0)).toBe(true);
        expect(gameState.getPlacedTileCount()).toBe(1);
        expect(grid.has({x: 1, y: 1, z: 1})).toBe(true);
        expect(grid.has({x: 2, y: 2, z: 1})).toBe(true);
    });

    it('removes tiles from both tile state and grid occupancy', () => {
        let grid = new Grid();
        let gameState = new GameState(grid).setLayout(createLayout()).configureBoard();

        gameState.placeTile(0);
        gameState.removeTile(0);

        expect(gameState.hasTile(0)).toBe(false);
        expect(gameState.getPlacedTileCount()).toBe(0);
        expect(grid.has({x: 1, y: 1, z: 1})).toBe(false);
        expect(grid.has({x: 2, y: 2, z: 1})).toBe(false);
    });

    it('is idempotent when removing the same tile twice', () => {
        let grid = new Grid();
        let gameState = new GameState(grid).setLayout(createLayout()).configureBoard();

        gameState.placeTile(0);
        gameState.removeTile(0);
        gameState.removeTile(0);

        expect(gameState.hasTile(0)).toBe(false);
        expect(gameState.getPlacedTileCount()).toBe(0);
        expect(grid.has({x: 1, y: 1, z: 1})).toBe(false);
        expect(grid.has({x: 2, y: 2, z: 1})).toBe(false);
    });

    it('ignores placing or removing unknown tiles', () => {
        let grid = new Grid();
        let gameState = new GameState(grid).setLayout(createLayout()).configureBoard();

        gameState.placeTile(99);
        gameState.removeTile(99);

        expect(gameState.getPlacedTileCount()).toBe(0);
        expect(grid.intersects({x: 0, y: 0, z: 0, width: 20, height: 20, depth: 5})).toBe(false);
    });

    it('clones placed tiles, solution, and grid occupancy into a new state object', () => {
        let gameState = new GameState(new Grid())
            .setBoardNbr(77)
            .setLayout(createLayout())
            .configureBoard()
            .setSolution([2, 1, 0]);

        gameState.setFace(0, 12);
        gameState.placeTile(0);
        gameState.placeTile(2);

        let clone = gameState.clone();

        expect(clone).not.toBe(gameState);
        expect(clone.grid).not.toBe(gameState.grid);
        expect(clone.getBoardNbr()).toBe(77);
        expect(clone.getLayout()).toBe(gameState.getLayout());
        expect(clone.getBoard()).toBe(gameState.getBoard());
        expect(clone.solution).toEqual([2, 1, 0]);
        expect(clone.hasTile(0)).toBe(true);
        expect(clone.hasTile(2)).toBe(true);
        expect(clone.grid.has({x: 1, y: 1, z: 1})).toBe(true);
        expect(clone.grid.has({x: 7, y: 3, z: 2})).toBe(true);
    });

    it('keeps cloned placed-tile and solution collections independent', () => {
        let gameState = new GameState(new Grid())
            .setLayout(createLayout())
            .configureBoard()
            .setSolution([0, 1, 2]);

        gameState.placeTile(0);

        let clone = gameState.clone();

        clone.removeTile(0);
        clone.solution.push(3);

        expect(gameState.hasTile(0)).toBe(true);
        expect(gameState.solution).toEqual([0, 1, 2]);
        expect(clone.hasTile(0)).toBe(false);
        expect(clone.solution).toEqual([0, 1, 2, 3]);
    });

    it('shares the board definition by reference across clones', () => {
        let gameState = new GameState(new Grid())
            .setLayout(createLayout())
            .configureBoard();

        let clone = gameState.clone();

        expect(clone.getBoard()).toBe(gameState.getBoard());
    });

    it('keeps cloned grid occupancy independent after later mutations', () => {
        let gameState = new GameState(new Grid())
            .setLayout(createLayout())
            .configureBoard();

        gameState.placeTile(0);

        let clone = gameState.clone();

        gameState.placeTile(1);
        clone.removeTile(0);
        clone.placeTile(2);

        expect(gameState.grid.has({x: 1, y: 1, z: 1})).toBe(true);
        expect(gameState.grid.has({x: 4, y: 1, z: 1})).toBe(true);
        expect(gameState.grid.has({x: 7, y: 3, z: 2})).toBe(false);

        expect(clone.grid.has({x: 1, y: 1, z: 1})).toBe(false);
        expect(clone.grid.has({x: 4, y: 1, z: 1})).toBe(false);
        expect(clone.grid.has({x: 7, y: 3, z: 2})).toBe(true);
    });
});
