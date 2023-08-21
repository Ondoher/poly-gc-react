import {Service} from '@polylith/core';
import {load} from '@polylith/loader';

export default class MjLoader extends Service {
	constructor (registry) {
		super('mahjongg-loader', registry);
		this.implement(['ready', 'clicked']);
	}

	ready() {
		this.directory = this.registry.subscribe('directory');
		this.directory.add({image: 'mj/images/mj-tile.jpg', name: 'Mah Jongg', serviceName: this.serviceName});
	}

	async clicked() {
		await load('mahjongg');
		this.pagesService = this.registry.subscribe('main-pages');
		this.pagesService.add('mahjongg', 'mj:controller');
		this.pagesService.show('mahjongg');
	}
}

new MjLoader();
