import React from "react";
import RaisedButton from "./RaisedButton.jsx";

export default class SettingsButton extends React.Component {
	constructor(props) {
		super(props);
	}

	render() {
		var className = 'mj-settings-button';

		if (this.props.selected) {
			className += ' is-selected';
		}

		if (this.props.className) {
			className += ` ${this.props.className}`;
		}

		return (
			<RaisedButton
				className={className}
				onClick={this.props.onClick}
				selected={this.props.selected}
			>
				{this.props.children}
			</RaisedButton>
		);
	}
}
