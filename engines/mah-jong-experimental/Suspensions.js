/**
 * Coordinate delayed-match suspension policy across generator domains.
 *
 * `Suspensions` intentionally sits above `Tiles` and `Faces`. It may compose
 * their public APIs, but it should not reach into lower-level helpers such as
 * `TilePicker`, `FaceInventory`, `FaceRanking`, or `FaceAvoidance`.
 */
export default class Suspensions {
	/**
	 * @param {SuspensionsOptions} options
	 */
	constructor(options = {}) {
		/**
		 * Shared generator state.
		 *
		 * @type {GeneratorState}
		 */
		this.state = options.state;

		/**
		 * Tile-domain orchestrator.
		 *
		 * @type {Tiles}
		 */
		this.tiles = options.tiles;

		/**
		 * Face-domain orchestrator.
		 *
		 * @type {Faces}
		 */
		this.faces = options.faces;
	}

	/**
	 * Initialize suspension orchestration for one generation run.
	 *
	 * @returns {Suspensions}
	 */
	initialize() {
		return this;
	}

	/**
	 * Give suspension policy one chance to act during a generation step.
	 *
	 * Returning `false` means suspension policy has nothing to do and normal
	 * tile-pair selection should continue. Returning a `GeneratedPair` means the
	 * generator should commit that pair for this step.
	 *
	 * @returns {GeneratedPair | false}
	 */
	step() {
		if (this.canReleaseSuspension()) {
			return this.releaseSuspension();
		}

		if (this.canCreateSuspension()) {
			return this.createSuspension();
		}

		return false;
	}

	/**
	 * Return whether the current state can release a suspension.
	 *
	 * This is a policy seam only. The real release rules will be added once the
	 * suspension algorithm is rebuilt against the `Tiles` and `Faces` APIs.
	 *
	 * @returns {boolean}
	 */
	canReleaseSuspension() {
		return false;
	}

	/**
	 * Return whether the current state can create a suspension.
	 *
	 * This is a policy seam only. The real eligibility rules will be added once
	 * the suspension algorithm is rebuilt against the `Tiles` and `Faces` APIs.
	 *
	 * @returns {boolean}
	 */
	canCreateSuspension() {
		return false;
	}

	/**
	 * Create one suspension record.
	 *
	 * @returns {TileSuspension}
	 */
	createSuspension() {
		throw new Error('Suspension creation is not implemented yet');
	}

	/**
	 * Release one active suspension record.
	 *
	 * @param {TileSuspension} suspension
	 * @returns {GeneratedPair}
	 */
	releaseSuspension(suspension) {
		throw new Error('Suspension release is not implemented yet');
	}
}
