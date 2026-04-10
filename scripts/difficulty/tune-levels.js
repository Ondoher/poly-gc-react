#!/usr/bin/env node

import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath, pathToFileURL} from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOADER_ENV = 'MJ_DIFFICULTY_LOADER_ACTIVE';

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
	const options = {
		layout: 'turtle',
		boards: range(1, 20),
		analysis: {
			maxDepth: 2,
			maxStates: 200,
			maxSolutions: 1000,
			playouts: 8,
			maxPlayoutMoves: 72,
			pairChoicePlayouts: 1,
		},
	};

	for (let idx = 0; idx < argv.length; idx++) {
		const arg = argv[idx];

		if (arg === '--layout') {
			options.layout = argv[++idx];
		} else if (arg === '--boards') {
			options.boards = parseBoardList(argv[++idx]);
		} else if (arg === '--playouts') {
			options.analysis.playouts = Number(argv[++idx]);
		} else if (arg === '--pair-choice-playouts') {
			options.analysis.pairChoicePlayouts = Number(argv[++idx]);
		} else if (arg === '--max-depth') {
			options.analysis.maxDepth = Number(argv[++idx]);
		} else if (arg === '--max-states') {
			options.analysis.maxStates = Number(argv[++idx]);
		}
	}

	return options;
}

function parseBoardList(value) {
	if (value.includes('..')) {
		const [start, end] = value.split('..').map(Number);
		return range(start, end);
	}

	return value.split(',').map(Number);
}

function range(start, end) {
	const boards = [];

	for (let board = start; board <= end; board++) {
		boards.push(board);
	}

	return boards;
}

function average(values) {
	const finite = values.filter(Number.isFinite);

	if (!finite.length) {
		return 0;
	}

	return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function summarize(rows) {
	return {
		score: average(rows.map((row) => row.difficulty.score)),
		tightness: average(rows.map((row) => row.difficulty.components.tightnessScore)),
		choice: average(rows.map((row) => row.difficulty.components.choicePressureScore)),
		solve: average(rows.map((row) => row.playouts.solveRate)),
		dead: average(rows.map((row) => row.playouts.deadEndRate)),
		remaining: average(rows.map((row) => row.playouts.averageRemainingTiles)),
		branch: average(rows.map((row) => row.knownSolutionPath.averageBranching)),
		pairSpread: average(rows.map((row) => row.knownSolutionPath.averagePairChoiceSpread)),
		downstreamGroups: average(rows.map((row) => {
			return row.initial.pairChoiceSensitivity.downstream.consequentialGroupCount;
		})),
		pickerWeight: average(rows.map((row) => row.tilePickerStats?.averageWeight ?? 0)),
		pickerFreed: average(rows.map((row) => row.tilePickerStats?.averageFreedCount ?? 0)),
		pickerHorizontal: average(rows.map((row) => {
			return row.tilePickerStats?.averageHorizontalIntersections ?? 0;
		})),
		stackRejected: average(rows.map((row) => row.tilePickerStats?.stackSafetyRejected ?? 0)),
		suspensions: average(rows.map((row) => row.suspensionStats?.created ?? 0)),
		forceReleases: average(rows.map((row) => row.suspensionStats?.forceReleased ?? 0)),
		valid: rows.filter((row) => row.knownSolutionPath.valid).length,
	};
}

function format(value, digits = 2) {
	return Number.isFinite(value) ? value.toFixed(digits) : 'n/a';
}

function percent(value) {
	return `${format(value * 100, 1)}%`;
}

function printSummary(name, summary, count) {
	console.log([
		name.padEnd(24),
		`score ${format(summary.score)}`.padEnd(13),
		`tight ${format(summary.tightness)}`.padEnd(13),
		`choice ${format(summary.choice)}`.padEnd(14),
		`solve ${percent(summary.solve)}`.padEnd(13),
		`dead ${percent(summary.dead)}`.padEnd(13),
		`left ${format(summary.remaining)}`.padEnd(12),
		`branch ${format(summary.branch)}`.padEnd(13),
		`spread ${format(summary.pairSpread)}`.padEnd(13),
		`down ${format(summary.downstreamGroups)}`.padEnd(11),
		`w ${format(summary.pickerWeight)}`.padEnd(10),
		`free ${format(summary.pickerFreed)}`.padEnd(12),
		`h ${format(summary.pickerHorizontal)}`.padEnd(9),
		`safe ${format(summary.stackRejected)}`.padEnd(12),
		`susp ${format(summary.suspensions)}`.padEnd(11),
		`force ${format(summary.forceReleases)}`.padEnd(12),
		`valid ${summary.valid}/${count}`,
	].join(' '));
}

function runConfig(analyzeGeneratedBoard, baseOptions, config) {
	const rows = [];
	const log = console.log;

	console.log = function() {};

	try {
		for (const board of baseOptions.boards) {
			rows.push(analyzeGeneratedBoard({
				layout: baseOptions.layout,
				board,
				generator: config.generator ?? 'engine',
				generationDifficulty: config.generationDifficulty ?? 0.5,
				suspension: config.suspension ?? null,
				analysis: baseOptions.analysis,
			}));
		}
	} finally {
		console.log = log;
	}

	return summarize(rows);
}

async function main() {
	ensureLoader();

	const {
		analyzeGeneratedBoard,
		SUSPENSION_RULE_PRESETS,
	} = await import('./analyzer.js');
	const options = parseArgs(process.argv.slice(2));
	const variants = {
		off: null,
		conservative: SUSPENSION_RULE_PRESETS.conservative,
		moderate: SUSPENSION_RULE_PRESETS.moderate,
		aggressive: SUSPENSION_RULE_PRESETS.aggressive,
		aggressiveNested6: {
			...SUSPENSION_RULE_PRESETS.aggressive,
			maxNested: 6,
		},
		aggressiveLoose: {
			...SUSPENSION_RULE_PRESETS.aggressive,
			forceReleaseAtEffectiveOpen: 3,
			suspendAtEffectiveOpen: 5,
		},
	};
	const configs = [
		{name: 'random', generator: 'random'},
		{name: 'easy/off', generationDifficulty: 0, suspension: variants.off},
		{name: 'easy/conservative', generationDifficulty: 0, suspension: variants.conservative},
		{name: 'std/conservative', generationDifficulty: 0.35, suspension: variants.conservative},
		{name: 'std/moderate', generationDifficulty: 0.35, suspension: variants.moderate},
		{name: 'challenge/moderate', generationDifficulty: 0.5, suspension: variants.moderate},
		{name: 'challenge/aggressive', generationDifficulty: 0.5, suspension: variants.aggressive},
		{name: 'firm/aggressive', generationDifficulty: 0.65, suspension: variants.aggressive},
		{name: 'expert/aggressive', generationDifficulty: 0.75, suspension: variants.aggressive},
		{name: 'expert/loose', generationDifficulty: 0.75, suspension: variants.aggressiveLoose},
		{name: 'expert/nested6', generationDifficulty: 0.75, suspension: variants.aggressiveNested6},
		{name: 'nightmare/aggressive', generationDifficulty: 0.85, suspension: variants.aggressive},
		{name: 'nightmare/nested6', generationDifficulty: 0.85, suspension: variants.aggressiveNested6},
		{name: 'nightmare/loose', generationDifficulty: 0.85, suspension: variants.aggressiveLoose},
		{name: 'max/aggressive', generationDifficulty: 1, suspension: variants.aggressive},
	];

	console.log(`Tuning ${options.layout} boards ${options.boards[0]}..${options.boards[options.boards.length - 1]}`);
	console.log(`Analysis depth ${options.analysis.maxDepth}, states ${options.analysis.maxStates}, playouts ${options.analysis.playouts}`);

	for (const config of configs) {
		const summary = runConfig(analyzeGeneratedBoard, options, config);
		printSummary(config.name, summary, options.boards.length);
	}
}

try {
	await main();
} catch (err) {
	console.error(err.stack || err.message);
	process.exitCode = 1;
}
