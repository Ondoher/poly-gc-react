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
	 * Optionally map an observer-local Three scene point into the geometry's
	 * model-space position in Algorithm32 meters.
	 *
	 * @param point - Supplies the observer-local Three scene point.
	 * @param request - Supplies scene scale facts.
	 * @returns The model-space position.
	 */
	mapObserverLocalScenePointToModelPosition?(
		point: SceneVector3 | { readonly x: number; readonly y: number; readonly z: number },
		request?: {
			readonly metersPerSceneUnit?: number;
			readonly distanceMultiplier?: number;
			readonly scaleDenominator?: number;
		}
	): Position;

	/**
	 * Optionally map an observer-local Three scene direction into the
	 * geometry's model-space direction.
	 *
	 * @param direction - Supplies the observer-local Three scene direction.
	 * @returns The model-space direction.
	 */
	mapObserverLocalSceneDirectionToModelDirection?(
		direction: SceneVector3 | { readonly x: number; readonly y: number; readonly z: number }
	): UnitVector3;

	/**
	 * Optionally map an app-authored ground offset into the configured Three
	 * scene frame before app objects or scene-depth inputs operate on it.
	 *
	 * @param offset - Supplies horizontal scene offset `[x, z]`.
	 * @param request - Supplies scene scale and optional height above ground.
	 * @returns The configured Three scene point.
	 */
	mapGroundOffsetToScenePoint?(
		offset: readonly [number, number] | { readonly x: number; readonly z: number },
		request?: {
			readonly metersPerSceneUnit?: number;
			readonly scaleDenominator?: number;
			readonly heightAboveGroundSceneUnits?: number;
		}
	): Position;

	/**
	 * Optionally project a renderer scene point onto the geometry-owned ground
	 * receiver along a scene-space direction. Implementations may enforce
	 * geometry-local receiver rules so app-authored local shadows cannot choose
	 * unrelated far-side ground intersections.
	 *
	 * @param point - Supplies the scene point to project.
	 * @param direction - Supplies the scene-space projection direction.
	 * @param request - Supplies scene scale and optional locality guards.
	 * @returns The configured Three scene ground point.
	 */
	projectScenePointToGroundAlongDirection?(
		point: SceneVector3,
		direction: UnitVector3 | SceneVector3,
		request?: GeometryGroundProjectionRequest
	): SceneVector3;

	/**
	 * Optionally create geometry-owned Three endpoint objects, including visible
	 * ground objects and exact scene-hit/raycast inputs.
	 *
	 * @param request - Supplies scene scale, material, segmentation, and
	 * metadata overrides.
	 * @returns The geometry-owned Three endpoint objects.
	 */
	createThreeEndpointObjects?(request: GeometryThreeEndpointObjectsRequest): GeometryThreeEndpointObjects;

	/**
	 * Optionally resolve the default scene-depth capture cap for
	 * geometry-owned endpoints.
	 *
	 * @param request - Supplies optional camera, scene-scale, endpoint extent,
	 * and minimum cap facts.
	 * @returns The scene-depth cap in Algorithm32 meters.
	 */
	resolveSceneDepthMaxMeters?(request: GeometrySceneDepthMaxMetersRequest): number;

	/**
	 * Optionally contribute geometry-owned shader source, symbols, and bindings
	 * for the active descriptor.
	 *
	 * @param request - Supplies the active shader descriptor and setup context.
	 * @returns The geometry shader contribution or contributions.
	 */
	createShaderContribution?(request: ShaderContributionRequest): ShaderContribution | readonly ShaderContribution[];
}
