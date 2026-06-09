import { Service } from '@polylith/core';
import FalseSimulationSceneModel from './models/FalseSimulationSceneModel.js';

export default class FalseSimulationController extends Service {
	constructor(registry) {
		super('false-simulation-controller', registry);
		this.implement(['ready', 'mount', 'getState']);
	}

	ready() {
		this.pages = this.registry.subscribe('app-pages');
		this.views = this.registry.subscribe('views');
		this.state = this.initialState();

		this.pages.add({
			id: 'false-simulation',
			label: 'False Simulation',
			urlSlug: 'false-simulation',
			route: '/flat/false-simulation',
			order: 10,
			controller: 'false-simulation-controller',
		});
	}

	initialState() {
		const scene = new FalseSimulationSceneModel().createScene();

		return {
			status: 'Ready for false-simulation POC work.',
			scene,
		};
	}

	mount(options = {}) {
		this.app = options.appController || this.app || null;

		return this.views.get('false-simulation', {
			controller: this,
		});
	}

	getState() {
		return { ...this.state };
	}
}

new FalseSimulationController();
