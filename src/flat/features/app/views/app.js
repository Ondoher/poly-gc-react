import React from 'react';
import { Service } from '@polylith/core';
import AppShell from '../components/AppShell.jsx';

export default class AppView extends Service {
	constructor(registry) {
		super('app-view', registry);
		this.implement(['ready', 'getComponent', 'getShellState', 'requestPage']);
	}

	ready() {
		this.controller = this.registry.subscribe('app-controller');
		this.controller.listen('pages-updated', (pages) => this.fire('pages-updated', pages));
		this.controller.listen('page-mounted', (details) => this.fire('page-mounted', details));
	}

	getComponent(props = {}) {
		return React.createElement(AppShell, {
			...props,
			appView: this,
		});
	}

	getShellState(preferredPageId = '') {
		return this.controller.getShellState(preferredPageId);
	}

	requestPage(pageId) {
		return this.controller.requestPage(pageId);
	}
}

new AppView();
