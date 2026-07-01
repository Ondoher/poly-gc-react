/**
 * Identify supported distance units.
 *
 * - **meter** - Length measured in meters.
 * - **kilometer** - Length measured in kilometers.
 */
type DistanceUnits = "meter" | "kilometer";

/**
 * Identify supported angle units.
 *
 * - **radian** - Angle measured in radians.
 * - **degree** - Angle measured in degrees.
 */
type AngleUnits = "radian" | "degree";

/**
 * Identify supported wavelength units.
 *
 * - **nanometer** - Wavelength measured in nanometers.
 * - **micrometer** - Wavelength measured in micrometers.
 */
type WavelengthUnits = "nanometer" | "micrometer";

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
 * Describe the spectral basis requested by an Algorithm32 evaluation.
 */
type SpectralBasis = {
	/**
	 * Store the ordered wavelength samples.
	 */
	wavelengths: readonly Wavelength[];
}

/**
 * Describe the inputs needed to sample radiance from the configured light
 * source at one point.
 */
type RadianceSampleRequest = {
	/**
	 * Store the model-space sample position.
	 */
	position: Position;

	/**
	 * Store the normalized outgoing direction at the sample position.
	 */
	outgoingDirection: readonly [number, number, number];

	/**
	 * Store the active spectral basis used by the evaluation.
	 */
	spectral: SpectralBasis;
}

/**
 * Describe the radiance sampled from one light-source point.
 */
type RadianceSample = {
	/**
	 * Store the normalized direction from the sample point toward the light
	 * source.
	 */
	directionToLightSource: readonly [number, number, number];

	/**
	 * Store the light-source distance, or positive infinity when the
	 * light-source implementation has no finite sample distance.
	 */
	distance: Distance;

	/**
	 * Store the apparent angular radius of the light source.
	 */
	angularRadius: Angle;

	/**
	 * Store spectral radiance aligned to the active spectral basis.
	 */
	spectralRadiance: readonly number[];
}

/**
 * Describe the inputs needed to sample incident radiance from the configured
 * light source at one point.
 */
type IncidentRadianceSampleRequest = {
	/**
	 * Store the model-space sample position.
	 */
	position: Position;

	/**
	 * Store the normalized outgoing direction at the sample position.
	 */
	outgoingDirection: readonly [number, number, number];

	/**
	 * Store the active spectral basis used by the evaluation.
	 */
	spectral: SpectralBasis;
}

/**
 * Describe incident radiance sampled from the configured light source's
 * higher-order incident-radiance support.
 */
type IncidentRadianceSample = {
	/**
	 * Store incident spectral radiance aligned to the active spectral basis.
	 */
	spectralRadiance: readonly number[];
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
 * Describe the inputs needed to sample atmosphere medium coefficients.
 */
type AtmosphereSampleRequest = {
	/**
	 * Store the model-space sample position.
	 */
	position: Position;

	/**
	 * Store the altitude above the configured ground reference.
	 */
	altitude: Distance;

	/**
	 * Store the active spectral basis used by the evaluation.
	 */
	spectral: SpectralBasis;
}

/**
 * Store medium coefficients sampled at one point in the atmosphere.
 */
type AtmosphereSample = {
	/**
	 * Store spectral extinction coefficients aligned to the active spectral basis.
	 */
	extinctionCoefficient: readonly number[];

	/**
	 * Store spectral scattering coefficients aligned to the active spectral basis.
	 */
	scatteringCoefficient: readonly number[];

	/**
	 * Store spectral absorption coefficients aligned to the active spectral basis.
	 */
	absorptionCoefficient: readonly number[];

	/**
	 * Store the normalized density sample used to derive the coefficients.
	 */
	density: number;
}

/**
 * Describe the inputs needed to sample an atmosphere phase function.
 */
type PhaseSampleRequest = {
	/**
	 * Store the normalized outgoing direction from the sample point.
	 */
	outgoingDirection: readonly [number, number, number];

	/**
	 * Store the normalized incoming light direction at the sample point.
	 */
	incomingDirection: readonly [number, number, number];
}

/**
 * Store phase-function values for one incoming/outgoing direction pair.
 */
type PhaseSample = {
	/**
	 * Store the scalar phase value used by the active scattering approximation.
	 */
	value: number;
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
 * Describe the ray whose finite integration distance geometry should resolve.
 */
type RayDistanceRequest = {
	/**
	 * Store the model-space ray origin.
	 */
	origin: Position;

	/**
	 * Store the normalized model-space ray direction.
	 */
	direction: readonly [number, number, number];

	/**
	 * Store the caller-supplied finite ray distance when an upstream
	 * renderer or caller has already chosen the integration endpoint. Geometry
	 * resolves the distance from its configured boundaries when this is omitted.
	 */
	suppliedDistance?: Distance;
}

/**
 * Describe the finite ray distance needed by Algorithm32 execution.
 */
type ResolvedRayDistance = {
	/**
	 * Store the finite distance to integrate along the ray.
	 */
	distance: Distance;
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
	 * Configure the spectral basis requested by Algorithm32.
	 */
	spectral: SpectralBasis;

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
	 * Select the runtime shader debug view.
	 */
	debugView?: string;
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
	scene?: unknown;

	/**
	 * Provide the camera used to render the scene and derive atmosphere rays.
	 */
	camera?: unknown;

	/**
	 * Provide the renderer or renderer-compatible surface when setup needs
	 * runtime capabilities or render targets.
	 */
	renderer?: unknown;
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
	 * Replace the scene used by the installed runtime shader integration.
	 *
	 * @param scene - Supplies the replacement scene.
	 * @returns No return value.
	 */
	setScene(scene: unknown): void;

	/**
	 * Replace the camera used by the installed runtime shader integration.
	 *
	 * @param camera - Supplies the replacement camera.
	 * @returns No return value.
	 */
	setCamera(camera: unknown): void;

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
	 * Store the model-space ray origin.
	 */
	origin: Position;

	/**
	 * Store the normalized model-space ray direction.
	 */
	direction: readonly [number, number, number];

	/**
	 * Store the caller-supplied finite ray distance when an upstream
	 * renderer or caller has already chosen the integration endpoint. Geometry
	 * resolves the distance from its configured boundaries when this is omitted.
	 */
	suppliedDistance?: Distance;

}

/**
 * Describe one CPU/reference evaluation result.
 */
type EvaluationResult = {
	/**
	 * Store spectral path radiance aligned to the configured spectral basis.
	 */
	pathRadiance: readonly number[];

	/**
	 * Store spectral transmittance aligned to the configured spectral basis.
	 */
	transmittance: readonly number[];

}
