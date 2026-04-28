import { Service } from '@polylith/core';
import SemanticReviewModel from './models/SemanticReviewModel.js';

export default class SourceAssignmentModel extends Service {
	constructor(registry) {
		super('source-assignment-model', registry);
		this.implement([
			'sourceAssignmentFaces',
			'sourceAssignmentSummary',
			'bindSourceSemanticPart',
			'unbindSourceSemanticPart',
			'sourceBindingActions',
		]);
	}

	sourceAssignmentFaces({ sourceAcceptance, referenceStructure, sourceSemanticBindings, sourceSemanticPartStates }) {
		return SemanticReviewModel.sourceAssignmentFaces({
			sourceAcceptance,
			referenceStructure,
			sourceSemanticBindings,
			sourceSemanticPartStates,
		});
	}

	sourceAssignmentSummary({ sourceAcceptance, referenceStructure, sourceSemanticBindings, sourceSemanticPartStates }) {
		return SemanticReviewModel.sourceAssignmentReviewSummary(
			sourceAcceptance,
			referenceStructure,
			sourceSemanticBindings,
			sourceSemanticPartStates,
		);
	}

	bindSourceSemanticPart({ sourceSemanticBindings, sourceSemanticPartStates, faceKey, partId, componentIds }) {
		const nextBindings = structuredClone(sourceSemanticBindings || {});
		const nextPartStates = structuredClone(sourceSemanticPartStates || {});
		const selectedComponentIds = new Set(componentIds);
		const faceBindings = { ...(nextBindings[faceKey] || {}) };
		const facePartStates = { ...(nextPartStates[faceKey] || {}) };
		const previousPartIds = new Set();

		for (const componentId of selectedComponentIds) {
			const previousBinding = faceBindings[componentId];
			if (previousBinding?.partId && previousBinding.partId !== partId) {
				previousPartIds.add(previousBinding.partId);
			}

			faceBindings[componentId] = {
				partId,
				strength: 'strong',
			};
		}

		delete facePartStates[partId];
		for (const previousPartId of previousPartIds) {
			if (sourceBindingComponentIdsForPart(faceBindings, previousPartId).length === 0) {
				facePartStates[previousPartId] = noSourceBindingRecord();
			}
		}

		nextBindings[faceKey] = faceBindings;
		nextPartStates[faceKey] = facePartStates;

		return {
			sourceSemanticBindings: nextBindings,
			sourceSemanticPartStates: nextPartStates,
		};
	}

	unbindSourceSemanticPart({ sourceSemanticBindings, sourceSemanticPartStates, faceKey, partId: _partId, componentIds = [] }) {
		const nextBindings = structuredClone(sourceSemanticBindings || {});
		const nextPartStates = structuredClone(sourceSemanticPartStates || {});
		const faceBindings = { ...(nextBindings[faceKey] || {}) };
		const facePartStates = { ...(nextPartStates[faceKey] || {}) };
		const selectedComponentIds = new Set(componentIds || []);
		const affectedPartIds = new Set();

		for (const componentId of selectedComponentIds) {
			const binding = faceBindings[componentId];
			if (!binding?.partId) {
				continue;
			}

			affectedPartIds.add(binding.partId);
			faceBindings[componentId] = noSourceBindingRecord();
		}

		for (const affectedPartId of affectedPartIds) {
			if (sourceBindingComponentIdsForPart(faceBindings, affectedPartId).length === 0) {
				facePartStates[affectedPartId] = noSourceBindingRecord();
			}
		}

		nextBindings[faceKey] = faceBindings;
		nextPartStates[faceKey] = facePartStates;

		return {
			sourceSemanticBindings: nextBindings,
			sourceSemanticPartStates: nextPartStates,
		};
	}

	sourceBindingActions({ previousBindings, nextBindings }) {
		const actionsByFace = {};
		const faceKeys = new Set([
			...Object.keys(previousBindings || {}),
			...Object.keys(nextBindings || {}),
		]);

		for (const faceKey of faceKeys) {
			const faceActions = sourceBindingActionsForFace(previousBindings?.[faceKey] || {}, nextBindings?.[faceKey] || {});
			if (Object.keys(faceActions).length > 0) {
				actionsByFace[faceKey] = faceActions;
			}
		}

		return actionsByFace;
	}
}

function sourceBindingComponentIdsForPart(bindings, partId) {
	return Object.entries(bindings || {})
		.filter(([, binding]) => binding?.partId === partId && binding.strength !== 'none')
		.map(([componentId]) => componentId);
}

function noSourceBindingRecord() {
	return {
		strength: 'none',
		reviewStatus: 'needs-review',
	};
}

function sourceBindingActionsForFace(previousBindings, nextBindings) {
	const actions = {};
	const componentIds = new Set([
		...Object.keys(previousBindings || {}),
		...Object.keys(nextBindings || {}),
	]);

	for (const componentId of componentIds) {
		const previous = bindingActionIdentity(previousBindings?.[componentId]);
		const next = bindingActionIdentity(nextBindings?.[componentId]);

		if (previous.partId === next.partId && previous.bound === next.bound) {
			continue;
		}

		actions[componentId] = next.bound
			? {
				componentId,
				action: 'bind',
				partId: next.partId,
			}
			: {
				componentId,
				action: 'unbind',
			};
	}

	return actions;
}

function bindingActionIdentity(binding) {
	const partId = binding?.partId || '';
	const bound = Boolean(partId && binding?.strength !== 'none');

	return {
		partId: bound ? partId : '',
		bound,
	};
}

new SourceAssignmentModel();
