import { Service } from '@polylith/core';

export default class AssetReviewController extends Service {
	constructor(registry) {
		super('asset-review-controller', registry);
		this.implement([
			'ready',
			'mount',
			'getState',
			'setTilesetId',
			'assetUrl',
			'load',
			'startGeneration',
			'retryFace',
			'dismissMessageDialog',
		]);
	}

	ready() {
		this.pages = this.registry.subscribe('app-pages');
		this.views = this.registry.subscribe('views');
		this.pipeline = this.registry.subscribe('server-model');
		this.assetProgress = this.registry.subscribe('asset-pipeline-progress-model');
		this.stream = this.registry.subscribe('stream');
		this.state = this.initialState();

		this.pages.add({
			id: 'asset-review',
			label: 'Asset Review',
			urlSlug: 'asset-review',
			route: '/pipeline/asset-review',
			order: 60,
			controller: 'asset-review-controller',
		});
	}

	initialState() {
		return {
			tilesetId: '',
			assetReview: null,
			summary: null,
			status: 'Asset review is ready.',
			processing: false,
			generationRunning: false,
			processingLabel: '',
			messageDialog: null,
		};
	}

	mount(options = {}) {
		this.app = options.appController || this.app || null;
		return this.views.get('asset-review', {
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
			assetReview: null,
			summary: null,
			status: `Asset review is ready for ${tilesetId}.`,
			processing: false,
			generationRunning: false,
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
		if (!force && (this.state.processing || this.state.assetReview)) {
			return;
		}

		this.setState({
			processing: true,
			processingLabel: quiet ? '' : 'Loading generated assets',
			...(quiet ? {} : { status: 'Loading generated assets...' }),
		});

		try {
			const result = await this.pipeline.loadAssetReview(this.state.tilesetId);

			this.setState({
				assetReview: result,
				summary: result.summary || null,
				tilesetId: result.tilesetId || this.state.tilesetId,
				status: `${result.summary?.faceCount || 0} generated tile assets loaded`,
			});
			await this.subscribeProgress();
		} catch (error) {
			this.setState({
				assetReview: null,
				summary: null,
				status: `Asset review load failed: ${error.message}`,
				messageDialog: {
					title: 'Asset Review',
					message: error.message,
				},
			});
		} finally {
			this.setState({ processing: false, processingLabel: '' });
		}
	}

	assetUrl(path, cacheKey = '') {
		return this.pipeline.assetUrl(path, cacheKey);
	}

	async startGeneration({ quiet = false, faceKeys = [] } = {}) {
		if (!this.state.tilesetId) {
			this.setState({ status: 'No tileset selected for asset generation.' });
			return;
		}

		const cleanFaceKeys = cleanFaceKeysForRequest(faceKeys);
		await this.subscribeProgress();
		for (const faceKey of cleanFaceKeys) {
			this.updateFace(faceKey, (face) => this.assetProgress.applyGenerationEventToReviewFace(face, {
				faceKey,
				status: 'queued',
			}));
		}
		this.setState({
			...(quiet ? {} : { status: cleanFaceKeys.length === 1 ? `Queued ${cleanFaceKeys[0]} for asset generation...` : 'Starting asset generation...' }),
			generationRunning: true,
			messageDialog: null,
		});

		this.generationPromise = this.pipeline.startAssetGeneration({
			tilesetId: this.state.tilesetId,
			faceKeys: cleanFaceKeys,
		}).then(async (result) => {
			this.setState({
				generationRunning: false,
				status: result.summary
					? `${result.summary.readyCount || 0} generated tile assets ready`
					: 'Asset generation completed.',
			});
			await this.load({ force: true, quiet: true });
			return result;
		}).catch((error) => {
			this.setState({
				generationRunning: false,
				status: `Asset generation failed: ${error.message}`,
				messageDialog: {
					title: 'Asset Generation',
					message: error.message,
				},
			});
			return null;
		});

		return this.generationPromise;
	}

	retryFace(faceKey) {
		const cleanFaceKey = String(faceKey || '').trim();
		if (!cleanFaceKey) {
			return null;
		}

		return this.startGeneration({
			quiet: true,
			faceKeys: [cleanFaceKey],
		});
	}

	async subscribeProgress() {
		const tilesetId = this.state.tilesetId;

		if (!tilesetId || this.progressSubscribedFor === tilesetId) {
			return;
		}

		const watch = async () => {
			const result = await this.stream.get(this.assetProgress.namespace(), 'watchAssetPipeline', {
				tilesetId,
			});
			if (result?.snapshot) {
				this.onProgressEvent(result.snapshot);
			}
		};

		await watch();
		await this.stream.on(this.assetProgress.namespace(), 'connect', watch);
		await this.stream.on(this.assetProgress.namespace(), 'assetGenerationSnapshot', this.onProgressEvent.bind(this));
		await this.stream.on(this.assetProgress.namespace(), 'assetGenerationStarted', this.onProgressEvent.bind(this));
		await this.stream.on(this.assetProgress.namespace(), 'assetGenerationProgress', this.onProgressEvent.bind(this));
		await this.stream.on(this.assetProgress.namespace(), 'assetGenerationFaceReady', this.onFaceReady.bind(this));
		await this.stream.on(this.assetProgress.namespace(), 'assetGenerationComplete', this.onGenerationComplete.bind(this));
		await this.stream.on(this.assetProgress.namespace(), 'assetGenerationFailed', this.onProgressEvent.bind(this));
		this.progressSubscribedFor = tilesetId;
	}

	onProgressEvent(event = {}) {
		if (event.tilesetId && event.tilesetId !== this.state.tilesetId) {
			return;
		}

		if (!event.faceKey) {
			if (event.eventName === 'assetGenerationStarted') {
				this.load({ force: true, quiet: true });
			}
			return;
		}

		this.updateFace(event.faceKey, (face) => {
			return this.assetProgress.applyGenerationEventToReviewFace(face, event);
		});
	}

	async onFaceReady(event = {}) {
		if (event.tilesetId && event.tilesetId !== this.state.tilesetId) {
			return;
		}

		if (event.faceKey) {
			this.updateFace(event.faceKey, (face) => this.assetProgress.markReviewFaceReady(face));
		}
		await this.load({ force: true, quiet: true });
	}

	async onGenerationComplete(event = {}) {
		if (event.tilesetId && event.tilesetId !== this.state.tilesetId) {
			return;
		}

		await this.load({ force: true, quiet: true });
	}

	updateFace(faceKey, updater) {
		const review = this.state.assetReview;
		if (!review?.faces) {
			return;
		}

		const faces = review.faces.map((face) => {
			return face.faceKey === faceKey ? updater(face) : face;
		});
		const summary = this.assetProgress.summarizeReviewFaces(faces);

		this.setState({
			assetReview: {
				...review,
				faces,
				summary,
			},
			summary,
		});
	}

	dismissMessageDialog() {
		this.setState({ messageDialog: null });
	}
}

new AssetReviewController();

function cleanFaceKeysForRequest(faceKeys) {
	return [...new Set([].concat(faceKeys || [])
		.map((faceKey) => String(faceKey || '').trim())
		.filter(Boolean))]
		.sort((left, right) => left.localeCompare(right));
}
