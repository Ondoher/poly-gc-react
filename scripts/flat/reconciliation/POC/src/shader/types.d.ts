type ShaderOwnerId =
    | 'runtime'
    | 'geometry'
    | 'lightSource'
    | 'atmosphere'
    | 'cache'
    | 'transport'
    | 'color';

type ShaderUpdateFrequency = 'setup' | 'config' | 'frame';

type ShaderBindingKind = 'uniform' | 'texture' | 'define';

type ShaderBindingRequirement = {
    readonly id: string;
    readonly owner: ShaderOwnerId;
    readonly kind: ShaderBindingKind;
    readonly updateFrequency: ShaderUpdateFrequency;
    readonly valueKey: string;
    readonly required: boolean;
};

type ShaderUniformDescriptor = {
    readonly name: string;
    readonly type: string;
    readonly valueKey: string;
};

type ShaderTextureDescriptor = {
    readonly name: string;
    readonly type: string;
    readonly valueKey: string;
};

type ShaderTextureBuildRequest = {
    readonly textureId: string;
    readonly owner: ShaderOwnerId;
    readonly dimensionality: '1d' | '2d' | '3d';
    readonly dimensions: readonly number[];
    readonly formatPreference: readonly string[];
    readonly samplerPolicy: string;
    readonly valueKey: string;
    readonly accessFunctionName: string;
};

type ShaderTextureBuildResult = {
    readonly textureId: string;
    readonly owner: ShaderOwnerId;
    readonly dimensionality: '1d' | '2d' | '3d';
    readonly dimensions: readonly number[];
    readonly selectedFormat: string;
    readonly samplerPolicy: string;
    readonly valueKey: string;
    readonly accessFunctionName: string;
    readonly accessFunctionBlock: string;
    readonly diagnostics: unknown;
};

type ShaderSourceBlock = {
    readonly id: string;
    readonly slot: string;
    readonly order: number;
    readonly code: string;
};

type ShaderContribution = {
    readonly id: string;
    readonly owner: ShaderOwnerId;
    readonly descriptorFingerprint: string;
    readonly compatibilityTags: readonly string[];
    readonly provides: readonly string[];
    readonly requires: readonly string[];
    readonly defines: readonly string[];
    readonly uniforms: readonly ShaderUniformDescriptor[];
    readonly textures: readonly ShaderTextureDescriptor[];
    readonly functions: readonly ShaderSourceBlock[];
    readonly mainHooks: readonly ShaderSourceBlock[];
    readonly bindingRequirements: readonly ShaderBindingRequirement[];
    readonly diagnostics?: unknown;
};

type ShaderDescriptorSection = {
    readonly descriptorId: string;
    readonly fingerprint: string;
    readonly compatibilityTags: readonly string[];
    readonly facts: unknown;
};

type Algorithm32ShaderDescriptor = {
    readonly descriptorId: string;
    readonly variantId: string;
    readonly fingerprint: string;
    readonly spectralBasis: ShaderDescriptorSection;
    readonly geometry: ShaderDescriptorSection;
    readonly atmosphere: ShaderDescriptorSection;
    readonly lightSource: ShaderDescriptorSection;
    readonly cache: ShaderDescriptorSection;
    readonly transport: ShaderDescriptorSection;
    readonly color: ShaderDescriptorSection;
    readonly runtime: ShaderDescriptorSection;
    readonly compatibilityTags: readonly string[];
};

type ShaderSymbolValidationReport = {
    readonly status: 'accepted' | 'rejected';
    readonly providedSymbols: readonly string[];
    readonly requiredSymbols: readonly string[];
    readonly duplicateProvidedSymbols: readonly string[];
    readonly missingRequiredSymbols: readonly string[];
    readonly unusedProvidedSymbols: readonly string[];
    readonly warnings: readonly string[];
    readonly errors: readonly string[];
};

type ShaderAssemblyResult = {
    readonly status: 'accepted';
    readonly descriptor: Algorithm32ShaderDescriptor;
    readonly fragmentShaderSource: string;
    readonly sourceHash: string;
    readonly contributions: readonly ShaderContribution[];
    readonly validationReport: ShaderSymbolValidationReport;
    readonly bindingRequirements: readonly ShaderBindingRequirement[];
    readonly diagnostics: unknown;
};

type ShaderDescriptorBuildRequest = {
    readonly variantId?: string;
    readonly compatibilityTags?: readonly string[];
    readonly transportOptimization?: ShaderTransportOptimization | null;
    readonly cacheOptimization?: ShaderCacheOptimization | null;
};

type ShaderAssemblyRequest = {
    readonly descriptor: Algorithm32ShaderDescriptor;
    readonly contributions: readonly ShaderContribution[];
    readonly mainRequiredSymbols: readonly string[];
    readonly systemProvidedSymbols?: readonly string[];
};

type ShaderQualityWorkEstimate = {
    readonly pathPointCount: number;
    readonly sourceTransmittancePointCount: number;
    readonly spectralChannelCount: number;
    readonly incidentDirectionCount: number;
    readonly incidentAltitudeBinCount: number;
    readonly incidentSpectralSteps: number;
    readonly sourceTransmittanceSpectralSteps: number;
    readonly totalDominantSpectralSteps: number;
};

type ShaderQualityProfile = {
    readonly id: string;
    readonly label: string;
    readonly role: 'reference' | 'candidate';
    readonly numericalControls: Algorithm32NumericalControls;
    readonly transportOptimization?: ShaderTransportOptimization | null;
    readonly cacheOptimization?: ShaderCacheOptimization | null;
    readonly workEstimate: ShaderQualityWorkEstimate;
    readonly estimatedWorkRatioToIdeal: number;
    readonly notes: string;
};

type ShaderTransportOptimization = {
    readonly pathSampleDistribution?: ShaderPathSampleDistribution | null;
};

type ShaderPathSampleDistribution = {
    readonly kind: 'uniform-distance' | 'tangent-density-adaptive-v1' | 'tangent-density-adaptive-soft-v1';
};

type ShaderCacheOptimization = {
    readonly altitudeLookup?: ShaderCacheAltitudeLookup | null;
};

type ShaderCacheAltitudeLookup = {
    readonly kind: 'nearest-bin' | 'linear-altitude-v1';
};
