import NumberSet from 'utils/NumberSet.js';

/**
 * Use this class to represent the primitive board-surface state that can be
 * shared by generation and runtime engine logic.
 */
export default class BoardSurfaceStateExperiment {
	constructor() {
		/**
		 * Track the game number seed that identifies the active board instance.
		 *
		 * @type {Number}
		 */
		this.boardNbr = -1;

		/**
		 * Track the active layout blueprint for the current board surface.
		 *
		 * @type {Layout|null}
		 */
		this.layout = null;

		/**
		 * Track the generated board definition that describes the pieces placed on
		 * the current board surface.
		 *
		 * @type {Board}
		 */
		this.board = {count: 0, pieces: []};

		/**
		 * Track occupied board-surface coordinates by depth and row.
		 *
		 * @type {Array.<Array.<NumberSet>>}
		 */
		this.usedSpaces = [];

		/**
		 * Track which generated tile indexes are still present on the board.
		 *
		 * @type {NumberSet}
		 */
		this.usedTiles = new NumberSet([]);

		/**
		 * Track how many tiles remain present on the board surface.
		 *
		 * @type {Number}
		 */
		this.tileCount = 0;
	}

	/**
	 * Replace the active layout.
	 *
	 * @param layout - Specify the layout that should become active.
	 */
	setLayout(layout) {
	}

	/**
	 * Replace the active board.
	 *
	 * @param board - Specify the board that should become active.
	 */
	setBoard(board) {
	}

	/**
	 * Replace the current game number seed.
	 *
	 * @param boardNbr - Specify the game number that identifies the active board.
	 */
	setBoardNbr(boardNbr) {
	}

	/**
	 * Configure a new board definition from the active layout.
	 *
	 * @returns Return the configured board definition.
	 */
	configureBoard() {
	}

	/**
	 * Reset the primitive board-surface state.
	 */
	reset() {
	}

	/**
	 * Mark a tile as occupying its board position.
	 *
	 * @param tile - Specify the tile index that should occupy the board surface.
	 */
	occupyTile(tile) {
	}

	/**
	 * Release a tile from its board position.
	 *
	 * @param tile - Specify the tile index that should be removed from the board surface.
	 */
	releaseTile(tile) {
	}

	/**
	 * Replace the face for a specific generated piece.
	 *
	 * @param tile - Specify the tile index to update.
	 * @param face - Specify the face that should be assigned to the piece.
	 */
	setFace(tile, face) {
	}

	/**
	 * Mark a specific board position as occupied by a tile.
	 *
	 * @param position - Specify the board position that should be occupied.
	 * @param tile - Specify the tile index that occupies the position.
	 */
	occupyPosition(position, tile) {
	}

	/**
	 * Release a specific board position from occupancy.
	 *
	 * @param position - Specify the board position that should be released.
	 * @param tile - Specify the tile index that no longer occupies the position.
	 */
	releasePosition(position, tile) {
	}

	/**
	 * Test whether a logical board coordinate is occupied.
	 *
	 * @param x - Specify the horizontal board coordinate.
	 * @param y - Specify the vertical board coordinate.
	 * @param z - Specify the depth layer.
	 * @returns Return whether the board coordinate is occupied.
	 */
	isUsed(x, y, z) {
	}

	/**
	 * Test whether a tile is still present on the board.
	 *
	 * @param tile - Specify the tile index to test.
	 * @returns Return whether the tile is currently present.
	 */
	hasTile(tile) {
	}

	/**
	 * Return the board piece for a tile index.
	 *
	 * @param tile - Specify the tile index to look up.
	 * @returns Return the board piece for the tile.
	 */
	getPiece(tile) {
	}

	/**
	 * Iterate through every generated tile index on the board.
	 *
	 * @param callback - Specify the callback to run for each tile index.
	 */
	forEachTile(callback) {
	}

	/**
	 * Return the board position for a tile index.
	 *
	 * @param tile - Specify the tile index to look up.
	 * @returns Return the board position for the tile.
	 */
	getPosition(tile) {
	}

	/**
	 * Return the tile face for a tile index.
	 *
	 * @param tile - Specify the tile index to look up.
	 * @returns Return the tile face for the tile.
	 */
	getFace(tile) {
	}

	/**
	 * Return the number of tiles currently present on the board.
	 *
	 * @returns Return the number of remaining tiles.
	 */
	getTileCount() {
	}

	/**
	 * Return the number of generated pieces in the current board definition.
	 *
	 * @returns Return the number of generated pieces.
	 */
	getBoardCount() {
	}
}
