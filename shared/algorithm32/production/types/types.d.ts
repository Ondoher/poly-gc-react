/**
 * Identify supported distance units.
 *
 * - **meters** - Length measured in meters.
 * - **kilometers** - Length measured in kilometers.
 */
type DistanceUnits = "meters" | "kilometers";

/**
 * Identify supported angle units.
 *
 * - **radians** - Angle measured in radians.
 * - **degrees** - Angle measured in degrees.
 */
type AngleUnits = "radians" | "degrees";

/**
 * Identify supported wavelength units.
 *
 * - **nanometers** - Wavelength measured in nanometers.
 * - **micrometers** - Wavelength measured in micrometers.
 */
type WavelengthUnits = "nanometers" | "micrometers";

/**
 * Describe one distance quantity with explicit units.
 */
type Distance = {
	/**
	 * Store the numeric distance value.
	 */
	value: number;

	/**
	 * Store the units used by the distance value.
	 */
	units: DistanceUnits;
}

/**
 * Describe one angle quantity with explicit units.
 */
type Angle = {
	/**
	 * Store the numeric angle value.
	 */
	value: number;

	/**
	 * Store the units used by the angle value.
	 */
	units: AngleUnits;
}

/**
 * Describe one wavelength quantity with explicit units.
 */
type Wavelength = {
	/**
	 * Store the numeric wavelength value.
	 */
	value: number;

	/**
	 * Store the units used by the wavelength value.
	 */
	units: WavelengthUnits;
}

/**
 * Describe one three-dimensional position with explicit distance units.
 */
type Position = {
	/**
	 * Store the ordered position coordinates.
	 */
	coordinates: readonly [number, number, number];

	/**
	 * Store the units used by each coordinate value.
	 */
	units: DistanceUnits;
}

/**
 * Store one normalized three-dimensional vector.
 */
type UnitVector3 = readonly [number, number, number];

/**
 * Store one spectral vector aligned to the active spectral basis.
 */
type SpectralValue = readonly number[];

/**
 * Describe the spectral basis requested by an Algorithm32 evaluation.
 */
type SpectralBasis = {
	/**
	 * Store the ordered wavelength samples.
	 */
	wavelengths: readonly Wavelength[];
}

/**
 * Describe direct lighting supplied by a configured light source.
 */
type DirectLightingSample = {
	/**
	 * Store source spectral radiance or incident scale aligned to the active
	 * spectral basis.
	 */
	incidentRadiance: SpectralValue;

	/**
	 * Store the normalized direction from the sample point toward the light.
	 */
	directionToLight: UnitVector3;

	/**
	 * Store source-path transmittance when the source owns a precomputed value.
	 */
	sourceTransmittance?: SpectralValue;

	/**
	 * Store owner-specific metadata for validation or diagnostics.
	 */
	metadata?: unknown;
}

/**
 * Describe how far a source path may travel before geometry or source policy
 * terminates it.
 */
type SourcePathLimit = {
	/**
	 * Store the maximum distance in meters, or null when the source is
	 * directional.
	 */
	maxDistanceMeters: number | null;

	/**
	 * Explain the source-owned path limit policy.
	 */
	reason: string;
}

/**
 * Describe incident-radiance cache identity and compatibility facts.
 */
type IncidentRadianceCacheDescriptor = {
	/**
	 * Store the logical cache family.
	 */
	cacheKind: "none" | "distant" | "local";

	/**
	 * Store the source-owned cache key.
	 */
	sourceKey: string;

	/**
	 * Store the cache descriptor version.
	 */
	version: number;

	/**
	 * Store optional logical dimension names.
	 */
	dimensions?: readonly string[];

	/**
	 * Store optional cache-owned shader payload family.
	 */
	payloadKind?: string;

	/**
	 * Store optional cache-owned shader payload dimensions.
	 */
	payloadDimensions?: readonly number[];

	/**
	 * Store optional cache-owned texture layout facts.
	 */
	texture?: unknown;

	/**
	 * Store optional cache-owned lookup facts.
	 */
	lookup?: unknown;

	/**
	 * Store owner-specific metadata for validation or diagnostics.
	 */
	metadata?: unknown;
}

/**
 * Describe one directional incident-radiance sample.
 */
type IncidentRadianceSample = {
	/**
	 * Store the incoming direction represented by this sample.
	 */
	incomingDirection: UnitVector3;

	/**
	 * Store incident spectral radiance aligned to the active spectral basis.
	 */
	radiance: SpectralValue;

	/**
	 * Store quadrature or sample weight for this incident direction.
	 */
	weight: number;
}

/**
 * Sample operation-ready incident radiance from a geometry-resolved cache
 * access packet.
 */
interface IncidentRadianceSampler {
	/**
	 * Return directional incident samples for one cache access.
	 *
	 * @param cacheAccess - Supplies the geometry-resolved cache lookup.
	 * @returns Incident-radiance samples for the lookup.
	 */
	(cacheAccess: CacheAccess): readonly IncidentRadianceSample[];
}

/**
 * Describe setup-bound incident-radiance support ready for CPU/reference
 * evaluation.
 */
type IncidentRadianceSampling = {
	/**
	 * Store the cache descriptor used to validate compatibility.
	 */
	cacheDescriptor: IncidentRadianceCacheDescriptor;

	/**
	 * Store the bound incident-radiance sampler.
	 */
	incidentRadianceSampler: IncidentRadianceSampler;
}

/**
 * Describe one cache-owned coordinate that needs a generated incident-radiance
 * value.
 */
type CacheBuildCoordinate = {
	/**
	 * Store the stable cache-local coordinate key.
	 */
	coordinateKey: string;

	/**
	 * Store numeric lookup coordinates in cache-owned order.
	 */
	coordinates: readonly number[];

	/**
	 * Store an optional altitude bin index.
	 */
	altitudeBinIndex?: number;

	/**
	 * Store an optional incoming-direction index.
	 */
	directionIndex?: number;

	/**
	 * Store an optional source-relative vertical bin index.
	 */
	zBinIndex?: number;

	/**
	 * Store an optional source-relative radial bin index.
	 */
	rhoBinIndex?: number;

	/**
	 * Store optional altitude in meters for cache construction.
	 */
	altitudeMeters?: number;

	/**
	 * Store optional source-relative radial distance in meters.
	 */
	rhoMeters?: number;

	/**
	 * Store the incoming direction represented by the coordinate.
	 */
	incomingDirection?: UnitVector3;

	/**
	 * Store owner-specific coordinate metadata.
	 */
	metadata?: unknown;
}

/**
 * Describe a cache-owned rgba32f 3D texture payload for shader setup.
 */
type CacheShaderTexturePayload = {
	/**
	 * Store the texture payload kind/version.
	 */
	kind: string;

	/**
	 * Store the logical texture id.
	 */
	textureId: string;

	/**
	 * Store texture width in texels.
	 */
	width: number;

	/**
	 * Store texture height in texels.
	 */
	height: number;

	/**
	 * Store texture depth in texels.
	 */
	depth: number;

	/**
	 * Store the texture dimensionality.
	 */
	dimensionality: "3d";

	/**
	 * Store the texture format label.
	 */
	format: string;

	/**
	 * Store the sampler policy label.
	 */
	samplerPolicy: string;

	/**
	 * Store the coordinate order used by the packed payload.
	 */
	coordinateOrder: readonly string[];

	/**
	 * Store the number of spectral channels per RGBA group.
	 */
	spectralGroupSize: number;

	/**
	 * Store the number of spectral groups.
	 */
	spectralGroupCount: number;

	/**
	 * Store the active spectral channel count.
	 */
	spectralChannelCount: number;

	/**
	 * Store packed Float32-compatible RGBA values.
	 */
	rgbaFloat32: readonly number[];
}

/**
 * Describe shader-facing payload metadata created by an incident-radiance
 * cache.
 */
type CacheShaderPayloadDescriptor = {
	/**
	 * Store the payload family.
	 */
	payloadKind: string;

	/**
	 * Store payload dimensions in owner-defined order.
	 */
	dimensions: readonly number[];

	/**
	 * Store the payload format label.
	 */
	format: string;

	/**
	 * Store optional texture payload details.
	 */
	texture?: CacheShaderTexturePayload;

	/**
	 * Store optional lookup contribution details.
	 */
	lookup?: unknown;

	/**
	 * Store owner-specific metadata for validation or diagnostics.
	 */
	metadata?: unknown;
}

/**
 * Describe a generated incident-radiance cache.
 */
interface IncidentRadianceCache {
	/**
	 * Store the cache descriptor.
	 */
	readonly descriptor: IncidentRadianceCacheDescriptor;

	/**
	 * Return cache-owned build coordinates.
	 *
	 * @returns Iterable cache build coordinates.
	 */
	coordinates(): Iterable<CacheBuildCoordinate>;

	/**
	 * Add one generated value to the cache.
	 *
	 * @param args - Supplies cache-owned coordinate and value arguments.
	 * @returns No return value.
	 */
	addCoordinateToCache(...args: readonly unknown[]): void;

	/**
	 * Create an operation-ready sampler for this cache.
	 *
	 * @returns The bound incident-radiance sampler.
	 */
	createIncidentRadianceSampler(): IncidentRadianceSampler;

	/**
	 * Create a shader-facing cache payload when the cache supports GPU use.
	 *
	 * @returns The shader payload descriptor.
	 */
	createShaderPayload?(): CacheShaderPayloadDescriptor;

	/**
	 * Optionally contribute cache-owned shader source, symbols, and bindings
	 * for the active descriptor.
	 *
	 * @param request - Supplies the active shader descriptor and setup context.
	 * @returns The cache shader contribution or contributions.
	 */
	createShaderContribution?(request: ShaderContributionRequest): ShaderContribution | readonly ShaderContribution[];
}

/**
 * Describe a configured light-source model without exposing private
 * implementation state.
 */
type LightSourceModelDescriptor = {
	/**
	 * Identify the descriptor kind.
	 */
	kind: "algorithm32-light-source-model";

	/**
	 * Identify the configured light-source model instance.
	 */
	id: string;

	/**
	 * Store a stable compatibility fingerprint for cache and shader resources.
	 */
	fingerprint: string;
}

/**
 * Describe an atmosphere coordinate resolved by geometry.
 */
type AtmosphereCoordinate = {
	/**
	 * Store altitude above the active atmosphere bottom boundary in meters.
	 */
	altitudeMeters: number;
}

/**
 * Describe one sampled atmosphere path point.
 */
type AtmospherePathSample = {
	/**
	 * Store the atmosphere coordinate represented by this path sample.
	 */
	atmosphereCoordinate: AtmosphereCoordinate;

	/**
	 * Store the effective path measure represented by this sample in meters.
	 */
	measureMeters: number;

	/**
	 * Store the interval length from the previous sample in meters.
	 */
	intervalLengthFromPreviousMeters: number;
}

/**
 * Describe a geometry-owned atmosphere path for optical-depth integration.
 */
type AtmospherePath = {
	/**
	 * Store the start coordinate.
	 */
	start: AtmosphereCoordinate;

	/**
	 * Store the end coordinate.
	 */
	end: AtmosphereCoordinate;

	/**
	 * Store total path length in meters.
	 */
	lengthMeters: number;

	/**
	 * Store optional integration samples.
	 */
	samples?: readonly AtmospherePathSample[];

	/**
	 * Store true when the path is blocked by ground before reaching the source.
	 */
	blockedByGround?: boolean;

	/**
	 * Store owner-specific metadata for validation or diagnostics.
	 */
	metadata?: unknown;
}

/**
 * Describe a position in the source-owned frame after geometry resolution.
 */
type SourceRelativePosition = {
	/**
	 * Store the direction from the source toward the sample point.
	 */
	directionFromSource: UnitVector3;

	/**
	 * Store the direction from the sample point toward the source when useful.
	 */
	directionToSource?: UnitVector3;

	/**
	 * Store measured distance from the finite source, or null for directional
	 * sources.
	 */
	distanceFromSourceMeters: number | null;

	/**
	 * Store radial distance from the source subpoint when the active cache
	 * family needs it.
	 */
	radialDistanceFromSourceSubpointMeters?: number;

	/**
	 * Store resolved altitude in meters when the active cache family needs it.
	 */
	altitudeMeters?: number;

	/**
	 * Store owner-specific metadata for validation or diagnostics.
	 */
	metadata?: unknown;
}

/**
 * Describe a geometry-resolved incident-radiance cache lookup.
 */
type CacheAccess = {
	/**
	 * Store the logical cache key or coordinate family id.
	 */
	cacheKey: string;

	/**
	 * Store normalized or index-space coordinates consumed by the cache.
	 */
	coordinates: readonly number[];

	/**
	 * Store owner-specific metadata for validation or diagnostics.
	 */
	metadata?: unknown;
}

/**
 * Store medium coefficients sampled at one atmosphere coordinate.
 */
type AtmosphereSample = {
	/**
	 * Store total extinction coefficients.
	 */
	extinction: SpectralValue;

	/**
	 * Store total scattering coefficients.
	 */
	scattering: SpectralValue;

	/**
	 * Store Rayleigh scattering coefficients.
	 */
	rayleighScattering: SpectralValue;

	/**
	 * Store Mie scattering coefficients.
	 */
	mieScattering: SpectralValue;

	/**
	 * Store Mie extinction coefficients.
	 */
	mieExtinction?: SpectralValue;

	/**
	 * Store absorption coefficients.
	 */
	absorption: SpectralValue;

	/**
	 * Store normalized density facts used to derive the coefficients.
	 */
	density: unknown;
}

/**
 * Store optical-depth integration output.
 */
type OpticalDepthSample = {
	/**
	 * Store spectral optical depth.
	 */
	opticalDepth: SpectralValue;

	/**
	 * Store spectral transmittance when the atmosphere computes it directly.
	 */
	transmittance?: SpectralValue;
}

/**
 * Store phase-function values for one incoming/outgoing direction pair.
 */
type PhaseSample = {
	/**
	 * Store optional combined phase values.
	 */
	phase?: SpectralValue;

	/**
	 * Store Rayleigh phase value.
	 */
	rayleighPhase: number;

	/**
	 * Store Mie phase value.
	 */
	miePhase: number;
}

/**
 * Describe a configured atmosphere model without exposing private
 * implementation state.
 */
type AtmosphereModelDescriptor = {
	/**
	 * Identify the descriptor kind.
	 */
	kind: "algorithm32-atmosphere-model";

	/**
	 * Identify the configured atmosphere model instance.
	 */
	id: string;

	/**
	 * Store a stable compatibility fingerprint for cache and shader resources.
	 */
	fingerprint: string;
}

/**
 * Describe one model-space ray.
 */
type Ray = {
	/**
	 * Store the model-space ray origin.
	 */
	origin: Position | readonly [number, number, number];

	/**
	 * Store the normalized model-space ray direction.
	 */
	direction: UnitVector3;
}

/**
 * Describe a finite geometry-resolved view ray segment.
 */
type RaySegment = {
	/**
	 * Store the ray integrated by Algorithm32.
	 */
	ray: Ray;

	/**
	 * Store the starting distance along the ray in canonical meters.
	 */
	startDistanceMeters: number;

	/**
	 * Store the ending distance along the ray in canonical meters.
	 */
	endDistanceMeters: number;

	/**
	 * Store optional geometry-owned endpoint or boundary metadata.
	 */
	metadata?: unknown;
}

/**
 * Describe the model-space frame used by the configured geometry.
 */
type GeometryFrameDescriptor = {
	/**
	 * Identify the descriptor kind.
	 */
	kind: "algorithm32-geometry-frame";

	/**
	 * Store the world up axis in model coordinates.
	 */
	up: readonly [number, number, number];

	/**
	 * Store the units used by model-space coordinates.
	 */
	units: DistanceUnits;
}

/**
 * Describe a configured geometry model without exposing private implementation
 * state.
 */
type GeometryModelDescriptor = {
	/**
	 * Identify the descriptor kind.
	 */
	kind: "algorithm32-geometry-model";

	/**
	 * Identify the configured geometry model instance.
	 */
	id: string;

	/**
	 * Store a stable compatibility fingerprint for cache and shader resources.
	 */
	fingerprint: string;
}

/**
 * Describe the inputs needed to convert Algorithm32 spectral output to
 * display-facing color data.
 */
type ColorConversionRequest = {
	/**
	 * Store spectral radiance aligned to the active spectral basis.
	 */
	spectralRadiance: readonly number[];

	/**
	 * Store spectral transmittance aligned to the active spectral basis when the
	 * conversion needs attenuation context.
	 */
	spectralTransmittance?: readonly number[];

	/**
	 * Store the active spectral basis used by the spectral sample.
	 */
	spectral: SpectralBasis;
}

/**
 * Describe display-facing color values produced from Algorithm32 spectral
 * output.
 */
type ColorSample = {
	/**
	 * Store display color channels in the descriptor's output color space.
	 */
	channels: readonly number[];

	/**
	 * Store the output color space used by the channel values.
	 */
	colorSpace: string;
}

/**
 * Describe a configured color conversion provider without exposing private
 * implementation state.
 */
type ColorDescriptor = {
	/**
	 * Identify the descriptor kind.
	 */
	kind: "algorithm32-color";

	/**
	 * Identify the configured color conversion instance.
	 */
	id: string;

	/**
	 * Store the output color space produced by this converter.
	 */
	colorSpace: string;

	/**
	 * Store a stable compatibility fingerprint for shader resources.
	 */
	fingerprint: string;
}

/**
 * Configure numerical execution behavior for one Algorithm32 facade instance.
 */
type ExecutionConfig = {
	/**
	 * Store default view-path interval count for CPU/reference evaluation.
	 */
	pathIntervalCount?: number;

	/**
	 * Store source transmittance integration count when source paths need it.
	 */
	sourceTransmittanceIntervalCount?: number;
}

/**
 * Configure one Algorithm32 facade instance.
 */
type Config = {
	/**
	 * Provide the configured light-source model used by Algorithm32 evaluation
	 * and shader setup.
	 */
	lightSource: LightSourceModel;

	/**
	 * Provide the configured atmosphere model used by Algorithm32 evaluation and
	 * shader setup.
	 */
	atmosphere: AtmosphereModel;

	/**
	 * Provide the configured geometry model used by Algorithm32 evaluation and
	 * shader setup.
	 */
	geometry: GeometryModel;

	/**
	 * Provide optional configured display conversion used by shader setup and
	 * CPU/offline display tooling.
	 */
	color?: Color;

	/**
	 * Configure the spectral basis requested by Algorithm32.
	 */
	spectral: SpectralBasis;

	/**
	 * Configure numerical execution behavior.
	 */
	execution?: ExecutionConfig;

	/**
	 * Configure optional runtime shader behavior.
	 */
	shader?: ShaderRuntimeConfig;
}

/**
 * Describe the accepted configuration state of one facade instance.
 */
type ConfigSnapshot = {
	/**
	 * Store the accepted facade configuration.
	 */
	config: Config;

	/**
	 * Store the monotonically increasing configuration version.
	 */
	version: number;

	/**
	 * Store the shared model descriptor snapshot for this configuration.
	 */
	model: SharedModelSnapshot;
}

/**
 * Configure optional runtime shader behavior.
 */
type ShaderRuntimeConfig = {
	/**
	 * Select the runtime shader mode.
	 */
	mode?: string;

	/**
	 * Store the largest renderer-produced scene-hit distance encoded for the
	 * runtime shader, in meters.
	 */
	sceneDepthMaxMeters?: number;

	/**
	 * Store scene units to Algorithm32 meters scale for renderer-produced
	 * scene-hit distances.
	 */
	distanceMultiplier?: number;

	/**
	 * Store an alias for scene units to Algorithm32 meters scale when the
	 * host scene already names that value this way.
	 */
	metersPerSceneUnit?: number;

	/**
	 * Configure shader cache/resource policy.
	 */
	cachePolicy?: unknown;

	/**
	 * Configure runtime capability failure policy.
	 */
	capabilityPolicy?: unknown;

	/**
	 * Configure render-target, HDR, depth, and color-space policy.
	 */
	renderTargetPolicy?: unknown;
}

/**
 * Provide caller-owned Three/runtime handles for shader setup.
 */
type ShaderSetupRequest = {
	/**
	 * Provide the caller's existing postprocess composer.
	 */
	composer: unknown;

	/**
	 * Provide the scene rendered before the Algorithm32 atmosphere pass.
	 */
	scene: unknown;

	/**
	 * Provide the camera used to render the scene and derive atmosphere rays.
	 */
	camera: unknown;

	/**
	 * Provide the optional Three namespace when the integration needs caller
	 * constructors.
	 */
	THREE?: unknown;

	/**
	 * Provide optional initial viewport dimensions for setup-created runtime
	 * resources. The composer may later resize the installed pass.
	 */
	viewportPixels?: readonly [number, number];

	/**
	 * Provide the largest renderer-produced scene-hit distance encoded for the
	 * runtime shader, in meters.
	 */
	sceneDepthMaxMeters?: number;

	/**
	 * Provide scene units to Algorithm32 meters scale for renderer-produced
	 * scene-hit distances.
	 */
	distanceMultiplier?: number;

	/**
	 * Provide an alias for scene units to Algorithm32 meters scale.
	 */
	metersPerSceneUnit?: number;

	/**
	 * Provide an optional runtime logger for non-fatal frame failures.
	 */
	logger?: Console;
}

/**
 * Control an installed Algorithm32 runtime shader integration.
 */
interface ShaderHandle {
	/**
	 * Replace the facade/runtime shader configuration and refresh resources
	 * required by the installed pass.
	 *
	 * @param config - Supplies the replacement Algorithm32 configuration.
	 * @returns The accepted configuration snapshot.
	 */
	setConfig(config: Config): Promise<ConfigSnapshot>;

	/**
	 * Return deferred shader diagnostics placeholder data.
	 *
	 * @returns Deferred diagnostics placeholder data.
	 */
	getDiagnostics(): unknown;

	/**
	 * Dispose resources owned by the installed runtime shader integration.
	 *
	 * @returns No return value.
	 */
	dispose(): void;
}

/**
 * Describe one CPU/reference evaluation request.
 */
type EvaluationRequest = {
	/**
	 * Store an optional geometry-owned view-ray request packet. When omitted,
	 * the full evaluation request is passed to geometry.
	 */
	viewRayRequest?: unknown;

	/**
	 * Store the model-space ray origin when using the simple view-ray request
	 * shape.
	 */
	origin?: Position;

	/**
	 * Store the normalized model-space ray direction when using the simple
	 * view-ray request shape.
	 */
	direction?: UnitVector3;

	/**
	 * Store the caller-supplied finite ray distance when an upstream
	 * renderer or caller has already chosen the integration endpoint.
	 */
	suppliedDistance?: Distance;

	/**
	 * Override default path interval count for this evaluation.
	 */
	pathIntervalCount?: number;

	/**
	 * Override configured incident-radiance sampling. Explicit null disables
	 * incident sampling for this evaluation.
	 */
	incidentRadianceSampling?: IncidentRadianceSampling | null;

}

/**
 * Describe one CPU/reference evaluation result.
 */
type EvaluationResult = {
	/**
	 * Store spectral path radiance aligned to the configured spectral basis.
	 */
	pathRadiance: SpectralValue;

	/**
	 * Store spectral transmittance aligned to the configured spectral basis.
	 */
	transmittance: SpectralValue;

	/**
	 * Store the geometry-resolved ray segment used for validation.
	 */
	viewRaySegment?: RaySegment;

	/**
	 * Store path integration points used for validation.
	 */
	pathIntegrationPoints?: readonly PathIntegrationPoint[];
}
