/**
 * Define the shared pipeline server communication model.
 */
interface ServerModelService {
	/**
	 * Return a URL for a pipeline asset path.
	 *
	 * @param filename - The asset path to request.
	 */
	assetUrl(filename: string, cacheKey?: string): string;

	/**
	 * Return a URL for a reference face preview image.
	 *
	 * @param faceKey - The reference face key.
	 */
	referenceImageUrl(faceKey: string): string;

	/**
	 * Load the known tilesets from the pipeline manifest.
	 */
	loadTilesets(): Promise<object>;

	/**
	 * Set the active tileset in the pipeline manifest.
	 *
	 * @param tilesetId - The tileset id to activate.
	 */
	setActiveTileset(tilesetId: string): Promise<object>;

	/**
	 * Load metadata review state for a metadata kind/source pair.
	 *
	 * @param options - Metadata kind and optional tileset source.
	 */
	loadMetadataState(options?: { metadataKind?: string; tilesetSource?: string }): Promise<object>;

	/**
	 * Load the current reference structure from the pipeline API.
	 */
	loadReferenceStructure(): Promise<ReferenceStructureResult>;

	/**
	 * Load optional part assignment review data for a tileset.
	 *
	 * @param tilesetId - The source tileset id to load.
	 */
	loadOptionalPartAssignment(tilesetId?: string): Promise<object>;

	/**
	 * Load source assignment review data for a tileset.
	 *
	 * @param tilesetId - The source tileset id to load.
	 */
	loadSourceAssignment(tilesetId?: string): Promise<object>;

	/**
	 * Save optional part assignment review settings and rerun assignment.
	 *
	 * @param options - Tileset id, bulk options, and manual assignments.
	 */
	rebuildOptionalPartAssignment(options?: {
		tilesetId?: string;
		bulkOptions?: object;
		manualAssignments?: object;
	}): Promise<object>;

	/**
	 * Save optional part binding edits through the binding action map.
	 *
	 * @param options - Tileset id, currency date, and per-face binding actions.
	 */
	saveOptionalPartBindingActions(options?: {
		tilesetId?: string;
		currencyDate?: string;
		actionsByFace?: object;
	}): Promise<object>;

	/**
	 * Save source assignment binding edits through the binding action map.
	 *
	 * @param options - Tileset id, currency date, and per-face binding actions.
	 */
	saveSourceAssignmentBindingActions(options?: {
		tilesetId?: string;
		currencyDate?: string;
		actionsByFace?: object;
	}): Promise<object>;

	/**
	 * Reset a tileset to intake state, then rerun normalization and optional assignment.
	 *
	 * @param tilesetId - The source tileset id to reset.
	 */
	resetOptionalPartAssignment(tilesetId?: string): Promise<object>;

	/**
	 * Save source assignment review data and rerun alignment/semantic assignment.
	 *
	 * @param options - Source assignment write payload.
	 */
	regenerateSourceAssignment(options?: SourceAssignmentWriteOptions): Promise<object>;

	/**
	 * Recreate inferred metadata for a metadata kind/source pair.
	 *
	 * @param options - Metadata kind and optional tileset source.
	 */
	recreateMetadata(options?: { metadataKind?: string; tilesetSource?: string }): Promise<object>;

	/**
	 * Save reviewed metadata through the pipeline API.
	 *
	 * @param metadata - The metadata payload to persist.
	 * @param options - Metadata kind and optional tileset source.
	 */
	saveMetadata(metadata: object, options?: { metadataKind?: string; tilesetSource?: string }): Promise<object>;

	/**
	 * Save reviewed metadata and run preprocessing.
	 *
	 * @param metadata - The metadata payload to preprocess.
	 * @param options - Metadata kind and optional tileset source.
	 */
	preprocessMetadata(metadata: object, options?: { metadataKind?: string; tilesetSource?: string }): Promise<object>;

	/**
	 * Accept optional part assignment decisions and run downstream stages.
	 *
	 * @param options - Source tileset id and currency date.
	 */
	acceptOptionalPartAssignment(options?: { tilesetId?: string; currencyDate?: string }): Promise<object>;

	/**
	 * Accept source assignment review data and run final rendering.
	 *
	 * @param options - Source assignment write payload.
	 */
	acceptSourceAssignment(options?: SourceAssignmentWriteOptions): Promise<object>;

	/**
	 * Load final rendering options for a tileset.
	 *
	 * @param tilesetId - The source tileset id to load.
	 */
	loadFinalRenderingOptions(tilesetId?: string): Promise<object>;

	/**
	 * Save current final rendering options and rerender final output.
	 *
	 * @param options - Tileset id and final rendering output options.
	 */
	rerenderFinalRenderingOptions(options?: FinalRenderingWriteOptions): Promise<object>;

	/**
	 * Accept final rendering options for a tileset.
	 *
	 * @param options - Tileset id and final rendering output options.
	 */
	acceptFinalRenderingOptions(options?: FinalRenderingWriteOptions): Promise<object>;

	/**
	 * Load reusable base tile GLB choices for a tileset.
	 *
	 * @param tilesetId - The source tileset id to load.
	 */
	loadBaseTileSelection(tilesetId?: string): Promise<object>;

	/**
	 * Save the selected reusable base tile GLB variant.
	 *
	 * @param options - Tileset id, currency date, and selected variant id.
	 */
	saveBaseTileSelection(options?: BaseTileSelectionWriteOptions): Promise<object>;

	/**
	 * Start generated asset pipeline planning.
	 *
	 * @param options - Tileset id for the generated asset run.
	 */
	startAssetGeneration(options?: { tilesetId?: string }): Promise<object>;

	/**
	 * Load generated final tile asset review data.
	 *
	 * @param tilesetId - The source tileset id to load.
	 */
	loadAssetReview(tilesetId?: string): Promise<object>;

	/**
	 * Save the current reference structure through the pipeline API.
	 *
	 * @param structure - The reference structure to persist.
	 */
	saveReferenceStructure(structure: ReferenceStructure): Promise<ReferenceStructureResult>;
}

interface SourceAssignmentWriteOptions {
	tilesetId?: string;
	currencyDate?: string;
	actionsByFace?: object;
}

interface FinalRenderingWriteOptions {
	tilesetId?: string;
	options?: object;
}

interface BaseTileSelectionWriteOptions {
	tilesetId?: string;
	currencyDate?: string;
	variantId?: string;
}
