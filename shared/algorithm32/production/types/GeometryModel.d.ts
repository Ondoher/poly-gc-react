/**
 * Provide configured Algorithm32 geometry facts used by algorithm execution
 * and runtime shader setup.
 */
interface GeometryModel {
	/**
	 * Identify this configured geometry model instance for compatibility and
	 * cache keys.
	 */
	readonly id: string;

	/**
	 * Return a serializable descriptor for compatibility checks.
	 *
	 * @returns The configured geometry descriptor.
	 */
	describe(): GeometryModelDescriptor;

	/**
	 * Return the model-space frame descriptor for this geometry.
	 *
	 * @returns The geometry frame descriptor.
	 */
	getFrameDescriptor(): GeometryFrameDescriptor;

	/**
	 * Resolve the finite view ray segment Algorithm32 should integrate.
	 *
	 * @param request - Supplies geometry-owned view ray request facts.
	 * @returns The resolved view ray segment.
	 */
	resolveViewRaySegment(request: unknown): RaySegment;

	/**
	 * Resolve model-space position into atmosphere coordinates.
	 *
	 * @param position - Supplies the model-space position to resolve.
	 * @returns The atmosphere coordinate.
	 */
	resolveAtmosphereCoordinate(position: Position | readonly [number, number, number]): AtmosphereCoordinate;

	/**
	 * Resolve a model-space path into an atmosphere path for optical depth.
	 *
	 * @param request - Supplies path endpoints, direction, and source/path
	 * limits.
	 * @returns The atmosphere path.
	 */
	resolveAtmospherePath(request: unknown): AtmospherePath;

	/**
	 * Resolve a model-space sample into source-relative coordinates.
	 *
	 * @param request - Supplies position, atmosphere coordinate, and view
	 * direction facts.
	 * @returns The source-relative position.
	 */
	resolveSourceRelativePosition(request: unknown): SourceRelativePosition;

	/**
	 * Resolve a sample point into cache lookup coordinates.
	 *
	 * @param request - Supplies position, atmosphere coordinate,
	 * source-relative position, and view direction facts.
	 * @returns The cache access packet.
	 */
	resolveCacheAccess(request: unknown): CacheAccess;

	/**
	 * Optionally resolve a cache-owned build coordinate into the ray segment
	 * used to generate that cache value.
	 *
	 * @param coordinate - Supplies the cache-owned build coordinate.
	 * @returns The resolved cache build ray segment, or null when the
	 * coordinate has no in-atmosphere contribution.
	 */
	resolveCacheBuildRay?(coordinate: CacheBuildCoordinate): RaySegment | null;

	/**
	 * Optionally contribute geometry-owned shader source, symbols, and bindings
	 * for the active descriptor.
	 *
	 * @param request - Supplies the active shader descriptor and setup context.
	 * @returns The geometry shader contribution or contributions.
	 */
	createShaderContribution?(request: ShaderContributionRequest): ShaderContribution | readonly ShaderContribution[];
}
