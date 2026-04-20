export default class FaceAvoidance {
	constructor() {
		this.faceAvoidance = new Map();
	}


	/**
	 * Return the accumulated soft penalty for assigning a face set to a tile.
	 * These penalties are used only during generation face assignment; they do
	 * not prevent a face set from being chosen when it is the best remaining
	 * option.
	 *
	 *
	 * @param {TileKey} tile
	 * @param {FaceGroup} faceSet
	 * @returns {number}
	 */
	getPenalty(tile, faceSet) {
		return this.faceAvoidance.get(tile)?.get(faceSet) || 0;
	}

	/**
	 * Add a soft avoid-face mark to a tile/face-set combination.
	 *
	 * This is the face-assignment side of the early-dead-end experiment. When a
	 * generated pair consumes a face set, nearby or newly opened future tiles can
	 * be marked to avoid that same face set. Later face assignment prefers lower
	 * total penalty, which makes local same-face rescues less likely without
	 * making generation brittle.
	 *
	 *
	 * @param {TileKey} tile
	 * @param {FaceGroup} faceSet
	 * @param {number} weight
	 */
	addFaceAvoidance(tile, faceSet, weight) {
		if (!this.state.faceAvoidanceRules.enabled || weight <= 0) {
			return;
		}

		let tileAvoidance = this.faceAvoidance.get(tile);

		if (!tileAvoidance) {
			tileAvoidance = new Map();
			this.faceAvoidance.set(tile, tileAvoidance);
		}

		let current = tileAvoidance.get(faceSet) || 0;
		let next = Math.min(
			this.state.faceAvoidanceRules.maxWeight ?? 8,
			current + weight
		);

		tileAvoidance.set(faceSet, next);
	}

}
