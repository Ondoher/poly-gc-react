import FaceAvoidance from "./FaceAvoidance";
import FaceInventory from "./FaceInventory";
import { GenerateState } from "./GeneratorState";

export class FaceRanking {

	/**
	 *
	 * @param {GenerateState} state
	 */
	constructor(state) {
		this.state = state;
		/** @type {FaceInventory} */
		this.inventory = state.faceInventory()
		this.avoidance = new FaceAvoidance();
	}

	getAdjustedDistanceFactor(baseSortValue, preferred = false) {
		let multiplier = this.state.faceAssignmentRules.preferredMultiplier ?? 0.5;

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
		let faceSetId = this.getFaceSetId(faceSet);

		return tiles.reduce((penalty, tile) => {
			return penalty + this.avoidance.getPenalty(tile, faceSetId);
		}, 0);
	}

	/**
	 *
	 * @param {number} reusedIndex
	 * @param {number} reusedCount
	 * @param {DifficultyOptions} options
	 * @returns
	 */
	getFaceGroupDuplicateCount(reusedIndex, reusedCount, options = {}) {
		let state = this.state;
		let difficulty = Math.max(0, Math.min(1, state.difficulty(options)));
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
	 * @param {GeneratedPairRecord} pending
	 * @returns {FaceGroup[]}
	 */
	rankFaceGroups(requiredFaces = 2, pending = null) {
		let {faceAssignmentRules} = state
		let preferredFaceGroup = pending?.preferredFaceGroup;
		let candidates = [];

		for (let [faceGroup, faceSet] of this.inventory.faceSets) {
			let { faces } = faceSet;

			if (faces.length < requiredFaces) {
				continue;
			}

			let baseFactor = 1;
			let pairCountFactor = faces.length === 4 ? 2 : 1;

			let weightFactor = this.getAvoidancePenalty(faceGroup, pending.tiles);
			if (weightFactor !== 0)  {
				weightFactor = 1 / weightFactor;
			}

			// find the distance between the face group I'm ranking, and the last time it
			// was assigned. Lower values will be ranked towards easy
			let searchPairs = this.inventory.assignedFacePairs.slice().reverse();
			let distance = searchPairs.findIndex((pair) => pair.faceGroup === faceGroup);
			let distanceFactor = distance === -1 ? searchPairs.length : distance + 1;
			distanceFactor = this.getAdjustedDistanceFactor(distanceFactor);

			let dups = this.getFaceGroupDuplicateCount(distance, searchPairs.length, {}) - 1;

			let suitDistanceFactor = min + (max - min) * normalized;

			suitDistanceFactor = 1;

			let preferredFactor =  preferredFaceGroup === faceGroup ?
				faceAssignmentRules.preferredMultiplier ?? 0.5 :
				1;

			let finalFactor = baseFactor *
				pairCountFactor *
				distanceFactor *
				suitDistanceFactor *
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

}
