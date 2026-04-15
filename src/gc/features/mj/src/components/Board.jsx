import {Fireworks} from '@fireworks-js/react';
import { registry } from "@polylith/core";
import React from "react";
import Page from 'components/Page.jsx'
import Canvas from './Canvas.jsx';
import CssRect from './CssRect.jsx';
import GameNumberControl from './GameNumberControl.jsx';
import RightHud from './RightHud.jsx';
import FeedbackDialog from './FeedbackDialog.jsx';
import SolveDialog from './SolveDialog.jsx';
import StartupConsentDialog from './StartupConsentDialog.jsx';
import SettingsDialog from './SettingsDialog.jsx';
import Toast from './Toast.jsx';
import {
	readMjPreferencesCookie,
	writeMjPreferencesCookie,
} from "../utils/preferencesCookies.js";

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
		var persistedPreferences = this.getPersistedPreferences(props);

		if (props.delegator) {
			props.delegator.delegateInbound(this, [
				'setWon', 'setLost', 'setGameState', 'setMessage',
				'setShortMessage', 'setTiles', 'setTilesize', 'clearBoard',
				'setTileset', 'setTilesize']
			);

			props.delegator.delegateOutbound(this, [
				'select', 'initialized', 'play', 'solve', 'undo', 'redo', 'hint', 'pause', 'peek',
				'selectLayout', 'selectTileset', 'selectTilesize', 'selectDifficulty'
			]);
		}

		this.state = {
			layout: persistedPreferences.layout,
			difficulty: persistedPreferences.difficulty,
			tileset: this.props.tilesets[persistedPreferences.tilesetKey],
			tilesetKey: persistedPreferences.tilesetKey,
			tilesize: this.props.tilesizes[persistedPreferences.tilesizeKey],
			tilesizeKey: persistedPreferences.tilesizeKey,
			allowedTilesizes: this.props.allowedTilesizes || Object.keys(this.props.tilesizes || {}),
			maxTileSize: this.props.maxTileSize || this.props.tilesize,
			isBelowMinimum: Boolean(this.props.isBelowMinimum),
			instance: -1,
			tiles: [],
			message: '',
			shortMessage: '',
			shortMessageKey: 0,
			startupConsentOpen: true,
			telemetryConsent: persistedPreferences.telemetryConsent,
			settingsOpen: false,
			feedbackOpen: false,
			solveOpen: false,
			canUndo: false,
			canRedo: false,
			isPeeking: false,
			isPaused: false,
			won: false,
			celebrationDismissed: false,
			lost: false,
			boardNbr: this.props.boardNbr,
		}
		this.persistedPreferences = persistedPreferences;
		this.trackingModel = registry.subscribe("mj:tracking-model");
		this.feedbackModel = registry.subscribe("mj:feedback-model");
		this.tiles = [];
		this.hasStartedGame = false;
		this.onWindowKeyDown = this.onWindowKeyDown.bind(this);
	}

	getPersistedPreferences(props) {
		var persistedPreferences = readMjPreferencesCookie() || {};
		var allowedTilesizes = props.allowedTilesizes || Object.keys(props.tilesizes || {});
		var persistedLayout = persistedPreferences.layout;
		var persistedDifficulty = persistedPreferences.difficulty;
		var persistedTileset = persistedPreferences.tilesetKey;
		var persistedTilesize = persistedPreferences.tilesizeKey;

		if (!props.layouts || !props.layouts[persistedLayout]) {
			persistedLayout = props.layout;
		}

		if (!props.difficulties || !props.difficulties[persistedDifficulty]) {
			persistedDifficulty = props.difficulty;
		}

		if (!props.tilesets || !props.tilesets[persistedTileset]) {
			persistedTileset = props.tileset;
		}

		if (!persistedTilesize || !allowedTilesizes.includes(persistedTilesize)) {
			persistedTilesize = props.tilesize;
		}

		return {
			layout: persistedLayout,
			difficulty: persistedDifficulty,
			tilesetKey: persistedTileset,
			tilesizeKey: persistedTilesize,
			telemetryConsent: persistedPreferences.telemetryConsent === true,
			hasViewedStartupConsent: persistedPreferences.hasViewedStartupConsent === true,
		};
	}

	applyPersistedSelections() {
		if (
			this.persistedPreferences.layout !== this.props.layout &&
			this.selectLayout
		) {
			this.selectLayout(this.persistedPreferences.layout);
		}

		if (
			this.persistedPreferences.difficulty !== this.props.difficulty &&
			this.selectDifficulty
		) {
			this.selectDifficulty(this.persistedPreferences.difficulty);
		}

		if (
			this.persistedPreferences.tilesetKey !== this.props.tileset &&
			this.selectTileset
		) {
			this.selectTileset(this.persistedPreferences.tilesetKey);
		}

		if (
			this.persistedPreferences.tilesizeKey !== this.props.tilesize &&
			this.selectTilesize
		) {
			this.selectTilesize(this.persistedPreferences.tilesizeKey);
		}
	}

	writePersistedPreferences() {
		writeMjPreferencesCookie({
			hasViewedStartupConsent: !this.state.startupConsentOpen,
			telemetryConsent: this.state.telemetryConsent === true,
			layout: this.state.layout,
			difficulty: this.state.difficulty,
			tilesetKey: this.state.tilesetKey,
			tilesizeKey: this.state.tilesizeKey,
		});
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

	onSolve() {
		this.setState({
			solveOpen: true,
		});
	}

	onLoseDebug() {
		this.setState({
			lost: true,
			won: false,
			celebrationDismissed: false,
		});
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

	onSelectDifficulty(difficulty) {
		if (this.selectDifficulty) {
			this.selectDifficulty(difficulty);
		}

		this.setState({
			difficulty,
		});
	}

	onPeek() {
		if (this.peek) {
			this.peek();
		}
	}

	onSettings() {
		if (this.state.startupConsentOpen) {
			return;
		}

		this.setState({
			settingsOpen: true,
		});
	}

	onFeedback() {
		if (this.state.startupConsentOpen) {
			return;
		}

		this.setState({
			feedbackOpen: true,
		});
	}

	onConfirmStartupConsent(selection) {
		var difficultyChanged = selection.difficulty !== this.state.difficulty;

		if (difficultyChanged) {
			this.onSelectDifficulty(selection.difficulty);
		}

		this.setState({
			startupConsentOpen: false,
			telemetryConsent: selection.telemetryConsent === true,
		}, function() {
			if (!this.hasStartedGame) {
				this.hasStartedGame = true;
				this.initialized();
				return;
			}

			if (difficultyChanged) {
				this.onPlay(-1);
			}
		}.bind(this));
	}

	onSetTelemetryConsent(telemetryConsent) {
		this.setState({
			telemetryConsent,
		});
	}

	onCloseStartupConsent() {
		this.onConfirmStartupConsent({
			telemetryConsent: false,
			difficulty: this.state.difficulty,
		});
	}

	onDismissCelebration() {
		this.setState({
			celebrationDismissed: true,
		});

		this.onPlay(-1);
	}

	onDismissLost() {
		this.setState({
			lost: false,
		});

		this.onPlay(-1);
	}

	onWindowKeyDown(evt) {
		if (evt.key !== 'Escape') return;
		if (this.state.startupConsentOpen) {
			this.onCloseStartupConsent();
			return;
		}
		if (this.state.feedbackOpen) {
			this.onCloseFeedbackDialog();
			return;
		}
		if (this.state.solveOpen) {
			this.onCloseSolveDialog();
			return;
		}
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

	onCloseFeedbackDialog() {
		this.setState({
			feedbackOpen: false,
		});
	}

	onCloseSolveDialog() {
		this.setState({
			solveOpen: false,
		});
	}

	async onSubmitFeedback(feedback) {
		var difficulty = this.props.difficulties[this.state.difficulty];
		var layout = this.props.layouts[this.state.layout];
		var canIncludeContext = Boolean(
			this.trackingModel &&
			this.trackingModel.hasFeedbackContext &&
			this.trackingModel.hasFeedbackContext()
		);
		var payload = {
			boardNbr: Number.isFinite(Number(this.state.boardNbr))
				? Number(this.state.boardNbr)
				: null,
			difficultyLabel: difficulty ? difficulty.label : this.state.difficulty,
			layoutTitle: layout ? layout.title : this.state.layout,
			includeContext: canIncludeContext && feedback.includeContext === true,
			skillLevel: feedback.skillLevel || "",
			difficultyFeeling: feedback.difficultyFeeling || "",
			fairnessFeeling: feedback.fairnessFeeling || "",
			comment: feedback.comment || "",
		};

		if (
			payload.includeContext &&
			this.trackingModel &&
			this.trackingModel.getFeedbackContextSnapshot
		) {
			payload.context = this.trackingModel.getFeedbackContextSnapshot();
		}

		if (!this.feedbackModel || !this.feedbackModel.submit) {
			this.setShortMessage("Feedback is unavailable right now.");
			return;
		}

		let result = await this.feedbackModel.submit(payload);

		if (result && result.success) {
			this.setShortMessage("Thanks for the feedback.");
			this.onCloseFeedbackDialog();
			return;
		}

		this.setShortMessage("Unable to send feedback right now.");
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
		this.applyPersistedSelections();
	}

	componentWillUnmount() {
		window.removeEventListener('keydown', this.onWindowKeyDown);
	}

	componentDidUpdate(prevProps, prevState) {
		if (
			prevState.startupConsentOpen !== this.state.startupConsentOpen ||
			prevState.telemetryConsent !== this.state.telemetryConsent ||
			prevState.layout !== this.state.layout ||
			prevState.difficulty !== this.state.difficulty ||
			prevState.tilesetKey !== this.state.tilesetKey ||
			prevState.tilesizeKey !== this.state.tilesizeKey
		) {
			this.writePersistedPreferences();
		}
	}

	renderLost() {
		if (!this.state.lost) return;

		return (
			<Toast
				modal={true}
				visible={true}
				message="No more moves. Game over."
				onClose={this.onDismissLost.bind(this)}
			/>
		);
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
						difficulty={this.state.difficulty}
						difficulties={this.props.difficulties}
						onShuffle={this.onShuffle.bind(this)}
						onSolve={this.onSolve.bind(this)}
						onLoseDebug={this.onLoseDebug.bind(this)}
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
					onFeedback={this.onFeedback.bind(this)}
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

	renderStartupConsentDialog() {
		return (
			<StartupConsentDialog
				open={this.state.startupConsentOpen}
				difficulty={this.state.difficulty}
				difficulties={this.props.difficulties}
				telemetryConsent={this.state.telemetryConsent}
				onClose={this.onCloseStartupConsent.bind(this)}
				onConfirm={this.onConfirmStartupConsent.bind(this)}
			/>
		);
	}

	renderSettingsDialog() {
		return (
			<SettingsDialog
				open={this.state.settingsOpen}
				layout={this.state.layout}
				layouts={this.props.layouts}
				difficulty={this.state.difficulty}
				difficulties={this.props.difficulties}
				tileset={this.state.tilesetKey}
				tilesets={this.props.tilesets}
				tilesize={this.state.tilesizeKey}
				tilesizes={this.props.tilesizes}
				allowedTilesizes={this.state.allowedTilesizes}
				maxTileSize={this.state.maxTileSize}
				telemetryConsent={this.state.telemetryConsent}
				onSelectLayout={this.onSelectLayout.bind(this)}
				onSelectDifficulty={this.onSelectDifficulty.bind(this)}
				onSelectTileset={this.onSelectTileset.bind(this)}
				onSelectTilesize={this.onSelectTilesize.bind(this)}
				onSetTelemetryConsent={this.onSetTelemetryConsent.bind(this)}
				onPlay={this.onPlay.bind(this)}
				onClose={this.onCloseSettingsDialog.bind(this)}
			/>
		);
	}

	renderFeedbackDialog() {
		var difficulty = this.props.difficulties[this.state.difficulty];
		var layout = this.props.layouts[this.state.layout];
		var canIncludeContext = Boolean(
			this.trackingModel &&
			this.trackingModel.hasFeedbackContext &&
			this.trackingModel.hasFeedbackContext()
		);

		return (
			<FeedbackDialog
				open={this.state.feedbackOpen}
				boardNbr={this.state.boardNbr}
				difficultyLabel={difficulty ? difficulty.label : this.state.difficulty}
				layoutTitle={layout ? layout.title : this.state.layout}
				canIncludeContext={canIncludeContext}
				onClose={this.onCloseFeedbackDialog.bind(this)}
				onSubmit={this.onSubmitFeedback.bind(this)}
			/>
		);
	}

	renderSolveDialog() {
		var difficulty = this.props.difficulties[this.state.difficulty];
		var layout = this.props.layouts[this.state.layout];
		var boardClassName = `${this.state.tileset.class}-tiny tiny-face tiny-size`;

		return (
			<SolveDialog
				open={this.state.solveOpen}
				boardNbr={this.state.boardNbr}
				layout={this.state.layout}
				layoutTitle={layout ? layout.title : this.state.layout}
				difficulty={this.state.difficulty}
				difficultyLabel={difficulty ? difficulty.label : this.state.difficulty}
				boardClassName={boardClassName}
				onClose={this.onCloseSolveDialog.bind(this)}
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
				</div>
				{this.renderStartupConsentDialog()}
				{this.renderSettingsDialog()}
				{this.renderFeedbackDialog()}
				{this.renderSolveDialog()}
			</Page>
		)
	}
}
