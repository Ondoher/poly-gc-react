/**
 * Define the Source Assignment view service.
 */
interface SourceAssignmentViewService {
	/**
	 * Return the Source Assignment React component.
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
	 * Load source assignment review data.
	 *
	 * @param options - Optional load behavior flags.
	 */
	load(options?: { force?: boolean; quiet?: boolean }): Promise<void>;

	/**
	 * Set current source assignment selection for a face.
	 *
	 * @param faceKey - The face key.
	 * @param selection - The new selector selection state.
	 */
	setSelection(faceKey: string, selection: object): void;

	/**
	 * Bind the current source assignment selection.
	 *
	 * @param faceKey - The face key.
	 */
	bindSelection(faceKey: string): void;

	/**
	 * Unbind a source semantic part.
	 *
	 * @param faceKey - The face key.
	 * @param partId - The semantic part id.
	 * @param componentIds - Optional selected component ids to unbind.
	 */
	unbindPart(faceKey: string, partId: string, componentIds?: string[]): void;

	/**
	 * Save current source assignment decisions and regenerate assignment.
	 */
	save(): Promise<void>;

	/**
	 * Accept current source assignment decisions.
	 */
	accept(): Promise<void>;

	/**
	 * Scroll to the first unbound source part.
	 */
	showFirstUnboundPart(): void;

	/**
	 * Scroll to the first unbound source component.
	 */
	showFirstUnboundComponent(): void;

	/**
	 * Dismiss the current message dialog.
	 */
	dismissMessageDialog(): void;
}
