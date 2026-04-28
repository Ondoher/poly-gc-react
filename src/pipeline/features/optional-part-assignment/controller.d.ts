/**
 * Define the Optional Part Assignment page controller service.
 */
interface OptionalPartAssignmentControllerService {
	/**
	 * Return the mountable Optional Part Assignment view component.
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
	 * Load optional part assignment review data.
	 *
	 * @param options - Optional load behavior flags.
	 */
	load(options?: { force?: boolean; quiet?: boolean }): Promise<void>;

	/**
	 * Save current optional settings and rerun optional assignment.
	 *
	 * @param bulkOptions - Bulk optional review settings.
	 * @param manualAssignments - Per-face manual assignments.
	 */
	rebuild(bulkOptions?: object, manualAssignments?: object): Promise<void>;

	/**
	 * Save current optional binding action edits.
	 *
	 * @param actionsByFace - Per-face binding action maps.
	 */
	saveBindingActions(actionsByFace?: object): Promise<object | null>;

	/**
	 * Save current optional binding action edits and reload review data.
	 *
	 * @param actionsByFace - Per-face binding action maps.
	 */
	saveBindingActionsAndReload(actionsByFace?: object): Promise<object | null>;

	/**
	 * Reset the current tileset and rerun normalization plus optional assignment.
	 */
	reset(): Promise<void>;

	/**
	 * Accept current optional assignment decisions.
	 */
	accept(): Promise<void>;

	/**
	 * Scroll to the first optional face that needs review.
	 */
	showFirstReviewFace(): void;

	/**
	 * Dismiss the current message dialog.
	 */
	dismissMessageDialog(): void;
}
