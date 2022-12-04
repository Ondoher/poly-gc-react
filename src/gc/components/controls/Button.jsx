
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
		} = this.props

		return (
			<React.Fragment>
				<button id={id} className={'button ' + className} onClick={onClick} disabled={Boolean(disabled)}>
					{this.props.children}
				</button>
			</React.Fragment>
		)
	}
}
