import Random from '../../src/gc/utils/random.js';

/**
 * Manage the pool of generated face pairs available for simple board
 * assignment.
 *
 * This utility is intentionally minimal for the first generator pass. It
 * tracks a queue of matching face pairs and exposes small query/draw methods
 * that generation can build on later.
 */
export default class FaceInventory {
	/**
	 * Create an empty face inventory.
	 */
	constructor() {
		/** @type {{ face1: Face, face2: Face, faceGroup: FaceGroup }[]} */
		this.pairs = [];
	}

	/**
	 * Remove all tracked face pairs.
	 *
	 * @returns {void}
	 */
	clear() {
		this.pairs = [];
	}

	/**
	 * Populate the inventory with a simple set of matching face pairs sized for
	 * the given board.
	 *
	 * @param {number} tileCount
	 * @returns {FaceInventory}
	 */
	initializeSimplePairs(tileCount) {
		let fullSetCount = Math.floor(tileCount / 4);
		let leftover = tileCount % 4;
		let faceGroups = Array.from({ length: 36 }, function(_value, index) {
			return index;
		});
		let pairGroups = [];

		this.clear();

		for (let index = 0; index < fullSetCount; index++) {
			let faceGroup = Random.pickOne(faceGroups);

			pairGroups.push(faceGroup, faceGroup);
		}

		if (leftover >= 2) {
			pairGroups.push(Random.pickOne(faceGroups));
		}

		this.pairs = pairGroups.map((faceGroup) => {
			return {
				face1: faceGroup * 4,
				face2: faceGroup * 4 + 1,
				faceGroup,
			};
		});

		return this;
	}

	/**
	 * Return how many face pairs remain available.
	 *
	 * @returns {number}
	 */
	getRemainingPairCount() {
		return this.pairs.length;
	}

	/**
	 * Check whether at least one face pair remains available.
	 *
	 * @returns {boolean}
	 */
	hasRemainingPairs() {
		return this.getRemainingPairCount() > 0;
	}

	/**
	 * Return the next face pair without consuming it.
	 *
	 * @returns {{ face1: Face, face2: Face, faceGroup: FaceGroup } | null}
	 */
	peekNextPair() {
		return this.pairs[0] || null;
	}

	/**
	 * Consume and return the next face pair.
	 *
	 * @returns {{ face1: Face, face2: Face, faceGroup: FaceGroup } | null}
	 */
	drawPair() {
		return this.pairs.shift() || null;
	}

	/**
	 * Return the stable face-group id for a concrete face.
	 *
	 * @param {Face} face
	 * @returns {FaceGroup}
	 */
	getFaceGroup(face) {
		return Math.floor(face / 4);
	}
}
