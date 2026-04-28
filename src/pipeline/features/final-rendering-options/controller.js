import { Service } from '@polylith/core';

const BASE_TILE_SELECTION_PAGE_ID = 'asset-base-tile-selection';

export default class FinalRenderingOptionsController extends Service {
	constructor(registry) {
		super('final-rendering-options-controller', registry);
		this.implement([
			'ready',
			'mount',
			'getState',
			'setTilesetId',
			'assetUrl',
			'referenceImageUrl',
			'load',
			'rerender',
			'accept',
			'dismissMessageDialog',
		]);
	}

	ready() {
		this.pages = this.registry.subscribe('app-pages');
		this.views = this.registry.subscribe('views');
		this.app = this.registry.subscribe('app-controller');
		this.pipeline = this.registry.subscribe('server-model');
		this.state = this.initialState();

		this.pages.add({
			id: 'final-rendering-options',
			label: 'Render Review',
			urlSlug: 'render-review',
			route: '/pipeline/render-review',
			order: 30,
			controller: 'final-rendering-options-controller',
		});
	}

	initialState() {
		return {
			tilesetId: '',
			finalRenderingOptions: null,
			path: '',
			status: 'Render review is ready.',
			processing: false,
			processingLabel: '',
			messageDialog: null,
		};
	}

	mount() {
		return this.views.get('final-rendering-options', {
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
			finalRenderingOptions: null,
			path: '',
			status: `Render review is ready for ${tilesetId}.`,
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
		if (!force && (this.state.processing || this.state.finalRenderingOptions)) {
			return;
		}

		this.setState({
			processing: true,
			processingLabel: quiet ? '' : 'Loading render review',
			...(quiet ? {} : { status: 'Loading render review...' }),
		});

		try {
			const result = await this.pipeline.loadFinalRenderingOptions(this.state.tilesetId);

			this.setState({
				finalRenderingOptions: result,
				path: result.path || '',
				tilesetId: result.tilesetId || this.state.tilesetId,
				status: `${Object.keys(result.faces || {}).length} ${result.tilesetId || this.state.tilesetId} final rendering faces loaded`,
			});
		} catch (error) {
			this.setState({
				finalRenderingOptions: null,
				path: '',
				status: `Final rendering load failed: ${error.message}`,
			});
		} finally {
			this.setState({ processing: false, processingLabel: '' });
		}
	}

	async rerender(options = {}) {
		if (!this.state.finalRenderingOptions?.faces) {
			this.setState({ status: 'No final rendering options loaded' });
			return;
		}

		this.setState({
			processing: true,
			processingLabel: 'Rerendering final output',
			status: 'Rerendering final output...',
		});

		try {
			const result = await this.pipeline.rerenderFinalRenderingOptions({
				tilesetId: this.state.tilesetId,
				options,
			});

			this.setState({
				status: result.ok ? 'Final rendering rebuilt' : 'Final rendering failed; inspect process output',
				messageDialog: result.ok ? null : {
					title: 'Final Rendering',
					message: result.stderr || result.error || 'Final rendering did not complete cleanly.',
				},
			});

			if (result.ok) {
				await this.load({ force: true, quiet: true });
			}
		} catch (error) {
			this.setState({ status: `Final rendering failed: ${error.message}` });
		} finally {
			this.setState({ processing: false, processingLabel: '' });
		}
	}

	async accept(options = {}) {
		if (!this.state.finalRenderingOptions?.faces) {
			this.setState({ status: 'No final rendering options loaded' });
			return;
		}

		this.setState({
			processing: true,
			processingLabel: 'Accepting render review',
			status: 'Rendering and accepting final render review...',
		});

		try {
			const rerenderResult = await this.pipeline.rerenderFinalRenderingOptions({
				tilesetId: this.state.tilesetId,
				options,
			});

			if (!rerenderResult.ok) {
				this.setState({
					status: 'Final rendering failed; inspect process output',
					messageDialog: {
						title: 'Final Rendering',
						message: rerenderResult.stderr || rerenderResult.error || 'Final rendering did not complete cleanly.',
					},
				});
				return;
			}

			const result = await this.pipeline.acceptFinalRenderingOptions({
				tilesetId: this.state.tilesetId,
				options,
			});

			this.setState({
				status: `Accepted final rendering options for ${result.acceptedFaceCount || 0} faces`,
				messageDialog: result.ok ? null : {
					title: 'Render Review',
					message: result.stderr || result.message || 'Render review acceptance did not complete cleanly.',
				},
			});
			if (result.ok) {
				await this.openBaseTileSelection();
			} else {
				await this.load({ force: true, quiet: true });
			}
		} catch (error) {
			this.setState({ status: `Final rendering acceptance failed: ${error.message}` });
		} finally {
			this.setState({ processing: false, processingLabel: '' });
		}
	}

	async openBaseTileSelection() {
		const page = this.app.requestPage(BASE_TILE_SELECTION_PAGE_ID);

		if (!page) {
			this.setState({ status: 'Render review accepted, but the Base Tile page is not available.' });
			return;
		}

		const baseTileSelection = this.registry.subscribe('asset-base-tile-selection-controller');

		if (baseTileSelection) {
			await baseTileSelection.load({ force: true, quiet: true });
		}
	}

	dismissMessageDialog() {
		this.setState({ messageDialog: null });
	}

	assetUrl(path) {
		return this.pipeline.assetUrl(path);
	}

	referenceImageUrl(faceKey) {
		return this.pipeline.referenceImageUrl(faceKey);
	}
}

new FinalRenderingOptionsController();
