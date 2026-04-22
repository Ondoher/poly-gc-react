/**
 * Analyze hypothetical move-graph questions against copied game state.
 *
 * This class keeps temporary-state questions out of `GameRules` and
 * `TilePicker`. It answers questions by cloning the current `GameState`,
 * applying hypothetical removals, and then asking normal rule questions
 * against that copied state.
 */
export default class StateGraphAnalyzer {
	/**
	 * @param {GameRules} rules
	 * @param {GameState} gameState
	 * @param {GameState | null} [analyzedState=null]
	 */
	constructor(rules, gameState, analyzedState = null) {
		/**
		 * Stateless Mahjongg rules used to interpret copied state.
		 *
		 * @type {GameRules}
		 */
		this.rules = rules;

		/**
		 * Source game state used to build hypothetical copies.
		 *
		 * @type {GameState}
		 */
		this.gameState = gameState;

		/**
		 * The specific state instance currently being analyzed.
		 *
		 * This starts as the source state and can become a copied hypothetical
		 * state through chaining helpers such as `withRemovedTiles(...)`.
		 *
		 * @type {GameState}
		 */
		this.analyzedState = analyzedState || gameState;
	}

	/**
	 * Return the source state for this analyzer.
	 *
	 * @returns {GameState}
	 */
	getSourceState() {
		return this.gameState;
	}

	/**
	 * Return the currently analyzed state.
	 *
	 * @returns {GameState}
	 */
	getAnalyzedState() {
		return this.analyzedState;
	}

	/**
	 * Clone the source game state.
	 *
	 * @returns {GameState}
	 */
	createStateCopy() {
		return this.gameState.clone();
	}

	/**
	 * Clone the currently analyzed state.
	 *
	 * @returns {GameState}
	 */
	createAnalyzedStateCopy() {
		return this.analyzedState.clone();
	}

	/**
	 * Clone state and remove one or more tile keys from the copy.
	 *
	 * @param {TileKey[]} [removedTileKeys=[]]
	 * @returns {GameState}
	 */
	createStateCopyWithRemovedTiles(removedTileKeys = []) {
		let gameStateCopy = this.createAnalyzedStateCopy();

		removedTileKeys.forEach((tileKey) => {
			gameStateCopy.removeTile(tileKey);
		});

		return gameStateCopy;
	}

	/**
	 * Return a new analyzer chained to a copied state with hypothetical removals
	 * applied.
	 *
	 * @param {TileKey[]} [removedTileKeys=[]]
	 * @returns {StateGraphAnalyzer}
	 */
	withRemovedTiles(removedTileKeys = []) {
		return new StateGraphAnalyzer(
			this.rules,
			this.gameState,
			this.createStateCopyWithRemovedTiles(removedTileKeys)
		);
	}

	/**
	 * Pick the deterministic tile pair used for a short-horizon probe step.
	 *
	 * Lower tiles are preferred first, with tile key as the tie-breaker.
	 *
	 * @param {TileKey[]} openTileKeys
	 * @returns {TileKey[]}
	 */
	pickShortHorizonProbePair(openTileKeys) {
		return openTileKeys.slice().sort((left, right) => {
			let leftZ = this.analyzedState.getPosition(left)?.z ?? Number.MAX_SAFE_INTEGER;
			let rightZ = this.analyzedState.getPosition(right)?.z ?? Number.MAX_SAFE_INTEGER;

			return leftZ - rightZ || left - right;
		}).slice(0, 2);
	}

	/**
	 * Convert short-horizon collapse into a pressure multiplier.
	 *
	 * @param {number} moves
	 * @param {boolean} collapsed
	 * @param {ShortHorizonProbeOptions} [options={}]
	 * @returns {number}
	 */
	getShortHorizonPressure(moves, collapsed, options = {}) {
		let multiplier = options.shortHorizonPressureMultiplier ?? 0;

		if (multiplier === 0 || !collapsed) {
			return 1;
		}

		let probeMoves = Math.max(1, options.shortHorizonProbeMoves ?? 1);
		let pressure = probeMoves - Math.min(moves, probeMoves) + 1;

		return 1 + (pressure - 1) * multiplier;
	}

	/**
	 * Simulate a few deterministic removals after hypothetical candidate
	 * removals. Early collapse increases hard-side pressure.
	 *
	 * @param {TileKey[]} [removedTileKeys=[]]
	 * @param {ShortHorizonProbeOptions} [options={}]
	 * @returns {ShortHorizonProbeResult}
	 */
	runShortHorizonProbe(removedTileKeys = [], options = {}) {
		let probeMoves = options.shortHorizonProbeMoves ?? 0;

		if (probeMoves <= 0 || removedTileKeys.length < 2) {
			return {
				enabled: false,
				collapsed: false,
				moves: 0,
				remainingTiles: 0,
				pressure: 1,
			};
		}

		let hypothetical = this.withRemovedTiles(removedTileKeys);

		for (let move = 0; move < probeMoves; move++) {
			let remainingTiles = hypothetical.getAnalyzedState().getPlacedTileCount();

			if (remainingTiles === 0) {
				return {
					enabled: true,
					collapsed: false,
					moves: move,
					remainingTiles,
					pressure: 1,
				};
			}

			let openTileKeys = hypothetical.getOpenTileKeys();

			if (openTileKeys.length < 2) {
				return {
					enabled: true,
					collapsed: true,
					moves: move,
					remainingTiles,
					pressure: hypothetical.getShortHorizonPressure(move, true, options),
				};
			}

			let tilePair = hypothetical.pickShortHorizonProbePair(openTileKeys);

			hypothetical = hypothetical.withRemovedTiles(tilePair);
		}

		return {
			enabled: true,
			collapsed: false,
			moves: probeMoves,
			remainingTiles: hypothetical.getAnalyzedState().getPlacedTileCount(),
			pressure: hypothetical.getShortHorizonPressure(probeMoves, false, options),
		};
	}

	/**
	 * Return open tile keys for the currently analyzed state.
	 *
	 * @returns {TileKey[]}
	 */
	getOpenTileKeys() {
		return this.rules.getOpenTiles(this.analyzedState);
	}

	/**
	 * Summarize the current stack landscape of the analyzed state.
	 *
	 * `balanceMargin` is other stack groups minus the tallest stack height. A
	 * negative margin means the tallest stack dominates the remaining board.
	 *
	 * @returns {StackBalanceSummary}
	 */
	getStackBalance() {
		let stackCounts = {};
		let groupCount = 0;

		for (let tileKey = 0; tileKey < this.analyzedState.getBoardCount(); tileKey++) {
			if (!this.analyzedState.hasTile(tileKey)) {
				continue;
			}

			let key = this.analyzedState.getStackKey(tileKey);

			if (stackCounts[key] === undefined) {
				stackCounts[key] = 0;
				groupCount++;
			}

			stackCounts[key]++;
		}

		if (groupCount === 0) {
			return {
				stackGroupCount: 0,
				maxStackHeight: 0,
				otherStackGroupCount: 0,
				balanceMargin: 0,
				createsDominantStack: false,
			};
		}

		let maxStackHeight = Math.max(...Object.values(stackCounts));
		let otherStackGroupCount = groupCount - 1;
		let balanceMargin = otherStackGroupCount - maxStackHeight;

		return {
			stackGroupCount: groupCount,
			maxStackHeight,
			otherStackGroupCount,
			balanceMargin,
			createsDominantStack: balanceMargin < 0,
		};
	}

	/**
	 * Return open tile keys after hypothetical removals.
	 *
	 * @param {TileKey[]} [removedTileKeys=[]]
	 * @returns {TileKey[]}
	 */
	getOpenTileKeysAfterRemoving(removedTileKeys = []) {
		return this.withRemovedTiles(removedTileKeys).getOpenTileKeys();
	}

	/**
	 * Count tiles that become newly open after hypothetical removals.
	 *
	 * @param {TileKey[]} [removedTileKeys=[]]
	 * @returns {number}
	 */
	countTilesFreedByRemoving(removedTileKeys = []) {
		let openBefore = new Set(this.getOpenTileKeys());
		let openAfter = this.withRemovedTiles(removedTileKeys).getOpenTileKeys();

		return openAfter.filter((tileKey) => !openBefore.has(tileKey)).length;
	}

	/**
	 * Return playable pairs for the currently analyzed state.
	 *
	 * @returns {TilePair[]}
	 */
	getPlayablePairs() {
		return this.rules.getPlayablePairs(this.analyzedState);
	}

	/**
	 * Return playable pairs after hypothetical removals.
	 *
	 * @param {TileKey[]} [removedTileKeys=[]]
	 * @returns {TilePair[]}
	 */
	getPlayablePairsAfterRemoving(removedTileKeys = []) {
		return this.withRemovedTiles(removedTileKeys).getPlayablePairs();
	}

	/**
	 * Return the stack-balance summary after hypothetical removals.
	 *
	 * @param {TileKey[]} [removedTileKeys=[]]
	 * @returns {StackBalanceSummary}
	 */
	getStackBalanceAfterRemoving(removedTileKeys = []) {
		return this.withRemovedTiles(removedTileKeys).getStackBalance();
	}

	/**
	 * Check whether the currently analyzed state has any playable pairs.
	 *
	 * @returns {boolean}
	 */
	hasPlayablePairs() {
		return this.rules.hasPlayablePairs(this.analyzedState);
	}

	/**
	 * Check whether at least one playable pair remains after hypothetical
	 * removals.
	 *
	 * @param {TileKey[]} [removedTileKeys=[]]
	 * @returns {boolean}
	 */
	hasPlayablePairsAfterRemoving(removedTileKeys = []) {
		return this.withRemovedTiles(removedTileKeys).hasPlayablePairs();
	}

	/**
	 * Check whether the currently analyzed state is lost.
	 *
	 * @returns {boolean}
	 */
	isLost() {
		return this.rules.isLost(this.analyzedState);
	}

	/**
	 * Check whether the board would be lost after hypothetical removals.
	 *
	 * @param {TileKey[]} [removedTileKeys=[]]
	 * @returns {boolean}
	 */
	isLostAfterRemoving(removedTileKeys = []) {
		return this.withRemovedTiles(removedTileKeys).isLost();
	}
}
