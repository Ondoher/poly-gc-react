import Grid from '../Grid.js';
import GameState from '../GameState.js';
import GameRules from '../GameRules.js';

describe('GameRules', () => {
    function createPlayableLayout() {
        return {
            id: 'playable-layout',
            tiles: 2,
            positions: [
                {x: 1, y: 1, z: 1},
                {x: 4, y: 1, z: 1},
            ],
        };
    }

    function createBlockedLayout() {
        return {
            id: 'blocked-layout',
            tiles: 4,
            positions: [
                {x: 4, y: 1, z: 1},
                {x: 2, y: 1, z: 1},
                {x: 6, y: 1, z: 1},
                {x: 4, y: 1, z: 2},
            ],
        };
    }

    function createGameState(layout) {
        return new GameState(new Grid()).setLayout(layout).configureBoard();
    }

    it('matches faces by face group', () => {
        let rules = new GameRules();

        expect(rules.doFacesMatch(0, 3)).toBe(true);
        expect(rules.doFacesMatch(4, 7)).toBe(true);
        expect(rules.doFacesMatch(0, 4)).toBe(false);
    });

    it('does not match negative faces', () => {
        let rules = new GameRules();

        expect(rules.doFacesMatch(-1, 0)).toBe(false);
        expect(rules.doFacesMatch(0, -1)).toBe(false);
        expect(rules.doFacesMatch(-1, -1)).toBe(false);
    });

    it('treats an unplaced tile as not open', () => {
        let rules = new GameRules();
        let gameState = createGameState(createPlayableLayout());

        expect(rules.isTileOpen(gameState, 0)).toBe(false);
    });

    it('treats a tile with one free side and no tile above as open', () => {
        let rules = new GameRules();
        let gameState = createGameState(createPlayableLayout());

        gameState.placeTile(0);

        expect(rules.isTileOpen(gameState, 0)).toBe(true);
    });

    it('treats a tile with both sides blocked as not open', () => {
        let rules = new GameRules();
        let gameState = createGameState(createBlockedLayout());

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);

        expect(rules.isTileOpen(gameState, 0)).toBe(false);
    });

    it('treats a tile with a tile above as not open', () => {
        let rules = new GameRules();
        let gameState = createGameState(createBlockedLayout());

        gameState.placeTile(0);
        gameState.placeTile(3);

        expect(rules.isTileOpen(gameState, 0)).toBe(false);
    });

    it('recognizes a playable pair when both tiles are open and faces match', () => {
        let rules = new GameRules();
        let gameState = createGameState(createPlayableLayout());

        gameState.setFace(0, 8);
        gameState.setFace(1, 11);
        gameState.placeTile(0);
        gameState.placeTile(1);

        expect(rules.isPlayablePair(gameState, 0, 1)).toBe(true);
    });

    it('rejects a pair when faces do not match', () => {
        let rules = new GameRules();
        let gameState = createGameState(createPlayableLayout());

        gameState.setFace(0, 8);
        gameState.setFace(1, 12);
        gameState.placeTile(0);
        gameState.placeTile(1);

        expect(rules.isPlayablePair(gameState, 0, 1)).toBe(false);
    });

    it('rejects a pair when one tile is not open', () => {
        let rules = new GameRules();
        let gameState = createGameState(createBlockedLayout());

        gameState.setFace(0, 8);
        gameState.setFace(1, 8);
        gameState.setFace(2, 8);
        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);

        expect(rules.isPlayablePair(gameState, 0, 1)).toBe(false);
    });

    it('rejects using the same tile twice as a pair', () => {
        let rules = new GameRules();
        let gameState = createGameState(createPlayableLayout());

        gameState.setFace(0, 8);
        gameState.placeTile(0);

        expect(rules.isPlayablePair(gameState, 0, 0)).toBe(false);
    });

    it('returns all currently open tiles', () => {
        let rules = new GameRules();
        let gameState = createGameState(createBlockedLayout());

        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);
        gameState.placeTile(3);

        expect(rules.getOpenTiles(gameState)).toEqual([1, 2, 3]);
    });

    it('returns all playable pairs on the board', () => {
        let rules = new GameRules();
        let gameState = createGameState({
            id: 'pairs-layout',
            tiles: 4,
            positions: [
                {x: 1, y: 1, z: 1},
                {x: 4, y: 1, z: 1},
                {x: 7, y: 1, z: 1},
                {x: 10, y: 1, z: 1},
            ],
        });

        gameState.setFace(0, 0);
        gameState.setFace(1, 2);
        gameState.setFace(2, 8);
        gameState.setFace(3, 10);
        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);
        gameState.placeTile(3);

        expect(rules.getPlayablePairs(gameState)).toEqual([
            {tile1: 0, tile2: 1},
            {tile1: 2, tile2: 3},
        ]);
    });

    it('returns playable pairs for a selected tile only', () => {
        let rules = new GameRules();
        let gameState = createGameState({
            id: 'selected-layout',
            tiles: 3,
            positions: [
                {x: 1, y: 1, z: 1},
                {x: 4, y: 1, z: 1},
                {x: 7, y: 1, z: 1},
            ],
        });

        gameState.setFace(0, 0);
        gameState.setFace(1, 2);
        gameState.setFace(2, 8);
        gameState.placeTile(0);
        gameState.placeTile(1);
        gameState.placeTile(2);

        expect(rules.getPlayablePairs(gameState, 0)).toEqual([
            {tile1: 0, tile2: 1},
        ]);
    });

    it('detects whether any playable pairs remain', () => {
        let rules = new GameRules();
        let gameState = createGameState(createPlayableLayout());

        gameState.setFace(0, 0);
        gameState.setFace(1, 2);
        gameState.placeTile(0);
        gameState.placeTile(1);

        expect(rules.hasPlayablePairs(gameState)).toBe(true);

        gameState.setFace(1, 8);

        expect(rules.hasPlayablePairs(gameState)).toBe(false);
    });

    it('treats an empty board as won', () => {
        let rules = new GameRules();
        let gameState = createGameState(createPlayableLayout());

        expect(rules.isWon(gameState)).toBe(true);
    });

    it('treats a non-empty board with a playable pair as not lost', () => {
        let rules = new GameRules();
        let gameState = createGameState(createPlayableLayout());

        gameState.setFace(0, 0);
        gameState.setFace(1, 2);
        gameState.placeTile(0);
        gameState.placeTile(1);

        expect(rules.isWon(gameState)).toBe(false);
        expect(rules.isLost(gameState)).toBe(false);
    });

    it('treats a non-empty board with no playable pairs as lost', () => {
        let rules = new GameRules();
        let gameState = createGameState(createPlayableLayout());

        gameState.setFace(0, 0);
        gameState.setFace(1, 8);
        gameState.placeTile(0);
        gameState.placeTile(1);

        expect(rules.isWon(gameState)).toBe(false);
        expect(rules.isLost(gameState)).toBe(true);
    });
});
