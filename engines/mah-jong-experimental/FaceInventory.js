import { makeSequentialArray } from 'utils/arrays.js';
import Random from '../../src/gc/utils/random.js';


/** @type {SuitSpec} */
const SUITS = {
	bamboo: [0, 35],
	characters: [36, 71],
	dots: [72, 107],
	dragon: [108, 119],
	wind: [120, 135],
	flower: [136, 139],
	season: [140, 143]
}

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
		/** @type {Map<number, FaceSet}  */
		this.faceSets = new Map;

		/** @type {{[face: Face]: Suit}} */
		this.suits = {};
		this.makeSuits();

		/** @type {AssignedFacePair[]} */
		this.assignedFacePairs = [];
	}

	makeSuits() {
		let entries = Object.entries(SUITS);

		for (let [suit, range] of entries) {
			for (let idx = range[0]; idx <= range[1]; idx++) {
				this.suits[idx] = suit;
			}
		}
	}

	/**
	 * Given a face, find it's suit
	 *
	 * @param {face} face
	 * @returns {Suit}
	 */
	getSuit(face) {
		return this.suits[face];
	}

	/**
	 *
	 * @param {FaceGroup} faceGroup
	 * @returns {Suit}
	 */
	getSuitFromFaceGroup(faceGroup) {
		let face = faceGroup * 4;
		return this.suits[face];
	}


	/**
	 * Remove all tracked face pairs.
	 *
	 * @returns {void}
	 */
	clear() {
		this.faceSets = new Map();
	}

	/**
	 * Populate the inventory with a simple set of matching face pairs sized for
	 * the given board.
	 *
	 * @param {number} tileCount
	 * @returns {FaceInventory}
	 */
	shuffleTiles(tileCount) {
		let fullSetList = engine.makeSequentialArray(0, 144 / 4);
		let leftover = tileCount % 4;
		let faceCount = Math.floor(tileCount / 4);
		this.faceSets = new Map();

		for (let idx = 0; idx < faceCount; idx++) {
			let id = Random.pickOne(fullSetList);
			let faces = makeSequentialArray(id * 4, 4);
			let suit = this.getSuit(faces[0]);
			this.faceSets.set(id, {
				id,
				suit,
				faces
			});
		}

		if (leftover) {
			let id = Random.pickOne(fullSetList);
			let faces = makeSequentialArray(id * 4, 2);
			let suit = this.getSuit(faces[0]);
			this.faceSets.set(id, {
				id,
				suit,
				faces
			});
		}
	}

	/**
	 * Return how many face pairs remain available.
	 *
	 * @returns {number}
	 */
	getRemainingPairCount() {
		let count = 0;

		for (let faceSet of this.faceSets.values()) {
			count += faceSet.faces.length;
		}

		return count;
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
	 * Return the stable face-group id for a concrete face.
	 *
	 * @param {Face} face
	 * @returns {FaceGroup}
	 */
	getFaceGroup(face) {
		return Math.floor(face / 4);
	}

	/**
	 *
	 * @param {FaceGroup} group
	 */
	getFaceSet(group) {
		return this.faceSets.get(group);
	}

	/**
	 * Return the most recent assignment index for each face group that has
	 * already been used during generation.
	 *
	 *
	 * @returns {Map<FaceGroup, number>}
	 */
	getAssignedFaceGroupIndexes() {
		let indexes = new Map();

		this.assignedFacePairs.forEach((pair, index) => {
			indexes.set(pair.faceGroup, index);
		});

		return indexes;
	}



}
