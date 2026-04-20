import { registry } from "@polylith/core";
import { Fireworks } from "@fireworks-js/react";
import React from "react";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import Canvas from "./Canvas.jsx";
import CssRect from "./CssRect.jsx";
import FeedbackButton from "./FeedbackButton.jsx";
import FeedbackDialog from "./FeedbackDialog.jsx";
import HelpDialog from "./HelpDialog.jsx";
import LeftHud from "./LeftHud.jsx";
import MainBorder from "./MainBorder.jsx";
import MultiUndoDialog from "./MultiUndoDialog.jsx";
import Page from 'components/Page.jsx'
import RightHud from "./RightHud.jsx";
import SettingsDialog from "./SettingsDialog.jsx";
import SolveDialog from "./SolveDialog.jsx";
import StartupConsentDialog from "./StartupConsentDialog.jsx";
import Toast from "./Toast.jsx";
import { debounce } from "../../../../common/utils.js";
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
				'select', 'deselect', 'initialized', 'play', 'restart', 'solve', 'playHalfSolution', 'undo', 'redo', 'hint', 'pause', 'peek',
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
			placed: null,
			message: '',
			shortMessage: '',
			shortMessageKey: 0,
			startupConsentOpen: !persistedPreferences.hasViewedStartupConsent,
			telemetryConsent: persistedPreferences.telemetryConsent,
			settingsOpen: false,
			helpOpen: false,
			feedbackOpen: false,
			solveOpen: false,
			multiUndoOpen: false,
			multiUndoHistory: [],
			isExpanded: false,
			canUndo: false,
			canRedo: false,
			isHinting: false,
			isPeeking: false,
			isPaused: false,
			won: false,
			showFireworks: false,
			celebrationDismissed: false,
			lost: false,
			isFailureAnimating: false,
			isGenerating: false,
			shellToastOpen: false,
			isShellPortrait: this.getIsShellPortrait(),
			boardNbr: this.props.boardNbr,
			autoMetricSetId: persistedPreferences.tilesizeKey || this.props.tilesize || "tiny",
			autoCanvasWidth: null,
			autoCanvasHeight: null,
			autoCanvasScale: null,
			autoBoardCanvasWidth: null,
			autoBoardCanvasHeight: null,
			autoBoardCanvasOffsetX: null,
			autoBoardCanvasOffsetY: null,
		}
		this.persistedPreferences = persistedPreferences;
		this.trackingModel = null;
		this.feedbackModel = null;
		this.layoutScaling = null;
		this.tiles = [];
		this.hasStartedGame = false;
		this.playfieldViewportRef = React.createRef();
		this.playfieldRef = React.createRef();
		this.isUnmounted = false;
		this.runAutoRescaleDebounced = debounce(function(reason) {
			if (this.isUnmounted) {
				return;
			}

			this.runAutoRescale(reason);
		}.bind(this), 80, 300);
		this.autoRescaleSettledTimer = null;
		this.onWindowKeyDown = this.onWindowKeyDown.bind(this);
		this.onShellViewportChange = this.onShellViewportChange.bind(this);
		this.fireworksTimer = null;
		this.failureAnimationTimer = null;
		this.generateAnimationTimer = null;
		this.shellPortraitMediaQuery = null;
	}

	getIsShellPortrait() {
		if (typeof window === "undefined" || !window.matchMedia) {
			return false;
		}

		return window.matchMedia("(orientation: portrait) and (max-width: 900px)").matches;
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

	onClickCanvas(evt) {
		if (evt?.target !== evt?.currentTarget) {
			return;
		}

		if (this.deselect) {
			this.deselect();
		}
	}

	onClickPlayfieldBackground(evt) {
		if (evt?.target?.closest?.('.mj-playfield-expand-button')) {
			return;
		}

		if (this.deselect) {
			this.deselect();
		}
	}

	onPlay(boardNbr) {
		if (this.play) {
			this.play(boardNbr);
		}
	}

	onRestart() {
		if (this.restart) {
			this.restart();
			return;
		}

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

	onShowMultiUndoPreview() {
		this.setState({
			multiUndoOpen: true,
		});
	}

	onPlayHalfSolution() {
		if (this.playHalfSolution) {
			this.playHalfSolution();
		}
	}

	onToggleExpanded() {
		var nextIsExpanded = !this.state.isExpanded;

		this.setState(function(prevState) {
			return {
				isExpanded: !prevState.isExpanded,
			};
		}, function() {
			this.scheduleSettledAutoRescale(nextIsExpanded ? "toggle-expanded" : "toggle-contracted");
		}.bind(this));
	}

	onShellPlayfieldClick(evt) {
		if (evt?.target?.closest?.('.mj-shell-expand-box')) {
			return;
		}

		if (this.state.isExpanded) {
			this.setState({
				isExpanded: false,
			}, function() {
				this.scheduleSettledAutoRescale("toggle-contracted");
			}.bind(this));
		}
	}

	onToggleShellToast() {
		this.setState(function(prevState) {
			return {
				shellToastOpen: !prevState.shellToastOpen,
			};
		});
	}

	onDismissShellToast() {
		this.setState({
			shellToastOpen: false,
		});
	}

	onApplyMultiUndo(moveNumber) {
		var historyLength = this.state.multiUndoHistory.length;
		var targetMoveNumber = Number(moveNumber);

		if (!Number.isFinite(targetMoveNumber) || targetMoveNumber < 1 || targetMoveNumber > historyLength) {
			return;
		}

		var undoCount = historyLength - targetMoveNumber + 1;

		for (let index = 0; index < undoCount; index++) {
			if (this.undo) {
				this.undo();
			}
		}

		this.setState({
			multiUndoOpen: false,
		});
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

	onHelp() {
		if (this.state.startupConsentOpen) {
			return;
		}

		this.setState({
			helpOpen: true,
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
	}

	onShellViewportChange() {
		var isShellPortrait = this.getIsShellPortrait();
		var reason = this.state.isShellPortrait === isShellPortrait
			? "resize"
			: (isShellPortrait ? "switch-portrait-mode" : "switch-landscape-mode");

		this.setState(function(prevState) {
			if (prevState.isShellPortrait === isShellPortrait) {
				return null;
			}

			return {
				isShellPortrait: isShellPortrait,
				isExpanded: isShellPortrait ? false : prevState.isExpanded,
			};
		}, function() {
			this.scheduleSettledAutoRescale(reason);
		}.bind(this));
	}

	getAvailableCanvasSpace() {
		let viewport = this.playfieldViewportRef?.current;

		if (!viewport) {
			return {
				width: 0,
				height: 0,
			};
		}

		return {
			width: viewport.clientWidth || 0,
			height: viewport.clientHeight || 0,
		};
	}

	getCanvasScalePadding() {
		let playfield = this.playfieldRef?.current;

		if (!playfield || typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
			return {
				left: 0,
				right: 0,
				top: 0,
				bottom: 0,
			};
		}

		let styles = window.getComputedStyle(playfield);
		let sidePadding = parseFloat(styles.getPropertyValue("--mj-shell-canvas-min-side-padding")) || 0;
		let topPadding = parseFloat(styles.getPropertyValue("--mj-shell-canvas-min-top-padding")) || 0;
		let bottomPadding = parseFloat(styles.getPropertyValue("--mj-shell-canvas-min-bottom-padding")) || 0;

		return {
			left: sidePadding,
			right: sidePadding,
			top: topPadding,
			bottom: bottomPadding,
		};
	}

	getCanvasScaleConfig() {
		var visibleTiles = this.getVisibleTiles();

		return {
			positions: visibleTiles.map(function(tile) {
				return {
					x: tile.x,
					y: tile.y,
					z: tile.z,
				};
			}),
			sizeNames: Array.isArray(this.state.allowedTilesizes) && this.state.allowedTilesizes.length > 0
				? this.state.allowedTilesizes
				: Object.keys(this.props.tilesizes || {}),
			availableSpace: this.getAvailableCanvasSpace(),
			padding: this.getCanvasScalePadding(),
		};
	}

	runAutoRescale(reason) {
		if (!this.layoutScaling || typeof this.layoutScaling.getDebugState !== "function") {
			return;
		}

		let config = this.getCanvasScaleConfig();
		let result = this.layoutScaling.getDebugState(config);
		let nextMetricSetId = result?.selectedFit?.metricSetId || this.state.autoMetricSetId || "tiny";
		let nextLayoutPixelSize = result?.layoutPixelSize || null;
		let nextTileMetrics = result?.selectedFit?.tileMetrics || null;
		let nextBoardPixelCenter = result?.selectedFit?.boardPixelCenter || null;
		let nextLayoutWidth = Number.isFinite(nextLayoutPixelSize?.width)
			? nextLayoutPixelSize.width
			: this.state.autoCanvasWidth;
		let nextLayoutHeight = Number.isFinite(nextLayoutPixelSize?.height)
			? nextLayoutPixelSize.height
			: this.state.autoCanvasHeight;
		let nextCanvasWidth = nextLayoutWidth;
		let nextCanvasHeight = nextLayoutHeight;
		let nextCanvasScale = Number.isFinite(result?.scale)
			? result.scale
			: this.state.autoCanvasScale;
		let nextBoardCanvasWidth = Number.isFinite(nextTileMetrics?.canvasWidth)
			? nextTileMetrics.canvasWidth
			: nextCanvasWidth;
		let nextBoardCanvasHeight = Number.isFinite(nextTileMetrics?.canvasHeight)
			? nextTileMetrics.canvasHeight
			: nextCanvasHeight;
		let fallbackBoardCanvasOffsetX =
			Number.isFinite(nextCanvasWidth) && Number.isFinite(nextBoardCanvasWidth)
				? (nextCanvasWidth - nextBoardCanvasWidth) / 2
				: this.state.autoBoardCanvasOffsetX;
		let fallbackBoardCanvasOffsetY =
			Number.isFinite(nextCanvasHeight) && Number.isFinite(nextBoardCanvasHeight)
				? (nextCanvasHeight - nextBoardCanvasHeight) / 2
				: this.state.autoBoardCanvasOffsetY;
		let nextBoardCanvasOffsetX =
			Number.isFinite(nextCanvasWidth) && Number.isFinite(nextBoardPixelCenter?.x)
				? (nextCanvasWidth / 2) - nextBoardPixelCenter.x
				: fallbackBoardCanvasOffsetX;
		let nextBoardCanvasOffsetY =
			Number.isFinite(nextCanvasHeight) && Number.isFinite(nextBoardPixelCenter?.y)
				? (nextCanvasHeight / 2) - nextBoardPixelCenter.y
				: fallbackBoardCanvasOffsetY;

		if (
			nextMetricSetId !== this.state.autoMetricSetId ||
			nextCanvasWidth !== this.state.autoCanvasWidth ||
			nextCanvasHeight !== this.state.autoCanvasHeight ||
			nextCanvasScale !== this.state.autoCanvasScale ||
			nextBoardCanvasWidth !== this.state.autoBoardCanvasWidth ||
			nextBoardCanvasHeight !== this.state.autoBoardCanvasHeight ||
			nextBoardCanvasOffsetX !== this.state.autoBoardCanvasOffsetX ||
			nextBoardCanvasOffsetY !== this.state.autoBoardCanvasOffsetY
		) {
			this.setState({
				autoMetricSetId: nextMetricSetId,
				autoCanvasWidth: nextCanvasWidth,
				autoCanvasHeight: nextCanvasHeight,
				autoCanvasScale: nextCanvasScale,
				autoBoardCanvasWidth: nextBoardCanvasWidth,
				autoBoardCanvasHeight: nextBoardCanvasHeight,
				autoBoardCanvasOffsetX: nextBoardCanvasOffsetX,
				autoBoardCanvasOffsetY: nextBoardCanvasOffsetY,
			});
		}

		console.info("mj:auto-rescale", {
			reason,
			config,
			result,
		});
	}

	scheduleAutoRescale(reason) {
		this.runAutoRescaleDebounced(reason);
	}

	scheduleSettledAutoRescale(reason) {
		this.scheduleAutoRescale(reason);

		if (this.autoRescaleSettledTimer) {
			clearTimeout(this.autoRescaleSettledTimer);
			this.autoRescaleSettledTimer = null;
		}

		this.autoRescaleSettledTimer = setTimeout(function() {
			this.autoRescaleSettledTimer = null;

			if (this.isUnmounted) {
				return;
			}

			this.runAutoRescale(`${reason}:settled`);
		}.bind(this), 220);
	}

	getShellCanvasStyle() {
		let style = {};

		if (Number.isFinite(this.state.autoCanvasWidth) && this.state.autoCanvasWidth > 0) {
			style["--mj-shell-canvas-width"] = `${this.state.autoCanvasWidth}px`;
		}

		if (Number.isFinite(this.state.autoCanvasHeight) && this.state.autoCanvasHeight > 0) {
			style["--mj-shell-canvas-height"] = `${this.state.autoCanvasHeight}px`;
		}

		if (Number.isFinite(this.state.autoCanvasScale) && this.state.autoCanvasScale > 0) {
			style["--mj-shell-canvas-scale"] = `${this.state.autoCanvasScale}`;
		}

		if (Number.isFinite(this.state.autoBoardCanvasWidth) && this.state.autoBoardCanvasWidth > 0) {
			style["--mj-shell-board-canvas-width"] = `${this.state.autoBoardCanvasWidth}px`;
		}

		if (Number.isFinite(this.state.autoBoardCanvasHeight) && this.state.autoBoardCanvasHeight > 0) {
			style["--mj-shell-board-canvas-height"] = `${this.state.autoBoardCanvasHeight}px`;
		}

		if (Number.isFinite(this.state.autoBoardCanvasOffsetX)) {
			style["--mj-shell-board-canvas-offset-x"] = `${this.state.autoBoardCanvasOffsetX}px`;
		}

		if (Number.isFinite(this.state.autoBoardCanvasOffsetY)) {
			style["--mj-shell-board-canvas-offset-y"] = `${this.state.autoBoardCanvasOffsetY}px`;
		}

		return style;
	}

	getVisibleTiles() {
		if (!Array.isArray(this.state.tiles)) {
			return [];
		}

		if (!this.state.placed || typeof this.state.placed.has !== "function") {
			return this.state.tiles;
		}

		return this.state.tiles.filter(function(tile) {
			return this.state.placed.has(tile.id);
		}, this);
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
		if (this.state.helpOpen) {
			this.onCloseHelpDialog();
			return;
		}
		if (this.state.solveOpen) {
			this.onCloseSolveDialog();
			return;
		}
		if (this.state.multiUndoOpen) {
			this.onCloseMultiUndoDialog();
			return;
		}
		if (this.state.settingsOpen) {
			this.onCloseSettingsDialog();
			return;
		}
		if (this.state.isExpanded) {
			this.onToggleExpanded();
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

	onCloseHelpDialog() {
		this.setState({
			helpOpen: false,
		});
	}

	onCloseSolveDialog() {
		this.setState({
			solveOpen: false,
		});
	}

	onCloseMultiUndoDialog() {
		this.setState({
			multiUndoOpen: false,
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
		var feedbackContext = null;
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
			feedbackContext = this.trackingModel.getFeedbackContextSnapshot();
			payload.context = feedbackContext;
		}

		if (
			payload.includeContext &&
			feedbackContext &&
			this.feedbackModel &&
			this.feedbackModel.getTelemetryReference
		) {
			payload.telemetryId = this.feedbackModel.getTelemetryReference(feedbackContext);
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
				showFireworks: on ? prevState.showFireworks : false,
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
		this.setState(function(prevState) {
			return {
				...state,
				multiUndoHistory: state.multiUndoHistory || prevState.multiUndoHistory,
			};
		});
	}

	startFailureAnimation() {
		this.clearFailureAnimationTimer();
		this.setState({
			isFailureAnimating: true,
		});
		this.failureAnimationTimer = setTimeout(function() {
			this.failureAnimationTimer = null;
			this.setState({
				isFailureAnimating: false,
			});
		}.bind(this), this.props.timings.failureAnimation);
	}

	clearFailureAnimationTimer() {
		if (!this.failureAnimationTimer) return;

		clearTimeout(this.failureAnimationTimer);
		this.failureAnimationTimer = null;
	}

	startGenerateAnimation() {
		this.clearGenerateAnimationTimer();
		this.setState({
			isGenerating: true,
		});
		this.generateAnimationTimer = setTimeout(function() {
			this.generateAnimationTimer = null;
			this.setState({
				isGenerating: false,
			});
		}.bind(this), this.props.timings.tile.restart);
	}

	clearGenerateAnimationTimer() {
		if (!this.generateAnimationTimer) return;

		clearTimeout(this.generateAnimationTimer);
		this.generateAnimationTimer = null;
	}

	setTiles (instance, tiles) {
		this.setState({
			instance: instance,
			tiles: tiles,
			placed: null
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
		this.isUnmounted = false;
		this.trackingModel = registry.subscribe("mj:tracking-model");
		this.feedbackModel = registry.subscribe("mj:feedback-model");
		this.layoutScaling = registry.subscribe("mj:layout-scaling");

		window.addEventListener('keydown', this.onWindowKeyDown);
		window.addEventListener('resize', this.onShellViewportChange);
		this.shellPortraitMediaQuery = window.matchMedia
			? window.matchMedia("(orientation: portrait) and (max-width: 900px)")
			: null;

		if (this.shellPortraitMediaQuery) {
			if (this.shellPortraitMediaQuery.addEventListener) {
				this.shellPortraitMediaQuery.addEventListener("change", this.onShellViewportChange);
			} else if (this.shellPortraitMediaQuery.addListener) {
				this.shellPortraitMediaQuery.addListener(this.onShellViewportChange);
			}
		}

		this.onShellViewportChange();
		this.applyPersistedSelections();

		if (!this.state.startupConsentOpen && !this.hasStartedGame) {
			this.hasStartedGame = true;
			this.initialized();
		}

		this.scheduleAutoRescale("start");
	}

	componentWillUnmount() {
		this.isUnmounted = true;

		if (this.fireworksTimer) {
			clearTimeout(this.fireworksTimer);
			this.fireworksTimer = null;
		}

		if (this.autoRescaleSettledTimer) {
			clearTimeout(this.autoRescaleSettledTimer);
			this.autoRescaleSettledTimer = null;
		}

		this.clearFailureAnimationTimer();
		this.clearGenerateAnimationTimer();

		window.removeEventListener('keydown', this.onWindowKeyDown);

		window.removeEventListener('resize', this.onShellViewportChange);

		if (this.shellPortraitMediaQuery) {
			if (this.shellPortraitMediaQuery.removeEventListener) {
				this.shellPortraitMediaQuery.removeEventListener("change", this.onShellViewportChange);
			} else if (this.shellPortraitMediaQuery.removeListener) {
				this.shellPortraitMediaQuery.removeListener(this.onShellViewportChange);
			}
			this.shellPortraitMediaQuery = null;
		}
	}

	componentDidUpdate(prevProps, prevState) {
		if (prevState.instance !== this.state.instance && this.state.instance !== -1) {
			this.startGenerateAnimation();
			this.scheduleAutoRescale("generate-game");
		}

		if (!prevState.lost && this.state.lost) {
			this.startFailureAnimation();
		}

		if (prevState.won !== this.state.won || prevState.celebrationDismissed !== this.state.celebrationDismissed) {
			if (this.fireworksTimer) {
				clearTimeout(this.fireworksTimer);
				this.fireworksTimer = null;
			}

			if (this.state.won && !this.state.celebrationDismissed) {
				if (!this.state.showFireworks) {
					this.fireworksTimer = setTimeout(function() {
						this.fireworksTimer = null;
						this.setState({
							showFireworks: true,
						});
					}.bind(this), this.props.timings.fireworksDelay);
				}
			} else if (this.state.showFireworks) {
				this.setState({
					showFireworks: false,
				});
			}
		}

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
				message="No more moves. This board has failed. Use Undo or Move History to continue."
				duration={this.props.timings.toastLong}
			/>
		);
	}

	renderFireworks() {
		if (!this.state.showFireworks || this.state.celebrationDismissed) return;

		return (
			<Fireworks
				className="mj-gameover"
				autostart={true}
			/>
		);
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
		var playfieldWrapClassName = "mj-playfield-wrap";
		var playfieldClassName = "mj-shell-box mj-shell-playfield";
		var expandButtonClassName = "mj-playfield-expand-button mj-shell-expand-box";
		var expandIconClassName = "mj-playfield-expand-button-icon";
		var shellCanvasStyle = this.getShellCanvasStyle();

		if (this.state.isExpanded) {
			playfieldWrapClassName += " is-expanded";
			playfieldClassName += " is-expanded";
			expandButtonClassName += " is-expanded";
		}

		if (this.state.isFailureAnimating) {
			playfieldClassName += " is-failure-animating";
		}

		return (
			<div className={playfieldWrapClassName}>
				<div className="mj-playfield-viewport" ref={this.playfieldViewportRef}>
					<CssRect
						className="mj-shell-playfield-frame-box"
						size="large"
						variant="inset"
						hideChildren={true}
						aria-hidden="true"
					/>
					<div
						className={playfieldClassName}
						ref={this.playfieldRef}
						style={shellCanvasStyle}
						onClick={this.onShellPlayfieldClick.bind(this)}
					>
						{this.renderShellCanvas()}
						{!this.isShellPortrait() ? (
							<button
								type="button"
								className={expandButtonClassName}
								onClick={this.onToggleExpanded.bind(this)}
								aria-label={this.state.isExpanded ? "Contract board" : "Expand board"}
								title={this.state.isExpanded ? "Contract" : "Expand"}
							>
								<span className={expandIconClassName}></span>
							</button>
						) : null}
					</div>
				</div>
			</div>
		)
	}

	renderShellCanvasContent() {
		var tilesetClassName = this.state.tileset?.class || "ivory";
		var metricSetId = this.state.autoMetricSetId || "tiny";
		var boardClassName = `${tilesetClassName}-${metricSetId} ${metricSetId}-face ${metricSetId}-size mj-shell-canvas-box`;

		if (this.state.isGenerating) {
			boardClassName += " is-generating";
		}

		if (this.state.isPaused) {
			boardClassName += " is-paused";
		}

		if (this.state.lost) {
			boardClassName += " is-lost";
		}

		return (
			<div className="mj-shell-canvas-scale-box">
				<div className="mj-shell-layout-viewport">
					<div className="mj-shell-board-canvas-offset">
						<Canvas
							className={boardClassName}
							delegator={this.props.delegator}
							tiles={this.state.tiles}
							placed={this.state.placed}
							timings={this.props.timings.tile}
							onClick={this.onClickTile.bind(this)}
							onCanvasClick={this.onClickCanvas.bind(this)}
						/>
					</div>
				</div>
			</div>
		);
	}

	isShellPortrait() {
		if (typeof window === "undefined" || !window.matchMedia) {
			return false;
		}

		return window.matchMedia("(orientation: portrait) and (max-width: 900px)").matches;
	}

	renderShellCanvas() {
		var enableGestureCanvas = this.state.isExpanded || this.state.isShellPortrait;
		var transformResetKey = [
			this.state.isExpanded ? "expanded" : "normal",
			this.state.isShellPortrait ? "portrait" : "landscape",
			this.state.autoMetricSetId || "unknown",
			Number.isFinite(this.state.autoCanvasWidth) ? this.state.autoCanvasWidth.toFixed(3) : "auto-width",
			Number.isFinite(this.state.autoCanvasHeight) ? this.state.autoCanvasHeight.toFixed(3) : "auto-height",
			Number.isFinite(this.state.autoCanvasScale) ? this.state.autoCanvasScale.toFixed(6) : "auto-scale",
		].join(":");

		if (!enableGestureCanvas) {
			return (
				<div className="mj-shell-canvas-fit-box">
					{this.renderShellCanvasContent()}
				</div>
			);
		}

		return (
			<div className="mj-shell-canvas-fit-box">
				<TransformWrapper
					key={transformResetKey}
					initialScale={1}
					initialPositionX={0}
					initialPositionY={0}
					minScale={1}
					maxScale={2.5}
					centerOnInit={false}
					limitToBounds={true}
					smooth={false}
					doubleClick={{
						disabled: true,
					}}
					wheel={{
						step: 0.12,
					}}
				>
					<TransformComponent
						wrapperClass="mj-shell-canvas-gesture-viewport"
						contentClass="mj-shell-canvas-gesture-surface"
					>
						{this.renderShellCanvasContent()}
					</TransformComponent>
				</TransformWrapper>
			</div>
		);
	}

	renderGameArea(canvasClassName) {
		var gameAreaClassName = "mj-game-area";
		var leftHudClassName = "";

		if (this.state.isExpanded) {
			gameAreaClassName += " is-expanded";
			leftHudClassName = "is-collapsed";
		}

		return (
			<div className={gameAreaClassName}>
				<LeftHud
					className={leftHudClassName}
					delegator={this.props.delegator}
					boardNbr={this.state.boardNbr}
					difficulty={this.state.difficulty}
					difficulties={this.props.difficulties}
					onSolve={this.onSolve.bind(this)}
					onSettings={this.onSettings.bind(this)}
					onHelp={this.onHelp.bind(this)}
					onPlayHalfSolution={this.onPlayHalfSolution.bind(this)}
					onLoseDebug={this.onLoseDebug.bind(this)}
				/>
				{this.renderMain(canvasClassName)}
				<RightHud
					delegator={this.props.delegator}
					isPaused={Boolean(this.state.isPaused)}
					won={Boolean(this.state.won)}
					lost={Boolean(this.state.lost)}
					canUndo={Boolean(this.state.canUndo)}
					canRedo={Boolean(this.state.canRedo)}
					isHinting={Boolean(this.state.isHinting)}
					isPeeking={Boolean(this.state.isPeeking)}
					onPause={this.onPause.bind(this)}
					onRestart={this.onRestart.bind(this)}
					onUndo={this.onUndo.bind(this)}
					onRedo={this.onRedo.bind(this)}
					onShowMultiUndo={this.onShowMultiUndoPreview.bind(this)}
					onHint={this.onHint.bind(this)}
					onPeek={this.onPeek.bind(this)}
					onFeedback={this.onFeedback.bind(this)}
					hideFeedback={true}
				/>
				{!this.state.isExpanded ? (
					<div className="mj-shell-feedback-wrap">
						<FeedbackButton onClick={this.onFeedback.bind(this)} />
					</div>
				) : null}
			</div>
		)
	}

	renderShellOverlay() {
		if (!this.state.shellToastOpen) return null;

		return (
			<div
				className="mj-overlay-layer"
				onClick={this.onDismissShellToast.bind(this)}
			>
				<div className="mj-shell-box mj-shell-toast">
					Toast
				</div>
			</div>
		);
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

	renderHelpDialog() {
		return (
			<HelpDialog
				open={this.state.helpOpen}
				onClose={this.onCloseHelpDialog.bind(this)}
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

	renderMultiUndoDialog() {
		return (
			<MultiUndoDialog
				open={this.state.multiUndoOpen}
				history={this.state.multiUndoHistory}
				boardClassName={`${this.state.tileset.class}-tiny tiny-face tiny-size`}
				onChooseHistoryEntry={this.onApplyMultiUndo.bind(this)}
				onClose={this.onCloseMultiUndoDialog.bind(this)}
			/>
		);
	}

	render() {
		var className = "mj-shell-canvas";

		if (!this.props.delegator) {
			return (
				<h1>Error</h1>
			)
		}
		var won = this.state.won;
		var pageClassName = 'page mj-board-page mj-shell-mode ';
		pageClassName += won ? 'won' : 'not-won';
		pageClassName += this.state.isBelowMinimum ? ' mj-below-minimum' : '';
		pageClassName += this.state.isExpanded ? ' is-expanded' : '';
		var frameClassName = 'mj-frame-shell';

		if (this.state.isBelowMinimum) {
			frameClassName += ' mj-below-minimum';
		}

		if (this.state.isExpanded) {
			frameClassName += ' is-expanded';
		}

		return (
			<Page serviceName={this.props.serviceName} className={pageClassName}>
				<div className="mj-shell-page-stack">
					<div className={frameClassName}>
						<div className="mj-layout-shell">
							{this.renderGameArea(className)}
							{this.renderShellOverlay()}
						</div>
					</div>
					<div className="mj-shell-border-layer" aria-hidden="true">
						<MainBorder className="mj-shell-border-box" />
					</div>
					{this.renderTransientToast()}
					{this.renderLost()}
					{this.renderFireworks()}
					{this.renderWinAction()}
					{this.renderStartupConsentDialog()}
					{this.renderSettingsDialog()}
					{this.renderFeedbackDialog()}
					{this.renderHelpDialog()}
					{this.renderSolveDialog()}
					{this.renderMultiUndoDialog()}
				</div>
			</Page>
		)
	}
}
