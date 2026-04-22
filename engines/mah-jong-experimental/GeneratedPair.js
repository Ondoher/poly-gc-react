/**
 * Use this class to represent one generated structural tile pair during board
 * generation.
 *
 * The record starts as a prepared pair with only tile keys. Later face
 * assignment attaches the selected face pair and face-group metadata, making it
 * an assigned pair. It represents the final generated pair only after all
 * generation stages have completed.
 */
export default class GeneratedPair {
	/**
	 * Create one prepared tile-pair record.
	 *
	 * @param {GeneratedPairInit} [options={}]
	 */
	constructor(options = {}) {
		/**
		 * First board-local tile key in the prepared tile pair.
		 *
		 * @type {TileKey}
		 */
		this.tile1 = options.tile1 ?? -1;

		/**
		 * Second board-local tile key in the prepared tile pair.
		 *
		 * @type {TileKey}
		 */
		this.tile2 = options.tile2 ?? -1;

		/**
		 * Preferred face group for later face assignment, when one exists.
		 *
		 * @type {FaceGroup}
		 */
		this.preferredFaceGroup = options.preferredFaceGroup ?? -1;

		/**
		 * Face group actually assigned through the selected face pair.
		 *
		 * @type {FaceGroup}
		 */
		this.faceGroup = options.faceGroup ?? -1;

		/**
		 * Concrete face pair assigned to the prepared tile pair.
		 *
		 * @type {Face[]}
		 */
		this.faces = options.faces ? options.faces.slice() : [];

	}

	/**
	 * Return the tile-pair keys as an array for helper code that works with
	 * prepared records generically.
	 *
	 * @returns {TileKey[]}
	 */
	get tiles() {
		return [this.tile1, this.tile2];
	}

	/**
	 * Store the assigned face pair metadata.
	 *
	 * @param {FacePair} facePair
	 * @returns {GeneratedPair}
	 */
	assignFaces(facePair) {
		this.faceGroup = facePair.faceGroup;
		this.faces = [facePair.face1, facePair.face2];
		return this;
	}

	/**
	 * Return a cloned generated tile-pair record.
	 *
	 * @returns {GeneratedPair}
	 */
	clone() {
		return new GeneratedPair(this.toJSON());
	}

	/**
	 * Return a plain data snapshot of this generated tile-pair record.
	 *
	 * @returns {GeneratedPairInit}
	 */
	toJSON() {
		return {
			tile1: this.tile1,
			tile2: this.tile2,
			preferredFaceGroup: this.preferredFaceGroup,
			faceGroup: this.faceGroup,
			faces: this.faces.slice(),
		};
	}
}
