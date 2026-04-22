export default class FaceAvoidance {
	/**
	 * Create a face-avoidance penalty store for one generation run.
	 *
	 * @param {GeneratorState} state
	 */
	constructor(state) {
		/** @type {GeneratorState} */
		this.state = state;

		/** @type {Map<TileKey, Map<FaceGroup, number>>} */
		this.faceAvoidance = new Map();
	}


	/**
	 * Return the accumulated soft penalty for assigning a face group to a tile.
	 * These penalties are used only during generation face assignment; they do
	 * not prevent a face group from being chosen when it is the best remaining
	 * option.
	 *
	 *
	 * @param {TileKey} tile
	 * @param {FaceGroup} faceGroup
	 * @returns {number}
	 */
	getPenalty(tile, faceGroup) {
		return this.faceAvoidance.get(tile)?.get(faceGroup) || 0;
	}

	/**
	 * Add a soft avoid-face mark to a tile/face-group combination.
	 *
	 * This is the face-assignment side of the early-dead-end experiment. When a
	 * prepared tile pair consumes a face pair from a face group, nearby or newly
	 * opened future tiles can be marked to avoid that same face group. Later
	 * face assignment prefers lower
	 * total penalty, which makes local same-face rescues less likely without
	 * making generation brittle.
	 *
	 *
	 * @param {TileKey} tile
	 * @param {FaceGroup} faceGroup
	 * @param {number} weight
	 */
	addFaceAvoidance(tile, faceGroup, weight) {
		if (!this.state.faceAvoidanceRules.enabled || weight <= 0) {
			return;
		}

		let tileAvoidance = this.faceAvoidance.get(tile);

		if (!tileAvoidance) {
			tileAvoidance = new Map();
			this.faceAvoidance.set(tile, tileAvoidance);
		}

		let current = tileAvoidance.get(faceGroup) || 0;
		let next = Math.min(
			this.state.faceAvoidanceRules.maxWeight ?? 8,
			current + weight
		);

		tileAvoidance.set(faceGroup, next);
	}

}
