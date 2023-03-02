import React from "react";
import {registry} from '@polylith/core';
import './styles/bread-crumbs.css';


export default class BreadCrumbs extends React.Component {
	constructor (props) {
		super(props);

		this.serviceName = props.serviceName;
		this.crumbService = registry.subscribe(this.serviceName);
		this.crumbService.listen('added', this.added.bind(this));
		this.crumbService.listen('cleared', this.cleared.bind(this));

		this.state = {
			crumbs: []
		};
	}

	added(crumbs) {
		this.setState({crumbs: crumbs});
	}

	cleared(crumbs) {
		this.setState({crumbs: crumbs});
	}

	componentDidMount() {
		var crumbs = this.crumbService.get();
		this.setState({crumbs: crumbs});
	}

	renderCrumb (crumb)  {
		return (
			<span id="bread-crumb" className="bread-crumb template">
				<span className="name" onClick={this.onCrumbClick.bind(this, crumb)}>{crumb.name}</span>
			</span>
		)
	}

	renderCrumbs() {
		return this.state.crumbs.map(function(crumb) {
			return this.renderCrumb(crumb);
		}, this);
	}

	render() {
		return (
			<div id="bread-crumbs" className="bread-crumbs">
				{this.renderCrumbs()}
			</div>
		)
	}

	onCrumbClick (crumb) {
		var service = registry.subscribe(crumb.service);
		var crumbs = this.state.crumbs;
		crumbs = crumbs.slice(0, crumb.pos);
		this.setState({crumbs: crumbs});

		console.log('onCrumbClick', crumb, service)

		if (service) service.invoke('crumbClick', crumb.id);
	}
}
