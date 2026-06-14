import React from 'react';
import { Service } from '@polylith/core';
import FlatSimulationPage from '../components/FlatSimulationPage.jsx';

export default class FlatSimulationView extends Service {
	constructor(registry) {
		super('flat-simulation-view', registry);
		this.implement(['ready', 'getComponent', 'getState']);
	}

	ready() {
		this.views = this.registry.subscribe('views');
		this.controller = this.registry.subscribe('flat-simulation-controller');
		this.animationLoop = this.registry.subscribe('animation-loop');
		this.controller.listen('updated', this.onControllerUpdated.bind(this));
		this.views.add('flat-simulation', this.serviceName);
	}

	onControllerUpdated(state) {
		this.animationLoop.configure(state.scene?.animation);
		this.fire('updated', state);
	}

	getComponent() {
		return React.createElement(FlatSimulationPage, {
			pageView: this,
		});
	}

	getState() {
		const state = this.controller.getState();

		this.animationLoop.configure(state.scene?.animation);

		return state;
	}
}

new FlatSimulationView();
