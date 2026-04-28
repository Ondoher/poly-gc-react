import React from 'react';

export default class Button extends React.Component {
	render() {
		const {
			active = false,
			children,
			className = '',
			type = 'button',
			variant = 'default',
			...buttonProps
		} = this.props;
		const classes = [
			'pipeline-button',
			variant && variant !== 'default' ? `pipeline-button-${variant}` : '',
			active ? 'pipeline-button-active' : '',
			className,
		].filter(Boolean).join(' ');

		return (
			<button
				{...buttonProps}
				type={type}
				className={classes}
			>
				{children}
			</button>
		);
	}
}
