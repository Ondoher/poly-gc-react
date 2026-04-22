import Grid from '../Grid.js';
import GameRules from '../GameRules.js';
import { GeneratorState } from '../GeneratorState.js';
import FaceInventory from '../FaceInventory.js';
import TilePicker from '../TilePicker.js';
import StateGraphAnalyzer from '../StateGraphAnalyzer.js';
import { DIFFICULTY_SETTINGS } from '../difficulty-settings.js';

describe('TilePicker', () => {
    function createLayout() {
        return {
            id: 'tile-picker-layout',
            tiles: 4,
            positions: [
                {x: 1, y: 1, z: 1},
                {x: 4, y: 1, z: 1},
                {x: 7, y: 1, z: 1},
                {x: 10, y: 1, z: 1},
            ],
        };
    }

    function createLayeredLayout() {
        return {
            id: 'tile-picker-layered-layout',
            tiles: 3,
            positions: [
                {x: 1, y: 1, z: 1},
                {x: 4, y: 1, z: 2},
                {x: 7, y: 1, z: 3},
            ],
        };
    }

    function createIntersectionLayout() {
        return {
            id: 'tile-picker-intersection-layout',
            tiles: 4,
            positions: [
                {x: 1, y: 1, z: 1},
                {x: 1, y: 1, z: 1},
                {x: 1, y: 1, z: 2},
                {x: 7, y: 1, z: 1},
            ],
        };
    }

    function createGameState(settings = createSettings()) {
        return new GeneratorState(new Grid(), new FaceInventory())
            .setupSettings(settings)
            .setLayout(createLayout())
            .configureBoard();
    }

    function createGeneratorState(settings = createSettings()) {
        return new GeneratorState(new Grid(), new FaceInventory())
            .setupSettings(settings)
            .setLayout(createLayeredLayout())
            .configureBoard();
    }

    function createLayeredGameState(settings = createSettings()) {
        return new GeneratorState(new Grid(), new FaceInventory())
            .setupSettings(settings)
            .setLayout(createLayeredLayout())
            .configureBoard();
    }

    function createIntersectionGameState(settings = createSettings()) {
        return new GeneratorState(new Grid(), new FaceInventory())
            .setupSettings(settings)
            .setLayout(createIntersectionLayout())
            .configureBoard();
    }

    function createFreedTileGameState(settings = createSettings()) {
        return new GeneratorState(new Grid(), new FaceInventory()).setupSettings(settings).setLayout({
            id: 'tile-picker-freed-layout',
            tiles: 3,
            positions: [
                {x: 4, y: 1, z: 1},
                {x: 4, y: 1, z: 2},
                {x: 10, y: 1, z: 1},
            ],
        }).configureBoard();
    }

    function createStackGameState(settings = createSettings()) {
        return new GeneratorState(new Grid(), new FaceInventory()).setupSettings(settings).setLayout({
            id: 'tile-picker-stack-layout',
            tiles: 3,
            positions: [
                {x: 1, y: 1, z: 1},
                {x: 1, y: 1, z: 2},
                {x: 4, y: 1, z: 1},
            ],
        }).configureBoard();
    }

    function createShortHorizonGameState(settings = createSettings()) {
        return new GeneratorState(new Grid(), new FaceInventory()).setupSettings(settings).setLayout({
            id: 'tile-picker-short-horizon-layout',
            tiles: 3,
            positions: [
                {x: 1, y: 1, z: 1},
                {x: 4, y: 1, z: 1},
                {x: 7, y: 1, z: 1},
            ],
        }).configureBoard();
    }

    function createSettings() {
        return DIFFICULTY_SETTINGS.standard;
    }

    it('keeps the rules helper, game state, and settings it was constructed with', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        expect(picker.rules).toBe(rules);
        expect(picker.gameState).toBe(gameState);
        expect(picker.state).toBe(gameState);
        expect(picker.analyzer instanceof StateGraphAnalyzer).toBe(true);
    });

    it('uses GeneratorState as the source for ranking settings', () => {
        let state = createGeneratorState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, state);

        state.setupDifficulty(0.8);
        state.setupTilePickerRules({
            highestZOrder: 10,
            minWindowRatio: 0.5,
        });

        expect(picker.state).toBe(state);
        expect(picker.getZIndexFactor(0)).toBe(9);
        expect(picker.getDifficultyWindowDetails([
            { tileKey: 0, weight: 1 },
            { tileKey: 1, weight: 1 },
            { tileKey: 2, weight: 1 },
            { tileKey: 3, weight: 1 },
        ])).toEqual({
            window: [
                { tileKey: 1, weight: 1 },
                { tileKey: 2, weight: 1 },
                { tileKey: 3, weight: 1 },
            ],
            start: 1,
            end: 4,
            size: 3,
            count: 4,
            difficulty: 0.8,
        });
    });

    it('asks GameRules for the current open tile keys when choosing a tile', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        gameState.placeTile(0);
        gameState.placeTile(1);
        spyOn(rules, 'getOpenTiles').and.callThrough();

        picker.selectTileKey();

        expect(rules.getOpenTiles).toHaveBeenCalledWith(gameState);
    });

    it('ranks the currently open tile keys with a uniform first-pass weight', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);

        expect(picker.rankOpenTiles()).toEqual([
            { tileKey: 0, z: 1, zIndexFactor: 1, horizontalIntersections: 0, depthIntersections: 0, freedCount: 0, analyzerFactor: 1, openPressureFactor: 1, balanceFactor: 1, balanceMargin: 0, createsDominantStack: false, shortHorizonFactor: 1, shortHorizonMoves: 0, shortHorizonRemainingTiles: 0, shortHorizonEnabled: false, shortHorizonCollapsed: false, spatialRelationshipFactor: 1, weight: 1 },
            { tileKey: 1, z: 1, zIndexFactor: 1, horizontalIntersections: 0, depthIntersections: 0, freedCount: 0, analyzerFactor: 1, openPressureFactor: 1, balanceFactor: 1, balanceMargin: 0, createsDominantStack: false, shortHorizonFactor: 1, shortHorizonMoves: 0, shortHorizonRemainingTiles: 0, shortHorizonEnabled: false, shortHorizonCollapsed: false, spatialRelationshipFactor: 1, weight: 1 },
            { tileKey: 2, z: 1, zIndexFactor: 1, horizontalIntersections: 0, depthIntersections: 0, freedCount: 0, analyzerFactor: 1, openPressureFactor: 1, balanceFactor: 1, balanceMargin: 0, createsDominantStack: false, shortHorizonFactor: 1, shortHorizonMoves: 0, shortHorizonRemainingTiles: 0, shortHorizonEnabled: false, shortHorizonCollapsed: false, spatialRelationshipFactor: 1, weight: 1 },
        ]);
    });

    it('starts spatial relationship weighting at a neutral factor', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        expect(picker.getSpatialRelationshipFactor(0)).toBe(1);
        expect(picker.getSpatialRelationshipFactor(0, [1, 2])).toBe(1);
    });

    it('builds a spatial relationship factor from horizontal and vertical intersections', () => {
        let gameState = createIntersectionGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        expect(picker.getSpatialRelationshipFactor(0, [1, 2, 3])).toBe(32);
    });

    it('derives grid height from the current game state tile positions', () => {
        let gameState = createLayeredGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        expect(gameState.getGridHeight()).toBe(4);
    });

    it('gives lower tiles a larger z-index factor', () => {
        let gameState = createLayeredGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        expect(picker.getZIndexFactor(0)).toBe(3);
        expect(picker.getZIndexFactor(1)).toBe(2);
        expect(picker.getZIndexFactor(2)).toBe(1);
    });

    it('starts analyzer weighting at a neutral factor on settings without open pressure', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        expect(picker.getAnalyzerFactor(0)).toEqual({
            freedCount: 0,
            analyzerFactor: 1,
            openPressureFactor: 1,
            balanceFactor: 1,
            balanceMargin: 0,
            createsDominantStack: false,
            shortHorizonFactor: 1,
            shortHorizonMoves: 0,
            shortHorizonRemainingTiles: 0,
            shortHorizonEnabled: false,
            shortHorizonCollapsed: false,
        });
    });

    it('uses open pressure in the analyzer factor', () => {
        let settings = {
            ...createSettings(),
            tilePickerRules: {
                ...createSettings().tilePickerRules,
                openPressureMultiplier: 1,
                maxFreedPressure: 6,
            },
        };
        let gameState = createFreedTileGameState(settings);
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);

        expect(picker.getAnalyzerFactor(1)).toEqual({
            freedCount: 1,
            analyzerFactor: 6,
            openPressureFactor: 6,
            balanceFactor: 1,
            balanceMargin: 0,
            createsDominantStack: false,
            shortHorizonFactor: 1,
            shortHorizonMoves: 0,
            shortHorizonRemainingTiles: 0,
            shortHorizonEnabled: false,
            shortHorizonCollapsed: false,
        });
    });

    it('uses balance pressure in the analyzer factor', () => {
        let settings = {
            ...createSettings(),
            tilePickerRules: {
                ...createSettings().tilePickerRules,
                balancePressureMultiplier: 1,
                maxBalanceMargin: 8,
            },
        };
        let gameState = createStackGameState(settings);
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);

        expect(picker.getBalanceFactor(2)).toEqual({
            balanceMargin: -2,
            balanceFactor: 9,
            createsDominantStack: true,
        });
    });

    it('uses short-horizon pressure in the analyzer factor when a second pick collapses the future quickly', () => {
        let settings = {
            ...createSettings(),
            tilePickerRules: {
                ...createSettings().tilePickerRules,
                openPressureMultiplier: 0,
                balancePressureMultiplier: 0,
                shortHorizonProbeMoves: 3,
                shortHorizonPressureMultiplier: 1,
            },
        };
        let gameState = createShortHorizonGameState(settings);
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);

        expect(picker.getShortHorizonFactor(1, [0])).toEqual({
            shortHorizonFactor: 4,
            shortHorizonMoves: 0,
            shortHorizonRemainingTiles: 1,
            shortHorizonEnabled: true,
            shortHorizonCollapsed: true,
        });
    });

    it('excludes reference tile keys when ranking open tiles', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);

        expect(picker.rankOpenTiles([0, 2])).toEqual([
            { tileKey: 1, z: 1, zIndexFactor: 1, horizontalIntersections: 0, depthIntersections: 0, freedCount: 0, analyzerFactor: 1, openPressureFactor: 1, balanceFactor: 1, balanceMargin: 0, createsDominantStack: false, shortHorizonFactor: 1, shortHorizonMoves: 0, shortHorizonRemainingTiles: 0, shortHorizonEnabled: false, shortHorizonCollapsed: false, spatialRelationshipFactor: 1, weight: 1 },
        ]);
    });

    it('excludes unavailable tile keys from generator state when ranking open tiles', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);
        gameState.unavailableTiles = [1];

        expect(picker.rankOpenTiles().map((tile) => tile.tileKey))
            .toEqual([0, 2]);
    });

    it('selects a weighted tile record from currently open tile keys', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);

        let selected = picker.selectWeightedTile();

        expect(selected).toEqual(jasmine.objectContaining({
            tileKey: jasmine.any(Number),
            weight: 1,
        }));
        expect([0, 1, 2]).toContain(selected.tileKey);
    });

    it('returns false when no ranked tiles are available for weighted selection', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        expect(picker.selectWeightedTile()).toBe(false);
    });

    it('selects a ranked tile from the current difficulty window', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);
        let rankedTiles = [
            { tileKey: 0, weight: 1 },
            { tileKey: 1, weight: 1 },
            { tileKey: 2, weight: 1 },
            { tileKey: 3, weight: 1 },
        ];

        gameState.setupDifficulty(0);
        gameState.setupTilePickerRules({minWindowRatio: 0.25});

        let selected = picker.selectRankedTile(rankedTiles);

        expect(selected).toEqual({ tileKey: 0, weight: 1 });
    });

    it('selects one open tile key from the current open tile keys', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);

        let tileKey = picker.selectTileKey();

        expect([0, 1, 2]).toContain(tileKey);
    });

    it('excludes reference tile keys when selecting an open tile key', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        gameState.placeTile(0);
        gameState.placeTile(1);

        let tileKey = picker.selectTileKey([0]);

        expect(tileKey).toBe(1);
    });

    it('excludes unavailable tile keys from generator state when selecting an open tile key', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.unavailableTiles = [0];

        let tileKey = picker.selectTileKey();

        expect(tileKey).toBe(1);
    });

    it('ignores duplicate reference tile keys when filtering eligible picks', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);

        let tileKey = picker.selectTileKey([0, 0, 1]);

        expect(tileKey).toBe(2);
    });

    it('throws when no open tile keys exist', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        expect(function() {
            picker.selectTileKey();
        }).toThrowError('Unable to find an eligible open tile during generation');
    });

    it('throws when no eligible open tile keys exist', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState);

        gameState.placeTile(0);

        expect(function() {
            picker.selectTileKey([0]);
        }).toThrowError('Unable to find an eligible open tile during generation');
    });
});
