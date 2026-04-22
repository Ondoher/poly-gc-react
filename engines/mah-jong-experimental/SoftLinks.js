const SOFT_LINK_TYPES = ['open-tiles', 'grouped'];

/**
 * Store and query non-structural links between tiles created during generation.
 *
 * `SoftLinks` is intentionally a simple tile-link registry. It knows that
 * links are made from tile keys, but it does not decide how a consumer should
 * interpret missing links, multiple matches, or readiness.
 */
export default class SoftLinks {
	/**
	 * @param {GeneratorState} state
	 */
	constructor(state) {
		/**
		 * Shared generator state that owns the soft-link records.
		 *
		 * @type {GeneratorState}
		 */
		this.state = state;
	}

	/**
	 * Create a soft link for the given tile keys.
	 *
	 * @param {SoftLinkType} type
	 * @param {Omit<SoftLinkInit, 'type'>} link
	 * @returns {SoftLink}
	 */
	createLink(type, link) {
		return this.create({
			...link,
			type,
		});
	}

	/**
	 * Create one soft-link record.
	 *
	 * @param {SoftLinkInit} link
	 * @returns {SoftLink}
	 */
	create(link) {
		this.validateLink(link);

		let record = {
			...link,
			id: this.state.nextSoftLinkId++,
			tiles: link.tiles.slice(),
		};

		if (link.sourceTiles) {
			record.sourceTiles = link.sourceTiles.slice();
		}

		this.state.softLinkRecords.push(record);

		return record;
	}

	/**
	 * Append tiles to an existing soft-link record.
	 *
	 * @param {number} id
	 * @param {TileKey[]} tiles
	 * @returns {SoftLink}
	 */
	addTiles(id, tiles = []) {
		if (!Array.isArray(tiles)) {
			throw new Error('Soft link tiles must be an array');
		}

		let link = this.getRequired(id);

		link.tiles.push(...tiles);

		return link;
	}

	/**
	 * Return one soft-link record by id.
	 *
	 * @param {number} id
	 * @returns {SoftLink | null}
	 */
	get(id) {
		return this.state.softLinkRecords.find((link) => link.id === id) ?? null;
	}

	/**
	 * Return one soft-link record by id, throwing if it does not exist.
	 *
	 * @param {number} id
	 * @returns {SoftLink}
	 */
	getRequired(id) {
		let link = this.get(id);

		if (!link) {
			throw new Error(`Unknown soft link: ${id}`);
		}

		return link;
	}

	/**
	 * Find all soft links matching simple registry fields.
	 *
	 * Tile filters mean "contains all requested tiles". Consumers decide how to
	 * interpret zero, one, or many matching records.
	 *
	 * @param {SoftLinkFindOptions} [options={}]
	 * @returns {SoftLink[]}
	 */
	find(options = {}) {
		return this.state.softLinkRecords.filter((link) => {
			if (options.type !== undefined && link.type !== options.type) {
				return false;
			}

			if (options.role !== undefined && link.role !== options.role) {
				return false;
			}

			if (options.tiles !== undefined && !this.includesAll(link.tiles, options.tiles)) {
				return false;
			}

			if (
				options.sourceTiles !== undefined
				&& !this.includesAll(link.sourceTiles ?? [], options.sourceTiles)
			) {
				return false;
			}

			return true;
		});
	}

	/**
	 * Validate one soft-link record before storing it.
	 *
	 * @param {SoftLinkInit} link
	 * @returns {void}
	 */
	validateLink(link) {
		if (!SOFT_LINK_TYPES.includes(link.type)) {
			throw new Error(`Unsupported soft link type: ${link.type}`);
		}

		if (typeof link.role !== 'string' || link.role.length === 0) {
			throw new Error('Soft link role is required');
		}

		if (!Array.isArray(link.tiles)) {
			throw new Error('Soft link tiles must be an array');
		}

		if (link.type === 'open-tiles' && !Array.isArray(link.sourceTiles)) {
			throw new Error('Open-tiles soft links require sourceTiles');
		}
	}

	/**
	 * Check whether a list includes every requested tile.
	 *
	 * @param {TileKey[]} available
	 * @param {TileKey[]} requested
	 * @returns {boolean}
	 */
	includesAll(available = [], requested = []) {
		let availableTiles = new Set(available);

		return requested.every((tile) => availableTiles.has(tile));
	}
}
