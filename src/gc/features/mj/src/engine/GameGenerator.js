import Random from 'utils/random.js'

/**
 * Coordinates construction of a generated Mahjongg game.
 *
 * The engine still owns board state, tile occupancy, face drawing, and the
 * lower-level difficulty helpers. This class is the first extraction step for
 * the generation policy so Engine can move back toward runtime game state and
 * gameplay operations.
 */
export default class GameGenerator {
	/**
	 * @param {Engine} engine
	 */
	constructor(engine) {
		this.engine = engine;
	}

	shuffleTiles() {
		let engine = this.engine;
		let fullsetList = engine.makeSequentialArray(0, 144 / 4);
		let leftover = engine.layout.tiles % 4;
		let drawpileCount = Math.floor(engine.layout.tiles / 4);

		engine.drawPile.faceSets = new Map();
		for (let idx = 0; idx < drawpileCount; idx++) {
			let set = Random.pickOne(fullsetList);
			engine.drawPile.faceSets.set(set, {
				id: set,
				faces: engine.makeSequentialArray(set * 4, 4)
			});
		}

		if (leftover) {
			let set = Random.pickOne(fullsetList);
			engine.drawPile.faceSets.set(set, {
				id: set,
				faces: engine.makeSequentialArray(set * 4, 2)
			});
		}
	}

	getTilePickerOptions() {
		let engine = this.engine;

		return {
			...engine.tilePickerRules,
			difficulty: engine.difficulty,
		};
	}

	getPreferredFaceGroup(requiredFaces, tiles = []) {
		let engine = this.engine;

		if (!engine.faceAvoidanceRules.enabled) {
			return false;
		}

		let faceGroup = engine.getWeightedFaceGroup(requiredFaces, tiles, false);

		if (faceGroup === -1) {
			return false;
		}

		engine.faceAvoidanceStats.preferredFaceGroups++;

		return faceGroup;
	}

	getFaceSetForFace(face) {
		return Math.floor(face / 4);
	}

	markFaceAvoidanceAroundTiles(referenceTiles, faceSet, weight) {
		let engine = this.engine;

		if (!engine.faceAvoidanceRules.enabled) {
			return;
		}

		this.getFaceAvoidanceNeighborhood(referenceTiles).forEach((tile) => {
			engine.addFaceAvoidance(tile, faceSet, weight);
		});
	}

	markFaceAvoidanceForTargets(targets, faceSet, weight) {
		let engine = this.engine;

		if (!engine.faceAvoidanceRules.enabled) {
			return;
		}

		targets.forEach((tile) => {
			engine.addFaceAvoidance(tile, faceSet, weight);
		});
	}

	getFaceAvoidanceNeighborhood(referenceTiles) {
		let engine = this.engine;
		let references = new Set(referenceTiles);

		return engine.openTiles.filter((tile) => {
			return !references.has(tile);
		});
	}

	getFaceAvoidanceTargetsAfterRemoval(referenceTiles, removedTiles = referenceTiles) {
		let engine = this.engine;

		if (!engine.faceAvoidanceRules.enabled) {
			return [];
		}

		let references = new Set(referenceTiles);
		let placedTiles = new Set();

		for (let tile = 0; tile < engine.board.count; tile++) {
			if (engine.placedTiles.has(tile)) {
				placedTiles.add(tile);
			}
		}

		removedTiles.forEach((tile) => placedTiles.delete(tile));

		let usedSpaces = engine.buildUsedSpacesForPlacedTiles({
			has(tile) {
				return placedTiles.has(tile);
			},
		});

		return engine.getOpenTilesInState({
			has(tile) {
				return placedTiles.has(tile);
			},
		}, usedSpaces).filter((tile) => {
			return !references.has(tile);
		});
	}

	recordAssignedFacePair(tile1, tile2, faceGroup) {
		this.engine.assignedFacePairs.push({
			tile1,
			tile2,
			faceGroup,
		});
	}

	hasFullFaceSet() {
		let faceSets = this.engine.drawPile.faceSets;

		return [...faceSets.values()].some((faceSet) => {
			return faceSet.faces.length === 4;
		});
	}

	drawWeightedFaceSetForTiles(tiles = []) {
		let engine = this.engine;
		let faceGroup = engine.faceAvoidanceRules.enabled
			? engine.getWeightedFaceGroup(4, tiles)
			: engine.getFullFaceGroup();

		if (faceGroup === -1) {
			return false;
		}

		const faces = engine.drawPile.faceSets.get(faceGroup).faces;

		engine.drawPile.faceSets.delete(faceGroup);

		return faces;
	}

	drawPreferredFacePairForRecord(pairRecord) {
		let engine = this.engine;
		let record = Array.isArray(pairRecord) ? null : pairRecord;
		let tiles = record?.tiles || pairRecord;

		if (
			record
			&& record.faceGroup !== false
			&& record.faceGroup !== undefined
			&& record.face1 !== undefined
			&& record.face2 !== undefined
		) {
			return {
				faceGroup: record.faceGroup,
				face1: record.face1,
				face2: record.face2,
			};
		}

		let distanceCandidate = engine.pickFaceGroupDistanceCandidate(2, record || tiles);

		if (distanceCandidate) {
			let resolved = engine.drawFacePairFromGroup(distanceCandidate.faceGroup, tiles);

			if (record) {
				record.faceGroup = resolved.faceGroup;
				record.face1 = resolved.face1;
				record.face2 = resolved.face2;
			}

			return resolved;
		}

		let weighted = engine.drawWeightedFacePairForTiles(tiles);

		if (!weighted) {
			return false;
		}

		let faceGroup = Math.floor(weighted.face1 / 4);

		if (record) {
			record.faceGroup = faceGroup;
			record.face1 = weighted.face1;
			record.face2 = weighted.face2;
		}

		return {
			faceGroup,
			face1: weighted.face1,
			face2: weighted.face2,
		};
	}

	pickWeightedPair(options = {}) {
		let engine = this.engine;
		let firstScores = engine.scoreOpenTiles([], options);
		let firstWindowDetails = engine.getDifficultyWindowDetails(firstScores, options);
		let firstCandidates = engine.shuffleTileScores([
			...firstWindowDetails.window,
			...firstScores.filter((score) => {
				return !firstWindowDetails.window.some((windowScore) => {
					return windowScore.tile === score.tile;
				});
			}),
		]);

		for (let first of firstCandidates) {
			let second = engine.pickWeightedTile([first.tile], {
				...options,
				enforceStackBalance: true,
				pendingRemovedTiles: [first.tile],
				context: 'normalSecondPicks',
			});

			if (second) {
				engine.recordTilePickerStats(
					first,
					firstScores,
					firstWindowDetails,
					'normalFirstPicks'
				);

				return {
					tile1: first.tile,
					tile2: second.tile,
					picks: [first, second],
				};
			}
		}

		throw "BadLayoutException";
	}

	pickWeightedSuspensionTriple(options = {}) {
		let engine = this.engine;
		let first = engine.pickWeightedTile([], {
			...options,
			context: 'suspensionFirstPicks',
		});
		if (!first) {
			throw "BadLayoutException";
		}
		let second = engine.pickWeightedTile([first.tile], {
			...options,
			context: 'suspensionSecondPicks',
		});
		if (!second) {
			throw "BadLayoutException";
		}
		let third = engine.pickWeightedTile([first.tile, second.tile], {
			...options,
			context: 'suspensionThirdPicks',
		});
		if (!third) {
			throw "BadLayoutException";
		}
		let picks = [first, second, third];
		let ranked = picks.slice().sort((left, right) => {
			return right.weight - left.weight || right.tile - left.tile;
		});
		let selected = ranked.find((candidate) => {
			let placed = picks
				.filter((pick) => pick.tile !== candidate.tile)
				.map((pick) => pick.tile);

			return !engine.wouldCreateDominantStack(placed);
		});

		if (!selected) {
			engine.tilePickerStats.stackSafetyRejected++;
			throw "BadLayoutException";
		}

		let placed = picks
			.filter((pick) => pick.tile !== selected.tile)
			.sort((left, right) => {
				return left.weight - right.weight || left.tile - right.tile;
			});

		return {
			placed: [placed[0].tile, placed[1].tile],
			suspended: selected.tile,
			picks,
		};
	}

	pickWeightedReleasedPartner(suspended, options = {}) {
		let engine = this.engine;
		let referenceTiles = [
			...(suspended.originalPair || []),
			suspended.tile,
		];

		return engine.pickWeightedTile(referenceTiles, {
			...options,
			enforceStackBalance: true,
			pendingRemovedTiles: [suspended.tile],
			context: 'releasedPartnerPicks',
		});
	}

	/**
	 * Construct a generated game from the engine's current layout and settings.
	 *
	 * Generation starts with every layout position occupied, removes tiles in
	 * generated solution order, assigns any immediate suspension faces, then
	 * fills deferred normal-pair faces and restores the board occupancy for play.
	 */
	generate() {
		let engine = this.engine;
		let tileCount = engine.board.count;

		this.shuffleTiles();

		for (let idx = 0; idx < tileCount; idx++) {
			engine.addPos(engine.board.pieces[idx].pos, idx);
		}

		for (let idx = 0; idx < Math.floor(tileCount / 2); idx++) {
			this.placeGeneratedPair();
		}

		this.fillInRemainingFaces();

		for (let idx = 0; idx < tileCount; idx++) {
			engine.addPos(engine.board.pieces[idx].pos, idx);
		}
	}

	/**
	 * Place the next generated pair. This coordinates the active construction
	 * states: release an existing suspension, create a new suspension, or place a
	 * normal weighted pair.
	 *
	 * @private
	 */
	placeGeneratedPair() {
		let engine = this.engine;

		engine.calcOpenTiles();

		let toRelease = this.findReleasableTile();
		if (toRelease !== false) {
			this.placeWeightedReleasedSuspensionPair(toRelease);
			return;
		}

		let willSuspend = this.canSuspend();
		if (willSuspend) {
			this.placeWeightedSuspensionPair();
			return;
		}

		this.placeWeightedNormalPair();
	}

	/**
	 * Test whether a suspended tile is eligible for release.
	 *
	 * @private
	 * @param {Suspended} suspended
	 * @returns {boolean}
	 */
	testRelease(suspended) {
		let engine = this.engine;

		if (engine.openTiles.length <= 2) {
			return true
		}

		const placed = Math.floor(engine.solution.length / 2);
		const delta = placed - suspended.placedAt;
		const open = engine.openTiles.length;

		const hitPlacedTarget = delta >= suspended.placementCount;
		const hitOpenTarget = open <= suspended.openCount;

		if (engine.suspensionRules.matchType === "both") {
			return hitPlacedTarget && hitOpenTarget
		}

		return hitPlacedTarget || hitOpenTarget;
	}

	/**
	 * Test whether a suspension must be released to keep enough effective open
	 * tiles for active suspensions to find partners.
	 *
	 * @private
	 * @returns {boolean}
	 */
	mustRelease() {
		let engine = this.engine;

		if (engine.suspended.length === 0) {
			return false;
		}

		let effectiveOpen = engine.openTiles.length - engine.suspended.length;

		return effectiveOpen < (engine.suspensionRules.forceReleaseAtEffectiveOpen ?? 4);
	}

	/**
	 * Count active suspended tiles that are currently open.
	 *
	 * @private
	 * @returns {number}
	 */
	countOpenSuspensions() {
		let engine = this.engine;

		return engine.suspended.filter(function(suspended) {
			return engine.isTileOpen(suspended.tile);
		}).length;
	}

	/**
	 * Record suspension safety telemetry for the analysis CLI.
	 *
	 * @private
	 * @param {string} prefix
	 * @param {number} effectiveOpen
	 */
	recordSuspensionSafetyStats(prefix, effectiveOpen) {
		let engine = this.engine;
		let stats = engine.suspensionStats;

		stats[`${prefix}OpenTilesTotal`] += engine.openTiles.length;
		stats[`${prefix}SuspendedTotal`] += engine.suspended.length;
		stats[`${prefix}OpenSuspendedTotal`] += this.countOpenSuspensions();
		stats[`${prefix}EffectiveOpenTotal`] += effectiveOpen;
	}

	/**
	 * Test whether generation should create a suspension at the current state.
	 *
	 * @private
	 * @returns {boolean}
	 */
	canSuspend() {
		let engine = this.engine;
		let effectiveOpen = engine.openTiles.length - engine.suspended.length;
		let chance = Random.random();
		let rules = engine.suspensionRules;
		let stats = engine.suspensionStats;

		stats.attempts++;
		if (chance >= rules.frequency) {
			stats.skippedByFrequency++;
			return false;
		}

		if (engine.suspendedCount >= rules.maxSuspended) {
			stats.skippedByTotalCap++;
			return false;
		}

		if (engine.suspended.length >= rules.maxNested) {
			stats.skippedByNestedCap++;
			return false;
		}

		if (effectiveOpen < (rules.suspendAtEffectiveOpen ?? 6)) {
			stats.skippedByOpenTiles++;
			this.recordSuspensionSafetyStats('skipOpenTiles', effectiveOpen);
			return false;
		}

		if (!this.hasFullFaceSet()) {
			stats.skippedByNoFullFaceSet++;
			return false;
		}

		return true;
	}

	/**
	 * Find a suspended tile that should be released next.
	 *
	 * @private
	 * @returns {number | false}
	 */
	findReleasableTile() {
		let engine = this.engine;
		let force = this.mustRelease();

		if (engine.suspended.length === 0) {
			return false;
		}

		let idx = engine.suspended.findIndex((suspended) => {
			return this.testRelease(suspended);
		});

		if (idx === -1 && force) {
			let effectiveOpen = engine.openTiles.length - engine.suspended.length;

			this.recordSuspensionSafetyStats('forceRelease', effectiveOpen);
			engine.suspensionStats.forceReleased++;
			return 0;
		} else if (idx === -1) {
			return false;
		}

		return idx;
	}

	/**
	 * Remove a generated pair and append it to the guaranteed solution path.
	 *
	 * @private
	 * @param {Tile} tile1
	 * @param {Tile} tile2
	 */
	removeGeneratedPair(tile1, tile2) {
		let engine = this.engine;

		engine.solution.push(tile1);
		engine.solution.push(tile2);

		engine.openTiles = engine.openTiles.filter((tile) => {
			return tile !== tile1 && tile !== tile2;
		});

		engine.subtractPos(engine.board.pieces[tile1].pos, tile1);
		engine.subtractPos(engine.board.pieces[tile2].pos, tile2);
	}

	/**
	 * Create the deferred face-assignment record for a normal generated pair.
	 *
	 * @private
	 * @param {Tile} tile1
	 * @param {Tile} tile2
	 * @param {Tile[]} avoidanceTargets
	 * @returns {GeneratedPairRecord}
	 */
	createGeneratedPairRecord(tile1, tile2, avoidanceTargets = this.getFaceAvoidanceNeighborhood([
		tile1,
		tile2,
	])) {
		let engine = this.engine;

		return {
			tiles: [tile1, tile2],
			preferredFaceGroup: this.getPreferredFaceGroup(2, [tile1, tile2]),
			faceGroup: false,
			avoidanceTargets,
			avoidanceWeight: engine.faceAvoidanceRules.weight ?? 1,
		};
	}

	/**
	 * Place a normal generated pair using the weighted tile picker.
	 *
	 * @private
	 */
	placeWeightedNormalPair() {
		let engine = this.engine;
		let pair = this.pickWeightedPair(this.getTilePickerOptions());
		let pairRecord = this.createGeneratedPairRecord(
			pair.tile1,
			pair.tile2,
			this.getFaceAvoidanceTargetsAfterRemoval([pair.tile1, pair.tile2])
		);

		this.removeGeneratedPair(pair.tile1, pair.tile2);
		engine.pairs.push(pairRecord);
	}

	/**
	 * Create a weighted suspension.
	 *
	 * @private
	 */
	placeWeightedSuspensionPair() {
		let engine = this.engine;
		let rules = engine.suspensionRules;
		let triple;

		try {
			triple = this.pickWeightedSuspensionTriple(this.getTilePickerOptions());
		} catch (err) {
			if (err !== "BadLayoutException") {
				throw err;
			}

			this.placeWeightedNormalPair();
			return;
		}

		let tile1 = triple.placed[0];
		let tile2 = triple.placed[1];
		let tile3 = triple.suspended;
		let avoidanceTargets = this.getFaceAvoidanceTargetsAfterRemoval(
			[tile1, tile2, tile3],
			[tile1, tile2]
		);
		let faces = this.drawWeightedFaceSetForTiles([tile1, tile2, tile3]);
		let faceGroup = this.getFaceSetForFace(faces[0]);

		this.removeGeneratedPair(tile1, tile2);

		engine.board.pieces[tile1].face = faces[0];
		engine.board.pieces[tile2].face = faces[1];
		this.recordAssignedFacePair(
			tile1,
			tile2,
			faceGroup
		);
		this.markFaceAvoidanceForTargets(
			avoidanceTargets,
			faceGroup,
			engine.faceAvoidanceRules.suspensionWeight ?? 3
		);

		let placementCount = Random.randomCurveRange(
			rules.placementCount.min,
			rules.placementCount.max
		);
		let openCount = Random.randomCurveRange(
			rules.maxOpenCount.min,
			rules.maxOpenCount.max
		);

		/** @type {Suspended} */
		let suspended = {
			tile: tile3,
			faces: [faces[2], faces[3]],
			placedAt: Math.floor(engine.solution.length / 2),
			placementCount,
			openCount,
			originalPair: [tile1, tile2],
			faceGroup,
		}

		engine.suspended.push(suspended);
		engine.suspendedCount++;
		engine.suspensionStats.created++;
		engine.suspensionStats.maxNestedSeen = Math.max(
			engine.suspensionStats.maxNestedSeen,
			engine.suspended.length
		);
	}

	/**
	 * Release a weighted suspension by assigning the reserved faces.
	 *
	 * @private
	 * @param {number} index
	 */
	placeWeightedReleasedSuspensionPair(index) {
		let engine = this.engine;
		let suspended = engine.suspended[index];
		let faces = suspended.faces;
		let partner = this.pickWeightedReleasedPartner(
			suspended,
			this.getTilePickerOptions()
		);

		if (!partner) {
			throw "BadLayoutException";
		}

		this.removeGeneratedPair(suspended.tile, partner.tile);
		engine.board.pieces[suspended.tile].face = faces[0]
		engine.board.pieces[partner.tile].face = faces[1]
		this.recordAssignedFacePair(
			suspended.tile,
			partner.tile,
			suspended.faceGroup
		);
		this.markFaceAvoidanceAroundTiles(
			[suspended.tile, partner.tile],
			suspended.faceGroup,
			engine.faceAvoidanceRules.suspensionWeight ?? 3
		);

		engine.suspended.splice(index, 1);
		engine.suspensionStats.released++;
	}

	/**
	 * Assign faces to all deferred normal pair records.
	 *
	 * @private
	 */
	fillInRemainingFaces() {
		let engine = this.engine;

		for (let pairRecord of engine.pairs) {
			let tiles = pairRecord.tiles || pairRecord;
			let pair = this.drawPreferredFacePairForRecord(pairRecord);

			engine.board.pieces[tiles[0]].face = pair.face1;
			engine.board.pieces[tiles[1]].face = pair.face2;
			this.recordAssignedFacePair(
				tiles[0],
				tiles[1],
				this.getFaceSetForFace(pair.face1)
			);
			this.markFaceAvoidanceForTargets(
				pairRecord.avoidanceTargets || [],
				this.getFaceSetForFace(pair.face1),
				pairRecord.avoidanceWeight ?? engine.faceAvoidanceRules.weight ?? 1
			);
		}
	}
}
