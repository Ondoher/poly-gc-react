import React from 'react';
import { Service } from '@polylith/core';
import GlobeSimulationPage from '../components/GlobeSimulationPage.jsx';

export default class GlobeSimulationView extends Service {
	constructor(registry) {
		super('globe-simulation-view', registry);
		this.implement(['ready', 'getComponent', 'getState']);
	}

	ready() {
		this.views = this.registry.subscribe('views');
		this.controller = this.registry.subscribe('globe-simulation-controller');
		this.controller.listen('updated', this.onControllerUpdated.bind(this));
		this.views.add('globe-simulation', this.serviceName);
	}

	onControllerUpdated(state) {
		this.fire('updated', state);
	}

	getComponent() {
		return React.createElement(GlobeSimulationPage, {
			pageView: this,
		});
	}

	getState() {
		return this.controller.getState();
	}
}

new GlobeSimulationView();
