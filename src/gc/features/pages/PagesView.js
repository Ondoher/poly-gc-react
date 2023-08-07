import React from "react";
import { Service } from "@polylith/core";
import Pages from "./Pages";

export default class PagesView extends Service {
	constructor(name, registry) {
		super(name, registry);

		this.pages = {};
		this.implement(['get', 'add', 'show', 'getComponent']);
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
			service: this.registry.subscribe(serviceName),
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

	getComponent(name) {
		return <Pages id={name} serviceName={this.serviceName} className="pages" />
	}
}
