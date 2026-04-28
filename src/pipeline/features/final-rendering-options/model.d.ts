/**
 * Define the Render Review page model service.
 */
interface FinalRenderingOptionsModelService {
	/**
	 * Return final rendering faces in review order.
	 *
	 * @param finalRenderingOptions - The final rendering options response.
	 */
	faces(finalRenderingOptions: object): object[];

	/**
	 * Return initial editable render options.
	 *
	 * @param finalRenderingOptions - The final rendering options response.
	 */
	initialOptions(finalRenderingOptions: object): object;

	/**
	 * Return final rendering summary counts.
	 *
	 * @param finalRenderingOptions - The final rendering options response.
	 */
	summary(finalRenderingOptions: object): object | null;
}
