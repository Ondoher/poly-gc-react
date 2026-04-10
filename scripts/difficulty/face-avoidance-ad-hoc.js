#!/usr/bin/env node

import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOADER_ENV = 'MJ_FACE_AVOIDANCE_AD_HOC_LOADER_ACTIVE';

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

function assertEqual(label, actual, expected) {
	if (actual !== expected) {
		throw new Error(`${label}: expected ${expected}, got ${actual}`);
	}

	console.log(`ok: ${label} = ${actual}`);
}

function assertIncludes(label, values, expected) {
	if (!values.includes(expected)) {
		throw new Error(`${label}: expected ${values.join(',')} to include ${expected}`);
	}

	console.log(`ok: ${label} includes ${expected}`);
}

function makeEngine(Engine) {
	const engine = new Engine();

	engine.setLayout({
		id: 'face-avoidance-ad-hoc',
		title: 'Face Avoidance Ad Hoc',
		tiles: 3,
		positions: [
			{x: 1, y: 1, z: 1},
			{x: 10, y: 1, z: 0},
			{x: 1, y: 1, z: 0},
		],
	});
	engine.configureBoard();
	engine.setupFaceAvoidanceRules({
		enabled: true,
		weight: 1,
		suspensionWeight: 3,
		maxWeight: 8,
	});

	for (let tile = 0; tile < engine.board.count; tile++) {
		engine.addPos(engine.board.pieces[tile].pos, tile);
	}

	engine.calcOpenTiles();

	return engine;
}

function setFacePairs(engine, faceSets) {
	engine.drawPile.faceSets = new Map();
	faceSets.forEach((faceSet) => {
		const id = Math.floor(faceSet[0] / 4);

		engine.drawPile.faceSets.set(id, {
			id,
			faces: faceSet.slice(),
		});
	});
}

function selectedFaceSet(pair) {
	return Math.floor(pair.face1 / 4);
}

function testAvoidsPenalizedFaceSet(Engine) {
	const engine = makeEngine(Engine);

	setFacePairs(engine, [
		[0, 1],
		[4, 5],
		[8, 9],
	]);
	engine.addFaceAvoidance(0, 0, 5);
	engine.addFaceAvoidance(1, 1, 2);

	const pair = engine.drawWeightedFacePairForTiles([0, 1]);
	const stats = engine.getFaceAvoidanceStats();

	assertEqual('weighted pair selects zero-penalty face set', selectedFaceSet(pair), 2);
	assertEqual('weighted draw count after zero-penalty draw', stats.drawCount, 1);
	assertEqual('zero-penalty draw counted', stats.zeroPenaltyDraws, 1);
	assertEqual('non-zero penalty draw not counted', stats.nonZeroPenaltyDraws, 0);
}

function testFallsBackToLeastBadFaceSet(Engine) {
	const engine = makeEngine(Engine);

	setFacePairs(engine, [
		[0, 1],
		[4, 5],
	]);
	engine.addFaceAvoidance(0, 0, 5);
	engine.addFaceAvoidance(1, 1, 2);

	const pair = engine.drawWeightedFacePairForTiles([0, 1]);
	const stats = engine.getFaceAvoidanceStats();

	assertEqual('weighted pair selects lowest non-zero penalty face set', selectedFaceSet(pair), 1);
	assertEqual('non-zero penalty draw counted', stats.nonZeroPenaltyDraws, 1);
	assertEqual('selected penalty tracked', stats.selectedPenaltyTotal, 2);
	assertEqual('max selected penalty tracked', stats.maxSelectedPenalty, 2);
}

function testPreferredFaceGroupAssignment(Engine) {
	const engine = makeEngine(Engine);

	setFacePairs(engine, [
		[0, 1],
		[4, 5],
		[8, 9],
	]);
	engine.addFaceAvoidance(0, 0, 5);
	engine.addFaceAvoidance(1, 1, 2);

	const record = engine.createGeneratedPairRecord(0, 1, []);
	const pair = engine.drawPreferredFacePairForRecord(record);
	const stats = engine.getFaceAvoidanceStats();

	assertEqual('preferred face group records zero-penalty face set', record.preferredFaceGroup, 2);
	assertEqual('preferred face group draw uses preferred set', selectedFaceSet(pair), 2);
	assertEqual('preferred face group counted', stats.preferredFaceGroups, 1);
	assertEqual('preferred face group draw counted', stats.preferredFaceGroupDraws, 1);
	assertEqual('preferred face group fallback not counted', stats.preferredFaceGroupFallbacks, 0);
}

function testPostRemovalFrontierTargets(Engine) {
	const engine = makeEngine(Engine);

	assertEqual('initial open tile count', engine.openTiles.length, 2);

	const targets = engine.getFaceAvoidanceTargetsAfterRemoval([0, 1]);

	assertIncludes('post-removal avoidance targets newly opened lower tile', targets, 2);
}

async function main() {
	ensureLoader();

	const {default: Engine} = await import('../../src/gc/features/mj/src/engine/Engine.js');

	testAvoidsPenalizedFaceSet(Engine);
	testFallsBackToLeastBadFaceSet(Engine);
	testPreferredFaceGroupAssignment(Engine);
	testPostRemovalFrontierTargets(Engine);

	console.log('\nface avoidance ad hoc checks passed');
}

await main();
