import React from 'react';

export default class BoundsBox extends React.Component {
	boxStyle() {
		const { bounds, canvas, style: customStyle = null } = this.props;
		const boxWidth = Number.isFinite(bounds.right) && Number.isFinite(bounds.left)
			? bounds.right - bounds.left
			: bounds.width;
		const boxHeight = Number.isFinite(bounds.bottom) && Number.isFinite(bounds.top)
			? bounds.bottom - bounds.top
			: bounds.height;

		return {
			left: `${((bounds.left - canvas.left) / canvas.width) * 100}%`,
			top: `${((bounds.top - canvas.top) / canvas.height) * 100}%`,
			width: `${(boxWidth / canvas.width) * 100}%`,
			height: `${(boxHeight / canvas.height) * 100}%`,
			...(customStyle || {}),
		};
	}

	render() {
		const { bounds, canvas, className, title = '', onClick = null } = this.props;

		if (!bounds || !canvas?.width || !canvas?.height) {
			return null;
		}

		return (
			<button
				type="button"
				className={`bounds-box ${className}`}
				style={this.boxStyle()}
				title={title}
				onClick={onClick || undefined}
				disabled={!onClick}
			/>
		);
	}
}
