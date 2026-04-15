import NumberSet from '../../src/gc/utils/NumberSet.js';

const DEFAULT_GRID = {
	width: 32,
	height: 16,
	depth: 8,
};

const DEFAULT_OPTIONS = {
	grid: DEFAULT_GRID,
	difficulty: 0.5,
	minWindowRatio: 0.25,
	highestZOrder: 8,
	horizontalMultiplier: 2,
	verticalMultiplier: 4,
	random: Math.random,
};

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function horizontalKey(x, y, z, grid) {
	return z * grid.height * grid.width + y * grid.width + x;
}

function verticalKey(x, y, grid) {
	return y * grid.width + x;
}

function copySet(set, length) {
	return new NumberSet([], length).union(set);
}

function setsIntersect(a, b, length) {
	return !copySet(a, length).intersection(b).isEmpty();
}

function getPosition(board, tile) {
	return board.pieces[tile].pos;
}

function makeHorizontalCandidateMask(position, grid) {
	const length = grid.width * grid.height * grid.depth;
	const mask = new NumberSet([], length);
	const {x, y, z} = position;

	mask.include(horizontalKey(x, y, z, grid));
	mask.include(horizontalKey(x + 1, y, z, grid));
	mask.include(horizontalKey(x, y + 1, z, grid));
	mask.include(horizontalKey(x + 1, y + 1, z, grid));

	return mask;
}

function makeVerticalCandidateMask(position, grid) {
	const length = grid.width * grid.height;
	const mask = new NumberSet([], length);
	const {x, y} = position;

	mask.include(verticalKey(x, y, grid));
	mask.include(verticalKey(x + 1, y, grid));
	mask.include(verticalKey(x, y + 1, grid));
	mask.include(verticalKey(x + 1, y + 1, grid));

	return mask;
}

function buildUsedSpaces(board, placedTiles, grid) {
	const usedSpaces = [];

	for (const tile of placedTiles) {
		const {x, y, z} = getPosition(board, tile);

		if (x === -1) {
			continue;
		}

		usedSpaces[z] = usedSpaces[z] || [];
		usedSpaces[z][y] = usedSpaces[z][y] || new NumberSet([], grid.width);
		usedSpaces[z][y + 1] = usedSpaces[z][y + 1] || new NumberSet([], grid.width);

		const tileSpaces = new NumberSet([x, x + 1], grid.width);
		usedSpaces[z][y].union(tileSpaces);
		usedSpaces[z][y + 1].union(tileSpaces);
	}

	return usedSpaces;
}

function isUsed(usedSpaces, x, y, z) {
	return usedSpaces[z] !== undefined
		&& usedSpaces[z][y] !== undefined
		&& usedSpaces[z][y].has(x);
}

function isTileOpen(board, tile, placedTileSet, usedSpaces, grid) {
	if (!placedTileSet.has(tile)) {
		return false;
	}

	const {x, y, z} = getPosition(board, tile);
	let goodAcross;
	let goodUp;

	if (x === 1) {
		goodAcross = true;
	} else if (x === 29) {
		goodAcross = true;
	} else {
		goodAcross = (
			!isUsed(usedSpaces, x + 2, y, z)
			&& !isUsed(usedSpaces, x + 2, y + 1, z)
		) || (
			!isUsed(usedSpaces, x - 1, y, z)
			&& !isUsed(usedSpaces, x - 1, y + 1, z)
		);
	}

	if (z === grid.depth - 1) {
		goodUp = true;
	} else {
		goodUp = !isUsed(usedSpaces, x, y, z + 1)
			&& !isUsed(usedSpaces, x + 1, y, z + 1)
			&& !isUsed(usedSpaces, x, y + 1, z + 1)
			&& !isUsed(usedSpaces, x + 1, y + 1, z + 1);
	}

	return goodAcross && goodUp;
}

function buildPlacedTileSet(board, removedTile = null) {
	const placed = new NumberSet([], board.count);

	for (let tile = 0; tile < board.count; tile++) {
		const position = getPosition(board, tile);

		if (position.x !== -1 && tile !== removedTile) {
			placed.include(tile);
		}
	}

	return placed;
}

function getPlacedTiles(board, removedTile = null) {
	const placed = [];

	for (let tile = 0; tile < board.count; tile++) {
		const position = getPosition(board, tile);

		if (position.x !== -1 && tile !== removedTile) {
			placed.push(tile);
		}
	}

	return placed;
}

export function buildHorizontalReferenceMasks(board, referenceTiles, options = {}) {
	const grid = options.grid ?? DEFAULT_GRID;
	const length = grid.width * grid.height * grid.depth;
	const masks = [];

	for (const tile of referenceTiles) {
		const {y, z} = getPosition(board, tile);

		for (const row of [y, y + 1]) {
			const mask = new NumberSet([], length);

			for (let x = 0; x < grid.width; x++) {
				mask.include(horizontalKey(x, row, z, grid));
			}

			masks.push(mask);
		}
	}

	return masks;
}

export function buildVerticalReferenceMasks(board, referenceTiles, options = {}) {
	const grid = options.grid ?? DEFAULT_GRID;
	const masks = [];

	for (const tile of referenceTiles) {
		masks.push(makeVerticalCandidateMask(getPosition(board, tile), grid));
	}

	return masks;
}

export function countHorizontalIntersections(board, tile, masks, options = {}) {
	const grid = options.grid ?? DEFAULT_GRID;
	const length = grid.width * grid.height * grid.depth;
	const candidate = makeHorizontalCandidateMask(getPosition(board, tile), grid);

	return masks.filter((mask) => setsIntersect(candidate, mask, length)).length;
}

export function countVerticalIntersections(board, tile, masks, options = {}) {
	const grid = options.grid ?? DEFAULT_GRID;
	const length = grid.width * grid.height;
	const candidate = makeVerticalCandidateMask(getPosition(board, tile), grid);

	return masks.filter((mask) => setsIntersect(candidate, mask, length)).length;
}

export function countTilesFreedByRemoval(board, tile, openTiles, options = {}) {
	const grid = options.grid ?? DEFAULT_GRID;
	const openBefore = new NumberSet(openTiles, board.count);
	const placedAfter = buildPlacedTileSet(board, tile);
	const usedAfter = buildUsedSpaces(board, getPlacedTiles(board, tile), grid);
	let freed = 0;

	for (let candidate = 0; candidate < board.count; candidate++) {
		if (
			candidate !== tile
			&& !openBefore.has(candidate)
			&& isTileOpen(board, candidate, placedAfter, usedAfter, grid)
		) {
			freed++;
		}
	}

	return freed;
}

export function scoreOpenTiles(board, openTiles, referenceTiles = [], options = {}) {
	const settings = {
		...DEFAULT_OPTIONS,
		...options,
		grid: {
			...DEFAULT_GRID,
			...(options.grid ?? {}),
		},
	};
	const zDenominator = Math.max(1, settings.highestZOrder);
	const zBias = (settings.difficulty - 0.5) * 2;
	const references = new NumberSet(referenceTiles, board.count);
	const candidates = openTiles.filter((tile) => !references.has(tile));
	const horizontalMasks = buildHorizontalReferenceMasks(board, referenceTiles, settings);
	const verticalMasks = buildVerticalReferenceMasks(board, referenceTiles, settings);
	const freedCounts = candidates.map((tile) => {
		return countTilesFreedByRemoval(board, tile, openTiles, settings);
	});
	const uniqueFreedCounts = [...new Set(freedCounts)].sort((a, b) => a - b);
	const freedRankByCount = new Map(
		uniqueFreedCounts.map((count, index) => {
			return [count, uniqueFreedCounts.length - index];
		})
	);

	return candidates.map((tile, index) => {
		const position = getPosition(board, tile);
		const freedCount = freedCounts[index];
		const freedRank = freedRankByCount.get(freedCount);
		const horizontalIntersections = countHorizontalIntersections(
			board,
			tile,
			horizontalMasks,
			settings
		);
		const verticalIntersections = countVerticalIntersections(
			board,
			tile,
			verticalMasks,
			settings
		);
		const zWeight = (position.z + 0.5) / zDenominator;
		const centeredZWeight = (zWeight - 0.5) * 2;
		const zPressure = Math.max(0.25, 1 + (centeredZWeight * zBias));
		const weight = freedRank
			* zPressure
			* Math.pow(settings.horizontalMultiplier, horizontalIntersections)
			* Math.pow(settings.verticalMultiplier, verticalIntersections);

		return {
			tile,
			weight,
			freedCount,
			freedRank,
			z: position.z,
			zWeight,
			zPressure,
			horizontalIntersections,
			verticalIntersections,
		};
	}).sort((a, b) => a.weight - b.weight || a.tile - b.tile);
}

export function getDifficultyWindow(scoredTiles, options = {}) {
	const settings = {
		...DEFAULT_OPTIONS,
		...options,
	};
	const count = scoredTiles.length;

	if (count === 0) {
		return [];
	}

	const difficulty = clamp(settings.difficulty, 0, 1);
	const minWindowRatio = clamp(settings.minWindowRatio, 0, 1);
	const edgePressure = Math.abs(difficulty - 0.5) * 2;
	const windowRatio = 1 - edgePressure * (1 - minWindowRatio);
	const windowSize = Math.max(1, Math.ceil(count * windowRatio));
	const start = Math.round((count - windowSize) * difficulty);

	return scoredTiles.slice(start, start + windowSize);
}

export function pickFromDifficultyWindow(scoredTiles, options = {}) {
	const settings = {
		...DEFAULT_OPTIONS,
		...options,
	};
	const candidates = getDifficultyWindow(scoredTiles, settings);

	if (candidates.length === 0) {
		return false;
	}

	return candidates[Math.floor(settings.random() * candidates.length)];
}

export function pickTile(board, openTiles, referenceTiles = [], options = {}) {
	const scoredTiles = scoreOpenTiles(board, openTiles, referenceTiles, options);

	return pickFromDifficultyWindow(scoredTiles, options);
}

export function pickPair(board, openTiles, options = {}) {
	const first = pickTile(board, openTiles, [], options);
	const second = pickTile(board, openTiles, [first.tile], options);

	return {
		tile1: first.tile,
		tile2: second.tile,
		picks: [first, second],
	};
}

export function pickSuspensionTriple(board, openTiles, options = {}) {
	const first = pickTile(board, openTiles, [], options);
	const second = pickTile(board, openTiles, [first.tile], options);
	const third = pickTile(board, openTiles, [first.tile, second.tile], options);
	const ranked = [first, second, third].sort((a, b) => {
		return a.weight - b.weight || a.tile - b.tile;
	});

	return {
		placed: [ranked[0].tile, ranked[1].tile],
		suspended: ranked[2].tile,
		picks: [first, second, third],
	};
}
