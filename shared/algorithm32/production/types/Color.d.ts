/**
 * Provide caller-owned conversion from Algorithm32 spectral output to
 * display-facing color data.
 */
interface Color {
	/**
	 * Identify this configured color conversion instance for compatibility
	 * checks.
	 */
	readonly id: string;

	/**
	 * Return a serializable descriptor for compatibility checks and shader
	 * source construction.
	 *
	 * @returns The configured color conversion descriptor.
	 */
	describe(): ColorDescriptor;

	/**
	 * Convert one spectral sample into display-facing color values. The returned
	 * sample contains display values derived from the supplied spectral radiance
	 * and transmittance without mutating Algorithm32 spectral facts.
	 *
	 * @param request - Supplies the spectral sample and display conversion
	 * context.
	 * @returns The converted display color sample.
	 */
	convert(request: ColorConversionRequest): ColorSample;
}
