import Random from '../../src/gc/utils/random.js';
import StateGraphAnalyzer from './StateGraphAnalyzer.js';

/**
 * Select open tile keys from a working game state during generation.
 */
export default class TilePicker {
	/**
	 * @param {GameRules} rules
	 * @param {GameState} gameState
	 * @param {DifficultySettings} settings
	 */
	constructor(rules, gameState, settings) {
		/**
		 * Rules helper used to discover currently open tile keys.
		 *
		 * @type {GameRules}
		 */
		this.rules = rules;

		/**
		 * Working game state used for open-tile queries.
		 *
		 * @type {GameState}
		 */
		this.gameState = gameState;

		/**
		 * Resolved generation settings for the current run.
		 *
		 * The current picker does not use these yet, but the constructor carries
		 * them now so weighting logic can be introduced without changing the public
		 * shape again.
		 *
		 * @type {DifficultySettings}
		 */
		this.settings = settings;

		/**
		 * Hypothetical-state analyzer used for graph-style factor questions.
		 *
		 * @type {StateGraphAnalyzer}
		 */
		this.analyzer = new StateGraphAnalyzer(rules, gameState);
	}

	/**
	 * Calculate the z-index factor for one tile key.
	 *
	 * Lower tiles receive a larger factor than higher tiles.
	 *
	 * @param {TileKey} tileKey
	 * @param {{highestZOrder?: number}} [options={}]
	 * @returns {number}
	 */
	getZIndexFactor(tileKey, options = {}) {
		let { highestZOrder } = this.state.collapseOptions(options);
		let position = this.gameState.getPosition(tileKey);

		if (!position) {
			return 1;
		}

		return Math.max(1, highestZOrder - position.z);
	}

	/**
	 * Calculate the grouped spatial relationship factor for one tile key.
	 *
	 * This starts as a neutral factor and will later absorb the horizontal and
	 * depth-based reference spatial weighting rules.
	 *
	 * @param {TileKey} tileKey
	 * @param {TileKey[]} [referenceTileKeys=[]]
	 * @param {object} [options={}]
	 * @returns {number}
	 */
	getSpatialRelationshipFactor(tileKey, referenceTileKeys = [], options = {}) {
		let { horizontalMultiplier, depthMultiplier } = this.state.collapseOptions(options);
		let horizontalIntersections = this.gameState.countHorizontalIntersections(
			referenceTileKeys,
			tileKey
		);
		let depthIntersections = this.gameState.countDepthIntersections(
			referenceTileKeys,
			tileKey
		);

		return Math.pow(horizontalMultiplier, horizontalIntersections)
			* Math.pow(depthMultiplier, depthIntersections);
	}

	/**
	 * Calculate the open-pressure factor for one tile key.
	 *
	 * Tiles that free fewer future opens receive a larger factor on harder
	 * settings, matching the live generator's pressure direction.
	 *
	 * @param {TileKey} tileKey
	 * @param {object} [options={}]
	 * @returns {{freedCount: number, openPressureFactor: number}}
	 */
	getOpenPressureFactor(tileKey, options = {}) {
		let {
			openPressureMultiplier,
			maxFreedPressure,
			pendingRemovedTileKeys,
		} = this.state.collapseOptions(options);
		let freedCount = this.analyzer.countTilesFreedByRemoving([
			...pendingRemovedTileKeys,
			tileKey,
		]);

		if (openPressureMultiplier === 0) {
			return {
				freedCount,
				openPressureFactor: 1,
			};
		}

		let clampedFreedCount = Math.min(freedCount, maxFreedPressure);
		let pressure = maxFreedPressure - clampedFreedCount + 1;

		return {
			freedCount,
			openPressureFactor: 1 + (pressure - 1) * openPressureMultiplier,
		};
	}

	/**
	 * Calculate the stack-balance factor for one tile key.
	 *
	 * Tiles that would leave a less balanced stack landscape receive a larger
	 * factor on harder settings.
	 *
	 * @param {TileKey} tileKey
	 * @param {object} [options={}]
	 * @returns {{balanceMargin: number, balanceFactor: number, createsDominantStack: boolean}}
	 */
	getBalanceFactor(tileKey, options = {}) {
		let {
			balancePressureMultiplier,
			maxBalanceMargin,
			pendingRemovedTileKeys,
		} = this.state.collapseOptions(options);
		let balance = this.analyzer.getStackBalanceAfterRemoving([
			...pendingRemovedTileKeys,
			tileKey,
		]);

		if (balancePressureMultiplier === 0) {
			return {
				balanceMargin: balance.balanceMargin,
				balanceFactor: 1,
				createsDominantStack: balance.createsDominantStack,
			};
		}

		let safeMargin = Math.max(0, balance.balanceMargin);
		let clampedMargin = Math.min(safeMargin, maxBalanceMargin);
		let pressure = maxBalanceMargin - clampedMargin + 1;

		return {
			balanceMargin: balance.balanceMargin,
			balanceFactor: 1 + (pressure - 1) * balancePressureMultiplier,
			createsDominantStack: balance.createsDominantStack,
		};
	}

	/**
	 * Calculate the short-horizon factor for one tile key.
	 *
	 * Tiles that cause the near-future simulated state to collapse earlier
	 * receive a larger factor on harder settings.
	 *
	 * @param {TileKey} tileKey
	 * @param {object} [options={}]
	 * @returns {{
	 * 	shortHorizonFactor: number,
	 * 	shortHorizonMoves: number,
	 * 	shortHorizonRemainingTiles: number,
	 * 	shortHorizonEnabled: boolean,
	 * 	shortHorizonCollapsed: boolean,
	 * }}
	 */
	getShortHorizonFactor(tileKey, options = {}) {
		let {
			shortHorizonProbeMoves,
			shortHorizonPressureMultiplier,
			pendingRemovedTileKeys,
		} = this.state.collapseOptions(options);
		let shortHorizon = this.analyzer.runShortHorizonProbe(
			[
				...pendingRemovedTileKeys,
				tileKey,
			],
			{
				shortHorizonProbeMoves,
				shortHorizonPressureMultiplier,
			}
		);

		return {
			shortHorizonFactor: shortHorizon.pressure,
			shortHorizonMoves: shortHorizon.moves,
			shortHorizonRemainingTiles: shortHorizon.remainingTiles,
			shortHorizonEnabled: shortHorizon.enabled,
			shortHorizonCollapsed: shortHorizon.collapsed,
		};
	}

	/**
	 * Calculate the grouped analyzer-backed factor for one tile key.
	 *
	 * This groups factors that require hypothetical-state questions.
	 *
	 * @param {TileKey} tileKey
	 * @param {object} [options={}]
	 * @returns {{
	 * 	freedCount: number,
	 * 	analyzerFactor: number,
	 * 	openPressureFactor: number,
	 * 	balanceFactor: number,
	 * 	balanceMargin: number,
	 * 	createsDominantStack: boolean,
	 * 	shortHorizonFactor: number,
	 * 	shortHorizonMoves: number,
	 * 	shortHorizonRemainingTiles: number,
	 * 	shortHorizonEnabled: boolean,
	 * 	shortHorizonCollapsed: boolean,
	 * }}
	 */
	getAnalyzerFactor(tileKey, options = {}) {
		let { freedCount, openPressureFactor } = this.getOpenPressureFactor(tileKey, options);
		let { balanceMargin, balanceFactor, createsDominantStack } = this.getBalanceFactor(
			tileKey,
			options
		);
		let {
			shortHorizonFactor,
			shortHorizonMoves,
			shortHorizonRemainingTiles,
			shortHorizonEnabled,
			shortHorizonCollapsed,
		} = this.getShortHorizonFactor(tileKey, options);

		return {
			freedCount,
			analyzerFactor: openPressureFactor * balanceFactor * shortHorizonFactor,
			openPressureFactor,
			balanceFactor,
			balanceMargin,
			createsDominantStack,
			shortHorizonFactor,
			shortHorizonMoves,
			shortHorizonRemainingTiles,
			shortHorizonEnabled,
			shortHorizonCollapsed,
		};
	}

	/**
	 * Score the currently open tile keys, excluding any reference tile keys.
	 *
	 * This first pass is intentionally simple and assigns every eligible tile the
	 * same weight. The method exists now so later weighting logic has a stable
	 * seam to grow into.
	 *
	 * @param {TileKey[]} [referenceTileKeys=[]]
	 * @param {{difficulty?: number, minWindowRatio?: number}} [options={}]
	 * @returns {{tileKey: TileKey, weight: number}[]}
	 */
	scoreOpenTiles(referenceTileKeys = [], options = {}) {
		let resolvedOptions = this.state.collapseOptions(options);
		let referenceTileKeySet = new Set(referenceTileKeys);

		return this.rules.getOpenTiles(this.gameState)
			.filter((tileKey) => !referenceTileKeySet.has(tileKey))
			.map((tileKey) => {
				let zIndexFactor = this.getZIndexFactor(tileKey, resolvedOptions);
				let spatialRelationshipFactor = this.getSpatialRelationshipFactor(
					tileKey,
					referenceTileKeys,
					resolvedOptions
				);
				let {
					freedCount,
					analyzerFactor,
					openPressureFactor,
					balanceFactor,
					balanceMargin,
					createsDominantStack,
					shortHorizonFactor,
					shortHorizonMoves,
					shortHorizonRemainingTiles,
					shortHorizonEnabled,
					shortHorizonCollapsed,
				} = this.getAnalyzerFactor(
					tileKey,
					resolvedOptions
				);

				return {
					tileKey,
					z: this.gameState.getPosition(tileKey)?.z ?? -1,
					zIndexFactor,
					horizontalIntersections: this.gameState.countHorizontalIntersections(
						referenceTileKeys,
						tileKey
					),
					depthIntersections: this.gameState.countDepthIntersections(
						referenceTileKeys,
						tileKey
					),
					freedCount,
					analyzerFactor,
					openPressureFactor,
					balanceFactor,
					balanceMargin,
					createsDominantStack,
					shortHorizonFactor,
					shortHorizonMoves,
					shortHorizonRemainingTiles,
					shortHorizonEnabled,
					shortHorizonCollapsed,
					spatialRelationshipFactor,
					weight: zIndexFactor * spatialRelationshipFactor * analyzerFactor,
				};
			});
	}

	/**
	 * Build the difficulty-shaped selection window for scored tiles.
	 *
	 * This mirrors the live engine shape, but remains intentionally lightweight
	 * for now.
	 *
	 * @param {{tileKey: TileKey, weight: number}[]} scoredTiles
	 * @param {{difficulty?: number, minWindowRatio?: number}} [options={}]
	 * @returns {{window: {tileKey: TileKey, weight: number}[], start: number, end: number, size: number, count: number, difficulty: number}}
	 */
	getDifficultyWindowDetails(scoredTiles, options = {}) {
		let { difficulty, minWindowRatio } = this.state.collapseOptions(options);
		difficulty = Math.max(0, Math.min(1, difficulty));
		minWindowRatio = Math.max(0, Math.min(1, minWindowRatio));
		let count = scoredTiles.length;

		if (count === 0) {
			return {
				window: [],
				start: 0,
				end: 0,
				size: 0,
				count,
				difficulty,
			};
		}

		let edgePressure = Math.abs(difficulty - 0.5) * 2;
		let windowRatio = 1 - edgePressure * (1 - minWindowRatio);
		let windowSize = Math.max(1, Math.ceil(count * windowRatio));
		let start = Math.round((count - windowSize) * difficulty);

		return {
			window: scoredTiles.slice(start, start + windowSize),
			start,
			end: start + windowSize,
			size: windowSize,
			count,
			difficulty,
		};
	}

	/**
	 * Pick one scored tile from the current difficulty window.
	 *
	 * @param {{tileKey: TileKey, weight: number}[]} scoredTiles
	 * @param {{difficulty?: number, minWindowRatio?: number}} [options={}]
	 * @returns {{tileKey: TileKey, weight: number} | false}
	 */
	pickWeightedTileFromScores(scoredTiles, options = {}) {
		let windowDetails = this.getDifficultyWindowDetails(scoredTiles, options);
		let window = windowDetails.window;

		if (window.length === 0) {
			return false;
		}

		return Random.chooseOne(window);
	}

	/**
	 * Pick one scored tile from the currently open tile keys.
	 *
	 * @param {TileKey[]} [referenceTileKeys=[]]
	 * @param {{difficulty?: number, minWindowRatio?: number}} [options={}]
	 * @returns {{tileKey: TileKey, weight: number} | false}
	 */
	pickWeightedTile(referenceTileKeys = [], options = {}) {
		let scoredTiles = this.scoreOpenTiles(referenceTileKeys, options);

		return this.pickWeightedTileFromScores(scoredTiles, options);
	}

	/**
	 * Choose one open tile key, excluding any reference tile keys.
	 *
	 * @param {TileKey[]} [referenceTileKeys=[]]
	 * @returns {TileKey}
	 */
	pickTile(referenceTileKeys = []) {
		let selected = this.pickWeightedTile(referenceTileKeys);

		if (!selected) {
			throw new Error('Unable to find an eligible open tile during generation');
		}

		return selected.tileKey;
	}
}
