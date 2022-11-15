import React from "react";

export default class Timer extends React.Component {
	constructor (props) {
		super(props);

		if (props.delegator) {
			props.delegator.delegateInbound(this, [
				'setTime'
			]);
		}

		this.state = {
			duration: ''
		}
	}

	getDurationString(time) {
		var hours = Math.floor(time / 60 / 60 / 1000);
		time -= hours * 60 * 60 * 1000;
		var minutes = Math.floor(time / 60 / 1000);
		time -= minutes * 60 * 1000;
		var seconds = Math.floor(time / 1000);

		return hours.toString() + ':' + minutes.toString().padStart(2, '0') + ':' + seconds.toString().padStart(2, '0');
	}

	setTime(time) {
		var duration = this.getDurationString(time);
		this.setState({
			duration: duration
		})
	}

	render() {
		return (
			<React.Fragment>
				<div id={this.props.id} className={this.props.className}>
					{this.state.duration}
				</div>
			</React.Fragment>
		)
	}
}
