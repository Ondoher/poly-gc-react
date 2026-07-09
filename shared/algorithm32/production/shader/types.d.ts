/**
 * Identifies the owner of one shader contribution.
 */
type ShaderOwnerId =
	| 'runtime'
	| 'geometry'
	| 'lightSource'
	| 'atmosphere'
	| 'cache'
	| 'transport'
	| 'color';

/**
 * Identifies when a shader binding value is expected to update.
 */
type ShaderUpdateFrequency =
	| 'setup'
	| 'config'
	| 'frame';

/**
 * Identifies the kind of binding consumed by a shader contribution.
 */
type ShaderBindingKind =
	| 'uniform'
	| 'texture'
	| 'define';

/**
 * Identifies a shader source assembly slot.
 */
type ShaderSourceSlot =
	| 'declareTypes'
	| 'declareConstants'
	| 'declareHelpers'
	| 'reconstructRay'
	| 'resolvePathBounds'
	| 'sampleAtmosphere'
	| 'sampleLightSource'
	| 'lookupIncidentRadiance'
	| 'evaluateTransport'
	| 'composeSceneColor'
	| 'encodeOutput'
	| 'diagnosticOutput';

/**
 * Identifies supported texture dimensionality.
 */
type ShaderTextureDimensionality =
	| '1d'
	| '2d'
	| '3d';

/**
 * Describes one runtime shader binding requirement.
 */
type ShaderBindingRequirement = {
	/**
	 * Store the stable binding id.
	 */
	readonly id: string;

	/**
	 * Store the owner requesting the binding.
	 */
	readonly owner: ShaderOwnerId;

	/**
	 * Store the binding kind.
	 */
	readonly kind: ShaderBindingKind;

	/**
	 * Store the update frequency.
	 */
	readonly updateFrequency: ShaderUpdateFrequency;

	/**
	 * Store the runtime value key used by the binder.
	 */
	readonly valueKey: string;

	/**
	 * Store whether setup must fail when the value is unavailable.
	 */
	readonly required: boolean;
};

/**
 * Describes one shader uniform declaration.
 */
type ShaderUniformDescriptor = {
	/**
	 * Store the GLSL uniform name.
	 */
	readonly name: string;

	/**
	 * Store the GLSL uniform type.
	 */
	readonly type: string;

	/**
	 * Store the runtime value key.
	 */
	readonly valueKey: string;

	/**
	 * Store an optional owner-supplied default value used when setup has not
	 * provided a live runtime value.
	 */
	readonly defaultValue?: unknown;
};

/**
 * Describes one shader texture sampler declaration.
 */
type ShaderTextureDescriptor = {
	/**
	 * Store the GLSL texture uniform name.
	 */
	readonly name: string;

	/**
	 * Store the GLSL sampler type.
	 */
	readonly type: string;

	/**
	 * Store the runtime value key.
	 */
	readonly valueKey: string;
};

/**
 * Describes one ordered GLSL source block.
 */
type ShaderSourceBlock = {
	/**
	 * Store the stable block id.
	 */
	readonly id: string;

	/**
	 * Store the assembly slot.
	 */
	readonly slot: ShaderSourceSlot;

	/**
	 * Store the slot-local ordering value.
	 */
	readonly order: number;

	/**
	 * Store the GLSL source code.
	 */
	readonly code: string;
};

/**
 * Describes one owner-provided shader contribution.
 */
type ShaderContribution = {
	/**
	 * Store the stable contribution id.
	 */
	readonly id: string;

	/**
	 * Store the contribution owner.
	 */
	readonly owner: ShaderOwnerId;

	/**
	 * Store the descriptor or descriptor-section fingerprint this contribution targets.
	 */
	readonly descriptorFingerprint: string;

	/**
	 * Store optional compatibility tags.
	 */
	readonly compatibilityTags: readonly string[];

	/**
	 * Store shader symbols provided by this contribution.
	 */
	readonly provides: readonly string[];

	/**
	 * Store shader symbols required by this contribution.
	 */
	readonly requires: readonly string[];

	/**
	 * Store define lines emitted before uniforms and functions.
	 */
	readonly defines: readonly string[];

	/**
	 * Store uniform declarations.
	 */
	readonly uniforms: readonly ShaderUniformDescriptor[];

	/**
	 * Store texture declarations.
	 */
	readonly textures: readonly ShaderTextureDescriptor[];

	/**
	 * Store GLSL function/type/helper blocks.
	 */
	readonly functions: readonly ShaderSourceBlock[];

	/**
	 * Store ordered main-body hook blocks.
	 */
	readonly mainHooks: readonly ShaderSourceBlock[];

	/**
	 * Store runtime binding requirements.
	 */
	readonly bindingRequirements: readonly ShaderBindingRequirement[];

	/**
	 * Store optional owner diagnostics for tests and tooling.
	 */
	readonly diagnostics?: unknown;
};

/**
 * Supplies context to an owner-provided shader contribution method.
 */
type ShaderContributionRequest = {
	/**
	 * Store the active complete shader descriptor.
	 */
	readonly descriptor: Algorithm32ShaderDescriptor;

	/**
	 * Store the accepted config snapshot.
	 */
	readonly config?: ConfigSnapshot;

	/**
	 * Store the shader setup request.
	 */
	readonly setup: ShaderSetupRequest;

	/**
	 * Store the shared model.
	 */
	readonly model: SharedModel;

	/**
	 * Store optional texture payloads keyed by runtime value key.
	 */
	readonly texturePayloads?: Record<string, CacheShaderPayloadDescriptor | CacheShaderTexturePayload>;
};

/**
 * Describes one shader descriptor section.
 */
type ShaderDescriptorSection = {
	/**
	 * Store the section descriptor id.
	 */
	readonly descriptorId: string;

	/**
	 * Store the section fingerprint.
	 */
	readonly fingerprint: string;

	/**
	 * Store section compatibility tags.
	 */
	readonly compatibilityTags: readonly string[];

	/**
	 * Store section-owned facts.
	 */
	readonly facts: unknown;
};

/**
 * Describes one complete shader descriptor assembled from owner sections.
 */
type Algorithm32ShaderDescriptor = {
	/**
	 * Store the descriptor id.
	 */
	readonly descriptorId: string;

	/**
	 * Store the variant id.
	 */
	readonly variantId: string;

	/**
	 * Store the full descriptor fingerprint.
	 */
	readonly fingerprint: string;

	/**
	 * Store the spectral-basis descriptor section.
	 */
	readonly spectralBasis: ShaderDescriptorSection;

	/**
	 * Store the geometry descriptor section.
	 */
	readonly geometry: ShaderDescriptorSection;

	/**
	 * Store the atmosphere descriptor section.
	 */
	readonly atmosphere: ShaderDescriptorSection;

	/**
	 * Store the light-source descriptor section.
	 */
	readonly lightSource: ShaderDescriptorSection;

	/**
	 * Store the cache descriptor section.
	 */
	readonly cache: ShaderDescriptorSection;

	/**
	 * Store the transport descriptor section.
	 */
	readonly transport: ShaderDescriptorSection;

	/**
	 * Store the color descriptor section.
	 */
	readonly color: ShaderDescriptorSection;

	/**
	 * Store the runtime descriptor section.
	 */
	readonly runtime: ShaderDescriptorSection;

	/**
	 * Store descriptor-wide compatibility tags.
	 */
	readonly compatibilityTags: readonly string[];
};

/**
 * Describes one shader symbol validation report.
 */
type ShaderSymbolValidationReport = {
	/**
	 * Store whether validation accepted or rejected the request.
	 */
	readonly status: 'accepted' | 'rejected';

	/**
	 * Store sorted provided symbols.
	 */
	readonly providedSymbols: readonly string[];

	/**
	 * Store sorted required symbols.
	 */
	readonly requiredSymbols: readonly string[];

	/**
	 * Store symbols provided by multiple contributions.
	 */
	readonly duplicateProvidedSymbols: readonly string[];

	/**
	 * Store required symbols not provided by contributions or the runtime skeleton.
	 */
	readonly missingRequiredSymbols: readonly string[];

	/**
	 * Store provided symbols not required by the request.
	 */
	readonly unusedProvidedSymbols: readonly string[];

	/**
	 * Store non-fatal validation messages.
	 */
	readonly warnings: readonly string[];

	/**
	 * Store fatal validation messages.
	 */
	readonly errors: readonly string[];
};

/**
 * Supplies one shader assembly request.
 */
type ShaderAssemblyRequest = {
	/**
	 * Store the complete shader descriptor.
	 */
	readonly descriptor: Algorithm32ShaderDescriptor;

	/**
	 * Store owner-supplied shader contributions.
	 */
	readonly contributions: readonly ShaderContribution[];

	/**
	 * Store symbols required by the shared main skeleton.
	 */
	readonly mainRequiredSymbols: readonly string[];

	/**
	 * Store symbols supplied by the runtime skeleton rather than a contribution.
	 */
	readonly systemProvidedSymbols?: readonly string[];
};

/**
 * Supplies one shader descriptor build request.
 */
type ShaderDescriptorBuildRequest = {
	/**
	 * Store the shared model used to derive owner descriptors.
	 */
	readonly model?: SharedModel;

	/**
	 * Store an already-created shared model snapshot.
	 */
	readonly snapshot?: SharedModelSnapshot;

	/**
	 * Store the accepted config snapshot.
	 */
	readonly config?: ConfigSnapshot;

	/**
	 * Store the optional Color abstraction.
	 */
	readonly color?: Color | null;

	/**
	 * Store an optional cache descriptor for the active resource policy.
	 */
	readonly cacheDescriptor?: IncidentRadianceCacheDescriptor;

	/**
	 * Store an optional descriptor variant id.
	 */
	readonly variantId?: string;

	/**
	 * Store additional compatibility tags.
	 */
	readonly compatibilityTags?: readonly string[];
};

/**
 * Describes one accepted shader assembly result.
 */
type ShaderAssemblyResult = {
	/**
	 * Store the accepted assembly status.
	 */
	readonly status: 'accepted';

	/**
	 * Store the descriptor used for assembly.
	 */
	readonly descriptor: Algorithm32ShaderDescriptor;

	/**
	 * Store the assembled fragment shader source.
	 */
	readonly fragmentShaderSource: string;

	/**
	 * Store a stable hash of the assembled source.
	 */
	readonly sourceHash: string;

	/**
	 * Store sorted accepted contributions.
	 */
	readonly contributions: readonly ShaderContribution[];

	/**
	 * Store the validation report used for assembly.
	 */
	readonly validationReport: ShaderSymbolValidationReport;

	/**
	 * Store sorted runtime binding requirements.
	 */
	readonly bindingRequirements: readonly ShaderBindingRequirement[];

	/**
	 * Store internal assembly diagnostics.
	 */
	readonly diagnostics: unknown;
};

/**
 * Describes a shader assembler collaborator.
 */
type ShaderAssembler = {
	/**
	 * Assemble one shader request.
	 */
	assemble(request: ShaderAssemblyRequest): ShaderAssemblyResult;
};

/**
 * Supplies construction options for the shader assembler.
 */
type ShaderAssemblerConfiguration = {
	/**
	 * Store an optional validation collaborator.
	 */
	readonly validator?: ShaderCompatibilityValidator;
};

/**
 * Supplies one texture descriptor build request.
 */
type ShaderTextureBuildRequest = {
	/**
	 * Store the stable texture id.
	 */
	readonly textureId: string;

	/**
	 * Store the texture owner.
	 */
	readonly owner: ShaderOwnerId;

	/**
	 * Store the texture dimensionality.
	 */
	readonly dimensionality: ShaderTextureDimensionality;

	/**
	 * Store texture dimensions in owner-defined order.
	 */
	readonly dimensions: readonly number[];

	/**
	 * Store preferred runtime formats in priority order.
	 */
	readonly formatPreference: readonly string[];

	/**
	 * Store sampler policy details.
	 */
	readonly samplerPolicy: unknown;

	/**
	 * Store the runtime value key.
	 */
	readonly valueKey: string;

	/**
	 * Store the generated GLSL access function name.
	 */
	readonly accessFunctionName: string;
};

/**
 * Describes one generated texture access descriptor.
 */
type ShaderTextureBuildResult = {
	/**
	 * Store the stable texture id.
	 */
	readonly textureId: string;

	/**
	 * Store the texture owner.
	 */
	readonly owner: ShaderOwnerId;

	/**
	 * Store the selected dimensionality.
	 */
	readonly dimensionality: ShaderTextureDimensionality;

	/**
	 * Store immutable texture dimensions.
	 */
	readonly dimensions: readonly number[];

	/**
	 * Store the selected runtime format.
	 */
	readonly selectedFormat: string;

	/**
	 * Store sampler policy details.
	 */
	readonly samplerPolicy: unknown;

	/**
	 * Store the runtime value key.
	 */
	readonly valueKey: string;

	/**
	 * Store the GLSL access function name.
	 */
	readonly accessFunctionName: string;

	/**
	 * Store the generated GLSL function block.
	 */
	readonly accessFunctionBlock: string;

	/**
	 * Store texture-build diagnostics.
	 */
	readonly diagnostics: unknown;
};
