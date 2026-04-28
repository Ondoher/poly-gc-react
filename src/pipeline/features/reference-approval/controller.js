import React from 'react';
import { Service } from '@polylith/core';

export default class ReferenceApprovalController extends Service {
	constructor(registry) {
		super('reference-approval-controller', registry);
		this.implement([
			'ready',
			'mount',
			'getState',
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
			'assetUrl',
			'paletteColorSet',
			'partLabel',
			'referenceColorSwatch',
			'sortComponentsForReview',
		]);
	}

	ready() {
		this.pages = this.registry.subscribe('app-pages');
		this.views = this.registry.subscribe('views');
		this.model = this.registry.subscribe('reference-approval-model');
		this.pipeline = this.registry.subscribe('server-model');
		this.state = this.initialState();

		this.pages.add({
			id: 'reference-approval',
			label: 'Reference',
			urlSlug: 'reference',
			route: '/pipeline/reference',
			order: 0,
			controller: 'reference-approval-controller',
		});
	}

	initialState() {
		return {
			structure: null,
			path: '',
			selection: {
				faceKey: '',
				partId: '',
				componentIds: [],
				componentSelectionExplicit: false,
			},
			highlightUnboundComponents: false,
			highlightUnboundParts: false,
			dirty: false,
			status: 'Reference approval is ready.',
			processing: false,
			processingLabel: '',
			messageDialog: null,
		};
	}

	mount() {
		return this.views.get('reference-approval', {
			controller: this,
		});
	}

	getState() {
		return {
			...this.state,
			summary: this.model.summary(this.state.structure),
		};
	}

	setState(updates, callback = null) {
		this.state = {
			...this.state,
			...updates,
		};
		this.fire('updated', this.getState());
		callback?.();
	}

	async load({ force = false, quiet = false } = {}) {
		if (!force && (this.state.processing || this.state.structure)) {
			return;
		}

		if (!force && this.state.dirty && !window.confirm('Reference structure has unsaved changes. Reload and discard them?')) {
			this.setState({ status: 'Reload cancelled; unsaved changes remain' });
			return;
		}

		this.setState({
			processing: true,
			processingLabel: quiet ? '' : 'Loading reference structure',
			...(quiet ? {} : { status: 'Loading reference structure...' }),
		});

		try {
			const result = await this.pipeline.loadReferenceStructure();
			const structure = result.structure || null;
			const selection = this.model.initialSelection(structure);

			this.setState({
				structure,
				path: result.path || '',
				selection,
				highlightUnboundComponents: false,
				highlightUnboundParts: false,
				dirty: false,
				status: structure?.faces
					? `${Object.keys(structure.faces).length} reference faces loaded`
					: 'No reference structure loaded',
			}, () => {
				if (selection.faceKey) {
					scrollReviewItemIntoView('face', selection.faceKey);
				}
			});
		} catch (error) {
			this.setState({
				status: `Load failed: ${error.message}`,
			});
		} finally {
			this.setState({ processing: false, processingLabel: '' });
		}
	}

	async saveDraft(structure = this.state.structure, options = {}) {
		const actionLabel = options.actionLabel || 'Saving reference structure';

		this.setState({
			processing: true,
			processingLabel: actionLabel,
			status: `${actionLabel}...`,
		});

		try {
			const result = await this.pipeline.saveReferenceStructure(structure);
			this.setState({
				structure: result.structure || this.state.structure,
				path: result.path || this.state.path,
				dirty: false,
				status: result.ok ? (options.successStatus || `Saved ${result.path}`) : 'Save failed',
			});
		} catch (error) {
			this.setState({ status: `Save failed: ${error.message}` });
		} finally {
			this.setState({ processing: false, processingLabel: '' });
		}
	}

	async accept() {
		const { structure } = this.state;
		const summary = this.model.summary(structure);

		if (!structure) {
			this.setState({ status: 'No reference structure loaded' });
			return;
		}

		if (summary.unboundPartCount > 0) {
			const message = `Cannot accept reference structure: ${summary.unboundPartCount} semantic parts are unbound.`;
			this.setState({
				highlightUnboundParts: true,
				highlightUnboundComponents: true,
				messageDialog: {
					title: 'Unbound Parts',
					message,
				},
				status: message,
			});
			return;
		}

		if (
			summary.unboundComponentCount > 0
			&& !window.confirm(`${summary.unboundComponentCount} detected components are unbound. Accept reference structure anyway?`)
		) {
			this.setState({
				highlightUnboundComponents: true,
				status: 'Acceptance cancelled; highlighting unbound components',
			});
			return;
		}

		if (
			summary.unknownPaletteColorCount > 0
			&& !window.confirm(`${summary.unknownPaletteColorCount} unique colors are not in the active palette: ${summary.unknownPaletteColors.join(', ')}. Accept anyway?`)
		) {
			this.setState({
				status: 'Acceptance cancelled; colors outside the active palette remain',
			});
			return;
		}

		await this.saveDraft(this.model.markAccepted(structure, summary), {
			actionLabel: 'Accepting reference structure',
			successStatus: `Accepted reference structure with ${summary.unboundComponentCount} unbound components`,
		});
	}

	setSelection(faceKey, selection = {}) {
		this.setState({
			selection: {
				faceKey,
				partId: selection.partId || '',
				componentIds: [...(selection.componentIds || [])],
				componentSelectionExplicit: selection.componentSelectionExplicit === true,
			},
		});
	}

	bindSelection(faceKey) {
		const { partId, componentIds } = this.state.selection;

		if (!partId || componentIds.length === 0) {
			return;
		}

		this.updateFace(faceKey, (face) => this.model.bindPart(face, partId, componentIds));
	}

	unbindPart(faceKey, partId, componentIds = []) {
		this.updateFace(faceKey, (face) => this.model.unbindPart(face, partId, componentIds));
	}

	addPaletteColor(color) {
		const result = this.model.addPaletteColor(this.state.structure, color);

		this.setState({
			structure: result.structure,
			dirty: true,
			status: result.color
				? `Added ${result.color} to reference palette (${result.partCount} parts, ${result.componentCount} components updated)`
				: 'No palette color was added',
		});
	}

	showFirstIncompleteFace() {
		const summary = this.model.summary(this.state.structure);
		const faceKey = summary.incompleteFaces[0];

		if (!faceKey) {
			this.setState({ status: 'No incomplete faces' });
			return;
		}

		const firstUnboundPart = summary.unboundParts.find((part) => part.faceKey === faceKey);

		this.setState({
			highlightUnboundParts: true,
			selection: {
				faceKey,
				partId: firstUnboundPart?.partId || '',
				componentIds: [],
				componentSelectionExplicit: false,
			},
			status: firstUnboundPart
				? `Selected ${faceKey} ${firstUnboundPart.partId}`
				: `Selected ${faceKey}`,
		}, () => scrollReviewItemIntoView('face', faceKey));
	}

	showFirstUnboundPart() {
		const summary = this.model.summary(this.state.structure);
		const first = summary.unboundParts[0];

		if (!first) {
			this.setState({ status: 'No unbound parts' });
			return;
		}

		this.setState({
			highlightUnboundParts: true,
			selection: {
				faceKey: first.faceKey,
				partId: first.partId,
				componentIds: [],
				componentSelectionExplicit: false,
			},
			status: `Selected ${first.faceKey} ${first.partId}`,
		}, () => scrollReviewItemIntoView('part', first.faceKey, first.partId));
	}

	showFirstUnboundComponent() {
		const summary = this.model.summary(this.state.structure);
		const first = summary.unboundComponents[0];

		if (!first) {
			this.setState({ status: 'No unbound components' });
			return;
		}

		this.setState({
			highlightUnboundComponents: true,
			selection: {
				faceKey: first.faceKey,
				partId: '',
				componentIds: [first.componentId],
				componentSelectionExplicit: true,
			},
			status: `Selected ${first.faceKey} ${first.componentId}`,
		}, () => scrollReviewItemIntoView('component', first.faceKey, first.componentId));
	}

	dismissMessageDialog() {
		this.setState({ messageDialog: null });
	}

	assetUrl(path) {
		return this.pipeline.assetUrl(path);
	}

	paletteColorSet(palette) {
		return this.model.paletteColorSet(palette);
	}

	partLabel(partId, part) {
		return this.model.partLabel(partId, part);
	}

	referenceColorSwatch(item, paletteColorSet) {
		return this.model.referenceColorSwatch(item, paletteColorSet);
	}

	sortComponentsForReview(components, partEntries) {
		return this.model.sortComponentsForReview(components, partEntries);
	}

	updateFace(faceKey, update) {
		const structure = structuredClone(this.state.structure);
		const face = structure?.faces?.[faceKey];

		if (!face) {
			return;
		}

		update(face);
		this.setState({
			structure,
			dirty: true,
			status: `${faceKey} binding updated`,
		});
	}
}

function scrollReviewItemIntoView(type, faceKey, itemId) {
	const isFace = type === 'face';
	const attribute = isFace
		? 'data-review-face'
		: type === 'part'
			? 'data-review-part'
			: 'data-review-component';
	const value = isFace ? faceKey : `${faceKey}:${itemId}`;
	const selector = `[${attribute}="${cssEscape(value)}"]`;
	const element = document.querySelector(selector);

	element?.scrollIntoView({
		behavior: 'smooth',
		block: 'center',
		inline: 'nearest',
	});
}

function cssEscape(value) {
	if (window.CSS?.escape) {
		return window.CSS.escape(value);
	}

	return String(value).replace(/["\\]/g, '\\$&');
}

new ReferenceApprovalController();
