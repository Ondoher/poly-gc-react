import Grid from '../Grid.js';
import GameRules from '../GameRules.js';
import GameState from '../GameState.js';
import StateGraphAnalyzer from '../StateGraphAnalyzer.js';

describe('StateGraphAnalyzer', () => {
	function createGameState(layout) {
		return new GameState(new Grid()).setLayout(layout).configureBoard();
	}

	it('creates copied state for hypothetical analysis', () => {
		let gameState = createGameState({
			id: 'copy-layout',
			tiles: 2,
			positions: [
				{x: 1, y: 1, z: 1},
				{x: 4, y: 1, z: 1},
			],
		});
		let analyzer = new StateGraphAnalyzer(new GameRules(), gameState);

		gameState.placeTile(0);

		let copy = analyzer.createStateCopy();

		expect(copy).not.toBe(gameState);
		expect(copy.hasTile(0)).toBe(true);
		expect(copy.grid).not.toBe(gameState.grid);
	});

	it('chains to a copied hypothetical state with removed tiles', () => {
		let gameState = createGameState({
			id: 'chain-layout',
			tiles: 2,
			positions: [
				{x: 1, y: 1, z: 1},
				{x: 4, y: 1, z: 1},
			],
		});
		let analyzer = new StateGraphAnalyzer(new GameRules(), gameState);

		gameState.placeTile(0);
		gameState.placeTile(1);

		let hypothetical = analyzer.withRemovedTiles([0]);

		expect(hypothetical).not.toBe(analyzer);
		expect(hypothetical.getSourceState()).toBe(gameState);
		expect(hypothetical.getAnalyzedState()).not.toBe(gameState);
		expect(hypothetical.getAnalyzedState().hasTile(0)).toBe(false);
		expect(hypothetical.getAnalyzedState().hasTile(1)).toBe(true);
		expect(gameState.hasTile(0)).toBe(true);
	});

	it('accumulates removals across chained hypothetical analysis', () => {
		let gameState = createGameState({
			id: 'nested-chain-layout',
			tiles: 3,
			positions: [
				{x: 1, y: 1, z: 1},
				{x: 4, y: 1, z: 1},
				{x: 7, y: 1, z: 1},
			],
		});
		let analyzer = new StateGraphAnalyzer(new GameRules(), gameState);

		gameState.placeTile(0);
		gameState.placeTile(1);
		gameState.placeTile(2);

		let hypothetical = analyzer.withRemovedTiles([0]).withRemovedTiles([1]);

		expect(hypothetical.getAnalyzedState().hasTile(0)).toBe(false);
		expect(hypothetical.getAnalyzedState().hasTile(1)).toBe(false);
		expect(hypothetical.getAnalyzedState().hasTile(2)).toBe(true);
	});

	it('removes hypothetical tiles from copied state only', () => {
		let gameState = createGameState({
			id: 'removal-layout',
			tiles: 2,
			positions: [
				{x: 1, y: 1, z: 1},
				{x: 4, y: 1, z: 1},
			],
		});
		let analyzer = new StateGraphAnalyzer(new GameRules(), gameState);

		gameState.placeTile(0);
		gameState.placeTile(1);

		let copy = analyzer.createStateCopyWithRemovedTiles([0]);

		expect(copy.hasTile(0)).toBe(false);
		expect(copy.hasTile(1)).toBe(true);
		expect(gameState.hasTile(0)).toBe(true);
		expect(gameState.hasTile(1)).toBe(true);
	});

	it('answers rule questions against the currently analyzed state', () => {
		let gameState = createGameState({
			id: 'current-state-layout',
			tiles: 2,
			positions: [
				{x: 1, y: 1, z: 1},
				{x: 4, y: 1, z: 1},
			],
		});
		let analyzer = new StateGraphAnalyzer(new GameRules(), gameState);

		gameState.setFace(0, 0);
		gameState.setFace(1, 2);
		gameState.placeTile(0);
		gameState.placeTile(1);

		expect(analyzer.getOpenTileKeys()).toEqual([0, 1]);
		expect(analyzer.getPlayablePairs()).toEqual([{tile1: 0, tile2: 1}]);
		expect(analyzer.hasPlayablePairs()).toBe(true);
		expect(analyzer.isLost()).toBe(false);
	});

	it('returns open tile keys after hypothetical removals', () => {
		let gameState = createGameState({
			id: 'open-layout',
			tiles: 3,
			positions: [
				{x: 4, y: 1, z: 1},
				{x: 2, y: 1, z: 1},
				{x: 6, y: 1, z: 1},
			],
		});
		let analyzer = new StateGraphAnalyzer(new GameRules(), gameState);

		gameState.placeTile(0);
		gameState.placeTile(1);
		gameState.placeTile(2);

		expect(analyzer.getOpenTileKeysAfterRemoving([1])).toEqual([0, 2]);
	});

	it('counts tiles newly freed by hypothetical removals', () => {
		let gameState = createGameState({
			id: 'freed-layout',
			tiles: 3,
			positions: [
				{x: 4, y: 1, z: 1},
				{x: 2, y: 1, z: 1},
				{x: 6, y: 1, z: 1},
			],
		});
		let analyzer = new StateGraphAnalyzer(new GameRules(), gameState);

		gameState.placeTile(0);
		gameState.placeTile(1);
		gameState.placeTile(2);

		expect(analyzer.countTilesFreedByRemoving([1])).toBe(1);
		expect(analyzer.countTilesFreedByRemoving([0, 1, 2])).toBe(0);
	});

	it('summarizes stack balance for the analyzed state', () => {
		let gameState = createGameState({
			id: 'stack-layout',
			tiles: 3,
			positions: [
				{x: 1, y: 1, z: 1},
				{x: 1, y: 1, z: 2},
				{x: 4, y: 1, z: 1},
			],
		});
		let analyzer = new StateGraphAnalyzer(new GameRules(), gameState);

		gameState.placeTile(0);
		gameState.placeTile(1);
		gameState.placeTile(2);

		expect(analyzer.getStackBalance()).toEqual({
			stackGroupCount: 2,
			maxStackHeight: 2,
			otherStackGroupCount: 1,
			balanceMargin: -1,
			createsDominantStack: true,
		});
		expect(analyzer.getStackBalanceAfterRemoving([1])).toEqual({
			stackGroupCount: 2,
			maxStackHeight: 1,
			otherStackGroupCount: 1,
			balanceMargin: 0,
			createsDominantStack: false,
		});
	});

	it('returns playable pairs after hypothetical removals', () => {
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
		let analyzer = new StateGraphAnalyzer(new GameRules(), gameState);

		gameState.setFace(0, 0);
		gameState.setFace(1, 2);
		gameState.setFace(2, 8);
		gameState.setFace(3, 10);
		gameState.placeTile(0);
		gameState.placeTile(1);
		gameState.placeTile(2);
		gameState.placeTile(3);

		expect(analyzer.getPlayablePairsAfterRemoving([0, 1])).toEqual([
			{tile1: 2, tile2: 3},
		]);
	});

	it('checks whether playable pairs remain after hypothetical removals', () => {
		let gameState = createGameState({
			id: 'remaining-layout',
			tiles: 2,
			positions: [
				{x: 1, y: 1, z: 1},
				{x: 4, y: 1, z: 1},
			],
		});
		let analyzer = new StateGraphAnalyzer(new GameRules(), gameState);

		gameState.setFace(0, 0);
		gameState.setFace(1, 2);
		gameState.placeTile(0);
		gameState.placeTile(1);

		expect(analyzer.hasPlayablePairsAfterRemoving()).toBe(true);
		expect(analyzer.hasPlayablePairsAfterRemoving([0, 1])).toBe(false);
	});

	it('checks whether the copied board would be lost after hypothetical removals', () => {
		let gameState = createGameState({
			id: 'lost-layout',
			tiles: 2,
			positions: [
				{x: 1, y: 1, z: 1},
				{x: 4, y: 1, z: 1},
			],
		});
		let analyzer = new StateGraphAnalyzer(new GameRules(), gameState);

		gameState.setFace(0, 0);
		gameState.setFace(1, 8);
		gameState.placeTile(0);
		gameState.placeTile(1);

		expect(analyzer.isLostAfterRemoving()).toBe(true);
		expect(analyzer.isLostAfterRemoving([0, 1])).toBe(false);
	});

	it('picks a deterministic short-horizon probe pair by z order and tile key', () => {
		let gameState = createGameState({
			id: 'probe-pair-layout',
			tiles: 3,
			positions: [
				{x: 1, y: 1, z: 3},
				{x: 4, y: 1, z: 1},
				{x: 7, y: 1, z: 2},
			],
		});
		let analyzer = new StateGraphAnalyzer(new GameRules(), gameState);

		expect(analyzer.pickShortHorizonProbePair([0, 1, 2])).toEqual([1, 2]);
	});

	it('keeps short-horizon probe disabled when the probe cannot run yet', () => {
		let gameState = createGameState({
			id: 'disabled-probe-layout',
			tiles: 3,
			positions: [
				{x: 1, y: 1, z: 1},
				{x: 4, y: 1, z: 1},
				{x: 7, y: 1, z: 1},
			],
		});
		let analyzer = new StateGraphAnalyzer(new GameRules(), gameState);

		gameState.placeTile(0);
		gameState.placeTile(1);
		gameState.placeTile(2);

		expect(analyzer.runShortHorizonProbe([0], {
			shortHorizonProbeMoves: 3,
			shortHorizonPressureMultiplier: 1,
		})).toEqual({
			enabled: false,
			collapsed: false,
			moves: 0,
			remainingTiles: 0,
			pressure: 1,
		});
	});

	it('detects early short-horizon collapse after hypothetical removals', () => {
		let gameState = createGameState({
			id: 'collapsed-probe-layout',
			tiles: 3,
			positions: [
				{x: 1, y: 1, z: 1},
				{x: 4, y: 1, z: 1},
				{x: 7, y: 1, z: 1},
			],
		});
		let analyzer = new StateGraphAnalyzer(new GameRules(), gameState);

		gameState.placeTile(0);
		gameState.placeTile(1);
		gameState.placeTile(2);

		expect(analyzer.runShortHorizonProbe([0, 1], {
			shortHorizonProbeMoves: 3,
			shortHorizonPressureMultiplier: 1,
		})).toEqual({
			enabled: true,
			collapsed: true,
			moves: 0,
			remainingTiles: 1,
			pressure: 4,
		});
	});

	it('returns a neutral result when the short-horizon probe does not collapse', () => {
		let gameState = createGameState({
			id: 'stable-probe-layout',
			tiles: 4,
			positions: [
				{x: 1, y: 1, z: 1},
				{x: 4, y: 1, z: 1},
				{x: 7, y: 1, z: 1},
				{x: 10, y: 1, z: 1},
			],
		});
		let analyzer = new StateGraphAnalyzer(new GameRules(), gameState);

		gameState.placeTile(0);
		gameState.placeTile(1);
		gameState.placeTile(2);
		gameState.placeTile(3);

		expect(analyzer.runShortHorizonProbe([0, 1], {
			shortHorizonProbeMoves: 1,
			shortHorizonPressureMultiplier: 1,
		})).toEqual({
			enabled: true,
			collapsed: false,
			moves: 1,
			remainingTiles: 0,
			pressure: 1,
		});
	});
});
