import GeneratedPair from './GeneratedPair.js';
import TilePicker from './TilePicker.js';

/**
 * Orchestrate structural tile selection for generation.
 *
 * `Tiles` speaks in generator-domain terms such as selected tile pairs,
 * while `TilePicker` remains the lower-level candidate ranker and selector.
 */
export default class Tiles {
	/**
	 * @param {GameRules} rules
	 * @param {GeneratorState} state
	 * @param {TilePicker} [tilePicker=new TilePicker(rules, state)]
	 */
	constructor(rules, state, tilePicker = new TilePicker(rules, state)) {
		/**
		 * Rules helper used by lower-level tile selection.
		 *
		 * @type {GameRules}
		 */
		this.rules = rules;

		/**
		 * Shared generator state.
		 *
		 * @type {GeneratorState}
		 */
		this.state = state;

		/**
		 * Lower-level ranker and selector for tile candidates.
		 *
		 * @type {TilePicker}
		 */
		this.tilePicker = tilePicker;
	}

	/**
	 * Initialize tile-domain state for one generation run.
	 *
	 * @returns {Tiles}
	 */
	initialize() {
		return this;
	}

	/**
	 * Mark one tile as unavailable for tile selection.
	 *
	 * @param {TileKey} tileKey
	 * @returns {Tiles}
	 */
	markTileUnavailable(tileKey) {
		if (!this.state.unavailableTiles.includes(tileKey)) {
			this.state.unavailableTiles.push(tileKey);
		}

		return this;
	}

	/**
	 * Mark multiple tiles as unavailable for tile selection.
	 *
	 * @param {TileKey[]} [tileKeys=[]]
	 * @returns {Tiles}
	 */
	markTilesUnavailable(tileKeys = []) {
		tileKeys.forEach((tileKey) => {
			this.markTileUnavailable(tileKey);
		});

		return this;
	}

	/**
	 * Make one tile available for tile selection again.
	 *
	 * @param {TileKey} tileKey
	 * @returns {Tiles}
	 */
	markTileAvailable(tileKey) {
		this.state.unavailableTiles = this.state.unavailableTiles.filter((unavailableTile) => {
			return unavailableTile !== tileKey;
		});

		return this;
	}

	/**
	 * Clear all unavailable tile-selection markers.
	 *
	 * @returns {Tiles}
	 */
	clearUnavailableTiles() {
		this.state.unavailableTiles = [];

		return this;
	}

	/**
	 * Return whether one tile is unavailable for tile selection.
	 *
	 * @param {TileKey} tileKey
	 * @returns {boolean}
	 */
	isTileUnavailable(tileKey) {
		return this.state.unavailableTiles.includes(tileKey);
	}

	/**
	 * Return the currently unavailable tile keys.
	 *
	 * @returns {TileKey[]}
	 */
	getUnavailableTiles() {
		return this.state.unavailableTiles.slice();
	}

	/**
	 * Select one generated tile pair for the prepared pairs collection.
	 *
	 * Selection does not mutate generator state. `GameGenerator` owns committing
	 * the selected tile pair into prepared pairs and the working board.
	 *
	 * @returns {GeneratedPair}
	 */
	selectGeneratedPair() {
		let tile1 = this.selectTile();
		let tile2 = this.selectTile([tile1]);
		let pair = new GeneratedPair({ tile1, tile2 });

		return this.recordSoftLinks(pair);
	}

	/**
	 * Return open tiles for a graph-derived soft-link snapshot.
	 *
	 * @param {OpenTilesSoftLinkOptions} [options={}]
	 * @returns {TileKey[]}
	 */
	getOpenSoftLinkTiles(options = {}) {
		let removeTiles = options.removeTiles ?? [];
		let ignoreTiles = new Set(options.ignoreTiles ?? []);
		let analyzer = removeTiles.length > 0
			? this.tilePicker.analyzer.withRemovedTiles(removeTiles)
			: this.tilePicker.analyzer;

		return analyzer.getOpenTileKeys().filter((tileKey) => {
			return !ignoreTiles.has(tileKey);
		});
	}

	/**
	 * Record the current structural soft-link rule on a prepared pair.
	 *
	 * The only active rule records tiles that would be open after the selected
	 * pair is removed, excluding the selected pair itself.
	 *
	 * @param {GeneratedPair} pair
	 * @returns {GeneratedPair}
	 */
	recordSoftLinks(pair) {
		let tiles = this.getOpenSoftLinkTiles({
			removeTiles: pair.tiles,
			ignoreTiles: pair.tiles,
		});

		this.state.softLinks.createLink('open-tiles', {
			role: 'after-removal',
			sourceTiles: pair.tiles,
			tiles,
		});

		return pair;
	}

	/**
	 * Select one open tile key from the current working board.
	 *
	 * @param {TileKey[]} [referenceTileKeys=[]]
	 * @returns {TileKey}
	 */
	selectTile(referenceTileKeys = []) {
		return this.tilePicker.selectTileKey(referenceTileKeys);
	}

	/**
	 * Rank the current open tile candidates.
	 *
	 * @param {TileKey[]} [referenceTileKeys=[]]
	 * @returns {RankedTileCandidate[]}
	 */
	rankCandidates(referenceTileKeys = []) {
		return this.tilePicker.rankOpenTiles(referenceTileKeys);
	}

	/**
	 * Backward-compatible alias for the older scoring-stage name.
	 *
	 * @param {TileKey[]} [referenceTileKeys=[]]
	 * @returns {RankedTileCandidate[]}
	 */
	scoreCandidates(referenceTileKeys = []) {
		return this.rankCandidates(referenceTileKeys);
	}

	/**
	 * Select one weighted tile score from the current open candidates.
	 *
	 * @param {TileKey[]} [referenceTileKeys=[]]
	 * @returns {RankedTileCandidate | false}
	 */
	selectWeightedTile(referenceTileKeys = []) {
		return this.tilePicker.selectWeightedTile(referenceTileKeys);
	}
}
