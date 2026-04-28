/**
 * Define the Base Tile page view service.
 */
interface AssetBaseTileSelectionViewService {
	/**
	 * Return the React component for this view.
	 */
	getComponent(): unknown;

	/**
	 * Return current page state.
	 */
	getState(): object;

	/**
	 * Return a URL for a pipeline asset path.
	 *
	 * @param path - The pipeline asset path.
	 */
	assetUrl(path: string): string;

	/**
	 * Load reusable base tile GLB options.
	 *
	 * @param options - Optional load behavior flags.
	 */
	load(options?: { force?: boolean; quiet?: boolean }): Promise<void>;

	/**
	 * Select one base tile manifest variant locally.
	 *
	 * @param variantId - Base tile manifest variant id.
	 */
	selectVariant(variantId: string): void;

	/**
	 * Save the selected base tile manifest variant.
	 */
	save(): Promise<void>;

	/**
	 * Dismiss the current message dialog.
	 */
	dismissMessageDialog(): void;
}
