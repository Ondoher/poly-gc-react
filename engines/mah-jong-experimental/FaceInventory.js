import { makeSequentialArray } from '../../src/gc/utils/arrays.js';
import Random from '../../src/gc/utils/random.js';


/** @type {SuitSpec} */
const SUITS = {
	bamboo: [0, 35],
	characters: [36, 71],
	dots: [72, 107],
	dragons: [108, 119],
	winds: [120, 135],
	flowers: [136, 139],
	seasons: [140, 143]
}

/**
 * Manage generated face sets and the concrete face pairs selected from them.
 *
 * This utility is intentionally minimal for the first generator pass. It
 * tracks remaining faces by face set, selects matching face pairs from those
 * sets, and records which tile pairs received each selected face group.
 */
export default class FaceInventory {
	/**
	 * Create an empty face inventory.
	 */
	constructor() {
		/** @type {Map<number, FaceSet}  */
		this.faceSets = new Map;

		/** @type {FaceSuitMap} */
		this.suits = {};
		this.makeSuits();

		/** @type {FacePair[]} */
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
	 * @param {Face} face
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
	 * Remove all tracked face sets and therefore all available face pairs.
	 *
	 * @returns {void}
	 */
	clear() {
		this.faceSets = new Map();
	}

	/**
	 * Populate the inventory with face sets sized for the given board.
	 *
	 * Each full face set contains four matching faces, enough for two face pairs.
	 * A partial leftover set contains one face pair.
	 *
	 * @param {number} tileCount
	 * @returns {FaceInventory}
	 */
	initialize(tileCount) {
		return this.shuffleTiles(tileCount);
	}

	/**
	 * Populate the inventory with face sets sized for the given board.
	 *
	 * Each full face set contains four matching faces, enough for two face pairs.
	 * A partial leftover set contains one face pair.
	 *
	 * @param {number} tileCount
	 * @returns {FaceInventory}
	 */
	shuffleTiles(tileCount) {
		let fullSetList = makeSequentialArray(0, 144 / 4);
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

		return this;
	}

	/**
	 * Return how many face pairs remain available.
	 *
	 * @returns {number}
	 */
	getRemainingPairCount() {
		let count = 0;

		for (let faceSet of this.faceSets.values()) {
			count += Math.floor(faceSet.faces.length / 2);
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

		this.assignedFacePairs.forEach((facePair, index) => {
			indexes.set(facePair.faceGroup, index);
		});

		return indexes;
	}

	/**
	 * Record that a tile pair received a face pair from one face group.
	 *
	 * @param {TileKey} tile1
	 * @param {TileKey} tile2
	 * @param {FaceGroup} faceGroup
	 * @returns {FaceInventory}
	 */
	recordAssignedPair(tile1, tile2, faceGroup) {
		this.assignedFacePairs.push({
			tile1,
			tile2,
			faceGroup,
		});

		return this;
	}

	/**
	 * Check whether a face group has enough remaining faces to be selected.
	 *
	 * @param {FaceGroup} faceGroup
	 * @param {number} [requiredFaces=2]
	 * @returns {boolean}
	 */
	canSelectFromGroup(faceGroup, requiredFaces = 2) {
		let faceSet = this.faceSets.get(faceGroup);

		return faceSet !== undefined && faceSet.faces.length >= requiredFaces;
	}

	/**
	 * Check whether a face group has one complete four-face set available.
	 *
	 * @param {FaceGroup} faceGroup
	 * @returns {boolean}
	 */
	canSelectFullFaceSet(faceGroup) {
		let faceSet = this.faceSets.get(faceGroup);

		return faceSet !== undefined && faceSet.faces.length === 4;
	}

	/**
	 * Return the next available face pair without removing it.
	 *
	 * @returns {FacePair | null}
	 */
	peekNextPair() {
		for (let faceSet of this.faceSets.values()) {
			if (faceSet.faces.length >= 2) {
				return {
					faceGroup: faceSet.id,
					face1: faceSet.faces[0],
					face2: faceSet.faces[1],
				};
			}
		}

		return null;
	}

	/**
	 * Draw and remove the next available matching face pair.
	 *
	 * @returns {FacePair | null}
	 */
	drawPair() {
		for (let faceSet of this.faceSets.values()) {
			if (faceSet.faces.length >= 2) {
				let face1 = faceSet.faces.shift();
				let face2 = faceSet.faces.shift();

				return {
					faceGroup: faceSet.id,
					face1,
					face2,
				};
			}
		}

		return null;
	}

	/**
	 * Select and remove one matching face pair from a selected face group.
	 *
	 * @param {FaceGroup} faceGroup
	 * @returns {FacePair | null}
	 */
	selectPairFromGroup(faceGroup) {
		if (!this.canSelectFromGroup(faceGroup, 2)) {
			return null;
		}

		let faceSet = this.faceSets.get(faceGroup);
		let face1 = faceSet.faces.shift();
		let face2 = faceSet.faces.shift();

		if (faceSet.faces.length === 0) {
			this.faceSets.delete(faceGroup);
		}

		return {
			faceGroup,
			face1,
			face2,
		};
	}

	/**
	 * Select and remove one complete four-face set from a selected face group.
	 *
	 * @param {FaceGroup} faceGroup
	 * @returns {FullFaceSet | null}
	 */
	selectFullFaceSet(faceGroup) {
		if (!this.canSelectFullFaceSet(faceGroup)) {
			return null;
		}

		let faceSet = this.faceSets.get(faceGroup);
		let faces = faceSet.faces.splice(0, 4);

		this.faceSets.delete(faceGroup);

		return {
			faceGroup,
			faces,
		};
	}


}
