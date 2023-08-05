import {Service} from '@polylith/core';
import {load} from '@polylith/loader';

export default class LoaderService extends Service {
	constructor (service) {
		super('mahjongg-loader', service);
		this.implement(['ready', 'clicked']);
	}

	ready() {
		this.directory = this.registry.subscribe('directory');
		this.directory.add({image: 'images/mj/mj-tile.jpg', name: 'Mah Jongg', serviceName: 'mahjongg-loader'});
		this.pagesService = this.registry.subscribe('main-pages');
	}

	async clicked() {
		await load('mahjongg');
		this.pagesService.add('mahjongg', 'mj:controller');
		this.pagesService.show('mahjongg');
	}
}

new LoaderService();
