import React from "react";
import CssRect from "./CssRect.jsx";
import SettingsButton from "./SettingsButton.jsx";
import SettingsSelector from "./SettingsSelector.jsx";
import SettingsPreview from "./SettingsPreview.jsx";

const TABS = [
	{id: "layout", label: "Layout"},
	{id: "tileSize", label: "Tile Size"},
	{id: "tileStyle", label: "Tile Style"},
];

export default class SettingsDialog extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			activeTab: "layout",
			draftLayout: props.layout,
			draftTileset: props.tileset,
			draftTilesize: props.tilesize,
		};
	}

	componentDidUpdate(prevProps, prevState) {
		if (!prevProps.open && this.props.open) {
			this.resetDraftState();
		}

		if (
			this.props.open &&
			prevProps.allowedTilesizes !== this.props.allowedTilesizes
		) {
			var nextDraftTilesize = this.getValidDraftTilesize();

			if (nextDraftTilesize !== this.state.draftTilesize) {
				this.setState({
					draftTilesize: nextDraftTilesize,
				});
				return;
			}
		}
	}

	resetDraftState() {
		this.setState({
			activeTab: "layout",
			draftLayout: this.props.layout,
			draftTileset: this.props.tileset,
			draftTilesize: this.getValidDraftTilesize(this.props.tilesize),
		});
	}

	onSelectTab(tabId) {
		this.setState({
			activeTab: tabId,
		});
	}

	onSelectLayout(layoutId) {
		this.setState({
			draftLayout: layoutId,
		});
	}

	onSelectTileset(tilesetId) {
		this.setState({
			draftTileset: tilesetId,
		});
	}

	onSelectTilesize(tilesizeId) {
		if (!tilesizeId) {
			return;
		}

		this.setState({
			draftTilesize: tilesizeId,
		});
	}

	getAllowedTilesizes() {
		if (Array.isArray(this.props.allowedTilesizes)) {
			return this.props.allowedTilesizes;
		}

		return Object.keys(this.props.tilesizes || {});
	}

	getValidDraftTilesize(preferred = this.state?.draftTilesize ?? this.props.tilesize) {
		var allowedTilesizes = this.getAllowedTilesizes();

		if (allowedTilesizes.length === 0) {
			return null;
		}

		if (preferred && allowedTilesizes.includes(preferred)) {
			return preferred;
		}

		if (this.props.tilesize && allowedTilesizes.includes(this.props.tilesize)) {
			return this.props.tilesize;
		}

		return allowedTilesizes[allowedTilesizes.length - 1];
	}

	onConfirm() {
		var layoutChanged = this.state.draftLayout !== this.props.layout;
		var tilesetChanged = this.state.draftTileset !== this.props.tileset;
		var tilesizeChanged = this.state.draftTilesize !== this.props.tilesize;

		if (tilesetChanged && this.props.onSelectTileset) {
			this.props.onSelectTileset(this.state.draftTileset);
		}

		if (tilesizeChanged && this.props.onSelectTilesize) {
			this.props.onSelectTilesize(this.state.draftTilesize);
		}

		if (layoutChanged && this.props.onSelectLayout) {
			this.props.onSelectLayout(this.state.draftLayout);
		}

		if (layoutChanged && this.props.onPlay) {
			this.props.onPlay(-1);
		}

		if (this.props.onClose) {
			this.props.onClose();
		}
	}

	getActiveOptions() {
		var activeTab = this.state.activeTab;

		if (activeTab === "layout") {
			return Object.keys(this.props.layouts || {}).map(function(name) {
				var layout = this.props.layouts[name];
				return {
					value: layout.id,
					label: layout.title,
				};
			}, this);
		}

		if (activeTab === "tileSize") {
			return this.getAllowedTilesizes().map(function(name) {
				var tilesize = this.props.tilesizes[name];
				return {
					value: name,
					label: tilesize.name,
				};
			}, this);
		}

		return Object.keys(this.props.tilesets || {}).map(function(name) {
			var tileset = this.props.tilesets[name];
			return {
				value: name,
				label: tileset.name,
			};
		}, this);
	}

	getSelectedValue() {
		switch (this.state.activeTab) {
			case "tileSize":
				return this.state.draftTilesize || "";
			case "tileStyle":
				return this.state.draftTileset;
			default:
				return this.state.draftLayout;
		}
	}

	onSelectOption(value) {
		switch (this.state.activeTab) {
			case "tileSize":
				this.onSelectTilesize(value);
				break;
			case "tileStyle":
				this.onSelectTileset(value);
				break;
			default:
				this.onSelectLayout(value);
		}
	}

	renderTabs() {
		return TABS.map(function (tab) {
			return (
				<SettingsButton
					key={tab.id}
					className="mj-settings-dialog-tab"
					selected={this.state.activeTab === tab.id}
					onClick={this.onSelectTab.bind(this, tab.id)}
				>
					{tab.label}
				</SettingsButton>
			);
		}, this);
	}

	render() {
		if (!this.props.open) return null;

		return (
			<div
				className="mj-settings-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby="mj-settings-dialog-title"
			>
				<div className="mj-settings-dialog-overlay"></div>
				<CssRect
					className="mj-settings-dialog-panel"
					size="large"
					variant="inset"
				>
					<button
						type="button"
						className="mj-settings-dialog-close"
						aria-label="Close settings"
						onClick={this.props.onClose}
					>
						X
					</button>
					<h2
						id="mj-settings-dialog-title"
						className="mj-settings-dialog-title"
					>
						Settings
					</h2>
					<div className="mj-settings-dialog-tabs">
						{this.renderTabs()}
					</div>
					<div className="mj-settings-dialog-body">
						<div className="mj-settings-dialog-content">
							<SettingsSelector
								className="mj-settings-dialog-selector"
								options={this.getActiveOptions()}
								emptyLabel={this.state.activeTab === "tileSize" ? "No sizes fit" : undefined}
								selectedValue={this.getSelectedValue()}
								onSelect={this.onSelectOption.bind(this)}
							/>
							<SettingsPreview
								layout={this.state.draftLayout}
								maxTileSize={this.props.maxTileSize}
								tilesize={this.state.draftTilesize || this.props.tilesize}
								tileset={this.state.draftTileset}
							/>
						</div>
					</div>
					<div className="mj-settings-dialog-actions">
						<SettingsButton
							className="mj-settings-dialog-confirm"
							selected={false}
							onClick={this.onConfirm.bind(this)}
						>
							Confirm
						</SettingsButton>
					</div>
				</CssRect>
			</div>
		);
	}
}
