import GameGenerator from '../GameGenerator.js';
import GameState from '../GameState.js';
import Grid from '../Grid.js';
import GameRules from '../GameRules.js';
import TilePicker from '../TilePicker.js';

describe('GameGenerator', () => {
    function createLayout() {
        return {
            id: 'generator-layout',
            tiles: 4,
            positions: [
                {x: 1, y: 1, z: 1},
                {x: 4, y: 1, z: 1},
                {x: 7, y: 1, z: 1},
                {x: 10, y: 1, z: 1},
            ],
        };
    }

    function createGeneratorState(generator, boardNbr = 1234, difficulty = 'standard') {
        let gameState = generator.createGameState(createLayout(), boardNbr);
        let settings = generator.resolveSettings({ difficulty });

        generator.rules = generator.createGameRules();
        generator.initializeState(gameState, settings);

        return gameState;
    }

    it('creates a fresh game state for generation', () => {
        let generator = new GameGenerator();
        let gameState = generator.createGameState(createLayout(), 42);

        expect(gameState instanceof GameState).toBe(true);
        expect(gameState.grid instanceof Grid).toBe(true);
        expect(gameState.getBoardNbr()).toBe(42);
        expect(gameState.getBoardCount()).toBe(4);
    });

    it('creates a rules helper for generator-side evaluation', () => {
        let generator = new GameGenerator();
        let rules = generator.createGameRules();

        expect(rules instanceof GameRules).toBe(true);
    });

    it('initializes generator working state for one run', () => {
        let generator = new GameGenerator();
        let gameState = generator.createGameState(createLayout(), 77);
        let settings = generator.resolveSettings({ difficulty: 'expert' });

        generator.pairs = [{ tile1: 0, tile2: 1 }];
        generator.suspended = [{ tile: 2 }];
        generator.solution = [0, 1];
        generator.faceInventory.shuffleTiles(4);

        generator.initializeState(gameState, settings);

        expect(generator.gameState).toBe(gameState);
        expect(generator.settings).toEqual(settings);
        expect(generator.pairs).toEqual([]);
        expect(generator.suspended).toEqual([]);
        expect(generator.solution).toEqual([]);
        expect(generator.faceInventory.getRemainingPairCount()).toBe(0);
        expect(generator.tilePicker instanceof TilePicker).toBe(true);
        expect(generator.tilePicker.settings).toBe(settings);
    });

    it('places one generated pair using the tile picker', () => {
        let generator = new GameGenerator();
        let gameState = createGeneratorState(generator);

        generator.occupyAllTiles();
        spyOn(generator.tilePicker, 'pickTile').and.returnValues(0, 1);

        generator.placeGeneratedPair();

        expect(generator.tilePicker.pickTile).toHaveBeenCalledTimes(2);
        expect(generator.tilePicker.pickTile.calls.argsFor(0)).toEqual([]);
        expect(generator.tilePicker.pickTile.calls.argsFor(1)).toEqual([[0]]);
        expect(generator.pairs).toEqual([{ tile1: 0, tile2: 1 }]);
        expect(gameState.hasTile(0)).toBe(false);
        expect(gameState.hasTile(1)).toBe(false);
    });

    it('occupies every tile on the board', () => {
        let generator = new GameGenerator();
        let gameState = createGeneratorState(generator);

        generator.occupyAllTiles();

        expect(gameState.getPlacedTileCount()).toBe(4);

        for (let tileKey = 0; tileKey < gameState.getBoardCount(); tileKey++) {
            expect(gameState.hasTile(tileKey)).toBe(true);
        }
    });

    it('removes a generated pair and records it in generation order', () => {
        let generator = new GameGenerator();
        let gameState = createGeneratorState(generator);

        generator.occupyAllTiles();
        generator.removeGeneratedPair(0, 1);

        expect(generator.pairs).toEqual([{ tile1: 0, tile2: 1 }]);
        expect(generator.solution).toEqual([0, 1]);
        expect(gameState.hasTile(0)).toBe(false);
        expect(gameState.hasTile(1)).toBe(false);
        expect(gameState.getPlacedTileCount()).toBe(2);
    });

    it('shuffles a simple face inventory sized to the board', () => {
        let generator = new GameGenerator();
        createGeneratorState(generator, 300);

        generator.shuffleTiles();

        expect(generator.faceInventory.getRemainingPairCount()).toBe(2);
        expect(generator.faceInventory.hasRemainingPairs()).toBe(true);
    });

    it('fills faces for generated pairs and stores the solution on game state', () => {
        let generator = new GameGenerator();
        let gameState = createGeneratorState(generator, 400);

        generator.faceInventory.shuffleTiles(4);
        generator.pairs = [
            { tile1: 0, tile2: 1 },
            { tile1: 2, tile2: 3 },
        ];
        generator.solution = [0, 1, 2, 3];

        generator.fillInRemainingFaces();

        expect(gameState.getFace(0)).toBeGreaterThanOrEqual(0);
        expect(gameState.getFace(1)).toBeGreaterThanOrEqual(0);
        expect(gameState.getFace(2)).toBeGreaterThanOrEqual(0);
        expect(gameState.getFace(3)).toBeGreaterThanOrEqual(0);
        expect(gameState.solution).toEqual([0, 1, 2, 3]);
        expect(generator.faceInventory.getRemainingPairCount()).toBe(0);
    });

    it('restores the board to fully placed occupancy for play', () => {
        let generator = new GameGenerator();
        let gameState = createGeneratorState(generator, 500);

        generator.occupyAllTiles();
        generator.removeGeneratedPair(0, 1);

        expect(gameState.getPlacedTileCount()).toBe(2);

        generator.restoreBoardForPlay();

        expect(gameState.getPlacedTileCount()).toBe(4);
        expect(gameState.hasTile(0)).toBe(true);
        expect(gameState.hasTile(1)).toBe(true);
    });

    it('generates a fully restored board with assigned faces and a solution path', () => {
        let generator = new GameGenerator();

        let result = generator.generate(createLayout(), 1234, {
            difficulty: 'standard',
        });

        expect(result.gameState).toBeDefined();
        expect(result.gameState.getBoardCount()).toBe(4);
        expect(result.gameState.getPlacedTileCount()).toBe(4);
        expect(result.solution.length).toBe(4);
        expect(result.gameState.solution).toEqual(result.solution);

        for (let tile = 0; tile < result.gameState.getBoardCount(); tile++) {
            expect(result.gameState.getFace(tile)).toBeGreaterThanOrEqual(0);
            expect(result.gameState.hasTile(tile)).toBe(true);
        }
    });

    it('is deterministic for the same layout, board number, and difficulty', () => {
        let generator = new GameGenerator();
        let layout = createLayout();

        let first = generator.generate(layout, 99, { difficulty: 'standard' });
        let second = generator.generate(layout, 99, { difficulty: 'standard' });

        expect(first.solution).toEqual(second.solution);

        for (let tile = 0; tile < first.gameState.getBoardCount(); tile++) {
            expect(first.gameState.getFace(tile)).toBe(second.gameState.getFace(tile));
        }
    });
});
