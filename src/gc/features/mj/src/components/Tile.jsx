import React from "react";

export default class Tile extends React.Component {
	constructor (props) {
		super(props);

		this.state = {
			show: true,
			highlight: false
		}
	}

	componentDidMount() {
		if (this.props.delegator) {
			this.props.delegator.delegateInbound(this, [
				'showTile', 'hintTile', 'highlightTile'
			]);
		}
	}

	componentWillUnmount() {
		if (this.props.delegator) {
			this.props.delegator.freeDelegator();
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
		var bodyClass = 'tile pos-' + x + '-' + y + '-' + z;
		var faceClass = 'face face-' + face;
		faceClass += highlight ? ' highlight' : '';

		if (!show) return '';

		return(
			<React.Fragment>
				<div className={bodyClass}><div className={faceClass} onClick={onClick}></div></div>
			</React.Fragment>
		);
	}
}
