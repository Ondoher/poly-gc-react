import {Fireworks} from '@fireworks-js/react';
import React from "react";
import Page from 'components/Page.jsx'
import Canvas from './Canvas.jsx';
import CssRect from './CssRect.jsx';
import GameNumberControl from './GameNumberControl.jsx';
import RightHud from './RightHud.jsx';
import SettingsDialog from './SettingsDialog.jsx';
import Toast from './Toast.jsx';

const DEFAULT_TILESET = {
	name : 'Bone Tiles',
	image : 'images/mj/tilesets/ivory/dragon-r.png',
	description : '',
	tiles : 144,
	css: '',
	class: 'ivory normal-size'
};

export default class Board extends React.Component {
	constructor (props) {
		super(props);

		if (props.delegator) {
			props.delegator.delegateInbound(this, [
				'setWon', 'setLost', 'setGameState', 'setMessage',
				'setShortMessage', 'setTiles', 'setTilesize', 'clearBoard',
				'setTileset', 'setTilesize']
			);

			props.delegator.delegateOutbound(this, [
				'select', 'initialized', 'play', 'undo', 'redo', 'hint', 'pause', 'peek',
				'selectLayout', 'selectTileset', 'selectTilesize'
			]);
		}

		this.state = {
			layout: this.props.layout,
			tileset: this.props.tilesets[this.props.tileset],
			tilesetKey: this.props.tileset,
			tilesize: this.props.tilesizes[this.props.tilesize],
			tilesizeKey: this.props.tilesize,
			allowedTilesizes: this.props.allowedTilesizes || Object.keys(this.props.tilesizes || {}),
			maxTileSize: this.props.maxTileSize || this.props.tilesize,
			isBelowMinimum: Boolean(this.props.isBelowMinimum),
			instance: -1,
			tiles: [],
			message: '',
			shortMessage: '',
			shortMessageKey: 0,
			settingsOpen: false,
			canUndo: false,
			canRedo: false,
			isPeeking: false,
			isPaused: false,
			won: false,
			celebrationDismissed: false,
			lost: false,
			boardNbr: this.props.boardNbr,
		}
		this.tiles = [];
		this.onWindowKeyDown = this.onWindowKeyDown.bind(this);
	}

	onClickTile (tile) {
		this.select(tile);
	}

	onPlay(boardNbr) {
		if (this.play) {
			this.play(boardNbr);
		}
	}

	onRestart() {
		this.onPlay(this.state.boardNbr);
	}

	onShuffle() {
		this.onPlay(-1);
	}

	onUndo() {
		if (this.undo) {
			this.undo();
		}
	}

	onRedo() {
		if (this.redo) {
			this.redo();
		}
	}

	onHint() {
		if (this.hint) {
			this.hint();
		}
	}

	onPause() {
		if (this.pause) {
			this.pause();
		}
	}

	onSelectLayout(layout) {
		if (this.selectLayout) {
			this.selectLayout(layout);
		}

		this.setState({
			layout: layout,
		});
	}

	onSelectTileset(tileset) {
		if (this.selectTileset) {
			this.selectTileset(tileset);
		}

		this.setState({
			tileset: this.props.tilesets[tileset],
			tilesetKey: tileset,
		});
	}

	onSelectTilesize(tilesize) {
		if (this.selectTilesize) {
			this.selectTilesize(tilesize);
		}

		this.setState({
			tilesize: this.props.tilesizes[tilesize],
			tilesizeKey: tilesize,
		});
	}

	onPeek() {
		if (this.peek) {
			this.peek();
		}
	}

	onSettings() {
		this.setState({
			settingsOpen: true,
		});
	}

	onDismissCelebration() {
		this.setState({
			celebrationDismissed: true,
		});
	}

	onWindowKeyDown(evt) {
		if (evt.key !== 'Escape') return;
		if (this.state.settingsOpen) {
			this.onCloseSettingsDialog();
			return;
		}
		if (!this.state.won || this.state.celebrationDismissed) return;

		this.onDismissCelebration();
	}

	onCloseSettingsDialog() {
		this.setState({
			settingsOpen: false,
		});
	}

	setWon(on) {
		this.setState(function (prevState) {
			return {
				won: on,
				celebrationDismissed: on ? false : prevState.celebrationDismissed,
			};
		})
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
		this.setState(function (prevState) {
			return {
				shortMessage: message,
				shortMessageKey: message ? prevState.shortMessageKey + 1 : prevState.shortMessageKey,
			};
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
		this.setState({
			tileset: this.props.tilesets[tileset],
			tilesetKey: tileset,
		});
	}

	setTilesize(tilesize) {
		this.setState({
			tilesize: this.props.tilesizes[tilesize],
			tilesizeKey: tilesize,
		});
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
		window.addEventListener('keydown', this.onWindowKeyDown);
		this.initialized();
	}

	componentWillUnmount() {
		window.removeEventListener('keydown', this.onWindowKeyDown);
	}

	componentDidUpdate() {
	}

	renderLost() {
		if (!this.state.lost) return;

		return <div className="mj-gameover" />;
	}

	renderFireworks() {
		var won = this.state.won && !this.state.celebrationDismissed;

		if (!won) return;

		return <Fireworks
			className="mj-gameover"
		/>
	}

	renderWinAction() {
		if (!this.state.won || this.state.celebrationDismissed) return;

		return (
			<button
				type="button"
				className="mj-win-action"
				onClick={this.onDismissCelebration.bind(this)}
			>
				Continue
			</button>
		);
	}

	renderMain(canvasClassName) {
		return (
			<CssRect
				className="mj-playfield mj-playfield-frame"
				size="large"
				variant="inset"
			>
				<div className="mj-playfield-stage">
					<Canvas
						className={canvasClassName}
						delegator={this.props.delegator.newDelegator()}
						tiles={this.state.tiles || []}
						onClick={this.onClickTile.bind(this)}
					/>
				</div>
			</CssRect>
		)
	}

	renderGameArea(canvasClassName) {
		return (
			<div className="mj-game-area">
				<div className="mj-left-hud">
					<GameNumberControl
						delegator={this.props.delegator.newDelegator()}
						boardNbr={this.state.boardNbr}
						onShuffle={this.onShuffle.bind(this)}
					/>
				</div>
				{this.renderMain(canvasClassName)}
				<RightHud
					delegator={this.props.delegator.newDelegator()}
					canUndo={this.state.canUndo}
					canRedo={this.state.canRedo}
					isPeeking={this.state.isPeeking}
					isPaused={Boolean(this.state.isPaused)}
					won={this.state.won}
					lost={this.state.lost}
					onRestart={this.onRestart.bind(this)}
					onUndo={this.onUndo.bind(this)}
					onRedo={this.onRedo.bind(this)}
					onHint={this.onHint.bind(this)}
					onPause={this.onPause.bind(this)}
					onPeek={this.onPeek.bind(this)}
					onSettings={this.onSettings.bind(this)}
				/>
			</div>
		)
	}

	renderFrame() {
		return (
			<div className="mj-pretty-frame">
				<div className="frame-top">
					<div className="frame-corner frame-corner-tl"></div>
					<div className="frame-top-edge"></div>
					<div className="frame-corner frame-corner-tr"></div>
				</div>
				<div className="frame-sides">
					<div className="frame-left-edge"></div>
					<div className="frame-right-edge"></div>
				</div>
				<div className="frame-bottom">
					<div className="frame-corner frame-corner-bl"></div>
					<div className="frame-bottom-edge"></div>
					<div className="frame-corner frame-corner-br"></div>
				</div>
			</div>
		)
	}

	renderTransientToast() {
		return (
			<Toast
				message={this.state.shortMessage}
				messageKey={this.state.shortMessageKey}
			/>
		);
	}

	renderSettingsDialog() {
		return (
			<SettingsDialog
				open={this.state.settingsOpen}
				layout={this.state.layout}
				layouts={this.props.layouts}
				tileset={this.state.tilesetKey}
				tilesets={this.props.tilesets}
				tilesize={this.state.tilesizeKey}
				tilesizes={this.props.tilesizes}
				allowedTilesizes={this.state.allowedTilesizes}
				maxTileSize={this.state.maxTileSize}
				onSelectLayout={this.onSelectLayout.bind(this)}
				onSelectTileset={this.onSelectTileset.bind(this)}
				onSelectTilesize={this.onSelectTilesize.bind(this)}
				onPlay={this.onPlay.bind(this)}
				onClose={this.onCloseSettingsDialog.bind(this)}
			/>
		);
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
		pageClassName += this.state.isBelowMinimum ? ' mj-below-minimum' : '';
		var frameClassName = 'mj-frame-shell';

		if (this.state.isBelowMinimum) {
			frameClassName += ' mj-below-minimum';
		}

		return (
			<Page serviceName={this.props.serviceName} className={pageClassName}>
				<div className={frameClassName}>
					{this.renderGameArea(className)}
					{this.renderFrame()}
					{this.renderTransientToast()}
					{this.renderFireworks()}
					{this.renderWinAction()}
					{this.renderLost()}
					{this.renderSettingsDialog()}
				</div>
			</Page>
		)
	}
}
