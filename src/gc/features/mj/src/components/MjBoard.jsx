import {Fireworks} from '@fireworks-js/react';
import React from "react";
import Page from 'components/Page.jsx'
import Tile from './Tile.jsx';
import Timer from './Timer.jsx';
import Controls from './Controls.jsx';
import Options from './Options.jsx';

const DEFAULT_TILESET = {
	name : 'Bone Tiles',
	image : 'images/mj/tilesets/ivory/dragon-r.png',
	description : '',
	tiles : 144,
	css: '',
	class: 'ivory normal-size'
};

export default class MjBoard extends React.Component {
	constructor (props) {
		super(props);

		if (props.delegator) {
			props.delegator.delegateInbound(this, [
				'setWon', 'setGameState', 'setMessage',
				'setShortMessage', 'setTiles', 'clearBoard', 'setTileset']
			);

			props.delegator.delegateOutbound(this, ['select', 'initialized']);
		}

		this.state = {
			tileset: this.props.tilesets[this.props.tileset],
			instance: -1,
			tiles: [],
			message: '',
			canUndo: false,
			canRedo: false,
			boardNbr: this.props.boardNbr,
		}
		this.tiles = [];
	}

	onClickTile (tile) {
		this.select(tile);
	}

	setWon (on) {
		this.setState({won: on})
	}

	setButtonState () {
	}

	setMessage (message) {
		this.setState({
			message: message
		})
	}
	setShortMessage (message) {
		this.setState({
			shortMessage: message
		})
	}
	setGameState(state) {
		this.setState(state);
	}

	setTiles (instance, tiles) {
		this.setState({
			instance: instance,
			tiles: tiles
		});
	}

	setTileset(tileset) {
		this.setState({tileset: this.props.tilesets[tileset]});
	}

	clearBoard() {
		this.setState({
			tiles: {}
		})
	}

	createTiles() {
		if (this.state.instance === this.instance) {
			return this.tiles;
		}
		this.instance = this.state.instance;
		var tiles = this.state.tiles;

		this.tiles = [];
		tiles.forEach(function(tile) {
			this.tiles.push(
				<Tile
					key={tile.id}
					delegator={this.props.delegator.newDelegator()}
					id={tile.id}
					x={tile.x}
					y={tile.y}
					z={tile.z}
					face={tile.face}
					onClick={this.onClickTile.bind(this, tile.id)}
				/>
			);

		}, this);
	}


	renderTiles() {
		this.createTiles();

		return this.tiles;
	}

	renderTime() {
	}

	renderWon() {
	}

	renderMessage() {
	}

	componentDidMount() {
		this.initialized();
	}

	componentDidUpdate() {
	}

	renderFireworks() {
		var won = this.state.won;

		if (!won) return;

		return <Fireworks
			className="mj-fireworks"
		/>
	}

	renderControls() {
		var {canUndo, canRedo, isPeeking, isPaused, won} = this.state;
		return (
			<Controls
				delegator = {this.props.delegator}
				canUndo={canUndo}
				canRedo={canRedo}
				isPeeking={isPeeking}
				isPaused={isPaused}
				won={won}
			/>
		)
	}

	renderOptions() {
		var {boardNbr} = this.state;
		return (
			<Options
				layout={this.props.layout}
				layouts={this.props.layouts}
				tileset={this.state.tileset}
				tilesets={this.props.tilesets}
				delegator = {this.props.delegator}
				boardNbr={boardNbr}
			/>
		)
}


	renderHeader() {
		return (
			<div className="mj-board-header">
				{this.renderControls()}
				<Timer id="mj-timer" className="timer" delegator={this.props.delegator.newDelegator()}/>
				<div id="message" className="mj-message">{this.state.message}</div>
				<div id="short-message" className="mj-short-message">{this.state.shortMessage}</div>
			</div>
		)
	}

	renderCanvas() {
		return(
			<div id="board-canvas">
				{this.renderTiles()}
			</div>
		)
	}

	renderSurface() {
		return (
			<div className="mj-surface">
				{this.renderCanvas()}
			</div>
		)
	}

	renderMain() {
		return (
			<div class="mj-table-main">
				{this.renderOptions()}
				{this.renderSurface()}
			</div>
		)
	}

	render() {
		var className = this.state.tileset.class;

		if (!this.props.delegator) {
			return (
				<h1>Error</h1>
			)
		}
		var won = this.state.won;
		var pageClassName = 'page mj-board-page ';
		pageClassName += won ? 'won' : 'not-won';

		return (
			<Page serviceName={this.props.serviceName} className={pageClassName}>
				<div className={'mj-table ' + className}>
					{this.renderFireworks()}
					{this.renderHeader()}
					{this.renderMain()}
				</div>
			</Page>
		)
	}
}
