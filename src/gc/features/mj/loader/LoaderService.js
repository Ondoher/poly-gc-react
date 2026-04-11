import {Service} from '@polylith/core';
import {load} from '@polylith/loader';
import {shouldDirectLaunch} from 'common/startup.js';

export default class Loader extends Service {
	constructor (registry) {
		super('mahjongg-loader', registry);
		this.implement(['ready', 'clicked']);
	}

	ready() {
		this.directory = this.registry.subscribe('directory');
		this.directory.add({image: 'mj/images/mj-tile.jpg', name: 'Mah Jongg', serviceName: this.serviceName});
		this.pagesProvider = this.registry.subscribe('pages-provider');
		this.pagesProvider.listen('newView', this.onNewView.bind(this));
	}

	async clicked() {
		await load('mahjongg');
		this.pagesService = this.registry.subscribe('main-pages');
		this.pagesService.add('mahjongg', 'mj:controller');
		this.pagesService.show('mahjongg');
	}

	onNewView(name) {
		if (name === 'main-pages' && shouldDirectLaunch('mahjongg')) {
			this.clicked();
		}
	}
}

new Loader();
