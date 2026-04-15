import NumberSet from '../../src/gc/utils/NumberSet.js';

/**
 * Use this class to represent a sparse 3D occupancy grid that supports
 * set-style box mutation and point-intersection queries.
 *
 * This layer is intentionally generic. It does not know anything about:
 *
 * - Mahjongg tiles
 * - board layouts
 * - faces
 * - legal moves
 * - gameplay state
 */
export default class Grid {
	/**
	 * Create an empty sparse occupancy grid.
	 */
	constructor() {
		/**
		 * Track occupied logical coordinates by depth and row. Each stored
		 * `NumberSet` contains the occupied x positions for one `(z, y)` slice.
		 *
		 * @type {Array.<Array.<NumberSet>>}
		 */
		this.occupied = [];
	}

	/**
	 * Normalize a point-like input into a concrete grid point.
	 *
	 * @param {GridPoint} point
	 * @returns {GridPoint}
	 */
	normalizePoint(point) {
		return {
			x: point.x,
			y: point.y,
			z: point.z,
		};
	}

	/**
	 * Normalize a box-like input and default omitted dimensions to `1`.
	 *
	 * @param {GridBox} box
	 * @returns {Required<GridBox>}
	 */
	normalizeBox(box) {
		return {
			x: box.x,
			y: box.y,
			z: box.z,
			width: box.width ?? 1,
			height: box.height ?? 1,
			depth: box.depth ?? 1,
		};
	}

	/**
	 * Remove all occupied cells from the grid.
	 *
	 * @returns {void}
	 */
	clear() {
		this.occupied = [];
	}

	/**
	 * Mark every cell in the given box as occupied.
	 *
	 * @param {GridBox} box
	 * @returns {void}
	 */
	add(box) {
		let {x, y, z, width, height, depth} = this.normalizeBox(box);

		for (let depthOffset = 0; depthOffset < depth; depthOffset++) {
			let zIndex = z + depthOffset;

			this.occupied[zIndex] = this.occupied[zIndex] || [];

			for (let heightOffset = 0; heightOffset < height; heightOffset++) {
				let yIndex = y + heightOffset;
				let row = this.occupied[zIndex][yIndex] || new NumberSet([]);

				row.union(new NumberSet(
					Array.from({length: width}, (_, index) => x + index)
				));

				this.occupied[zIndex][yIndex] = row;
			}
		}
	}

	/**
	 * Release every cell in the given box from the occupied set.
	 *
	 * @param {GridBox} box
	 * @returns {void}
	 */
	subtract(box) {
		let {x, y, z, width, height, depth} = this.normalizeBox(box);

		for (let depthOffset = 0; depthOffset < depth; depthOffset++) {
			let zIndex = z + depthOffset;

			if (!this.occupied[zIndex]) {
				continue;
			}

			for (let heightOffset = 0; heightOffset < height; heightOffset++) {
				let yIndex = y + heightOffset;
				let row = this.occupied[zIndex][yIndex];

				if (!row) {
					continue;
				}

				row.difference(new NumberSet(
					Array.from({length: width}, (_, index) => x + index)
				));
			}
		}
	}

	/**
	 * Check whether a single grid point is occupied.
	 *
	 * @param {GridPoint} point
	 * @returns {boolean}
	 */
	has(point) {
		let {x, y, z} = this.normalizePoint(point);

		return Boolean(this.occupied[z]?.[y]?.has(x));
	}

	/**
	 * Check whether any occupied cell intersects the given box.
	 *
	 * @param {GridBox} box
	 * @returns {boolean}
	 */
	intersects(box) {
		let {x, y, z, width, height, depth} = this.normalizeBox(box);

		for (let depthOffset = 0; depthOffset < depth; depthOffset++) {
			for (let heightOffset = 0; heightOffset < height; heightOffset++) {
				for (let widthOffset = 0; widthOffset < width; widthOffset++) {
					if (this.has({
						x: x + widthOffset,
						y: y + heightOffset,
						z: z + depthOffset,
					})) {
						return true;
					}
				}
			}
		}

		return false;
	}
}
