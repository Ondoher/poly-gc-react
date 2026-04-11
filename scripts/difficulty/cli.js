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
		generationDifficultyPreset: 'medium',
		generationDifficulty: null,
		tilePickerRules: {},
		faceAvoidanceRules: null,
		faceAssignmentRules: null,
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
		} else if (arg === '--generation-difficulty') {
			options.generationDifficultyPreset = argv[++idx];
		} else if (arg === '--generation-difficulty-value') {
			options.generationDifficulty = Number(argv[++idx]);
		} else if (arg === '--open-pressure-multiplier') {
			options.tilePickerRules.openPressureMultiplier = Number(argv[++idx]);
		} else if (arg === '--max-freed-pressure') {
			options.tilePickerRules.maxFreedPressure = Number(argv[++idx]);
		} else if (arg === '--balance-pressure-multiplier') {
			options.tilePickerRules.balancePressureMultiplier = Number(argv[++idx]);
		} else if (arg === '--max-balance-margin') {
			options.tilePickerRules.maxBalanceMargin = Number(argv[++idx]);
		} else if (arg === '--short-horizon-probe') {
			options.tilePickerRules.shortHorizonProbeMoves =
				options.tilePickerRules.shortHorizonProbeMoves ?? 8;
			options.tilePickerRules.shortHorizonPressureMultiplier =
				options.tilePickerRules.shortHorizonPressureMultiplier ?? 1;
		} else if (arg === '--short-horizon-probe-moves') {
			options.tilePickerRules.shortHorizonProbeMoves = Number(argv[++idx]);
		} else if (arg === '--short-horizon-pressure-multiplier') {
			options.tilePickerRules.shortHorizonPressureMultiplier = Number(argv[++idx]);
		} else if (arg === '--face-avoidance') {
			options.faceAvoidanceRules = {
				...(options.faceAvoidanceRules || {}),
				enabled: true,
			};
		} else if (arg === '--face-avoidance-weight') {
			options.faceAvoidanceRules = {
				...(options.faceAvoidanceRules || {}),
				enabled: true,
				weight: Number(argv[++idx]),
			};
		} else if (arg === '--suspension-face-avoidance-weight') {
			options.faceAvoidanceRules = {
				...(options.faceAvoidanceRules || {}),
				enabled: true,
				suspensionWeight: Number(argv[++idx]),
			};
		} else if (arg === '--face-avoidance-max-weight') {
			options.faceAvoidanceRules = {
				...(options.faceAvoidanceRules || {}),
				enabled: true,
				maxWeight: Number(argv[++idx]),
			};
		} else if (arg === '--preferred-face-group-multiplier') {
			options.faceAssignmentRules = {
				...(options.faceAssignmentRules || {}),
				preferredMultiplier: Number(argv[++idx]),
			};
		} else if (arg === '--easy-reuse-duplicate-scale') {
			options.faceAssignmentRules = {
				...(options.faceAssignmentRules || {}),
				easyReuseDuplicateScale: Number(argv[++idx]),
			};
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
		tightnessScore: summary.difficulty.components.tightnessScore,
		choicePressureScore: summary.difficulty.components.choicePressureScore,
		brutalityScore: summary.difficulty.components.brutalityScore,
		suspensionStats: summary.suspensionStats,
		tilePickerStats: summary.tilePickerStats,
		faceAvoidanceStats: summary.faceAvoidanceStats,
		initialPlayablePairCount: summary.initial.playablePairCount,
		initialDominantStackBalanceMargin: summary.initial.dominantStack.balanceMargin,
		knownSolutionValid: summary.knownSolutionPath.valid,
		knownSolutionAverageBranching: summary.knownSolutionPath.averageBranching,
		knownSolutionLowBranchMoveCount: summary.knownSolutionPath.lowBranchMoveCount,
		knownSolutionAveragePairChoiceSpread: summary.knownSolutionPath.averagePairChoiceSpread,
		knownSolutionEarlyBranching: summary.knownSolutionPath.branchTimeline.earlyAverage,
		knownSolutionMiddleBranching: summary.knownSolutionPath.branchTimeline.middleAverage,
		knownSolutionLateBranching: summary.knownSolutionPath.branchTimeline.lateAverage,
		knownSolutionLongestLowBranchRun: summary.knownSolutionPath.branchTimeline.longestLowBranchRun,
		knownSolutionDominantStackRiskMoves: summary.knownSolutionPath.dominantStackTimeline.riskMoveCount,
		knownSolutionDominantStackMoves: summary.knownSolutionPath.dominantStackTimeline.dominantMoveCount,
		initialDownstreamDeadEndRateSpread: summary.initial.pairChoiceSensitivity.downstream.maxDeadEndRateSpread,
		initialDownstreamRemainingTilesSpread: summary.initial.pairChoiceSensitivity.downstream.maxRemainingTilesSpread,
		initialDownstreamConsequentialGroupCount: summary.initial.pairChoiceSensitivity.downstream.consequentialGroupCount,
		searchConsequentialPairChoiceStateCount: summary.search.consequentialPairChoiceStateCount,
		searchDominantStackRiskRate: summary.search.dominantStackRiskRate,
		searchDominantStackRate: summary.search.dominantStackRate,
		searchMinDominantStackBalanceMargin: summary.search.minDominantStackBalanceMargin,
		playoutSolveRate: summary.playouts.solveRate,
		playoutDeadEndRate: summary.playouts.deadEndRate,
		playoutAverageRemainingTiles: summary.playouts.averageRemainingTiles,
		playoutAverageDeadEndMoves: summary.playouts.averageDeadEndMoves,
		playoutDeadEndMoveP50: summary.playouts.deadEndMoveP50,
		playoutDeadEndMoveP75: summary.playouts.deadEndMoveP75,
		playoutDeadEndMoveP90: summary.playouts.deadEndMoveP90,
		playoutDeadEndRemainingP50: summary.playouts.deadEndRemainingP50,
		playoutDeadEndRemainingP75: summary.playouts.deadEndRemainingP75,
		playoutDeadEndRemainingP90: summary.playouts.deadEndRemainingP90,
		playoutDeadEndDominantStackRiskRate: summary.playouts.deadEnded
			? summary.playouts.deadEndDominantStackRiskCount / summary.playouts.deadEnded
			: 0,
	};
}

function summarizeBatch(rows, options) {
	return {
		layout: options.layout,
		generator: options.generator,
		generationDifficulty: options.generationDifficulty,
		tilePickerRules: Object.keys(options.tilePickerRules).length
			? options.tilePickerRules
			: null,
		faceAvoidanceRules: options.faceAvoidanceRules,
		faceAssignmentRules: options.faceAssignmentRules,
		suspension: options.suspension || null,
		boardCount: rows.length,
		validKnownSolutionCount: rows.filter(function(row) {
			return row.knownSolutionValid;
		}).length,
		suspensionStats: summarizeSuspensionStats(rows),
		tilePickerStats: summarizeTilePickerStats(rows),
		faceAvoidanceStats: summarizeFaceAvoidanceStats(rows),
		score: summarizeValues(rows.map(function(row) { return row.score; })),
		tightnessScore: summarizeValues(rows.map(function(row) { return row.tightnessScore; })),
		choicePressureScore: summarizeValues(rows.map(function(row) {
			return row.choicePressureScore;
		})),
		brutalityScore: summarizeValues(rows.map(function(row) {
			return row.brutalityScore;
		})),
		playoutSolveRate: summarizeValues(rows.map(function(row) { return row.playoutSolveRate; })),
		playoutDeadEndRate: summarizeValues(rows.map(function(row) { return row.playoutDeadEndRate; })),
		playoutAverageRemainingTiles: summarizeValues(rows.map(function(row) {
			return row.playoutAverageRemainingTiles;
		})),
		playoutAverageDeadEndMoves: summarizeValues(rows.map(function(row) {
			return row.playoutAverageDeadEndMoves;
		})),
		playoutDeadEndMoveP75: summarizeValues(rows.map(function(row) {
			return row.playoutDeadEndMoveP75;
		})),
		playoutDeadEndRemainingP75: summarizeValues(rows.map(function(row) {
			return row.playoutDeadEndRemainingP75;
		})),
		playoutDeadEndDominantStackRiskRate: summarizeValues(rows.map(function(row) {
			return row.playoutDeadEndDominantStackRiskRate;
		})),
		knownSolutionAverageBranching: summarizeValues(rows.map(function(row) {
			return row.knownSolutionAverageBranching;
		})),
		knownSolutionEarlyBranching: summarizeValues(rows.map(function(row) {
			return row.knownSolutionEarlyBranching;
		})),
		knownSolutionMiddleBranching: summarizeValues(rows.map(function(row) {
			return row.knownSolutionMiddleBranching;
		})),
		knownSolutionLateBranching: summarizeValues(rows.map(function(row) {
			return row.knownSolutionLateBranching;
		})),
		knownSolutionLongestLowBranchRun: summarizeValues(rows.map(function(row) {
			return row.knownSolutionLongestLowBranchRun;
		})),
		knownSolutionDominantStackRiskMoves: summarizeValues(rows.map(function(row) {
			return row.knownSolutionDominantStackRiskMoves;
		})),
		knownSolutionDominantStackMoves: summarizeValues(rows.map(function(row) {
			return row.knownSolutionDominantStackMoves;
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
		searchDominantStackRiskRate: summarizeValues(rows.map(function(row) {
			return row.searchDominantStackRiskRate;
		})),
		searchDominantStackRate: summarizeValues(rows.map(function(row) {
			return row.searchDominantStackRate;
		})),
		searchMinDominantStackBalanceMargin: summarizeValues(rows.map(function(row) {
			return row.searchMinDominantStackBalanceMargin;
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

function summarizeTilePickerStats(rows) {
	var statsRows = rows
		.map(function(row) { return row.tilePickerStats; })
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

function summarizeFaceAvoidanceStats(rows) {
	var statsRows = rows
		.map(function(row) { return row.faceAvoidanceStats; })
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
  --generation-difficulty <preset>
                    Weighted engine picker difficulty: easy, medium, or hard. Default: medium
  --generation-difficulty-value <n>
                    Weighted engine picker difficulty as a number from 0 to 1
  --open-pressure-multiplier <n>
                    Override hard-side low-open pressure multiplier
  --max-freed-pressure <n>
                    Override the freed-tile range used for low-open pressure
  --balance-pressure-multiplier <n>
                    Override hard-side stack-balance pressure multiplier
  --max-balance-margin <n>
                    Override the margin range used for stack-balance pressure
  --short-horizon-probe
                    Enable structural short-horizon tile picker probes
  --short-horizon-probe-moves <n>
                    Override short-horizon structural probe depth
  --short-horizon-pressure-multiplier <n>
                    Override short-horizon collapse pressure multiplier
  --face-avoidance Enable weighted face-set avoidance
  --face-avoidance-weight <n>
                    Set normal-pair face-set avoidance weight
  --suspension-face-avoidance-weight <n>
                    Set suspension face-set avoidance weight
  --face-avoidance-max-weight <n>
                    Set maximum accumulated avoidance weight per tile/face set
  --preferred-face-group-multiplier <n>
                    Fractional sort multiplier for preferred face groups
  --easy-reuse-duplicate-scale <n>
                    Duplicate reused face-group entries on easy difficulties
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
		generationDifficulty: summary.generationDifficulty,
		faceAvoidanceRules: summary.faceAvoidanceRules,
		suspension: summary.suspension,
		suspensionStats: summary.suspensionStats,
		tilePickerStats: summary.tilePickerStats,
		faceAvoidanceStats: summary.faceAvoidanceStats,
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
			dominantStack: summary.initial.dominantStack,
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
			branchTimeline: summary.knownSolutionPath.branchTimeline,
			dominantStackTimeline: summary.knownSolutionPath.dominantStackTimeline,
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
Generation difficulty: ${summary.generationDifficulty}
Face assignment: ${summary.faceAssignmentRules ? JSON.stringify(summary.faceAssignmentRules) : 'default'}
Suspension: ${summary.suspension ? summary.suspension.name : 'off'}
Tiles: ${summary.tileCount}
Difficulty: ${summary.difficulty.label} (${summary.difficulty.score}/100)
Tightness score: ${summary.difficulty.components.tightnessScore.toFixed(2)}
Choice pressure score: ${summary.difficulty.components.choicePressureScore.toFixed(2)}
Brutality score: ${summary.difficulty.components.brutalityScore.toFixed(2)}

Initial playable pairs: ${summary.initial.playablePairCount}
Initial ambiguous face sets: ${summary.initial.faceSetSummary.ambiguousFaceSetCount}
Initial consequential pair-choice groups: ${summary.initial.pairChoiceSensitivity.consequentialGroupCount}
Initial dominant stack balance margin: ${summary.initial.dominantStack.balanceMargin}

Known solution valid: ${formatKnownSolutionStatus(summary.knownSolutionPath)}
Known solution average branching: ${summary.knownSolutionPath.averageBranching.toFixed(2)}
Known solution low-branch moves: ${summary.knownSolutionPath.lowBranchMoveCount}
Known solution branching thirds: ${summary.knownSolutionPath.branchTimeline.earlyAverage.toFixed(2)} / ${summary.knownSolutionPath.branchTimeline.middleAverage.toFixed(2)} / ${summary.knownSolutionPath.branchTimeline.lateAverage.toFixed(2)}
Known solution dominant-stack risk moves: ${summary.knownSolutionPath.dominantStackTimeline.riskMoveCount}

Search states explored: ${summary.search.statesExplored}
Search max depth reached: ${summary.search.maxDepthReached}
Search dead ends: ${summary.search.deadEnds}
Search solved branches: ${summary.search.solvedBranches}
Search average branching: ${summary.search.averageBranching.toFixed(2)}
Search consequential pair-choice states: ${summary.search.consequentialPairChoiceStateCount}
Search dominant-stack risk rate: ${(summary.search.dominantStackRiskRate * 100).toFixed(1)}%

Playouts: ${summary.playouts.count}
Playout solve rate: ${(summary.playouts.solveRate * 100).toFixed(1)}%
Playout dead-end rate: ${(summary.playouts.deadEndRate * 100).toFixed(1)}%
Playout average remaining tiles: ${summary.playouts.averageRemainingTiles.toFixed(2)}
Playout average dead-end moves: ${summary.playouts.averageDeadEndMoves.toFixed(2)}
Playout p75 dead-end remaining tiles: ${summary.playouts.deadEndRemainingP75.toFixed(2)}
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
Generation difficulty: ${batch.aggregate.generationDifficulty}
Tile picker rules: ${batch.aggregate.tilePickerRules ? JSON.stringify(batch.aggregate.tilePickerRules) : 'default'}
Face avoidance: ${batch.aggregate.faceAvoidanceRules ? JSON.stringify(batch.aggregate.faceAvoidanceRules) : 'off'}
Face assignment: ${batch.aggregate.faceAssignmentRules ? JSON.stringify(batch.aggregate.faceAssignmentRules) : 'default'}
Suspension: ${batch.aggregate.suspension ? batch.aggregate.suspension.name : 'off'}
Boards: ${batch.aggregate.boardCount}
Known solutions valid: ${batch.aggregate.validKnownSolutionCount}/${batch.aggregate.boardCount}
`);
	printMetric('Score', batch.aggregate.score);
	printMetric('Tightness score', batch.aggregate.tightnessScore);
	printMetric('Choice pressure score', batch.aggregate.choicePressureScore);
	printMetric('Brutality score', batch.aggregate.brutalityScore);
	printMetric('Playout solve rate', batch.aggregate.playoutSolveRate, percent);
	printMetric('Playout dead-end rate', batch.aggregate.playoutDeadEndRate, percent);
	printMetric('Playout average remaining tiles', batch.aggregate.playoutAverageRemainingTiles);
	printMetric('Playout average dead-end moves', batch.aggregate.playoutAverageDeadEndMoves);
	printMetric('Playout p75 dead-end moves', batch.aggregate.playoutDeadEndMoveP75);
	printMetric('Playout p75 dead-end remaining tiles', batch.aggregate.playoutDeadEndRemainingP75);
	printMetric(
		'Playout dead-end dominant-stack risk rate',
		batch.aggregate.playoutDeadEndDominantStackRiskRate,
		percent
	);
	printMetric('Known solution average branching', batch.aggregate.knownSolutionAverageBranching);
	printMetric('Known solution early branching', batch.aggregate.knownSolutionEarlyBranching);
	printMetric('Known solution middle branching', batch.aggregate.knownSolutionMiddleBranching);
	printMetric('Known solution late branching', batch.aggregate.knownSolutionLateBranching);
	printMetric('Known solution longest low-branch run', batch.aggregate.knownSolutionLongestLowBranchRun);
	printMetric('Known solution dominant-stack risk moves', batch.aggregate.knownSolutionDominantStackRiskMoves);
	printMetric('Known solution dominant-stack moves', batch.aggregate.knownSolutionDominantStackMoves);
	printMetric('Known solution pair-choice spread', batch.aggregate.knownSolutionAveragePairChoiceSpread);
	printMetric('Initial downstream dead-end spread', batch.aggregate.initialDownstreamDeadEndRateSpread, percent);
	printMetric('Initial downstream remaining-tiles spread', batch.aggregate.initialDownstreamRemainingTilesSpread);
	printMetric('Initial downstream consequential groups', batch.aggregate.initialDownstreamConsequentialGroupCount);
	printMetric('Search consequential pair-choice states', batch.aggregate.searchConsequentialPairChoiceStateCount);
	printMetric('Search dominant-stack risk rate', batch.aggregate.searchDominantStackRiskRate, percent);
	printMetric('Search dominant-stack rate', batch.aggregate.searchDominantStackRate, percent);
	printMetric('Search min dominant-stack balance margin', batch.aggregate.searchMinDominantStackBalanceMargin);
	if (batch.aggregate.tilePickerStats) {
		printMetric('Picker picks', batch.aggregate.tilePickerStats.picks);
		printMetric('Picker average weight', batch.aggregate.tilePickerStats.averageWeight);
		printMetric('Picker average freed tiles', batch.aggregate.tilePickerStats.averageFreedCount);
		printMetric('Picker average freed rank', batch.aggregate.tilePickerStats.averageFreedRank);
		printMetric('Picker average open pressure', batch.aggregate.tilePickerStats.averageOpenPressure);
		printMetric('Picker average z', batch.aggregate.tilePickerStats.averageZ);
		printMetric('Picker average z weight', batch.aggregate.tilePickerStats.averageZWeight);
		printMetric('Picker average balance margin', batch.aggregate.tilePickerStats.averageBalanceMargin);
		printMetric('Picker average balance pressure', batch.aggregate.tilePickerStats.averageBalancePressure);
		printMetric('Picker average short-horizon moves', batch.aggregate.tilePickerStats.averageShortHorizonMoves);
		printMetric(
			'Picker average short-horizon remaining tiles',
			batch.aggregate.tilePickerStats.averageShortHorizonRemainingTiles
		);
		printMetric(
			'Picker average short-horizon pressure',
			batch.aggregate.tilePickerStats.averageShortHorizonPressure
		);
		printMetric(
			'Picker short-horizon collapse rate',
			batch.aggregate.tilePickerStats.shortHorizonCollapseRate,
			percent
		);
		printMetric(
			'Picker average horizontal intersections',
			batch.aggregate.tilePickerStats.averageHorizontalIntersections
		);
		printMetric(
			'Picker average vertical intersections',
			batch.aggregate.tilePickerStats.averageVerticalIntersections
		);
		printMetric('Picker average candidates', batch.aggregate.tilePickerStats.averageCandidateCount);
		printMetric('Picker average window size', batch.aggregate.tilePickerStats.averageWindowSize);
		printMetric('Picker average window start', batch.aggregate.tilePickerStats.averageWindowStart);
		printMetric('Picker short-horizon probes', batch.aggregate.tilePickerStats.shortHorizonProbeCount);
		printMetric('Picker normal first picks', batch.aggregate.tilePickerStats.normalFirstPicks);
		printMetric('Picker normal second picks', batch.aggregate.tilePickerStats.normalSecondPicks);
		printMetric('Picker suspension first picks', batch.aggregate.tilePickerStats.suspensionFirstPicks);
		printMetric('Picker suspension second picks', batch.aggregate.tilePickerStats.suspensionSecondPicks);
		printMetric('Picker suspension third picks', batch.aggregate.tilePickerStats.suspensionThirdPicks);
		printMetric('Picker released partner picks', batch.aggregate.tilePickerStats.releasedPartnerPicks);
		printMetric('Picker stack safety rejected', batch.aggregate.tilePickerStats.stackSafetyRejected);
	}
	if (batch.aggregate.faceAvoidanceStats) {
		printMetric('Face avoidance marks', batch.aggregate.faceAvoidanceStats.marksAdded);
		printMetric(
			'Face avoidance preferred groups',
			batch.aggregate.faceAvoidanceStats.preferredFaceGroups
		);
		printMetric(
			'Face avoidance preferred draws',
			batch.aggregate.faceAvoidanceStats.preferredFaceGroupDraws
		);
		printMetric(
			'Face avoidance preferred fallbacks',
			batch.aggregate.faceAvoidanceStats.preferredFaceGroupFallbacks
		);
		printMetric('Face avoidance draws', batch.aggregate.faceAvoidanceStats.drawCount);
		printMetric(
			'Face avoidance average selected penalty',
			batch.aggregate.faceAvoidanceStats.averageSelectedPenalty
		);
		printMetric(
			'Face avoidance non-zero penalty draw rate',
			batch.aggregate.faceAvoidanceStats.nonZeroPenaltyDrawRate,
			percent
		);
		printMetric(
			'Face avoidance max selected penalty',
			batch.aggregate.faceAvoidanceStats.maxSelectedPenalty
		);
	}
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
		GENERATION_DIFFICULTY_PRESETS,
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

	if (options.generationDifficulty === null) {
		if (!(options.generationDifficultyPreset in GENERATION_DIFFICULTY_PRESETS)) {
			throw new Error(`Unknown generation difficulty "${options.generationDifficultyPreset}".`);
		}

		options.generationDifficulty = GENERATION_DIFFICULTY_PRESETS[options.generationDifficultyPreset];
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
