import React from "react";

export default class CssRect extends React.Component {
	constructor(props) {
		super(props);
	}

	render() {
		var Tag = this.props.tag || 'div';
		var size = this.props.size || 'large';
		var variant = this.props.variant || 'flat';
		var className = `mj-css-rect mj-css-rect-${size} mj-css-rect-${variant}`;
		var props = {...this.props};
		var hideChildren = this.props.hideChildren;

		if (this.props.className) {
			className += ` ${this.props.className}`;
		}

		delete props.tag;
		delete props.className;
		delete props.children;
		delete props.hideChildren;
		delete props.size;
		delete props.variant;

		return (
			<Tag
				{...props}
				className={className}
			>
				{hideChildren ? null : this.props.children}
			</Tag>
		);
	}
}
