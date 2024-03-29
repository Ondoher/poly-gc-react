import {Fireworks} from '@fireworks-js/react';
import React from "react";
import Page from 'components/Page.jsx'
import Timer from './Timer.jsx';
import Controls from './Controls.jsx';
import Options from './Options.jsx';
import MjCanvas from './MjCanvas.jsx';

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
				'setWon', 'setLost', 'setGameState', 'setMessage',
				'setShortMessage', 'setTiles', 'setTilesize', 'clearBoard',
				'setTileset', 'setTilesize']
			);

			props.delegator.delegateOutbound(this, ['select', 'initialized']);
		}

		this.state = {
			tileset: this.props.tilesets[this.props.tileset],
			tilesize: this.props.tilesizes[this.props.tilesize],
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

	setWon(on) {
		this.setState({won: on})
	}

	setLost(on) {
		this.setState({lost: on})
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

	setTilesize(tilesize) {
		this.setState({tilesize: this.props.tilesizes[tilesize]});
	}

	clearBoard() {
		this.setState({
			tiles: {}
		})
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

	renderLost() {
		if (!this.state.lost) return;

		return <div className="mj-gameover" />;
	}

	renderFireworks() {
		var won = this.state.won;

		if (!won) return;

		return <Fireworks
			className="mj-gameover"
		/>
	}

	renderControls() {
		var {canUndo, canRedo, isPeeking, isPaused, won, lost} = this.state;
		return (
			<Controls
				delegator = {this.props.delegator}
				canUndo={canUndo}
				canRedo={canRedo}
				isPeeking={isPeeking}
				isPaused={isPaused}
				won={won}
				lost={lost}
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
				tilesize={this.state.tilesize}
				tilesizes={this.props.tilesizes}
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
			<MjCanvas
				delegator={this.props.delegator.newDelegator()}
				onClick={this.onClickTile.bind(this)}
				tiles={this.state.tiles}
			/>
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
		var set = this.state.tileset.class;
		var size = this.state.tilesize.class

		var className = `${set}-${size} ${size}-face ${size}-size`

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
					{this.renderMain()}
					{this.renderFireworks()}
					{this.renderLost()}
					{this.renderHeader()}
				</div>
			</Page>
		)
	}
}
