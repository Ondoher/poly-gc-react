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
	 * Sample medium coefficients at one point in the atmosphere. The returned
	 * sample contains density plus extinction, scattering, and absorption
	 * coefficients aligned to the requested spectral basis.
	 *
	 * @param request - Describes the point, altitude, and spectral basis to
	 * sample.
	 * @returns The sampled atmosphere medium coefficients.
	 */
	sampleMedium(request: AtmosphereSampleRequest): AtmosphereSample;

	/**
	 * Sample the active phase function for an incoming/outgoing direction pair.
	 *
	 * @param request - Describes the incoming and outgoing directions to sample.
	 * @returns The sampled phase-function value.
	 */
	samplePhase(request: PhaseSampleRequest): PhaseSample;
}
