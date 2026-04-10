import Random from '../../src/gc/utils/random.js';

const FULL_TILE_FACE_COUNT = 144;
const FACES_PER_SET = 4;
const BAD_LAYOUT = 'BadLayoutException';

function makeSequentialArray(start, count) {
	return Array.from({length: count}, function(_value, index) {
		return index + start;
	});
}

function keyForSpace(x, y, z) {
	return `${x},${y},${z}`;
}

function clonePosition(position) {
	return {
		x: position.x,
		y: position.y,
		z: position.z,
	};
}

/**
 * Standalone deterministic board generator for difficulty experiments.
 *
 * This intentionally mirrors the current engine's board-generation shape while
 * staying outside the engine code. It produces a solved-by-construction board:
 * tiles are removed from a fully occupied layout in playable pairs, assigned
 * matching faces, and then restored to the final starting board.
 */
export class MahjonggRandomBoardGenerator {
	constructor(layout, options = {}) {
		this.layout = layout;
		this.maxAttempts = options.maxAttempts ?? 3;
		this.board = null;
		this.solution = [];
		this.placedTiles = new Set();
		this.usedSpaces = new Set();
		this.drawPile = {
			faceSets: [],
		};
	}

	generate(seed = 1) {
		Random.randomize(Number(seed));

		for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
			try {
				this.configureBoard();
				this.generateLayout();

				return {
					board: this.board,
					solution: this.solution.slice(),
					seed: Number(seed),
					attempt,
				};
			} catch (err) {
				if (err !== BAD_LAYOUT || attempt === this.maxAttempts) {
					throw err;
				}
			}
		}

		throw new Error('Unable to generate board.');
	}

	configureBoard() {
		this.board = {
			count: this.layout.tiles,
			pieces: this.layout.positions.map(function(position) {
				return {
					pos: clonePosition(position),
					face: -1,
				};
			}),
		};
		this.solution = [];
		this.placedTiles = new Set();
		this.usedSpaces = new Set();
		this.createDrawPile();
	}

	generateLayout() {
		for (let tile = 0; tile < this.board.count; tile++) {
			this.addTile(tile);
		}

		for (let idx = 0; idx < Math.floor(this.board.count / 2); idx++) {
			this.placeRandomPair();
		}

		this.rebuildOccupiedSpaces();
	}

	createDrawPile() {
		var fullSetList = makeSequentialArray(0, FULL_TILE_FACE_COUNT / FACES_PER_SET);
		var drawPileCount = Math.floor(this.layout.tiles / FACES_PER_SET);
		var leftover = this.layout.tiles % FACES_PER_SET;

		this.drawPile = {
			count: 0,
			faceSets: [],
		};

		for (let idx = 0; idx < drawPileCount; idx++) {
			let set = Random.pickOne(fullSetList);
			this.drawPile.faceSets.push({
				faces: makeSequentialArray(set * FACES_PER_SET, FACES_PER_SET),
			});
		}

		if (leftover) {
			let set = Random.pickOne(fullSetList);
			this.drawPile.faceSets.push({
				faces: makeSequentialArray(set * FACES_PER_SET, 2),
			});
		}
	}

	placeRandomPair() {
		var playableTiles = this.getPlayableTiles();

		if (playableTiles.length < 2) {
			throw BAD_LAYOUT;
		}

		var tile1 = Random.pickOne(playableTiles);
		var tile2 = Random.pickOne(playableTiles);
		var pair = this.drawFacePair();

		this.removeTile(tile1);
		this.removeTile(tile2);

		this.board.pieces[tile1].face = pair.face1;
		this.board.pieces[tile2].face = pair.face2;
		this.solution.push(tile1, tile2);
	}

	drawFacePair() {
		var faceSetIdx = Random.random(this.drawPile.faceSets.length);

		return {
			face1: this.drawOneOf(faceSetIdx),
			face2: this.drawOneOf(faceSetIdx),
		};
	}

	drawOneOf(faceGroup) {
		var faceSet = this.drawPile.faceSets[faceGroup];
		var idx = Random.random(faceSet.faces.length);
		var face = faceSet.faces[idx];

		faceSet.faces.splice(idx, 1);

		if (faceSet.faces.length === 0) {
			this.drawPile.faceSets.splice(faceGroup, 1);
		}

		return face;
	}

	rebuildOccupiedSpaces() {
		this.placedTiles = new Set();
		this.usedSpaces = new Set();

		for (let tile = 0; tile < this.board.count; tile++) {
			this.addTile(tile);
		}
	}

	addTile(tile) {
		this.placedTiles.add(tile);
		this.addPosition(this.board.pieces[tile].pos);
	}

	removeTile(tile) {
		this.placedTiles.delete(tile);
		this.removePosition(this.board.pieces[tile].pos);
	}

	addPosition(position) {
		this.forEachOccupiedSpace(position, function(x, y, z) {
			this.usedSpaces.add(keyForSpace(x, y, z));
		}, this);
	}

	removePosition(position) {
		this.forEachOccupiedSpace(position, function(x, y, z) {
			this.usedSpaces.delete(keyForSpace(x, y, z));
		}, this);
	}

	forEachOccupiedSpace(position, callback, thisArg) {
		var {x, y, z} = position;

		if (x === -1) {
			return;
		}

		callback.call(thisArg, x, y, z);
		callback.call(thisArg, x + 1, y, z);
		callback.call(thisArg, x, y + 1, z);
		callback.call(thisArg, x + 1, y + 1, z);
	}

	getPlayableTiles() {
		var playableTiles = [];

		for (let tile = 0; tile < this.board.count; tile++) {
			if (this.isTilePlayable(tile)) {
				playableTiles.push(tile);
			}
		}

		return playableTiles;
	}

	isTilePlayable(tile) {
		if (!this.placedTiles.has(tile)) {
			return false;
		}

		var {x, y, z} = this.board.pieces[tile].pos;

		if (x === -1) {
			return false;
		}

		return this.hasOpenSide(x, y, z) && this.hasOpenTop(x, y, z);
	}

	hasOpenSide(x, y, z) {
		return x === 1 ||
			x === 29 ||
			(!this.isUsed(x + 2, y, z) && !this.isUsed(x + 2, y + 1, z)) ||
			(!this.isUsed(x - 1, y, z) && !this.isUsed(x - 1, y + 1, z));
	}

	hasOpenTop(x, y, z) {
		return z === 7 ||
			(
				!this.isUsed(x, y, z + 1) &&
				!this.isUsed(x + 1, y, z + 1) &&
				!this.isUsed(x, y + 1, z + 1) &&
				!this.isUsed(x + 1, y + 1, z + 1)
			);
	}

	isUsed(x, y, z) {
		return this.usedSpaces.has(keyForSpace(x, y, z));
	}
}

export function generateRandomBoard(layout, seed = 1, options = {}) {
	return new MahjonggRandomBoardGenerator(layout, options).generate(seed);
}

export function generateRandomFaceBoard(layout, seed = 1) {
	Random.randomize(Number(seed));

	var faces = makeSequentialArray(0, FULL_TILE_FACE_COUNT);
	var board = {
		count: layout.tiles,
		pieces: layout.positions.map(function(position) {
			return {
				pos: clonePosition(position),
				face: Random.pickOne(faces),
			};
		}),
	};

	return {
		board,
		solution: null,
		seed: Number(seed),
		attempt: 1,
	};
}
