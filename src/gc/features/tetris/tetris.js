import {Service} from '@polylith/core';
import {load} from '@polylith/loader';

export default class TetrisLoader extends Service {
	constructor (registry) {
		super('tetris-loader', registry);
		this.implement(['ready', 'clicked']);
	}

	ready() {
		this.directory = this.registry.subscribe('directory');
		this.directory.add({image: 'tetris/images/tetris-tile.jpg', name: 'Quadroids', serviceName: this.serviceName});
	}

	async clicked() {
		await load('tetris');
		this.pagesService = this.registry.subscribe('main-pages');
		this.pagesService.add('tetris', 'tetris:controller');
		this.pagesService.show('tetris');
	}
}

new TetrisLoader();
