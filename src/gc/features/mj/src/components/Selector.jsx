import React from "react";
import GameCenterContext from "common/GameCenterContext.js";
import CssRect from "./CssRect.jsx";
import ScrollPane from "./ScrollPane.jsx";
import SettingsButton from "./SettingsButton.jsx";

export default class Selector extends React.Component {
	static contextType = GameCenterContext;

	constructor(props) {
		super(props);

		this.state = {
			viewportMode: null,
		};

		this.onViewportModeChanged = this.onViewportModeChanged.bind(this);
	}

	componentDidMount() {
		if (!this.usesViewportOrientation()) {
			return;
		}

		var registry = this.getRegistry();
		this.sizeWatcher = registry?.subscribe("size-watcher");

		if (!this.sizeWatcher) {
			return;
		}

		this.setState({
			viewportMode: this.sizeWatcher.getMode(),
		});

		this.modeChangedListener = this.sizeWatcher.listen(
			"mode-changed",
			this.onViewportModeChanged
		);
	}

	componentWillUnmount() {
		if (this.sizeWatcher && this.modeChangedListener) {
			this.sizeWatcher.unlisten("mode-changed", this.modeChangedListener);
		}
	}

	getRegistry() {
		return this.context?.registry || null;
	}

	usesViewportOrientation() {
		return Boolean(this.props.portraitOrientation || this.props.landscapeOrientation);
	}

	normalizeOrientation(orientation) {
		return orientation === "horizontal" ? "horizontal" : "vertical";
	}

	getOrientation() {
		if (this.state.viewportMode?.isPortrait) {
			return this.normalizeOrientation(this.props.portraitOrientation);
		}

		return this.normalizeOrientation(this.props.landscapeOrientation);
	}

	onViewportModeChanged(viewportMode) {
		this.setState({
			viewportMode,
		});
	}

	getDisplayOptions() {
		var options = this.props.options || [];
		var selectedValue = this.props.selectedValue;
		var minimumOptions = this.props.pinSelectedMinimumOptions || 0;

		if (!this.props.pinSelectedToTop || options.length < minimumOptions) {
			return {
				options,
				showPinnedSeparator: false,
			};
		}

		var selectedIndex = options.findIndex(function(option) {
			return option.value === selectedValue;
		});

		if (selectedIndex < 0) {
			return {
				options,
				showPinnedSeparator: false,
			};
		}

		if (selectedIndex === 0) {
			return {
				options,
				showPinnedSeparator: true,
			};
		}

		var displayOptions = options.slice();
		var selectedOption = displayOptions.splice(selectedIndex, 1)[0];

		displayOptions.unshift(selectedOption);

		return {
			options: displayOptions,
			showPinnedSeparator: true,
		};
	}

	renderOptionButtons() {
		var displayState = this.getDisplayOptions();
		var options = displayState.options;
		var selectedValue = this.props.selectedValue;

		if (options.length === 0) {
			return (
				<div className="mj-settings-selector-empty">
					{this.props.emptyLabel || "No options available"}
				</div>
			);
		}

		var optionButtons = options.map(function(option) {
			var className = "mj-settings-dialog-list-option";
			var labelLength = (option.label || "").length;

			if (labelLength >= 16) {
				className += " is-very-long";
			} else if (labelLength >= 11) {
				className += " is-long";
			}

			return (
				<SettingsButton
					key={option.value}
					className={className}
					selected={option.value === selectedValue}
					onClick={this.props.onSelect ? this.props.onSelect.bind(this, option.value) : undefined}
				>
					{option.label}
				</SettingsButton>
			);
		}, this);

		if (displayState.showPinnedSeparator) {
			optionButtons.splice(1, 0, (
				<div
					key="selected-separator"
					className="mj-settings-dialog-list-separator"
					aria-hidden="true"
				></div>
			));
		}

		return optionButtons;
	}

	renderOptionList() {
		var orientation = this.getOrientation();

		return (
			<ScrollPane
				orientation={orientation}
				className="mj-settings-dialog-list-body"
				viewportClassName="mj-settings-dialog-list-viewport"
				scrollClassName="mj-settings-dialog-list-scroll"
				railClassName="mj-settings-dialog-list-rail"
				trackClassName="mj-settings-dialog-list-track"
				thumbClassName="mj-settings-dialog-list-thumb"
			>
				{this.renderOptionButtons()}
			</ScrollPane>
		);
	}

	render() {
		var orientation = this.getOrientation();

		return (
			<CssRect
				className={`mj-settings-dialog-selector is-${orientation}${this.props.className ? ` ${this.props.className}` : ""}`}
				size="medium"
				variant="inset"
			>
				{this.renderOptionList()}
			</CssRect>
		);
	}
}
