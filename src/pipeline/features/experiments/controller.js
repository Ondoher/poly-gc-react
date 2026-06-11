import { Service } from '@polylith/core';

export default class ExperimentsController extends Service {
	constructor(registry) {
		super('experiments-controller', registry);
		this.implement([
			'ready',
			'mount',
			'getState',
			'setTilesetId',
			'assetUrl',
			'load',
			'generate',
			'dismissMessageDialog',
		]);
	}

	ready() {
		this.pages = this.registry.subscribe('app-pages');
		this.views = this.registry.subscribe('views');
		this.pipeline = this.registry.subscribe('server-model');
		this.state = this.initialState();

		this.pages.add({
			id: 'experiments',
			label: 'Experiments',
			urlSlug: 'experiments',
			route: '/pipeline/experiments',
			order: 70,
			controller: 'experiments-controller',
		});
	}

	initialState() {
		return {
			tilesetId: '',
			experiment: null,
			status: 'Experiments are ready.',
			processing: false,
			processingLabel: '',
			messageDialog: null,
		};
	}

	mount() {
		return this.views.get('experiments', {
			controller: this,
		});
	}

	getState() {
		return { ...this.state };
	}

	setTilesetId(tilesetId) {
		if (!tilesetId || tilesetId === this.state.tilesetId) {
			return;
		}

		this.setState({
			tilesetId,
			experiment: null,
			status: `Experiments are ready for ${tilesetId}.`,
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
		if (!force && (this.state.processing || this.state.experiment)) {
			return;
		}

		this.setState({
			processing: true,
			processingLabel: quiet ? '' : 'Loading experiments',
			...(quiet ? {} : { status: 'Loading experiments...' }),
		});

		try {
			const result = await this.pipeline.loadCutterSimplificationExperiment(this.state.tilesetId);
			this.setState({
				experiment: result,
				tilesetId: result.tilesetId || this.state.tilesetId,
				status: `${result.variants?.length || 0} cutter simplification variants loaded`,
			});
		} catch (error) {
			this.setState({
				experiment: null,
				status: `Experiment load failed: ${error.message}`,
				messageDialog: {
					title: 'Experiments',
					message: error.message,
				},
			});
		} finally {
			this.setState({ processing: false, processingLabel: '' });
		}
	}

	async generate() {
		if (!this.state.tilesetId) {
			this.setState({ status: 'No tileset selected for experiments.' });
			return null;
		}
		const faceKey = this.state.experiment?.faceKey || 'experiment';

		this.setState({
			processing: true,
			processingLabel: `Generating ${faceKey} experiment tiles`,
			status: `Generating ${faceKey} experiment tiles...`,
			messageDialog: null,
		});

		try {
			const result = await this.pipeline.generateCutterSimplificationExperiment(this.state.tilesetId);
			this.setState({
				experiment: result,
				status: `${result.generated?.length || 0} ${result.faceKey || faceKey} experiment tiles generated`,
			});
			return result;
		} catch (error) {
			this.setState({
				status: `Experiment generation failed: ${error.message}`,
				messageDialog: {
					title: 'Experiment Generation',
					message: error.message,
				},
			});
			return null;
		} finally {
			this.setState({ processing: false, processingLabel: '' });
		}
	}

	assetUrl(path, cacheKey = '') {
		return this.pipeline.assetUrl(path, cacheKey);
	}

	dismissMessageDialog() {
		this.setState({ messageDialog: null });
	}
}

new ExperimentsController();
