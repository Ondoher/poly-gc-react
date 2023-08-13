import { makeEventable } from '@polylith/core';
import Random from 'utils/random.js'
import NumberSet from 'utils/NumberSet.js';
import Turtle from '../layouts/turtle.json';
import './types.js'

/**
 * This is the engine for the mah jongg solitaire game. It keeps the game state
 * and provides methods to manipulate it.
 */
export default class MjEngine {
	constructor() {
		makeEventable(this);
		this.seasonFaceSetArray = [34,35,36,37];
		this.flowerFaceSetArray = [38,39,40,41];

		/** @type {Board} */
		this.board = {};

		/** @type {Layout} */
		this.layout = {};

		this.undoStack = [];
		this.redoStack = [];

		this.selectableTiles = new NumberSet([], 144);

		// The current state of the game is not kept in the game board, that
		// just specifies which tile faces are where on the grid. usedSpaces
		// tracks which spots on the grid are opccupied by a tile, and usedTiles
		// keeps track of which tiles have been played.

		// where tiles are currently placed on the entire grid. two dimentional
		// array of sets, indexed on z and y axis. Each bit in a set is the x
		// coordinate of a grid space.
		this.usedSpaces = [];

		// uses 144 bits, one for each tile. The corresponding bit in the set
		// records whether the tile has been played or not
		this.usedTiles = new NumberSet([]);

		/**
		 * Records which tiles are open
		 *
		 * @type {Array.<Tile>}
		 */
		this.playableTiles = [];

		// This is a guaranteed solution. It's the order the tiles were placed
		// in
		this.solution = [];

		/** Random faces will be pulled from this data structure as the board is
		 * being constructed
		 *
		 * @type {DrawPile}
		 */
		this.drawPile = {
			count: 36,
			faceSets: []
		};

		this.setLayout();
	}

	//============================================================================
	// Private methods
	//============================================================================

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
	 * @param {TilePositon} position the position on the board to be occupied
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
		this.usedTiles.include(tile);
	}

	/**
	 * Call this method to remove a tile from the board. Removing a tile from
	 * the board does not change the board layout, but will release the grid
	 * space that had been previously occupied.
	 *
	 * @private
	 * @param {TilePositon} position the position the tile occupies on the board
	 * @param {Tile} tile which tile is being removed
	 */
	subtractPos(position, tile) {
		var {x, y, z} = position;

		if (x == -1) return;

		var tmpSet = new NumberSet([x, x + 1]);
		this.usedSpaces[z][y].difference(tmpSet);
		this.usedSpaces[z][y + 1].difference(tmpSet);

		this.usedTiles.exclude(tile);
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

	/**
	 * Call this method to find all the tiles on the board that can be played.
	 * Playable tiles will be stored in this.playableTiles
	 *
	 * @private
	 * @returns {Number} the number of tiles that can be played
	 */
	calcPlayableTiles() {
		this.playableTiles = [];

		for (let idx = 0; idx < this.board.count; idx++) {
			let goodThis, goodAcross, goodUp;

			goodThis = this.usedTiles.has(idx);
			let {x, y, z} = this.board.pieces[idx].pos;

			if (x === 1) goodAcross = true;
			else if (x === 29) goodAcross = true;
			else goodAcross = (!this.isUsed(x + 2, y, z) && !this.isUsed(x + 2, y + 1, z)) || (!this.isUsed(x -1, y, z) && !this.isUsed(x - 1, y + 1, z));

			if (z === 7) goodUp = true;
			else goodUp = !this.isUsed(x, y, z + 1) && !this.isUsed(x + 1, y, z + 1) && !this.isUsed(x, y + 1, z + 1) && !this.isUsed(x + 1, y + 1, z + 1);

			if (goodThis && goodAcross && goodUp) {
				this.playableTiles.push(idx);
			}
		}

		return this.playableTiles.length;
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
	 * @returns {FacePair} a random pair of matchign faces from the draw pile
	 */
	drawFacePair() {
		var faceSetIdx = Random.random(this.drawPile.count);
		var face1 = this.drawOneOf(faceSetIdx);
		var face2 = this.drawOneOf(faceSetIdx);
		return {face1, face2};
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
		// randomly removing playable pairs of tiles and assigning them matcing
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

		// now that we are done, go back and mark every playable space as
		// occupied again
		for (let idx = 0; idx < tileCount; idx++) {
			this.addPos(this.board.pieces[idx].pos, idx);
		}
	}

	/**
	 * Call this method to select a random playable tile
	 *
	 * @private
	 * @returns {Tile} the tile to assign a face to
	 */
	pickPlayableTile() {
		if (this.playableTiles.length === 0)
			throw "BadLayoutException";

	// Pick one of the available tiles. Remember that these tiles do not have
	// faces yet, so the only selection criteria is that they are open
		var which = Random.random(this.playableTiles.length);
		var tile = this.playableTiles[which];

	// remember this as part of the gauranteed solution
		this.solution.push(tile);

	// remove from playable tiles so it cannot be chosen again
		this.playableTiles.splice(which, 1);

		return tile;
	}

	/**
	 * Call this method to andomly pick two tiles that are open, and assign
	 * them matching faces. Then remove them from play
	 * @private
	 */
	placeRandomPair() {
		this.calcPlayableTiles();

		// pick 2 playable positions
		var tile1 = this.pickPlayableTile();
		var tile2 = this.pickPlayableTile();

		// remove them from the board
		this.subtractPos(this.board.pieces[tile1].pos, tile1);
		this.subtractPos(this.board.pieces[tile2].pos, tile2);

		// pick 2 faces from the pile
		var pair = this.drawFacePair();

		// assign faces to selected tiles
		this.board.pieces[tile1].face = pair.face1;
		this.board.pieces[tile2].face = pair.face2;
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
		this.drawPile.faceSets = [];
		this.drawPile.count = 36;

		for (var idx = 0; idx < 144; idx++) {
			var faceSetIdx = Math.floor(idx / 4);
			if (!this.drawPile.faceSets[faceSetIdx]) this.drawPile.faceSets[faceSetIdx] = {};
			if (!this.drawPile.faceSets[faceSetIdx].faces) this.drawPile.faceSets[faceSetIdx].faces = [];
			this.drawPile.faceSets[faceSetIdx].faces.push(idx);
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
		var played = new NumberSet([], 144).union(this.usedTiles);

		var update = {canUndo , canRedo, remaining, lost, open, played};

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
		this.calcSelectableTiles();

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
	 * Call this method to locate all tiles are open on the top and also to the
	 * left or the right. This updates the instance variable selectableTiles
	 * which is a NumberSet that can be checked for inclusion.
	 *
	 * @private
	 */
	calcSelectableTiles() {
		var goodThis, goodAcross, goodUp;

		this.selectableTiles.clear();

		for (let idx = 0; idx < this.board.count; idx++) {
			goodThis = this.usedTiles.has(idx);

			let {x, y, z} = this.board.pieces[idx].pos;

			if (x == 1) goodAcross = true;
			else if (x == 29) goodAcross = true;
			else goodAcross = (!this.isUsed(x + 2, y, z) && !this.isUsed(x + 2, y + 1, z)) || (!this.isUsed(x -1, y, z) && !this.isUsed(x - 1, y + 1, z));

			if (z == 7) goodUp = true;
			else goodUp = !this.isUsed(x, y, z + 1) && !this.isUsed(x + 1, y, z + 1) && !this.isUsed(x, y + 1, z + 1) && !this.isUsed(x + 1, y + 1, z + 1);

			if (goodThis && goodAcross && goodUp) this.selectableTiles.include(idx);
		}
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
		if (layout === undefined) this.layout = Turtle;
		else this.layout = layout;
		this.board = {};

		this.usedSpaces = [];
		this.usedTiles = new NumberSet([]);
		this.playableTiles = [];
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
		this.calcSelectableTiles();

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
