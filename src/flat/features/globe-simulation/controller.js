import { Service } from '@polylith/core';
import GlobeSimulationSceneModel from './models/GlobeSimulationSceneModel.js';

export default class GlobeSimulationController extends Service {
	constructor(registry) {
		super('globe-simulation-controller', registry);
		this.implement(['ready', 'mount', 'getState']);
	}

	ready() {
		this.pages = this.registry.subscribe('app-pages');
		this.views = this.registry.subscribe('views');
		this.state = this.initialState();

		this.pages.add({
			id: 'globe-simulation',
			label: 'Globe Simulation',
			urlSlug: 'globe-simulation',
			route: '/flat/globe-simulation',
			order: 20,
			controller: 'globe-simulation-controller',
		});
	}

	initialState() {
		const scene = new GlobeSimulationSceneModel().createScene();

		return {
			status: 'Spherical atmosphere shell with synthetic mountain markers ready.',
			scene,
		};
	}

	mount(options = {}) {
		this.app = options.appController || this.app || null;

		return this.views.get('globe-simulation', {
			controller: this,
		});
	}

	getState() {
		return { ...this.state };
	}
}

new GlobeSimulationController();
