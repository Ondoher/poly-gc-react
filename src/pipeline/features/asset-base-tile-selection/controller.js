import { Service } from '@polylith/core';

const ASSET_REVIEW_PAGE_ID = 'asset-review';

export default class AssetBaseTileSelectionController extends Service {
	constructor(registry) {
		super('asset-base-tile-selection-controller', registry);
		this.implement([
			'ready',
			'mount',
			'getState',
			'setTilesetId',
			'assetUrl',
			'load',
			'selectVariant',
			'save',
			'dismissMessageDialog',
		]);
	}

	ready() {
		this.pages = this.registry.subscribe('app-pages');
		this.views = this.registry.subscribe('views');
		this.pipeline = this.registry.subscribe('server-model');
		this.state = this.initialState();

		this.pages.add({
			id: 'asset-base-tile-selection',
			label: 'Base Tile',
			urlSlug: 'base-tile',
			route: '/pipeline/base-tile',
			order: 40,
			controller: 'asset-base-tile-selection-controller',
		});
	}

	initialState() {
		return {
			tilesetId: '',
			baseTileSelection: null,
			selectedVariantId: '',
			path: '',
			status: 'Base tile selection is ready.',
			processing: false,
			processingLabel: '',
			messageDialog: null,
		};
	}

	mount(options = {}) {
		this.app = options.appController || this.app || null;
		return this.views.get('asset-base-tile-selection', {
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
			baseTileSelection: null,
			selectedVariantId: '',
			path: '',
			status: `Base tile selection is ready for ${tilesetId}.`,
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
		if (!force && (this.state.processing || this.state.baseTileSelection)) {
			return;
		}

		this.setState({
			processing: true,
			processingLabel: quiet ? '' : 'Loading base tile options',
			...(quiet ? {} : { status: 'Loading base tile options...' }),
		});

		try {
			const result = await this.pipeline.loadBaseTileSelection(this.state.tilesetId);

			this.setState({
				baseTileSelection: result,
				selectedVariantId: result.selectedVariantId || firstVariantId(result),
				path: result.path || '',
				tilesetId: result.tilesetId || this.state.tilesetId,
				status: `${result.summary?.variantCount || 0} base tile options loaded`,
			});
		} catch (error) {
			this.setState({
				baseTileSelection: null,
				selectedVariantId: '',
				path: '',
				status: `Base tile selection load failed: ${error.message}`,
			});
		} finally {
			this.setState({ processing: false, processingLabel: '' });
		}
	}

	selectVariant(variantId) {
		this.setState({
			selectedVariantId: variantId,
			status: `Selected ${variantId}`,
		});
	}

	async save() {
		if (!this.state.baseTileSelection) {
			this.setState({ status: 'No base tile options loaded' });
			return;
		}

		if (!this.state.selectedVariantId) {
			this.setState({ status: 'Select a base tile option before saving' });
			return;
		}

		this.setState({
			processing: true,
			processingLabel: 'Saving base tile selection',
			status: 'Saving base tile selection...',
		});

		try {
			const result = await this.pipeline.saveBaseTileSelection({
				tilesetId: this.state.tilesetId,
				currencyDate: this.state.baseTileSelection.currencyDate,
				variantId: this.state.selectedVariantId,
			});

			this.setState({
				status: `Saved ${result.selectedVariantId}`,
				messageDialog: null,
			});
			await this.openAssetReview();
		} catch (error) {
			this.setState({
				status: `Base tile selection save failed: ${error.message}`,
				messageDialog: {
					title: 'Base Tile Selection',
					message: error.message,
				},
			});
		} finally {
			this.setState({ processing: false, processingLabel: '' });
		}
	}

	dismissMessageDialog() {
		this.setState({ messageDialog: null });
	}

	assetUrl(path) {
		return this.pipeline.assetUrl(path);
	}

	async openAssetReview() {
		const page = this.app?.requestPage(ASSET_REVIEW_PAGE_ID);

		if (!page) {
			this.setState({ status: 'Base tile selection saved, but the Asset Review page is not available.' });
			return;
		}

		const assetReview = this.registry.subscribe('asset-review-controller');

		if (assetReview) {
			await assetReview.load({ force: true, quiet: true });
			assetReview.startGeneration({ quiet: true });
		}
	}
}

function firstVariantId(selection) {
	return selection?.variants?.[0]?.id || '';
}

new AssetBaseTileSelectionController();
