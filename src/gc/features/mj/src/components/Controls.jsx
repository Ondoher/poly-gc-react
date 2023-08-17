import React, { Component } from "react";
import Random from 'utils/random.js'
import Button from 'components/controls/Button.jsx'

export default class Controls extends Component {
	constructor(props) {
		super(props);

		if (props.delegator) {
			props.delegator.delegateOutbound(this, [
				'hint', 'undo', 'redo', 'play', 'pause', 'peek']);
		}

		this.windowBlur = this.onWindowEvent.bind(this, true);
		this.windowFocus = this.onWindowEvent.bind(this, false);

		this.pauseOnBlur = window?.process?.env?.NODE_ENV !== 'dev'
	}

	onUndo() {
		this.undo();
	}

	onRedo() {
		this.redo()
	}

	onHint() {
		this.hint();
	}

	onNew() {
		this.play(-1);
	}

	onWindowEvent(on, evt) {
		this.onPause(evt, on);
	}

	onPause(evt, on) {
		console.log('onPause', arguments, on)
		if (on === undefined) return this.pause(on);
		if (this.pauseOnBlur) this.pause(on);
	}

	onPeek() {
		this.peek();
	}

	componentDidMount() {
		window.addEventListener('blur', this.windowBlur);
		window.addEventListener('focus', this.windowFocus);
	}

	componentWillUnmount() {
		window.removeEventListener('blur', this.windowBlur);
		window.removeEventListener('focus', this.windowFocus);
	}

	renderButtons() {
		var gameOver = this.props.won || this.props.lost;
		return (
			<div className="mj-board-buttons">
				<Button className="small-button" onClick={this.onNew.bind(this)}>New</Button>
				<Button className="small-button" onClick={this.onUndo.bind(this)}  disabled={!this.props.canUndo}>Undo</Button>
				<Button className="small-button" onClick={this.onRedo.bind(this)} disabled={!this.props.canRedo}>Redo</Button>
				<Button className="small-button" onClick={this.onHint.bind(this)} disabled={gameOver}>Hint</Button>
				<Button className="small-button" onClick={this.onPeek.bind(this)} disabled={gameOver} selected={this.props.isPeeking}>Peek</Button>
				<Button className="small-button" onClick={this.onPause.bind(this)} disabled={gameOver} selected={this.props.isPaused}> Pause</Button>
			</div>
		)
	}

	render() {
		return (
			<div className="mj-table-controls">
				{this.renderButtons()}
			</div>
		)
	}
}
