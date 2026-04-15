import NumberSet from '../../src/gc/utils/NumberSet.js';
import Grid from './Grid.js';

/**
 * Use this class to represent Mahjongg-specific state layered on top of the
 * generic grid occupancy model.
 *
 * This layer should be the only layer that talks directly to `Grid`.
 * It owns Mahjongg tile identity, board definition, and face data without yet
 * deciding gameplay legality.
 */
export default class GameState {
	/**
	 * Create Mahjongg game state layered on top of an optional occupancy grid.
	 *
	 * @param {Grid | null} [grid=null]
	 */
	constructor(grid = null) {
		this.grid = grid;
		this.boardNbr = -1;
		this.layout = null;
		this.board = null;
		this.solution = [];
		this.placedTiles = new NumberSet([]);
	}

	/**
	 * Attach the occupancy grid used by this game state.
	 *
	 * @param {Grid | null} grid
	 * @returns {GameState}
	 */
	setGrid(grid) {
		this.grid = grid;
		return this;
	}

	/**
	 * Set the game number associated with this board instance.
	 *
	 * @param {number} boardNbr
	 * @returns {GameState}
	 */
	setBoardNbr(boardNbr) {
		this.boardNbr = boardNbr;
		return this;
	}

	/**
	 * Return the configured game number.
	 *
	 * @returns {number}
	 */
	getBoardNbr() {
		return this.boardNbr;
	}

	/**
	 * Attach the layout definition used to build the board.
	 *
	 * @param {Layout | null} layout
	 * @returns {GameState}
	 */
	setLayout(layout) {
		this.layout = layout;
		return this;
	}

	/**
	 * Return the active layout definition.
	 *
	 * @returns {Layout | null}
	 */
	getLayout() {
		return this.layout;
	}

	/**
	 * Set the current board record directly.
	 *
	 * @param {Board | null} board
	 * @returns {GameState}
	 */
	setBoard(board) {
		this.board = board;
		return this;
	}

	/**
	 * Return the active board record.
	 *
	 * @returns {Board | null}
	 */
	getBoard() {
		return this.board;
	}

	/**
	 * Store generation metadata describing one known solution path.
	 *
	 * @param {TileKey[]} solution
	 * @returns {GameState}
	 */
	setSolution(solution) {
		this.solution = solution || [];
		return this;
	}

	/**
	 * Build a fresh board from the current layout and clear transient occupancy.
	 *
	 * @returns {GameState}
	 */
	configureBoard() {
		if (!this.layout) {
			return this;
		}

		this.board = {
			count: this.layout.tiles,
			pieces: [],
		};
		this.placedTiles = new NumberSet([]);

		for (let tileKey = 0; tileKey < this.layout.tiles; tileKey++) {
			this.board.pieces[tileKey] = {
				pos: this.layout.positions[tileKey],
				face: -1,
			};
		}

		if (this.grid) {
			this.grid.clear();
		}

		return this;
	}

	/**
	 * Assign a face to a tile on the configured board.
	 *
	 * @param {TileKey} tileKey
	 * @param {Face} face
	 * @returns {GameState}
	 */
	setFace(tileKey, face) {
		let piece = this.getPiece(tileKey);

		if (piece) {
			piece.face = face;
		}

		return this;
	}

	/**
	 * Return the board piece record for a tile id.
	 *
	 * @param {TileKey} tileKey
	 * @returns {Piece | null}
	 */
	getPiece(tileKey) {
		return this.board?.pieces?.[tileKey] || null;
	}

	/**
	 * Return the board position for a tile id.
	 *
	 * @param {TileKey} tileKey
	 * @returns {TilePosition | null}
	 */
	getPosition(tileKey) {
		return this.getPiece(tileKey)?.pos || null;
	}

	/**
	 * Return the assigned face for a tile id.
	 *
	 * @param {TileKey} tileKey
	 * @returns {Face}
	 */
	getFace(tileKey) {
		let piece = this.getPiece(tileKey);
		return piece ? piece.face : -1;
	}

	/**
	 * Return the Mahjongg footprint occupied by a tile.
	 *
	 * @param {TileKey} tileKey
	 * @returns {GridBox | null}
	 */
	getTileFootprint(tileKey) {
		let position = this.getPosition(tileKey);

		if (!position) {
			return null;
		}

		return {
			x: position.x,
			y: position.y,
			z: position.z,
			width: 2,
			height: 2,
			depth: 1,
		};
	}

	/**
	 * Return the stack-group key for one tile.
	 *
	 * Tiles with the same x/y origin belong to the same stack group.
	 *
	 * @param {TileKey} tileKey
	 * @returns {string}
	 */
	getStackKey(tileKey) {
		let position = this.getPosition(tileKey);

		if (!position) {
			return '';
		}

		return `${position.x}:${position.y}`;
	}

	/**
	 * Test whether two tile footprints overlap in x/y space.
	 *
	 * @param {TileKey} leftTileKey
	 * @param {TileKey} rightTileKey
	 * @returns {boolean}
	 */
	hasFootprintOverlap(leftTileKey, rightTileKey) {
		let left = this.getTileFootprint(leftTileKey);
		let right = this.getTileFootprint(rightTileKey);

		if (!left || !right) {
			return false;
		}

		return left.x < right.x + right.width
			&& left.x + left.width > right.x
			&& left.y < right.y + right.height
			&& left.y + left.height > right.y;
	}

	/**
	 * Count same-level x/y footprint intersections against reference tiles.
	 *
	 * @param {TileKey[]} referenceTileKeys
	 * @param {TileKey} tileKey
	 * @returns {number}
	 */
	countHorizontalIntersections(referenceTileKeys, tileKey) {
		let position = this.getPosition(tileKey);

		if (!position) {
			return 0;
		}

		return referenceTileKeys.filter((referenceTileKey) => {
			if (referenceTileKey === tileKey) {
				return false;
			}

			let referencePosition = this.getPosition(referenceTileKey);

			return referencePosition
				&& referencePosition.z === position.z
				&& this.hasFootprintOverlap(referenceTileKey, tileKey);
		}).length;
	}

	/**
	 * Count x/y footprint intersections against reference tiles across z depth.
	 *
	 * @param {TileKey[]} referenceTileKeys
	 * @param {TileKey} tileKey
	 * @returns {number}
	 */
	countDepthIntersections(referenceTileKeys, tileKey) {
		return referenceTileKeys.filter((referenceTileKey) => {
			return referenceTileKey !== tileKey
				&& this.hasFootprintOverlap(referenceTileKey, tileKey);
		}).length;
	}

	/**
	 * Check whether one grid point is occupied in the attached grid.
	 *
	 * @param {GridPoint} point
	 * @returns {boolean}
	 */
	isOccupied(point) {
		return this.grid?.has(point) || false;
	}

	/**
	 * Check whether a box intersects occupied space in the attached grid.
	 *
	 * @param {GridBox} box
	 * @returns {boolean}
	 */
	intersects(box) {
		return this.grid?.intersects(box) || false;
	}

	/**
	 * Check whether a tile has occupied space directly to its left.
	 *
	 * @param {TileKey} tileKey
	 * @returns {boolean}
	 */
	hasLeftAdjacent(tileKey) {
		let position = this.getPosition(tileKey);

		if (!position) {
			return false;
		}

		let {x, y, z} = position;

		return this.isOccupied({x: x - 1, y, z})
			|| this.isOccupied({x: x - 1, y: y + 1, z});
	}

	/**
	 * Check whether a tile has occupied space directly to its right.
	 *
	 * @param {TileKey} tileKey
	 * @returns {boolean}
	 */
	hasRightAdjacent(tileKey) {
		let position = this.getPosition(tileKey);

		if (!position) {
			return false;
		}

		let {x, y, z} = position;

		return this.isOccupied({x: x + 2, y, z})
			|| this.isOccupied({x: x + 2, y: y + 1, z});
	}

	/**
	 * Check whether a tile has occupied space directly above it.
	 *
	 * @param {TileKey} tileKey
	 * @returns {boolean}
	 */
	hasAboveAdjacent(tileKey) {
		let footprint = this.getTileFootprint(tileKey);

		if (!footprint) {
			return false;
		}

		return this.intersects({
			...footprint,
			z: footprint.z + 1,
		});
	}

	/**
	 * Check whether a tile has occupied space directly below it.
	 *
	 * @param {TileKey} tileKey
	 * @returns {boolean}
	 */
	hasBelowAdjacent(tileKey) {
		let footprint = this.getTileFootprint(tileKey);

		if (!footprint) {
			return false;
		}

		return this.intersects({
			...footprint,
			z: footprint.z - 1,
		});
	}

	/**
	 * Check whether a tile is currently placed on the board.
	 *
	 * @param {TileKey} tileKey
	 * @returns {boolean}
	 */
	hasTile(tileKey) {
		return this.placedTiles.has(tileKey);
	}

	/**
	 * Iterate over every tile slot in the configured board.
	 *
	 * @param {(tileKey: TileKey, piece: Piece | null) => void} callback
	 * @returns {void}
	 */
	forEachTile(callback) {
		let count = this.board?.count || 0;

		for (let tileKey = 0; tileKey < count; tileKey++) {
			callback(tileKey, this.getPiece(tileKey));
		}
	}

	/**
	 * Return the total number of tile slots defined by the board.
	 *
	 * @returns {number}
	 */
	getBoardCount() {
		return this.board?.count || 0;
	}

	/**
	 * Return the current board height derived from tile positions.
	 *
	 * This is the highest occupied z level plus one, matching the live tile
	 * picker's notion of board depth for z-based weighting.
	 *
	 * @returns {number}
	 */
	getGridHeight() {
		let height = 1;

		this.forEachTile((tileKey, piece) => {
			let z = piece?.pos?.z;

			if (typeof z === 'number') {
				height = Math.max(height, z + 1);
			}
		});

		return height;
	}

	/**
	 * Count how many tiles are currently placed on the board.
	 *
	 * @returns {number}
	 */
	getPlacedTileCount() {
		let count = 0;

		for (let tileKey = 0; tileKey < this.getBoardCount(); tileKey++) {
			if (this.hasTile(tileKey)) {
				count++;
			}
		}

		return count;
	}

	/**
	 * Place a tile onto the board and mark its footprint occupied.
	 *
	 * @param {TileKey} tileKey
	 * @returns {GameState}
	 */
	placeTile(tileKey) {
		let piece = this.getPiece(tileKey);
		let footprint = this.getTileFootprint(tileKey);

		if (!piece || !footprint) {
			return this;
		}

		this.placedTiles.include(tileKey);
		this.grid?.add(footprint);

		return this;
	}

	/**
	 * Remove a tile from the board and release its occupied footprint.
	 *
	 * @param {TileKey} tileKey
	 * @returns {GameState}
	 */
	removeTile(tileKey) {
		let piece = this.getPiece(tileKey);
		let footprint = this.getTileFootprint(tileKey);

		if (!piece || !footprint) {
			return this;
		}

		this.placedTiles.exclude(tileKey);
		this.grid?.subtract(footprint);

		return this;
	}

	/**
	 * Clone this game state and its mutable occupancy collections.
	 *
	 * The board and layout references remain shared for now.
	 *
	 * @returns {GameState}
	 */
	clone() {
		let nextGrid = null;

		if (this.grid) {
			nextGrid = new Grid();
			nextGrid.occupied = this.grid.occupied.map((rows = []) => {
				return rows.map((row) => {
					let copy = new NumberSet([], row.length);
					copy.union(row);
					return copy;
				});
			});
		}

		let next = new GameState(nextGrid);

		next.boardNbr = this.boardNbr;
		next.layout = this.layout;
		next.board = this.board;
		next.solution = this.solution.slice();
		next.placedTiles = new NumberSet([]).union(this.placedTiles);

		return next;
	}
}
