import React from "react";
import CssRect from "./CssRect.jsx";

export default class TextEditControl extends React.Component {
	constructor(props) {
		super(props);
	}

	render() {
		var className = 'mj-text-edit-control';
		var inputClassName = 'mj-text-edit-control-input';

		if (this.props.className) {
			className += ` ${this.props.className}`;
		}

		if (this.props.inputClassName) {
			inputClassName += ` ${this.props.inputClassName}`;
		}

		return (
			<CssRect
				tag="label"
				size={this.props.size}
				variant={this.props.variant || 'inset'}
				className={className}
			>
				<input
					className={inputClassName}
					type={this.props.type || 'text'}
					inputMode={this.props.inputMode}
					pattern={this.props.pattern}
					placeholder={this.props.placeholder}
					aria-label={this.props.ariaLabel}
					value={this.props.value}
					onChange={this.props.onChange}
					onKeyDown={this.props.onKeyDown}
				/>
			</CssRect>
		);
	}
}
