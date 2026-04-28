/**
 * Define the optional part assignment page model.
 */
interface OptionalPartAssignmentModelService {
	/**
	 * Return optional assignment faces in review order.
	 *
	 * @param optionalPartAssignment - The optional part assignment response.
	 */
	assignmentFaces(optionalPartAssignment: object): object[];

	/**
	 * Return initial bulk options for the optional assignment page.
	 *
	 * @param optionalPartAssignment - The optional part assignment response.
	 */
	initialBulkOptions(optionalPartAssignment: object): object;

	/**
	 * Return initial manual assignment state for the optional assignment page.
	 *
	 * @param optionalPartAssignment - The optional part assignment response.
	 */
	initialManualAssignments(optionalPartAssignment: object): object;

	/**
	 * Return optional assignment summary counts.
	 *
	 * @param optionalPartAssignment - The optional part assignment response.
	 */
	summary(optionalPartAssignment: object): object | null;
}
