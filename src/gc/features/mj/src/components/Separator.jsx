import React from "react";

export default class Separator extends React.Component {
	render() {
		var className = "mj-separator";

		if (this.props.className) {
			className += ` ${this.props.className}`;
		}

		return (
			<div
				className={className}
				role="separator"
				aria-orientation={this.props.orientation || "horizontal"}
			></div>
		);
	}
}
