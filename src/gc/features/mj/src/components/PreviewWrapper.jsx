import React from 'react';

import Canvas from './Canvas.jsx';

class PreviewDelegator {
	delegateInbound() {
	}

	freeDelegator() {
	}
}

class PreviewDelegatorFactory {
	newDelegator() {
		return new PreviewDelegator();
	}
}

/**
 * Provide the minimal MJ styling and delegator context needed to mount the
 * tile canvas for preview rendering.
 */
export default class PreviewWrapper extends React.Component {
	constructor(props) {
		super(props);
		this.delegator = new PreviewDelegatorFactory();
	}

	getTilesetClass() {
		var tileset = this.props.tilesets?.[this.props.tileset];
		return tileset?.class || '';
	}

	getTilesizeClass() {
		var tilesize = this.props.tilesizes?.[this.props.tilesize];
		return tilesize?.class || '';
	}

	getCanvasClassName() {
		var set = this.getTilesetClass();
		var size = this.getTilesizeClass();
		var classes = [];

		if (this.props.className) {
			classes.push(this.props.className);
		}

		if (set && size) {
			classes.push(`${set}-${size}`);
		}

		if (size) {
			classes.push(`${size}-face`);
			classes.push(`${size}-size`);
		}

		return classes.join(' ');
	}

	getMaxTilesizeClass() {
		var tilesize = this.props.tilesizes?.[this.props.maxTilesize];
		return tilesize?.class || '';
	}

	getWrapperClassName() {
		var classes = ['mj-preview-wrapper'];
		var maxSize = this.getMaxTilesizeClass();

		if (this.props.className) {
			classes.push(this.props.className);
		}

		if (maxSize) {
			classes.push(`preview-max-${maxSize}-size`);
		}

		return classes.join(' ');
	}

	render() {
		return (
			<div className={this.getWrapperClassName()}>
				<div className="mj-playfield-stage">
					<Canvas
						className={this.getCanvasClassName()}
						delegator={this.delegator}
						tiles={this.props.tiles || []}
						onClick={this.props.onClick}
					/>
				</div>
			</div>
		);
	}
}
