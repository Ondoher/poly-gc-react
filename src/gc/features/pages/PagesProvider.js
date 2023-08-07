import {Service,} from '@polylith/core';
import PagesView from './PagesView.js';

export default class PagesProvider extends Service {
	constructor(registry) {
		super('pages-provider', registry)

		this.implement(['getView']);
	}

	getView(name) {
		var view = new PagesView(name, this.registry);
		this.fire('newView', name);

		return view;
	}
}

new PagesProvider();
