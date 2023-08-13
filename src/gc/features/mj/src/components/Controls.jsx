import React, { Component } from "react";
import Random from 'utils/random.js'
import Button from 'components/controls/Button.jsx'

export default class Controls extends Component {
	constructor(props) {
		super(props);

		if (props.delegator) {
			props.delegator.delegateOutbound(this, ['hint', 'undo', 'redo', 'play', 'pause', 'peek', 'selectLayout', 'selectTileset']);
		}
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

	onPause() {
		this.pause();
	}

	onPeek() {
		this.peek();
	}

	renderButtons() {
		return (
			<div className="mj-board-buttons">
				<Button className="small-button" onClick={this.onNew.bind(this)}>New</Button>
				<Button className="small-button" onClick={this.onUndo.bind(this)}  disabled={!this.props.canUndo}>Undo</Button>
				<Button className="small-button" onClick={this.onRedo.bind(this)} disabled={!this.props.canRedo}>Redo</Button>
				<Button className="small-button" onClick={this.onHint.bind(this)} disabled={this.props.won}>Hint</Button>
				<Button className="small-button" onClick={this.onPeek.bind(this)} disabled={this.props.won} selected={this.props.isPeeking}>Peek</Button>
				<Button className="small-button" onClick={this.onPause.bind(this)} disabled={this.props.won} selected={this.props.isPaused}> Pause</Button>
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
