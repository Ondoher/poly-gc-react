/**
 * Describe state exposed by the reference approval controller.
 */
type ReferenceApprovalState = {
	structure: ReferenceStructure | null;
	path: string;
	selection: ReferenceApprovalSelection;
	highlightUnboundComponents: boolean;
	highlightUnboundParts: boolean;
	dirty: boolean;
	status: string;
	processing: boolean;
	processingLabel: string;
	messageDialog: { title: string; message: string } | null;
	summary: ReferenceApprovalSummary;
};

/**
 * Define the service contract for the Stage 0 reference approval page.
 */
interface ReferenceApprovalControllerService {
	/**
	 * Return the page presentation component.
	 */
	mount(): import('react').ReactElement;

	/**
	 * Return the current controller state with derived summary.
	 */
	getState(): ReferenceApprovalState;

	/**
	 * Load the reference structure from the pipeline API.
	 *
	 * @param options - Control reload prompting and loading messages.
	 */
	load(options?: { force?: boolean; quiet?: boolean }): Promise<void>;

	/**
	 * Persist the current reference structure draft.
	 *
	 * @param structure - Optionally carry an alternate structure to save.
	 * @param options - Optionally customize progress and success messages.
	 */
	saveDraft(structure?: ReferenceStructure, options?: object): Promise<void>;

	/**
	 * Validate and persist an accepted reference structure.
	 */
	accept(): Promise<void>;

	/**
	 * Replace the current review selection.
	 *
	 * @param faceKey - Identify the face under review.
	 * @param selection - Carry the selected part/components.
	 */
	setSelection(faceKey: string, selection: Partial<ReferenceApprovalSelection>): void;

	/**
	 * Bind the current selected part and components.
	 *
	 * @param faceKey - Identify the face under review.
	 */
	bindSelection(faceKey: string): void;

	/**
	 * Remove bindings from a part.
	 *
	 * @param faceKey - Identify the face under review.
	 * @param partId - Identify the semantic part.
	 * @param componentIds - Optionally identify selected detected components.
	 */
	unbindPart(faceKey: string, partId: string, componentIds?: string[]): void;

	/**
	 * Add an unknown palette color to the current reference palette.
	 *
	 * @param color - Carry the color to add.
	 */
	addPaletteColor(color: string): void;

	/**
	 * Select the first incomplete face.
	 */
	showFirstIncompleteFace(): void;

	/**
	 * Select the first unbound semantic part.
	 */
	showFirstUnboundPart(): void;

	/**
	 * Select the first unbound detected component.
	 */
	showFirstUnboundComponent(): void;

	/**
	 * Close the current message dialog.
	 */
	dismissMessageDialog(): void;

	/**
	 * Return a URL for a pipeline asset path.
	 *
	 * @param path - Carry the asset path.
	 */
	assetUrl(path: string): string;

	/**
	 * Return active palette colors as normalized hex strings.
	 *
	 * @param palette - Carry the reference palette.
	 */
	paletteColorSet(palette?: object): Set<string>;

	/**
	 * Format a semantic part label for review.
	 *
	 * @param partId - Identify the semantic part.
	 * @param part - Carry the semantic part metadata.
	 */
	partLabel(partId: string, part?: object): string;

	/**
	 * Describe the primary review swatch for a part or component.
	 *
	 * @param item - Carry the item with detected colors.
	 * @param paletteColorSet - Carry active palette colors.
	 */
	referenceColorSwatch(item: object, paletteColorSet: Set<string>): object;

	/**
	 * Sort detected components in semantic review order.
	 *
	 * @param components - Carry detected components.
	 * @param partEntries - Carry semantic part entries.
	 */
	sortComponentsForReview(components: object[], partEntries: [string, object][]): object[];
}
