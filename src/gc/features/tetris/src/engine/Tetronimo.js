import * as consts from '../consts/consts.js';
import * as tetronimos from '../consts/tetronimos.js';

export default class Tetronimo {
	constructor(type) {
		this.type = type;
		this.reset();
	}

	testRotate(direction) {
		this.rotation = (this.rotation + direction + this.shape.length) % this.shape.length;
	}

	untestRotate(direction) {
		direction = 0 - direction;
		this.rotation = (this.rotation + direction + this.shape.length) % this.shape.length;
	}

	rotate(direction) {
		this.rotation = (this.rotation + direction + this.shape.length) % this.shape.length;
	}

	canMoveX(direction) {
		var extra = this.shape[this.rotation].space[direction + 1];
		if (direction == consts.LEFT) return extra + this.x;
		else return (consts.COLS - (this.x + this.shape[this.rotation].shape[0].length)) + extra;
	}

	move(direction) {
		var space = this.canMoveX(direction);
		if (space != 0)
			this.x += direction;
	}

	drop() {
		this.y++;
	}

	matrix() {
		return this.shape[this.rotation].shape;
	}

	collision(direction) {
		return this.shape[this.rotation].collision[direction + 1];
	}

	kick(direction) {
		return this.shape[this.rotation].kick[direction + 1];
	}

	space(direction) {
		return this.shape[this.rotation].space[direction + 1];
	}
	reset() {
		this.y = 0;
		this.rotation = 0;
		switch (this.type) {
			case tetronimos.IPIECE:
				this.shape = tetronimos.IPIECE_ROTATION;
				this.x = 3;
				this.y = -1
				break;
			case tetronimos.JPIECE:
				this.shape = tetronimos.JPIECE_ROTATION;
				this.x = 3;
				this.y = -1
				break;
			case tetronimos.LPIECE:
				this.shape = tetronimos.LPIECE_ROTATION;
				this.x = 3;
				this.y = -1
				break;
			case tetronimos.OPIECE:
				this.shape = tetronimos.OPIECE_ROTATION;
				this.x = 4;
				break;
			case tetronimos.SPIECE:
				this.shape = tetronimos.SPIECE_ROTATION;
				this.x = 3;
				this.y = -1
				break;
			case tetronimos.TPIECE:
				this.shape = tetronimos.TPIECE_ROTATION;
				this.x = 3;
				this.y = -1
				break;
			case tetronimos.ZPIECE:
				this.shape = tetronimos.ZPIECE_ROTATION;
				this.x = 3;
				this.y = -1
				break;
		}
	}
}
