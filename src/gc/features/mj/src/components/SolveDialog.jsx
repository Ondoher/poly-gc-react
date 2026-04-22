import React from "react";
import CssRect from "./CssRect.jsx";
import ModalDialog from "./ModalDialog.jsx";
import ScalingCanvas from "./ScalingCanvas.jsx";
import SettingsButton from "./SettingsButton.jsx";
import layouts from "../data/layouts.js";
import { TILE_SIZES } from "../data/tilesets.js";
import Engine from "../engine/Engine.js";
import {
	applyDifficultyPreset,
} from "../engine/difficultyPresets.js";

class SolveDialogDelegator {
	delegateInbound() {}
	delegateOutbound() {}
	freeDelegator() {}
	newDelegator() {
		return new SolveDialogDelegator();
	}
}

export default class SolveDialog extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			tiles: [],
			scaleTiles: [],
			stepPairIndex: 0,
			highlightedTileIds: [],
			isAnimatingStep: false,
		};

		this.delegator = new SolveDialogDelegator();
		this.onBackStep = this.onBackStep.bind(this);
		this.onNextStep = this.onNextStep.bind(this);
	}

	componentDidMount() {
		this.syncBoardFromProps();
	}

	componentDidUpdate(prevProps) {
		if (
			(!prevProps.open && this.props.open) ||
			prevProps.boardNbr !== this.props.boardNbr ||
			prevProps.layout !== this.props.layout ||
			prevProps.difficulty !== this.props.difficulty
		) {
			this.syncBoardFromProps();
		}

	}

	createTilesFromBoard(board) {
		return (board?.pieces || []).map(function(piece, idx) {
			return {
				id: idx,
				x: piece.pos.x,
				y: piece.pos.y,
				z: piece.pos.z,
				face: piece.face,
			};
		});
	}

	createVisibleTilesFromEngine(engine, highlightedTileIds = [], highlightType = 'highlight') {
		if (!engine || !engine.board || !engine.board.pieces) {
			return [];
		}

		let highlighted = new Set(highlightedTileIds);

		return engine.board.pieces.reduce(function(tiles, piece, idx) {
			if (!engine.placedTiles.has(idx)) {
				return tiles;
			}

			tiles.push({
				id: idx,
				x: piece.pos.x,
				y: piece.pos.y,
				z: piece.pos.z,
				face: piece.face,
				highlight: highlighted.has(idx) ? highlightType : false,
			});
			return tiles;
		}, []);
	}

	getSolutionHintAnimationMs() {
		let peekMs = this.props.timings?.tile?.peek || 220;
		let playedMs = this.props.timings?.tile?.played || 180;

		// Match the solve-only CSS: full hint-style pulse sequence, then fade.
		return Math.round((peekMs * 3.4545 * 1.5) + playedMs);
	}

	syncBoardFromProps() {
		if (!this.props.boardNbr || !this.props.layout) {
			this.setState({
				tiles: [],
				scaleTiles: [],
				stepPairIndex: 0,
				highlightedTileIds: [],
				isAnimatingStep: false,
			});
			return;
		}

		let layout = layouts[this.props.layout];

		if (!layout) {
			this.setState({
				tiles: [],
				scaleTiles: [],
				stepPairIndex: 0,
				highlightedTileIds: [],
				isAnimatingStep: false,
			});
			return;
		}

		let engine = new Engine();
		engine.setLayout(layout);
		applyDifficultyPreset(engine, this.props.difficulty);
		engine.generateGame(this.props.boardNbr);
		this.engine = engine;
		this.solution = engine.getSolution ? engine.getSolution() : engine.solution || [];

		this.setState({
			tiles: this.createVisibleTilesFromEngine(engine),
			scaleTiles: this.createTilesFromBoard(engine.board),
			stepPairIndex: 0,
			highlightedTileIds: [],
			isAnimatingStep: false,
		});
	}

	onBackStep() {
		if (!this.engine || this.state.stepPairIndex <= 0 || this.state.isAnimatingStep) return;

		this.engine.undo();
		this.setState({
			tiles: this.createVisibleTilesFromEngine(this.engine),
			stepPairIndex: this.state.stepPairIndex - 1,
			highlightedTileIds: [],
		});
	}

	async onNextStep() {
		if (!this.engine || this.state.isAnimatingStep) return;

		let solution = this.solution || [];
		let pairIndex = this.state.stepPairIndex;
		let tile1 = solution[pairIndex * 2];
		let tile2 = solution[(pairIndex * 2) + 1];

		if (tile1 === undefined || tile2 === undefined) {
			return;
		}

		await new Promise(function(resolve) {
			this.setState({
				tiles: this.createVisibleTilesFromEngine(this.engine, [tile1, tile2], 'solve-hint'),
				highlightedTileIds: [tile1, tile2],
				isAnimatingStep: true,
			}, function() {
				window.setTimeout(resolve, this.getSolutionHintAnimationMs());
			});
		}.bind(this));

		this.engine.playPair(tile1, tile2);
		this.setState({
			tiles: this.createVisibleTilesFromEngine(this.engine),
			stepPairIndex: pairIndex + 1,
			highlightedTileIds: [],
			isAnimatingStep: false,
		});
	}

	getCanvasClassName(metricSetId) {
		let tilesetClassName = this.props.tilesetClassName || "ivory";
		let selectedMetricSetId = metricSetId || this.props.tilesize || "tiny";

		return [
			`${tilesetClassName}-${selectedMetricSetId}`,
			`${selectedMetricSetId}-face`,
			`${selectedMetricSetId}-size`,
		].join(" ");
	}

	getTotalPairs() {
		return Math.floor((this.solution || []).length / 2);
	}

	getStepButtonClassName(isEnabled) {
		let className = "mj-solve-dialog-nav-button";

		if (!isEnabled) {
			className += " is-disabled";
		}

		return className;
	}

	canStepBack() {
		return this.state.stepPairIndex > 0 && !this.state.isAnimatingStep;
	}

	canStepForward() {
		return this.state.stepPairIndex < this.getTotalPairs() && !this.state.isAnimatingStep;
	}

	renderContextItem(label, value) {
		return (
			<div className="mj-solve-dialog-context-item">
				<span className="mj-solve-dialog-context-label">{label}</span>
				<span className="mj-solve-dialog-context-value">{value}</span>
			</div>
		);
	}

	renderSidebar() {
		let totalPairs = this.getTotalPairs();

		return (
			<div className="mj-solve-dialog-sidebar">
				<h3 className="mj-solve-dialog-heading">Solution playback</h3>
				<div className="mj-solve-dialog-context">
					{this.renderContextItem("Game number", this.props.boardNbr)}
					{this.renderContextItem("Difficulty", this.props.difficultyLabel)}
					{this.renderContextItem("Layout", this.props.layoutTitle)}
					{this.renderContextItem("Step", `${this.state.stepPairIndex} / ${totalPairs}`)}
				</div>
			</div>
		);
	}

	renderBackControl() {
		let canStepBack = this.canStepBack();

		return (
			<div className="mj-solve-dialog-utility-column">
				<div className="mj-solve-dialog-nav-slot">
					<SettingsButton
						className={this.getStepButtonClassName(canStepBack)}
						onClick={canStepBack ? this.onBackStep : undefined}
					>
						&lt;
					</SettingsButton>
				</div>
			</div>
		);
	}

	renderBoard() {
		return (
			<div className="mj-solve-dialog-board-frame">
				<CssRect
					className="mj-solve-dialog-board-rect"
					size="large"
					variant="inset"
				>
					<ScalingCanvas
						className="mj-solve-dialog-board-stage"
						cssVarPrefix="mj-solve"
						scaleBoxClassName="mj-solve-dialog-board-canvas-wrap"
						viewportClassName="mj-solve-dialog-board-viewport"
						offsetClassName="mj-solve-dialog-board-offset"
						delegator={this.delegator}
						tiles={this.state.tiles}
						scaleTiles={this.state.scaleTiles}
						sizeNames={
							Array.isArray(this.props.allowedTilesizes) &&
							this.props.allowedTilesizes.length > 0
								? this.props.allowedTilesizes
								: Object.keys(this.props.tilesizes || TILE_SIZES)
						}
						fallbackMetricSetId={this.props.tilesize || "tiny"}
						getCanvasClassName={this.getCanvasClassName.bind(this)}
						timings={this.props.timings?.tile}
					/>
				</CssRect>
			</div>
		);
	}

	renderNextControl() {
		let canStepForward = this.canStepForward();

		return (
			<div className="mj-solve-dialog-utility-column">
				<div className="mj-solve-dialog-nav-slot">
					<SettingsButton
						className={this.getStepButtonClassName(canStepForward)}
						onClick={canStepForward ? this.onNextStep : undefined}
					>
						&gt;
					</SettingsButton>
				</div>
			</div>
		);
	}

	renderContent() {
		return (
			<div className="mj-solve-dialog-section">
				{this.renderSidebar()}
				{this.renderBackControl()}
				{this.renderBoard()}
				{this.renderNextControl()}
			</div>
		);
	}

	render() {
		if (!this.props.open) return null;

		return (
			<ModalDialog
				open={this.props.open}
				className="mj-solve-dialog is-spacious"
				panelClassName="mj-solve-dialog-panel"
				bodyClassName="mj-solve-dialog-body"
				closeLabel="Close solve dialog"
				onClose={this.props.onClose}
			>
				{this.renderContent()}
			</ModalDialog>
		);
	}
}
