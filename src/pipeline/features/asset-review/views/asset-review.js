import React from 'react';
import { Service } from '@polylith/core';
import AssetReviewPage from '../components/AssetReviewPage.jsx';

export default class AssetReviewView extends Service {
	constructor(registry) {
		super('asset-review-view', registry);
		this.implement([
			'ready',
			'getComponent',
			'getState',
			'assetUrl',
			'load',
			'startGeneration',
			'retryFace',
			'dismissMessageDialog',
		]);
	}

	ready() {
		this.views = this.registry.subscribe('views');
		this.controller = this.registry.subscribe('asset-review-controller');
		this.controller.listen('updated', (state) => this.fire('updated', state));
		this.views.add('asset-review', this.serviceName);
	}

	getComponent() {
		return React.createElement(AssetReviewPage, {
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

	startGeneration(options) {
		return this.controller.startGeneration(options);
	}

	retryFace(faceKey) {
		return this.controller.retryFace(faceKey);
	}

	dismissMessageDialog() {
		this.controller.dismissMessageDialog();
	}
}

new AssetReviewView();
