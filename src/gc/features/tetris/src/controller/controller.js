import React from "react";
import { Service } from "@polylith/core";
import { ServiceDelegator } from 'common/delegators.js';
import TetrisEngine from "../engine/TetrisEngine.js";
import Tetris from "../components/Tetris.jsx";
import * as actions from '../consts/actions.js';

const DEBUG = false;

export default class TetrisController extends Service {
	constructor(registry) {
		super('tetris:controller', registry);

		this.implement([
			'ready', 'render', 'move', 'down', 'rotate', 'harddown', 'hold',
			'mounted', 'play', 'escape', 'pause', 'resume'
		]);

		this.makeFireMethods([
			'drawBoard', 'drawTetronimo', 'drawShadow', 'drawOnDeck',
			'hideShadow', 'hideTetronimo', 'drawWhoop', 'drawPaused', 'drawGameOver',
			'drawHold', 'drawScore', 'drawLevel', 'startGame'
		]);

		this.engine = new TetrisEngine();
		this.engine.listen('update', this.engineUpdate.bind(this));
		this.started = false;
	}

	ready() {
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

	move(direction) {
		this.engine.move(direction);
	}

	down() {
		this.engine.down();
	}

	rotate(direction) {
		this.engine.rotate(direction);
	}

	harddown() {
		this.engine.doHardDown();
	}

	hold() {
		this.engine.hold();
	}

	mounted() {
		if (!this.hasBeenMounted) this.engine.newGame();
		this.hasBeenMounted = true;
	}

	play() {
		this.engine.newGame();
	}

	pause() {
		this.engine.pause();
	}

	resume() {
		this.engine.resume();
	}

	escape() {
		if (this.gameOver) this.play();
	}

	engineUpdate(action, data) {
		if (DEBUG) console.log(action, data);
		if (action === actions.STARTGAME) this.started = true;
		if (!this.started) return;

		switch (action) {
			case actions.STARTGAME: {
				this.gameOver = false;
				this.startGame()
				break;
			}
			case actions.DRAWBOARD: {
					data = data[0];
				let matrix = data[2];
				this.drawBoard(matrix)
				break;
			}
			case actions.DRAWTETRONIMO: {
				data = data[0];
				let [row, col, matrix, force = false] = data

				this.drawTetronimo(row, col, matrix, force);
				break;
			}
			case actions.HIDETETRONIMO: {
				this.hideTetronimo();
				break;
			}
			case actions.DRAWSHADOW: {
				data = data[0];
				let [row, col, matrix] = data
				this.drawShadow(row, col, matrix)
				break;
			}
			case actions.HIDESHADOW: {
				this.hideShadow();
				break;
			}
			case actions.DRAWONDECK: {
				let deckPieces = data.map(function(one) {
					return one[2];
				}, this)
				this.drawOnDeck(deckPieces)
				break
			}
			case actions.DRAWHOLD: {
				let matrix = data[2];

				this.drawHold(matrix)
				break;
			}
			case actions.DRAWWHOOP: {
				let [x, y, width, height] = data

				this.drawWhoop(x, y, width, height);
				break;
			}
			case actions.DRAWSCORE: {
				let [amount = 0, score = 0, comment = ''] = data;
				this.drawScore(amount, score, comment);
				break;
			}
			case actions.DRAWLEVEL: {
				let [goal, level, comment=''] = data;
				this.drawLevel(goal, level, comment);
				break;
			}
			case actions.DRAWPAUSED: {
				let [paused] = data;
				this.drawPaused(paused);
				break;
			}
			case actions.DRAWGAMEOVER: {
				this.started = false;
				this.gameOver = true;
				this.drawGameOver()
				break;
			}
		}
	}

	render() {
		return (
			<Tetris
				serviceName={this.serviceName}
				delegator={new ServiceDelegator(this.serviceName)}
				className="normal"
			/>
		)
	}
}

new TetrisController();
