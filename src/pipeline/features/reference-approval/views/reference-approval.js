import React from 'react';
import { Service } from '@polylith/core';
import ReferenceApprovalPage from '../components/ReferenceApprovalPage.jsx';

export default class ReferenceApprovalView extends Service {
	constructor(registry) {
		super('reference-approval-view', registry);
		this.implement([
			'ready',
			'getComponent',
			'getState',
			'assetUrl',
			'load',
			'saveDraft',
			'accept',
			'setSelection',
			'bindSelection',
			'unbindPart',
			'addPaletteColor',
			'showFirstIncompleteFace',
			'showFirstUnboundPart',
			'showFirstUnboundComponent',
			'dismissMessageDialog',
			'paletteColorSet',
			'partLabel',
			'referenceColorSwatch',
			'sortComponentsForReview',
		]);
	}

	ready() {
		this.views = this.registry.subscribe('views');
		this.controller = this.registry.subscribe('reference-approval-controller');
		this.controller.listen('updated', (state) => this.fire('updated', state));
		this.views.add('reference-approval', this.serviceName);
	}

	getComponent() {
		return React.createElement(ReferenceApprovalPage, {
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

	saveDraft() {
		return this.controller.saveDraft();
	}

	accept() {
		return this.controller.accept();
	}

	setSelection(faceKey, selection) {
		this.controller.setSelection(faceKey, selection);
	}

	bindSelection(faceKey) {
		this.controller.bindSelection(faceKey);
	}

	unbindPart(faceKey, partId, componentIds) {
		this.controller.unbindPart(faceKey, partId, componentIds);
	}

	addPaletteColor(color) {
		this.controller.addPaletteColor(color);
	}

	showFirstIncompleteFace() {
		this.controller.showFirstIncompleteFace();
	}

	showFirstUnboundPart() {
		this.controller.showFirstUnboundPart();
	}

	showFirstUnboundComponent() {
		this.controller.showFirstUnboundComponent();
	}

	dismissMessageDialog() {
		this.controller.dismissMessageDialog();
	}

	paletteColorSet(palette) {
		return this.controller.paletteColorSet(palette);
	}

	partLabel(partId, part) {
		return this.controller.partLabel(partId, part);
	}

	referenceColorSwatch(item, paletteColorSet) {
		return this.controller.referenceColorSwatch(item, paletteColorSet);
	}

	sortComponentsForReview(components, partEntries) {
		return this.controller.sortComponentsForReview(components, partEntries);
	}
}

new ReferenceApprovalView();
