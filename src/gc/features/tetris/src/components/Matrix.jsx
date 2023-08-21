import React, { Component } from "react";

export default class Matrix extends Component {
	constructor(props) {
		super(props);
	}

	renderCell(row, col, type) {
		var {offsetX = 0, offsetY = 0, prefix = key} = this.props;
		row += offsetY;
		col += offsetX;
		if (type <= 0 || row < 0 || col < 0) return;
		var className = `cell cell-${row}-${col} cell-type-${type}`;
		className += this.props.shadow ? ' shadow' : '';
		var key = `${prefix}-${row}-${col}`;
		return (
			<div key={key} className={className} row={row} col={col} type={type}/>
		)
	}

	renderRow(row, cells) {
		return cells.reduce(function(cells, cell, idx) {
			if (cell != -1) {
				cells.push(this.renderCell(row, idx, cell));
			}

			return cells;
		}.bind(this), [])
	}

	renderMatrix(matrix) {
		return matrix.reduce(function(cells, row, idx) {
			cells = [...cells, ...this.renderRow(idx, row)];
			return cells;

		}.bind(this), [])
	}

	render() {
		return (
			<React.Fragment>
				{this.renderMatrix(this.props.matrix)}
				{this.props.children}
			</React.Fragment>
		)
	}
}
