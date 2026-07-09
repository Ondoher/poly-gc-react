/**
 * Provide configured Algorithm32 atmosphere-medium facts used by algorithm
 * execution and runtime shader setup.
 */
interface AtmosphereModel {
	/**
	 * Identify this configured atmosphere model instance for compatibility and
	 * cache keys.
	 */
	readonly id: string;

	/**
	 * Return a serializable descriptor for compatibility checks.
	 *
	 * @returns The configured atmosphere descriptor.
	 */
	describe(): AtmosphereModelDescriptor;

	/**
	 * Sample medium coefficients at one geometry-resolved atmosphere
	 * coordinate.
	 *
	 * @param coordinate - Supplies the atmosphere coordinate to sample.
	 * @returns The sampled atmosphere medium coefficients.
	 */
	sampleMedium(coordinate: AtmosphereCoordinate): AtmosphereSample;

	/**
	 * Integrate optical depth along one geometry-owned atmosphere path.
	 *
	 * @param path - Supplies the atmosphere path to integrate.
	 * @returns The optical-depth sample.
	 */
	integrateOpticalDepth(path: AtmospherePath): OpticalDepthSample;

	/**
	 * Sample Rayleigh and Mie phase facts for an incoming/outgoing direction
	 * pair.
	 *
	 * @param request - Describes the incoming and outgoing directions to sample.
	 * @returns The sampled phase-function facts.
	 */
	samplePhase(request: unknown): PhaseSample;

	/**
	 * Optionally contribute atmosphere-owned shader source, symbols, and
	 * bindings for the active descriptor.
	 *
	 * @param request - Supplies the active shader descriptor and setup context.
	 * @returns The atmosphere shader contribution or contributions.
	 */
	createShaderContribution?(request: ShaderContributionRequest): ShaderContribution | readonly ShaderContribution[];
}
