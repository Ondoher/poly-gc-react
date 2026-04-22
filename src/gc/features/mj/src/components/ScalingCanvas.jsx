import { registry } from "@polylith/core";
import React from "react";
import { debounce } from "../../../../common/utils.js";
import Canvas from "./Canvas.jsx";
import { TILE_SIZES } from "../data/tilesets.js";

export default class ScalingCanvas extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			metricSetId: props.fallbackMetricSetId || "tiny",
			canvasWidth: null,
			canvasHeight: null,
			canvasScale: null,
			boardCanvasWidth: null,
			boardCanvasHeight: null,
			boardCanvasOffsetX: null,
			boardCanvasOffsetY: null,
		};

		this.containerRef = React.createRef();
		this.layoutScaling = null;
		this.resizeObserver = null;
		this.isUnmounted = false;
		this.scheduleFit = this.scheduleFit.bind(this);
		this.runFitDebounced = debounce(function() {
			if (this.isUnmounted) {
				return;
			}

			this.runFit();
		}.bind(this), 80, 300);
	}

	componentDidMount() {
		this.isUnmounted = false;
		this.layoutScaling = registry.subscribe("mj:layout-scaling");
		this.observeContainer();
		this.scheduleFit();
	}

	componentDidUpdate(prevProps) {
		if (
			prevProps.tiles !== this.props.tiles ||
			prevProps.scaleTiles !== this.props.scaleTiles ||
			prevProps.sizeNames !== this.props.sizeNames ||
			prevProps.fallbackMetricSetId !== this.props.fallbackMetricSetId
		) {
			this.scheduleFit();
		}
	}

	componentWillUnmount() {
		this.isUnmounted = true;

		if (this.resizeObserver) {
			this.resizeObserver.disconnect();
			this.resizeObserver = null;
		}

		if (typeof window !== "undefined") {
			window.removeEventListener("resize", this.scheduleFit);
		}
	}

	observeContainer() {
		if (typeof ResizeObserver !== "undefined" && this.containerRef.current) {
			this.resizeObserver = new ResizeObserver(this.scheduleFit);
			this.resizeObserver.observe(this.containerRef.current);
		}

		if (typeof window !== "undefined") {
			window.addEventListener("resize", this.scheduleFit);
		}
	}

	getAvailableSpace() {
		let container = this.containerRef.current;

		if (!container) {
			return {
				width: 0,
				height: 0,
			};
		}

		let style = typeof window !== "undefined" && typeof window.getComputedStyle === "function"
			? window.getComputedStyle(container)
			: null;
		let horizontalPadding =
			this.toCssPixelNumber(style?.paddingLeft) +
			this.toCssPixelNumber(style?.paddingRight);
		let verticalPadding =
			this.toCssPixelNumber(style?.paddingTop) +
			this.toCssPixelNumber(style?.paddingBottom);

		return {
			width: Math.max((container.clientWidth || 0) - horizontalPadding, 0),
			height: Math.max((container.clientHeight || 0) - verticalPadding, 0),
		};
	}

	toCssPixelNumber(value) {
		let number = parseFloat(value);
		return Number.isFinite(number) ? number : 0;
	}

	getScaleTiles() {
		return Array.isArray(this.props.scaleTiles)
			? this.props.scaleTiles
			: (Array.isArray(this.props.tiles) ? this.props.tiles : []);
	}

	getSizeNames() {
		return Array.isArray(this.props.sizeNames) && this.props.sizeNames.length > 0
			? this.props.sizeNames
			: Object.keys(TILE_SIZES);
	}

	getScaleConfig() {
		return {
			positions: this.getScaleTiles().map(function(tile) {
				return {
					x: tile.x,
					y: tile.y,
					z: tile.z,
				};
			}),
			sizeNames: this.getSizeNames(),
			availableSpace: this.getAvailableSpace(),
		};
	}

	runFit() {
		if (!this.layoutScaling || typeof this.layoutScaling.getDebugState !== "function") {
			return;
		}

		let result = this.layoutScaling.getDebugState(this.getScaleConfig());
		let metricSetId = result?.selectedFit?.metricSetId ||
			this.props.fallbackMetricSetId ||
			this.state.metricSetId ||
			"tiny";
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

		this.setFitState({
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

	setFitState(nextState) {
		if (
			nextState.metricSetId !== this.state.metricSetId ||
			nextState.canvasWidth !== this.state.canvasWidth ||
			nextState.canvasHeight !== this.state.canvasHeight ||
			nextState.canvasScale !== this.state.canvasScale ||
			nextState.boardCanvasWidth !== this.state.boardCanvasWidth ||
			nextState.boardCanvasHeight !== this.state.boardCanvasHeight ||
			nextState.boardCanvasOffsetX !== this.state.boardCanvasOffsetX ||
			nextState.boardCanvasOffsetY !== this.state.boardCanvasOffsetY
		) {
			this.setState(nextState);
		}
	}

	scheduleFit() {
		this.runFitDebounced();
	}

	getCanvasClassName() {
		if (typeof this.props.getCanvasClassName === "function") {
			return this.props.getCanvasClassName(this.state.metricSetId);
		}

		return this.props.canvasClassName || "";
	}

	getStyle() {
		let prefix = this.props.cssVarPrefix || "mj-scaling-canvas";
		let style = {};

		if (Number.isFinite(this.state.canvasWidth) && this.state.canvasWidth > 0) {
			style[`--${prefix}-canvas-width`] = `${this.state.canvasWidth}px`;
		}

		if (Number.isFinite(this.state.canvasHeight) && this.state.canvasHeight > 0) {
			style[`--${prefix}-canvas-height`] = `${this.state.canvasHeight}px`;
		}

		if (Number.isFinite(this.state.canvasScale) && this.state.canvasScale > 0) {
			style[`--${prefix}-canvas-scale`] = `${this.state.canvasScale}`;
		}

		if (Number.isFinite(this.state.boardCanvasWidth) && this.state.boardCanvasWidth > 0) {
			style[`--${prefix}-board-canvas-width`] = `${this.state.boardCanvasWidth}px`;
		}

		if (Number.isFinite(this.state.boardCanvasHeight) && this.state.boardCanvasHeight > 0) {
			style[`--${prefix}-board-canvas-height`] = `${this.state.boardCanvasHeight}px`;
		}

		if (Number.isFinite(this.state.boardCanvasOffsetX)) {
			style[`--${prefix}-board-canvas-offset-x`] = `${this.state.boardCanvasOffsetX}px`;
		}

		if (Number.isFinite(this.state.boardCanvasOffsetY)) {
			style[`--${prefix}-board-canvas-offset-y`] = `${this.state.boardCanvasOffsetY}px`;
		}

		return style;
	}

	renderCanvas() {
		let tiles = Array.isArray(this.props.tiles) ? this.props.tiles : [];

		if (tiles.length === 0) {
			return this.props.placeholder || null;
		}

		return (
			<div className={this.props.scaleBoxClassName}>
				<div className={this.props.viewportClassName}>
					<div className={this.props.offsetClassName}>
						<Canvas
							className={this.getCanvasClassName()}
							delegator={this.props.delegator}
							tiles={tiles}
							timings={this.props.timings}
						/>
					</div>
				</div>
			</div>
		);
	}

	render() {
		return (
			<div
				className={this.props.className}
				ref={this.containerRef}
				style={this.getStyle()}
			>
				{this.renderCanvas()}
			</div>
		);
	}
}
