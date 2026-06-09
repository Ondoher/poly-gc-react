import { Service } from '@polylith/core';

export default class MainController extends Service {
	constructor(registry) {
		super('main-controller', registry);
		this.implement(['ready', 'mount']);
	}

	ready() {
		this.view = this.registry.subscribe('main-view');
		this.appController = this.registry.subscribe('app-controller');
		this.registry.listen('ready', this.onRegistryReady.bind(this));
	}

	onRegistryReady() {
		this.mount();
	}

	mount() {
		const component = this.appController.getComponent({
			mainController: this,
		});

		this.view.render(component);
	}
}

new MainController();
