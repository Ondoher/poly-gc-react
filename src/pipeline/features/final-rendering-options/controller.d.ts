/**
 * Define the Render Review page controller service.
 */
interface FinalRenderingOptionsControllerService {
	/**
	 * Return the mountable Render Review view component.
	 */
	mount(): unknown;

	/**
	 * Return current page state.
	 */
	getState(): object;

	/**
	 * Set the source tileset reviewed by this page.
	 *
	 * @param tilesetId - The tileset id to review.
	 */
	setTilesetId(tilesetId: string): void;

	/**
	 * Return a URL for a pipeline asset path.
	 *
	 * @param path - The pipeline asset path.
	 */
	assetUrl(path: string): string;

	/**
	 * Return a URL for the canonical reference image of a face.
	 *
	 * @param faceKey - The face key.
	 */
	referenceImageUrl(faceKey: string): string;

	/**
	 * Load final render review data.
	 *
	 * @param options - Optional load behavior flags.
	 */
	load(options?: { force?: boolean; quiet?: boolean }): Promise<void>;

	/**
	 * Save current options and rerender final output.
	 *
	 * @param options - Final rendering output options.
	 */
	rerender(options?: object): Promise<void>;

	/**
	 * Save, rerender, and accept current render review options.
	 *
	 * @param options - Final rendering output options.
	 */
	accept(options?: object): Promise<void>;

	/**
	 * Dismiss the current message dialog.
	 */
	dismissMessageDialog(): void;
}
