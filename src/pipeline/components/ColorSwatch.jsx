import React from 'react';

export default class ColorSwatch extends React.Component {
	render() {
		const {
			addable = false,
			addableClassName = 'addable-structure-palette-swatch',
			ariaLabel,
			className = '',
			color = '',
			disabled = false,
			known = true,
			onClick = null,
			style = null,
			title = '',
			unknownClassName = 'unknown-structure-palette-swatch',
		} = this.props;
		const classes = [
			className,
			known ? '' : unknownClassName,
			addable ? addableClassName : '',
		].filter(Boolean).join(' ');

		return (
			<button
				type="button"
				className={classes}
				style={color ? { '--structure-palette-color': color, ...(style || {}) } : style}
				title={title}
				aria-label={ariaLabel || title}
				onClick={onClick || undefined}
				disabled={disabled}
			/>
		);
	}
}
