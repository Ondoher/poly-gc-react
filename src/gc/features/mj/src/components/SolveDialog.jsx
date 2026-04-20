import React from "react";
import Canvas from "./Canvas.jsx";
import ModalDialog from "./ModalDialog.jsx";
import SettingsButton from "./SettingsButton.jsx";
import layouts from "../data/layouts.js";
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
			boardScale: 1,
			stepPairIndex: 0,
			highlightedTileIds: [],
			isAnimatingStep: false,
		};

		this.delegator = new SolveDialogDelegator();
		this.boardStageRef = React.createRef();
		this.syncBoardScale = this.syncBoardScale.bind(this);
		this.onBackStep = this.onBackStep.bind(this);
		this.onNextStep = this.onNextStep.bind(this);
	}

	componentDidMount() {
		this.syncBoardFromProps();
		this.attachBoardStageObserver();
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

		if (!prevProps.open && this.props.open) {
			this.syncBoardScale();
		}
	}

	componentWillUnmount() {
		this.detachBoardStageObserver();
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

	createVisibleTilesFromEngine(engine, highlightedTileIds = []) {
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
				highlight: highlighted.has(idx),
			});
			return tiles;
		}, []);
	}

	syncBoardFromProps() {
		if (!this.props.boardNbr || !this.props.layout) {
			this.setState({
				tiles: [],
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
			stepPairIndex: 0,
			highlightedTileIds: [],
			isAnimatingStep: false,
		}, this.syncBoardScale);
	}

	onBackStep() {
		if (!this.engine || this.state.stepPairIndex <= 0 || this.state.isAnimatingStep) return;

		this.engine.undo();
		this.setState({
			tiles: this.createVisibleTilesFromEngine(this.engine),
			stepPairIndex: this.state.stepPairIndex - 1,
			highlightedTileIds: [],
		}, this.syncBoardScale);
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
				tiles: this.createVisibleTilesFromEngine(this.engine, [tile1, tile2]),
				highlightedTileIds: [tile1, tile2],
				isAnimatingStep: true,
			}, function() {
				window.setTimeout(resolve, 500);
			});
		}.bind(this));

		this.engine.playPair(tile1, tile2);
		this.setState({
			tiles: this.createVisibleTilesFromEngine(this.engine),
			stepPairIndex: pairIndex + 1,
			highlightedTileIds: [],
			isAnimatingStep: false,
		}, this.syncBoardScale);
	}

	attachBoardStageObserver() {
		if (typeof ResizeObserver === "undefined") {
			window.addEventListener("resize", this.syncBoardScale);
			return;
		}

		this.boardStageObserver = new ResizeObserver(this.syncBoardScale);

		if (this.boardStageRef.current) {
			this.boardStageObserver.observe(this.boardStageRef.current);
		}

		window.addEventListener("resize", this.syncBoardScale);
	}

	detachBoardStageObserver() {
		if (this.boardStageObserver) {
			this.boardStageObserver.disconnect();
			this.boardStageObserver = null;
		}

		window.removeEventListener("resize", this.syncBoardScale);
	}

	syncBoardScale() {
		if (!this.boardStageRef.current) return;

		let bounds = this.boardStageRef.current.getBoundingClientRect();
		let availableWidth = Math.max(bounds.width - 52, 0);
		let availableHeight = Math.max(bounds.height - 20, 0);
		let scale = Math.min(availableWidth / 439, availableHeight / 353, 1);

		if (!Number.isFinite(scale) || scale <= 0) {
			scale = 1;
		}

		this.setState(function(prevState) {
			if (Math.abs(prevState.boardScale - scale) < 0.01) {
				return null;
			}

			return {
				boardScale: scale,
			};
		});
	}

	render() {
		if (!this.props.open) return null;

		let totalPairs = Math.floor((this.solution || []).length / 2);
		let canStepBack = this.state.stepPairIndex > 0 && !this.state.isAnimatingStep;
		let canStepForward = this.state.stepPairIndex < totalPairs && !this.state.isAnimatingStep;
		let backClassName = "mj-solve-dialog-nav-button";
		let nextClassName = "mj-solve-dialog-nav-button";

		if (!canStepBack) {
			backClassName += " is-disabled";
		}

		if (!canStepForward) {
			nextClassName += " is-disabled";
		}

		return (
			<ModalDialog
				open={this.props.open}
				className="mj-solve-dialog is-spacious"
				panelClassName="mj-solve-dialog-panel"
				bodyClassName="mj-solve-dialog-body"
				closeLabel="Close solve dialog"
				onClose={this.props.onClose}
			>
				<div className="mj-solve-dialog-section">
					<div className="mj-solve-dialog-sidebar">
						<h3 className="mj-solve-dialog-heading">Solution playback</h3>
						<div className="mj-solve-dialog-context">
							<div className="mj-solve-dialog-context-item">
								<span className="mj-solve-dialog-context-label">Game number</span>
								<span className="mj-solve-dialog-context-value">{this.props.boardNbr}</span>
							</div>
							<div className="mj-solve-dialog-context-item">
								<span className="mj-solve-dialog-context-label">Difficulty</span>
								<span className="mj-solve-dialog-context-value">{this.props.difficultyLabel}</span>
							</div>
							<div className="mj-solve-dialog-context-item">
								<span className="mj-solve-dialog-context-label">Layout</span>
								<span className="mj-solve-dialog-context-value">{this.props.layoutTitle}</span>
							</div>
							<div className="mj-solve-dialog-context-item">
								<span className="mj-solve-dialog-context-label">Step</span>
								<span className="mj-solve-dialog-context-value">
									{this.state.stepPairIndex} / {totalPairs}
								</span>
							</div>
						</div>
					</div>
					<div className="mj-solve-dialog-utility-column">
						<div className="mj-solve-dialog-nav-slot">
							<SettingsButton
								className={backClassName}
								onClick={canStepBack ? this.onBackStep : undefined}
							>
								&lt;
							</SettingsButton>
						</div>
					</div>
					<div className="mj-solve-dialog-board-frame mj-css-rect-separator-left">
						<div className="mj-solve-dialog-board-stage" ref={this.boardStageRef}>
							<div
								className="mj-solve-dialog-board-canvas-wrap"
								style={{
									transform: `scale(${this.state.boardScale})`,
								}}
							>
								<Canvas
									className={this.props.boardClassName}
									delegator={this.delegator}
									tiles={this.state.tiles}
								/>
							</div>
						</div>
					</div>
					<div className="mj-solve-dialog-utility-column mj-css-rect-separator-left">
						<div className="mj-solve-dialog-nav-slot">
							<SettingsButton
								className={nextClassName}
								onClick={canStepForward ? this.onNextStep : undefined}
							>
								&gt;
							</SettingsButton>
						</div>
					</div>
				</div>
			</ModalDialog>
		);
	}
}
