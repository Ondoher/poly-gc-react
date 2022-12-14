import React from "react";

export default class Tile extends React.Component {
	constructor (props) {
		super(props);

		if (props.delegator) {
			props.delegator.delegateInbound(this, [
				'showTile', 'hintTile', 'highlightTile'
			]);
		}

		this.state = {
			show: true,
			highlight: false
		}
	}

	showTile(id, on) {
		if (id === this.props.id || id === 'all')
			this.setState({
				show: on
			})
	}

	hintTile(id, on) {
		if (id === this.props.id)
			this.setState({
				highlight: on
			})
	}

	highlightTile(id, on) {
		if (id === this.props.id || id === 'all')
			this.setState({
				highlight: on
			})
	}

	render() {
		var {x, y, z, face, onClick} = this.props;
		var {show, highlight} = this.state;
		var className = 'tile'
		className += ' pos-' + x + '-' + y + '-' + z;
		className += ' face-' + face;
		className += highlight ? ' highlight' : '';

		if (!show) return '';

		return(
			<React.Fragment>
				<div className={className} onClick={onClick}></div>
			</React.Fragment>
		);
	}
}
