import {Service} from '@polylith/core';
import React from 'react';
import MjEngine from "../engine/mjEngine.js";
import MjBoard from "../components/MjBoard.jsx";
import { ServiceDelegator } from 'common/delegators.js';
import Beetle from '../layouts/Beetle.js';


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
			'solve', 'play', 'select', 'initialized']);

		// these methods will just fire their arguments to who ever is
		// listening. This will be the board view component or individuals tiles
		this.makeFireMethods(['setTime','setWon', 'setGameState',
			'setMessage', 'setShortMessage', 'showTile', 'hintTile',
			'highlightTile', 'setTiles','clearBoard',]);

		this.engine = new MjEngine();
//		this.engine.setLayout(Beetle);
		this.timerHandle = setInterval(this.onTimerTick.bind(this), 250);

		this.engine.listen('updateState', this.updateState.bind(this));
		this.engine.listen('addTile', this.addTile.bind(this));
		this.engine.listen('removeTile', this.removeTile.bind(this));
		this.engine.listen('newBoard', this.newBoard.bind(this))
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

	/**
	 * This method is an event handler that will be called by the view to let
	 * us know the view has been rendered and can now be used.
	 */
	initialized() {
		this.newGame(-1);
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
		var now = new Date().getTime();
		if (this.paused)
			this.startTime += now - this.stopTime;
		else
			this.startTime = new Date().getTime();

		this.timerRunning = true;
		this.paused = false;
	}

	/**
	 * Call this method to permanently stop the timer. It cannot be resumed.
	 */
	stopTimer() {
		if (!this.timerRunning) return;
		var time = new Date().getTime() - this.startTime;
		this.time = time;
		this.setTime(time);
		this.timerRunning = false;
	}

	/**
	 * Call this method to pause the timer. It can be resumed by calling
	 * restartTimer
	 */
	pauseTimer() {
		this.stopTime = new Date().getTime();
		this.timerRunning = false;
		this.paused = true;
	}

	/**
	 *  Called on an interval. It will update the displayed timer
	 */
	onTimerTick() {
		if (!this.timerRunning) return;
		var time = new Date().getTime() - this.startTime;
		this.setTime(time);
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
			this.logEvent('win');
			this.message('YOU WIN!!!');
			this.gameWon = true;
		} else if (state.lost) {
			this.setWon(false);
			this.pauseTimer();
			this.logEvent("lose");
			this.gameLost = true;
			this.message('NO MORE MOVES, GAME OVER');

		} else {
			this.message('');
			this.setWon(false);
			this.gameWon = false;
			this.gameLost =false;
		}

		this.openTiles = state.open;
		this.setGameState(state.remaining, state.canUndo, state.canRedo);

		this.shortMessage('');
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

		this.setTiles(Math.random(), tiles);
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
	 * @param {Number} gameNbr
	 */
	generateGame(gameNbr) {
		this.logEvent('generateGame');

		// remove the old board and recreate it
		try {
			this.clearBoard();
			this.engine.generateGame(gameNbr);

		} catch (err) {
			console.log(err);
		}
	}

	/**
	 * Call this method to start playing a new game
	 *
	 * @param {Number} gameNbr the number of the board to play. Passing the same
	 * 		number will always generate the same board.
	 */
	newGame(gameNbr) {
		console.log(`newGame(${gameNbr})`)
		if (gameNbr === -1) gameNbr = Math.random(0xFFFFF);

		this.selectedTile = -1;

		this.hintIdx = -1;
		this.hint1 = -1;
		this.hint2 = -1;

		Math.randomize(gameNbr);

		this.message("Loading new game ...");

		this.generateGame(gameNbr);


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
	 * Ths method is called in response to the hint button being pressed. If
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

	/**
	 * This method is called in response to the player pressing the play button
	 *
	 * @param {Number} boardNbr
	 */
	play(boardNbr) {
		this.newGame(boardNbr);
	}

	/**
	 * This method is called in reponse to the user pressing the solve button
	 */
	solve() {
		this.engine.startOver();
		this.drawBoard();
		var solution = JSON.parse(JSON.stringify(this.engine.solution));
		this.startTime = new Date().getTime() - 124000

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
			/>
		)
	}
}

new MJController();
