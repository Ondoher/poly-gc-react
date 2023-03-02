
import React from "react";

export default class Button extends React.Component {
	constructor (props) {
		super(props);
	}

	render () {
		var {
			id,
			onClick,
			className,
			disabled,
			selected,
		} = this.props

		className = 'button ' + className + (selected ? ' selected' : '');
		return (
			<React.Fragment>
				<button id={id} className={className} onClick={onClick} disabled={Boolean(disabled)}>
					{this.props.children}
				</button>
			</React.Fragment>
		)
	}
}
