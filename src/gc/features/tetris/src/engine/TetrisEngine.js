import { makeEventable } from "@polylith/core";
import Random from "utils/random.js";
import { make2DArray } from "utils/arrays.js";
import Tetronimo from "./Tetronimo.js";
import * as consts from '../consts/consts.js';
import * as actions from '../consts/actions.js';
import * as tetronomos from '../consts/tetronimos.js';

export default class TetrisEngine {
	constructor() {
		makeEventable(this);
		Random.randomize();

		this.board = make2DArray(20, 10, 0);
		this.bag = [];
		this.piece = undefined;
		this.gameOver = true;
		this.rotation = 0;
		this.motion = 0;
		this.onDeck = [];

		this.playClock = setInterval(this.clockCycle.bind(this), 16);
	}
	newGame() {
		this.board = make2DArray(20, 10, 0);
		this.bag = [];
		this.holdPiece = undefined;
		this.onDeck = [];
		this.piece = new Tetronimo(this.randomTetronimo(true));
		this.getOnDeck(false, false);
		this.gameOver = false;
		this.hardDown = false;
		this.roundHeld = false;
		this.time = new Date();
		this.lastMove = this.time.getTime();
		this.score = 0;
		this.rowCount = 0;
		this.speed = 1000;
		this.rotation = 0;
		this.motion = 0;
		this.level = 0;
		this.goal = 10;
		this.lines = 0;
		this.lockClock = 0;
		this.moveButton = consts.NO_BUTTON;
		this.rotateButton = consts.NO_BUTTON;
		this.downButton = consts.NO_BUTTON;
		this.bottomY = -1;
		this.shadowX = -1;
		this.shadowY = -1;
		this.initDisplay();
	}

	initDisplay() {
		this.shadowX = this.piece.x;
		this.shadowY = this.calcBottom();

		this.fire('update', actions.STARTGAME, []);
		this.fire('update', actions.DRAWBOARD, [[0, 0, this.board]]);
		this.drawPiece();
		this.drawShadow();
		this.drawOnDeck();
		this.drawHold();
		this.fire('update', actions.DRAWSCORE, [0, this.score, '']);
	}

	randomTetronimo(first) {
		var idx;
		var result;
		// if necessary, reset the bag
		if (this.bag.length === 0) {
			this.bag = [tetronomos.IPIECE, tetronomos.JPIECE, tetronomos.LPIECE, tetronomos.OPIECE, tetronomos.SPIECE, tetronomos.TPIECE, tetronomos.ZPIECE];
		}

		// pick a tetronimo from the current bag
		idx = Random.random(this.bag.length);

		// the first tetronimo cannot be an S, O or Z
		while (first && (this.bag[idx] == tetronomos.SPIECE || this.bag[idx] == tetronomos.OPIECE || this.bag[idx] == tetronomos.ZPIECE))
			idx = Random.random(this.bag.length);

		result = this.bag[idx];
		this.bag.splice(idx, 1);

		return result;
	}

	getOnDeck(respond, remove) {
		var result;

		if (respond) {
			result = this.onDeck[0];
			if (remove) this.onDeck.splice(0, 1);
		}

		while (this.onDeck.length < 3)
			this.onDeck.push(new Tetronimo(this.randomTetronimo(false)));

		if (respond) return result;
	}

	addScore(amount, comment) {
		this.score += amount;
		this.fire('update', actions.DRAWSCORE, [amount, this.score, comment]);
	}

	evaluateScore() {
		var comment = '';
		var score = 0;

		if (this.tSpin) {
			if (this.rowCount != 0) comment = "T-SPIN BONUS, " + this.rowCount + ' ROWS CLEARED';
			else comment = 'T-SPIN BONUS';

			score = consts.TSPIN_VALUES[this.rowCount] * (this.level + 1);
		}
		else if (this.rowCount == 4) {
			comment = "QUATRAIN BONUS";
			score = consts.ROW_CLEAR_VALUES[this.rowCount - 1] * (this.level + 1);
		}
		else if (this.rowCount != 0) {
			comment = this.rowCount + ' ROWS CLEARED';
			score = consts.ROW_CLEAR_VALUES[this.rowCount - 1] * (this.level + 1);
		}

		if (score != 0)
			this.addScore(score, comment);
	}

	levelUp() {
		this.level++;
		this.goal = 10;
		this.fire('update', actions.DRAWLEVEL, [this.goal, this.level + 1, 'LEVEL UP']);
		this.speed -= 50;
		if (this.speed < 50) this.speed = 100;
	}

	addLines(lines) {
		this.goal -= lines;
		this.lines += lines;
		if (this.goal <= 0)
			this.levelUp()
		else
			this.fire('update', actions.DRAWLEVEL, [this.goal, this.level + 1, '']);
	}

	drawPiece() {
		this.fire('update', actions.DRAWTETRONIMO, [[this.piece.y, this.piece.x, this.piece.matrix()]]);
	}

	drawShadow() {
		this.fire('update', actions.DRAWSHADOW, [[this.shadowY, this.shadowX, this.piece.matrix()]]);
	}

	drawOnDeck() {
		this.fire('update', actions.DRAWONDECK, [
			[this.onDeck[0].y, this.onDeck[0].x, this.onDeck[0].matrix()],
			[this.onDeck[1].y, this.onDeck[1].x, this.onDeck[1].matrix()],
			[this.onDeck[2].y, this.onDeck[2].x, this.onDeck[2].matrix()]
		]);
	}

	hideShadow() {
		this.fire('update', actions.HIDESHADOW, []);
	}

	drawHold() {
		if (this.holdPiece === undefined)
			this.fire('update', actions.DRAWHOLD, [0, 0, consts.CLEAR_MATRIX]);
		else
			this.fire('update', actions.DRAWHOLD, [this.holdPiece.y, this.holdPiece.x, this.holdPiece.matrix()]);
	}

	drawGameOver() {
		this.fire('update', actions.DRAWGAMEOVER, []);
	}

	calcBottom() {
		var yPos = this.piece.y;
		while (!this.bottomedOut())
			this.piece.drop()

		var result = this.piece.y;
		this.piece.y = yPos;

		return result;
	}

	animateFall() {
		beforeX = this.piece.x;
		beforeY = this.piece.y;

		var done = false;
		var drop = 1;

		while (!done && drop > 0) {
			if (this.piece.y < this.bottomY) {
				this.hardDownCount++;
				this.piece.drop()
			}
			else {
				this.lockClock = new Date().getTime();
				done = true;
				this.addScore(this.hardDownCount * 2, '')
			}
			drop--;
		}

		this.fire('update', actions.DRAWTETRONIMO, [[this.piece.y, this.piece.x, this.piece.matrix()]]);

		this.lastMove = new Date().getTime() + consts.SPAWN_DELAY;
		this.hardDown = false;
		if (done) this.animate = false;
		return !done;
	}

	clockCycle() {
		var dirty = false;
		var softDown = false;

		if (this.gameOver) return;
		if (this.animate) return;

		var date = new Date();
		var time = date.getTime();
		var beforeX, beforeY;
		var lockedDown = false;
		var newShadow = false;

		beforeX = this.piece.x;
		beforeY = this.piece.y;

		// if we're in the middle of a hard down aninmation, just do that
		if (this.hardDown) {
			this.hardDown = false;

			this.hardDownCount = 0;
			var top = this.piece.y;
			this.piece.y = this.calcBottom();
			this.addScore(2 * this.piece.y - top, '');

			this.lockClock = new Date().getTime();
			this.lastMove = time + consts.SPAWN_DELAY;

			this.fire('update', actions.DRAWTETRONIMO, [[this.piece.y, this.piece.x, this.piece.matrix()]]);

			// Calculate whoop size and position
			var spaceL = this.piece.space(consts.LEFT);
			var spaceR = this.piece.space(consts.RIGHT);
			var collision = this.piece.collision(consts.UP);

			var width = this.piece.matrix().length;
			var xPos = this.piece.x;
			var bottom = this.piece.y;

			xPos += spaceL;
			width -= spaceL + spaceR;

			var extra = 0;
			for (var idx = 0; idx < collision.length; idx++) {
				if (collision[idx][0] + 1 > extra) extra = collision[idx][0] + 1;
			}

			bottom += extra;

			this.fire('update', actions.DRAWWHOOP, [xPos, top, width, bottom - top]);

			this.lastMove = time + consts.SPAWN_DELAY;
			this.fire('update', actions.DRAWBOARD, [[0, 0, this.board]]);
			this.hideShadow();

			this.lockClock = new Date().getTime();
			this.lastMove = new Date().getTime() + consts.SPAWN_DELAY;

			return;
		}

		beforeX = this.piece.x;
		beforeY = this.piece.y;

		this.rotation = this.getRotation();
		this.motion = this.getMotion();
		softDown = this.getDown() === consts.SOFTDOWN_BUTTON;

		dirty |= this.rotation != 0;
		if (this.rotation !== 0 && this.canRotate(this.rotation))
			this.piece.rotate(this.rotation);
		this.rotation = 0;

		dirty |= this.motion !== 0;
		if (this.motion !== 0 && this.canMove(this.motion))
			this.piece.move(this.motion);
		this.motion = 0;

		newShadow = dirty;

		// If the lock clock is running, see if it has timed out
		if (this.lockClock !== 0) {
			if (time - this.lockClock > this.speed)
				if (this.bottomedOut()) {
					this.lockDown();
					lockedDown = true;
				}
			if (softDown && this.bottomedOut()) {
				this.lockDown();
				lockedDown = true;
			}
		}

		// is it time to move yet?
		if (!lockedDown && (time - this.lastMove > this.speed || (softDown && !lockedDown))) {
			if (!this.bottomedOut())
				this.piece.drop()
			if (this.bottomedOut() && this.lockClock == 0) {
				this.lockClock = time;
			}

			dirty = true;
			this.lastMove = time;

			if (softDown)
				this.addScore(1, '');
		}
		this.downward = 0;

		// update display by calling the callback
		if (this.gameOver || lockedDown) {
			this.lastMove = time + consts.SPAWN_DELAY;
			this.fire('update', actions.DRAWBOARD, [[0, 0, this.board]]);
			if (!this.gameOver)
				this.fire('update', actions.DRAWTETRONIMO, [[this.piece.y, this.piece.x, this.piece.matrix()]]);
			else
				this.fire('update', actions.HIDETETRONIMO, []);
			newShadow = true;
		}
		else if (dirty)
			this.fire('update', actions.DRAWTETRONIMO, [[this.piece.y, this.piece.x, this.piece.matrix()]]);

		if (newShadow) {
			this.shadowX = this.piece.x;
			this.shadowY = this.calcBottom();
			this.drawShadow();
		}
	}

	removeRow(row) {
		for (var rowIdx = row; rowIdx > 0; rowIdx--)
			for (var colIdx = 0; colIdx < consts.COLS; colIdx++)
				this.board[rowIdx][colIdx] = this.board[rowIdx - 1][colIdx];

		for (colIdx = 0; colIdx < consts.COLS; colIdx++)
			this.board[0][colIdx] = consts.EMPTY;

		this.rowCount++;
	}

	checkRows() {
		var row = consts.ROWS - 1;
		var col;
		var full;

		this.rowCount = 0;
		while (row >= 0) {
			full = true;
			col = 0;

			while (col < consts.COLS && full) {
				if (this.board[row][col] === consts.EMPTY) full = false;
				else col++;
			}

			if (full) this.removeRow(row)
			else row--;

		}

		if (this.rowCount != 0) {
			this.addLines(this.rowCount);
		}
	}

	isTSpin() {
		if (this.piece.type != tetronomos.TPIECE) return false;

		return !this.canMove(consts.LEFT, 0) && !this.canMove(consts.RIGHT, 0) && !this.canMove(consts.UP, 0);
	}

	bottomedOut() {
		var collision = this.piece.collision(consts.DOWN);
		var collide = false;

		for (var idx = 0; idx < collision.length; idx++) {
			var yPos = this.piece.y + collision[idx][0];
			var xPos = this.piece.x + collision[idx][1];

			// at the bottom, or there is a piece underneath, then we've hit bottom
			if ((yPos >= consts.ROWS) || (yPos >= 0 && this.board[yPos][xPos] != 0)) {
				collide = true;
				break;
			}
		}

		return collide;
	}

	lockDown() {
		// check for a tspin before locking in the blocks
		this.tSpin = this.isTSpin();

		// lock the blocks
		this.downButton = consts.NO_BUTTON;
		var matrix = this.piece.matrix();
		for (var row = 0; row < matrix.length; row++)
			for (var col = 0; col < matrix[row].length; col++)
				if (row >= 0 && matrix[row][col] != 0)
					this.board[this.piece.y + row][this.piece.x + col] = matrix[row][col];

		// look for and remove full rows
		this.checkRows();
		this.evaluateScore();

		// move the on deck piece to current, make new on deck piece
		this.oldPiece = this.piece;
		this.piece = this.getOnDeck(true, true);
		this.drawOnDeck();
		this.roundHeld = false;

		// check end of game
		matrix = this.piece.matrix();
		for (row = 0; row < matrix.length; row++)
			for (col = 0; col < matrix[row].length; col++)
				if (this.piece.y + row >= 0 && this.board[this.piece.y + row][this.piece.x + col] != 0) {
					this.gameOver = true;
					this.drawGameOver();
				}

		// reset the lock clock
		this.lockClock = 0;
		this.hardDown = false;
	}

	collision() {
		// run through the collision list check if there is a block there;
		// if so, add each block to the game board, and move the piece on deck to the current piece
		var collision = this.piece.collision(DOWN);
		var collide = false;

		for (var idx = 0; idx < collision.length; idx++) {
			var yPos = this.piece.y + collision[idx][0];
			var xPos = this.piece.x + collision[idx][1];

			// at the bottom, or there is a piece underneath, then collide
			if ((yPos == consts.ROWS) || (this.board[yPos][xPos] != 0)) {
				collide = true;
				break;
			}
		}

		// if a collision then process it
		if (collide) {
			// add the blocks
			this.downButton = consts.NO_BUTTON;
			var matrix = this.piece.matrix();
			for (var row = 0; row < matrix.length; row++)
				for (var col = 0; col < matrix[vRow].length; col++)
					if (matrix[row][col] != 0)
						this.board[this.piece.y + row][this.piece.x + col] = matrix[row][col];

			// look for full rows
			this.checkRows();

			// move the on deck piece to current, make new on deck piece
			this.oldPiece = this.piece;
			this.piece = this.getOnDeck(true, true);
			this.drawOnDeck();
			this.roundHeld = false;

			// check end of game
			matrix = this.piece.matrix();
			for (row = 0; row < matrix.length; row++)
				for (col = 0; col < matrix[row].length; col++)
					if (this.piece.y + row >= 0 && this.board[this.piece.y + row][this.piece.x + col] != 0)
						this.gameOver = true;
		}

		return collide;
	}

	canMove(direction) {
		var collision = this.piece.collision(direction);
		for (var idx = 0; idx < collision.length; idx++) {
			var collideY = this.piece.y + collision[idx][0];
			var collideX = this.piece.x + collision[idx][1];

			if (collideX < 0 && direction == consts.RIGHT) collideX = 0;
			if (collideX >= consts.COLS && direction == consts.LEFT) collideX = consts.COLS - 1;

			if ((collideX < 0 && direction == consts.LEFT) || (collideX >= consts.COLS && direction == consts.RIGHT)) return false;
			if (collideY >= 0 && this.board[collideY][collideX] != 0) return false;
		}

		return true;
	}

	intersect(adjust) {
		var matrix = this.piece.matrix();

		for (var row = 0; row < matrix.length; row++)
			for (var col = 0; col < matrix[row].length; col++) {
				var xPos = this.piece.x + col + adjust;
				var yPos = this.piece.y + row;
				if (matrix[row][col] != 0) {
					if (xPos < 0 || xPos >= consts.COLS) return true;
					if (yPos >= consts.ROWS) return true;
					if (yPos >= 0 && this.board[yPos][xPos] != 0) return true;
				}
			}

		return false;
	}

	testRotate() {
		var kickL = this.piece.kick(consts.LEFT);
		var kickR = this.piece.kick(consts.RIGHT);

		if (!this.intersect(0)) return true;
		if (kickL != 0 && !this.intersect(kickL)) {
			this.piece.x += kickL;
			return true;
		}
		if (kickR != 0 && !this.intersect(kickR)) {
			this.piece.x += kickR;
			return true;
		}

		return false;
	}

	canRotate(direction) {
		this.piece.testRotate(direction);
		var result = this.testRotate()
		this.piece.untestRotate(direction);
		return result;
	}

	getDown() {
		if (this.downButton != 0) {
			var now = new Date().getTime();

			if (now - this.downStart >= this.downDelay) {
				this.downStart = new Date().getTime();
				this.downDelay = consts.REPEAT_DELAY;
				return this.downButton;
			}
			return this.downward;
		}

		return this.downward;
	}

	getRotation() {
		if (this.rotateButton != 0) {
			var now = new Date().getTime();

			if (now - this.rotateStart >= this.rotateDelay) {
				this.rotateStart = new Date().getTime();
				this.rotateDelay = consts.REPEAT_DELAY;
				if (this.rotateButton == consts.ROTATELEFT_BUTTON)
					return consts.LEFT;
				else
					return consts.RIGHT;
			}
			return this.rotation;
		}

		return this.rotation;
	}

	getMotion() {
		if (this.moveButton != 0) {
			var now = new Date().getTime();

			if (now - this.moveStart >= this.moveDelay) {
				this.moveStart = new Date().getTime();
				this.moveDelay = consts.REPEAT_DELAY;
				if (this.moveButton == consts.LEFT_BUTTON)
					return consts.LEFT;
				else
					return consts.RIGHT;
			}
			return this.motion;
		}

		return this.motion;
	}

	buttonDown(buttonType, button) {
		switch (buttonType) {
			case consts.DOWN_BTN:
				if (button == consts.HARDDOWN_BUTTON) this.hardDown = true;
				this.downButton = button;
				this.downStart = new Date().getTime();
				this.downDelay = consts.BOUCE_DELAY;
				break;
			case consts.MOVE_BTN:
				this.motion = (button == consts.LEFT_BUTTON ? consts.LEFT : consts.RIGHT);
				this.moveStart = new Date().getTime();
				this.moveDelay = consts.BOUCE_DELAY;
				this.moveButton = button;
				break;
			case ROTATE_BTN:
				this.rotation = (button == consts.ROTATELEFT_BUTTON ? consts.LEFT : consts.RIGHT);
				this.rotateStart = new Date().getTime();
				this.rotateDelay = consts.BOUCE_DELAY;
				this.rotateButton = button;
				break;
		}
		this.button = button;
	}

	buttonUp(buttonType, button) {
		switch (buttonType) {
			case DOWN_BTN:
				if (button == this.downButton) {
					this.downButton = consts.NO_BUTTON;
					this.downward = 0;
				}
				break;
			case MOVE_BTN:
				if (button == this.moveButton) {
					this.moveButton = consts.NO_BUTTON;
					this.motion = 0;
				}
				break;
			case ROTATE_BTN:
				if (button == this.rotateButton) {
					this.rotateButton = consts.NO_BUTTON;
					this.rotation = 0;
				}
				break;
		}
		this.button = button;
	}

	rotate(direction) {
		this.rotation = direction;
	}

	move(direction) {
		console.log('move', direction)
		this.motion = direction;
	}

	moveToX(xPos) {
		this.jumpToX = xPos;
	}

	down() {
		this.downward = 1;
	}

	doHardDown() {
		console.log('doHardDown', this.hardDown)
		this.hardDown = true;
	}

	hold() {
		if (this.roundHeld) return;
		this.roundHeld = true;

		this.fire('update', actions.HIDETETRONIMO, []);
		if (this.holdPiece == undefined) {
			this.holdPiece = this.piece;
			this.piece = this.getOnDeck(true, true);
		} else {
			var piece = this.piece;
			this.piece = this.holdPiece;
			this.holdPiece = piece;
		}

		this.piece.reset();
		this.holdPiece.reset();
		this.holdPiece.y = 0;
		this.holdPiece.x = 0;
		this.shadowX = this.piece.x;
		this.shadowY = this.calcBottom();
		this.drawPiece();
		this.drawShadow();
		this.drawOnDeck();
		this.drawHold();
	}
}
