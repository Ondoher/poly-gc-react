import React from "react";

export default class OrnamentalRect extends React.Component {
	constructor(props) {
		super(props);
	}

	render() {
		var Tag = this.props.tag || 'div';
		var size = this.props.size || 'large';
		var className = `mj-ornamental-rect mj-ornamental-rect-${size}`;
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
