import React from "react";
import ModalDialog from "./ModalDialog.jsx";
import SettingsButton from "./SettingsButton.jsx";
import SettingsSelector from "./SettingsSelector.jsx";
import SettingsPreview from "./SettingsPreview.jsx";

const TABS = [
	{id: "difficulty", label: "Difficulty"},
	{id: "layout", label: "Layout"},
	{id: "tileSize", label: "Tile Size"},
	{id: "tileStyle", label: "Tile Style"},
];

export default class SettingsDialog extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			activeTab: "difficulty",
			draftLayout: props.layout,
			draftDifficulty: props.difficulty,
			draftTileset: props.tileset,
			draftTilesize: props.tilesize,
			draftTelemetryConsent: props.telemetryConsent === true,
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
			activeTab: "difficulty",
			draftLayout: this.props.layout,
			draftDifficulty: this.props.difficulty,
			draftTileset: this.props.tileset,
			draftTilesize: this.getValidDraftTilesize(this.props.tilesize),
			draftTelemetryConsent: this.props.telemetryConsent === true,
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

	onSelectDifficulty(difficultyId) {
		this.setState({
			draftDifficulty: difficultyId,
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

	onToggleTelemetryConsent() {
		this.setState(function(prevState) {
			return {
				draftTelemetryConsent: !prevState.draftTelemetryConsent,
			};
		});
	}

	getAllowedTilesizes() {
		if (Array.isArray(this.props.allowedTilesizes)) {
			if (this.props.allowedTilesizes.length > 0) {
				return this.props.allowedTilesizes;
			}

			if (this.props.tilesizes?.tiny) {
				return ["tiny"];
			}

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
		var difficultyChanged = this.state.draftDifficulty !== this.props.difficulty;
		var tilesetChanged = this.state.draftTileset !== this.props.tileset;
		var tilesizeChanged = this.state.draftTilesize !== this.props.tilesize;
		var telemetryConsentChanged =
			this.state.draftTelemetryConsent !== (this.props.telemetryConsent === true);
		var shouldRegenerateBoard = layoutChanged || difficultyChanged;

		if (tilesetChanged && this.props.onSelectTileset) {
			this.props.onSelectTileset(this.state.draftTileset);
		}

		if (tilesizeChanged && this.props.onSelectTilesize) {
			this.props.onSelectTilesize(this.state.draftTilesize);
		}

		if (layoutChanged && this.props.onSelectLayout) {
			this.props.onSelectLayout(this.state.draftLayout);
		}

		if (difficultyChanged && this.props.onSelectDifficulty) {
			this.props.onSelectDifficulty(this.state.draftDifficulty);
		}

		if (telemetryConsentChanged && this.props.onSetTelemetryConsent) {
			this.props.onSetTelemetryConsent(this.state.draftTelemetryConsent);
		}

		if (shouldRegenerateBoard && this.props.onPlay) {
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

		if (activeTab === "difficulty") {
			return Object.keys(this.props.difficulties || {}).map(function(name) {
				var difficulty = this.props.difficulties[name];
				return {
					value: difficulty.id,
					label: difficulty.label,
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
			case "difficulty":
				return this.state.draftDifficulty;
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
			case "difficulty":
				this.onSelectDifficulty(value);
				break;
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

	renderTelemetrySection() {
		return (
			<div className="mj-settings-dialog-support">
				<button
					type="button"
					className="mj-settings-dialog-support-checkbox"
					role="checkbox"
					aria-checked={this.state.draftTelemetryConsent ? "true" : "false"}
					onClick={this.onToggleTelemetryConsent.bind(this)}
				>
					<span
						className={
							this.state.draftTelemetryConsent
								? "mj-settings-dialog-support-checkbox-box is-checked"
								: "mj-settings-dialog-support-checkbox-box"
						}
						aria-hidden="true"
					>
						<span className="mj-settings-dialog-support-checkbox-mark">
							✓
						</span>
					</span>
					<span className="mj-settings-dialog-support-checkbox-copy">
						Help us make this game better by sending anonymous play data
					</span>
				</button>
			</div>
		);
	}

	render() {
		if (!this.props.open) return null;

		return (
			<ModalDialog
				open={this.props.open}
				className="mj-settings-dialog"
				panelClassName="mj-settings-dialog-panel"
				bodyClassName="mj-settings-dialog-body"
				title="Settings"
				titleId="mj-settings-dialog-title"
				closeLabel="Close settings"
				onClose={this.props.onClose}
				actions={
					<SettingsButton
						className="mj-settings-dialog-confirm"
						selected={false}
						onClick={this.onConfirm.bind(this)}
					>
						Confirm
					</SettingsButton>
				}
			>
				<div className="mj-settings-dialog-tabs">
					{this.renderTabs()}
				</div>
				<div className="mj-settings-dialog-content">
							<SettingsSelector
								className="mj-settings-dialog-selector"
								options={this.getActiveOptions()}
								pinSelectedToTop={true}
								pinSelectedMinimumOptions={6}
								emptyLabel={this.state.activeTab === "tileSize" ? "No sizes fit" : undefined}
								selectedValue={this.getSelectedValue()}
								onSelect={this.onSelectOption.bind(this)}
							/>
					<SettingsPreview
						layout={this.state.draftLayout}
						difficulty={this.state.draftDifficulty}
						maxTileSize={this.props.maxTileSize}
						tilesize={this.state.draftTilesize || this.props.tilesize}
						tileset={this.state.draftTileset}
					/>
				</div>
				{this.renderTelemetrySection()}
			</ModalDialog>
		);
	}
}
