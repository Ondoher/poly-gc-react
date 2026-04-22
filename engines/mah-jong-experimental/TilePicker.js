import StateGraphAnalyzer from './StateGraphAnalyzer.js';
import {
	getRankedWindow,
	selectRankedCandidate,
} from './ranked-window.js';

/**
 * Rank and select open tile keys from a working game state during generation.
 */
export default class TilePicker {
	/**
	 * @param {GameRules} rules
	 * @param {GeneratorState} state
	 */
	constructor(rules, state) {
		/**
		 * Rules helper used to discover currently open tile keys.
		 *
		 * @type {GameRules}
		 */
		this.rules = rules;

		/**
		 * Working game state used for open-tile queries.
		 *
		 * @type {GeneratorState}
		 */
		this.gameState = state;

		/**
		 * Generator-facing state used for ranking settings.
		 *
		 * @type {GeneratorState}
		 */
		this.state = state;

		/**
		 * Hypothetical-state analyzer used for graph-style factor questions.
		 *
		 * @type {StateGraphAnalyzer}
		 */
		this.analyzer = new StateGraphAnalyzer(rules, state);
	}

	/**
	 * Calculate the z-index factor for one tile key.
	 *
	 * During backward generation, this biases selection by stack height so the
	 * picker can prefer or avoid exposing lower layers according to the current
	 * difficulty settings. Higher `z` tiles produce less pressure because they
	 * are already near the top of their stack.
	 *
	 * @param {TileKey} tileKey
	 * @returns {number}
	 */
	getZIndexFactor(tileKey) {
		let highestZOrder = this.state.getHighestZOrder();
		let position = this.gameState.getPosition(tileKey);

		if (!position) {
			return 1;
		}

		return Math.max(1, highestZOrder - position.z);
	}

	/**
	 * Calculate how strongly one candidate relates to the current reference
	 * tiles.
	 *
	 * When selecting the second tile in a generated tile pair, the first tile
	 * becomes the reference. This factor lets the picker shape how much it cares
	 * about candidates that overlap the same horizontal rows or depth lanes as
	 * already selected tiles.
	 *
	 * @param {TileKey} tileKey
	 * @param {TileKey[]} [referenceTileKeys=[]]
	 * @returns {number}
	 */
	getSpatialRelationshipFactor(tileKey, referenceTileKeys = []) {
		let horizontalMultiplier = this.state.getHorizontalMultiplier();
		let depthMultiplier = this.state.getDepthMultiplier();
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
	 * This asks, "If we remove this candidate, how many additional tiles become
	 * available?" Candidates that free fewer tiles can be weighted more heavily
	 * on harder settings because they keep the generated solution path tighter
	 * and leave fewer easy future choices.
	 *
	 * @param {TileKey} tileKey
	 * @param {TileKey[]} [pendingRemovedTileKeys=[]]
	 * @returns {OpenPressureFactor}
	 */
	getOpenPressureFactor(tileKey, pendingRemovedTileKeys = []) {
		let openPressureMultiplier = this.state.getOpenPressureMultiplier();
		let maxFreedPressure = this.state.getMaxFreedPressure();
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
	 * This estimates whether removing the candidate would leave one stack group
	 * dominating the remaining board. The factor captures that pressure so the
	 * picker can either score the shape or, later, reject dangerous stack states
	 * outright.
	 *
	 * @param {TileKey} tileKey
	 * @param {TileKey[]} [pendingRemovedTileKeys=[]]
	 * @returns {BalanceFactor}
	 */
	getBalanceFactor(tileKey, pendingRemovedTileKeys = []) {
		let balancePressureMultiplier = this.state.getBalancePressureMultiplier();
		let maxBalanceMargin = this.state.getMaxBalanceMargin();
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
	 * This performs a small hypothetical lookahead after removing the candidate.
	 * If the near-future board runs out of playable pairs before it clears, the
	 * candidate gets pressure metadata that can steer generation away from
	 * fragile local choices.
	 *
	 * @param {TileKey} tileKey
	 * @param {TileKey[]} [pendingRemovedTileKeys=[]]
	 * @returns {ShortHorizonFactor}
	 */
	getShortHorizonFactor(tileKey, pendingRemovedTileKeys = []) {
		let shortHorizonProbeMoves = this.state.getShortHorizonProbeMoves();
		let shortHorizonPressureMultiplier = this.state.getShortHorizonPressureMultiplier();
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
	 * Calculate the combined risk/pressure score for one candidate.
	 *
	 * The analyzer-backed factors all need copied-board questions: what opens
	 * after removal, how balanced the remaining stacks are, and whether a short
	 * lookahead can keep making legal moves. This method gathers those related
	 * signals and multiplies their factors into one contribution for the final
	 * tile weight while preserving each sub-result for debugging and telemetry.
	 *
	 * @param {TileKey} tileKey
	 * @param {TileKey[]} [pendingRemovedTileKeys=[]]
	 * @returns {AnalyzerFactor}
	 */
	getAnalyzerFactor(tileKey, pendingRemovedTileKeys = []) {
		let { freedCount, openPressureFactor } = this.getOpenPressureFactor(
			tileKey,
			pendingRemovedTileKeys
		);
		let { balanceMargin, balanceFactor, createsDominantStack } = this.getBalanceFactor(
			tileKey,
			pendingRemovedTileKeys
		);
		let {
			shortHorizonFactor,
			shortHorizonMoves,
			shortHorizonRemainingTiles,
			shortHorizonEnabled,
			shortHorizonCollapsed,
		} = this.getShortHorizonFactor(tileKey, pendingRemovedTileKeys);

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
	 * Rank every eligible open tile for structural generation.
	 *
	 * The rank combines elevation, spatial relationship to any already selected
	 * reference tiles, and analyzer-backed board-pressure signals. The result is
	 * not a final decision by itself; it is the ordered candidate list consumed
	 * by the difficulty window and random selection steps.
	 *
	 * @param {TileKey[]} [referenceTileKeys=[]]
	 * @returns {RankedTileCandidate[]}
	 */
	rankOpenTiles(referenceTileKeys = []) {
		let referenceTileKeySet = new Set(referenceTileKeys);
		let unavailableTileKeySet = new Set(this.state.unavailableTiles ?? []);

		let rankedTiles = this.rules.getOpenTiles(this.gameState)
			.filter((tileKey) => !referenceTileKeySet.has(tileKey))
			.filter((tileKey) => !unavailableTileKeySet.has(tileKey))
			.map((tileKey) => {
				let zIndexFactor = this.getZIndexFactor(tileKey);
				let spatialRelationshipFactor = this.getSpatialRelationshipFactor(
					tileKey,
					referenceTileKeys
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
					referenceTileKeys
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

		return rankedTiles.sort((left, right) => {
			return left.weight - right.weight || left.tileKey - right.tileKey;
		});
	}

	/**
	 * Backward-compatible alias for the older scoring-stage name.
	 *
	 * @param {TileKey[]} [referenceTileKeys=[]]
	 * @returns {RankedTileCandidate[]}
	 */
	scoreOpenTiles(referenceTileKeys = []) {
		return this.rankOpenTiles(referenceTileKeys);
	}

	/**
	 * Build the difficulty-shaped selection window for ranked tiles.
	 *
	 * Ranked tiles are already sorted by selection pressure. This narrows the
	 * eligible slice according to difficulty: middle difficulty keeps a broader
	 * candidate set, while easier and harder settings bias toward opposite ends
	 * of the ranked list.
	 *
	 * @param {RankedTileCandidate[]} rankedTiles
	 * @returns {RankedWindow<RankedTileCandidate>}
	 */
	getDifficultyWindowDetails(rankedTiles) {
		return getRankedWindow(rankedTiles, {
			difficulty: this.state.difficulty(),
			minWindowRatio: this.state.getMinWindowRatio(),
		});
	}

	/**
	 * Select one ranked tile from the difficulty-shaped candidate window.
	 *
	 * This is the final random choice after ranking and windowing have already
	 * shaped which candidates are eligible.
	 *
	 * @param {RankedTileCandidate[]} rankedTiles
	 * @returns {RankedTileCandidate | false}
	 */
	selectRankedTile(rankedTiles) {
		return selectRankedCandidate(
			rankedTiles,
			{
				difficulty: this.state.difficulty(),
				minWindowRatio: this.state.getMinWindowRatio(),
			}
		) || false;
	}

	/**
	 * Backward-compatible alias for the older scoring/weighted-pick name.
	 *
	 * @param {RankedTileCandidate[]} scoredTiles
	 * @returns {RankedTileCandidate | false}
	 */
	pickWeightedTileFromScores(scoredTiles) {
		return this.selectRankedTile(scoredTiles);
	}

	/**
	 * Rank the currently open candidates and select one tile record.
	 *
	 * This method keeps the high-level selection path in one place: rank
	 * candidates, apply the difficulty window, then randomly choose from that
	 * window.
	 *
	 * @param {TileKey[]} [referenceTileKeys=[]]
	 * @returns {RankedTileCandidate | false}
	 */
	selectWeightedTile(referenceTileKeys = []) {
		let rankedTiles = this.rankOpenTiles(referenceTileKeys);

		return this.selectRankedTile(rankedTiles);
	}

	/**
	 * Backward-compatible alias for the older weighted-pick name.
	 *
	 * @param {TileKey[]} [referenceTileKeys=[]]
	 * @returns {RankedTileCandidate | false}
	 */
	pickWeightedTile(referenceTileKeys = []) {
		return this.selectWeightedTile(referenceTileKeys);
	}

	/**
	 * Select one open tile key for generation.
	 *
	 * This is the key-only convenience wrapper used by `GameGenerator`. Callers
	 * that need rank metadata should use `selectWeightedTile(...)` instead.
	 *
	 * @param {TileKey[]} [referenceTileKeys=[]]
	 * @returns {TileKey}
	 */
	selectTileKey(referenceTileKeys = []) {
		let selected = this.selectWeightedTile(referenceTileKeys);

		if (!selected) {
			throw new Error('Unable to find an eligible open tile during generation');
		}

		return selected.tileKey;
	}

	/**
	 * Backward-compatible alias for the older key-pick name.
	 *
	 * @param {TileKey[]} [referenceTileKeys=[]]
	 * @returns {TileKey}
	 */
	pickTile(referenceTileKeys = []) {
		return this.selectTileKey(referenceTileKeys);
	}
}
