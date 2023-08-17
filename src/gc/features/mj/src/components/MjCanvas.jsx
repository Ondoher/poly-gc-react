import React, { Component } from "react";
import Tile from './Tile.jsx';

export default class MjCanvas extends Component {
	constructor(props) {
		super(props)
	}

	onClickTile(tile) {
		if (this.props.onClick) this.props.onClick(tile);
	}

	createTiles() {
		return this.props.tiles.map(function(tile) {
			return (
				<Tile
					key={tile.id}
					delegator={this.props.delegator.newDelegator()}
					id={tile.id}
					x={tile.x}
					y={tile.y}
					z={tile.z}
					face={tile.face}
					onClick={this.props.onClick.bind(this, tile.id)}
				/>
			);

		}, this);
	}


	renderTiles() {
		return this.createTiles();
	}

	renderCanvas() {
		return(
			<div class="board-canvas">
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
