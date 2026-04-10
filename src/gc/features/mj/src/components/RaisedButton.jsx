import React from "react";
import CssRect from "./CssRect.jsx";

export default class RaisedButton extends React.Component {
	constructor(props) {
		super(props);
	}

	render() {
		var className = 'mj-raised-button';

		if (this.props.selected) {
			className += ' is-selected';
		}

		if (this.props.className) {
			className += ` ${this.props.className}`;
		}

		return (
			<CssRect
				tag="button"
				type={this.props.type || 'button'}
				variant="flat"
				size={this.props.size || 'small'}
				className={className}
				onClick={this.props.onClick}
				aria-pressed={this.props.selected ? 'true' : 'false'}
			>
				<span className="mj-raised-button-face"></span>
				<span className="mj-raised-button-label">
					{this.props.children}
				</span>
			</CssRect>
		);
	}
}
