import { Service } from '@polylith/core';
import FlatSimulationSceneModel from './models/FlatSimulationSceneModel.js';

export default class FlatSimulationController extends Service {
	constructor(registry) {
		super('flat-simulation-controller', registry);
		this.implement(['ready', 'mount', 'getState']);
	}

	ready() {
		this.pages = this.registry.subscribe('app-pages');
		this.views = this.registry.subscribe('views');
		this.state = this.initialState();

		this.pages.add({
			id: 'flat-simulation',
			label: 'Flat Simulation',
			urlSlug: 'flat-simulation',
			route: '/flat/flat-simulation',
			order: 10,
			controller: 'flat-simulation-controller',
		});
	}

	initialState() {
		const scene = new FlatSimulationSceneModel().createScene();

		return {
			status: 'Ready for flat-simulation POC work.',
			scene,
		};
	}

	mount(options = {}) {
		this.app = options.appController || this.app || null;

		return this.views.get('flat-simulation', {
			controller: this,
		});
	}

	getState() {
		return { ...this.state };
	}
}

new FlatSimulationController();
