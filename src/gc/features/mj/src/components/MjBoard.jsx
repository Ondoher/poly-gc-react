import React from "react";
import Page from 'components/Page.jsx'
import Button from 'components/controls/Button.jsx'
import Tile from './Tile.jsx';
import Timer from './Timer.jsx';
import {Fireworks} from '@fireworks-js/react';

const DEFAULT_TILESET = {
	name : 'Ivory Tiles',
	image : 'images/mj/tilesets/ivory/dragon-r.png',
	description : '',
	tiles : 144,
	css: '',
	class: 'ivory'
};

export default class MjBoard extends React.Component {
	constructor (props) {
		super(props);

		if (props.delegator) {
			props.delegator.delegateInbound(this, [
				'setWon', 'setGameState', 'setMessage',
				'setShortMessage', 'setTiles', 'clearBoard']
			);

			props.delegator.delegateOutbound(this, ['select', 'initialized',
				'hint', 'undo', 'redo', 'play', 'pause', 'peek']);
		}

		this.state = {
			tileset: DEFAULT_TILESET,
			instance: -1,
			tiles: [],
			message: '',
			canUndo: false,
			canRedo: false,
		}
		this.tiles = [];
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
		this.play();
	}

	onPause() {
		this.pause();
	}

	onPeek() {
		this.peek();
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

	render() {
		var {canUndo, canRedo, isPeeking, isPaused} = this.state;
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
				{this.renderFireworks()}
				<div className={'mj-table ' + className}>
					<div className="mj-board-header">
						<div className="mj-table-controls">
							<Button className="small-button" onClick={this.onUndo.bind(this)}  disabled={!canUndo}>Undo</Button>
							<Button className="small-button" onClick={this.onRedo.bind(this)} disabled={!canRedo}>Redo</Button>
							<Button className="small-button" onClick={this.onHint.bind(this)}>Hint</Button>
							<Button className="small-button" onClick={this.onPeek.bind(this)} selected={isPeeking}>Peek</Button>
							<Button className="small-button" onClick={this.onPause.bind(this)} selected={isPaused}> Pause</Button>
							<Button className="small-button" onClick={this.onNew.bind(this)}>New</Button>
						</div>
						<Timer id="mj-timer" className="timer" delegator={this.props.delegator.newDelegator()}/>
						<div id="message" className="mj-message">{this.state.message}</div>
						<div id="short-message" className="mj-short-message">{this.state.shortMessage}</div>
					</div>
					<div id="board-canvas">
						{this.renderTiles()}
					</div>
				</div>
			</Page>
		)
	}
}
