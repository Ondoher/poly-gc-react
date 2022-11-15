import {Service, registry} from '@polylith/core';
import {load} from '@polylith/loader';

class LoaderService extends Service {
	constructor () {
		super('mahjongg-loader');
		this.implement(['ready', 'clicked']);
	}

	ready() {
		this.directory = registry.subscribe('directory');
		this.directory.add({image: 'images/mj/mj-tile.jpg', name: 'Mah Jongg', serviceName: 'mahjongg-loader'});
		this.pagesService = registry.subscribe('main-pages');
	}

	async clicked() {
		await load('mahjongg');
		this.pagesService.add('mahjongg', 'mj:controller');
		this.pagesService.show('mahjongg');
	}
}

new LoaderService();
