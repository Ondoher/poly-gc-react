import { Service } from '@polylith/core';
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

export default class MainView extends Service {
	constructor(registry) {
		super('main-view', registry);
		this.implement(['start', 'render']);
	}

	start() {
		this.root = null;
	}

	render(component) {
		const domNode = document.getElementById('main-content');

		if (!this.root) {
			this.root = createRoot(domNode);
		}

		this.root.render(React.createElement(
			React.StrictMode,
			null,
			React.createElement(App, { registry: this.registry }, component),
		));
	}
}

new MainView();
