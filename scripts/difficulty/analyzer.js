import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import Engine from '../../src/gc/features/mj/src/engine/Engine.js';
import {
	generateRandomBoard,
	generateRandomFaceBoard,
} from './random-board-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');
const LAYOUTS_PATH = path.join(
	REPO_ROOT,
	'src/gc/features/mj/src/data/layouts.json'
);
const DEFAULT_ANALYSIS_OPTIONS = {
	maxDepth: 18,
	maxStates: 10000,
	maxSolutions: 1000,
	playouts: 48,
	maxPlayoutMoves: 72,
	pairChoicePlayouts: 4,
};
export const SUSPENSION_RULE_PRESETS = {
	conservative: {
		frequency: 0.15,
		maxSuspended: 8,
		maxNested: 1,
		placementCount: {
			min: 3,
			max: 6,
		},
		maxOpenCount: {
			min: 8,
			max: 12,
		},
		matchType: 'either',
		forceReleaseAtEffectiveOpen: 4,
		suspendAtEffectiveOpen: 6,
	},
	moderate: {
		frequency: 0.35,
		maxSuspended: 18,
		maxNested: 2,
		placementCount: {
			min: 4,
			max: 9,
		},
		maxOpenCount: {
			min: 6,
			max: 10,
		},
		matchType: 'either',
		forceReleaseAtEffectiveOpen: 4,
		suspendAtEffectiveOpen: 6,
	},
	aggressive: {
		frequency: 0.8,
		maxSuspended: 40,
		maxNested: 4,
		placementCount: {
			min: 8,
			max: 16,
		},
		maxOpenCount: {
			min: 4,
			max: 8,
		},
		matchType: 'both',
		forceReleaseAtEffectiveOpen: 4,
		suspendAtEffectiveOpen: 6,
	},
};

export const GENERATION_DIFFICULTY_PRESETS = {
	easy: 0,
	medium: 0.5,
	hard: 1,
};

function keyForSpace(x, y, z) {
	return `${x},${y},${z}`;
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

function average(values) {
	if (values.length === 0) {
		return 0;
	}

	return values.reduce(function(total, value) {
		return total + value;
	}, 0) / values.length;
}

function percentile(values, percent) {
	if (values.length === 0) {
		return 0;
	}

	var sorted = values.slice().sort(function(left, right) {
		return left - right;
	});
	var index = Math.ceil((percent / 100) * sorted.length) - 1;

	return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

function longestRun(values, predicate) {
	var longest = 0;
	var current = 0;

	values.forEach(function(value) {
		if (predicate(value)) {
			current++;
			longest = Math.max(longest, current);
		} else {
			current = 0;
		}
	});

	return longest;
}

function hashString(value) {
	return String(value).split('').reduce(function(hash, char) {
		return ((hash << 5) - hash + char.charCodeAt(0)) >>> 0;
	}, 2166136261);
}

class DeterministicRandom {
	constructor(seed) {
		this.seed = seed >>> 0;
	}

	next(limit) {
		this.seed = (this.seed * 1664525 + 1013904223) >>> 0;

		if (limit === undefined) {
			return this.seed / 0x100000000;
		}

		return Math.floor((this.seed / 0x100000000) * limit);
	}
}

export function loadLayouts() {
	return JSON.parse(fs.readFileSync(LAYOUTS_PATH, 'utf8'));
}

export function createGeneratedBoard({
	layout = 'turtle',
	board = 1,
	generator = 'engine',
	suspension = null,
	generationDifficulty = GENERATION_DIFFICULTY_PRESETS.medium,
	tilePickerRules = null,
	faceAvoidanceRules = null,
	faceAssignmentRules = null,
} = {}) {
	var layouts = loadLayouts();
	var layoutDefinition = layouts[layout];

	if (!layoutDefinition) {
		throw new Error(`Unknown layout "${layout}".`);
	}

	if (generator === 'standalone') {
		var generated = generateRandomBoard(layoutDefinition, Number(board));

		return {
			engine: new GeneratedBoardAdapter(generated.board, generated.solution),
			layout: layoutDefinition,
			boardNumber: Number(board),
			generator,
			generationDifficulty,
			generationAttempt: generated.attempt,
		};
	}

	if (generator === 'random') {
		var generated = generateRandomFaceBoard(layoutDefinition, Number(board));

		return {
			engine: new GeneratedBoardAdapter(generated.board, generated.solution),
			layout: layoutDefinition,
			boardNumber: Number(board),
			generator,
			generationDifficulty,
			generationAttempt: generated.attempt,
		};
	}

	if (generator !== 'engine') {
		throw new Error(`Unknown generator "${generator}". Use "engine", "standalone", or "random".`);
	}

	var engine = new Engine();

	engine.setLayout(layoutDefinition);
	if (faceAvoidanceRules) {
		engine.setupFaceAvoidanceRules(faceAvoidanceRules);
	}
	if (faceAssignmentRules) {
		engine.setupFaceAssignmentRules(faceAssignmentRules);
	}
	if (tilePickerRules) {
		engine.setupTilePickerRules(tilePickerRules);
	}
	engine.setupDifficulty(generationDifficulty);
	if (suspension) {
		engine.setupSuspensionRules(suspension);
		if (faceAvoidanceRules) {
			engine.setupFaceAvoidanceRules(faceAvoidanceRules);
		}
		if (faceAssignmentRules) {
			engine.setupFaceAssignmentRules(faceAssignmentRules);
		}
		if (tilePickerRules) {
			engine.setupTilePickerRules(tilePickerRules);
		}
		engine.setupDifficulty(generationDifficulty);
	}
	engine.generateGame(Number(board));

	return {
		engine,
		layout: layoutDefinition,
		boardNumber: Number(board),
		generator,
		generationDifficulty,
		suspension,
		faceAvoidanceRules,
		faceAssignmentRules,
	};
}

class GeneratedBoardAdapter {
	constructor(board, solution) {
		this.board = board;
		this.solution = solution ? solution.slice() : null;
		this.undoStack = [];
		this.redoStack = [];
		this.selectableTiles = new Set();
		this.placedTileSet = new Set();
		this.usedSpaces = new Set();
		this.placedTiles = {
			chunks: [],
		};

		this.startOver();
	}

	startOver() {
		this.undoStack = [];
		this.redoStack = [];
		this.tileCount = this.board.count;
		this.placedTileSet = new Set();
		this.usedSpaces = new Set();

		for (let tile = 0; tile < this.board.count; tile++) {
			this.addTile(tile);
		}

		this.updatePlacedSignature();
	}

	getSolution() {
		return this.solution || [];
	}

	getHints(tile = -1) {
		return this.calcPlayablePairs(tile);
	}

	canPlay(tile1, tile2) {
		this.calcSelectableTiles();
		return this.isPlayablePair(tile1, tile2);
	}

	playTiles(tile1, tile2) {
		this.removeTile(tile1);
		this.removeTile(tile2);
		this.undoStack.push(tile1, tile2);
		this.redoStack = [];
		this.tileCount -= 2;
		this.updatePlacedSignature();
	}

	undo() {
		if (!this.undoStack.length) {
			return undefined;
		}

		var tile2 = this.undoStack.pop();
		var tile1 = this.undoStack.pop();

		this.redoStack.push(tile1, tile2);
		this.addTile(tile1);
		this.addTile(tile2);
		this.tileCount += 2;
		this.updatePlacedSignature();

		return {tile1, tile2};
	}

	calcPlayablePairs(selectedTile) {
		this.calcSelectableTiles();

		var pairs = [];

		if (selectedTile === -1) {
			for (let outer = 0; outer < this.board.count; outer++) {
				if (!this.selectableTiles.has(outer)) {
					continue;
				}

				for (let inner = outer + 1; inner < this.board.count; inner++) {
					if (this.isPlayablePair(outer, inner)) {
						pairs.push({tile1: outer, tile2: inner});
					}
				}
			}
		} else {
			for (let idx = 0; idx < this.board.count; idx++) {
				if (this.isPlayablePair(selectedTile, idx)) {
					pairs.push({tile1: selectedTile, tile2: idx});
				}
			}
		}

		return pairs;
	}

	calcSelectableTiles() {
		this.selectableTiles.clear();

		for (let tile = 0; tile < this.board.count; tile++) {
			if (this.isTileSelectable(tile)) {
				this.selectableTiles.add(tile);
			}
		}
	}

	isTileSelectable(tile) {
		if (!this.placedTileSet.has(tile)) {
			return false;
		}

		var {x, y, z} = this.board.pieces[tile].pos;

		if (x === -1) {
			return false;
		}

		return this.hasOpenSide(x, y, z) && this.hasOpenTop(x, y, z);
	}

	isPlayablePair(tile1, tile2) {
		return this.selectableTiles.has(tile1) &&
			this.selectableTiles.has(tile2) &&
			tile1 !== tile2 &&
			this.doFacesMatch(
				this.board.pieces[tile1].face,
				this.board.pieces[tile2].face
			);
	}

	doFacesMatch(face1, face2) {
		return Math.floor(face1 / 4) === Math.floor(face2 / 4);
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

	addTile(tile) {
		this.placedTileSet.add(tile);
		this.addPosition(this.board.pieces[tile].pos);
	}

	removeTile(tile) {
		this.placedTileSet.delete(tile);
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

	isUsed(x, y, z) {
		return this.usedSpaces.has(keyForSpace(x, y, z));
	}

	updatePlacedSignature() {
		this.placedTiles.chunks = [
			Array.from(this.placedTileSet).sort(function(left, right) {
				return left - right;
			}).join(':'),
		];
	}
}

export class MahjonggDifficultyAnalyzer {
	constructor(engine, options = {}) {
		this.engine = engine;
		this.options = {
			...DEFAULT_ANALYSIS_OPTIONS,
			...options,
		};
	}

	analyze() {
		this.engine.startOver();

		var initialPairs = this.getPlayablePairs();
		var initialPairChoice = this.measurePairChoiceSensitivity(initialPairs, {
			includeDownstream: true,
		});
		var knownSolutionPath = this.analyzeKnownSolutionPath();

		this.engine.startOver();
		var search = this.analyzeBoundedSearch();
		this.engine.startOver();
		var playouts = this.analyzePlayouts();
		this.engine.startOver();
		var dominantStack = this.getDominantStackProfile();

		return {
			options: this.options,
			initial: {
				remainingTiles: this.engine.tileCount,
				playablePairCount: initialPairs.length,
				playablePairs: initialPairs,
				faceSetSummary: this.summarizeFaceSets(initialPairs),
				pairChoiceSensitivity: initialPairChoice,
				dominantStack,
			},
			knownSolutionPath,
			search,
			playouts,
			difficulty: this.scoreDifficulty({
				initialPairChoice,
				search,
				knownSolutionPath,
				playouts,
			}),
		};
	}

	getPlayablePairs() {
		return this.engine.getHints(-1).map(function(pair) {
			return {
				tile1: pair.tile1,
				tile2: pair.tile2,
				faceSet: this.getFaceSetForTile(pair.tile1),
			};
		}, this);
	}

	getFaceSetForTile(tile) {
		return Math.floor(this.engine.board.pieces[tile].face / 4);
	}

	groupPairsByFaceSet(pairs) {
		return pairs.reduce(function(groups, pair) {
			groups[pair.faceSet] = groups[pair.faceSet] || [];
			groups[pair.faceSet].push(pair);
			return groups;
		}, {});
	}

	summarizeFaceSets(pairs) {
		var groups = this.groupPairsByFaceSet(pairs);
		var summaries = Object.keys(groups).map(function(faceSet) {
			var groupPairs = groups[faceSet];
			var tiles = new Set();

			groupPairs.forEach(function(pair) {
				tiles.add(pair.tile1);
				tiles.add(pair.tile2);
			});

			return {
				faceSet: Number(faceSet),
				pairCount: groupPairs.length,
				openTileCount: tiles.size,
			};
		});

		return {
			faceSetCount: summaries.length,
			ambiguousFaceSetCount: summaries.filter(function(summary) {
				return summary.pairCount > 1;
			}).length,
			groups: summaries,
		};
	}

	measurePairChoiceSensitivity(pairs, options = {}) {
		var groups = this.groupPairsByFaceSet(pairs);
		var ambiguousGroups = [];

		Object.keys(groups).forEach(function(faceSet) {
			var groupPairs = groups[faceSet];

			if (groupPairs.length <= 1) {
				return;
			}

			var outcomes = groupPairs.map(function(pair) {
				this.engine.playTiles(pair.tile1, pair.tile2);
				var nextPairs = this.getPlayablePairs();
				var outcome = {
					pair: {
						tile1: pair.tile1,
						tile2: pair.tile2,
					},
					nextPlayablePairCount: nextPairs.length,
					solved: this.engine.tileCount === 0,
					deadEnd: this.engine.tileCount > 0 && nextPairs.length === 0,
				};
				if (options.includeDownstream) {
					outcome.downstream = this.measureDownstreamPairChoice(pair);
				}
				this.engine.undo();
				return outcome;
			}, this);

			var nextCounts = outcomes.map(function(outcome) {
				return outcome.nextPlayablePairCount;
			});
			var deadEndCount = outcomes.filter(function(outcome) {
				return outcome.deadEnd;
			}).length;
			var spread = Math.max(...nextCounts) - Math.min(...nextCounts);
			var downstream = options.includeDownstream
				? this.summarizeDownstreamPairChoice(outcomes)
				: null;

			ambiguousGroups.push({
				faceSet: Number(faceSet),
				pairCount: groupPairs.length,
				spread,
				deadEndCount,
				isConsequential: spread >= 2 || (deadEndCount > 0 && deadEndCount < outcomes.length),
				downstream,
				outcomes,
			});
		}, this);

		var downstreamGroups = ambiguousGroups
			.map(function(group) { return group.downstream; })
			.filter(Boolean);

		return {
			ambiguousGroupCount: ambiguousGroups.length,
			consequentialGroupCount: ambiguousGroups.filter(function(group) {
				return group.isConsequential;
			}).length,
			maxSpread: ambiguousGroups.length
				? Math.max(...ambiguousGroups.map(function(group) { return group.spread; }))
				: 0,
			averageSpread: average(ambiguousGroups.map(function(group) {
				return group.spread;
			})),
			downstream: {
				sampleGroupCount: downstreamGroups.length,
				consequentialGroupCount: downstreamGroups.filter(function(group) {
					return group.isConsequential;
				}).length,
				maxDeadEndRateSpread: downstreamGroups.length
					? Math.max(...downstreamGroups.map(function(group) {
						return group.deadEndRateSpread;
					}))
					: 0,
				averageDeadEndRateSpread: average(downstreamGroups.map(function(group) {
					return group.deadEndRateSpread;
				})),
				maxRemainingTilesSpread: downstreamGroups.length
					? Math.max(...downstreamGroups.map(function(group) {
						return group.averageRemainingTilesSpread;
					}))
					: 0,
				averageRemainingTilesSpread: average(downstreamGroups.map(function(group) {
					return group.averageRemainingTilesSpread;
				})),
			},
			groups: ambiguousGroups,
		};
	}

	measureDownstreamPairChoice(pair) {
		var count = this.options.pairChoicePlayouts;
		var stats = {
			count,
			solved: 0,
			deadEnded: 0,
			totalMoves: 0,
			totalRemainingTiles: 0,
			solveRate: 0,
			deadEndRate: 0,
			averageMoves: 0,
			averageRemainingTiles: 0,
		};

		if (count <= 0) {
			return stats;
		}

		var seed = hashString([
			this.getBoardFaceSignature(),
			this.getStateSignature(),
			pair.tile1,
			pair.tile2,
		].join('|'));

		for (let idx = 0; idx < count; idx++) {
			var playout = this.runReversiblePlayout(new DeterministicRandom(seed + idx));

			stats.totalMoves += playout.moves;
			stats.totalRemainingTiles += playout.remainingTiles;

			if (playout.solved) {
				stats.solved++;
			}

			if (playout.deadEnded) {
				stats.deadEnded++;
			}
		}

		stats.solveRate = stats.solved / count;
		stats.deadEndRate = stats.deadEnded / count;
		stats.averageMoves = stats.totalMoves / count;
		stats.averageRemainingTiles = stats.totalRemainingTiles / count;

		return stats;
	}

	summarizeDownstreamPairChoice(outcomes) {
		var deadEndRates = outcomes.map(function(outcome) {
			return outcome.downstream.deadEndRate;
		});
		var solveRates = outcomes.map(function(outcome) {
			return outcome.downstream.solveRate;
		});
		var remainingTiles = outcomes.map(function(outcome) {
			return outcome.downstream.averageRemainingTiles;
		});
		var deadEndRateSpread = Math.max(...deadEndRates) - Math.min(...deadEndRates);
		var solveRateSpread = Math.max(...solveRates) - Math.min(...solveRates);
		var averageRemainingTilesSpread = Math.max(...remainingTiles) - Math.min(...remainingTiles);

		return {
			deadEndRateSpread,
			solveRateSpread,
			averageRemainingTilesSpread,
			isConsequential: deadEndRateSpread >= 0.25 || averageRemainingTilesSpread >= 12,
		};
	}

	analyzeKnownSolutionPath() {
		var solution = this.engine.getSolution().slice();
		var branchCounts = [];
		var pairChoiceSpread = [];
		var dominantStackProfiles = [];
		var invalidStep = null;
		var movesPlayed = 0;

		if (solution.length === 0 && this.engine.tileCount > 0) {
			return {
				available: false,
				valid: null,
				invalidStep: null,
				moveCount: 0,
				averageBranching: 0,
				minBranching: 0,
				maxBranching: 0,
				lowBranchMoveCount: 0,
				averagePairChoiceSpread: 0,
				branchCounts: [],
				branchTimeline: this.summarizeBranchTimeline([]),
				dominantStackTimeline: this.summarizeDominantStackTimeline([]),
			};
		}

		try {
			for (let idx = 0; idx < solution.length; idx += 2) {
				var tile1 = solution[idx];
				var tile2 = solution[idx + 1];
				var pairs = this.getPlayablePairs();
				var pairChoice = this.measurePairChoiceSensitivity(pairs);
				var dominantStack = this.getDominantStackProfile();

				branchCounts.push(pairs.length);
				pairChoiceSpread.push(pairChoice.maxSpread);
				dominantStackProfiles.push(dominantStack);

				if (!this.engine.canPlay(tile1, tile2)) {
					invalidStep = {
						moveIndex: idx / 2,
						tile1,
						tile2,
						playablePairCount: pairs.length,
					};
					break;
				}

				this.engine.playTiles(tile1, tile2);
				movesPlayed++;
			}
		} finally {
			while (movesPlayed > 0) {
				this.engine.undo();
				movesPlayed--;
			}
		}

		return {
			available: true,
			valid: invalidStep === null,
			invalidStep,
			moveCount: Math.floor(solution.length / 2),
			averageBranching: average(branchCounts),
			minBranching: branchCounts.length ? Math.min(...branchCounts) : 0,
			maxBranching: branchCounts.length ? Math.max(...branchCounts) : 0,
			lowBranchMoveCount: branchCounts.filter(function(count) {
				return count <= 2;
			}).length,
			averagePairChoiceSpread: average(pairChoiceSpread),
			branchCounts,
			branchTimeline: this.summarizeBranchTimeline(branchCounts),
			dominantStackTimeline: this.summarizeDominantStackTimeline(dominantStackProfiles),
		};
	}

	analyzeBoundedSearch() {
		var stats = {
			bounded: true,
			maxDepth: this.options.maxDepth,
			maxStates: this.options.maxStates,
			maxSolutions: this.options.maxSolutions,
			statesExplored: 0,
			uniqueStates: 0,
			transpositionHits: 0,
			solvedBranches: 0,
			deadEnds: 0,
			prunedByDepth: 0,
			prunedByStateLimit: 0,
			prunedBySolutionLimit: 0,
			maxDepthReached: 0,
			branchStateCount: 0,
			branchCountTotal: 0,
			minBranching: null,
			maxBranching: 0,
			lowBranchStateCount: 0,
			pairChoiceSensitivitySampleCount: 0,
			pairChoiceSpreadTotal: 0,
			consequentialPairChoiceStateCount: 0,
			dominantStackRiskStateCount: 0,
			dominantStackStateCount: 0,
			maxDominantStackHeight: 0,
			minDominantStackBalanceMargin: null,
		};
		var seen = new Set();

		this.exploreSearchNode(0, stats, seen);

		return {
			...stats,
			averageBranching: stats.branchStateCount
				? stats.branchCountTotal / stats.branchStateCount
				: 0,
			minBranching: stats.minBranching ?? 0,
			deadEndRate: stats.statesExplored
				? stats.deadEnds / stats.statesExplored
				: 0,
			solutionRate: stats.statesExplored
				? stats.solvedBranches / stats.statesExplored
				: 0,
			averagePairChoiceSpread: stats.pairChoiceSensitivitySampleCount
				? stats.pairChoiceSpreadTotal / stats.pairChoiceSensitivitySampleCount
				: 0,
			dominantStackRiskRate: stats.statesExplored
				? stats.dominantStackRiskStateCount / stats.statesExplored
				: 0,
			dominantStackRate: stats.statesExplored
				? stats.dominantStackStateCount / stats.statesExplored
				: 0,
			minDominantStackBalanceMargin: stats.minDominantStackBalanceMargin ?? 0,
		};
	}

	analyzePlayouts() {
		var stats = {
			count: this.options.playouts,
			maxMoves: this.options.maxPlayoutMoves,
			solved: 0,
			deadEnded: 0,
			totalMoves: 0,
			totalRemainingTiles: 0,
			deepestMoveCount: 0,
			shallowestDeadEndMoveCount: null,
			deadEndMoveCounts: [],
			deadEndRemainingTiles: [],
			deadEndDominantStackRiskCount: 0,
			deadEndDominantStackCount: 0,
			deadEndMoveP50: 0,
			deadEndMoveP75: 0,
			deadEndMoveP90: 0,
			deadEndRemainingP50: 0,
			deadEndRemainingP75: 0,
			deadEndRemainingP90: 0,
			averageDeadEndMoves: 0,
			averageDeadEndRemainingTiles: 0,
			averageMoves: 0,
			averageRemainingTiles: 0,
			solveRate: 0,
			deadEndRate: 0,
		};

		if (stats.count <= 0) {
			return stats;
		}

		var baseSeed = hashString(this.getBoardFaceSignature());

		for (let idx = 0; idx < stats.count; idx++) {
			this.engine.startOver();
			var playout = this.runPlayout(new DeterministicRandom(baseSeed + idx));

			stats.totalMoves += playout.moves;
			stats.totalRemainingTiles += playout.remainingTiles;
			stats.deepestMoveCount = Math.max(stats.deepestMoveCount, playout.moves);

			if (playout.solved) {
				stats.solved++;
			}

			if (playout.deadEnded) {
				stats.deadEnded++;
				stats.deadEndMoveCounts.push(playout.moves);
				stats.deadEndRemainingTiles.push(playout.remainingTiles);
				if (playout.dominantStack.atRisk) {
					stats.deadEndDominantStackRiskCount++;
				}
				if (playout.dominantStack.dominant) {
					stats.deadEndDominantStackCount++;
				}
				stats.shallowestDeadEndMoveCount = stats.shallowestDeadEndMoveCount === null
					? playout.moves
					: Math.min(stats.shallowestDeadEndMoveCount, playout.moves);
			}
		}

		this.engine.startOver();

		stats.averageMoves = stats.totalMoves / stats.count;
		stats.averageRemainingTiles = stats.totalRemainingTiles / stats.count;
		stats.solveRate = stats.solved / stats.count;
		stats.deadEndRate = stats.deadEnded / stats.count;
		stats.shallowestDeadEndMoveCount = stats.shallowestDeadEndMoveCount ?? 0;
		stats.averageDeadEndMoves = average(stats.deadEndMoveCounts);
		stats.averageDeadEndRemainingTiles = average(stats.deadEndRemainingTiles);
		stats.deadEndMoveP50 = percentile(stats.deadEndMoveCounts, 50);
		stats.deadEndMoveP75 = percentile(stats.deadEndMoveCounts, 75);
		stats.deadEndMoveP90 = percentile(stats.deadEndMoveCounts, 90);
		stats.deadEndRemainingP50 = percentile(stats.deadEndRemainingTiles, 50);
		stats.deadEndRemainingP75 = percentile(stats.deadEndRemainingTiles, 75);
		stats.deadEndRemainingP90 = percentile(stats.deadEndRemainingTiles, 90);

		return stats;
	}

	runPlayout(random) {
		var moves = 0;

		while (moves < this.options.maxPlayoutMoves) {
			if (this.engine.tileCount === 0) {
				return {
					moves,
					remainingTiles: 0,
					solved: true,
					deadEnded: false,
					dominantStack: this.getDominantStackProfile(),
				};
			}

			var pairs = this.getPlayablePairs();

			if (pairs.length === 0) {
				return {
					moves,
					remainingTiles: this.engine.tileCount,
					solved: false,
					deadEnded: true,
					dominantStack: this.getDominantStackProfile(),
				};
			}

			var pair = this.pickPlayoutPair(pairs, random);

			this.engine.playTiles(pair.tile1, pair.tile2);
			moves++;
		}

		return {
			moves,
			remainingTiles: this.engine.tileCount,
			solved: this.engine.tileCount === 0,
			deadEnded: false,
			dominantStack: this.getDominantStackProfile(),
		};
	}

	runReversiblePlayout(random) {
		var playout = this.runPlayout(random);

		for (let idx = 0; idx < playout.moves; idx++) {
			this.engine.undo();
		}

		return playout;
	}

	pickPlayoutPair(pairs, random) {
		var sortedPairs = this.sortPairsForSearch(pairs);

		return sortedPairs[random.next(sortedPairs.length)];
	}

	exploreSearchNode(depth, stats, seen) {
		if (stats.statesExplored >= this.options.maxStates) {
			stats.prunedByStateLimit++;
			return;
		}

		if (stats.solvedBranches >= this.options.maxSolutions) {
			stats.prunedBySolutionLimit++;
			return;
		}

		var signature = this.getStateSignature();

		if (seen.has(signature)) {
			stats.transpositionHits++;
			return;
		}

		seen.add(signature);
		stats.statesExplored++;
		stats.uniqueStates = seen.size;
		stats.maxDepthReached = Math.max(stats.maxDepthReached, depth);
		var dominantStack = this.getDominantStackProfile();

		if (dominantStack.atRisk) {
			stats.dominantStackRiskStateCount++;
		}
		if (dominantStack.dominant) {
			stats.dominantStackStateCount++;
		}
		stats.maxDominantStackHeight = Math.max(
			stats.maxDominantStackHeight,
			dominantStack.maxStackHeight
		);
		stats.minDominantStackBalanceMargin = stats.minDominantStackBalanceMargin === null
			? dominantStack.balanceMargin
			: Math.min(stats.minDominantStackBalanceMargin, dominantStack.balanceMargin);

		if (this.engine.tileCount === 0) {
			stats.solvedBranches++;
			return;
		}

		var pairs = this.getPlayablePairs();
		stats.branchStateCount++;
		stats.branchCountTotal += pairs.length;
		stats.minBranching = stats.minBranching === null
			? pairs.length
			: Math.min(stats.minBranching, pairs.length);
		stats.maxBranching = Math.max(stats.maxBranching, pairs.length);
		if (pairs.length <= 2) {
			stats.lowBranchStateCount++;
		}

		if (pairs.length === 0) {
			stats.deadEnds++;
			return;
		}

		var pairChoice = this.measurePairChoiceSensitivity(pairs);
		stats.pairChoiceSensitivitySampleCount++;
		stats.pairChoiceSpreadTotal += pairChoice.maxSpread;
		if (pairChoice.consequentialGroupCount > 0) {
			stats.consequentialPairChoiceStateCount++;
		}

		if (depth >= this.options.maxDepth) {
			stats.prunedByDepth++;
			return;
		}

		this.sortPairsForSearch(pairs).forEach(function(pair) {
			if (
				stats.statesExplored >= this.options.maxStates ||
				stats.solvedBranches >= this.options.maxSolutions
			) {
				return;
			}

			this.engine.playTiles(pair.tile1, pair.tile2);
			this.exploreSearchNode(depth + 1, stats, seen);
			this.engine.undo();
		}, this);
	}

	sortPairsForSearch(pairs) {
		return pairs.slice().sort(function(left, right) {
			if (left.faceSet !== right.faceSet) {
				return left.faceSet - right.faceSet;
			}

			if (left.tile1 !== right.tile1) {
				return left.tile1 - right.tile1;
			}

			return left.tile2 - right.tile2;
		});
	}

	getStateSignature() {
		return this.engine.placedTiles.chunks.join(',');
	}

	getBoardFaceSignature() {
		return this.engine.board.pieces.map(function(piece) {
			return piece.face;
		}).join(',');
	}

	getPlacedTileIndexes() {
		var tiles = [];

		for (let tile = 0; tile < this.engine.board.count; tile++) {
			if (this.engine.placedTileSet && this.engine.placedTileSet.has(tile)) {
				tiles.push(tile);
			} else if (
				this.engine.placedTiles &&
				typeof this.engine.placedTiles.has === 'function' &&
				this.engine.placedTiles.has(tile)
			) {
				tiles.push(tile);
			}
		}

		return tiles;
	}

	getDominantStackProfile() {
		var stacks = {};

		this.getPlacedTileIndexes().forEach(function(tile) {
			var {x, y} = this.engine.board.pieces[tile].pos;

			if (x === -1) {
				return;
			}

			var key = `${x}:${y}`;

			stacks[key] = stacks[key] || 0;
			stacks[key]++;
		}, this);

		var stackHeights = Object.values(stacks);
		var stackGroupCount = stackHeights.length;
		var maxStackHeight = stackHeights.length ? Math.max(...stackHeights) : 0;
		var otherStackGroupCount = Math.max(0, stackGroupCount - 1);
		var balanceMargin = otherStackGroupCount - maxStackHeight;

		return {
			stackGroupCount,
			maxStackHeight,
			otherStackGroupCount,
			balanceMargin,
			dominant: maxStackHeight > otherStackGroupCount,
			atRisk: maxStackHeight >= Math.max(0, otherStackGroupCount - 1),
		};
	}

	summarizeBranchTimeline(branchCounts) {
		var third = Math.ceil(branchCounts.length / 3) || 1;
		var early = branchCounts.slice(0, third);
		var middle = branchCounts.slice(third, third * 2);
		var late = branchCounts.slice(third * 2);

		return {
			earlyAverage: average(early),
			middleAverage: average(middle),
			lateAverage: average(late),
			earlyLowBranchMoveCount: early.filter(function(count) {
				return count <= 2;
			}).length,
			middleLowBranchMoveCount: middle.filter(function(count) {
				return count <= 2;
			}).length,
			lateLowBranchMoveCount: late.filter(function(count) {
				return count <= 2;
			}).length,
			longestLowBranchRun: longestRun(branchCounts, function(count) {
				return count <= 2;
			}),
		};
	}

	summarizeDominantStackTimeline(profiles) {
		return {
			riskMoveCount: profiles.filter(function(profile) {
				return profile.atRisk;
			}).length,
			dominantMoveCount: profiles.filter(function(profile) {
				return profile.dominant;
			}).length,
			averageMaxStackHeight: average(profiles.map(function(profile) {
				return profile.maxStackHeight;
			})),
			minBalanceMargin: profiles.length
				? Math.min(...profiles.map(function(profile) {
					return profile.balanceMargin;
				}))
				: 0,
			longestRiskRun: longestRun(profiles, function(profile) {
				return profile.atRisk;
			}),
		};
	}

	scoreDifficulty({initialPairChoice, search, knownSolutionPath, playouts}) {
		var averageBranching = search.averageBranching || knownSolutionPath.averageBranching || 0;
		var lowBranchRatio = search.branchStateCount
			? search.lowBranchStateCount / search.branchStateCount
			: 0;
		var tilePickerStats = typeof this.engine.getTilePickerStats === 'function'
			? this.engine.getTilePickerStats()
			: null;
		var consequentialSearchRatio = search.statesExplored
			? search.consequentialPairChoiceStateCount / search.statesExplored
			: 0;
		var downstream = initialPairChoice.downstream || {};
		var deadEndScore = clamp(search.deadEndRate * 20, 0, 20);
		var lowBranchScore = clamp(lowBranchRatio * 25, 0, 25);
		var branchingScore = clamp((10 - averageBranching) * 3, 0, 25);
		var playoutDeadEndScore = clamp(playouts.deadEndRate * 20, 0, 20);
		var playoutRemainingScore = clamp(
			(playouts.averageRemainingTiles / this.engine.board.count) * 20,
			0,
			20
		);
		var pickerFreedTileScore = tilePickerStats
			? clamp((5 - tilePickerStats.averageFreedCount) * 5, 0, 10)
			: 0;
		var pickerIntersectionScore = tilePickerStats
			? clamp(
				(
					tilePickerStats.averageHorizontalIntersections +
					tilePickerStats.averageVerticalIntersections * 2
				) * 20,
				0,
				10
			)
			: 0;
		var immediatePairChoiceScore = clamp(
			(initialPairChoice.maxSpread + search.averagePairChoiceSpread) * 4,
			0,
			25
		);
		var downstreamGroupScore = clamp(
			(downstream.consequentialGroupCount || 0) * 5,
			0,
			25
		);
		var downstreamDeadEndScore = clamp(
			(downstream.averageDeadEndRateSpread || 0) * 20,
			0,
			20
		);
		var downstreamRemainingScore = clamp(
			((downstream.averageRemainingTilesSpread || 0) / this.engine.board.count) * 20,
			0,
			20
		);
		var searchPairChoiceScore = clamp(consequentialSearchRatio * 10, 0, 10);
		var brutalityDeadEndScore = clamp(playouts.deadEndRate * 35, 0, 35);
		var brutalityRemainingScore = clamp(
			(playouts.deadEndRemainingP75 / this.engine.board.count) * 35,
			0,
			35
		);
		var brutalityShallowScore = clamp(
			((knownSolutionPath.moveCount - playouts.averageDeadEndMoves) /
				Math.max(1, knownSolutionPath.moveCount)) * 20,
			0,
			20
		);
		var brutalityStackRiskScore = clamp(
			(playouts.deadEnded
				? playouts.deadEndDominantStackRiskCount / playouts.deadEnded
				: 0) * 10,
			0,
			10
		);
		var unknownSolutionScore = knownSolutionPath.available === false ? 10 : 0;
		var invalidSolutionScore = knownSolutionPath.valid === false ? 25 : 0;
		var tightnessScore = clamp(
			deadEndScore +
				lowBranchScore +
				branchingScore +
				playoutDeadEndScore +
				playoutRemainingScore +
				pickerFreedTileScore +
				pickerIntersectionScore,
			0,
			100
		);
		var choicePressureScore = clamp(
			immediatePairChoiceScore +
				downstreamGroupScore +
				downstreamDeadEndScore +
				downstreamRemainingScore +
				searchPairChoiceScore,
			0,
			100
		);
		var brutalityScore = clamp(
			brutalityDeadEndScore +
				brutalityRemainingScore +
				brutalityShallowScore +
				brutalityStackRiskScore,
			0,
			100
		);
		var score = clamp(
			tightnessScore * 0.55 +
				choicePressureScore * 0.45 +
				unknownSolutionScore +
				invalidSolutionScore,
			0,
			100
		);

		return {
			score: Math.round(score),
			label: this.getDifficultyLabel(score),
			components: {
				tightnessScore,
				choicePressureScore,
				brutalityScore,
				deadEndScore,
				lowBranchScore,
				branchingScore,
				playoutDeadEndScore,
				playoutRemainingScore,
				pickerFreedTileScore,
				pickerIntersectionScore,
				immediatePairChoiceScore,
				downstreamGroupScore,
				downstreamDeadEndScore,
				downstreamRemainingScore,
				searchPairChoiceScore,
				brutalityDeadEndScore,
				brutalityRemainingScore,
				brutalityShallowScore,
				brutalityStackRiskScore,
				unknownSolutionScore,
				invalidSolutionScore,
			},
		};
	}

	getDifficultyLabel(score) {
		if (score >= 75) {
			return 'hard';
		}

		if (score >= 45) {
			return 'medium';
		}

		return 'easy';
	}
}

export function analyzeGeneratedBoard(options = {}) {
	var generated = createGeneratedBoard(options);
	var analyzer = new MahjonggDifficultyAnalyzer(generated.engine, options.analysis);
	var analysis = analyzer.analyze();

	return {
		layout: generated.layout.id,
		layoutTitle: generated.layout.title,
		boardNumber: generated.boardNumber,
		generator: generated.generator,
		generationDifficulty: generated.generationDifficulty,
		generationAttempt: generated.generationAttempt,
		suspension: generated.suspension,
		faceAvoidanceRules: generated.faceAvoidanceRules,
		faceAssignmentRules: generated.faceAssignmentRules,
		suspensionStats: typeof generated.engine.getSuspensionStats === 'function'
			? generated.engine.getSuspensionStats()
			: null,
		tilePickerStats: typeof generated.engine.getTilePickerStats === 'function'
			? generated.engine.getTilePickerStats()
			: null,
		faceAvoidanceStats: typeof generated.engine.getFaceAvoidanceStats === 'function'
			? generated.engine.getFaceAvoidanceStats()
			: null,
		tileCount: generated.engine.board.count,
		...analysis,
	};
}

export function summarizeGeneratedBoard(options = {}) {
	var generated = createGeneratedBoard(options);
	var engine = generated.engine;
	var playablePairs = engine.getHints(-1);
	var solution = engine.getSolution();

	return {
		layout: generated.layout.id,
		layoutTitle: generated.layout.title,
		boardNumber: generated.boardNumber,
		suspension: generated.suspension,
		tileCount: engine.board.count,
		remainingTiles: engine.tileCount,
		initialPlayablePairCount: playablePairs.length,
		initialPlayablePairs: playablePairs,
		solutionTileCount: solution.length,
		solutionPairCount: Math.floor(solution.length / 2),
	};
}
