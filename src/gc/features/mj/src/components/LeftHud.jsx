import React from "react";
import GameNumberControl from "./GameNumberControl.jsx";
import RaisedButton from "./RaisedButton.jsx";

function isLocalHost() {
	if (typeof window === "undefined" || !window.location) {
		return false;
	}

	var host = window.location.hostname;
	return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

export default class LeftHud extends React.Component {

	renderDifficultyLabel() {
		var difficulty = this.props.difficulty;
		var difficulties = this.props.difficulties || {};

		if (difficulty && difficulties[difficulty]?.label) {
			return difficulties[difficulty].label;
		}

		if (!difficulty) {
			return '';
		}

		return String(difficulty).charAt(0).toUpperCase() + String(difficulty).slice(1);
	}


	renderDifficulty() {
		let label = this.renderDifficultyLabel();
		if (!label) {
			return '';
		}

		return (
			<div className="mj-left-hud-difficulty-label" aria-label={`Difficulty ${label}`}>
				{label}
			</div>
		)
	}

	renderGameNumber() {
		return (
			<GameNumberControl
				delegator={this.props.delegator}
				boardNbr={this.props.boardNbr}
			/>
		)
	}

	renderDebugButtons() {
		var showDebugButtons = isLocalHost();

		if (!showDebugButtons) {
			return '';
		}


		return (
			<>
				<RaisedButton
						className="mj-game-number-half-solution-button"
						onClick={this.props.onPlayHalfSolution}
				>
					Half Solve
				</RaisedButton>
				<RaisedButton
					className="mj-game-number-lose-button"
					onClick={this.props.onLoseDebug}
				>
					Lose
				</RaisedButton>
			</>
		)
	}

	renderMainButtons() {
		return (
			<>
				<RaisedButton
					className="mj-game-number-solve-button"
					onClick={this.props.onSolve}
				>
					Solution
				</RaisedButton>
				<RaisedButton
					className="mj-game-number-settings-button"
					onClick={this.props.onSettings}
				>
					Settings
				</RaisedButton>
				<RaisedButton
					className="mj-game-number-help-button"
					onClick={this.props.onHelp}
				>
					Help
				</RaisedButton>
			</>
		)
	}

	renderFirstGroup() {
		return (
			<div className="mj-left-hud-main-group">
				{this.renderGameNumber()}
				{this.renderDebugButtons()}
			</div>
		)
	}

	renderSecondGroup() {
		return (
			<div className="mj-left-hud-standard-group">
				{this.renderMainButtons()}
			</div>
		)
	}

	renderMain() {
		return (
			<>
				{this.renderDifficulty()}
				<div className="left-hud-stack">
					{this.renderFirstGroup()}
					{this.renderSecondGroup()}
				</div>
			</>
		)
	}

	render() {
		var className = "mj-left-hud";

		if (this.props.className) {
			className = `${className} ${this.props.className}`;
		}

		return (
			<div className={className}>
				{this.renderMain()}
			</div>
		);
	}
}
