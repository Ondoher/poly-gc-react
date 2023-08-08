import React, { Component } from "react";
import Random from 'utils/random.js'
import Button from 'components/controls/Button.jsx'

export default class Controls extends Component {
	constructor(props) {
		super(props);

		console.log(props);
		this.state = {layout: this.props.layout, playing: this.props.boardNbr, boardNbr: this.props.boardNbr};

		if (props.delegator) {
			props.delegator.delegateOutbound(this, ['hint', 'undo', 'redo', 'play', 'pause', 'peek', 'setLayout']);
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

	onPlay() {
		this.play(this.state.boardNbr);
	}

	onPause() {
		this.pause();
	}

	onPeek() {
		this.peek();
	}

	onBoardNbrChange(e) {
		this.setState({boardNbr: Number(e.target.value)})
	}

	onLayoutChange(e) {
		this.setLayout(e.target.value);
		this.play(-1);
	}

	componentDidUpdate(prevProps) {
		var state = {};
		console.log(prevProps, this.props, this.state)
		if (prevProps.boardNbr !== this.props.boardNbr) {
			state.boardNbr = this.props.boardNbr;
			state.playing = this.props.boardNbr;
			this.setState(state)
		}
	}

	renderLayoutItems() {
		var layouts = this.props.layouts || [];
		var names = Object.keys(layouts)
		return names.map(function(name) {
			var layout = layouts[name];
			return (
				<option value={layout.id} selected={layout.id === this.state.layout} key={layout.id}>{layout.title} ({layout.tiles})</option>
			)
		}, this)
	}

	renderLayout() {
		var options = this.renderLayoutItems();

		return (
			<select className="layout-selector" onChange={this.onLayoutChange.bind(this)}>
				{options}
			</select>
		)

	}

	renderOptions(){
		var playLabel = this.state.boardNbr !== this.state.playing ? 'Start' : 'Restart';
		return (
			<div className="mj-board-options">
				<span class="mj-board-number-label">Game #</span>
				<input type="number" placeholder="Board" onChange={this.onBoardNbrChange.bind(this)} value={this.state.boardNbr} className="mj-board-number"/>
				<Button className="small-button play-button" onClick={this.onPlay.bind(this)}>{playLabel}</Button>
				{this.renderLayout()}
			</div>
		)
	}

	renderButtons() {
		return (
			<div className="mj-board-buttons">
				<Button className="small-button" onClick={this.onNew.bind(this)}>New</Button>
				<Button className="small-button" onClick={this.onUndo.bind(this)}  disabled={!this.props.canUndo}>Undo</Button>
				<Button className="small-button" onClick={this.onRedo.bind(this)} disabled={!this.props.canRedo}>Redo</Button>
				<Button className="small-button" onClick={this.onHint.bind(this)}>Hint</Button>
				<Button className="small-button" onClick={this.onPeek.bind(this)} selected={this.props.isPeeking}>Peek</Button>
				<Button className="small-button" onClick={this.onPause.bind(this)} selected={this.props.isPaused}> Pause</Button>
			</div>
		)
	}


	render() {
		return (
			<div className="mj-table-controls">
				{this.renderButtons()}
				{this.renderOptions()}
			</div>
		)
	}
}
