import React from 'react';
import { Service } from '@polylith/core';
import ExperimentsPage from '../components/ExperimentsPage.jsx';

export default class ExperimentsView extends Service {
	constructor(registry) {
		super('experiments-view', registry);
		this.implement([
			'ready',
			'getComponent',
			'getState',
			'assetUrl',
			'load',
			'generate',
			'dismissMessageDialog',
		]);
	}

	ready() {
		this.views = this.registry.subscribe('views');
		this.controller = this.registry.subscribe('experiments-controller');
		this.controller.listen('updated', (state) => this.fire('updated', state));
		this.views.add('experiments', this.serviceName);
	}

	getComponent() {
		return React.createElement(ExperimentsPage, {
			pageView: this,
		});
	}

	getState() {
		return this.controller.getState();
	}

	assetUrl(path, cacheKey = '') {
		return this.controller.assetUrl(path, cacheKey);
	}

	load(options) {
		return this.controller.load(options);
	}

	generate() {
		return this.controller.generate();
	}

	dismissMessageDialog() {
		this.controller.dismissMessageDialog();
	}
}

new ExperimentsView();
