import FaceAvoidance from './FaceAvoidance.js';
import FaceInventory from './FaceInventory.js';
import { FaceRanking } from './FaceRanking.js';
import Random from '../../src/gc/utils/random.js';

/**
 * Orchestrate face initialization and assignment for generation.
 *
 * `Faces` speaks in generator-domain terms such as turning prepared tile pairs
 * into assigned pairs, while `FaceInventory` remains the lower-level face-pool
 * helper.
 */
export default class Faces {
	/**
	 * @param {GeneratorState} state
	 * @param {FacesOptions} [options={}]
	 */
	constructor(state, options = {}) {
		let faceInventory = options.faceInventory ?? new FaceInventory();

		/**
		 * Shared generator state.
		 *
		 * @type {GeneratorState}
		 */
		this.state = state;

		/**
		 * Lower-level face inventory owned by this face-domain orchestrator.
		 *
		 * @type {FaceInventory}
		 */
		this.faceInventory = faceInventory;
		this.state.setFaceInventory(faceInventory);

		/**
		 * Shared face-avoidance penalty store for this generation run.
		 *
		 * @type {FaceAvoidance}
		 */
		this.faceAvoidance = new FaceAvoidance(state);

		/**
		 * Face-group ranking helper that reads the shared inventory and
		 * avoidance state owned by this face-domain orchestrator.
		 *
		 * @type {FaceRanking}
		 */
		this.faceRanking = new FaceRanking(state, {
			inventory: this.faceInventory,
			avoidance: this.faceAvoidance,
		});
	}

	/**
	 * Initialize face-domain state for one generation run.
	 *
	 * @param {number} [tileCount=this.state.getBoardCount()]
	 * @returns {Faces}
	 */
	initialize(tileCount = this.state.getBoardCount()) {
		this.faceInventory.initialize(tileCount);
		return this;
	}

	/**
	 * Select the lowest-avoidance face group to use as this pair's preferred
	 * face-group bias.
	 *
	 * This mirrors the live generator's behavior: preferred groups are only
	 * generated when face avoidance is active, and they are only a soft ranking
	 * hint. The later face-selection step can still choose a different group
	 * through the normal ranked-window flow.
	 *
	 * @param {number} requiredFaces
	 * @param {TileKey[]} tiles
	 * @returns {FaceGroup}
	 */
	getPreferredFaceGroup(requiredFaces = 2, tiles = []) {
		if (!this.state.faceAvoidanceRules.enabled) {
			return -1;
		}

		let candidates = [];

		for (let [faceGroup, faceSet] of this.faceInventory.faceSets) {
			if (faceSet.faces.length < requiredFaces) {
				continue;
			}

			candidates.push({
				faceGroup,
				penalty: this.faceRanking.getAvoidancePenalty(faceGroup, tiles),
			});
		}

		if (candidates.length === 0) {
			return -1;
		}

		let minPenalty = Math.min(...candidates.map((candidate) => candidate.penalty));
		let best = candidates.filter((candidate) => candidate.penalty === minPenalty);

		return best[Random.random(best.length)].faceGroup;
	}

	/**
	 * Populate face-domain metadata before assigning concrete faces.
	 *
	 * @param {GeneratedPair} pair
	 * @returns {GeneratedPair}
	 */
	preparePairForFaceAssignment(pair) {
		if (pair.preferredFaceGroup === -1) {
			pair.preferredFaceGroup = this.getPreferredFaceGroup(2, pair.tiles);
		}

		return pair;
	}

	/**
	 * Select one matching face pair for a prepared tile pair.
	 *
	 * @param {GeneratedPair} pair
	 * @returns {FacePair}
	 */
	selectFacesForPair(pair) {
		let faceGroup = this.faceRanking.selectRankedFaceGroup(2, pair);

		if (faceGroup === null) {
			throw new Error('Unable to select a face group during generation');
		}

		let facePair = this.faceInventory.selectPairFromGroup(faceGroup);

		if (!facePair) {
			throw new Error('Selected face group could not provide a face pair');
		}

		return facePair;
	}

	/**
	 * Select one complete four-face set through the normal ranked face flow.
	 *
	 * @param {GeneratedPair} pair
	 * @returns {FullFaceSet}
	 */
	selectFullFaceSet(pair) {
		let faceGroup = this.faceRanking.selectRankedFaceGroup(4, pair);

		if (faceGroup === null) {
			throw new Error('Unable to select a full face set during generation');
		}

		let fullFaceSet = this.faceInventory.selectFullFaceSet(faceGroup);

		if (!fullFaceSet) {
			throw new Error('Selected face group could not provide a full face set');
		}

		return fullFaceSet;
	}

	/**
	 * Record the assigned face group so later ranking can account for reuse
	 * distance.
	 *
	 * @param {GeneratedPair} pair
	 * @returns {Faces}
	 */
	recordAssignedFacePair(pair) {
		this.faceInventory.recordAssignedPair(
			pair.tile1,
			pair.tile2,
			pair.faceGroup
		);

		return this;
	}

	/**
	 * Apply face-avoidance pressure to tiles linked during structural selection.
	 *
	 * `Tiles` owns recording open-tile links. The face domain consumes matching
	 * links only after concrete face assignment, when the selected face group is
	 * known.
	 *
	 * @param {GeneratedPair} pair
	 * @returns {Faces}
	 */
	applyFaceAvoidance(pair) {
		if (!this.state.faceAvoidanceRules.enabled) {
			return this;
		}

		let weight = this.state.faceAvoidanceRules.weight ?? 1;
		let openSoftLinks = this.state.softLinks.find({
			type: 'open-tiles',
			role: 'after-removal',
			sourceTiles: pair.tiles,
		});

		openSoftLinks.forEach((link) => {
			link.tiles.forEach((tileKey) => {
				this.faceAvoidance.addFaceAvoidance(
					tileKey,
					pair.faceGroup,
					weight
				);
			});
		});

		return this;
	}

	/**
	 * Assign a selected face pair to one prepared tile pair, making it an
	 * assigned pair.
	 *
	 * @param {GeneratedPair} pair
	 * @returns {GeneratedPair}
	 */
	assignFacesToPair(pair) {
		let facePair = this.selectFacesForPair(pair);

		pair.assignFaces(facePair);
		this.state.setFace(pair.tile1, facePair.face1);
		this.state.setFace(pair.tile2, facePair.face2);
		this.recordAssignedFacePair(pair);
		this.applyFaceAvoidance(pair);

		return pair;
	}

	/**
	 * Assign face pairs to every prepared tile pair.
	 *
	 * After this returns, each prepared pair has become an assigned pair.
	 *
	 * @param {GeneratedPair[]} preparedPairs
	 * @returns {GeneratedPair[]}
	 */
	assignFacesToPreparedPairs(preparedPairs) {
		preparedPairs.forEach((pair) => {
			this.preparePairForFaceAssignment(pair);
			this.assignFacesToPair(pair);
		});

		return preparedPairs;
	}

	/**
	 * Backward-compatible alias for the older pair-set stage name.
	 *
	 * @param {GeneratedPair[]} pairSet
	 * @returns {GeneratedPair[]}
	 */
	assignFacesToPairSet(pairSet) {
		return this.assignFacesToPreparedPairs(pairSet);
	}
}
