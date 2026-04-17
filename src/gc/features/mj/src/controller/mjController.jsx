import {Service} from '@polylith/core';
import React from 'react';
import Board from "../components/Board.jsx";
import { ServiceDelegator } from 'common/delegators.js';
import Random from 'utils/random.js'
import layouts from '../data/layouts.js';
import {TILE_SETS, TILE_SIZES} from '../data/tilesets.js';
import Engine from '../engine/Engine.js';
import {
	DIFFICULTY_LEVELS,
	applyDifficultyPreset,
} from '../engine/difficultyPresets.js';

const TILE_SIZE_ORDER = ['tiny', 'small', 'medium', 'normal'];
const TILE_SIZE_MIN_VIEWPORTS = {
	tiny: { width: 730, height: 410 },
	small: { width: 870, height: 540 },
	medium: { width: 950, height: 590 },
	normal: { width: 1080, height: 690 },
};
const TILE_SIZE_HYSTERESIS_PX = 2;
const DEFAULT_TIMINGS = {
	fireworksDelay: 420,
	failureAnimation: 90,
	toastLong: 5000,
	tile: {
		played: 180,
		unselected: 120,
		blocked: 180,
		undo: 240,
		redo: 240,
		restart: 220,
		peek: 220,
		finalPlayed: 900,
	},
};
const TIMING_VAR_NAMES = [
	"--mj-motion-fireworks-delay",
	"--mj-motion-failure",
	"--mj-motion-toast-long",
	"--mj-motion-tile-played",
	"--mj-motion-tile-unselected",
	"--mj-motion-tile-blocked",
	"--mj-motion-tile-undo",
	"--mj-motion-tile-redo",
	"--mj-motion-tile-restart",
	"--mj-motion-tile-peek",
	"--mj-motion-tile-final-played",
];

/**
 * Use this class as the controller for a game of Mahjongg solitaire. This code
 * is separate from the view so that view can concentrate on rendering and user
 * interaction. Although it does assume the view is React, it does so in a very
 * limited way, doing most of the communication through event handling. It is
 * using this method because there is no direct way to communicate with a React
 * component except by rerendering it with new properties. And rerendering a
 * component can result in far too much running JavaScript and affect
 * performance, even if React only rerenders changed dom elements.
 */
export default class MJController extends Service {
	constructor() {
		super('mj:controller');
		this.implement(['start', 'ready', 'render', 'restart', 'hint', 'undo', 'redo',
			'solve', 'playHalfSolution', 'play', 'select', 'deselect', 'pause', 'peek', 'selectLayout',
			'selectTileset','selectTilesize', 'selectDifficulty', 'initialized']);

		// these methods will just fire their arguments to who ever is
		// listening. This will be the board view component or individuals tiles
		this.makeFireMethods(['setTime','setWon', 'setLost', 'setGameState',
			'setTileset', 'setTilesize', 'setMessage', 'setShortMessage',
			'showTile', 'hintTile', 'highlightTile', 'setTiles','clearBoard',]);

		this.engine = new Engine();
		this.layoutName = 'turtle';
		this.difficulty = 'standard';
		this.difficulties = DIFFICULTY_LEVELS;
		this.tileSet = 'ivory';
		this.tileSize = null;
		this.allowedTileSizes = TILE_SIZE_ORDER.slice();
		this.maxTileSize = 'normal';
		this.isBelowMinimum = false;
		this.timerHandle = setInterval(this.onTimerTick.bind(this), 250);

		this.engine.listen('updateState', this.updateState.bind(this));
		this.engine.listen('addTile', this.addTile.bind(this));
		this.engine.listen('removeTile', this.removeTile.bind(this));
		this.engine.listen('newBoard', this.newBoard.bind(this))
		this.boardNbr = Random.random(0xFFFFF)
		this.onSizeChanged = this.onSizeChanged.bind(this);
		this.lastTrackedElapsedSecond = -1;
		this.finalPlayTiles = null;
	}

	start() {
		this.actionCollector = null;
		this.cssVars = null;
		this.sizeWatcher = null;
		this.timings = DEFAULT_TIMINGS;
	}

	recordAction(action) {
		if (!this.actionCollector || !this.actionCollector.recordAction) {
			return;
		}

		this.actionCollector.recordAction(action);
	}

	/**
	 * Called by makeFireMethods and the handler for an installed fire method.
	 *
	 * @param {String} name name of the event that will be fired
	 * @param  {...any} args the remaining parameters that will be passed in
	 * 		the event.
	 *
	 * @returns the result from the fired event.
	 */
	fireMethod(name, ...args) {
		return this.fire(name, ...args);
	}

	/**
	 * Call this function to create new methods directly on this object that
	 * will fire an event with the passed parameters. This is a utility to make
	 * firing events more like method calls.
	 *
	 * @param {Array.<String>} methods an array of events, these event names
	 * 		will be converted to method names, so be sure they ae properly
	 * 		named.
	 */
	makeFireMethods(methods) {
		methods.forEach(function (methodName) {
			this[methodName] = this.fireMethod.bind(this, methodName)
		}, this);
	}

	ready() {
		this.actionCollector = this.registry.subscribe("mj:action-collector");
		this.cssVars = this.registry.subscribe("mj:css-vars");
		this.engine.setActionCollector(this.actionCollector);

		if (this.cssVars && this.cssVars.precache) {
			this.cssVars.precache(TIMING_VAR_NAMES);
			this.timings = this.buildTimingsFromCssVars();
		}

		this.sizeWatcher = this.registry.subscribe('size-watcher');

		if (this.sizeWatcher) {
			this.sizeWatcher.listen('changed', this.onSizeChanged);
			this.sizeWatcher.check();
		}
	}

	buildTimingsFromCssVars() {
		if (!this.cssVars || !this.cssVars.get) {
			return DEFAULT_TIMINGS;
		}

		return {
			fireworksDelay: this.getCssDurationMs("--mj-motion-fireworks-delay", DEFAULT_TIMINGS.fireworksDelay),
			failureAnimation: this.getCssDurationMs("--mj-motion-failure", DEFAULT_TIMINGS.failureAnimation),
			toastLong: this.getCssDurationMs("--mj-motion-toast-long", DEFAULT_TIMINGS.toastLong),
			tile: {
				played: this.getCssDurationMs("--mj-motion-tile-played", DEFAULT_TIMINGS.tile.played),
				unselected: this.getCssDurationMs("--mj-motion-tile-unselected", DEFAULT_TIMINGS.tile.unselected),
				blocked: this.getCssDurationMs("--mj-motion-tile-blocked", DEFAULT_TIMINGS.tile.blocked),
				undo: this.getCssDurationMs("--mj-motion-tile-undo", DEFAULT_TIMINGS.tile.undo),
				redo: this.getCssDurationMs("--mj-motion-tile-redo", DEFAULT_TIMINGS.tile.redo),
				restart: this.getCssDurationMs("--mj-motion-tile-restart", DEFAULT_TIMINGS.tile.restart),
				peek: this.getCssDurationMs("--mj-motion-tile-peek", DEFAULT_TIMINGS.tile.peek),
				finalPlayed: this.getCssDurationMs("--mj-motion-tile-final-played", DEFAULT_TIMINGS.tile.finalPlayed),
			},
		};
	}

	getCssDurationMs(name, fallbackMs) {
		let rawValue = this.cssVars && this.cssVars.get
			? this.cssVars.get(name)
			: "";

		if (!rawValue) {
			return fallbackMs;
		}

		if (rawValue.endsWith("ms")) {
			let valueMs = Number.parseFloat(rawValue);
			return Number.isFinite(valueMs) ? valueMs : fallbackMs;
		}

		if (rawValue.endsWith("s")) {
			let valueSeconds = Number.parseFloat(rawValue);
			return Number.isFinite(valueSeconds) ? valueSeconds * 1000 : fallbackMs;
		}

		let numericValue = Number.parseFloat(rawValue);
		return Number.isFinite(numericValue) ? numericValue : fallbackMs;
	}

	onSizeChanged(size) {
		var allowedTileSizes = this.getAllowedTileSizesForViewport(size, this.maxTileSize);
		var maxTileSize = allowedTileSizes.length
			? allowedTileSizes[allowedTileSizes.length - 1]
			: null;
		var isBelowMinimum = allowedTileSizes.length === 0;

		this.allowedTileSizes = allowedTileSizes;
		this.maxTileSize = maxTileSize;
		this.isBelowMinimum = isBelowMinimum;

		if (allowedTileSizes.length > 0 && (!this.tileSize || !allowedTileSizes.includes(this.tileSize))) {
			this.tileSize = maxTileSize;
			this.setTilesize(this.tileSize);
		}

		this.setGameState({
			allowedTilesizes: allowedTileSizes,
			maxTileSize: maxTileSize,
			isBelowMinimum: isBelowMinimum,
		});
	}

	getAllowedTileSizesForViewport(size, currentMaxTileSize = null) {
		var width = size?.width || 0;
		var height = size?.height || 0;
		var rawMaxIndex = this.getMaxTileSizeIndex(width, height);
		var stableMaxIndex = rawMaxIndex;
		var currentIndex = TILE_SIZE_ORDER.indexOf(currentMaxTileSize);

		if (currentIndex >= 0) {
			if (rawMaxIndex < currentIndex) {
				stableMaxIndex = this.shouldRetainCurrentTileSize(width, height, currentIndex)
					? currentIndex
					: rawMaxIndex;
			} else if (rawMaxIndex > currentIndex) {
				stableMaxIndex = this.getUpgradeTileSizeIndex(width, height, currentIndex, rawMaxIndex);
			}
		}

		if (stableMaxIndex < 0) {
			return [];
		}

		return TILE_SIZE_ORDER.slice(0, stableMaxIndex + 1);
	}

	getMaxTileSizeIndex(width, height) {
		var maxIndex = -1;

		TILE_SIZE_ORDER.forEach(function(tileSize, index) {
			var min = TILE_SIZE_MIN_VIEWPORTS[tileSize];

			if (width >= min.width && height >= min.height) {
				maxIndex = index;
			}
		});

		return maxIndex;
	}

	shouldRetainCurrentTileSize(width, height, currentIndex) {
		var currentTileSize = TILE_SIZE_ORDER[currentIndex];
		var min = TILE_SIZE_MIN_VIEWPORTS[currentTileSize];

		return (
			width >= min.width - TILE_SIZE_HYSTERESIS_PX &&
			height >= min.height - TILE_SIZE_HYSTERESIS_PX
		);
	}

	getUpgradeTileSizeIndex(width, height, currentIndex, rawMaxIndex) {
		var nextIndex = currentIndex;

		while (nextIndex + 1 <= rawMaxIndex) {
			var candidateIndex = nextIndex + 1;
			var candidateTileSize = TILE_SIZE_ORDER[candidateIndex];
			var min = TILE_SIZE_MIN_VIEWPORTS[candidateTileSize];

			if (
				width >= min.width + TILE_SIZE_HYSTERESIS_PX &&
				height >= min.height + TILE_SIZE_HYSTERESIS_PX
			) {
				nextIndex = candidateIndex;
				continue;
			}

			break;
		}

		return nextIndex;
	}

	/**
	 * This method is an event handler that will be called by the view to let
	 * us know the view has been rendered and can now be used.
	 */
	initialized() {
		this.newGame(this.boardNbr);
	}

	/**
	 * call this method to restart the timer from being paused
	 */
	restartTimer() {
		this.startTimer(true);
		this.toggleTimer(true);
		this.updateTimerState();
	}


	miniTimeStr(timer = 0) {
		var seconds = Math.floor(timer / 1000);
		var minutes = Math.floor(seconds / 60)
		var displayMinutes = Math.floor(minutes % 60)
		var displaySeconds = Math.floor(seconds % 60);

		return `${displayMinutes}:${String(displaySeconds).padStart(2, '0')}`;
	}

	/**
	 * Call this method to start the time from 0, unless it is paused, in which
	 * case it will continue from the last value.
	 */
	startTimer(resume) {
		var now = Date.now();
		var newStartTime = resume ? this.startTime + (now - this.stopTime) : this.startTime;
		var delta = newStartTime - this.startTime
		// we only recalculate the start time when first switching paused state
		if (resume)
			this.startTime += now - this.stopTime;
		else
			this.startTime = Date.now();

		this.timerRunning = true;
	}

	/**
	 * Call this method to permanently stop the timer. It cannot be resumed.
	 */
	stopTimer() {
		this.resetTimer(false);
		if (!this.timerRunning) return;
		var time = Date.now() - this.startTime;
		this.time = time;
		this.setTime(time);
		this.trackElapsedTime(time);
		this.timerRunning = false;
	}

	/**
	 * Call this method to pause the timer. It can be resumed by calling
	 * restartTimer
	 */
	pauseTimer() {
		var now = Date.now()
		this.stopTime = now;
		if (this.startTime) {
			this.trackElapsedTime(now - this.startTime);
		}
		this.timerRunning = false;
	}

	/**
	 *  Called on an interval. It will update the displayed timer
	 */
	onTimerTick() {
		if (!this.timerRunning) return;
		var time = Date.now() - this.startTime;
		this.setTime(time);
		this.trackElapsedTime(time);
	}

	trackElapsedTime(time) {
		var elapsedSeconds = Math.floor(Math.max(0, time) / 1000);

		if (elapsedSeconds === this.lastTrackedElapsedSecond) {
			return;
		}

		this.lastTrackedElapsedSecond = elapsedSeconds;
		this.recordAction({
			type: "session-elapsed",
			elapsedTimeMs: Math.max(0, Math.floor(time)),
		});
	}

	timerPenalty(time) {
		this.startTime -= time;
	}

	/**
	 * Call this method to log a game event
	 * @param {String} event the name of the event to log
	 * @param  {...any} args parameters to also be logged
	 */
	logEvent(event, ...args){
	}

	/**
	 * Called in response to the updateState event.
	 *
	 * @param {GameState} state the current state of the game
	 */
	updateState(state) {
		if (state.remaining === 0) {
			this.stopTimer();
			this.setWon(true);
			this.setLost(false);
			if (!this.gameWon) {
				this.recordAction({type: "session-ended", result: "won"});
			}
			this.logEvent('win');
			this.message('YOU WIN!!!');
			this.gameWon = true;
		} else if (state.lost) {
			this.setWon(false);
			this.setLost(true);
			if (!this.gameLost) {
				this.recordAction({type: "dead-end"});
			}
			this.logEvent("lose");
			this.gameLost = true;
			this.message('NO MORE MOVES. THIS BOARD HAS FAILED. USE UNDO OR MOVE HISTORY TO CONTINUE.');

		} else {
			this.message('');
			this.setWon(false);
			this.setLost(false);
			this.gameWon = false;
			this.gameLost =false;
		}

		this.openTiles = state.open;
		this.placedTiles = state.placed;
		this.setGameState({
			remaining: state.remaining,
			canUndo: state.canUndo,
			canRedo: state.canRedo,
			multiUndoHistory: state.multiUndoHistory,
			isPeeking: this.peeking,
			isPaused: Boolean(this.paused > 0),
			boardNbr: this.boardNbr,
			difficulty: this.difficulty,
			allowedTilesizes: this.allowedTileSizes,
			maxTileSize: this.maxTileSize,
		});

		this.shortMessage('');
	}

	hideBoard(on) {
		if (on) {
			for (let idx = 0; idx < this.board.count; idx++) {
				this.showTile(idx, false)
			}
		} else {
			for (let idx = 0; idx < this.board.count; idx++) {
				if (this.placedTiles.has(idx)) {
					this.showTile(idx, true)
				}
			}
		}
	}

	/**
	 * Call in response to the newBoard event.
	 *
	 * @param {Board} board
	 */
	newBoard(board) {
		/** @type  {Array.<Piece>} */
		var tiles = [];

		for (let idx = 0; idx < board.count; idx++) {
			let {x, y, z} = board.pieces[idx].pos;
			let face = board.pieces[idx].face;

			tiles.push({
				id: idx, x, y, z, face
			});
		}

		this.board = board;

		this.setTiles(Random.random(), tiles);
		this.showTile('all', true);
		this.highlightTile('all', false);
	}

	addTile(tile) {
		this.showTile(tile, true);
	}

	removeTile(tile) {
		if (this.finalPlayTiles && this.finalPlayTiles.has(tile)) {
			this.showTile(tile, this.finalPlayTiles.get(tile));
			this.finalPlayTiles.delete(tile);
			if (this.finalPlayTiles.size === 0) {
				this.finalPlayTiles = null;
			}
			return;
		}

		this.showTile(tile, 'played');
	}

	/**
	 * call this method to hide the currently hinted tiles
	 */
	hideHints() {
		if (!this.currentHint) return;

		this.hintTile(this.currentHint.tile1, false);
		this.hintTile(this.currentHint.tile2, false);
		this.setGameState({isHinting: false});
	}

	preserveSelectionForHints() {
		if (this.selectedTile === -1 || this.hintSelectedTile !== -1) return;

		this.hintSelectedTile = this.selectedTile;
		this.highlightTile(this.selectedTile, false);
		this.selectedTile = -1;
	}

	restoreSelectionFromHints() {
		if (this.hintSelectedTile === -1 || this.selectedTile !== -1) return;

		this.selectedTile = this.hintSelectedTile;
		this.hintSelectedTile = -1;
		this.highlightTile(this.selectedTile, 'selected');
	}

	clearHintSelectionAnchor() {
		this.hintSelectedTile = -1;
	}

	/**
	 * call this method to highlight the current hint
	 */
	showHints() {
		if (!this.currentHint) return;

		this.hintTile(this.currentHint.tile1, true);
		this.hintTile(this.currentHint.tile2, true);
		this.setGameState({isHinting: true});
	}

	/**
	 * Call this method to undo the latest move
	 */
	undo() {
		var tiles = this.engine.undo();
		if (tiles === undefined) return;

		this.showTile(tiles.tile1, true);
		this.highlightTile(tiles.tile1, 'undo');
		this.showTile(tiles.tile2, true);
		this.highlightTile(tiles.tile2, 'undo');
	}

	/**
	 * Call this method to redo the most recent move
	 */
	redo() {
		var tiles = this.engine.redo();

		if (tiles === undefined) return;

		this.showTile(tiles.tile1, 'redo');
		this.showTile(tiles.tile2, 'redo');
	}

	restart() {
		var history = this.engine.getUndoHistory();
		var restoredTiles = history.flatMap(function(move) {
			return [move.tile1, move.tile2];
		});

		this.hideHints();
		this.currentHint = false;
		this.currentHints = [];
		this.clearHintSelectionAnchor();

		if (this.selectedTile !== -1) {
			this.highlightTile(this.selectedTile, false);
			this.selectedTile = -1;
		}

		if (this.peeking) {
			this.peek();
		}

		this.engine.startOver();

		restoredTiles.forEach(function(tile) {
			this.showTile(tile, true);
			this.highlightTile(tile, 'restart');
		}, this);

		this.gameLost = false;
		this.gameWon = false;
		this.setWon(false);
		this.setLost(false);
		this.setGameState({isHinting: false});
		this.message('');
		this.shortMessage('');

		this.resetTimer(false);
		this.startTimer(false);
		this.updateTimerState();
		this.lastTrackedElapsedSecond = -1;
		this.trackElapsedTime(0);
	}

	/**
	 * Call this method to render a message in the game view
	 * @param {String} message
	 */
	message(message) {
		this.setMessage(message);
	}

	/**
	 * Call this method to render a small message in the view
	 * @param {String} message
	 */
	shortMessage(message) {
		this.setShortMessage(message);
	}

	/**
	 * Call this number to generate a new starting board
	 *
	 * @param {Number} boardNbr
	 */
	generateGame(boardNbr) {
		this.logEvent('generateGame');

		// remove the old board and recreate it
		try {
			this.clearBoard();
			this.engine.generateGame(boardNbr);

		} catch (err) {
			console.log(err);
		}
	}

	/**
	 * Call this method to start playing a new game
	 *
	 * @param {Number} boardNbr the number of the board to play. Passing the same
	 * 		number will always generate the same board.
	 */
	newGame(boardNbr) {
		this.layout = this.layoutName;
		this.engine.setLayout(layouts[this.layout]);
		applyDifficultyPreset(this.engine, this.difficulty);
		if (boardNbr === undefined || boardNbr === -1) boardNbr = Random.random(0xFFFFF);
		this.boardNbr = boardNbr;

		this.selectedTile = -1;
		this.hintSelectedTile = -1;

		this.hintIdx = -1;
		this.hint1 = -1;
		this.hint2 = -1;
		this.currentHint = false;
		this.currentHints = [];
		this.clearHintSelectionAnchor();
		this.peeking = false;
		this.paused = 0;

		Random.randomize(boardNbr);

		this.message("Loading new game ...");

		this.generateGame(boardNbr);

		this.gameLost = false;
		this.gameWon = false;
		this.selectedTile = -1;
		this.message('');

		this.resetTimer(false);
		this.startTimer(false);
		this.updateTimerState();
		this.setGameState({isHinting: false});
		this.lastTrackedElapsedSecond = -1;
		this.recordAction({
			type: "session-started",
			boardNbr: Number.isFinite(Number(this.boardNbr)) ? Number(this.boardNbr) : null,
			difficulty: this.difficulty,
			layout: this.layout,
		});
		this.trackElapsedTime(0);
	}

	/**
	 * Call this method to check if a specific tile is open for play
	 * @param {TileKey} tile
	 *
	 * @returns {Boolean} true if open, false if not
	 */
	isOpen(tile) {
		return this.openTiles.has(tile)
	}

	/**
	 * This method is called in response to the hint button being pressed. If
	 * the user is not currently showing hints, then it will start a new round
	 * of hints. If there is a selected tile then it will find tiles that match
	 * it. If not it will find all playable pairs. Otherwise it shows the next
	 * hint, if there are any left.
	 */
	hint() {

		if (!this.currentHint && false) {
			this.resetTimer(false);
			this.restartTimer();
		}

		this.hideHints();

		if (this.currentHint && this.currentHints.length === 0) {
			this.shortMessage('NO MORE HINTS');
			this.currentHint= false;
			this.setGameState({isHinting: false});
			this.restoreSelectionFromHints();
			return;
		}

		if (!this.currentHint) {
			this.preserveSelectionForHints();
			this.currentHints = this.engine.getHints(this.hintSelectedTile !== -1 ? this.hintSelectedTile : this.selectedTile);
		}

		if (this.currentHints.length === 0) {
			this.shortMessage('NO AVAILABLE HINTS');
			this.setGameState({isHinting: false});
			this.restoreSelectionFromHints();
			return;
		}

		this.timerPenalty(1000);
		this.shortMessage('');
		this.currentHint = this.currentHints.shift();
		this.showHints();
	}

	/**
	 * This method is called in response to the user selecting a tile.
	 *
	 * @param {TileKey} tile the tile the use selected.
	 */
	select(tile) {
		this.hideHints();
		this.currentHint = false;
		this.currentHints = [];
		this.clearHintSelectionAnchor();

		if (this.peeking) {
			this.showTile(tile, 'peek');
			this.peeked.push(tile);
			this.timerPenalty(5000);
			return;
		}

		if (!this.isOpen(tile)) {
			this.highlightTile(tile, 'blocked');
			return;
		}

		if (this.selectedTile === -1) {
			this.highlightTile(tile, 'selected');
			this.selectedTile = tile;
		} else if (this.selectedTile === tile) {
			this.highlightTile(this.selectedTile, false);
			this.selectedTile = -1;
		} else {
			if (this.engine.canPlay(tile, this.selectedTile)) {
				if (this.engine.tileCount === 2) {
					this.finalPlayTiles = new Map([
						[tile, 'final-played-left'],
						[this.selectedTile, 'final-played-right'],
					]);
				}
				this.engine.playTiles(tile, this.selectedTile)
				this.selectedTile = -1;
			} else {
				this.highlightTile(tile, 'selected');
				this.highlightTile(this.selectedTile, false);
				this.selectedTile = tile;
			}
		}
	}

	deselect() {
		this.hideHints();
		this.currentHint = false;
		this.currentHints = [];
		this.clearHintSelectionAnchor();

		if (this.selectedTile === -1) {
			return;
		}

		this.highlightTile(this.selectedTile, false);
		this.selectedTile = -1;
	}


	updatePause(on) {
		// we have a multi-level pause flag
		// if on does not have a value, it be will considered a toggle
		var delta =
			on === true ? 1 :
			on === false ? -1 :
			this.paused > 0 ? -1 :
			1;

		if (this.paused === 1 && delta === -1) {
			this.startTimer(true);
		} if (this.paused === 0 && delta === 1) {
			this.pauseTimer(true);
		}
		this.paused += delta;
	}

	resetTimer(on) {
		this.paused = on ? 1 : 0;
	}

	updateTimerState() {
		this.setGameState({isPaused: this.paused});
	}

	toggleTimer(on) {
		this.updatePause(on)
		this.updateTimerState();
	}

	pause(on) {
		this.toggleTimer(on);
	}

	peek() {
		this.peeking = !this.peeking;

		if (this.peeking) {
			this.peeked = [];
		} else {
			this.peeked.forEach(function(tile) {
				this.showTile(tile, true);
				this.highlightTile(tile, 'restart');
			}, this)
		}

		this.setGameState({isPeeking: this.peeking});
	}

	/**
	 * This method is called in response to the player pressing the play button
	 *
	 * @param {Number} boardNbr
	 */
	play(boardNbr) {

		this.boardNbr = boardNbr;
		this.newGame(boardNbr);
	}

	selectLayout(layout) {
		this.layoutName = layout;
	}

	selectTileset(tileSet) {
		this.tileSet = tileSet;
		this.setTileset(tileSet);
	}

	selectTilesize(tileSize) {
		this.tileSize = tileSize;
		this.setTilesize(tileSize);
	}

	selectDifficulty(difficulty) {
		if (!this.difficulties[difficulty]) {
			return;
		}

		this.difficulty = difficulty;
		this.setGameState({
			difficulty: this.difficulty,
		});
	}

	/**
	 * This method is called in response to the user pressing the solve button
	 */
	solve() {
		this.engine.startOver();
		this.drawBoard();
		var solution = JSON.parse(JSON.stringify(this.engine.solution));
		this.startTime = Date.now() - 124000

		var int = setInterval(function() {
			var tile1, tile2;
			if (solution.length <= 2)
			{
				clearInterval(int)
				this.engine.calcValidMoves();
				this.setState();
			} else {
				tile1 = solution.shift();
				tile2 = solution.shift();
				this.engine.playPair(tile1, tile2);
				this.showTile(tile1, false)
				this.showTile(tile2, false)
			}
		}.bind(this), 50)
	}

	playHalfSolution() {
		let solution = Array.isArray(this.engine.solution) ? this.engine.solution.slice() : [];
		let moveCount = Math.floor(solution.length / 2);
		let halfMoveCount = Math.floor(moveCount / 2);

		if (halfMoveCount <= 0) {
			return;
		}

		this.hideHints();
		this.currentHint = false;

		if (this.selectedTile !== -1) {
			this.highlightTile(this.selectedTile, false);
			this.selectedTile = -1;
		}

		for (let idx = 0; idx < halfMoveCount; idx++) {
			let tile1 = solution[idx * 2];
			let tile2 = solution[idx * 2 + 1];

			if (!this.engine.canPlay(tile1, tile2)) {
				break;
			}

			this.engine.playTiles(tile1, tile2);
			this.showTile(tile1, false);
			this.highlightTile(tile1, false);
			this.showTile(tile2, false);
			this.highlightTile(tile2, false);
		}
	}

	async render() {
		return (
			<Board
				delegator={new ServiceDelegator('mj:controller')}
				id='mj-board'
				key='mj-board'
				serviceName="mj:controller"
				layouts={layouts}
				layout={this.layoutName}
				difficulty={this.difficulty}
				difficulties={this.difficulties}
				tileset={this.tileSet}
				tilesets={TILE_SETS}
				tilesize={this.tileSize || this.maxTileSize || 'tiny'}
				tilesizes={TILE_SIZES}
				allowedTilesizes={this.allowedTileSizes}
				maxTileSize={this.maxTileSize}
				isBelowMinimum={this.isBelowMinimum}
				timings={this.timings}
			/>
		)
	}
}

new MJController();
