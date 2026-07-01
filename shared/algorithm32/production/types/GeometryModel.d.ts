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
	 * Resolve the finite distance Algorithm32 should integrate for one ray.
	 * Geometry uses `suppliedDistance` when an upstream renderer or caller
	 * already chose the integration endpoint; otherwise geometry resolves the
	 * configured sky/top-atmosphere boundary or other geometry-owned
	 * terminator. The returned result contains only the finite distance needed
	 * by algorithm execution; boundary explanations and clipping details belong
	 * to a deferred tracing or observation API.
	 *
	 * @param request - Describes the ray origin, direction, and optional
	 * caller-supplied distance to resolve.
	 * @returns The resolved ray distance.
	 */
	resolveRayDistance(request: RayDistanceRequest): ResolvedRayDistance;
}
