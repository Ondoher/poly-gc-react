import { Service } from '@polylith/core';

const API_BASE = 'api/pipeline';

export default class ServerModel extends Service {
	constructor(registry) {
		super('server-model', registry);
		this.implement([
			'ready',
			'assetUrl',
			'referenceImageUrl',
			'loadTilesets',
			'setActiveTileset',
			'loadMetadataState',
			'loadReferenceStructure',
			'loadOptionalPartAssignment',
			'saveOptionalPartBindingActions',
			'saveSourceAssignmentBindingActions',
			'loadSourceAssignment',
			'rebuildOptionalPartAssignment',
			'resetOptionalPartAssignment',
			'regenerateSourceAssignment',
			'preprocessMetadata',
			'recreateMetadata',
			'acceptOptionalPartAssignment',
			'acceptSourceAssignment',
			'loadFinalRenderingOptions',
			'rerenderFinalRenderingOptions',
			'acceptFinalRenderingOptions',
			'loadBaseTileSelection',
			'saveBaseTileSelection',
			'startAssetGeneration',
			'loadAssetReview',
			'saveMetadata',
			'saveReferenceStructure',
		]);
	}

	ready() {
		this.io = this.registry.subscribe('io');
	}

	assetUrl(filename, cacheKey = '') {
		const params = new URLSearchParams({ path: filename });
		if (cacheKey) {
			params.set('v', cacheKey);
		}
		return `${API_BASE}/asset?${params.toString()}`;
	}

	referenceImageUrl(faceKey) {
		return `${API_BASE}/reference/${encodeURIComponent(`${faceKey}.png`)}`;
	}

	async loadTilesets() {
		try {
			return await this.requestJson({
				url: `${API_BASE}/tilesets`,
				fallbackMessage: 'Unable to load tilesets.',
			});
		} catch (error) {
			return this.requestJson({
				url: `${API_BASE}/state?kind=tileset`,
				fallbackMessage: 'Unable to load tilesets.',
			});
		}
	}

	async setActiveTileset(tilesetId) {
		return this.requestJson({
			url: `${API_BASE}/tilesets/active`,
			method: 'POST',
			body: { tilesetId },
			fallbackMessage: 'Unable to set the active tileset.',
		});
	}

	async loadReferenceStructure() {
		return this.requestJson({
			url: `${API_BASE}/reference-structure`,
			fallbackMessage: 'Unable to load the reference structure.',
		});
	}

	async loadMetadataState({ metadataKind = 'tileset', tilesetSource = 'wiki' } = {}) {
		const params = new URLSearchParams({ kind: metadataKind });

		if (metadataKind === 'tileset') {
			params.set('source', tilesetSource);
		}

		return this.requestJson({
			url: `${API_BASE}/state?${params.toString()}`,
			fallbackMessage: 'Unable to load metadata.',
		});
	}

	async recreateMetadata({ metadataKind = 'tileset', tilesetSource = 'wiki' } = {}) {
		const params = metadataParams(metadataKind, tilesetSource);

		return this.requestJson({
			url: `${API_BASE}/recreate?${params.toString()}`,
			method: 'POST',
			fallbackMessage: 'Unable to recreate metadata.',
		});
	}

	async saveMetadata(metadata, { metadataKind = 'tileset', tilesetSource = 'wiki' } = {}) {
		const params = metadataParams(metadataKind, tilesetSource);

		return this.requestJson({
			url: `${API_BASE}/save?${params.toString()}`,
			method: 'POST',
			body: metadata,
			fallbackMessage: 'Unable to save metadata.',
		});
	}

	async preprocessMetadata(metadata, { metadataKind = 'tileset', tilesetSource = 'wiki' } = {}) {
		const params = metadataParams(metadataKind, tilesetSource);

		return this.requestJson({
			url: `${API_BASE}/preprocess?${params.toString()}`,
			method: 'POST',
			body: metadata,
			fallbackMessage: 'Unable to preprocess metadata.',
		});
	}

	async loadSourceAssignment(tilesetId = '') {
		return this.requestJson({
			url: `${API_BASE}/source-assignment?tilesetId=${encodeURIComponent(tilesetId)}`,
			fallbackMessage: 'Unable to load source assignment.',
		});
	}

	async loadOptionalPartAssignment(tilesetId = '') {
		return this.requestJson({
			url: `${API_BASE}/optional-parts?tilesetId=${encodeURIComponent(tilesetId)}`,
			fallbackMessage: 'Unable to load optional part assignment.',
		});
	}

	async rebuildOptionalPartAssignment({ tilesetId = '', bulkOptions = {}, manualAssignments = {} } = {}) {
		return this.requestJson({
			url: `${API_BASE}/optional-parts/rebuild?tilesetId=${encodeURIComponent(tilesetId)}`,
			method: 'POST',
			body: {
				bulkOptions,
				manualAssignments,
			},
			fallbackMessage: 'Unable to rebuild optional part assignment.',
		});
	}

	async saveOptionalPartBindingActions({ tilesetId = '', currencyDate = '', actionsByFace = {} } = {}) {
		return this.requestJson({
			url: `${API_BASE}/optional-parts/bindings?tilesetId=${encodeURIComponent(tilesetId)}`,
			method: 'POST',
			body: {
				tilesetId,
				currencyDate,
				actionsByFace,
			},
			fallbackMessage: 'Unable to save optional part bindings.',
		});
	}

	async saveSourceAssignmentBindingActions({ tilesetId = '', currencyDate = '', actionsByFace = {} } = {}) {
		return this.requestJson({
			url: `${API_BASE}/source-assignment/bindings?tilesetId=${encodeURIComponent(tilesetId)}`,
			method: 'POST',
			body: {
				tilesetId,
				currencyDate,
				actionsByFace,
			},
			fallbackMessage: 'Unable to save source assignment bindings.',
		});
	}

	async resetOptionalPartAssignment(tilesetId = '') {
		return this.requestJson({
			url: `${API_BASE}/optional-parts/reset?tilesetId=${encodeURIComponent(tilesetId)}`,
			method: 'POST',
			fallbackMessage: 'Unable to reset optional part assignment.',
		});
	}

	async acceptOptionalPartAssignment({ tilesetId = '', currencyDate = '' } = {}) {
		return this.requestJson({
			url: `${API_BASE}/optional-parts/accept?tilesetId=${encodeURIComponent(tilesetId)}`,
			method: 'POST',
			body: {
				tilesetId,
				currencyDate,
			},
			fallbackMessage: 'Unable to accept optional part assignment.',
		});
	}

	async saveReferenceStructure(structure) {
		return this.requestJson({
			url: `${API_BASE}/reference-structure/save`,
			method: 'POST',
			body: { structure },
			fallbackMessage: 'Unable to save the reference structure.',
		});
	}

	async regenerateSourceAssignment({ tilesetId = '', currencyDate = '', actionsByFace = {} } = {}) {
		return this.requestJson({
			url: `${API_BASE}/source-assignment/regenerate?tilesetId=${encodeURIComponent(tilesetId)}`,
			method: 'POST',
			body: {
				tilesetId,
				currencyDate,
				actionsByFace,
			},
			fallbackMessage: 'Unable to regenerate source assignment.',
		});
	}

	async acceptSourceAssignment({ tilesetId = '', currencyDate = '', actionsByFace = {} } = {}) {
		return this.requestJson({
			url: `${API_BASE}/source-assignment/accept?tilesetId=${encodeURIComponent(tilesetId)}`,
			method: 'POST',
			body: {
				tilesetId,
				currencyDate,
				actionsByFace,
			},
			fallbackMessage: 'Unable to accept source assignment.',
		});
	}

	async loadFinalRenderingOptions(tilesetId = '') {
		return this.requestJson({
			url: `${API_BASE}/final-rendering-options?tilesetId=${encodeURIComponent(tilesetId)}`,
			fallbackMessage: 'Unable to load final rendering options.',
		});
	}

	async rerenderFinalRenderingOptions({ tilesetId = '', options = {} } = {}) {
		return this.requestJson({
			url: `${API_BASE}/final-rendering-options/rerender?tilesetId=${encodeURIComponent(tilesetId)}`,
			method: 'POST',
			body: {
				tilesetId,
				options,
			},
			fallbackMessage: 'Unable to rerender final output.',
		});
	}

	async acceptFinalRenderingOptions({ tilesetId = '', options = {} } = {}) {
		return this.requestJson({
			url: `${API_BASE}/final-rendering-options/accept?tilesetId=${encodeURIComponent(tilesetId)}`,
			method: 'POST',
			body: {
				tilesetId,
				options,
			},
			fallbackMessage: 'Unable to accept final rendering options.',
		});
	}

	async loadBaseTileSelection(tilesetId = '') {
		return this.requestJson({
			url: `${API_BASE}/base-tile-selection?tilesetId=${encodeURIComponent(tilesetId)}`,
			fallbackMessage: 'Unable to load base tile selection.',
		});
	}

	async saveBaseTileSelection({ tilesetId = '', currencyDate = '', variantId = '' } = {}) {
		return this.requestJson({
			url: `${API_BASE}/base-tile-selection?tilesetId=${encodeURIComponent(tilesetId)}`,
			method: 'POST',
			body: {
				tilesetId,
				currencyDate,
				variantId,
			},
			fallbackMessage: 'Unable to save base tile selection.',
		});
	}

	async startAssetGeneration({ tilesetId = '', faceKeys = [] } = {}) {
		return this.requestJson({
			url: `${API_BASE}/asset-generation/start?tilesetId=${encodeURIComponent(tilesetId)}`,
			method: 'POST',
			body: { tilesetId, faceKeys },
			fallbackMessage: 'Unable to start asset generation.',
		});
	}

	async loadAssetReview(tilesetId = '') {
		return this.requestJson({
			url: `${API_BASE}/asset-review?tilesetId=${encodeURIComponent(tilesetId)}`,
			fallbackMessage: 'Unable to load generated asset review.',
		});
	}

	async requestJson({ url, method = 'GET', body = null, fallbackMessage = 'Pipeline request failed.' }) {
		const result = await this.io.send({
			url,
			method,
			...(body ? { body } : {}),
		});

		if (!result.success) {
			throw new Error(result.message || fallbackMessage);
		}

		return result.data;
	}
}

function metadataParams(metadataKind, tilesetSource) {
	const params = new URLSearchParams({ kind: metadataKind });

	if (metadataKind === 'tileset') {
		params.set('source', tilesetSource);
	}

	return params;
}

new ServerModel();
