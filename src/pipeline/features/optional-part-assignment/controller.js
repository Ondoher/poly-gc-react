import { Service } from '@polylith/core';

const SOURCE_ASSIGNMENT_PAGE_ID = 'source-assignment';

export default class OptionalPartAssignmentController extends Service {
	constructor(registry) {
		super('optional-part-assignment-controller', registry);
		this.implement([
			'ready',
			'mount',
			'getState',
			'setTilesetId',
			'assetUrl',
			'load',
			'rebuild',
			'saveBindingActions',
			'reset',
			'accept',
			'showFirstReviewFace',
			'dismissMessageDialog',
		]);
	}

	ready() {
		this.pages = this.registry.subscribe('app-pages');
		this.views = this.registry.subscribe('views');
		this.app = this.registry.subscribe('app-controller');
		this.model = this.registry.subscribe('optional-part-assignment-model');
		this.pipeline = this.registry.subscribe('server-model');
		this.state = this.initialState();

		this.pages.add({
			id: 'optional-part-assignment',
			label: 'Optional Parts',
			urlSlug: 'optional-parts',
			route: '/pipeline/optional-parts',
			order: 10,
			controller: 'optional-part-assignment-controller',
		});
	}

	initialState() {
		return {
			tilesetId: '',
			optionalPartAssignment: null,
			path: '',
			status: 'Optional part assignment is ready.',
			processing: false,
			processingLabel: '',
			messageDialog: null,
		};
	}

	mount() {
		return this.views.get('optional-part-assignment', {
			controller: this,
		});
	}

	getState() {
		return {
			...this.state,
			summary: this.model.summary(this.state.optionalPartAssignment),
		};
	}

	setTilesetId(tilesetId) {
		if (!tilesetId || tilesetId === this.state.tilesetId) {
			return;
		}

		this.setState({
			tilesetId,
			optionalPartAssignment: null,
			path: '',
			status: `Optional part assignment is ready for ${tilesetId}.`,
			processing: false,
			processingLabel: '',
			messageDialog: null,
		});
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
		if (!force && (this.state.processing || this.state.optionalPartAssignment)) {
			return;
		}

		this.setState({
			processing: true,
			processingLabel: quiet ? '' : 'Loading optional parts',
			...(quiet ? {} : { status: 'Loading optional part assignment...' }),
		});

		try {
			const result = await this.pipeline.loadOptionalPartAssignment(this.state.tilesetId);

			this.setState({
				optionalPartAssignment: result,
				path: result.path || '',
				status: result.faces
					? `${Object.keys(result.faces).length} optional assignment faces loaded`
					: 'No optional part assignment loaded',
			});
		} catch (error) {
			this.setState({ status: `Load failed: ${error.message}` });
		} finally {
			this.setState({ processing: false, processingLabel: '' });
		}
	}

	async rebuild(bulkOptions = {}, manualAssignments = {}) {
		this.setState({
			processing: true,
			processingLabel: 'Rebuilding optional part assignment',
			status: 'Saving optional part settings and rebuilding...',
		});

		try {
			const result = await this.pipeline.rebuildOptionalPartAssignment({
				tilesetId: this.state.tilesetId,
				bulkOptions,
				manualAssignments: { faces: manualAssignments },
			});

			if (!result.ok) {
				throw new Error(result.stderr || result.error || 'Optional assignment rebuild failed.');
			}

			this.setState({
				optionalPartAssignment: null,
				status: 'Optional part assignment rebuilt; reloading review data...',
			});
			await this.load({ force: true, quiet: true });
		} catch (error) {
			this.setState({ status: `Rebuild failed: ${error.message}` });
		} finally {
			this.setState({ processing: false, processingLabel: '' });
		}
	}

	async saveBindingActions(actionsByFace = {}) {
		if (!this.state.optionalPartAssignment?.faces) {
			this.setState({ status: 'No optional part assignment loaded' });
			return null;
		}

		const result = await this.pipeline.saveOptionalPartBindingActions({
			tilesetId: this.state.tilesetId,
			currencyDate: this.state.optionalPartAssignment.currencyDate,
			actionsByFace,
		});

		this.setState({
			optionalPartAssignment: {
				...this.state.optionalPartAssignment,
				currencyDate: result.currencyDate || this.state.optionalPartAssignment.currencyDate,
				sourceStateUpdatedOn: result.sourceStateUpdatedOn || result.currencyDate || this.state.optionalPartAssignment.sourceStateUpdatedOn,
			},
			status: `Saved optional bindings for ${result.updatedFaceCount || 0} face${result.updatedFaceCount === 1 ? '' : 's'}`,
		});

		return result;
	}

	async saveBindingActionsAndReload(actionsByFace = {}) {
		const result = await this.saveBindingActions(actionsByFace);
		if (result?.ok) {
			await this.load({ force: true, quiet: true });
		}
		return result;
	}

	async reset() {
		this.setState({
			processing: true,
			processingLabel: 'Resetting optional parts',
			status: `Resetting ${this.state.tilesetId} and rerunning normalization...`,
			optionalPartAssignment: null,
			path: '',
			messageDialog: null,
		});

		try {
			const result = await this.pipeline.resetOptionalPartAssignment(this.state.tilesetId);

			if (!result.ok) {
				throw new Error(result.optionalPartAssignment?.stderr || result.normalization?.stderr || result.intake?.stderr || result.message || 'Optional part reset failed.');
			}

			this.setState({
				status: `Reset ${result.tilesetId || this.state.tilesetId}; reloading optional assignment...`,
			});
			await this.load({ force: true, quiet: true });
		} catch (error) {
			this.setState({ status: `Reset failed: ${error.message}` });
		} finally {
			this.setState({ processing: false, processingLabel: '' });
		}
	}

	async accept() {
		if (!this.state.optionalPartAssignment?.faces) {
			this.setState({ status: 'No optional part assignment loaded' });
			return;
		}

		this.setState({
			processing: true,
			processingLabel: 'Accepting optional parts',
			status: 'Accepting optional part assignment...',
		});

		try {
			const result = await this.pipeline.acceptOptionalPartAssignment({
				tilesetId: this.state.tilesetId,
				currencyDate: this.state.optionalPartAssignment.currencyDate,
			});

			this.setState({
				status: result.message || `Accepted ${result.acceptedFaceCount || 0} optional faces`,
				messageDialog: !result.ok ? {
					title: 'Optional Parts',
					message: result.stderr || result.message || 'Optional part acceptance did not complete cleanly.',
				} : null,
			});

			if (result.ok) {
				await this.openSourceAssignment();
			} else {
				await this.load({ force: true, quiet: true });
			}
		} catch (error) {
			this.setState({ status: `Accept failed: ${error.message}` });
		} finally {
			this.setState({ processing: false, processingLabel: '' });
		}
	}

	async openSourceAssignment() {
		const sourceAssignment = this.registry.subscribe('source-assignment-controller');

		if (sourceAssignment) {
			await sourceAssignment.load({ force: true, quiet: true });
		}

		const page = this.app.requestPage(SOURCE_ASSIGNMENT_PAGE_ID);

		if (!page) {
			this.setState({ status: 'Optional parts accepted, but the Assignment page is not available.' });
		}
	}

	showFirstReviewFace() {
		const face = this.model.assignmentFaces(this.state.optionalPartAssignment)
			.find((candidateFace) => candidateFace.status === 'needs-review');

		if (!face) {
			this.setState({ status: 'No optional faces need review' });
			return;
		}

		this.setState({ status: `Selected ${face.faceKey}` }, () => scrollReviewItemIntoView('face', face.faceKey));
	}

	dismissMessageDialog() {
		this.setState({ messageDialog: null });
	}

	assetUrl(path) {
		return this.pipeline.assetUrl(path);
	}
}

function scrollReviewItemIntoView(type, faceKey) {
	const selector = `[data-review-${type}="${cssEscape(faceKey)}"]`;
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

new OptionalPartAssignmentController();
