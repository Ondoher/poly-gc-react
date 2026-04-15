import Grid from '../Grid.js';
import GameRules from '../GameRules.js';
import GameState from '../GameState.js';
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

    function createGameState() {
        return new GameState(new Grid()).setLayout(createLayout()).configureBoard();
    }

    function createLayeredGameState() {
        return new GameState(new Grid()).setLayout(createLayeredLayout()).configureBoard();
    }

    function createIntersectionGameState() {
        return new GameState(new Grid()).setLayout(createIntersectionLayout()).configureBoard();
    }

    function createFreedTileGameState() {
        return new GameState(new Grid()).setLayout({
            id: 'tile-picker-freed-layout',
            tiles: 3,
            positions: [
                {x: 4, y: 1, z: 1},
                {x: 4, y: 1, z: 2},
                {x: 10, y: 1, z: 1},
            ],
        }).configureBoard();
    }

    function createStackGameState() {
        return new GameState(new Grid()).setLayout({
            id: 'tile-picker-stack-layout',
            tiles: 3,
            positions: [
                {x: 1, y: 1, z: 1},
                {x: 1, y: 1, z: 2},
                {x: 4, y: 1, z: 1},
            ],
        }).configureBoard();
    }

    function createShortHorizonGameState() {
        return new GameState(new Grid()).setLayout({
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
        let settings = createSettings();
        let picker = new TilePicker(rules, gameState, settings);

        expect(picker.rules).toBe(rules);
        expect(picker.gameState).toBe(gameState);
        expect(picker.settings).toBe(settings);
        expect(picker.analyzer instanceof StateGraphAnalyzer).toBe(true);
    });

    it('asks GameRules for the current open tile keys when choosing a tile', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, createSettings());

        gameState.placeTile(0);
        gameState.placeTile(1);
        spyOn(rules, 'getOpenTiles').and.callThrough();

        picker.pickTile();

        expect(rules.getOpenTiles).toHaveBeenCalledWith(gameState);
    });

    it('scores the currently open tile keys with a uniform first-pass weight', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, createSettings());

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);

        expect(picker.scoreOpenTiles()).toEqual([
            { tileKey: 0, z: 1, zIndexFactor: 1, horizontalIntersections: 0, depthIntersections: 0, freedCount: 0, analyzerFactor: 1, openPressureFactor: 1, balanceFactor: 1, balanceMargin: 0, createsDominantStack: false, shortHorizonFactor: 1, shortHorizonMoves: 0, shortHorizonRemainingTiles: 0, shortHorizonEnabled: false, shortHorizonCollapsed: false, spatialRelationshipFactor: 1, weight: 1 },
            { tileKey: 1, z: 1, zIndexFactor: 1, horizontalIntersections: 0, depthIntersections: 0, freedCount: 0, analyzerFactor: 1, openPressureFactor: 1, balanceFactor: 1, balanceMargin: 0, createsDominantStack: false, shortHorizonFactor: 1, shortHorizonMoves: 0, shortHorizonRemainingTiles: 0, shortHorizonEnabled: false, shortHorizonCollapsed: false, spatialRelationshipFactor: 1, weight: 1 },
            { tileKey: 2, z: 1, zIndexFactor: 1, horizontalIntersections: 0, depthIntersections: 0, freedCount: 0, analyzerFactor: 1, openPressureFactor: 1, balanceFactor: 1, balanceMargin: 0, createsDominantStack: false, shortHorizonFactor: 1, shortHorizonMoves: 0, shortHorizonRemainingTiles: 0, shortHorizonEnabled: false, shortHorizonCollapsed: false, spatialRelationshipFactor: 1, weight: 1 },
        ]);
    });

    it('starts spatial relationship weighting at a neutral factor', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, createSettings());

        expect(picker.getSpatialRelationshipFactor(0)).toBe(1);
        expect(picker.getSpatialRelationshipFactor(0, [1, 2])).toBe(1);
    });

    it('builds a spatial relationship factor from horizontal and vertical intersections', () => {
        let gameState = createIntersectionGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, createSettings());

        expect(picker.getSpatialRelationshipFactor(0, [1, 2, 3])).toBe(32);
    });

    it('derives grid height from the current game state tile positions', () => {
        let gameState = createLayeredGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, createSettings());

        expect(gameState.getGridHeight()).toBe(4);
    });

    it('gives lower tiles a larger z-index factor', () => {
        let gameState = createLayeredGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, createSettings());

        expect(picker.getZIndexFactor(0)).toBe(3);
        expect(picker.getZIndexFactor(1)).toBe(2);
        expect(picker.getZIndexFactor(2)).toBe(1);
    });

    it('starts analyzer weighting at a neutral factor on settings without open pressure', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, createSettings());

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
        let gameState = createFreedTileGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, {
            ...createSettings(),
            tilePickerRules: {
                ...createSettings().tilePickerRules,
                openPressureMultiplier: 1,
                maxFreedPressure: 6,
            },
        });

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
        let gameState = createStackGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, {
            ...createSettings(),
            tilePickerRules: {
                ...createSettings().tilePickerRules,
                balancePressureMultiplier: 1,
                maxBalanceMargin: 8,
            },
        });

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
        let gameState = createShortHorizonGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, {
            ...createSettings(),
            tilePickerRules: {
                ...createSettings().tilePickerRules,
                openPressureMultiplier: 0,
                balancePressureMultiplier: 0,
                shortHorizonProbeMoves: 3,
                shortHorizonPressureMultiplier: 1,
            },
        });

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);

        expect(picker.getShortHorizonFactor(1, {
            pendingRemovedTileKeys: [0],
        })).toEqual({
            shortHorizonFactor: 4,
            shortHorizonMoves: 0,
            shortHorizonRemainingTiles: 1,
            shortHorizonEnabled: true,
            shortHorizonCollapsed: true,
        });
    });

    it('excludes reference tile keys when scoring open tiles', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, createSettings());

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);

        expect(picker.scoreOpenTiles([0, 2])).toEqual([
            { tileKey: 1, z: 1, zIndexFactor: 1, horizontalIntersections: 0, depthIntersections: 0, freedCount: 0, analyzerFactor: 1, openPressureFactor: 1, balanceFactor: 1, balanceMargin: 0, createsDominantStack: false, shortHorizonFactor: 1, shortHorizonMoves: 0, shortHorizonRemainingTiles: 0, shortHorizonEnabled: false, shortHorizonCollapsed: false, spatialRelationshipFactor: 1, weight: 1 },
        ]);
    });

    it('returns a weighted tile record from currently open tile keys', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, createSettings());

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);

        let selected = picker.pickWeightedTile();

        expect(selected).toEqual(jasmine.objectContaining({
            tileKey: jasmine.any(Number),
            weight: 1,
        }));
        expect([0, 1, 2]).toContain(selected.tileKey);
    });

    it('returns false when no scored tiles are available for weighted picking', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, createSettings());

        expect(picker.pickWeightedTile()).toBe(false);
    });

    it('picks a weighted tile from the current difficulty window', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, createSettings());
        let scoredTiles = [
            { tileKey: 0, weight: 1 },
            { tileKey: 1, weight: 1 },
            { tileKey: 2, weight: 1 },
            { tileKey: 3, weight: 1 },
        ];

        let selected = picker.pickWeightedTileFromScores(scoredTiles, {
            difficulty: 0,
            minWindowRatio: 0.25,
        });

        expect(selected).toEqual({ tileKey: 0, weight: 1 });
    });

    it('chooses one open tile key from the current open tile keys', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, createSettings());

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);

        let tileKey = picker.pickTile();

        expect([0, 1, 2]).toContain(tileKey);
    });

    it('excludes reference tile keys when choosing an open tile key', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, createSettings());

        gameState.placeTile(0);
        gameState.placeTile(1);

        let tileKey = picker.pickTile([0]);

        expect(tileKey).toBe(1);
    });

    it('ignores duplicate reference tile keys when filtering eligible picks', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, createSettings());

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);

        let tileKey = picker.pickTile([0, 0, 1]);

        expect(tileKey).toBe(2);
    });

    it('throws when no open tile keys exist', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, createSettings());

        expect(function() {
            picker.pickTile();
        }).toThrowError('Unable to find an eligible open tile during generation');
    });

    it('throws when no eligible open tile keys exist', () => {
        let gameState = createGameState();
        let rules = new GameRules();
        let picker = new TilePicker(rules, gameState, createSettings());

        gameState.placeTile(0);

        expect(function() {
            picker.pickTile([0]);
        }).toThrowError('Unable to find an eligible open tile during generation');
    });
});
