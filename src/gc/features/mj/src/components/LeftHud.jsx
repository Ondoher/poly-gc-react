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
	render() {
		var showDebugButtons = isLocalHost();
		var className = "mj-left-hud";

		if (this.props.className) {
			className += ` ${this.props.className}`;
		}

		return (
			<div className={className}>
				<div className="mj-left-hud-stack">
					<GameNumberControl
						delegator={this.props.delegator}
						boardNbr={this.props.boardNbr}
						difficulty={this.props.difficulty}
						difficulties={this.props.difficulties}
					/>
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
					{showDebugButtons ? (
						<RaisedButton
							className="mj-game-number-half-solution-button"
							onClick={this.props.onPlayHalfSolution}
						>
							Half Solve
						</RaisedButton>
					) : null}
					{showDebugButtons ? (
						<RaisedButton
							className="mj-game-number-lose-button"
							onClick={this.props.onLoseDebug}
						>
							Lose
						</RaisedButton>
					) : null}
				</div>
			</div>
		);
	}
}
