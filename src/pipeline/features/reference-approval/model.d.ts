/**
 * Summarize the current reference approval state.
 */
type ReferenceApprovalSummary = {
	faceCount: number;
	incompleteFaceCount: number;
	unboundPartCount: number;
	unboundComponentCount: number;
	unknownPaletteColorCount: number;
	unknownPaletteColors: string[];
	incompleteFaces: string[];
	unboundParts: { faceKey: string; partId: string }[];
	unboundComponents: { faceKey: string; componentId: string }[];
};

/**
 * Describe the current reference approval selection.
 */
type ReferenceApprovalSelection = {
	faceKey: string;
	partId: string;
	componentIds: string[];
	componentSelectionExplicit: boolean;
};

/**
 * Define the service contract for reference approval domain operations.
 */
interface ReferenceApprovalModelService {
	/**
	 * Summarize unbound and palette review state for one structure.
	 *
	 * @param structure - Carry the reference structure under review.
	 */
	summary(structure: ReferenceStructure | null): ReferenceApprovalSummary;

	/**
	 * Choose the first useful selection for a loaded reference structure.
	 *
	 * @param structure - Carry the reference structure under review.
	 */
	initialSelection(structure: ReferenceStructure | null): ReferenceApprovalSelection;

	/**
	 * Return a copy of the structure marked as accepted.
	 *
	 * @param structure - Carry the reference structure to accept.
	 * @param summary - Carry the approval summary to persist.
	 */
	markAccepted(structure: ReferenceStructure, summary: ReferenceApprovalSummary): ReferenceStructure;

	/**
	 * Bind selected components to one semantic part.
	 *
	 * @param face - Carry the mutable face record.
	 * @param partId - Identify the semantic part.
	 * @param componentIds - Identify selected detected components.
	 */
	bindPart(face: object, partId: string, componentIds: string[]): void;

	/**
	 * Remove selected component bindings from one semantic part.
	 *
	 * @param face - Carry the mutable face record.
	 * @param partId - Identify the semantic part.
	 * @param componentIds - Identify selected detected components.
	 */
	unbindPart(face: object, partId: string, componentIds?: string[]): void;

	/**
	 * Add a palette color and apply it to matching reference items.
	 *
	 * @param structure - Carry the reference structure under review.
	 * @param color - Carry the color to add.
	 */
	addPaletteColor(structure: ReferenceStructure | null, color: string): object;

	/**
	 * Format a semantic part label for review.
	 *
	 * @param partId - Identify the semantic part.
	 * @param part - Carry the semantic part metadata.
	 */
	partLabel(partId: string, part?: object): string;

	/**
	 * Sort detected components in semantic review order.
	 *
	 * @param components - Carry detected components.
	 * @param partEntries - Carry semantic part entries.
	 */
	sortComponentsForReview(components: object[], partEntries: [string, object][]): object[];

	/**
	 * Return active palette colors as normalized hex strings.
	 *
	 * @param palette - Carry the reference palette.
	 */
	paletteColorSet(palette?: object): Set<string>;

	/**
	 * Describe the primary review swatch for a part or component.
	 *
	 * @param item - Carry the item with detected colors.
	 * @param paletteColorSet - Carry active palette colors.
	 */
	referenceColorSwatch(item: object, paletteColorSet: Set<string>): object;
}
