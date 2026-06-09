import React from 'react';
import { Service } from '@polylith/core';
import FalseSimulationPage from '../components/FalseSimulationPage.jsx';

export default class FalseSimulationView extends Service {
	constructor(registry) {
		super('false-simulation-view', registry);
		this.implement(['ready', 'getComponent', 'getState']);
	}

	ready() {
		this.views = this.registry.subscribe('views');
		this.controller = this.registry.subscribe('false-simulation-controller');
		this.controller.listen('updated', (state) => this.fire('updated', state));
		this.views.add('false-simulation', this.serviceName);
	}

	getComponent() {
		return React.createElement(FalseSimulationPage, {
			pageView: this,
		});
	}

	getState() {
		return this.controller.getState();
	}
}

new FalseSimulationView();
