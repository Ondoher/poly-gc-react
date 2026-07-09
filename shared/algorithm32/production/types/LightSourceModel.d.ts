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
	 * Create the concrete incident-radiance cache owned by this light source.
	 *
	 * @param request - Supplies cache build descriptors and collaborators.
	 * @returns The created incident-radiance cache.
	 */
	createIncidentRadianceCache(request: unknown): IncidentRadianceCache;

	/**
	 * Sample direct lighting at one geometry-resolved source-relative position.
	 *
	 * @param request - Supplies source-relative position, atmosphere
	 * coordinate, and spectral basis facts.
	 * @returns The direct lighting sample.
	 */
	sampleDirectLighting(request: unknown): DirectLightingSample;

	/**
	 * Resolve the source-owned path limit for sample-to-source transmittance.
	 *
	 * @param request - Supplies source-relative position and direct lighting
	 * facts.
	 * @returns The source path limit.
	 */
	resolveSourcePathLimit(request: unknown): SourcePathLimit;

	/**
	 * Optionally contribute light-source-owned shader source, symbols, and
	 * bindings for the active descriptor.
	 *
	 * @param request - Supplies the active shader descriptor and setup context.
	 * @returns The light-source shader contribution or contributions.
	 */
	createShaderContribution?(request: ShaderContributionRequest): ShaderContribution | readonly ShaderContribution[];

	/**
	 * Create optional renderer-lighting helpers for endpoint scene rendering.
	 *
	 * @param request - Supplies runtime renderer-lighting setup facts.
	 * @returns The created renderer-lighting objects.
	 */
	createThreeLightingObjects?(request: unknown): unknown;
}
