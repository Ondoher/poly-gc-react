import React, { Component } from "react";
import Matrix from "./Matrix";
import * as consts from "../consts/consts.js"

export default class PlayMatrix extends Component {
	constructor (props) {
		super(props);

		this.state = {matrix: [[]]}
		if (props.delegator) {
			props.delegator.delegateInbound(this, [
				'drawTetronimo', 'drawBoard', 'drawShadow', 'hideShadow',
				'hideTetronimo', 'drawWhoop',
			]);

			props.delegator.delegateOutbound(this, [
				'move', 'down', 'rotate', 'harddown', 'hold', 'started'
			]);
		}

		this.keyPress = this.keyPress.bind(this);
		this.keyDown = this.keyDown.bind(this);
		this.state = {};
	}

	componentDidMount() {
		document.addEventListener('keydown', this.keyDown)
		document.addEventListener('keypress', this.keyPress)
		this.started();
	}

	componentWillUnmount() {
		document.removeEventListener('keydown', this.keyDown)
		document.removeEventListener('keypress', this.keyPress)
	}

	keyDown(event) {
		console.log('keyDown', event);
		var keyID = event.keyCode;
		var handled = true;
		switch(keyID)
		{
			case 37:
				this.move(consts.LEFT);
				break;
			case 38:
				this.rotate(consts.RIGHT);
				break;
			case 39:
				console.log('moving')
				this.move(consts.RIGHT);
				break;
			case 40:
				this.down()
				break;
			default:
				handled = false;
				break;
		}

		return !handled;
	}

	keyPress(event) {
		var handled = true;

		var keyChar = event.key;

		switch(keyChar)
		{
			case ' ':
				this.harddown();
				break;
			case 'a':
				this.move(consts.LEFT);
				break;
			case 'd':
				this.move(consts.RIGHT);
				break;
			case 's':
				this.down();
				break;
			case 'z':
			case 'e':
				this.rotate(consts.LEFT);
				break;
			case 'q':
			case 'x':
				this.rotate(consts.RIGHT);
				break;
			case 'c':
				this.hold();
				break;
			default:
				handled = false;
				break;
		}

		return !handled;
	}

	drawWhoop(x, y, width, height) {
		this.setState({
			whoop: {x, y, width, height, start: Date.now(), opacity: 1}
		});

		if (this.whoopTimer) clearInterval(this.whoopTimer);
		this.whoopTimer = setInterval(this.whoopTick.bind(this), 50)
	}

	whoopTick() {
		const timeout = 250;
		var whoop = this.state.whoop;
		if (!whoop) {
			return;
		}

		var delta = Date.now() - whoop.start;;
		if (delta > timeout) {
			console.log('whoop gone')
			this.setState({whoop: false})
			clearInterval(this.whoopTimer);
			return;
		}

		var opacity = 1 - delta / timeout;
		whoop.opacity = opacity;
		this.setState({whoop: whoop})
	}

	drawTetronimo(row, col, matrix) {
		this.setState({tetronimo: {row, col, matrix}})
	}

	drawBoard(matrix) {
		this.setState({matrix})
	}

	drawShadow(row, col, matrix) {
		this.setState({shadow: {row, col, matrix}})
	}

	hideShadow() {
		this.setState({shadow: false})
	}

	hideTetronimo() {
		this.setState({tetronimo: false})
	}


	renderWhoop() {
		if (!this.state.whoop) return;
		var {x, y, width, height, opacity} = this.state.whoop;;
		var styles = {
			left: x * 16 + 'px',
			top: y * 16 + 'px',
			width: width * 16 + 'px',
			height: height * 16 + 'px',
			opacity: opacity,
		}

		return (
			<div className="whoop" style={styles}/>
		)
	}
	renderShadow() {
		if (!this.state.shadow) return;
		var {col: offsetX, row: offsetY, matrix} = this.state.shadow
		return <Matrix shadow={true} offsetX={offsetX} offsetY={offsetY} matrix={matrix} />
	}

	renderTetronimo() {
		if (!this.state.tetronimo) return;
		var {col: offsetX, row: offsetY, matrix} = this.state.tetronimo

		return <Matrix className="normal tetronimo" offsetX={offsetX} offsetY={offsetY} matrix={matrix} />
	}

	render() {
		var className = `tetris-normal matrix`;
		if (!this.state.matrix) return;
		return (
			<div className={className}>
				<Matrix matrix={this.state.matrix} >
					{this.renderTetronimo()}
					{this.renderShadow()}
					{this.renderWhoop()}
				</Matrix>
			</div>
		);
	}
}
