import { Service } from '@polylith/core';

const RENDER_REVIEW_PAGE_ID = 'final-rendering-options';

export default class SourceAssignmentController extends Service {
	constructor(registry) {
		super('source-assignment-controller', registry);
		this.implement([
			'ready',
			'mount',
			'getState',
			'setTilesetId',
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
		this.pages = this.registry.subscribe('app-pages');
		this.views = this.registry.subscribe('views');
		this.app = this.registry.subscribe('app-controller');
		this.model = this.registry.subscribe('source-assignment-model');
		this.pipeline = this.registry.subscribe('server-model');
		this.state = this.initialState();

		this.pages.add({
			id: 'source-assignment',
			label: 'Assignment',
			urlSlug: 'assignment',
			route: '/pipeline/assignment',
			order: 20,
			controller: 'source-assignment-controller',
		});
	}

	initialState() {
		return {
			tilesetId: '',
			referenceStructure: null,
			referenceStructurePath: '',
			sourceAcceptance: null,
			sourceAcceptancePath: '',
			sourceSemanticBindings: {},
			sourceSemanticPartStates: {},
			loadedSourceSemanticBindings: {},
			selection: {
				faceKey: '',
				partId: '',
				componentIds: [],
				componentSelectionExplicit: false,
			},
			highlightUnboundComponents: false,
			highlightUnboundParts: false,
			dirty: false,
			status: 'Source assignment is ready.',
			processing: false,
			processingLabel: '',
			messageDialog: null,
		};
	}

	mount() {
		return this.views.get('source-assignment', {
			controller: this,
		});
	}

	getState() {
		return {
			...this.state,
			summary: this.summary(),
		};
	}

	setTilesetId(tilesetId) {
		if (!tilesetId || tilesetId === this.state.tilesetId) {
			return;
		}

		this.setState({
			tilesetId,
			referenceStructure: null,
			referenceStructurePath: '',
			sourceAcceptance: null,
			sourceAcceptancePath: '',
			sourceSemanticBindings: {},
			sourceSemanticPartStates: {},
			loadedSourceSemanticBindings: {},
			selection: {
				faceKey: '',
				partId: '',
				componentIds: [],
				componentSelectionExplicit: false,
			},
			highlightUnboundComponents: false,
			highlightUnboundParts: false,
			dirty: false,
			status: `Source assignment is ready for ${tilesetId}.`,
			processing: false,
			processingLabel: '',
			messageDialog: null,
		});
	}

	summary() {
		return this.model.sourceAssignmentSummary(this.state);
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
		if (!force && (this.state.processing || this.state.sourceAcceptance)) {
			return;
		}

		this.setState({
			processing: true,
			processingLabel: quiet ? '' : 'Loading source assignment',
			...(quiet ? {} : { status: 'Loading source assignment...' }),
		});

		try {
			const [referenceResult, sourceResult] = await Promise.all([
				this.pipeline.loadReferenceStructure(),
				this.pipeline.loadSourceAssignment(this.state.tilesetId),
			]);

			this.setState({
				referenceStructure: referenceResult.structure || null,
				referenceStructurePath: referenceResult.path || '',
				sourceAcceptance: sourceResult,
				sourceAcceptancePath: sourceResult.path || '',
				tilesetId: sourceResult.tilesetId || this.state.tilesetId,
				sourceSemanticBindings: sourceResult.sourceSemanticBindings || {},
				sourceSemanticPartStates: sourceResult.sourceSemanticPartStates || {},
				loadedSourceSemanticBindings: structuredClone(sourceResult.sourceSemanticBindings || {}),
				selection: {
					faceKey: '',
					partId: '',
					componentIds: [],
					componentSelectionExplicit: false,
				},
				highlightUnboundComponents: false,
				highlightUnboundParts: false,
				dirty: false,
				status: `${Object.keys(sourceResult.faces || {}).length} ${sourceResult.tilesetId || this.state.tilesetId} source faces loaded`,
			});
		} catch (error) {
			this.setState({
				sourceAcceptance: null,
				sourceAcceptancePath: '',
				sourceSemanticBindings: {},
				sourceSemanticPartStates: {},
				status: `Source load failed: ${error.message}`,
			});
		} finally {
			this.setState({ processing: false, processingLabel: '' });
		}
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

		this.setState({
			...this.model.bindSourceSemanticPart({
				sourceSemanticBindings: this.state.sourceSemanticBindings,
				sourceSemanticPartStates: this.state.sourceSemanticPartStates,
				faceKey,
				partId,
				componentIds,
			}),
			selection: { faceKey, partId: '', componentIds: [], componentSelectionExplicit: false },
			dirty: true,
			status: `${faceKey} source assignment updated`,
		});
	}

	unbindPart(faceKey, partId, componentIds = []) {
		this.setState({
			...this.model.unbindSourceSemanticPart({
				sourceSemanticBindings: this.state.sourceSemanticBindings,
				sourceSemanticPartStates: this.state.sourceSemanticPartStates,
				faceKey,
				partId,
				componentIds,
			}),
			selection: { faceKey, partId: '', componentIds: [], componentSelectionExplicit: false },
			dirty: true,
			status: `${faceKey} source assignment component${componentIds.length === 1 ? '' : 's'} unbound`,
		});
	}

	sourceWritePayload() {
		return {
			tilesetId: this.state.sourceAcceptance?.tilesetId || this.state.tilesetId,
			currencyDate: this.state.sourceAcceptance?.currencyDate || this.state.sourceAcceptance?.sourceStateUpdatedOn || '',
			actionsByFace: this.sourceBindingActions(),
		};
	}

	sourceBindingActions() {
		return this.model.sourceBindingActions({
			previousBindings: this.state.loadedSourceSemanticBindings,
			nextBindings: this.state.sourceSemanticBindings,
		});
	}

	async save() {
		if (!this.state.sourceAcceptance?.faces) {
			this.setState({ status: 'No source assignment data loaded' });
			return;
		}

		this.setState({
			processing: true,
			processingLabel: 'Saving source assignment',
			status: 'Saving source assignment and regenerating alignment...',
		});

		try {
			const result = await this.pipeline.regenerateSourceAssignment(this.sourceWritePayload());

			this.setState({
				dirty: false,
				status: result.ok
					? 'Saved source assignment and regenerated alignment and semantic assignment'
					: `Source assignment save failed during ${result.stage || 'semantic assignment'}`,
			});

			if (result.ok) {
				await this.load({ force: true, quiet: true });
			}
		} catch (error) {
			this.setState({ status: `Source assignment save failed: ${error.message}` });
		} finally {
			this.setState({ processing: false, processingLabel: '' });
		}
	}

	async accept() {
		const summary = this.summary();

		if (!this.state.sourceAcceptance?.faces) {
			this.setState({ status: 'No source assignment data loaded' });
			return;
		}

		this.setState({
			processing: true,
			processingLabel: 'Accepting source assignment',
			status: 'Accepting source assignment and running final rendering...',
		});

		try {
			const result = await this.pipeline.acceptSourceAssignment(this.sourceWritePayload());

			this.setState({
				dirty: false,
				status: result.ok
					? `Accepted source assignments for ${summary.faceCount} faces; first render is ready for review`
					: `Source assignment acceptance failed during ${result.stage || 'final rendering'}`,
			});

			if (result.ok) {
				await this.openRenderReview();
			}
		} catch (error) {
			this.setState({ status: `Source assignment acceptance failed: ${error.message}` });
		} finally {
			this.setState({ processing: false, processingLabel: '' });
		}
	}

	async openRenderReview() {
		const page = this.app.requestPage(RENDER_REVIEW_PAGE_ID);

		if (!page) {
			this.setState({ status: 'Source assignment accepted, but the Render Review page is not available.' });
			return;
		}

		const finalRendering = this.registry.subscribe('final-rendering-options-controller');

		if (finalRendering) {
			await finalRendering.load({ force: true, quiet: true });
		}
	}

	showFirstUnboundPart() {
		const first = this.summary().unboundParts[0];

		if (!first) {
			this.setState({ status: 'No unbound source parts' });
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
		const first = this.summary().unboundComponents[0];

		if (!first) {
			this.setState({ status: 'No unbound source components' });
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

new SourceAssignmentController();
