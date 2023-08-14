import React, { Component } from "react";
import Random from 'utils/random.js'
import Button from 'components/controls/Button.jsx'

export default class Options extends Component {
	constructor(props) {
		super(props);

		console.log(props);
		this.state = {layout: this.props.layout, playing: this.props.boardNbr,
			boardNbr: this.props.boardNbr, tileset: this.props.tileset};

		if (props.delegator) {
			props.delegator.delegateOutbound(this, ['selectLayout', 'selectTileset', 'play']);
		}
	}

	onBoardNbrChange(e) {
		this.setState({boardNbr: Number(e.target.value)})
	}

	onPlay() {
		this.play(this.state.boardNbr);
	}


	onLayoutChange(e) {
		this.selectLayout(e.target.value);
		this.play(-1);
	}

	onTilesetChange(e) {
		this.selectTileset(e.target.value);
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
		var names = Object.keys(layouts);
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
			<div class="mj-game-layout mj-option">
				<span class="mj-control-label">Layout #</span>
				<select className="layout-selector" onChange={this.onLayoutChange.bind(this)}>
					{options}
				</select>
			</div>
		)
	}

	renderGameNbr() {
		var playLabel = this.state.boardNbr !== this.state.playing ? 'Start' : 'Restart';

		return (
			<div class="mj-game-number mj-option">
				<span class="mj-control-label">Game #</span>
				<input type="number" placeholder="Board" onChange={this.onBoardNbrChange.bind(this)} value={this.state.boardNbr} className="mj-board-number"/>
				<Button className="small-button play-button" onClick={this.onPlay.bind(this)}>{playLabel}</Button>
			</div>
		)
	}

	renderTilesetItems() {
		var tilesets = this.props.tilesets || [];
		var names = Object.keys(tilesets)
		return names.map(function(name) {
			var tileset = tilesets[name];
			return (
				<option value={name} selected={name === this.state.tileset} key={name}>{tileset.name}</option>
			)
		}, this)
	}

	renderTileset() {
		var options = this.renderTilesetItems();

		return (
			<div class="mj-tileset mj-option">
				<span class="mj-control-label">Tile Set #</span>
				<select className="tileset-selector" onChange={this.onTilesetChange.bind(this)}>
					{options}
				</select>
			</div>

		)

	}

	render(){
		return (
			<div className="mj-board-options">
				{this.renderGameNbr()}
				{this.renderLayout()}
				{this.renderTileset()}
			</div>
		)
	}
}
