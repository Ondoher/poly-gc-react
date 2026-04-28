import React from 'react';
import { Service } from '@polylith/core';
import OptionalPartAssignmentPage from '../components/OptionalPartAssignmentPage.jsx';

export default class OptionalPartAssignmentView extends Service {
	constructor(registry) {
		super('optional-part-assignment-view', registry);
		this.implement([
			'ready',
			'getComponent',
			'getState',
			'assetUrl',
			'load',
			'rebuild',
			'saveBindingActions',
			'saveBindingActionsAndReload',
			'reset',
			'accept',
			'showFirstReviewFace',
			'dismissMessageDialog',
		]);
	}

	ready() {
		this.views = this.registry.subscribe('views');
		this.controller = this.registry.subscribe('optional-part-assignment-controller');
		this.controller.listen('updated', (state) => this.fire('updated', state));
		this.views.add('optional-part-assignment', this.serviceName);
	}

	getComponent() {
		return React.createElement(OptionalPartAssignmentPage, {
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

	rebuild(bulkOptions, manualAssignments) {
		return this.controller.rebuild(bulkOptions, manualAssignments);
	}

	saveBindingActions(actionsByFace) {
		return this.controller.saveBindingActions(actionsByFace);
	}

	saveBindingActionsAndReload(actionsByFace) {
		return this.controller.saveBindingActionsAndReload(actionsByFace);
	}

	reset() {
		return this.controller.reset();
	}

	accept() {
		return this.controller.accept();
	}

	showFirstReviewFace() {
		this.controller.showFirstReviewFace();
	}

	dismissMessageDialog() {
		this.controller.dismissMessageDialog();
	}
}

new OptionalPartAssignmentView();
