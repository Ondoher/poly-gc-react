#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const LAYOUTS_PATH = path.join(
	REPO_ROOT,
	'src/gc/features/mj/src/data/layouts.json'
);
const LOADER_ENV = 'MJ_CHECK_FACE_ASSIGNMENT_INTEGRITY_LOADER_ACTIVE';

function ensureLoader() {
	if (process.env[LOADER_ENV] === '1') {
		return;
	}

	const loaderPath = path.join(__dirname, 'node-alias-loader.js');
	const result = spawnSync(
		process.execPath,
		[
			'--loader',
			pathToFileURL(loaderPath).href,
			'--no-warnings',
			__filename,
			...process.argv.slice(2),
		],
		{
			stdio: 'inherit',
			env: {
				...process.env,
				[LOADER_ENV]: '1',
			},
		}
	);

	process.exit(result.status ?? 1);
}

function parseArgs(argv) {
	let options = {
		layouts: ['turtle', 'taipei', 'beetle'],
		boards: [1, 2, 3, 12345],
	};

	for (let idx = 0; idx < argv.length; idx++) {
		let arg = argv[idx];

		if (arg === '--layouts') {
			options.layouts = argv[++idx].split(',');
		} else if (arg === '--boards') {
			options.boards = argv[++idx].split(',').map(Number);
		} else {
			throw new Error(`Unknown argument "${arg}".`);
		}
	}

	return options;
}

function assert(label, condition, details = '') {
	if (!condition) {
		throw new Error(`${label}${details ? `: ${details}` : ''}`);
	}
}

function validateBoard(engine, layout, board) {
	let pieceFaces = engine.board.pieces.map((piece) => piece.face);
	let assignedTiles = new Set();
	let faceCounts = new Map();

	pieceFaces.forEach((face, tile) => {
		assert('all tiles have assigned faces', face >= 0, `layout=${layout} board=${board} tile=${tile} face=${face}`);
		faceCounts.set(face, (faceCounts.get(face) || 0) + 1);
	});

	for (let pair of engine.assignedFacePairs) {
		assert('assigned pair tile1 unique', !assignedTiles.has(pair.tile1), `layout=${layout} board=${board} tile=${pair.tile1}`);
		assert('assigned pair tile2 unique', !assignedTiles.has(pair.tile2), `layout=${layout} board=${board} tile=${pair.tile2}`);
		assignedTiles.add(pair.tile1);
		assignedTiles.add(pair.tile2);
	}

	assert(
		'assigned face pair coverage matches board tile count',
		assignedTiles.size === engine.board.count,
		`layout=${layout} board=${board} assigned=${assignedTiles.size} tiles=${engine.board.count}`
	);

	for (let [face, count] of faceCounts) {
		assert('no face used more than once', count === 1, `layout=${layout} board=${board} face=${face} count=${count}`);
	}

	let remainingFaces = 0;
	for (let [, faceSet] of engine.drawPile.faceSets) {
		remainingFaces += faceSet.faces.length;
	}

	assert(
		'all faces consumed from draw pile',
		remainingFaces === 0,
		`layout=${layout} board=${board} remainingFaces=${remainingFaces}`
	);

	return {
		layout,
		board,
		tileCount: engine.board.count,
		assignedPairs: engine.assignedFacePairs.length,
	};
}

async function main() {
	ensureLoader();

	const {default: Engine} = await import('../../src/gc/features/mj/src/engine/Engine.js');
	const layouts = JSON.parse(fs.readFileSync(LAYOUTS_PATH, 'utf8'));
	const options = parseArgs(process.argv.slice(2));

	let results = [];

	for (let layout of options.layouts) {
		for (let board of options.boards) {
			let engine = new Engine();
			engine.setLayout(layouts[layout]);
			engine.generateGame(board);
			results.push(validateBoard(engine, layout, board));
		}
	}

	results.forEach((result) => {
		console.log(`ok: ${result.layout} board ${result.board} tiles=${result.tileCount} assignedPairs=${result.assignedPairs}`);
	});

	console.log('\nface assignment integrity checks passed');
}

await main();
