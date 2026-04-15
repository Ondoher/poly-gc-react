import React, { Component } from "react";
import Tile from './Tile.jsx';

export default class Canvas extends Component {
	constructor(props) {
		super(props)
	}

	onClickTile(tile) {
		if (this.props.onClick) this.props.onClick(tile);
	}

	createTiles() {
		return this.props.tiles.map(function(tile) {
			var onClick = this.props.onClick
				? this.props.onClick.bind(this, tile.id)
				: undefined;

			return (
				<Tile
					key={tile.id}
					delegator={this.props.delegator.newDelegator()}
					id={tile.id}
					x={tile.x}
					y={tile.y}
					z={tile.z}
					face={tile.face}
					highlight={tile.highlight === true}
					onClick={onClick}
				/>
			);

		}, this);
	}


	renderTiles() {
		return this.createTiles();
	}

	renderCanvas() {
		var className = 'board-canvas';

		if (this.props.className) {
			className += ' ' + this.props.className;
		}

		return(
			<div className={className} style={this.props.style}>
				{this.renderTiles()}
			</div>
		)
	}

	render() {
		return (
			<React.Fragment>
				{this.renderCanvas()}
			</React.Fragment>
		)
	}

}
