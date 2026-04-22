import GameGenerator from '../GameGenerator.js';
import GameState from '../GameState.js';
import { GeneratorState } from '../GeneratorState.js';
import Grid from '../Grid.js';
import GameRules from '../GameRules.js';
import GeneratedPair from '../GeneratedPair.js';
import Suspensions from '../Suspensions.js';
import Tiles from '../Tiles.js';
import Faces from '../Faces.js';

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
        expect(gameState instanceof GeneratorState).toBe(true);
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

        generator.preparedPairs = [{ tile1: 0, tile2: 1 }];
        generator.pairSet = generator.preparedPairs;
        generator.pairs = generator.preparedPairs;
        generator.solution = [0, 1];

        generator.initializeState(gameState, settings);

        expect(generator.gameState).toBe(gameState);
        expect(generator.settings).toEqual(settings);
        expect(generator.preparedPairs).toEqual([]);
        expect(generator.preparedPairs).toBe(gameState.preparedPairs);
        expect(generator.pairSet).toBe(generator.preparedPairs);
        expect(generator.pairs).toBe(generator.preparedPairs);
        expect(gameState.suspended).toEqual([]);
        expect(generator.solution).toEqual([]);
        expect(generator.faces instanceof Faces).toBe(true);
        expect(generator.faces.state).toBe(gameState);
        expect(generator.faces.faceInventory).toBe(gameState.faceInventory);
        expect(generator.faces.faceInventory.getRemainingPairCount()).toBe(2);
        expect(generator.tiles instanceof Tiles).toBe(true);
        expect(generator.tiles.state).toBe(gameState);
        expect(generator.suspensions instanceof Suspensions).toBe(true);
        expect(generator.suspensions.state).toBe(gameState);
        expect(generator.suspensions.tiles).toBe(generator.tiles);
        expect(generator.suspensions.faces).toBe(generator.faces);
        expect(gameState.settings).toBe(settings);
    });

    it('initializes suspension orchestration through Suspensions', () => {
        let generator = new GameGenerator();
        let gameState = generator.createGameState(createLayout(), 89);

        generator.gameState = gameState;
        generator.initializeTiles();
        generator.initializeFaces();
        generator.initializeSuspensions();

        expect(generator.suspensions instanceof Suspensions).toBe(true);
        expect(generator.suspensions.state).toBe(gameState);
        expect(generator.suspensions.tiles).toBe(generator.tiles);
        expect(generator.suspensions.faces).toBe(generator.faces);
    });

    it('initializes structural tile selection through Tiles', () => {
        let generator = new GameGenerator();
        let gameState = generator.createGameState(createLayout(), 88);

        generator.gameState = gameState;
        generator.initializeTiles();

        expect(generator.tiles instanceof Tiles).toBe(true);
        expect(generator.tiles.rules).toBe(generator.rules);
        expect(generator.tiles.state).toBe(gameState);
    });

    it('selects one generated tile pair through Tiles', () => {
        let generator = new GameGenerator();
        createGeneratorState(generator);
        let selectedPair = new GeneratedPair({ tile1: 0, tile2: 1 });

        spyOn(generator.tiles, 'selectGeneratedPair').and.returnValue(selectedPair);

        let pair = generator.pickGeneratedPair();

        expect(generator.tiles.selectGeneratedPair).toHaveBeenCalled();
        expect(pair).toBe(selectedPair);
        expect(pair instanceof GeneratedPair).toBe(true);
        expect(pair.toJSON()).toEqual({
            tile1: 0,
            tile2: 1,
            preferredFaceGroup: -1,
            faceGroup: -1,
            faces: [],
        });
    });

    it('prepares one pair by falling back to normal tile selection when suspensions do nothing', () => {
        let generator = new GameGenerator();
        let gameState = createGeneratorState(generator);

        generator.occupyAllTiles();
        spyOn(generator.suspensions, 'step').and.returnValue(false);
        spyOn(generator, 'pickGeneratedPair').and.returnValue(new GeneratedPair({ tile1: 0, tile2: 1 }));
        spyOn(generator, 'commitGeneratedPair').and.callThrough();

        generator.preparePair();

        expect(generator.suspensions.step).toHaveBeenCalled();
        expect(generator.pickGeneratedPair).toHaveBeenCalled();
        expect(generator.commitGeneratedPair).toHaveBeenCalledWith(jasmine.any(GeneratedPair));
        expect(generator.preparedPairs.length).toBe(1);
        expect(generator.preparedPairs).toBe(gameState.preparedPairs);
        expect(generator.preparedPairs[0] instanceof GeneratedPair).toBe(true);
        expect(generator.preparedPairs[0].toJSON()).toEqual({
            tile1: 0,
            tile2: 1,
            preferredFaceGroup: -1,
            faceGroup: -1,
            faces: [],
        });
        expect(gameState.hasTile(0)).toBe(false);
        expect(gameState.hasTile(1)).toBe(false);
    });

    it('prepares one pair from suspensions without normal tile selection', () => {
        let generator = new GameGenerator();
        let gameState = createGeneratorState(generator);
        let pair = new GeneratedPair({ tile1: 0, tile2: 1 });

        generator.occupyAllTiles();
        spyOn(generator.suspensions, 'step').and.returnValue(pair);
        spyOn(generator, 'pickGeneratedPair').and.callThrough();
        spyOn(generator, 'commitGeneratedPair').and.callThrough();

        generator.preparePair();

        expect(generator.suspensions.step).toHaveBeenCalled();
        expect(generator.pickGeneratedPair).not.toHaveBeenCalled();
        expect(generator.commitGeneratedPair).toHaveBeenCalledWith(pair);
        expect(generator.preparedPairs[0]).toBe(pair);
        expect(gameState.hasTile(0)).toBe(false);
        expect(gameState.hasTile(1)).toBe(false);
    });

    it('keeps the old placeGeneratedPair name as a compatibility alias', () => {
        let generator = new GameGenerator();

        spyOn(generator, 'preparePair').and.callFake(() => {});

        generator.placeGeneratedPair();

        expect(generator.preparePair).toHaveBeenCalled();
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

    it('commits a generated tile pair as the next solution step', () => {
        let generator = new GameGenerator();
        let gameState = createGeneratorState(generator);

        generator.occupyAllTiles();
        generator.commitGeneratedPair(new GeneratedPair({ tile1: 0, tile2: 1 }));

        expect(generator.preparedPairs.length).toBe(1);
        expect(generator.preparedPairs[0] instanceof GeneratedPair).toBe(true);
        expect(generator.preparedPairs[0].tiles).toEqual([0, 1]);
        expect(generator.solution).toEqual([0, 1]);
        expect(gameState.hasTile(0)).toBe(false);
        expect(gameState.hasTile(1)).toBe(false);
        expect(gameState.getPlacedTileCount()).toBe(2);
    });

    it('commits a selected pair without owning soft-link records', () => {
        let generator = new GameGenerator();
        let gameState = createGeneratorState(generator);
        let pair = new GeneratedPair({
            tile1: 0,
            tile2: 1,
        });

        generator.occupyAllTiles();
        generator.commitGeneratedPair(pair);

        expect(generator.preparedPairs[0]).toBe(pair);
        expect(gameState.softLinkRecords).toEqual([]);
        expect(gameState.hasTile(0)).toBe(false);
        expect(gameState.hasTile(1)).toBe(false);
    });

    it('keeps the old removeGeneratedPair name as a compatibility alias', () => {
        let generator = new GameGenerator();
        let pair = new GeneratedPair({ tile1: 0, tile2: 1 });

        spyOn(generator, 'commitGeneratedPair').and.callFake(() => {});

        generator.removeGeneratedPair(pair);

        expect(generator.commitGeneratedPair).toHaveBeenCalledWith(pair);
    });

    it('initializes faces through Faces', () => {
        let generator = new GameGenerator();
        let gameState = generator.createGameState(createLayout(), 300);

        generator.gameState = gameState;
        generator.initializeFaces();

        expect(generator.faces instanceof Faces).toBe(true);
        expect(generator.faces.state).toBe(gameState);
        expect(generator.faces.faceInventory).toBe(gameState.faceInventory);
        expect(generator.faces.faceInventory.getRemainingPairCount()).toBe(2);
    });

    it('keeps the old shuffleTiles name as a compatibility alias', () => {
        let generator = new GameGenerator();

        spyOn(generator, 'initializeFaces').and.callFake(() => {});

        generator.shuffleTiles();

        expect(generator.initializeFaces).toHaveBeenCalled();
    });

    it('prepares tile pairs through the current normal tile-pair stage', () => {
        let generator = new GameGenerator();
        createGeneratorState(generator);

        spyOn(generator, 'occupyAllTiles').and.callThrough();
        spyOn(generator, 'preparePair').and.callFake(() => {});

        generator.preparePairs();

        expect(generator.occupyAllTiles).toHaveBeenCalledBefore(generator.preparePair);
        expect(generator.preparePair).toHaveBeenCalledTimes(2);
    });

    it('keeps the old generatePairSet name as a compatibility alias', () => {
        let generator = new GameGenerator();

        spyOn(generator, 'preparePairs').and.callFake(() => {});

        generator.generatePairSet();

        expect(generator.preparePairs).toHaveBeenCalled();
    });

    it('keeps the old buildBoardStructure name as a compatibility alias', () => {
        let generator = new GameGenerator();

        spyOn(generator, 'preparePairs').and.callFake(() => {});

        generator.buildBoardStructure();

        expect(generator.preparePairs).toHaveBeenCalled();
    });

    it('shuffles a simple face inventory sized to the board', () => {
        let generator = new GameGenerator();
        createGeneratorState(generator, 300);

        generator.initializeFaces();

        expect(generator.faces.faceInventory.getRemainingPairCount()).toBe(2);
        expect(generator.faces.faceInventory.hasRemainingPairs()).toBe(true);
    });

    it('assigns a face pair to one prepared tile pair', () => {
        let generator = new GameGenerator();
        let gameState = createGeneratorState(generator, 400);
        let pair = new GeneratedPair({ tile1: 0, tile2: 1 });

        generator.faces.faceInventory.shuffleTiles(2);

        generator.assignFacesToPair(pair);

        expect(gameState.getFace(0)).toBeGreaterThanOrEqual(0);
        expect(gameState.getFace(1)).toBeGreaterThanOrEqual(0);
        expect(pair.faceGroup).toBeGreaterThanOrEqual(0);
        expect(pair.faces.length).toBe(2);
        expect(generator.faces.faceInventory.getRemainingPairCount()).toBe(0);
    });

    it('assigns face pairs to prepared tile pairs and stores the solution on game state', () => {
        let generator = new GameGenerator();
        let gameState = createGeneratorState(generator, 400);

        generator.faces.faceInventory.shuffleTiles(4);
        generator.preparedPairs = [
            new GeneratedPair({ tile1: 0, tile2: 1 }),
            new GeneratedPair({ tile1: 2, tile2: 3 }),
        ];
        generator.pairSet = generator.preparedPairs;
        generator.pairs = generator.preparedPairs;
        generator.solution = [0, 1, 2, 3];
        spyOn(generator.faces, 'assignFacesToPreparedPairs').and.callThrough();

        generator.assignFacesToPreparedPairs();

        expect(generator.faces.assignFacesToPreparedPairs).toHaveBeenCalledWith(generator.preparedPairs);
        expect(gameState.getFace(0)).toBeGreaterThanOrEqual(0);
        expect(gameState.getFace(1)).toBeGreaterThanOrEqual(0);
        expect(gameState.getFace(2)).toBeGreaterThanOrEqual(0);
        expect(gameState.getFace(3)).toBeGreaterThanOrEqual(0);
        expect(gameState.solution).toEqual([0, 1, 2, 3]);
        expect(generator.preparedPairs[0].faceGroup).toBeGreaterThanOrEqual(0);
        expect(generator.preparedPairs[0].faces.length).toBe(2);
        expect(generator.preparedPairs[1].faceGroup).toBeGreaterThanOrEqual(0);
        expect(generator.preparedPairs[1].faces.length).toBe(2);
        expect(generator.faces.faceInventory.getRemainingPairCount()).toBe(0);
    });

    it('keeps the old assignFacesToPairSet name as a compatibility alias', () => {
        let generator = new GameGenerator();

        spyOn(generator, 'assignFacesToPreparedPairs').and.callFake(() => {});

        generator.assignFacesToPairSet();

        expect(generator.assignFacesToPreparedPairs).toHaveBeenCalled();
    });

    it('keeps the old assignDeferredFaces name as a compatibility alias', () => {
        let generator = new GameGenerator();

        spyOn(generator, 'assignFacesToPreparedPairs').and.callFake(() => {});

        generator.assignDeferredFaces();

        expect(generator.assignFacesToPreparedPairs).toHaveBeenCalled();
    });

    it('keeps the old fillInRemainingFaces name as a compatibility alias', () => {
        let generator = new GameGenerator();

        spyOn(generator, 'assignFacesToPreparedPairs').and.callFake(() => {});

        generator.fillInRemainingFaces();

        expect(generator.assignFacesToPreparedPairs).toHaveBeenCalled();
    });

    it('restores the board to fully placed occupancy for play', () => {
        let generator = new GameGenerator();
        let gameState = createGeneratorState(generator, 500);

        generator.occupyAllTiles();
        generator.commitGeneratedPair(new GeneratedPair({ tile1: 0, tile2: 1 }));

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
        expect(result.gameState instanceof GeneratorState).toBe(true);
        expect(generator.tiles.state).toBe(result.gameState);
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
