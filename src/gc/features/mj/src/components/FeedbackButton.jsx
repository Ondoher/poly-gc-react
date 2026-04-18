import React from "react";

export default class FeedbackButton extends React.Component {
	render() {
		var className = "mj-right-hud-button mj-right-hud-button-feedback";

		if (this.props.className) {
			className += ` ${this.props.className}`;
		}

		return (
			<button
				type="button"
				className={className}
				aria-label={this.props.label || "Feedback"}
				title={this.props.title || "Feedback"}
				onClick={this.props.onClick}
			>
				<span className="mj-right-hud-button-icon"></span>
			</button>
		);
	}
}
