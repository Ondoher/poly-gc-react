/**
 * Provide the configured Algorithm32 light-source facts used by algorithm
 * execution and runtime shader setup.
 */
interface LightSourceModel {
	/**
	 * Identify this configured light-source model instance for compatibility and
	 * cache keys.
	 */
	readonly id: string;

	/**
	 * Return a serializable descriptor for compatibility checks.
	 *
	 * @returns The configured light-source descriptor.
	 */
	describe(): LightSourceModelDescriptor;

	/**
	 * Sample radiance from this light source at one point. The returned sample
	 * contains light-source direction, distance, apparent angular radius, and
	 * spectral radiance aligned to the requested spectral basis.
	 *
	 * @param request - Describes the point, outgoing direction, and spectral
	 * basis to sample.
	 * @returns The sampled radiance packet.
	 */
	sampleRadiance(request: RadianceSampleRequest): RadianceSample;

	/**
	 * Sample incident radiance support owned by this light source. The returned
	 * sample contains spectral radiance arriving at the requested point from the
	 * light-source implementation's higher-order incident-radiance model.
	 *
	 * @param request - Describes the point, outgoing direction, and spectral
	 * basis to sample.
	 * @returns The sampled incident radiance packet.
	 */
	sampleIncidentRadiance(request: IncidentRadianceSampleRequest): IncidentRadianceSample;
}
