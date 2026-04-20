/**
 * Use this class to represent one active suspended-tile record during board
 * generation.
 *
 * A suspension keeps one tile on the board while reserving the matching faces
 * that will be used later when the suspension is released.
 */
export default class TileSuspension {
	/**
	 * Create one suspended-tile record.
	 *
	 * @param {TileSuspensionInit} [options={}]
	 */
	constructor(options = {}) {
		/**
		 * The tile kept open on the board while its future match is deferred.
		 *
		 * @type {TileKey}
		 */
		this.tile = options.tile ?? -1;

		/**
		 * The two reserved faces for the suspended tile and its later partner.
		 *
		 * @type {Face[]}
		 */
		this.faces = options.faces ? options.faces.slice() : [];

		/**
		 * The number of already-authored pairs when this suspension was created.
		 *
		 * @type {number}
		 */
		this.placedAt = options.placedAt ?? 0;

		/**
		 * The target number of additional authored pairs before release.
		 *
		 * @type {number}
		 */
		this.placementCount = options.placementCount ?? 0;

		/**
		 * The target maximum open-tile count for release.
		 *
		 * @type {number}
		 */
		this.openCount = options.openCount ?? 0;

		/**
		 * The original pair that created this suspension.
		 *
		 * @type {TileKey[]}
		 */
		this.originalPair = options.originalPair ? options.originalPair.slice() : [];

		/**
		 * The stable face-group id reserved for this suspension.
		 *
		 * @type {FaceGroup}
		 */
		this.faceGroup = options.faceGroup ?? -1;
	}

	/**
	 * Return a cloned suspended-tile record.
	 *
	 * @returns {TileSuspension}
	 */
	clone() {
		return new TileSuspension(this.toJSON());
	}

	/**
	 * Return a plain data snapshot of this suspended-tile record.
	 *
	 * @returns {TileSuspensionInit}
	 */
	toJSON() {
		return {
			tile: this.tile,
			faces: this.faces.slice(),
			placedAt: this.placedAt,
			placementCount: this.placementCount,
			openCount: this.openCount,
			originalPair: this.originalPair.slice(),
			faceGroup: this.faceGroup,
		};
	}
}
