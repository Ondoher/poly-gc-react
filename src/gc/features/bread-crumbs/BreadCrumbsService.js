import {Service} from '@polylith/core';

class BreadCrumbsService extends Service {
	constructor () {
		super('bread-crumbs');
		this.implement(['ready', 'add', 'clear', 'get']);

		this.directory = [];
		this.crumbs = [];
	}

	add (name, id, service) {
		var crumb = {
			pos: this.crumbs.length,
			name: name,
			id: id,
			service: service,
		};

		this.crumbs.push(crumb);
		this.fire('added', this.crumbs);
	}

	clear () {
		this.crumbs = [];
		this.fire('cleared', this.crumbs);
	}

	get () {
		return this.crumbs;
	}

}

new BreadCrumbsService();

export default BreadCrumbsService;
