import React from "react";
import ScalingCanvas from "./ScalingCanvas.jsx";
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
		};

		this.delegator = new SettingsPreviewDelegatorFactory();
	}

	componentDidMount() {
		this.buildPreviewTiles();
	}

	componentDidUpdate(prevProps) {
		if (
			prevProps.layout !== this.props.layout ||
			prevProps.difficulty !== this.props.difficulty
		) {
			this.buildPreviewTiles();
			return;
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
			});
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
		});
	}

	getTilesetClass() {
		let tileset = TILE_SETS[this.props.tileset];
		return tileset?.class || "ivory";
	}

	getCanvasClassName(metricSetId) {
		let selectedMetricSetId = metricSetId || this.props.tilesize || "tiny";

		return [
			`${this.getTilesetClass()}-${selectedMetricSetId}`,
			`${selectedMetricSetId}-face`,
			`${selectedMetricSetId}-size`,
			"mj-settings-dialog-preview-canvas",
		].join(" ");
	}

	render() {
		return (
			<div className="mj-settings-dialog-preview">
				<ScalingCanvas
					className="mj-settings-dialog-preview-surface"
					cssVarPrefix="mj-settings-preview"
					scaleBoxClassName="mj-settings-dialog-preview-scale-box"
					viewportClassName="mj-settings-dialog-preview-viewport"
					offsetClassName="mj-settings-dialog-preview-board-offset"
					delegator={this.delegator}
					tiles={this.state.tiles}
					sizeNames={Object.keys(TILE_SIZES)}
					fallbackMetricSetId={this.props.tilesize || "tiny"}
					getCanvasClassName={this.getCanvasClassName.bind(this)}
					placeholder={
						<div className="mj-settings-dialog-placeholder">
							Layout preview
						</div>
					}
				/>
			</div>
		);
	}
}
