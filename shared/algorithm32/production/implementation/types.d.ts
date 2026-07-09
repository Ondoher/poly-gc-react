/**
 * Supplies construction dependencies for the CPU/reference algorithm execution
 * collaborator.
 */
type ReferenceDependencies = {
	/**
	 * Store the facade-owned shared model consumed by reference evaluations.
	 */
	readonly model: SharedModel;

	/**
	 * Store optional default incident-radiance sampling for CPU/reference
	 * evaluation.
	 */
	readonly incidentRadianceSampling?: IncidentRadianceSampling | null;

	/**
	 * Store optional execution controls from facade configuration.
	 */
	readonly executionControls?: ExecutionConfig;

	/**
	 * Store an optional calculator double for focused tests.
	 */
	readonly calculator?: SpectralCalculator;
};

/**
 * Supplies construction dependencies for the shared spectral calculator.
 */
type SpectralCalculatorDependencies = {
	/**
	 * Store the configured geometry model.
	 */
	readonly geometry?: GeometryModel;

	/**
	 * Store the configured atmosphere model.
	 */
	readonly atmosphere?: AtmosphereModel;

	/**
	 * Store the configured light-source model.
	 */
	readonly lightSource?: LightSourceModel;

	/**
	 * Store the active spectral basis.
	 */
	readonly spectralBasis?: SpectralBasis;

	/**
	 * Store optional numerical execution controls.
	 */
	readonly executionControls?: ExecutionConfig;
};

/**
 * Store one endpoint/trapezoid path integration point.
 */
type PathIntegrationPoint = {
	/**
	 * Store the point index along the path.
	 */
	readonly pointIndex: number;

	/**
	 * Store distance along the ray in meters.
	 */
	readonly distanceAlongRayMeters: number;

	/**
	 * Store interval length from the previous point in meters.
	 */
	readonly intervalLengthFromPreviousMeters: number;

	/**
	 * Store endpoint/trapezoid weight.
	 */
	readonly trapezoidWeight: number;

	/**
	 * Store effective path measure represented by this point in meters.
	 */
	readonly measureMeters: number;
};

/**
 * Store the immutable spectral transport state accumulated during evaluation.
 */
type TransportState = {
	/**
	 * Store accumulated spectral path radiance.
	 */
	readonly radiance: readonly number[];

	/**
	 * Store current spectral view transmittance.
	 */
	readonly transmittance: readonly number[];
};

/**
 * Store spectral radiance computed along one path.
 */
type PathRadiance = {
	/**
	 * Store path-added in-scattered radiance.
	 */
	readonly inScattered: SpectralValue;

	/**
	 * Store final view-path transmittance.
	 */
	readonly transmittance: SpectralValue;

	/**
	 * Store optional implementation diagnostics for tests and future tooling.
	 */
	readonly diagnostics?: unknown;
};

/**
 * Store optional inputs for one reusable radiance computation.
 */
type ComputeRadianceOptions = {
	/**
	 * Store operation-ready incident-radiance sampling for this computation.
	 */
	readonly incidentRadianceSampling?: IncidentRadianceSampling | null;
};

/**
 * Supplies one incident-radiance cache build request.
 */
type CacheBuildRequest = {
	/**
	 * Store the cache to build.
	 */
	readonly cache: IncidentRadianceCache;

	/**
	 * Store the configured geometry model.
	 */
	readonly geometry: GeometryModel;

	/**
	 * Store the configured atmosphere model.
	 */
	readonly atmosphere: AtmosphereModel;

	/**
	 * Store the configured light-source model.
	 */
	readonly lightSource: LightSourceModel;

	/**
	 * Store the shared spectral calculator.
	 */
	readonly calculator: SpectralCalculator;

	/**
	 * Store optional path interval count for cache-generated rays.
	 */
	readonly pathIntervalCount?: number;

	/**
	 * Store optional source transmittance interval count for cache-generated
	 * rays.
	 */
	readonly sourceTransmittanceIntervalCount?: number;
};

/**
 * Describes a built incident-radiance cache and its operation-ready sampler.
 */
type CacheBuildResult = {
	/**
	 * Store the built cache.
	 */
	readonly cache: IncidentRadianceCache;

	/**
	 * Store the number of cache-owned coordinates that were built.
	 */
	readonly coordinateCount: number;

	/**
	 * Store operation-ready incident-radiance sampling.
	 */
	readonly incidentRadianceSampling: IncidentRadianceSampling;
};

/**
 * Supplies construction dependencies for the runtime shader builder.
 */
type ShaderBuilderDependencies = {
	/**
	 * Store the facade-owned shared model consumed by shader builds.
	 */
	readonly model: SharedModel;

	/**
	 * Store an optional shader assembler collaborator.
	 */
	readonly assembler?: ShaderAssembler;

	/**
	 * Store an optional shader descriptor builder collaborator.
	 */
	readonly descriptorBuilder?: ShaderDescriptorBuilder;

	/**
	 * Store an optional core transport implementation.
	 */
	readonly transport?: Algorithm32Transport;

	/**
	 * Store an optional shader resource builder collaborator.
	 */
	readonly resourceBuilder?: ShaderResourceBuilder;
};

/**
 * Supplies one accepted request to build runtime shader artifacts.
 */
type ShaderBuildRequest = {
	/**
	 * Store the caller-owned Three runtime attachment request.
	 */
	readonly setup: ShaderSetupRequest;

	/**
	 * Store the accepted facade configuration snapshot.
	 */
	readonly config?: ConfigSnapshot;

	/**
	 * Store the optional shader descriptor to assemble during setup.
	 */
	readonly descriptor?: Algorithm32ShaderDescriptor;

	/**
	 * Store optional owner-supplied shader contributions.
	 */
	readonly contributions?: readonly ShaderContribution[];

	/**
	 * Store optional symbols required by the shared main skeleton.
	 */
	readonly mainRequiredSymbols?: readonly string[];

	/**
	 * Store optional symbols supplied by the runtime skeleton.
	 */
	readonly systemProvidedSymbols?: readonly string[];

	/**
	 * Store optional initial runtime binding values by value key.
	 */
	readonly bindingValues?: Record<string, unknown>;

	/**
	 * Store optional texture payloads keyed by runtime value key.
	 */
	readonly texturePayloads?: Record<string, CacheShaderPayloadDescriptor | CacheShaderTexturePayload>;
};

/**
 * Supplies one cache texture resource build request.
 */
type ShaderCacheTextureResourceRequest = {
	/**
	 * Store the caller-provided Three namespace.
	 */
	readonly THREE: unknown;

	/**
	 * Store the runtime value key to bind.
	 */
	readonly valueKey: string;

	/**
	 * Store the cache payload descriptor or texture payload.
	 */
	readonly payload: CacheShaderPayloadDescriptor | CacheShaderTexturePayload;
};

/**
 * Describes one prepared shader texture resource.
 */
type ShaderTextureResource = {
	/**
	 * Store the logical texture id.
	 */
	readonly textureId: string;

	/**
	 * Store the runtime value key.
	 */
	readonly valueKey: string;

	/**
	 * Store the prepared texture.
	 */
	readonly texture: unknown;

	/**
	 * Store resource diagnostics.
	 */
	readonly diagnostics: unknown;

	/**
	 * Dispose the prepared texture.
	 */
	dispose(): void;
};

/**
 * Describes prepared resources for a shader build.
 */
type ShaderResourceBuildResult = {
	/**
	 * Store prepared resources.
	 */
	readonly resources: readonly ShaderTextureResource[];

	/**
	 * Store generated binding values by value key.
	 */
	readonly bindingValues: Record<string, unknown>;

	/**
	 * Dispose prepared resources.
	 */
	dispose(): void;
};

/**
 * Supplies construction data for the renderer-produced scene input capture pass.
 */
type SceneInputCaptureConfiguration = {
	/**
	 * Store the caller-provided Three namespace.
	 */
	readonly THREE: unknown;

	/**
	 * Store the live scene rendered before the Algorithm32 pass.
	 */
	readonly scene: unknown;

	/**
	 * Store the live camera used to render the scene.
	 */
	readonly camera: unknown;

	/**
	 * Store initial capture width in pixels.
	 */
	readonly width?: number;

	/**
	 * Store initial capture height in pixels.
	 */
	readonly height?: number;

	/**
	 * Store the largest representable scene-hit distance, in meters.
	 */
	readonly sceneDepthMaxMeters?: number;

	/**
	 * Store scene units to Algorithm32 meters scale.
	 */
	readonly distanceMultiplier?: number;
};

/**
 * Describes runtime binding values produced by the scene input capture pass.
 */
type SceneInputCaptureBindingValues = {
	/**
	 * Store the packed depth texture consumed by the runtime shader.
	 */
	readonly 'runtime.sceneDepthTexture': unknown;

	/**
	 * Store the explicit hit-mask texture consumed by the runtime shader.
	 */
	readonly 'runtime.sceneHitTexture': unknown;

	/**
	 * Store viewport dimensions consumed by the runtime shader.
	 */
	readonly 'runtime.viewportPixels': unknown;
};

/**
 * Describes an installed runtime shader artifact.
 */
type ShaderRuntimeArtifact = {
	/**
	 * Store the installed composer-compatible pass.
	 */
	readonly pass: unknown;

	/**
	 * Store the Three material created for the pass.
	 */
	readonly material: unknown;

	/**
	 * Store runtime uniforms by GLSL name.
	 */
	readonly uniforms: Record<string, { value: unknown }>;

	/**
	 * Store optional renderer-produced scene input capture pass.
	 */
	readonly sceneInputCapture?: SceneInputCapture | null;

	/**
	 * Store prepared shader resources.
	 */
	readonly resources: readonly ShaderTextureResource[];

	/**
	 * Dispose the installed pass and owned resources.
	 */
	dispose(): void;

	/**
	 * Return internal runtime diagnostics.
	 */
	getDiagnostics(): unknown;
};

/**
 * Supplies construction data for the runtime shader pass.
 */
type ShaderRuntimePassConfiguration = {
	/**
	 * Store the caller-provided Three namespace.
	 */
	readonly THREE: unknown;

	/**
	 * Store the fragment shader source to install.
	 */
	readonly fragmentShaderSource: string;

	/**
	 * Store the fragment source hash.
	 */
	readonly sourceHash: string;

	/**
	 * Store pass uniforms.
	 */
	readonly uniforms: Record<string, { value: unknown }>;

	/**
	 * Store optional preceding renderer-produced scene input texture provider.
	 */
	readonly sceneInputCapture?: SceneInputCapture | null;

	/**
	 * Store an optional runtime logger.
	 */
	readonly logger?: Console | null;
};

/**
 * Describes runtime shader artifacts produced by the shader builder for facade
 * attachment.
 */
type ShaderBuildResult = {
	/**
	 * Store the shared model version used while building the artifacts.
	 */
	readonly modelVersion: number;

	/**
	 * Store the setup request accepted by the builder.
	 */
	readonly setup: ShaderSetupRequest;

	/**
	 * Store optional accepted shader assembly.
	 */
	readonly assembly?: ShaderAssemblyResult;

	/**
	 * Store optional sorted shader binding requirements.
	 */
	readonly bindingRequirements?: readonly ShaderBindingRequirement[];

	/**
	 * Store optional installed runtime pass state.
	 */
	readonly runtime?: ShaderRuntimeArtifact;

	/**
	 * Store optional source-created cache build state for automatic shader
	 * setup.
	 */
	readonly cacheBuild?: CacheBuildResult;

	/**
	 * Store build diagnostics.
	 */
	readonly diagnostics: unknown;
};

/**
 * Describes setup-time context synthesized by ShaderBuilder for automatic
 * configured-model assembly.
 */
type ShaderBuildContext = {
	/**
	 * Store whether this context is assembling from the configured model.
	 */
	readonly automaticAssembly: boolean;

	/**
	 * Store optional source-created cache build output.
	 */
	readonly cacheBuild?: CacheBuildResult | null;

	/**
	 * Store optional built cache used as a shader contribution provider.
	 */
	readonly cache?: IncidentRadianceCache | null;

	/**
	 * Store setup-created texture payloads by runtime value key.
	 */
	readonly texturePayloads?: Record<string, CacheShaderPayloadDescriptor | CacheShaderTexturePayload>;

	/**
	 * Store default main symbols for automatic assembly.
	 */
	readonly mainRequiredSymbols?: readonly string[] | null;
};
