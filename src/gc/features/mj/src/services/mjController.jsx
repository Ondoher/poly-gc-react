import {Service} from '@polylith/core';
import React from 'react';
import MjEngine from "../engine/mjEngine.js";
import MjBoard from "../components/MjBoard.jsx";
import { ServiceDelegator } from 'common/delegators.js';
import Random from 'utils/random.js'
import layouts from '../data/layouts.js';
import tilesets from '../data/tilesets.js';

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
		this.implement(['start', 'ready', 'render', 'hint', 'undo', 'redo',
			'solve', 'play', 'select', 'pause', 'peek', 'selectLayout',
			'selectTileset','initialized']);

		// these methods will just fire their arguments to who ever is
		// listening. This will be the board view component or individuals tiles
		this.makeFireMethods(['setTime','setWon', 'setLost', 'setGameState', 'setTileset',
			'setMessage', 'setShortMessage', 'showTile', 'hintTile',
			'highlightTile', 'setTiles','clearBoard',]);

		this.engine = new MjEngine();
		this.layoutName = 'turtle';
		this.tileset = 'bone_normal';
		this.timerHandle = setInterval(this.onTimerTick.bind(this), 250);

		this.engine.listen('updateState', this.updateState.bind(this));
		this.engine.listen('addTile', this.addTile.bind(this));
		this.engine.listen('removeTile', this.removeTile.bind(this));
		this.engine.listen('newBoard', this.newBoard.bind(this))
		this.boardNbr = Random.random(0xFFFFF)
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
		if (!this.paused) return;
		this.startTimer();
	}

	/**
	 * Call this method to start the time from 0, unless it is paused, in which
	 * case it will continue from the last value.
	 */
	startTimer() {
		var now = Date.now();
		if (this.paused)
			this.startTime += now - this.stopTime;
		else
			this.startTime = Date.now();

		this.timerRunning = true;
		this.paused = false;
	}

	/**
	 * Call this method to permanently stop the timer. It cannot be resumed.
	 */
	stopTimer() {
		if (!this.timerRunning) return;
		var time = Date.now() - this.startTime;
		this.time = time;
		this.setTime(time);
		this.timerRunning = false;
	}

	/**
	 * Call this method to pause the timer. It can be resumed by calling
	 * restartTimer
	 */
	pauseTimer() {
		this.stopTime = Date.now();
		this.timerRunning = false;
		this.paused = true;
	}

	/**
	 *  Called on an interval. It will update the displayed timer
	 */
	onTimerTick() {
		if (!this.timerRunning) return;
		var time = Date.now() - this.startTime;
		this.setTime(time);
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
	 * Called in respponse to the updateState event.
	 *
	 * @param {GameState} state the current state of the game
	 */
	updateState(state) {
		if (state.remaining === 0) {
			this.stopTimer();
			this.setWon(true);
			this.setLost(false);
			this.logEvent('win');
			this.message('YOU WIN!!!');
			this.gameWon = true;
		} else if (state.lost) {
			this.setWon(false);
			this.setLost(true);
			this.pauseTimer();
			this.logEvent("lose");
			this.gameLost = true;
			this.message('NO MORE MOVES, GAME OVER');

		} else {
			this.message('');
			this.setWon(false);
			this.setLost(false);
			this.gameWon = false;
			this.gameLost =false;
		}

		this.openTiles = state.open;
		this.playedTiles = state.played;
		this.setGameState({
			remaining: state.remaining,
			canUndo: state.canUndo,
			canRedo: state.canRedo,
			isPeeking: this.peeking,
			isPaused: this.paused,
			boardNbr: this.boardNbr,
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
				if (this.playedTiles.has(idx)) {
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
		this.showTile(tile, false);
	}

	/**
	 * call this method to hide the currently hinted tiles
	 */
	hideHints() {
		if (!this.currentHint) return;

		this.hintTile(this.currentHint.tile1, false);
		this.hintTile(this.currentHint.tile2, false);
	}

	/**
	 * call this method to highlight the current hint
	 */
	showHints() {
		if (!this.currentHint) return;

		this.hintTile(this.currentHint.tile1, true);
		this.hintTile(this.currentHint.tile2, true);
	}

	/**
	 * Call this method to undo the latest move
	 */
	undo() {
		var tiles = this.engine.undo();
		if (tiles === undefined) return;

		this.showTile(tiles.tile1, true);
		this.highlightTile(tiles.tile1, false);
		this.showTile(tiles.tile2, true);
		this.highlightTile(tiles.tile2, false);

		if (this.gameLost) {
			this.startTimer = true;
			this.gameLost = false;
		}
	}

	/**
	 * Call this method to redo the most recent move
	 */
	redo() {
		var tiles = this.engine.redo();

		if (tiles === undefined) return;

		this.showTile(tiles.tile1, false);
		this.highlightTile(tiles.tile1, false);
		this.showTile(tiles.tile2, false);
		this.highlightTile(tiles.tile2, false);
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
		if (boardNbr === undefined || boardNbr === -1) boardNbr = Random.random(0xFFFFF);
		this.boardNbr = boardNbr;

		this.selectedTile = -1;

		this.hintIdx = -1;
		this.hint1 = -1;
		this.hint2 = -1;
		this.peeking = false;
		this.paused = false;

		Random.randomize(boardNbr);

		this.message("Loading new game ...");

		this.generateGame(boardNbr);

		this.gameLost = false;
		this.gameWon = false;
		this.selectedTile = -1;
		this.message('');

		this.stopTimer();
		this.startTimer();
	}

	/**
	 * Call this method to check if a specific tile is open for play
	 * @param {Tile} tile
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
		this.restartTimer();
		this.hideHints();

		if (this.currentHint && this.currentHints.length === 0) {
			this.shortMessage('NO MORE HINTS');
			this.currentHint= false;
			return;
		}

		if (!this.currentHint) this.currentHints = this.engine.getHints(this.selectedTile);

		if (this.currentHints.length === 0) {
			this.shortMessage('NO AVAILABLE HINTS');
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
	 * @param {Tile} tile the tile the use selected.
	 */
	select(tile) {
		this.hideHints();
		this.currentHint = false;

		if (this.peeking) {
			this.showTile(tile, false);
			this.peeked.push(tile);
			this.timerPenalty(5000);
			return;
		}

		if (!this.isOpen(tile)) return;

		if (this.selectedTile === -1) {
			this.highlightTile(tile, true);
			this.selectedTile = tile;
		} else if (this.selectedTile === tile) {
			this.highlightTile(this.selectedTile, false);
			this.selectedTile = -1;
		} else {
			if (this.engine.canPlay(tile, this.selectedTile)) {
				this.engine.playTiles(tile, this.selectedTile)
				this.selectedTile = -1;
			} else {
				this.highlightTile(tile, true);
				this.highlightTile(this.selectedTile, false);
				this.selectedTile = tile;
			}
		}
	}

	pause() {
		if (this.paused) {
			this.startTimer();
			this.hideBoard(false);
		} else {
			this.pauseTimer();
			this.hideBoard(true);
		}
		this.setGameState({isPaused: this.paused});
	}

	peek() {
		this.peeking = !this.peeking;

		if (this.peeking) {
			this.peeked = [];
		} else {
			this.peeked.forEach(function(tile) {
				this.showTile(tile, true);
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

	selectTileset(tileset) {
		this.tileset = tileset;
		this.setTileset(tileset);
	}

	/**
	 * This method is called in reponse to the user pressing the solve button
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

	async render() {
		return (
			<MjBoard
				delegator={new ServiceDelegator('mj:controller')}
				id='mj-board'
				key='mj-board'
				serviceName="mj:controller"
				layouts={layouts}
				layout={this.layoutName}
				tilesets={tilesets}
				tileset={this.tileset}
			/>
		)
	}
}

new MJController();
