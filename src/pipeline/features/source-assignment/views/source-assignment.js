import React from 'react';
import { Service } from '@polylith/core';
import SourceAssignmentPage from '../components/SourceAssignmentPage.jsx';

export default class SourceAssignmentView extends Service {
	constructor(registry) {
		super('source-assignment-view', registry);
		this.implement([
			'ready',
			'getComponent',
			'getState',
			'assetUrl',
			'load',
			'setSelection',
			'bindSelection',
			'unbindPart',
			'save',
			'accept',
			'showFirstUnboundPart',
			'showFirstUnboundComponent',
			'dismissMessageDialog',
		]);
	}

	ready() {
		this.views = this.registry.subscribe('views');
		this.controller = this.registry.subscribe('source-assignment-controller');
		this.controller.listen('updated', (state) => this.fire('updated', state));
		this.views.add('source-assignment', this.serviceName);
	}

	getComponent() {
		return React.createElement(SourceAssignmentPage, {
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

	setSelection(faceKey, selection) {
		this.controller.setSelection(faceKey, selection);
	}

	bindSelection(faceKey) {
		this.controller.bindSelection(faceKey);
	}

	unbindPart(faceKey, partId, componentIds) {
		this.controller.unbindPart(faceKey, partId, componentIds);
	}

	save() {
		return this.controller.save();
	}

	accept() {
		return this.controller.accept();
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
}

new SourceAssignmentView();
