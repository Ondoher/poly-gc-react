import { makeEventable } from '@polylith/core';
import Random from 'utils/random.js'
import NumberSet from 'utils/NumberSet.js';

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

		/** @type {Suspended[]} */
		this.suspended = [];

		/** @type {number} */
		this.suspendedCount = 0;

		/** @type {number[][]} */
		this.pairs = [];

		this.suspensionStats = this.createSuspensionStats();

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
		 * @type {Array.<Tile>}
		 */
		this.openTiles = [];

		/**
		 * Track one guaranteed solution path for the active board. The tile
		 * indexes are recorded in the order they were assigned during board
		 * generation.
		 *
		 * @type {Array.<Tile>}
		 */
		this.solution = [];

		/**
		 * Track the remaining face groups available to draw from while the board
		 * is being generated.
		 *
		 * @type {DrawPile}
		 */
		this.drawPile = {
			count: 36,
			faceSets: []
		};

		this.setLayout();
	}

	setupSuspensionRules(rules) {
		this.suspensionRules = rules;
		this.configureBoard();
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

	//============================================================================
	// Private methods
	//============================================================================

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
	 * @private
	 * @param {TilePosition} position the position on the board to be occupied
	 * @param {Tile} tile the tile that will occupy that position
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
	 * @private
	 * @param {TilePosition} position the position the tile occupies on the board
	 * @param {Tile} tile which tile is being removed
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
	 * @private
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
	 * @private
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
	 * @private
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
		this.solution = [];
		this.pairs = [];
	}

	/**
	 * Call this method to pick a random tile from the draw pile of a specific
	 * face set
	 *
	 * @private
	 * @param {FaceGroup} faceGroup the index into the list of all face sets. A
	 * 		from this face set will be chosen, and removed from the draw pile

	 * @returns {Face} the face of the tile
	 */
	drawOneOf(faceGroup) {
		var faceSet = this.drawPile.faceSets[faceGroup];
		var idx = Random.random(faceSet.faces.length);
		var face = faceSet.faces[idx];

		faceSet.faces.splice(idx, 1);

		var facesCount = faceSet.faces.length;
		if (facesCount == 0) {
			this.drawPile.faceSets.splice(faceGroup, 1);
			this.drawPile.count--;
		}
		return face;
	}

	/**
	 *	Call this method to remove a matching pair of tile faces the
	 * 	the draw pile.
	 *
	 * @private
	 * @returns {FacePair} a random pair of matching faces from the draw pile
	 */
	drawFacePair() {
		var faceSetIdx = Random.random(this.drawPile.count);
		var face1 = this.drawOneOf(faceSetIdx);
		var face2 = this.drawOneOf(faceSetIdx);
		return {face1, face2};
	}

	getFullFaceGroup() {
		let faceSets = this.drawPile.faceSets;
		let fullFaceSets = faceSets.filter((faceSet) => faceSet.faces.length === 4);
		let picked = Random.random(fullFaceSets.length);
		let count = 0

		for (let idx = 0; idx < faceSets.length; idx++) {
			let faces = faceSets[idx].faces;
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

	hasFullFaceSet() {
		let faceSets = this.drawPile.faceSets;
		return !faceSets.every((faceSet) => faceSet.faces.length !== 4);

	}

	drawFaceSet() {
		let faceGroup = this.getFullFaceGroup();

		if (faceGroup === -1) {
			return false;
		}

		const faces = this.drawPile.faceSets[faceGroup].faces;

		this.drawPile.faceSets.splice(faceGroup, 1);
		this.drawPile.count--;

		return faces;
	}

	/**
	 * Call this method to place tiles on the board. The game number seed will
	 * have already been set.
	 */
	generateLayout() {
		var tileCount = this.board.count;

		// start with a sorted pile of tiles
		this.shuffleTiles();

		// Mark every playable space as occupied. Board generation consists of
		// randomly removing playable pairs of tiles and assigning them matching
		// faces.
		for (let idx = 0; idx < tileCount; idx++) {
			this.addPos(this.board.pieces[idx].pos, idx);
		}

		// Randomly picking pairs of tiles could lead to a situation where
		// there are no playable tiles, but not all tiles have been played. This
		// should be rare and would only happen with a single remaining stack
		// of tiles. This may throw an error, which the caller will catch and
		// try again

		// Place all the tiles randomly, two at a time.
		for (let idx = 0; idx < Math.floor(tileCount / 2); idx++) {
			this.placeRandomPair();
		}

		this.fillInRemainingFaces();

		// now that we are done, go back and mark every playable space as
		// occupied again
		for (let idx = 0; idx < tileCount; idx++) {
			this.addPos(this.board.pieces[idx].pos, idx);
		}
	}

	/**
	 * Call this method to select a random open tile. If called with remove
	 * false subsequent calls may pick that same tile.
	 *
	 * @private
	 * @param {pickTileOptions} options - if set to true, remove the tile and add to the
	 * 	solution
	 * @returns {Tile} an open time
	 */
	pickOpenTile(options = {remove: true, useTile: false}) {
		if (this.openTiles.length === 0) {
			throw "BadLayoutException";
		}

	// Pick one of the available tiles. Remember that these tiles do not have
	// faces yet, so the only selection criteria is that they are open
		var which = Random.random(this.openTiles.length);
		var chosen = options.useTile === false ? this.openTiles[which] : options.useTile;

		if (options.remove) {
		// remember this as part of the guaranteed solution
			this.solution.push(chosen);

		// remove from playable tiles so it cannot be chosen again
			this.openTiles = this.openTiles.filter((tile) => tile !== chosen)
		}

		return chosen;
	}

	/**
	 * Call this method to test if a given suspension is ready to be released
	 *
	 * @param {Suspended} suspended
	 * @return {Boolean}
	 */
	testRelease(suspended) {
		if (this.openTiles.length <= 2) {
			return true
		}

		const placed = Math.floor(this.solution.length / 2);
		const delta = placed - suspended.placedAt;
		const open = this.openTiles.length;

		const hitPlacedTarget = delta >= suspended.placementCount;
		const hitOpenTarget = open <= suspended.openCount;

		if (this.suspensionRules.matchType === "both") {
			return hitPlacedTarget && hitOpenTarget
		}

		return hitPlacedTarget || hitOpenTarget;
	}

	/**
	 * make sure there are enough free tiles to manage all the nested suspended
	 * tiles
	 *
	 * @returns
	 */
	mustRelease() {
		if (this.suspended.length === 0) {
			return false;
		}

		// need to reserve a match for the suspended tiles
		let effectiveOpen = this.openTiles.length - this.suspended.length;

		// leave a little wiggle room
		if (effectiveOpen < (this.suspensionRules.forceReleaseAtEffectiveOpen ?? 4)) {
			return true;
		}

		return false;
	}

	countOpenSuspensions() {
		return this.suspended.filter(function(suspended) {
			return this.isTileOpen(suspended.tile);
		}, this).length;
	}

	recordSuspensionSafetyStats(prefix, effectiveOpen) {
		let stats = this.suspensionStats;

		stats[`${prefix}OpenTilesTotal`] += this.openTiles.length;
		stats[`${prefix}SuspendedTotal`] += this.suspended.length;
		stats[`${prefix}OpenSuspendedTotal`] += this.countOpenSuspensions();
		stats[`${prefix}EffectiveOpenTotal`] += effectiveOpen;
	}

	/**
	 * Release the suspended tile
	 *
	 * @param {number} index
	 */
	releaseSuspendedTile(index) {
		let suspended = this.suspended[index];
		let faces = suspended.faces;
		let stats = this.suspensionStats;
		let tile1 = this.pickOpenTile({remove: true, useTile: suspended.tile});
		let tile2 = this.pickOpenTile();

		this.subtractPos(this.board.pieces[tile1].pos, tile1);
		this.subtractPos(this.board.pieces[tile2].pos, tile2);
		this.board.pieces[tile1].face = faces[0]
		this.board.pieces[tile2].face = faces[1]

		this.suspended.splice(index, 1);
		stats.released++;
	}

	canSuspend() {
		// need to reserve a match for the suspended tiles
		let effectiveOpen = this.openTiles.length - this.suspended.length;

		let chance = Random.random();
		let rules = this.suspensionRules;
		let stats = this.suspensionStats;
		stats.attempts++;
		if (chance >= rules.frequency) {
			stats.skippedByFrequency++;
			return false;
		}

		if (this.suspendedCount >= rules.maxSuspended) {
			stats.skippedByTotalCap++;
			return false;
		}

		if (this.suspended.length >= rules.maxNested) {
			stats.skippedByNestedCap++;
			return false;
		}

		// suspending tiles becomes less useful as there are fewer pieces, leave some wiggle room
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
	 * place a pair of tiles and place a third in suspension
	 */
	suspendTile() {
		let rules = this.suspensionRules;
		let faces = this.drawFaceSet();
		let tile1 = this.pickOpenTile();
		let tile2 = this.pickOpenTile();
		let tile3 = this.pickOpenTile({remove: false, useTile: false});

		// remove the chosen pair
		this.subtractPos(this.board.pieces[tile1].pos, tile1);
		this.subtractPos(this.board.pieces[tile2].pos, tile2);

		// when part of a suspended tile set, the faces are assigned, immediately
		this.board.pieces[tile1].face = faces[0];
		this.board.pieces[tile2].face = faces[1];

		let placementCount = Random.randomCurveRange(rules.placementCount.min, rules.placementCount.max);
		let openCount = Random.randomCurveRange(rules.maxOpenCount.min, rules.maxOpenCount.max);

		/** @type {Suspended} */
		let suspended = {
			tile: tile3,
			faces: [faces[2], faces[3]],
			placedAt: Math.floor(this.solution.length / 2),
			placementCount,
			openCount
		}

		this.suspended.push(suspended);
		this.suspendedCount++;
		this.suspensionStats.created++;
		this.suspensionStats.maxNestedSeen = Math.max(
			this.suspensionStats.maxNestedSeen,
			this.suspended.length
		);
	}


	findReleasableTile() {
		let force = this.mustRelease();
		if (this.suspended.length === 0) {
			return false;
		}

		let idx = this.suspended.findIndex((suspended ) => {
			return this.testRelease(suspended);
		});

		if (idx === -1 && force) {
			let effectiveOpen = this.openTiles.length - this.suspended.length;
			this.recordSuspensionSafetyStats('forceRelease', effectiveOpen);
			this.suspensionStats.forceReleased++;
			return 0;
		} else if (idx === -1) {
			return false;
		}

		return idx;
	}


	/**
	 * Call this method to randomly pick two tiles that are open, and assign
	 * them matching faces. Then remove them from play
	 * @private
	 */
	placeRandomPair() {
		this.calcOpenTiles();

		let toRelease = this.findReleasableTile();
		if (toRelease !== false) {
			this.releaseSuspendedTile(toRelease);
			return;
		}

		let willSuspend = this.canSuspend()
		if (willSuspend) {
			this.suspendTile();
			return;
		}

		// pick the two tiles
		let tile1 = this.pickOpenTile();
		let tile2 = this.pickOpenTile();

		// remove the chosen pair
		this.subtractPos(this.board.pieces[tile1].pos, tile1);
		this.subtractPos(this.board.pieces[tile2].pos, tile2);

		// assign the faces later
		this.pairs.push([tile1, tile2]);
	}


	fillInRemainingFaces() {
		for (let tiles of this.pairs) {
			let pair = this.drawFacePair();

			// assign faces to selected tiles
			this.board.pieces[tiles[0]].face = pair.face1;
			this.board.pieces[tiles[1]].face = pair.face2;
		}
	}

	/**
	 * Call this method to determine if the two tiles match and are playable.
	 *
	 * @private
	 * @param {Tile} tile1
	 * @param {Tile} tile2
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
	 * @private
	 * @param {Tile} tile1 the first tile of a pair
	 * @param {Tile} tile2 the second tile of the pair.
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
	 * @private
	 * @param {Tile} tile1 first tile of the pair
	 * @param {Tile} tile2 second tile of the pair
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
	 * Call this method to shuffle the tiles. This method doesn't actually
	 * shuffle the tiles, it just resets the drawpile back to its full state.
	 * Tiles will be drawn randomly from the drawpile.
	 * @private
	 */
	shuffleTiles() {
		// to properly handle layouts with fewer than 144 tiles we will fill the
		// draw pile with full facesets
		var fullsetList = this.makeSequentialArray(0, 144 / 4);
		var leftover = this.layout.tiles % 4;
		var drawpileCount = Math.floor(this.layout.tiles / 4);

		this.drawPile.faceSets = [];
		this.drawPile.count = 0;
		for (let idx = 0; idx < drawpileCount; idx++) {
			let set = Random.pickOne(fullsetList);
			this.drawPile.faceSets.push({faces: this.makeSequentialArray(set * 4, 4)})
			this.drawPile.count++;
		}

		if (leftover) {
			let set = Random.pickOne(fullsetList);
			this.drawPile.faceSets.push({faces: this.makeSequentialArray(set * 4, 2)})
			this.drawPile.count++;
		}
	}

	/**
	 * Call this method to fire the updateState event with the latest state.
	 *
	 * @private
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

		var update = {canUndo , canRedo, remaining, won, lost, open, placed};

		this.fire('updateState', update);
	}

	/**
	 * Call this method to check if there are any more tiles left to play. It
	 * will always recalculate all the playable pairs
	 *
	 * @private
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
	 * @private
	 * @param {Tile} [selectedTile] if set, it will only find matches against
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
	 * @private
	 * @returns {Boolean} true if there is a move to redo
	 */
	canRedo() {
		return this.redoStack.length !== 0;
	}

	/**
	 * Call this method to determine if there is a move to be undone
	 *
	 * @private
	 * @returns {Boolean} true if there is
	 */
	canUndo() {
		return this.undoStack.length !== 0;
	}


	/**
	 * Call this method to determine of the given faces are in the same FaceSet
	 *
	 * @private
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
	 * @private
	 * @param {Tile} tile1
	 * @param {Tile} tile2
	 */
	playPair(tile1, tile2) {
		// Remove them from the grid
		this.removePair(tile1, tile2);

		// add to the undo stack, and wipe out the redo stack
		this.undoStack.push(tile1);
		this.undoStack.push(tile2);
		this.redoStack = [];

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
	 * @param {Tile} tile1
	 * @param {Tile} tile2
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
	 * @param {Tile} tile1
	 * @param {Tile} tile2
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

	/**
	 * Call this method to get a list of hints. Hints are an array of tile pairs
	 * that can be played. If you pass it a tile it will only find tiles that
	 * match that one.
	 *
	 * @param {Tile} [tile] the option tile to get hints for
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
