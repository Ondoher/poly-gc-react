import React from 'react';
import { Service } from '@polylith/core';
import FinalRenderingOptionsPage from '../components/FinalRenderingOptionsPage.jsx';

export default class FinalRenderingOptionsView extends Service {
	constructor(registry) {
		super('final-rendering-options-view', registry);
		this.implement([
			'ready',
			'getComponent',
			'getState',
			'assetUrl',
			'referenceImageUrl',
			'load',
			'rerender',
			'accept',
			'dismissMessageDialog',
		]);
	}

	ready() {
		this.views = this.registry.subscribe('views');
		this.controller = this.registry.subscribe('final-rendering-options-controller');
		this.controller.listen('updated', (state) => this.fire('updated', state));
		this.views.add('final-rendering-options', this.serviceName);
	}

	getComponent() {
		return React.createElement(FinalRenderingOptionsPage, {
			pageView: this,
		});
	}

	getState() {
		return this.controller.getState();
	}

	assetUrl(path) {
		return this.controller.assetUrl(path);
	}

	referenceImageUrl(faceKey) {
		return this.controller.referenceImageUrl(faceKey);
	}

	load(options) {
		return this.controller.load(options);
	}

	rerender(options) {
		return this.controller.rerender(options);
	}

	accept(options) {
		return this.controller.accept(options);
	}

	dismissMessageDialog() {
		this.controller.dismissMessageDialog();
	}
}

new FinalRenderingOptionsView();
