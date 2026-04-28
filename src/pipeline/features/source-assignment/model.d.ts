/**
 * Define the Source Assignment page model service.
 */
interface SourceAssignmentModelService {
	/**
	 * Return source assignment faces in review order.
	 *
	 * @param referenceStructure - The reference structure response.
	 * @param sourceAcceptance - The source assignment response.
	 */
	sourceAssignmentFaces(referenceStructure: object, sourceAcceptance: object): object[];

	/**
	 * Return source assignment summary counts.
	 *
	 * @param referenceStructure - The reference structure response.
	 * @param sourceAcceptance - The source assignment response.
	 */
	sourceAssignmentSummary(referenceStructure: object, sourceAcceptance: object): object;

	/**
	 * Bind a source semantic part to selected components.
	 *
	 * @param bindings - Existing source semantic bindings.
	 * @param face - The current face review model.
	 * @param selection - The current selector selection.
	 */
	bindSourceSemanticPart(bindings: object, face: object, selection: object): object;

	/**
	 * Unbind selected components from a source semantic part.
	 *
	 * @param bindings - Existing source semantic bindings.
	 * @param face - The current face review model.
	 * @param partId - The semantic part id.
	 * @param componentIds - Optional selected component ids to unbind.
	 */
	unbindSourceSemanticPart(bindings: object, face: object, partId: string, componentIds?: string[]): object;
}
