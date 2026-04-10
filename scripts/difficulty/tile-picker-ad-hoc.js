#!/usr/bin/env node

import {
	buildHorizontalReferenceMasks,
	buildVerticalReferenceMasks,
	countHorizontalIntersections,
	countVerticalIntersections,
	getDifficultyWindow,
	pickPair,
	pickFromDifficultyWindow,
	pickSuspensionTriple,
	scoreOpenTiles,
} from './tile-picker.js';

function createToyBoard() {
	const positions = [
		{x: 3, y: 2, z: 0},
		{x: 5, y: 2, z: 0},
		{x: 7, y: 2, z: 0},
		{x: 12, y: 4, z: 0},
		{x: 13, y: 5, z: 1},
		{x: 20, y: 2, z: 0},
		{x: 20, y: 8, z: 2},
		{x: 22, y: 8, z: 2},
		{x: 24, y: 8, z: 2},
	];

	return {
		count: positions.length,
		pieces: positions.map((pos) => {
			return {
				pos,
				face: -1,
			};
		}),
	};
}

function makeDeterministicRandom(seed = 1) {
	let value = seed;

	return function random() {
		value = (value * 48271) % 0x7fffffff;
		return value / 0x7fffffff;
	};
}

function assertEqual(label, actual, expected) {
	if (actual !== expected) {
		throw new Error(`${label}: expected ${expected}, got ${actual}`);
	}

	console.log(`ok: ${label} = ${actual}`);
}

function formatScore(score) {
	return {
		tile: score.tile,
		weight: Number(score.weight.toFixed(2)),
		freed: score.freedCount,
		rank: score.freedRank,
		z: score.z,
		h: score.horizontalIntersections,
		v: score.verticalIntersections,
	};
}

function printWindow(label, scores, options) {
	const window = getDifficultyWindow(scores, options);

	console.log(
		`${label}:`,
		window.map((score) => `${score.tile}:${score.weight.toFixed(2)}`).join(' ')
	);
}

function printDifficultyCase(label, board, openTiles, referenceTiles, options) {
	const scores = scoreOpenTiles(board, openTiles, referenceTiles, options);
	const window = getDifficultyWindow(scores, options);
	const selected = pickFromDifficultyWindow(scores, {
		...options,
		random: makeDeterministicRandom(101),
	});

	console.log(`\n${label}`);
	console.log('weighted array:');
	console.table(scores.map(formatScore));
	console.log(
		'window:',
		window.map((score) => `${score.tile}:${score.weight.toFixed(2)}`).join(' ')
	);
	console.log('selected:', formatScore(selected));
}

function samplePicks(label, scores, options) {
	const counts = new Map();
	const random = makeDeterministicRandom(17);

	for (let idx = 0; idx < 1000; idx++) {
		const picked = pickFromDifficultyWindow(scores, {
			...options,
			random,
		});
		counts.set(picked.tile, (counts.get(picked.tile) ?? 0) + 1);
	}

	console.log(
		`${label}:`,
		[...counts.entries()]
			.sort((a, b) => a[0] - b[0])
			.map(([tile, count]) => `${tile}:${count}`)
			.join(' ')
	);
}

function main() {
	const board = createToyBoard();
	const openTiles = [0, 2, 4, 5, 6, 8];
	const referenceTiles = [0, 3];
	const horizontalMasks = buildHorizontalReferenceMasks(board, referenceTiles);
	const verticalMasks = buildVerticalReferenceMasks(board, referenceTiles);

	assertEqual(
		'horizontal counts both occupied rows for same-z row neighbor',
		countHorizontalIntersections(board, 2, horizontalMasks),
		2
	);
	assertEqual(
		'vertical quarter overlap counts once for the reference tile',
		countVerticalIntersections(board, 4, verticalMasks),
		1
	);
	assertEqual(
		'vertical non-overlap does not count',
		countVerticalIntersections(board, 5, verticalMasks),
		0
	);

	printDifficultyCase('easy difficulty', board, openTiles, referenceTiles, {
		difficulty: 0,
		minWindowRatio: 0.25,
	});
	printDifficultyCase('medium difficulty', board, openTiles, referenceTiles, {
		difficulty: 0.5,
		minWindowRatio: 0.25,
	});
	printDifficultyCase('hard difficulty', board, openTiles, referenceTiles, {
		difficulty: 1,
		minWindowRatio: 0.25,
	});

	const scores = scoreOpenTiles(board, openTiles, referenceTiles, {
		difficulty: 0.5,
		minWindowRatio: 0.25,
	});

	console.log('\nscored open tiles, lowest weight first:');
	console.table(scores.map(formatScore));

	console.log('difficulty windows:');
	printWindow('easy   0.00', scores, {difficulty: 0, minWindowRatio: 0.25});
	printWindow('mild   0.25', scores, {difficulty: 0.25, minWindowRatio: 0.25});
	printWindow('medium 0.50', scores, {difficulty: 0.5, minWindowRatio: 0.25});
	printWindow('hard   0.75', scores, {difficulty: 0.75, minWindowRatio: 0.25});
	printWindow('max    1.00', scores, {difficulty: 1, minWindowRatio: 0.25});

	console.log('\n1000 deterministic picks from each window:');
	samplePicks('easy  ', scores, {difficulty: 0, minWindowRatio: 0.25});
	samplePicks('medium', scores, {difficulty: 0.5, minWindowRatio: 0.25});
	samplePicks('hard  ', scores, {difficulty: 1, minWindowRatio: 0.25});

	console.log('\ncomposed picks:');
	console.log(
		'pair',
		pickPair(board, openTiles, {
			difficulty: 1,
			minWindowRatio: 0.25,
			random: makeDeterministicRandom(33),
		})
	);
	console.log(
		'suspension triple',
		pickSuspensionTriple(board, openTiles, {
			difficulty: 1,
			minWindowRatio: 0.25,
			random: makeDeterministicRandom(33),
		})
	);
}

main();
