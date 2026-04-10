import React from "react";
import CssRect from "./CssRect.jsx";
import Timer from "./Timer.jsx";

export default class RightHud extends React.Component {
	constructor(props) {
		super(props);
	}

	getButtonState(name) {
		var gameOver = this.props.won || this.props.lost;

		switch (name) {
			case 'pause':
				return {
					active: Boolean(this.props.isPaused),
					disabled: gameOver,
					onClick: this.props.onPause,
				};
			case 'restart':
				return {
					disabled: false,
					onClick: this.props.onRestart,
				};
			case 'undo':
				return {
					disabled: !this.props.canUndo,
					onClick: this.props.onUndo,
				};
			case 'redo':
				return {
					disabled: !this.props.canRedo,
					onClick: this.props.onRedo,
				};
			case 'hint':
				return {
					disabled: gameOver,
					onClick: this.props.onHint,
				};
			case 'peek':
				return {
					active: Boolean(this.props.isPeeking),
					disabled: gameOver,
					onClick: this.props.onPeek,
				};
			case 'settings':
				return {
					disabled: false,
					onClick: this.props.onSettings,
				};
			default:
				return {};
		}
	}

	renderButton(name, label) {
		var {active, disabled, onClick} = this.getButtonState(name);
		var className = `mj-right-hud-button mj-right-hud-button-${name}`;

		if (active) {
			className += ' is-active';
		}

		return (
			<button
				type="button"
				className={className}
				aria-label={label}
				aria-pressed={active ? 'true' : 'false'}
				disabled={disabled}
				onClick={onClick}
			>
				<span className="mj-right-hud-button-icon"></span>
			</button>
		);
	}

	render() {
		return (
			<div className="mj-right-hud">
				<Timer
					delegator={this.props.delegator}
					className="mj-right-hud-timer"
					isPaused={Boolean(this.props.isPaused)}
				/>
				<CssRect
					className="mj-right-hud-rail"
					size="large"
					variant="inset"
				>
					<div className="mj-right-hud-button-bar">
						{this.renderButton('pause', 'Pause')}
						{this.renderButton('restart', 'Restart')}
						{this.renderButton('undo', 'Undo')}
						{this.renderButton('redo', 'Redo')}
						{this.renderButton('hint', 'Hint')}
						{this.renderButton('peek', 'Peek')}
						{this.renderButton('settings', 'Settings')}
					</div>
				</CssRect>
			</div>
		);
	}
}
