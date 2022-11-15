import {Service, registry} from '@polylith/core';

export default class PagesService extends Service{
	constructor(name) {
		super(name)
		this.implement(['ready', 'get', 'add', 'show']);

		this.pages = {};
	}

	get() {
		return {
			pages: this.pages,
			current: this.current
		}
	}

	add(name, serviceName) {
		if (this.pages[name]) {
			return;
		}

		this.pages[name] = {
			name: name,
			service: registry.subscribe(serviceName),
		};

		this.fire('added', this.pages);
	}


	async show(name) {
		var service = this.pages[name] ? this.pages[name].service : false;
		this.current = name;

		if (service) {
			service.fire('shown')
		}

		this.fire('showPage', name);
	}
}
