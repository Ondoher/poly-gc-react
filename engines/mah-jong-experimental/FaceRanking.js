import FaceAvoidance from "./FaceAvoidance.js";
import {
	getRankedWindow,
	selectRankedCandidate,
} from './ranked-window.js';

export class FaceRanking {

	/**
	 * Create a face-ranking helper over the generator state and its shared
	 * face inventory.
	 *
	 * @param {GeneratorState} state
	 * @param {{ inventory?: FaceInventory, avoidance?: FaceAvoidance }} collaborators
	 */
	constructor(state, collaborators = {}) {
		/** @type {GeneratorState} */
		this.state = state;

		/** @type {FaceInventory} */
		this.inventory = collaborators.inventory ?? state.faceInventory;

		/** @type {FaceAvoidance} */
		this.avoidance = collaborators.avoidance ?? new FaceAvoidance(state);
	}

	/**
	 * Apply the configured preferred-face-group multiplier to a rank factor.
	 *
	 * Lower rank factors are selected earlier, so preferred groups reduce the
	 * factor while non-preferred groups keep their original value.
	 *
	 * @param {number} baseSortValue
	 * @param {boolean} [preferred=false]
	 * @returns {number}
	 */
	getAdjustedDistanceFactor(baseSortValue, preferred = false) {
		let multiplier = this.state.faceAssignmentRules?.preferredMultiplier ?? 0.5;

		return preferred ? baseSortValue * multiplier : baseSortValue;
	}


	/**
	 * Calculate the combined avoidance penalty for assigning a face group to a
	 * set of generated tiles.
	 *
	 *
	 * @param {FaceGroup} faceGroup
	 * @param {TileKey[]} tiles
	 * @returns {number}
	 */
	getAvoidancePenalty(faceGroup, tiles) {
		let faceSet = this.inventory.getFaceSet(faceGroup);
		let faceSetId = faceSet.id;

		return tiles.reduce((penalty, tile) => {
			return penalty + this.avoidance.getPenalty(tile, faceSetId);
		}, 0);
	}

	/**
	 * Return how many times a reused face group should be duplicated in the
	 * ranking candidate list.
	 *
	 * This is an easy-side tuning hook: easier difficulties can duplicate
	 * recently reused groups so they appear more often in the selected window.
	 * A return value of `1` means the group appears only once.
	 *
	 * @param {number} reusedIndex
	 * @param {number} reusedCount
	 * @returns {number}
	 */
	getFaceGroupDuplicateCount(reusedIndex, reusedCount) {
		let state = this.state;
		let difficulty = Math.max(0, Math.min(1, state.difficulty()));
		let easeStrength = Math.max(0, (0.5 - difficulty) * 2);
		let duplicateScale = state.faceAssignmentRules.easyReuseDuplicateScale ?? 0;

		if (duplicateScale <= 0 || easeStrength === 0 || reusedCount <= 0) {
			return 1;
		}

		let closenessRatio = reusedCount <= 1
			? 1
			: 1 - (reusedIndex / (reusedCount - 1));
		let extra = Math.floor(easeStrength * closenessRatio * duplicateScale);

		return 1 + extra;
	}

	/**
	 * Build the currently available face-group candidates annotated with
	 * placement distance from the latest prior assignment of the same face group.
	 *
	 * Reused groups get a numeric distance based on assignment-history index
	 * difference. Unused groups remain neutral with `distance = null`.
	 * The returned list always places the distance-sorted reused groups first,
	 * then appends the remaining neutral groups in stable draw-pile order.
	 *
	 * This does not change face assignment yet; it only exposes the sorted data
	 * needed for future spacing-based selection experiments.
	 *
	 *
	 * @param {number} requiredFaces
	 * @param {GeneratedPair} preparedPair Prepared tile pair awaiting face assignment.
	 * @returns {FaceGroup[]}
	 */
	rankFaceGroups(requiredFaces = 2, preparedPair = null) {
		let {faceAssignmentRules} = this.state;
		let preferredFaceGroup = preparedPair?.preferredFaceGroup;
		let tiles = preparedPair?.tiles ?? [];
		let candidates = [];

		for (let [faceGroup, faceSet] of this.inventory.faceSets) {
			let { faces } = faceSet;

			if (faces.length < requiredFaces) {
				continue;
			}

			let baseFactor = 1;
			let pairCountFactor = faces.length === 4 ? 2 : 1;
			let assignedFacePairs = this.inventory.assignedFacePairs.slice().reverse();
			let distance = assignedFacePairs.findIndex((facePair) => facePair.faceGroup === faceGroup);
			let distanceFactor = distance === -1 ? assignedFacePairs.length : distance + 1;
			let dups = this.getFaceGroupDuplicateCount(distance, assignedFacePairs.length) - 1;

			let weightFactor = this.getAvoidancePenalty(faceGroup, tiles);
			if (weightFactor !== 0)  {
				weightFactor = 1 / weightFactor;
			}

			// Lower assignment-history distance values rank toward easier selection.
			distanceFactor = this.getAdjustedDistanceFactor(distanceFactor);

			let preferredFactor =  preferredFaceGroup === faceGroup ?
				faceAssignmentRules.preferredMultiplier ?? 0.5 :
				1;

			let finalFactor = baseFactor *
				pairCountFactor *
				distanceFactor *
				preferredFactor;

			if (weightFactor !== 0 && distance === -1) {
				finalFactor = weightFactor;
			}

			let candidate = {
				dups,
				faceGroup,
				sortValue: finalFactor,
			};

			candidates.push(candidate);
		}

		let compare = function(left, right) {
			return left.sortValue - right.sortValue || left.faceGroup - right.faceGroup;
		};

		candidates.sort(compare);

		let expanded = [];
		candidates.forEach((candidate) => {
			expanded.push(candidate);
			for (let idx = 0; idx < candidate.dups; idx++) {
				expanded.push(candidate);
			}
		})

		return expanded.map((candidate) => candidate.faceGroup);
	}

	/**
	 * Return difficulty-window details for ranked face-group candidates.
	 *
	 * @param {number} requiredFaces
	 * @param {GeneratedPair} preparedPair Prepared tile pair awaiting face assignment.
	 * @returns {RankedWindow<FaceGroup>}
	 */
	getRankedFaceGroupWindow(requiredFaces = 2, preparedPair = null) {
		let rankedGroups = this.rankFaceGroups(requiredFaces, preparedPair);

		return getRankedWindow(rankedGroups, {
			difficulty: this.state.difficulty(),
			minWindowRatio: this.state.getMinWindowRatio(),
		});
	}

	/**
	 * Select one face group from the difficulty-shaped ranked window.
	 *
	 * @param {number} requiredFaces
	 * @param {GeneratedPair} preparedPair Prepared tile pair awaiting face assignment.
	 * @returns {FaceGroup | null}
	 */
	selectRankedFaceGroup(requiredFaces = 2, preparedPair = null) {
		let rankedGroups = this.rankFaceGroups(requiredFaces, preparedPair);

		return selectRankedCandidate(rankedGroups, {
			difficulty: this.state.difficulty(),
			minWindowRatio: this.state.getMinWindowRatio(),
		});
	}

}
