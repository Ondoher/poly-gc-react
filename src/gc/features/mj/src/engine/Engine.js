import { makeEventable, registry } from '@polylith/core';
import Random from 'utils/random.js'
import NumberSet from 'utils/NumberSet.js';
import GameGenerator from './GameGenerator.js';

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
 * This is the engine for the Mah Jongg solitaire game. It keeps the game state
 * and provides methods to manipulate it.
 */
export default class Engine {
	constructor() {
		makeEventable(this);
		this.seasonFaceSetArray = [34,35,36,37];
		this.flowerFaceSetArray = [38,39,40,41];

		/** @type {Board} */
		this.board = {};

		/** @type {Layout} */
		this.layout = {};

		/** @type {SuspensionRules} */
		this.suspensionRules = {
			frequency: 0
		}

		/** @type {number} */
		this.difficulty = 0.5;

		/** @type {TilePickerOptions} */
		this.tilePickerRules = {};

		/** @type {FaceAvoidanceRules} */
		this.faceAvoidanceRules = {
			enabled: false,
			weight: 1,
			suspensionWeight: 3,
			maxWeight: 8,
		};

		/** @type {FaceAssignmentRules} */
		this.faceAssignmentRules = {
			preferredMultiplier: 0.5,
			easyReuseDuplicateScale: 0,
		};

		/** @type {Suspended[]} */
		this.suspended = [];

		/** @type {number} */
		this.suspendedCount = 0;

		/** @type {GeneratedPairRecord[]} */
		this.pendingPairs = [];

		this.suspensionStats = this.createSuspensionStats();
		this.tilePickerStats = this.createTilePickerStats();
		this.faceAvoidanceStats = this.createFaceAvoidanceStats();
		this.faceAvoidance = new Map();

		/** @type {AssignedFacePair[]} */
		this.assignedFacePairs = [];

		this.undoStack = [];
		this.redoStack = [];

		this.selectableTiles = new NumberSet([], 144);

		/**
		 * Track which grid spaces are currently occupied on the full board
		 * surface. This is a two dimensional array of sets indexed by `z` and
		 * `y`. Each bit in a set represents an occupied `x` coordinate.
		 *
		 * @type {Array.<Array.<NumberSet>>}
		 */
		this.usedSpaces = [];

		/**
		 * Track which tile indexes are currently placed on the board. This uses
		 * 144 bits, one for each possible tile index in the full tile set.
		 *
		 * @type {NumberSet}
		 */
		this.placedTiles = new NumberSet([]);

		/**
		 * Track which currently placed tiles are open and selectable for play.
		 *
		 * @type {Array.<TileKey>}
		 */
		this.openTiles = [];

		/**
		 * Track one guaranteed solution path for the active board. The tile
		 * indexes are recorded in the order they were assigned during board
		 * generation.
		 *
		 * @type {Array.<TileKey>}
		 */
		this.solution = [];

		/** @type {{[face: Face]: Suit} */
		this.suits = {};
		this.makeSuits();

		/**
		 * Track the remaining face groups available to draw from while the board
		 * is being generated.
		 *
	 * @type {DrawPile}
		 */
		this.drawPile = {
			faceSets: []
		};

		this.setLayout();

		this.actionCollector = registry.subscribe("mj:action-collector");
	}

	/**
	 * Call this method to record one gameplay action if the action collector is available.
	 *
	 * @param {MjGameplayAction} action - Describe one gameplay action in the current session.
	 */
	recordAction(action) {
		if (!this.actionCollector || !this.actionCollector.recordAction) {
			return;
		}

		this.actionCollector.recordAction(action);
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


	setupSuspensionRules(rules) {
		this.suspensionRules = rules;
		this.configureBoard();
	}

	setupDifficulty(difficulty = 0.5) {
		this.difficulty = Math.max(0, Math.min(1, difficulty));
	}

	setupTilePickerRules(rules = {}) {
		this.tilePickerRules = rules;
	}

	setupFaceAvoidanceRules(rules = {}) {
		this.faceAvoidanceRules = {
			...this.faceAvoidanceRules,
			...rules,
		};
	}

	setupFaceAssignmentRules(rules = {}) {
		this.faceAssignmentRules = {
			...this.faceAssignmentRules,
			...rules,
		};
	}

	createSuspensionStats() {
		return {
			attempts: 0,
			created: 0,
			released: 0,
			forceReleased: 0,
			skippedByFrequency: 0,
			skippedByTotalCap: 0,
			skippedByNestedCap: 0,
			skippedByOpenTiles: 0,
			skippedByNoFullFaceSet: 0,
			maxNestedSeen: 0,
			forceReleaseOpenTilesTotal: 0,
			forceReleaseSuspendedTotal: 0,
			forceReleaseOpenSuspendedTotal: 0,
			forceReleaseEffectiveOpenTotal: 0,
			skipOpenTilesOpenTilesTotal: 0,
			skipOpenTilesSuspendedTotal: 0,
			skipOpenTilesOpenSuspendedTotal: 0,
			skipOpenTilesEffectiveOpenTotal: 0,
		};
	}

	createTilePickerStats() {
		return {
			picks: 0,
			weightTotal: 0,
			freedCountTotal: 0,
			freedRankTotal: 0,
			openPressureTotal: 0,
			zTotal: 0,
			zWeightTotal: 0,
			horizontalIntersectionsTotal: 0,
			verticalIntersectionsTotal: 0,
			balanceMarginTotal: 0,
			balancePressureTotal: 0,
			shortHorizonMovesTotal: 0,
			shortHorizonRemainingTilesTotal: 0,
			shortHorizonPressureTotal: 0,
			shortHorizonProbeCount: 0,
			shortHorizonCollapseCount: 0,
			candidateCountTotal: 0,
			windowSizeTotal: 0,
			windowStartTotal: 0,
			windowEndTotal: 0,
			normalFirstPicks: 0,
			normalSecondPicks: 0,
			suspensionFirstPicks: 0,
			suspensionSecondPicks: 0,
			suspensionThirdPicks: 0,
			releasedPartnerPicks: 0,
			stackSafetyRejected: 0,
		};
	}

	createFaceAvoidanceStats() {
		return {
			marksAdded: 0,
			preferredFaceGroups: 0,
			preferredFaceGroupDraws: 0,
			preferredFaceGroupFallbacks: 0,
			drawCount: 0,
			selectedPenaltyTotal: 0,
			zeroPenaltyDraws: 0,
			nonZeroPenaltyDraws: 0,
			maxSelectedPenalty: 0,
		};
	}

	//============================================================================
	// Private methods
	//============================================================================

	/**
	 *
	 * @param {number} start
	 * @param {number} count
	 * @returns {number[]}
	 */
	makeSequentialArray(start, count) {
		return Array.from({length: count}, function(val, index) {
			return index + start
		});
	}

	/**
	 * Call this method to record game space as being occupied by a tile. The
	 * board object contains the list of tiles in the current game layout and
	 * where they are. But those tiles don't actually occupy game space which is
	 * stored separately.
	 *
	 * This method will record that game space as occupied. Occupied space is
	 * used to determine which tiles on the board can be played because they are
	 * open on the top and the left or the right.
	 *
	 *
	 * @param {TilePosition} position the position on the board to be occupied
	 * @param {TileKey} tile the tile that will occupy that position
	 */
	addPos(position, tile)	{
		var {x, y, z} = position;

		if (x === -1) return;

		this.usedSpaces[z] = this.usedSpaces[z] || [];
		this.usedSpaces[z][y] = this.usedSpaces[z][y] || new NumberSet([]);
		this.usedSpaces[z][y + 1] = this.usedSpaces[z][y + 1] || new NumberSet([]);

		var tempSet = new NumberSet([x, x + 1]);
		this.usedSpaces[z][y].union(tempSet);
		this.usedSpaces[z][y + 1].union(tempSet);
		this.placedTiles.include(tile);
	}

	/**
	 * Call this method to remove a tile from the board. Removing a tile from
	 * the board does not change the board layout, but will release the grid
	 * space that had been previously occupied.
	 *
	 *
	 * @param {TilePosition} position the position the tile occupies on the board
	 * @param {TileKey} tile which tile is being removed
	 */
	subtractPos(position, tile) {
		var {x, y, z} = position;

		if (x == -1) return;

		var tmpSet = new NumberSet([x, x + 1]);
		this.usedSpaces[z][y].difference(tmpSet);
		this.usedSpaces[z][y + 1].difference(tmpSet);

		this.placedTiles.exclude(tile);
	}

	/**
	 * Call this method to check if a specific coordinate in the game grid is
	 * currently occupied.
	 *
	 *
	 * @param {Number} x the x coordinate
	 * @param {Number} y the y coordinate
	 * @param {Number} z the z coordinate
	 *
	 * @returns {Boolean} true if the space is occupied, false if it is not
	 */
	isUsed (x, y, z) {
		if (this.usedSpaces[z] === undefined) return false;
		else if (this.usedSpaces[z][y] === undefined) return false;
		else return this.usedSpaces[z][y].has(x);
	}

	isTileOpen(tile) {
		if (!this.placedTiles.has(tile)) {
			return false;
		}

		let {x, y, z} = this.board.pieces[tile].pos;
		let goodAcross;
		let goodUp;

		if (x == 1) goodAcross = true;
		else if (x == 29) goodAcross = true;
		else goodAcross = (!this.isUsed(x + 2, y, z) && !this.isUsed(x + 2, y + 1, z)) || (!this.isUsed(x -1, y, z) && !this.isUsed(x - 1, y + 1, z));

		if (z == 7) goodUp = true;
		else goodUp = !this.isUsed(x, y, z + 1) && !this.isUsed(x + 1, y, z + 1) && !this.isUsed(x, y + 1, z + 1) && !this.isUsed(x + 1, y + 1, z + 1);

		return goodAcross && goodUp;
	}

	/**
	 * Call this method to calculate all the tiles on that board that are open
	 * on all sides and above. This does not take assigned faces into account.
	 * This updates both playableTiles and selectableTiles
	 *
	 *
	 */
	calcOpenTiles() {
		this.selectableTiles.clear();
		this.openTiles = [];

		// cannot play suspended tiles
		let skipTiles = this.suspended.map((suspended) => suspended.tile);

		for (let idx = 0; idx < this.board.count; idx++) {
			if (this.isTileOpen(idx) && !skipTiles.includes(idx)) {
				this.openTiles.push(idx);
				this.selectableTiles.include(idx);
			}
		}

		return this.openTiles.length;
	}



	/**
	 * Call this method to setup the board for initial play
	 *
	 *
	 */
	configureBoard() {
		this.curtile = 0;
		this.board.count = this.layout.tiles;
		this.board.pieces = [];
		for (var idx = 0; idx < this.board.count; idx++) {
			this.board.pieces[idx] = {
				pos: this.layout.positions[idx],
				face: -1,
			}
		}
		this.tileCount = this.board.count;
		this.suspended = [];
		this.suspendedCount = 0;
		this.suspensionStats = this.createSuspensionStats();
		this.tilePickerStats = this.createTilePickerStats();
		this.faceAvoidanceStats = this.createFaceAvoidanceStats();
		this.faceAvoidance = new Map();
		this.solution = [];
		this.pendingPairs = [];
		this.assignedFacePairs = [];
	}

	/**
	 * Call this method to pick a random tile from the draw pile of a specific
	 * face set
	 *
	 *
	 * @param {FaceGroup} faceGroup the index into the list of all face sets. A
	 * 		from this face set will be chosen, and removed from the draw pile

	 * @returns {Face} the face of the tile
	 */
	drawOneOf(faceGroup) {
		var faceSet = this.drawPile.faceSets.get(faceGroup);
		var idx = Random.random(faceSet.faces.length);
		var face = faceSet.faces[idx];

		faceSet.faces.splice(idx, 1);

		var facesCount = faceSet.faces.length;
		if (facesCount == 0) {
			this.drawPile.faceSets.delete(faceGroup);
		}
		return face;
	}

	getFaceSetId(faceSet) {
		return faceSet.id ?? Math.floor(faceSet.faces[0] / 4);
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
	getAvoidancePenalty(tile, faceSet) {
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
		if (!this.faceAvoidanceRules.enabled || weight <= 0) {
			return;
		}

		let tileAvoidance = this.faceAvoidance.get(tile);

		if (!tileAvoidance) {
			tileAvoidance = new Map();
			this.faceAvoidance.set(tile, tileAvoidance);
		}

		let current = tileAvoidance.get(faceSet) || 0;
		let next = Math.min(
			this.faceAvoidanceRules.maxWeight ?? 8,
			current + weight
		);

		tileAvoidance.set(faceSet, next);
		this.faceAvoidanceStats.marksAdded++;
	}

	/**
	 * Simulate removing a generated pair and return the tiles that would become
	 * open after that removal. These future frontier tiles are the main targets
	 * for face-avoidance marks because they are likely to be available soon after
	 * the current pair is assigned.
	 *
	 *
	 * @param {TileKey[]} referenceTiles tiles whose face set is being avoided
	 * @param {TileKey[]} removedTiles tiles to remove in the simulated state
	 * @returns {TileKey[]}
	 */
	getFaceAvoidanceTargetsAfterRemoval(referenceTiles, removedTiles = referenceTiles) {
		return new GameGenerator(this).getFaceAvoidanceTargetsAfterRemoval(
			referenceTiles,
			removedTiles
		);
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
	getFaceGroupPenalty(faceGroup, tiles) {
		let faceSet = this.drawPile.faceSets.get(faceGroup);
		let faceSetId = this.getFaceSetId(faceSet);

		return tiles.reduce((penalty, tile) => {
			return penalty + this.getAvoidancePenalty(tile, faceSetId);
		}, 0);
	}

	/**
	 * Pick the lowest-penalty face group that has enough remaining faces.
	 *
	 * Normal pairs pass `requiredFaces = 2`; suspension creation passes
	 * `requiredFaces = 4` because it must split a complete face set between the
	 * placed pair and the suspended future pair.
	 *
	 *
	 * @param {number} requiredFaces
	 * @param {TileKey[]} tiles
	 * @param {boolean} recordDraw
	 * @returns {FaceGroup | -1}
	 */
	getWeightedFaceGroup(requiredFaces, tiles = [], recordDraw = true) {
		let candidates = [];

		for (let [idx, faceSet] of this.drawPile.faceSets) {

			if (faceSet.faces.length < requiredFaces) {
				continue;
			}

			candidates.push({
				index: idx,
				penalty: this.faceAvoidanceRules.enabled
					? this.getFaceGroupPenalty(idx, tiles)
					: 0,
			});
		}

		if (candidates.length === 0) {
			return -1;
		}

		let minPenalty = Math.min(...candidates.map((candidate) => candidate.penalty));
		let best = candidates.filter((candidate) => {
			return candidate.penalty === minPenalty;
		});
		let picked = best[Random.random(best.length)];

		if (this.faceAvoidanceRules.enabled && recordDraw) {
			this.recordFaceAvoidanceDraw(picked.penalty);
		}

		return picked.index;
	}

	/**
	 * Test whether a stable face-group id still has enough remaining faces.
	 *
	 *
	 * @param {FaceGroup} faceGroup
	 * @param {number} requiredFaces
	 * @returns {boolean}
	 */
	canDrawFromFaceGroup(faceGroup, requiredFaces = 2) {
		let faceSet = this.drawPile.faceSets.get(faceGroup);

		return faceSet !== undefined && faceSet.faces.length >= requiredFaces;
	}

	/**
	 * Record face-avoidance assignment pressure for analytics.
	 *
	 *
	 * @param {number} penalty
	 */
	recordFaceAvoidanceDraw(penalty) {
		let stats = this.faceAvoidanceStats;

		stats.drawCount++;
		stats.selectedPenaltyTotal += penalty;
		stats.maxSelectedPenalty = Math.max(stats.maxSelectedPenalty, penalty);

		if (penalty === 0) {
			stats.zeroPenaltyDraws++;
		} else {
			stats.nonZeroPenaltyDraws++;
		}
	}

	/**
	 * Record one face-group assignment in placement order.
	 *
	 * This history is used for analysis and future face-spacing experiments.
	 * Each entry tracks the generated pair tiles plus the stable face-group id
	 * assigned to that pair.
	 *
	 * @param {TileKey} tile1
	 * @param {TileKey} tile2
	 * @param {FaceGroup} faceGroup
	 */
	recordAssignedFacePair(tile1, tile2, faceGroup) {
		return new GameGenerator(this).recordAssignedFacePair(
			tile1,
			tile2,
			faceGroup
		);
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


	getFaceGroupDuplicateCount(reusedIndex, reusedCount, options = {}) {
		let difficulty = Math.max(0, Math.min(1, options.difficulty ?? this.difficulty));
		let easeStrength = Math.max(0, (0.5 - difficulty) * 2);
		let duplicateScale = this.faceAssignmentRules.easyReuseDuplicateScale ?? 0;

		if (duplicateScale <= 0 || easeStrength === 0 || reusedCount <= 0) {
			return 1;
		}

		let closenessRatio = reusedCount <= 1
			? 1
			: 1 - (reusedIndex / (reusedCount - 1));
		let extra = Math.floor(easeStrength * closenessRatio * duplicateScale);

		return 1 + extra;
	}

	getAdjustedDistanceFactor(baseSortValue, preferred = false) {
		let multiplier = this.faceAssignmentRules.preferredMultiplier ?? 0.5;

		return preferred ? baseSortValue * multiplier : baseSortValue;
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
	 * @param {{difficulty?: number}} options
	 * @returns {FaceGroup[]}
	 */
	rankFaceGroups(requiredFaces = 2, pending = null, options = {}) {
		/** @type {Suit[]} */
		let preferredFaceGroup = pending?.preferredFaceGroup;

		let candidates = [];

		for (let [faceGroup, faceSet] of this.drawPile.faceSets) {
			let { faces } = faceSet;

			if (faces.length < requiredFaces) {
				continue;
			}

			/** @type {Suit[]} */
			let suit = this.getSuit(faces[0]);

			let baseFactor = 1;
			let pairCountFactor = faces.length === 4 ? 2 : 1;

			let weightFactor = this.getFaceGroupPenalty(faceGroup, pending.tiles);
			if (weightFactor !== 0)  {
				weightFactor = 1 / weightFactor;
			}

			// find the distance between the face group I'm ranking, and the last time it
			// was assigned. Lower values will be ranked towards easy
			let searchPairs = this.assignedFacePairs.slice().reverse();
			let distance = searchPairs.findIndex((pair) => pair.faceGroup === faceGroup);
			let distanceFactor = distance === -1 ? searchPairs.length : distance + 1;
			distanceFactor = this.getAdjustedDistanceFactor(distanceFactor);

			let dups = this.getFaceGroupDuplicateCount(distance, searchPairs.length, {}) - 1;
//			if (distance !== -1) console.log({distance, distanceFactor, searchPairs, dups, faceGroup, weightPenalty})

			// Find the distance between the face group I'm ranking and the last time the
			// same suit was assigned

			let suitDistance = searchPairs.findIndex((pair) => this.getSuitFromFaceGroup(pair.faceGroup) === suit);
			// let suitDistanceFactor = suitDistance === -1 ?
			// 	searchPairs.length :
			// 	suitDistance + 1;

			let normalized = suitDistance === -1 ?
				1 :
				(suitDistance + 1) / Math.max(1, searchPairs.length);
			let min = 1
			let max = 2;

			let suitDistanceFactor = min + (max - min) * normalized;

			suitDistanceFactor = 1;

			let preferredFactor =  preferredFaceGroup === faceGroup ?
				this.faceAssignmentRules.preferredMultiplier ?? 0.5 :
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

	/**
	 * Return difficulty-window details for the current face-group distance
	 * candidates.
	 *
	 * This uses the same sliding-window idea as tile picking: easy leans toward
	 * the front of the sorted candidate list, hard leans toward the back, and
	 * medium keeps a broader middle.
	 *
	 *
	 * @param {number} requiredFaces
	 * @param {GeneratedPairRecord | TileKey[] | null} pairRecord
	 * @param {{difficulty?: number, minWindowRatio?: number}} options
	 * @returns {{window: RankedFaces[], start: number, end: number, size: number, count: number, difficulty: number}}
	 */
	getRankedFaceGroupWindow(requiredFaces = 2, pairRecord = null, options = {}) {
		let rakedGroups = this.rankFaceGroups(requiredFaces, pairRecord, options);

		return this.getRankedWindow(rakedGroups, options);
	}

	/**
	 * Pick one face-group distance candidate from the difficulty window.
	 *
	 * This helper does not affect face assignment until a caller chooses to use
	 * it. It simply exposes the same sliding-window selection model on top of
	 * the face-group distance ordering.
	 *
	 * @param {number} requiredFaces
	 * @param {GeneratedPairRecord | TileKey[] | null} pairRecord
	 * @param {{difficulty?: number, minWindowRatio?: number}} options
	 * @returns {FaceGroup | false}
	 */
	pickRankedFaceGroup(requiredFaces = 2, pairRecord = null, options = {}) {
		let details = this.getRankedFaceGroupWindow(requiredFaces, pairRecord, options);

		if (details.window.length === 0) {
			return false;
		}

		return details.window[Random.random(details.window.length)];
	}

	drawWeightedFacePairForTiles(tiles = []) {
		var faceSetIdx = this.getWeightedFaceGroup(2, tiles);

		if (faceSetIdx === -1) {
			return false;
		}

		var face1 = this.drawOneOf(faceSetIdx);
		var face2 = this.drawOneOf(faceSetIdx);
		return {face1, face2};
	}

	/**
	 *
	 * @param {FaceGroup} faceGroup
	 * @param {*} tiles
	 * @param {*} recordDraw
	 * @returns {FacePair}
	 */
	drawFacePairFromGroup(faceGroup, tiles = [], recordDraw = true) {
		if (!this.canDrawFromFaceGroup(faceGroup, 2)) {
			return false;
		}

		if (this.faceAvoidanceRules.enabled && recordDraw) {
			this.recordFaceAvoidanceDraw(
				this.getFaceGroupPenalty(faceGroup, tiles)
			);
		}

		return {
			faceGroup,
			face1: this.drawOneOf(faceGroup),
			face2: this.drawOneOf(faceGroup),
		};
	}

	getFullFaceGroup() {
		let faceSets = this.drawPile.faceSets;
		let fullFaceSets = [...faceSets.values()].filter((faceSet) => {
			return faceSet.faces.length === 4;
		});
		let picked = Random.random(fullFaceSets.length);
		let count = 0

		for (let [idx, faceSet] of faceSets) {
			let faces = faceSet.faces;
			let hasFour = faces.length === 4;
			if (count === picked && hasFour) {
				return idx;
			};

			if (hasFour) {
				count++
			}
		}

		return -1;
	}

	/**
	 * Call this method to place tiles on the board. The game number seed will
	 * have already been set.
	 */
	generateLayout() {
		new GameGenerator(this).generate();
	}

	getTilePickerGrid() {
		let grid = {
			width: 32,
			height: 22,
			depth: 8,
		};

		for (let idx = 0; idx < this.board.count; idx++) {
			let {x, y, z} = this.board.pieces[idx].pos;

			if (x === -1) {
				continue;
			}

			grid.width = Math.max(grid.width, x + 2);
			grid.height = Math.max(grid.height, y + 2);
			grid.depth = Math.max(grid.depth, z + 1);
		}

		return grid;
	}

	/**
	 * Build a flattened key for tile-picker horizontal masks. Horizontal masks
	 * include row occupancy at a specific z level so same-level row intersections
	 * can be scored separately from vertical overlap.
	 *
	 *
	 */
	tilePickerHorizontalKey(x, y, z, grid) {
		return z * grid.height * grid.width + y * grid.width + x;
	}

	/**
	 * Build a flattened key for tile-picker vertical masks. Vertical masks ignore
	 * z and compare the four quarter spaces a tile occupies in x/y.
	 *
	 *
	 */
	tilePickerVerticalKey(x, y, grid) {
		return y * grid.width + x;
	}

	numberSetsIntersect(left, right, length) {
		return !new NumberSet([], length).union(left).intersection(right).isEmpty();
	}

	/**
	 * Build one horizontal row mask for each half-height row occupied by every
	 * reference tile. A candidate gets one horizontal intersection for each
	 * reference row mask it touches.
	 *
	 *
	 * @param {TileKey[]} referenceTiles
	 * @param {{width: number, height: number, depth: number}} grid
	 * @returns {NumberSet[]}
	 */
	buildHorizontalReferenceMasks(referenceTiles, grid = this.getTilePickerGrid()) {
		let length = grid.width * grid.height * grid.depth;
		let masks = [];

		for (let tile of referenceTiles) {
			let {y, z} = this.board.pieces[tile].pos;

			for (let row of [y, y + 1]) {
				let mask = new NumberSet([], length);

				for (let x = 0; x < grid.width; x++) {
					mask.include(this.tilePickerHorizontalKey(x, row, z, grid));
				}

				masks.push(mask);
			}
		}

		return masks;
	}

	/**
	 * Build quarter-space x/y masks for reference tiles. These masks allow
	 * vertical scoring to detect quarter overlaps between stacked tiles.
	 *
	 *
	 * @param {TileKey[]} referenceTiles
	 * @param {{width: number, height: number, depth: number}} grid
	 * @returns {NumberSet[]}
	 */
	buildVerticalReferenceMasks(referenceTiles, grid = this.getTilePickerGrid()) {
		return referenceTiles.map((tile) => {
			return this.buildVerticalTileMask(tile, grid);
		});
	}

	/**
	 * Return the occupied same-level spaces for one tile.
	 *
	 *
	 * @param {TileKey} tile
	 * @param {{width: number, height: number, depth: number}} grid
	 * @returns {NumberSet}
	 */
	buildHorizontalTileMask(tile, grid = this.getTilePickerGrid()) {
		let length = grid.width * grid.height * grid.depth;
		let mask = new NumberSet([], length);
		let {x, y, z} = this.board.pieces[tile].pos;

		mask.include(this.tilePickerHorizontalKey(x, y, z, grid));
		mask.include(this.tilePickerHorizontalKey(x + 1, y, z, grid));
		mask.include(this.tilePickerHorizontalKey(x, y + 1, z, grid));
		mask.include(this.tilePickerHorizontalKey(x + 1, y + 1, z, grid));

		return mask;
	}

	/**
	 * Return the four x/y quarter spaces for one tile, ignoring z level.
	 *
	 *
	 * @param {TileKey} tile
	 * @param {{width: number, height: number, depth: number}} grid
	 * @returns {NumberSet}
	 */
	buildVerticalTileMask(tile, grid = this.getTilePickerGrid()) {
		let length = grid.width * grid.height;
		let mask = new NumberSet([], length);
		let {x, y} = this.board.pieces[tile].pos;

		mask.include(this.tilePickerVerticalKey(x, y, grid));
		mask.include(this.tilePickerVerticalKey(x + 1, y, grid));
		mask.include(this.tilePickerVerticalKey(x, y + 1, grid));
		mask.include(this.tilePickerVerticalKey(x + 1, y + 1, grid));

		return mask;
	}

	/**
	 * Count same-level row intersections with the reference tiles.
	 *
	 *
	 * @param {TileKey} tile
	 * @param {NumberSet[]} masks
	 * @param {{width: number, height: number, depth: number}} grid
	 * @returns {number}
	 */
	countHorizontalIntersections(tile, masks, grid = this.getTilePickerGrid()) {
		let length = grid.width * grid.height * grid.depth;
		let candidate = this.buildHorizontalTileMask(tile, grid);

		return masks.filter((mask) => {
			return this.numberSetsIntersect(candidate, mask, length);
		}).length;
	}

	/**
	 * Count x/y quarter-overlaps with the reference tiles, independent of z.
	 *
	 *
	 * @param {TileKey} tile
	 * @param {NumberSet[]} masks
	 * @param {{width: number, height: number, depth: number}} grid
	 * @returns {number}
	 */
	countVerticalIntersections(tile, masks, grid = this.getTilePickerGrid()) {
		let length = grid.width * grid.height;
		let candidate = this.buildVerticalTileMask(tile, grid);

		return masks.filter((mask) => {
			return this.numberSetsIntersect(candidate, mask, length);
		}).length;
	}

	buildUsedSpacesForTilePicker(skipTile = false) {
		let skipTiles = skipTile === false
			? new NumberSet([], this.board.count)
			: new NumberSet([skipTile], this.board.count);

		return this.buildUsedSpacesForPlacedTiles(this.placedTiles, skipTiles);
	}

	/**
	 * Rebuild an occupied-space grid from an arbitrary placed-tile state.
	 * Analysis probes use this instead of mutating `this.usedSpaces`.
	 *
	 *
	 * @param {NumberSet} placedTiles
	 * @param {NumberSet} skipTiles
	 * @returns {Array.<Array.<NumberSet>>}
	 */
	buildUsedSpacesForPlacedTiles(placedTiles, skipTiles = new NumberSet([], this.board.count)) {
		let usedSpaces = [];

		for (let tile = 0; tile < this.board.count; tile++) {
			if (!placedTiles.has(tile) || skipTiles.has(tile)) {
				continue;
			}

			let {x, y, z} = this.board.pieces[tile].pos;

			if (x === -1) {
				continue;
			}

			usedSpaces[z] = usedSpaces[z] || [];
			usedSpaces[z][y] = usedSpaces[z][y] || new NumberSet([]);
			usedSpaces[z][y + 1] = usedSpaces[z][y + 1] || new NumberSet([]);

			let tileSpaces = new NumberSet([x, x + 1]);
			usedSpaces[z][y].union(tileSpaces);
			usedSpaces[z][y + 1].union(tileSpaces);
		}

		return usedSpaces;
	}

	isUsedInSpaces(usedSpaces, x, y, z) {
		if (usedSpaces[z] === undefined) return false;
		else if (usedSpaces[z][y] === undefined) return false;
		else return usedSpaces[z][y].has(x);
	}

	/**
	 * Test whether a tile is open in a simulated board state.
	 *
	 *
	 * @param {TileKey} tile
	 * @param {NumberSet} placedTiles
	 * @param {Array.<Array.<NumberSet>>} usedSpaces
	 * @param {{width: number, height: number, depth: number}} grid
	 * @returns {boolean}
	 */
	isTileOpenInSpaces(tile, placedTiles, usedSpaces, grid = this.getTilePickerGrid()) {
		if (!placedTiles.has(tile)) {
			return false;
		}

		let {x, y, z} = this.board.pieces[tile].pos;
		let goodAcross;
		let goodUp;

		if (x == 1) goodAcross = true;
		else if (x == 29) goodAcross = true;
		else goodAcross = (
			!this.isUsedInSpaces(usedSpaces, x + 2, y, z)
			&& !this.isUsedInSpaces(usedSpaces, x + 2, y + 1, z)
		) || (
			!this.isUsedInSpaces(usedSpaces, x - 1, y, z)
			&& !this.isUsedInSpaces(usedSpaces, x - 1, y + 1, z)
		);

		if (z == grid.depth - 1) goodUp = true;
		else goodUp = !this.isUsedInSpaces(usedSpaces, x, y, z + 1)
			&& !this.isUsedInSpaces(usedSpaces, x + 1, y, z + 1)
			&& !this.isUsedInSpaces(usedSpaces, x, y + 1, z + 1)
			&& !this.isUsedInSpaces(usedSpaces, x + 1, y + 1, z + 1);

		return goodAcross && goodUp;
	}

	/**
	 * Count tiles that would newly become open after removing one tile.
	 *
	 *
	 * @param {TileKey} tile
	 * @param {TileKey[]} openTiles
	 * @returns {number}
	 */
	countTilesFreedByRemoval(tile, openTiles = this.openTiles) {
		let openBefore = new NumberSet(openTiles, this.board.count);
		let placedAfter = new NumberSet([], this.board.count).union(this.placedTiles);
		let usedAfter = this.buildUsedSpacesForTilePicker(tile);
		let grid = this.getTilePickerGrid();
		let freed = 0;

		placedAfter.exclude(tile);

		for (let candidate = 0; candidate < this.board.count; candidate++) {
			if (
				candidate !== tile
				&& !openBefore.has(candidate)
				&& this.isTileOpenInSpaces(candidate, placedAfter, usedAfter, grid)
			) {
				freed++;
			}
		}

		return freed;
	}

	/**
	 * Return all open tiles in a simulated board state.
	 *
	 *
	 * @param {NumberSet} placedTiles
	 * @param {Array.<Array.<NumberSet>>} usedSpaces
	 * @param {{width: number, height: number, depth: number}} grid
	 * @returns {TileKey[]}
	 */
	getOpenTilesInState(placedTiles, usedSpaces, grid = this.getTilePickerGrid()) {
		let openTiles = [];

		for (let tile = 0; tile < this.board.count; tile++) {
			if (this.isTileOpenInSpaces(tile, placedTiles, usedSpaces, grid)) {
				openTiles.push(tile);
			}
		}

		return openTiles;
	}

	countPlacedTiles(placedTiles) {
		let count = 0;

		for (let tile = 0; tile < this.board.count; tile++) {
			if (placedTiles.has(tile)) {
				count++;
			}
		}

		return count;
	}

	/**
	 * Remove a tile from the simulated state used by short-horizon probes.
	 *
	 *
	 * @param {TileKey} tile
	 * @param {NumberSet} placedTiles
	 * @param {Array.<Array.<NumberSet>>} usedSpaces
	 */
	removeTileFromProbeState(tile, placedTiles, usedSpaces) {
		let {x, y, z} = this.board.pieces[tile].pos;

		placedTiles.exclude(tile);

		if (x === -1) {
			return;
		}

		let tileSpaces = new NumberSet([x, x + 1]);

		usedSpaces[z][y].difference(tileSpaces);
		usedSpaces[z][y + 1].difference(tileSpaces);
	}

	/**
	 * Pick a deterministic probe pair from a simulated open set. The probe is
	 * intentionally simple; it measures whether a local removal collapses soon,
	 * not whether the board can be solved optimally.
	 *
	 *
	 * @param {TileKey[]} openTiles
	 * @returns {TileKey[]}
	 */
	pickShortHorizonProbePair(openTiles) {
		return openTiles.slice().sort((left, right) => {
			let leftZ = this.board.pieces[left].pos.z;
			let rightZ = this.board.pieces[right].pos.z;

			return leftZ - rightZ || left - right;
		}).slice(0, 2);
	}

	/**
	 * Simulate a few naive removals after a candidate choice. If the simulated
	 * state runs out of open pairs quickly, hard difficulties can score that
	 * candidate higher because it is more likely to create early dead-end
	 * pressure.
	 *
	 *
	 * @param {TileKey[]} removedTiles
	 * @param {TilePickerOptions} options
	 * @returns {{enabled: boolean, collapsed: boolean, moves: number, remainingTiles: number, pressure: number}}
	 */
	runShortHorizonProbe(removedTiles = [], options = {}) {
		let probeMoves = options.shortHorizonProbeMoves ?? 0;

		if (probeMoves <= 0 || removedTiles.length < 2) {
			return {
				enabled: false,
				collapsed: false,
				moves: 0,
				remainingTiles: 0,
				pressure: 1,
			};
		}

		let grid = this.getTilePickerGrid();
		let placedTiles = new NumberSet([], this.board.count).union(this.placedTiles);

		removedTiles.forEach((tile) => placedTiles.exclude(tile));

		let usedSpaces = this.buildUsedSpacesForPlacedTiles(placedTiles);

		for (let move = 0; move < probeMoves; move++) {
			let openTiles = this.getOpenTilesInState(placedTiles, usedSpaces, grid);

			if (openTiles.length < 2) {
				return {
					enabled: true,
					collapsed: true,
					moves: move,
					remainingTiles: this.countPlacedTiles(placedTiles),
					pressure: this.getShortHorizonPressure(move, true, options),
				};
			}

			let pair = this.pickShortHorizonProbePair(openTiles);

			pair.forEach((tile) => this.removeTileFromProbeState(
				tile,
				placedTiles,
				usedSpaces
			));
		}

		return {
			enabled: true,
			collapsed: false,
			moves: probeMoves,
			remainingTiles: this.countPlacedTiles(placedTiles),
			pressure: this.getShortHorizonPressure(probeMoves, false, options),
		};
	}

	getStackKey(tile) {
		let {x, y} = this.board.pieces[tile].pos;

		return `${x}:${y}`;
	}

	/**
	 * Test whether removing these tiles would leave one stack taller than the
	 * number of other remaining stack groups. That shape is avoided as a safety
	 * valve because it can force a terminal stack without enough balancing tiles.
	 *
	 *
	 * @param {TileKey[]} removedTiles
	 * @returns {boolean}
	 */
	wouldCreateDominantStack(removedTiles = []) {
		return this.getStackBalanceAfterRemoval(removedTiles).createsDominantStack;
	}

	/**
	 * Summarize the stack landscape after a hypothetical removal.
	 *
	 * `balanceMargin` is other stack groups minus the tallest stack height. A
	 * negative margin means the tallest stack dominates the remaining board.
	 *
	 *
	 * @param {TileKey[]} removedTiles
	 * @returns {{stackGroupCount: number, maxStackHeight: number, otherStackGroupCount: number, balanceMargin: number, createsDominantStack: boolean}}
	 */
	getStackBalanceAfterRemoval(removedTiles = []) {
		let removed = new NumberSet(removedTiles, this.board.count);
		let stackCounts = {};
		let groupCount = 0;

		for (let tile = 0; tile < this.board.count; tile++) {
			if (!this.placedTiles.has(tile) || removed.has(tile)) {
				continue;
			}

			let key = this.getStackKey(tile);

			if (stackCounts[key] === undefined) {
				stackCounts[key] = 0;
				groupCount++;
			}

			stackCounts[key]++;
		}

		if (groupCount === 0) {
			return {
				stackGroupCount: 0,
				maxStackHeight: 0,
				otherStackGroupCount: 0,
				balanceMargin: 0,
				createsDominantStack: false,
			};
		}

		let maxStackHeight = Math.max(...Object.values(stackCounts));
		let otherStackGroupCount = groupCount - 1;

		return {
			stackGroupCount: groupCount,
			maxStackHeight,
			otherStackGroupCount,
			balanceMargin: otherStackGroupCount - maxStackHeight,
			createsDominantStack: maxStackHeight > otherStackGroupCount,
		};
	}

	/**
	 * Score open tiles for generation-time removal.
	 *
	 * Lower scores are the easy end of the sorted list; higher scores are the
	 * hard end. The difficulty window chooses from different slices of that
	 * sorted list, so hard boards bias toward low-open-pressure choices, lower
	 * z choices, reference intersections, stack-balance pressure, and optional
	 * short-horizon collapses.
	 *
	 *
	 * @param {TileKey[]} referenceTiles tiles already chosen for the same generated pair/triple
	 * @param {TilePickerOptions} options
	 * @returns {TilePickScore[]}
	 */
	scoreOpenTiles(referenceTiles = [], options = {}) {
		let grid = this.getTilePickerGrid();
		let openTiles = options.openTiles || this.openTiles;
		let horizontalMultiplier = options.horizontalMultiplier ?? 2;
		let verticalMultiplier = options.verticalMultiplier ?? 4;
		let highestZOrder = options.highestZOrder ?? grid.depth;
		let zDenominator = Math.max(1, highestZOrder);
		let zBias = ((options.difficulty ?? this.difficulty) - 0.5) * 2;
		let references = new NumberSet(referenceTiles, this.board.count);
		let candidates = openTiles.filter((tile) => !references.has(tile));
		let pendingRemovedTiles = options.pendingRemovedTiles || [];
		let balanceByTile = new Map();
		if (options.enforceStackBalance) {
			let originalCount = candidates.length;

			candidates = candidates.filter((tile) => {
				let balance = this.getStackBalanceAfterRemoval([
					...pendingRemovedTiles,
					tile,
				]);

				balanceByTile.set(tile, balance);

				return !balance.createsDominantStack;
			});
			this.tilePickerStats.stackSafetyRejected += originalCount - candidates.length;
		}
		let horizontalMasks = this.buildHorizontalReferenceMasks(referenceTiles, grid);
		let verticalMasks = this.buildVerticalReferenceMasks(referenceTiles, grid);
		let freedCounts = candidates.map((tile) => {
			return this.countTilesFreedByRemoval(tile, openTiles);
		});
		let uniqueFreedCounts = [...new Set(freedCounts)].sort((a, b) => a - b);
		let freedRankByCount = new Map(
			uniqueFreedCounts.map((count, index) => {
				return [count, uniqueFreedCounts.length - index];
			})
		);

		return candidates.map((tile, index) => {
			let {z} = this.board.pieces[tile].pos;
			let freedCount = freedCounts[index];
			let freedRank = freedRankByCount.get(freedCount);
			let openPressure = this.getOpenPressure(freedCount, options);
			let horizontalIntersections = this.countHorizontalIntersections(
				tile,
				horizontalMasks,
				grid
			);
			let verticalIntersections = this.countVerticalIntersections(
				tile,
				verticalMasks,
				grid
			);
			let balance = balanceByTile.get(tile) || this.getStackBalanceAfterRemoval([
				...pendingRemovedTiles,
				tile,
			]);
			let balancePressure = this.getBalancePressure(balance, options);
			let shortHorizon = this.runShortHorizonProbe([
				...pendingRemovedTiles,
				tile,
			], options);
			let zWeight = (z + 0.5) / zDenominator;
			let centeredZWeight = (zWeight - 0.5) * 2;
			let zPressure = Math.max(0.25, 1 + (centeredZWeight * zBias));
			let weight = freedRank
				* openPressure
				* zPressure
				* Math.pow(horizontalMultiplier, horizontalIntersections)
				* Math.pow(verticalMultiplier, verticalIntersections)
				* balancePressure
				* shortHorizon.pressure;

			return {
				tile,
				weight,
				freedCount,
				freedRank,
				openPressure,
				z,
				zWeight,
				zPressure,
				horizontalIntersections,
				verticalIntersections,
				balanceMargin: balance.balanceMargin,
				balancePressure,
				shortHorizonMoves: shortHorizon.moves,
				shortHorizonRemainingTiles: shortHorizon.remainingTiles,
				shortHorizonPressure: shortHorizon.pressure,
				shortHorizonEnabled: shortHorizon.enabled,
				shortHorizonCollapsed: shortHorizon.collapsed,
			};
		}).sort((left, right) => {
			return left.weight - right.weight || left.tile - right.tile;
		});
	}

	getBalancePressure(balance, options = {}) {
		let difficulty = Math.max(0, Math.min(1, options.difficulty ?? this.difficulty));
		let hardMultiplier = options.balancePressureMultiplier ??
			Math.max(0, (difficulty - 0.5) * 2);

		if (hardMultiplier === 0) {
			return 1;
		}

		let maxBalanceMargin = options.maxBalanceMargin ?? 8;
		let safeMargin = Math.max(0, balance.balanceMargin);
		let clampedMargin = Math.min(safeMargin, maxBalanceMargin);
		let pressure = maxBalanceMargin - clampedMargin + 1;

		return 1 + (pressure - 1) * hardMultiplier;
	}

	/**
	 * Convert short-horizon collapse into a scoring multiplier.
	 *
	 * Earlier collapses receive more pressure. Non-collapsing probes stay neutral
	 * so the probe does not dominate normal tile scoring.
	 *
	 *
	 * @param {number} moves
	 * @param {boolean} collapsed
	 * @param {TilePickerOptions} options
	 * @returns {number}
	 */
	getShortHorizonPressure(moves, collapsed, options = {}) {
		let multiplier = options.shortHorizonPressureMultiplier ?? 0;

		if (multiplier === 0 || !collapsed) {
			return 1;
		}

		let probeMoves = Math.max(1, options.shortHorizonProbeMoves ?? 1);
		let pressure = probeMoves - Math.min(moves, probeMoves) + 1;

		return 1 + (pressure - 1) * multiplier;
	}

	/**
	 * Convert the number of newly opened tiles into a hard-side scoring
	 * multiplier. Harder settings prefer choices that open fewer tiles, keeping
	 * the board tighter and preserving stack pressure.
	 *
	 *
	 * @param {number} freedCount
	 * @param {TilePickerOptions} options
	 * @returns {number}
	 */
	getOpenPressure(freedCount, options = {}) {
		let difficulty = Math.max(0, Math.min(1, options.difficulty ?? this.difficulty));
		let hardMultiplier = options.openPressureMultiplier ??
			Math.max(0, (difficulty - 0.5) * 2);

		if (hardMultiplier === 0) {
			return 1;
		}

		let maxFreedPressure = options.maxFreedPressure ?? 6;
		let clampedFreedCount = Math.min(freedCount, maxFreedPressure);
		let pressure = maxFreedPressure - clampedFreedCount + 1;

		return 1 + (pressure - 1) * hardMultiplier;
	}

	/**
	 * Choose the difficulty-dependent slice of the sorted tile scores.
	 *
	 * Medium difficulty keeps the whole list. Easy and hard shrink the window
	 * toward opposite ends: easy toward lower scores, hard toward higher scores.
	 *
	 * @param {unknown[]} rankings
	 * @param {TilePickerOptions} options
	 * @returns {{window: unknown[], start: number, end: number, size: number, count: number, difficulty: number}}
	 */
	getRankedWindow(rankings, options = {}) {
		let difficulty = Math.max(0, Math.min(1, options.difficulty ?? this.difficulty));
		let minWindowRatio = Math.max(0, Math.min(1, options.minWindowRatio ?? 0.25));
		let count = rankings.length;

		if (count === 0) {
			return {
				window: [],
				start: 0,
				end: 0,
				size: 0,
				count,
				difficulty,
			};
		}

		let edgePressure = Math.abs(difficulty - 0.5) * 2;
		let windowRatio = 1 - edgePressure * (1 - minWindowRatio);
		let windowSize = Math.max(1, Math.ceil(count * windowRatio));
		let start = Math.round((count - windowSize) * difficulty);

		return {
			window: rankings.slice(start, start + windowSize),
			start,
			end: start + windowSize,
			size: windowSize,
			count,
			difficulty,
		};
	}

	/**
	 * Accumulate picker telemetry for the analysis CLI.
	 *
	 * @param {TilePickScore} selected
	 * @param {TilePickScore[]} scoredTiles
	 * @param {{start: number, end: number, size: number}} windowDetails
	 * @param {string} context
	 */
	recordTilePickerStats(selected, scoredTiles, windowDetails, context = 'picks') {
		let stats = this.tilePickerStats;

		stats.picks++;
		stats.weightTotal += selected.weight;
		stats.freedCountTotal += selected.freedCount;
		stats.freedRankTotal += selected.freedRank;
		stats.openPressureTotal += selected.openPressure;
		stats.zTotal += selected.z;
		stats.zWeightTotal += selected.zWeight;
		stats.horizontalIntersectionsTotal += selected.horizontalIntersections;
		stats.verticalIntersectionsTotal += selected.verticalIntersections;
		stats.balanceMarginTotal += selected.balanceMargin;
		stats.balancePressureTotal += selected.balancePressure;
		if (selected.shortHorizonEnabled) {
			stats.shortHorizonProbeCount++;
			stats.shortHorizonMovesTotal += selected.shortHorizonMoves;
			stats.shortHorizonRemainingTilesTotal += selected.shortHorizonRemainingTiles;
			stats.shortHorizonPressureTotal += selected.shortHorizonPressure;
			if (selected.shortHorizonCollapsed) {
				stats.shortHorizonCollapseCount++;
			}
		}
		stats.candidateCountTotal += scoredTiles.length;
		stats.windowSizeTotal += windowDetails.size;
		stats.windowStartTotal += windowDetails.start;
		stats.windowEndTotal += windowDetails.end;

		if (context in stats) {
			stats[context]++;
		}
	}

	/**
	 * Score open tiles and pick one tile from the difficulty window.
	 *
	 *
	 * @param {TileKey[]} referenceTiles
	 * @param {TilePickerOptions} options
	 * @returns {TilePickScore | false}
	 */
	pickWeightedTile(referenceTiles = [], options = {}) {
		let scoredTiles = this.scoreOpenTiles(referenceTiles, options);

		return this.pickWeightedTileFromScores(scoredTiles, options);
	}

	pickWeightedTileFromScores(scoredTiles, options = {}) {
		let windowDetails = this.getRankedWindow(scoredTiles, options);
		let window = windowDetails.window;

		if (window.length === 0) {
			return false;
		}

		let selected = window[Random.random(window.length)];

		this.recordTilePickerStats(selected, scoredTiles, windowDetails, options.context);

		return selected;
	}

	shuffleTileScores(scores) {
		let shuffled = scores.slice();

		for (let idx = shuffled.length - 1; idx > 0; idx--) {
			let swap = Random.random(idx + 1);
			let temp = shuffled[idx];

			shuffled[idx] = shuffled[swap];
			shuffled[swap] = temp;
		}

		return shuffled;
	}

	/**
	 * Call this method to determine if the two tiles match and are playable.
	 *
	 *
	 * @param {TileKey} tile1
	 * @param {TileKey} tile2
	 * @return {Boolean} true if the two tiles match and can be played
	 */
	isPlayablePair(tile1, tile2) {
		return this.selectableTiles.has(tile1) && this.selectableTiles.has(tile2) && (tile1 != tile2) &&
			this.doFacesMatch(this.board.pieces[tile1].face, this.board.pieces[tile2].face)
	}

	/**
	 * Call this method to place a pair of tiles into play. These are indexes
	 * into the board object. the board already records where they will be
	 * placed.
	 *
	 *
	 * @param {TileKey} tile1 the first tile of a pair
	 * @param {TileKey} tile2 the second tile of the pair.
	 *
	 * @fires addTile
	 */
	 addPair(tile1, tile2) {
		this.addPos(this.board.pieces[tile1].pos, tile1);
		this.addPos(this.board.pieces[tile2].pos, tile2);

		this.fire('addTile', tile1)
		this.fire('addTile', tile2)
	}

	/**
	 * Call this method to remove two tiles from the board.
	 *
	 *
	 * @param {TileKey} tile1 first tile of the pair
	 * @param {TileKey} tile2 second tile of the pair
	 *
	 * @fires removeTile
	 */
	removePair(tile1, tile2) {
		this.subtractPos(this.board.pieces[tile1].pos, tile1);
		this.subtractPos(this.board.pieces[tile2].pos, tile2);

		this.fire('removeTile', tile1)
		this.fire('removeTile', tile2)
	}

	/**
	 * Call this method to fire the updateState event with the latest state.
	 *
	 *
	 * @fires updateState
	 */
	sendState() {
		var remaining = this.tileCount;
		var won = remaining === 0
		var lost = !this.arePlayablePairs();
		var canUndo = this.canUndo() && !won;
		var canRedo = this.canRedo() && !won;
		var open = new NumberSet([], 144).union(this.selectableTiles)
		var placed = new NumberSet([], 144).union(this.placedTiles);
		var multiUndoHistory = this.getUndoHistory();

		var update = {canUndo , canRedo, remaining, won, lost, open, placed, multiUndoHistory};

		this.fire('updateState', update);
	}

	/**
	 * Call this method to check if there are any more tiles left to play. It
	 * will always recalculate all the playable pairs
	 *
	 *
	 * @returns {Boolean} true if there are stiull tiles to play, false
	 * 		otherwise
	 */
	arePlayablePairs() {
		var pairs = this.calcPlayablePairs(-1);
		return pairs.length > 0;
	}

	/**
	 * Call this method to find all the playable pairs of tiles. This can be
	 * done for all the tiles on the board, or only in referece to a specfic
	 * tile when looking for hints.
	 *
	 *
	 * @param {TileKey} [selectedTile] if set, it will only find matches against
	 * 		the given tile;
	 *
	 * @returns {Array.<TilePair>} pairs of tiles that can be played.
	 */
	calcPlayablePairs(selectedTile) {
		this.calcOpenTiles();

		var pairs = [];

		if (selectedTile == -1)
		{
			// loop throough all the tiles on the board
			for (let outer = 0; outer < this.board.count; outer++)
			{
				// if this tile is currently playable, find other matching tiles
				if (this.selectableTiles.has(outer)) {
					// We only need to check tiles higher than we are, earlier
					// tiles would have already matched us.
					for (let inner = outer + 1; inner < this.board.count; inner++)
					{
						if (this.isPlayablePair(outer, inner))
							pairs.push({tile1: outer, tile2: inner})
					}
				}
			}
		} else {
			// loop through all tiles matching against the selected tile
			for (let idx = 0; idx < this.board.count; idx++) {
				if (this.isPlayablePair(selectedTile, idx))
					pairs.push({tile1: selectedTile, tile2: idx})
			}
		}

		return pairs;
	}

	/**
	 * Call this method to determine if the player can redo a previously undone
	 * move
	 *
	 *
	 * @returns {Boolean} true if there is a move to redo
	 */
	canRedo() {
		return this.redoStack.length !== 0;
	}

	/**
	 * Call this method to determine if there is a move to be undone
	 *
	 *
	 * @returns {Boolean} true if there is
	 */
	canUndo() {
		return this.undoStack.length !== 0;
	}

	getUndoHistory() {
		var history = [];

		for (let index = 0; index < this.undoStack.length; index += 2) {
			let tile1 = this.undoStack[index];
			let tile2 = this.undoStack[index + 1];
			let piece1 = this.board?.pieces?.[tile1];
			let piece2 = this.board?.pieces?.[tile2];

			if (!piece1 || !piece2) {
				continue;
			}

			history.push({
				id: `move-${index / 2 + 1}-${tile1}-${tile2}`,
				moveNumber: index / 2 + 1,
				tile1,
				tile2,
				face1: piece1.face,
				face2: piece2.face,
			});
		}

		return history;
	}


	/**
	 * Call this method to determine of the given faces are in the same FaceSet
	 *
	 *
	 * @param {Face} face1
	 * @param {Face} face2
	 *
	 * @returns {Boolean} true if they are in the same FaceSet
	 */
	doFacesMatch(face1, face2) {
		var set1 = Math.floor(face1 / 4);
		var set2 = Math.floor(face2 / 4);

		return Boolean(set1 === set2);
	}

	/**
	 * Call this method to remove two tiles from the board. It is assumed that
	 * all the appropriate matching has already been done.
	 *
	 *
	 * @param {TileKey} tile1
	 * @param {TileKey} tile2
	 */
	playPair(tile1, tile2) {
		// Remove them from the grid
		this.removePair(tile1, tile2);

		// add to the undo stack, and wipe out the redo stack
		this.undoStack.push(tile1);
		this.undoStack.push(tile2);
		this.redoStack = [];
		this.recordAction({type: "play-pair", tile1, tile2});

		this.tileCount -= 2;
	}

	//============================================================================
	// Public methods
	//============================================================================

	/**
	 * Call this method to set the layout that will be used to generate the
	 * game.
	 *
	 * @param {Layout} layout
	 */
	 setLayout(layout) {
		this.layout = layout;
		this.board = {};

		this.usedSpaces = [];
		this.placedTiles = new NumberSet([]);
		this.openTiles = [];
	}

	/**
	 * Call this to generate a new game. The passed gameNbr will be used to seed
	 * the random number generator so that the same gameNbr will produce the same
	 * tile arrangement.
	 *
	 * @param {Number} boardNbr the number of the game to generate. This number
	 * 		will seed the random number generator so that the same game number
	 * 		produces the same board
	 */
	 generateGame(boardNbr) {
		var badLayout;
		var tries = 0;

		this.boardNbr = boardNbr;
		Random.randomize(boardNbr);

		do {
			badLayout = false;
			try {
				this.configureBoard();
				this.generateLayout();
			} catch (err) {
				console.log(err);
				if (err == "BadLayoutException") {
					badLayout = true;
					tries++;
					if (tries > 3) {
						var msg = 'Unable to generate a solvable puzzle from the given game. There may be no way to place the last tiles for a valid game.';
						break;
					}
				} else {
					console.error(err);
					console.error(err.stack);
					break;
				}
			}
		} while (badLayout == true);

		this.undoStack = [];
		this.redoStack = [];

		// Calculate all the tiles that can be selected
		this.calcOpenTiles();

		this.fire('newBoard', this.board);
		this.sendState();
	}

	/**
	 * Call this method if the the two tiles form a match and are playable
	 *
	 * @param {TileKey} tile1
	 * @param {TileKey} tile2
	 * @returns {Boolean} true if the tiles match and can be played
	 */
	canPlay(tile1, tile2) {
		return this.isPlayablePair(tile1, tile2);
	}

	/**
	 * Call this method to remove two tiles from the board. It is assumed that
	 * all the appropriate matching has already been done.
	 *
	 * @fires updateState
	 * @param {TileKey} tile1
	 * @param {TileKey} tile2
	 */
	playTiles(tile1, tile2) {
		this.playPair(tile1, tile2);
		this.sendState();
	}

	/**
	 * Call this method to undo a played move. The game keeps a stack of all tiles
	 * played back to the beginning of the game
	 *
	 * @fires updateState
	 * @returns {TilePair} the two tiles that were added back to the board
	 */
	 undo() {
		if (!this.canUndo()) return;

		var tile1 = this.undoStack.pop();
		var tile2 = this.undoStack.pop();

		this.redoStack.push(tile1);
		this.redoStack.push(tile2);

		this.addPair(tile1, tile2);
		this.recordAction({type: "undo-pair", tile1, tile2});

		this.tileCount += 2;
		this.sendState();

		return {tile1, tile2};
	}

	/**
	 * Call this method to redo a previously undone move
	 *
	 * @fires updateState
	 * @returns {TilePair} the two tiles that were removed from the board, or
	 * 		false if there was nothing to redo
	 */

	redo() {
		if (!this.canRedo()) return;

		var tile1 = this.redoStack.pop();
		var tile2 = this.redoStack.pop();

		this.undoStack.push(tile1);
		this.undoStack.push(tile2);

		this.removePair(tile1, tile2);
		this.recordAction({type: "redo-pair", tile1, tile2});

		this.tileCount -= 2;
		this.sendState();
		return {tile1, tile2};
	}

	/**
	 * Call this method to get one solution to remove all tiles from the board
	 *
	 * @returns {Array.<Tiles>} the solution
	 */
	getSolution() {
		return this.solution;
	}

	getSuspensionStats() {
		let stats = this.suspensionStats;
		let average = function(total, count) {
			return count === 0 ? 0 : total / count;
		};

		return {
			...stats,
			forceReleaseAverageOpenTiles: average(
				stats.forceReleaseOpenTilesTotal,
				stats.forceReleased
			),
			forceReleaseAverageSuspended: average(
				stats.forceReleaseSuspendedTotal,
				stats.forceReleased
			),
			forceReleaseAverageOpenSuspended: average(
				stats.forceReleaseOpenSuspendedTotal,
				stats.forceReleased
			),
			forceReleaseAverageEffectiveOpen: average(
				stats.forceReleaseEffectiveOpenTotal,
				stats.forceReleased
			),
			skipOpenTilesAverageOpenTiles: average(
				stats.skipOpenTilesOpenTilesTotal,
				stats.skippedByOpenTiles
			),
			skipOpenTilesAverageSuspended: average(
				stats.skipOpenTilesSuspendedTotal,
				stats.skippedByOpenTiles
			),
			skipOpenTilesAverageOpenSuspended: average(
				stats.skipOpenTilesOpenSuspendedTotal,
				stats.skippedByOpenTiles
			),
			skipOpenTilesAverageEffectiveOpen: average(
				stats.skipOpenTilesEffectiveOpenTotal,
				stats.skippedByOpenTiles
			),
		};
	}

	getTilePickerStats() {
		let stats = this.tilePickerStats;
		let average = function(total, count) {
			return count === 0 ? 0 : total / count;
		};

		return {
			...stats,
			averageWeight: average(stats.weightTotal, stats.picks),
			averageFreedCount: average(stats.freedCountTotal, stats.picks),
			averageFreedRank: average(stats.freedRankTotal, stats.picks),
			averageOpenPressure: average(stats.openPressureTotal, stats.picks),
			averageZ: average(stats.zTotal, stats.picks),
			averageZWeight: average(stats.zWeightTotal, stats.picks),
			averageBalanceMargin: average(stats.balanceMarginTotal, stats.picks),
			averageBalancePressure: average(stats.balancePressureTotal, stats.picks),
			averageShortHorizonMoves: average(
				stats.shortHorizonMovesTotal,
				stats.shortHorizonProbeCount
			),
			averageShortHorizonRemainingTiles: average(
				stats.shortHorizonRemainingTilesTotal,
				stats.shortHorizonProbeCount
			),
			averageShortHorizonPressure: average(
				stats.shortHorizonPressureTotal,
				stats.shortHorizonProbeCount
			),
			shortHorizonCollapseRate: average(
				stats.shortHorizonCollapseCount,
				stats.shortHorizonProbeCount
			),
			averageHorizontalIntersections: average(
				stats.horizontalIntersectionsTotal,
				stats.picks
			),
			averageVerticalIntersections: average(
				stats.verticalIntersectionsTotal,
				stats.picks
			),
			averageCandidateCount: average(stats.candidateCountTotal, stats.picks),
			averageWindowSize: average(stats.windowSizeTotal, stats.picks),
			averageWindowStart: average(stats.windowStartTotal, stats.picks),
			averageWindowEnd: average(stats.windowEndTotal, stats.picks),
		};
	}

	getFaceAvoidanceStats() {
		let stats = this.faceAvoidanceStats;
		let average = function(total, count) {
			return count === 0 ? 0 : total / count;
		};

		return {
			...stats,
			averageSelectedPenalty: average(
				stats.selectedPenaltyTotal,
				stats.drawCount
			),
			nonZeroPenaltyDrawRate: average(
				stats.nonZeroPenaltyDraws,
				stats.drawCount
			),
		};
	}

	/**
	 * Call this method to get a list of hints. Hints are an array of tile pairs
	 * that can be played. If you pass it a tile it will only find tiles that
	 * match that one.
	 *
	 * @param {TileKey} [tile] the option tile to get hints for
	 * @returns {Array.<TilePair>} the playable tiles. Array will be empty if
	 * 		there are none.
	 */
	getHints(tile) {
		return this.calcPlayablePairs(tile)
	}

	/**
	 * Call this method to restart the same game.
	 */
	 startOver() {
		while (this.canUndo()) {
			this.undo();
		}
	}

	/**
	 * Call this method to have the engine fire the current state
	 */
	checkState() {
		this.sendState();
	}
}
