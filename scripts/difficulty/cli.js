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

	var loaderPath = path.join(__dirname, 'node-alias-loader.js');
	var result = spawnSync(
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
	var options = {
		layout: 'turtle',
		board: 1,
		boards: null,
		batch: false,
		generator: 'engine',
		suspensionPreset: null,
		suspensionOverrides: {},
		json: false,
		detail: false,
		listLayouts: false,
		analysis: {
			maxDepth: 18,
			maxStates: 10000,
			maxSolutions: 1000,
			playouts: 48,
			maxPlayoutMoves: 72,
			pairChoicePlayouts: 4,
		},
	};

	for (let idx = 0; idx < argv.length; idx++) {
		var arg = argv[idx];

		if (arg === '--layout') {
			options.layout = argv[++idx];
		} else if (arg === '--board') {
			options.board = Number(argv[++idx]);
		} else if (arg === '--boards') {
			options.boards = parseBoardList(argv[++idx]);
			options.batch = true;
		} else if (arg === '--batch') {
			options.batch = true;
		} else if (arg === '--generator') {
			options.generator = argv[++idx];
		} else if (arg === '--suspension') {
			options.suspensionPreset = argv[++idx];
		} else if (arg === '--force-release-at-effective-open') {
			options.suspensionOverrides.forceReleaseAtEffectiveOpen = Number(argv[++idx]);
		} else if (arg === '--suspend-at-effective-open') {
			options.suspensionOverrides.suspendAtEffectiveOpen = Number(argv[++idx]);
		} else if (arg === '--json') {
			options.json = true;
		} else if (arg === '--detail') {
			options.detail = true;
		} else if (arg === '--max-depth') {
			options.analysis.maxDepth = Number(argv[++idx]);
		} else if (arg === '--max-states') {
			options.analysis.maxStates = Number(argv[++idx]);
		} else if (arg === '--max-solutions') {
			options.analysis.maxSolutions = Number(argv[++idx]);
		} else if (arg === '--playouts') {
			options.analysis.playouts = Number(argv[++idx]);
		} else if (arg === '--max-playout-moves') {
			options.analysis.maxPlayoutMoves = Number(argv[++idx]);
		} else if (arg === '--pair-choice-playouts') {
			options.analysis.pairChoicePlayouts = Number(argv[++idx]);
		} else if (arg === '--list-layouts') {
			options.listLayouts = true;
		} else if (arg === '--help' || arg === '-h') {
			options.help = true;
		} else {
			throw new Error(`Unknown argument "${arg}".`);
		}
	}

	return options;
}

function parseBoardList(value) {
	if (value.includes('..')) {
		var [start, end] = value.split('..').map(Number);
		var step = start <= end ? 1 : -1;
		var boards = [];

		for (let board = start; board !== end + step; board += step) {
			boards.push(board);
		}

		return boards;
	}

	return value.split(',').map(Number);
}

function summarizeValues(values) {
	var sorted = values.slice().sort(function(left, right) {
		return left - right;
	});

	if (sorted.length === 0) {
		return {
			min: 0,
			max: 0,
			average: 0,
			median: 0,
			p90: 0,
		};
	}

	var total = sorted.reduce(function(sum, value) {
		return sum + value;
	}, 0);
	var percentile = function(percent) {
		var index = Math.ceil((percent / 100) * sorted.length) - 1;

		return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
	};

	return {
		min: sorted[0],
		max: sorted[sorted.length - 1],
		average: total / sorted.length,
		median: percentile(50),
		p90: percentile(90),
	};
}

function compactBatchRow(summary) {
	return {
		boardNumber: summary.boardNumber,
		label: summary.difficulty.label,
		score: summary.difficulty.score,
		suspensionStats: summary.suspensionStats,
		initialPlayablePairCount: summary.initial.playablePairCount,
		knownSolutionValid: summary.knownSolutionPath.valid,
		knownSolutionAverageBranching: summary.knownSolutionPath.averageBranching,
		knownSolutionLowBranchMoveCount: summary.knownSolutionPath.lowBranchMoveCount,
		knownSolutionAveragePairChoiceSpread: summary.knownSolutionPath.averagePairChoiceSpread,
		initialDownstreamDeadEndRateSpread: summary.initial.pairChoiceSensitivity.downstream.maxDeadEndRateSpread,
		initialDownstreamRemainingTilesSpread: summary.initial.pairChoiceSensitivity.downstream.maxRemainingTilesSpread,
		initialDownstreamConsequentialGroupCount: summary.initial.pairChoiceSensitivity.downstream.consequentialGroupCount,
		searchConsequentialPairChoiceStateCount: summary.search.consequentialPairChoiceStateCount,
		playoutSolveRate: summary.playouts.solveRate,
		playoutDeadEndRate: summary.playouts.deadEndRate,
		playoutAverageRemainingTiles: summary.playouts.averageRemainingTiles,
	};
}

function summarizeBatch(rows, options) {
	return {
		layout: options.layout,
		generator: options.generator,
		suspension: options.suspension || null,
		boardCount: rows.length,
		validKnownSolutionCount: rows.filter(function(row) {
			return row.knownSolutionValid;
		}).length,
		suspensionStats: summarizeSuspensionStats(rows),
		score: summarizeValues(rows.map(function(row) { return row.score; })),
		playoutSolveRate: summarizeValues(rows.map(function(row) { return row.playoutSolveRate; })),
		playoutDeadEndRate: summarizeValues(rows.map(function(row) { return row.playoutDeadEndRate; })),
		playoutAverageRemainingTiles: summarizeValues(rows.map(function(row) {
			return row.playoutAverageRemainingTiles;
		})),
		knownSolutionAverageBranching: summarizeValues(rows.map(function(row) {
			return row.knownSolutionAverageBranching;
		})),
		knownSolutionAveragePairChoiceSpread: summarizeValues(rows.map(function(row) {
			return row.knownSolutionAveragePairChoiceSpread;
		})),
		initialDownstreamDeadEndRateSpread: summarizeValues(rows.map(function(row) {
			return row.initialDownstreamDeadEndRateSpread;
		})),
		initialDownstreamRemainingTilesSpread: summarizeValues(rows.map(function(row) {
			return row.initialDownstreamRemainingTilesSpread;
		})),
		initialDownstreamConsequentialGroupCount: summarizeValues(rows.map(function(row) {
			return row.initialDownstreamConsequentialGroupCount;
		})),
		searchConsequentialPairChoiceStateCount: summarizeValues(rows.map(function(row) {
			return row.searchConsequentialPairChoiceStateCount;
		})),
	};
}

function summarizeSuspensionStats(rows) {
	var statsRows = rows
		.map(function(row) { return row.suspensionStats; })
		.filter(Boolean);

	if (statsRows.length === 0) {
		return null;
	}

	var names = Object.keys(statsRows[0]);
	var summary = {};

	names.forEach(function(name) {
		summary[name] = summarizeValues(statsRows.map(function(stats) {
			return stats[name];
		}));
	});

	return summary;
}

function runWithQuietLogs(callback) {
	var log = console.log;

	console.log = function() {};

	try {
		return callback();
	} finally {
		console.log = log;
	}
}

function printHelp() {
	console.log(`Usage: node ./scripts/difficulty/cli.js [options]

Options:
  --layout <id>     Layout id from layouts.json. Default: turtle
  --board <number>  Board number / seed. Default: 1
  --boards <range>  Analyze a range or comma list, e.g. 1..100 or 1,5,9
  --batch           Analyze multiple boards. Uses --boards or defaults to --board
  --generator <name>
                    Board generator: engine, standalone, or random. Default: engine
  --suspension <preset>
                    Engine suspension preset: conservative, moderate, or aggressive
  --force-release-at-effective-open <n>
                    Override suspension force-release safety threshold
  --suspend-at-effective-open <n>
                    Override suspension creation safety threshold
  --max-depth <n>   Maximum search depth. Default: 18
  --max-states <n>  Maximum states to explore. Default: 10000
  --max-solutions <n>
                    Maximum solution branches to collect. Default: 1000
  --playouts <n>    Deterministic random playout count. Default: 48
  --max-playout-moves <n>
                    Maximum moves per playout. Default: 72
  --pair-choice-playouts <n>
                    Downstream playouts per initial pair-choice candidate. Default: 4
  --json            Print JSON output
  --detail          Include detailed pairs and branch arrays in JSON output
  --list-layouts    Print available layout ids
  --help, -h        Show this help
`);
}

function compactSummary(summary) {
	return {
		layout: summary.layout,
		layoutTitle: summary.layoutTitle,
		boardNumber: summary.boardNumber,
		generator: summary.generator,
		generationAttempt: summary.generationAttempt,
		suspension: summary.suspension,
		suspensionStats: summary.suspensionStats,
		tileCount: summary.tileCount,
		options: summary.options,
		difficulty: summary.difficulty,
		initial: {
			remainingTiles: summary.initial.remainingTiles,
			playablePairCount: summary.initial.playablePairCount,
			faceSetCount: summary.initial.faceSetSummary.faceSetCount,
			ambiguousFaceSetCount: summary.initial.faceSetSummary.ambiguousFaceSetCount,
			pairChoiceSensitivity: {
				ambiguousGroupCount: summary.initial.pairChoiceSensitivity.ambiguousGroupCount,
				consequentialGroupCount: summary.initial.pairChoiceSensitivity.consequentialGroupCount,
				maxSpread: summary.initial.pairChoiceSensitivity.maxSpread,
				averageSpread: summary.initial.pairChoiceSensitivity.averageSpread,
				downstream: summary.initial.pairChoiceSensitivity.downstream,
			},
		},
		knownSolutionPath: {
			valid: summary.knownSolutionPath.valid,
			invalidStep: summary.knownSolutionPath.invalidStep,
			moveCount: summary.knownSolutionPath.moveCount,
			averageBranching: summary.knownSolutionPath.averageBranching,
			minBranching: summary.knownSolutionPath.minBranching,
			maxBranching: summary.knownSolutionPath.maxBranching,
			lowBranchMoveCount: summary.knownSolutionPath.lowBranchMoveCount,
			averagePairChoiceSpread: summary.knownSolutionPath.averagePairChoiceSpread,
		},
		search: summary.search,
		playouts: summary.playouts,
	};
}

function formatKnownSolutionStatus(knownSolutionPath) {
	if (knownSolutionPath.available === false) {
		return 'unknown';
	}

	return String(knownSolutionPath.valid);
}

function printSummary(summary) {
	console.log(`Mahjongg difficulty analysis seed

Layout: ${summary.layoutTitle} (${summary.layout})
Board: ${summary.boardNumber}
Generator: ${summary.generator}
Suspension: ${summary.suspension ? summary.suspension.name : 'off'}
Tiles: ${summary.tileCount}
Difficulty: ${summary.difficulty.label} (${summary.difficulty.score}/100)

Initial playable pairs: ${summary.initial.playablePairCount}
Initial ambiguous face sets: ${summary.initial.faceSetSummary.ambiguousFaceSetCount}
Initial consequential pair-choice groups: ${summary.initial.pairChoiceSensitivity.consequentialGroupCount}

Known solution valid: ${formatKnownSolutionStatus(summary.knownSolutionPath)}
Known solution average branching: ${summary.knownSolutionPath.averageBranching.toFixed(2)}
Known solution low-branch moves: ${summary.knownSolutionPath.lowBranchMoveCount}

Search states explored: ${summary.search.statesExplored}
Search max depth reached: ${summary.search.maxDepthReached}
Search dead ends: ${summary.search.deadEnds}
Search solved branches: ${summary.search.solvedBranches}
Search average branching: ${summary.search.averageBranching.toFixed(2)}
Search consequential pair-choice states: ${summary.search.consequentialPairChoiceStateCount}

Playouts: ${summary.playouts.count}
Playout solve rate: ${(summary.playouts.solveRate * 100).toFixed(1)}%
Playout dead-end rate: ${(summary.playouts.deadEndRate * 100).toFixed(1)}%
Playout average remaining tiles: ${summary.playouts.averageRemainingTiles.toFixed(2)}
`);
}

function printBatchSummary(batch) {
	var percent = function(value) {
		return `${(value * 100).toFixed(1)}%`;
	};
	var number = function(value) {
		return value.toFixed(2);
	};
	var printMetric = function(label, stats, format = number) {
		console.log(`${label}: avg ${format(stats.average)}, median ${format(stats.median)}, p90 ${format(stats.p90)}, min ${format(stats.min)}, max ${format(stats.max)}`);
	};

	console.log(`Mahjongg difficulty batch

Layout: ${batch.aggregate.layout}
Generator: ${batch.aggregate.generator}
Suspension: ${batch.aggregate.suspension ? batch.aggregate.suspension.name : 'off'}
Boards: ${batch.aggregate.boardCount}
Known solutions valid: ${batch.aggregate.validKnownSolutionCount}/${batch.aggregate.boardCount}
`);
	printMetric('Score', batch.aggregate.score);
	printMetric('Playout solve rate', batch.aggregate.playoutSolveRate, percent);
	printMetric('Playout dead-end rate', batch.aggregate.playoutDeadEndRate, percent);
	printMetric('Playout average remaining tiles', batch.aggregate.playoutAverageRemainingTiles);
	printMetric('Known solution average branching', batch.aggregate.knownSolutionAverageBranching);
	printMetric('Known solution pair-choice spread', batch.aggregate.knownSolutionAveragePairChoiceSpread);
	printMetric('Initial downstream dead-end spread', batch.aggregate.initialDownstreamDeadEndRateSpread, percent);
	printMetric('Initial downstream remaining-tiles spread', batch.aggregate.initialDownstreamRemainingTilesSpread);
	printMetric('Initial downstream consequential groups', batch.aggregate.initialDownstreamConsequentialGroupCount);
	printMetric('Search consequential pair-choice states', batch.aggregate.searchConsequentialPairChoiceStateCount);
	if (batch.aggregate.suspensionStats) {
		printMetric('Suspension attempts', batch.aggregate.suspensionStats.attempts);
		printMetric('Suspensions created', batch.aggregate.suspensionStats.created);
		printMetric('Suspensions released', batch.aggregate.suspensionStats.released);
		printMetric('Suspensions force released', batch.aggregate.suspensionStats.forceReleased);
		printMetric('Suspension skip frequency', batch.aggregate.suspensionStats.skippedByFrequency);
		printMetric('Suspension skip total cap', batch.aggregate.suspensionStats.skippedByTotalCap);
		printMetric('Suspension skip nested cap', batch.aggregate.suspensionStats.skippedByNestedCap);
		printMetric('Suspension skip open tiles', batch.aggregate.suspensionStats.skippedByOpenTiles);
		printMetric('Suspension skip no full face set', batch.aggregate.suspensionStats.skippedByNoFullFaceSet);
		printMetric('Suspension max nested seen', batch.aggregate.suspensionStats.maxNestedSeen);
		printMetric('Force release avg open tiles', batch.aggregate.suspensionStats.forceReleaseAverageOpenTiles);
		printMetric('Force release avg suspended', batch.aggregate.suspensionStats.forceReleaseAverageSuspended);
		printMetric('Force release avg open suspended', batch.aggregate.suspensionStats.forceReleaseAverageOpenSuspended);
		printMetric('Force release avg effective open', batch.aggregate.suspensionStats.forceReleaseAverageEffectiveOpen);
		printMetric('Skip open avg open tiles', batch.aggregate.suspensionStats.skipOpenTilesAverageOpenTiles);
		printMetric('Skip open avg suspended', batch.aggregate.suspensionStats.skipOpenTilesAverageSuspended);
		printMetric('Skip open avg open suspended', batch.aggregate.suspensionStats.skipOpenTilesAverageOpenSuspended);
		printMetric('Skip open avg effective open', batch.aggregate.suspensionStats.skipOpenTilesAverageEffectiveOpen);
	}
}

async function main() {
	ensureLoader();

	var {
		analyzeGeneratedBoard,
		loadLayouts,
		SUSPENSION_RULE_PRESETS,
	} = await import('./analyzer.js');
	var options = parseArgs(process.argv.slice(2));

	if (options.help) {
		printHelp();
		return;
	}

	if (options.listLayouts) {
		console.log(Object.keys(loadLayouts()).join('\n'));
		return;
	}

	if (options.suspensionPreset) {
		var preset = SUSPENSION_RULE_PRESETS[options.suspensionPreset];

		if (!preset) {
			throw new Error(`Unknown suspension preset "${options.suspensionPreset}".`);
		}

		options.suspension = {
			name: options.suspensionPreset,
			...preset,
			...options.suspensionOverrides,
		};
	} else if (Object.keys(options.suspensionOverrides).length) {
		throw new Error('Suspension threshold overrides require --suspension.');
	}

	if (options.batch) {
		var boards = options.boards || [options.board];
		var rows = boards.map(function(board) {
			return runWithQuietLogs(function() {
				return compactBatchRow(analyzeGeneratedBoard({
					...options,
					board,
				}));
			});
		});
		var batch = {
			aggregate: summarizeBatch(rows, options),
			rows,
		};

		if (options.json) {
			console.log(JSON.stringify(batch, null, 2));
			return;
		}

		printBatchSummary(batch);
		return;
	}

	var summary = analyzeGeneratedBoard(options);

	if (options.json) {
		console.log(JSON.stringify(options.detail ? summary : compactSummary(summary), null, 2));
		return;
	}

	printSummary(summary);
}

try {
	await main();
} catch (err) {
	console.error(err.message);
	process.exitCode = 1;
}
