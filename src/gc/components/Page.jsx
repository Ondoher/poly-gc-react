import React from "react";
import GameCenterContext from 'common/GameCenterContext.js';

export default class Page extends React.Component {
	static contextType = GameCenterContext;
	constructor (props) {
		super(props);

		this.name = props.name;
		this.serviceName = props.serviceName;

		this.state = {
			visible: false,
		}
	}

	componentDidMount() {
		var registry = this.context.registry

		this.viewService = registry.subscribe(this.serviceName);
		this.viewService.listen('show', this.show.bind(this));
		this.viewService.listen('hide', this.hide.bind(this));

		this.viewService.fire('sendVisibility');
		this.setState({ready: true})
	}

	show () {
		this.setState({visible: true});
	}

	hide () {
		this.setState({visible: false});
	}

	render () {
		if (!this.state.ready) return;
		var visible = this.state.visible;
		var display = visible ? 'block' : 'none';

		return (
			<div style={{display: display}} id={this.props.id} className={this.props.className}>
				{this.props.children}
			</div>
		)
	}

}
