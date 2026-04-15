/**
 * Use this class to represent Mahjongg business logic interpreted over game
 * state and grid state.
 *
 * This layer should know what Mahjongg means, but it should not own mutation
 * history or board-generation policy.
 */
export default class GameRules {
	/**
	 * Check whether two Mahjongg faces belong to the same matching group.
	 *
	 * @param {Face} face1
	 * @param {Face} face2
	 * @returns {boolean}
	 */
	doFacesMatch(face1, face2) {
		if (face1 < 0 || face2 < 0) {
			return false;
		}

		return Math.floor(face1 / 4) === Math.floor(face2 / 4);
	}

	/**
	 * Check whether a tile is open under Mahjongg solitaire rules.
	 *
	 * @param {GameState | null} gameState
	 * @param {TileKey} tileKey
	 * @returns {boolean}
	 */
	isTileOpen(gameState, tileKey) {
		if (!gameState?.hasTile(tileKey)) {
			return false;
		}

		if (!gameState.getPosition(tileKey)) {
			return false;
		}

		return !gameState.hasAboveAdjacent(tileKey)
			&& (!gameState.hasLeftAdjacent(tileKey) || !gameState.hasRightAdjacent(tileKey));
	}

	/**
	 * Check whether two tiles form a playable pair.
	 *
	 * @param {GameState | null} gameState
	 * @param {TileKey} tileKey1
	 * @param {TileKey} tileKey2
	 * @returns {boolean}
	 */
	isPlayablePair(gameState, tileKey1, tileKey2) {
		return tileKey1 !== tileKey2
			&& this.isTileOpen(gameState, tileKey1)
			&& this.isTileOpen(gameState, tileKey2)
			&& this.doFacesMatch(gameState.getFace(tileKey1), gameState.getFace(tileKey2));
	}

	/**
	 * Return all open tiles on the board.
	 *
	 * @param {GameState | null} gameState
	 * @returns {TileKey[]}
	 */
	getOpenTiles(gameState) {
		let openTileKeys = [];
		let count = gameState?.getBoardCount?.() || 0;

		for (let tileKey = 0; tileKey < count; tileKey++) {
			if (this.isTileOpen(gameState, tileKey)) {
				openTileKeys.push(tileKey);
			}
		}

		return openTileKeys;
	}

	/**
	 * Return all playable pairs, optionally constrained to one selected tile.
	 *
	 * @param {GameState | null} gameState
	 * @param {TileKey} [selectedTileKey=-1]
	 * @returns {TilePair[]}
	 */
	getPlayablePairs(gameState, selectedTileKey = -1) {
		let pairs = [];
		let count = gameState?.getBoardCount?.() || 0;

		if (selectedTileKey !== -1) {
			for (let tileKey = 0; tileKey < count; tileKey++) {
				if (this.isPlayablePair(gameState, selectedTileKey, tileKey)) {
					pairs.push({tile1: selectedTileKey, tile2: tileKey});
				}
			}

			return pairs;
		}

		for (let outerTileKey = 0; outerTileKey < count; outerTileKey++) {
			for (let innerTileKey = outerTileKey + 1; innerTileKey < count; innerTileKey++) {
				if (this.isPlayablePair(gameState, outerTileKey, innerTileKey)) {
					pairs.push({tile1: outerTileKey, tile2: innerTileKey});
				}
			}
		}

		return pairs;
	}

	/**
	 * Check whether at least one playable pair remains.
	 *
	 * @param {GameState | null} gameState
	 * @returns {boolean}
	 */
	hasPlayablePairs(gameState) {
		return this.getPlayablePairs(gameState).length > 0;
	}

	/**
	 * Check whether the board has been completely cleared.
	 *
	 * @param {GameState | null} gameState
	 * @returns {boolean}
	 */
	isWon(gameState) {
		return Boolean(gameState) && gameState.getPlacedTileCount() === 0;
	}

	/**
	 * Check whether the board is not yet won and has no playable pairs left.
	 *
	 * @param {GameState | null} gameState
	 * @returns {boolean}
	 */
	isLost(gameState) {
		return !this.isWon(gameState) && !this.hasPlayablePairs(gameState);
	}
}
