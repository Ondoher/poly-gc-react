import React from "react";
import CssRect from "./CssRect.jsx";
import SettingsButton from "./SettingsButton.jsx";

export default class SettingsSelector extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			listThumbHeight: 0,
			listThumbTop: 0,
			showListThumb: false,
			isDraggingListThumb: false,
		};

		this.listScrollRef = React.createRef();
		this.listTrackRef = React.createRef();
		this.listDragStartY = 0;
		this.listDragStartThumbTop = 0;
	}

	componentDidMount() {
		this.updateListScrollbar();
	}

	componentDidUpdate(prevProps) {
		if (
			prevProps.options !== this.props.options ||
			prevProps.selectedValue !== this.props.selectedValue
		) {
			this.updateListScrollbar();
		}
	}

	componentWillUnmount() {
		this.teardownListDragListeners();
	}

	updateListScrollbar() {
		window.requestAnimationFrame(function() {
			var scrollEl = this.listScrollRef.current;
			var trackEl = this.listTrackRef.current;
			if (!scrollEl || !trackEl) return;

			var clientHeight = scrollEl.clientHeight;
			var scrollHeight = scrollEl.scrollHeight;
			var scrollTop = scrollEl.scrollTop;
			var trackHeight = trackEl.clientHeight;

			if (scrollHeight <= clientHeight || clientHeight <= 0 || trackHeight <= 0) {
				this.setState({
					listThumbHeight: 0,
					listThumbTop: 0,
					showListThumb: false,
				});
				return;
			}

			var ratio = clientHeight / scrollHeight;
			var thumbHeight = Math.max(24, Math.round(trackHeight * ratio));
			thumbHeight = Math.min(trackHeight, thumbHeight);
			var trackTravel = trackHeight - thumbHeight;
			var maxScroll = scrollHeight - clientHeight;
			var thumbTop = maxScroll > 0 ? Math.round((scrollTop / maxScroll) * trackTravel) : 0;

			this.setState({
				listThumbHeight: thumbHeight,
				listThumbTop: thumbTop,
				showListThumb: true,
			});
		}.bind(this));
	}

	onListScroll() {
		this.updateListScrollbar();
	}

	teardownListDragListeners() {
		window.removeEventListener("pointermove", this.onListThumbPointerMoveBound);
		window.removeEventListener("pointerup", this.onListThumbPointerUpBound);
		window.removeEventListener("pointercancel", this.onListThumbPointerUpBound);
	}

	onListThumbPointerDown(evt) {
		if (!this.state.showListThumb) return;

		this.listDragStartY = evt.clientY;
		this.listDragStartThumbTop = this.state.listThumbTop;
		this.onListThumbPointerMoveBound = this.onListThumbPointerMove.bind(this);
		this.onListThumbPointerUpBound = this.onListThumbPointerUp.bind(this);

		window.addEventListener("pointermove", this.onListThumbPointerMoveBound);
		window.addEventListener("pointerup", this.onListThumbPointerUpBound);
		window.addEventListener("pointercancel", this.onListThumbPointerUpBound);

		this.setState({
			isDraggingListThumb: true,
		});

		evt.preventDefault();
	}

	onListThumbPointerMove(evt) {
		var scrollEl = this.listScrollRef.current;
		var trackEl = this.listTrackRef.current;
		if (!scrollEl || !trackEl) return;

		var trackHeight = trackEl.clientHeight;
		var thumbHeight = this.state.listThumbHeight;
		var maxThumbTop = Math.max(0, trackHeight - thumbHeight);
		var deltaY = evt.clientY - this.listDragStartY;
		var nextThumbTop = Math.max(0, Math.min(maxThumbTop, this.listDragStartThumbTop + deltaY));
		var maxScroll = scrollEl.scrollHeight - scrollEl.clientHeight;
		var nextScrollTop = maxThumbTop > 0 ? (nextThumbTop / maxThumbTop) * maxScroll : 0;

		scrollEl.scrollTop = nextScrollTop;
		this.updateListScrollbar();
		evt.preventDefault();
	}

	onListThumbPointerUp() {
		this.teardownListDragListeners();
		this.setState({
			isDraggingListThumb: false,
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
		var thumbClassName = `mj-settings-dialog-list-thumb${this.state.showListThumb ? " is-visible" : ""}`;
		var thumbStyle = {
			height: `${this.state.listThumbHeight}px`,
			transform: `translateY(${this.state.listThumbTop}px)`,
		};

		if (this.state.isDraggingListThumb) {
			thumbClassName += " is-dragging";
		}

		return (
			<div className="mj-settings-dialog-list-body">
				<div className="mj-settings-dialog-list-viewport">
					<div
						ref={this.listScrollRef}
						className="mj-settings-dialog-list-scroll"
						onScroll={this.onListScroll.bind(this)}
					>
						{this.renderOptionButtons()}
					</div>
				</div>
				<div className="mj-settings-dialog-list-rail" aria-hidden="true">
					<div
						className="mj-settings-dialog-list-track"
						ref={this.listTrackRef}
					>
						<div
							className={thumbClassName}
							style={thumbStyle}
							onPointerDown={this.onListThumbPointerDown.bind(this)}
						></div>
					</div>
				</div>
			</div>
		);
	}

	render() {
		return (
			<CssRect
				className={`mj-settings-dialog-selector${this.props.className ? ` ${this.props.className}` : ""}`}
				size="medium"
				variant="inset"
			>
				{this.renderOptionList()}
			</CssRect>
		);
	}
}
