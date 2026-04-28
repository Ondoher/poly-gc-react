import React from 'react';
import { Service } from '@polylith/core';
import AssetBaseTileSelectionPage from '../components/AssetBaseTileSelectionPage.jsx';

export default class AssetBaseTileSelectionView extends Service {
	constructor(registry) {
		super('asset-base-tile-selection-view', registry);
		this.implement([
			'ready',
			'getComponent',
			'getState',
			'assetUrl',
			'load',
			'selectVariant',
			'save',
			'dismissMessageDialog',
		]);
	}

	ready() {
		this.views = this.registry.subscribe('views');
		this.controller = this.registry.subscribe('asset-base-tile-selection-controller');
		this.controller.listen('updated', (state) => this.fire('updated', state));
		this.views.add('asset-base-tile-selection', this.serviceName);
	}

	getComponent() {
		return React.createElement(AssetBaseTileSelectionPage, {
			pageView: this,
		});
	}

	getState() {
		return this.controller.getState();
	}

	assetUrl(path) {
		return this.controller.assetUrl(path);
	}

	load(options) {
		return this.controller.load(options);
	}

	selectVariant(variantId) {
		return this.controller.selectVariant(variantId);
	}

	save() {
		return this.controller.save();
	}

	dismissMessageDialog() {
		this.controller.dismissMessageDialog();
	}
}

new AssetBaseTileSelectionView();
