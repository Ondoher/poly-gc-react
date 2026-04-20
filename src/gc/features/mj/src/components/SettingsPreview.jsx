import { registry } from "@polylith/core";
import React from "react";
import { debounce } from "../../../../common/utils.js";
import Canvas from "./Canvas.jsx";
import layouts from "../data/layouts.js";
import { TILE_SETS, TILE_SIZES } from "../data/tilesets.js";
import Engine from "../engine/Engine.js";
import { applyDifficultyPreset } from "../engine/difficultyPresets.js";

class SettingsPreviewDelegator {
	delegateInbound() {}
	freeDelegator() {}
}

class SettingsPreviewDelegatorFactory {
	newDelegator() {
		return new SettingsPreviewDelegator();
	}
}

export default class SettingsPreview extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			tiles: [],
			metricSetId: props.tilesize || "tiny",
			canvasWidth: null,
			canvasHeight: null,
			canvasScale: null,
			boardCanvasWidth: null,
			boardCanvasHeight: null,
			boardCanvasOffsetX: null,
			boardCanvasOffsetY: null,
		};

		this.delegator = new SettingsPreviewDelegatorFactory();
		this.surfaceRef = React.createRef();
		this.layoutScaling = null;
		this.resizeObserver = null;
		this.isUnmounted = false;
		this.runPreviewFitDebounced = debounce(function() {
			if (this.isUnmounted) {
				return;
			}

			this.runPreviewFit();
		}.bind(this), 80, 300);
	}

	componentDidMount() {
		this.isUnmounted = false;
		this.layoutScaling = registry.subscribe("mj:layout-scaling");
		this.buildPreviewTiles();
		this.observePreviewSurface();
		this.schedulePreviewFit();
	}

	componentDidUpdate(prevProps) {
		if (
			prevProps.layout !== this.props.layout ||
			prevProps.difficulty !== this.props.difficulty
		) {
			this.buildPreviewTiles();
			return;
		}

		if (
			prevProps.tileset !== this.props.tileset ||
			prevProps.tilesize !== this.props.tilesize ||
			prevProps.maxTileSize !== this.props.maxTileSize
		) {
			this.schedulePreviewFit();
		}
	}

	componentWillUnmount() {
		this.isUnmounted = true;

		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}
	}

	getLayoutDefinition() {
		if (!this.props.layout) {
			return null;
		}

		if (typeof this.props.layout === "string") {
			return layouts[this.props.layout] || null;
		}

		return this.props.layout;
	}

	buildPreviewTiles() {
		let layout = this.getLayoutDefinition();

		if (!layout) {
			this.setState({
				tiles: [],
			}, this.schedulePreviewFit.bind(this));
			return;
		}

		let engine = new Engine();
		engine.setLayout(layout);
		applyDifficultyPreset(engine, this.props.difficulty);
		engine.generateGame(1);

		let tiles = Array.isArray(engine.board?.pieces)
			? engine.board.pieces.map(function(piece, idx) {
				let {x, y, z} = piece.pos;

				return {
					id: idx,
					x,
					y,
					z,
					face: piece.face,
				};
			})
			: [];

		this.setState({
			tiles,
		}, this.schedulePreviewFit.bind(this));
	}

	observePreviewSurface() {
		if (
			typeof ResizeObserver === "undefined" ||
			!this.surfaceRef.current
		) {
			return;
		}

		this.resizeObserver = new ResizeObserver(function() {
			this.schedulePreviewFit();
		}.bind(this));
		this.resizeObserver.observe(this.surfaceRef.current);
	}

	getAvailableSpace() {
		let surface = this.surfaceRef.current;

		if (!surface) {
			return {
				width: 0,
				height: 0,
			};
		}

		return {
			width: surface.clientWidth || 0,
			height: surface.clientHeight || 0,
		};
	}

	getScaleConfig() {
		return {
			positions: this.state.tiles.map(function(tile) {
				return {
					x: tile.x,
					y: tile.y,
					z: tile.z,
				};
			}),
			sizeNames: Object.keys(TILE_SIZES),
			availableSpace: this.getAvailableSpace(),
		};
	}

	runPreviewFit() {
		if (!this.layoutScaling || typeof this.layoutScaling.getDebugState !== "function") {
			return;
		}

		let result = this.layoutScaling.getDebugState(this.getScaleConfig());
		let metricSetId = result?.selectedFit?.metricSetId || this.props.tilesize || "tiny";
		let layoutPixelSize = result?.layoutPixelSize || null;
		let tileMetrics = result?.selectedFit?.tileMetrics || null;
		let boardPixelCenter = result?.selectedFit?.boardPixelCenter || null;
		let canvasWidth = Number.isFinite(layoutPixelSize?.width)
			? layoutPixelSize.width
			: this.state.canvasWidth;
		let canvasHeight = Number.isFinite(layoutPixelSize?.height)
			? layoutPixelSize.height
			: this.state.canvasHeight;
		let canvasScale = Number.isFinite(result?.scale)
			? result.scale
			: this.state.canvasScale;
		let boardCanvasWidth = Number.isFinite(tileMetrics?.canvasWidth)
			? tileMetrics.canvasWidth
			: canvasWidth;
		let boardCanvasHeight = Number.isFinite(tileMetrics?.canvasHeight)
			? tileMetrics.canvasHeight
			: canvasHeight;
		let fallbackBoardCanvasOffsetX =
			Number.isFinite(canvasWidth) && Number.isFinite(boardCanvasWidth)
				? (canvasWidth - boardCanvasWidth) / 2
				: this.state.boardCanvasOffsetX;
		let fallbackBoardCanvasOffsetY =
			Number.isFinite(canvasHeight) && Number.isFinite(boardCanvasHeight)
				? (canvasHeight - boardCanvasHeight) / 2
				: this.state.boardCanvasOffsetY;
		let boardCanvasOffsetX =
			Number.isFinite(canvasWidth) && Number.isFinite(boardPixelCenter?.x)
				? (canvasWidth / 2) - boardPixelCenter.x
				: fallbackBoardCanvasOffsetX;
		let boardCanvasOffsetY =
			Number.isFinite(canvasHeight) && Number.isFinite(boardPixelCenter?.y)
				? (canvasHeight / 2) - boardPixelCenter.y
				: fallbackBoardCanvasOffsetY;

		if (
			metricSetId !== this.state.metricSetId ||
			canvasWidth !== this.state.canvasWidth ||
			canvasHeight !== this.state.canvasHeight ||
			canvasScale !== this.state.canvasScale ||
			boardCanvasWidth !== this.state.boardCanvasWidth ||
			boardCanvasHeight !== this.state.boardCanvasHeight ||
			boardCanvasOffsetX !== this.state.boardCanvasOffsetX ||
			boardCanvasOffsetY !== this.state.boardCanvasOffsetY
		) {
			this.setState({
				metricSetId,
				canvasWidth,
				canvasHeight,
				canvasScale,
				boardCanvasWidth,
				boardCanvasHeight,
				boardCanvasOffsetX,
				boardCanvasOffsetY,
			});
		}
	}

	schedulePreviewFit() {
		this.runPreviewFitDebounced();
	}

	getTilesetClass() {
		let tileset = TILE_SETS[this.props.tileset];
		return tileset?.class || "ivory";
	}

	getCanvasClassName() {
		let metricSetId = this.state.metricSetId || this.props.tilesize || "tiny";

		return [
			`${this.getTilesetClass()}-${metricSetId}`,
			`${metricSetId}-face`,
			`${metricSetId}-size`,
			"mj-settings-dialog-preview-canvas",
		].join(" ");
	}

	getPreviewStyle() {
		let style = {};

		if (Number.isFinite(this.state.canvasWidth) && this.state.canvasWidth > 0) {
			style["--mj-settings-preview-canvas-width"] = `${this.state.canvasWidth}px`;
		}

		if (Number.isFinite(this.state.canvasHeight) && this.state.canvasHeight > 0) {
			style["--mj-settings-preview-canvas-height"] = `${this.state.canvasHeight}px`;
		}

		if (Number.isFinite(this.state.canvasScale) && this.state.canvasScale > 0) {
			style["--mj-settings-preview-canvas-scale"] = `${this.state.canvasScale}`;
		}

		if (Number.isFinite(this.state.boardCanvasWidth) && this.state.boardCanvasWidth > 0) {
			style["--mj-settings-preview-board-canvas-width"] = `${this.state.boardCanvasWidth}px`;
		}

		if (Number.isFinite(this.state.boardCanvasHeight) && this.state.boardCanvasHeight > 0) {
			style["--mj-settings-preview-board-canvas-height"] = `${this.state.boardCanvasHeight}px`;
		}

		if (Number.isFinite(this.state.boardCanvasOffsetX)) {
			style["--mj-settings-preview-board-canvas-offset-x"] = `${this.state.boardCanvasOffsetX}px`;
		}

		if (Number.isFinite(this.state.boardCanvasOffsetY)) {
			style["--mj-settings-preview-board-canvas-offset-y"] = `${this.state.boardCanvasOffsetY}px`;
		}

		return style;
	}

	render() {
		let hasPreview = this.state.tiles.length > 0;

		return (
			<div className="mj-settings-dialog-preview" style={this.getPreviewStyle()}>
				<div className="mj-settings-dialog-preview-surface" ref={this.surfaceRef}>
					{hasPreview ? (
						<div className="mj-settings-dialog-preview-scale-box">
							<div className="mj-settings-dialog-preview-viewport">
								<div className="mj-settings-dialog-preview-board-offset">
									<Canvas
										className={this.getCanvasClassName()}
										delegator={this.delegator}
										tiles={this.state.tiles}
									/>
								</div>
							</div>
						</div>
					) : (
						<div className="mj-settings-dialog-placeholder">
							Layout preview
						</div>
					)}
				</div>
			</div>
		);
	}
}
