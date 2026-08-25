type DirectLightingSample = {
    readonly incidentRadiance: SpectralValue;
    readonly directionToLight: UnitVector3;
    readonly sourceTransmittance?: SpectralValue;
    readonly metadata?: unknown;
};

type SourcePathLimit = {
    readonly maxDistanceMeters: number | null;
    readonly reason: string;
};

type IncidentRadianceCacheDescriptor = {
    readonly cacheKind: 'none' | 'distant' | 'local';
    readonly sourceKey: string;
    readonly version: number;
    readonly dimensions?: readonly string[];
    readonly metadata?: unknown;
};

type LightSourceThreeLightingRequest = {
    readonly THREE: unknown;
    readonly sourceRelativePosition: SourceRelativePosition;
    readonly sourcePositionSceneUnits: Position;
    readonly observerScenePositionUnits?: Position;
    readonly calibrationScalar?: number;
    readonly ambientIntensity?: number;
    readonly endpointIndirectFill?: LightSourceThreeEndpointIndirectFillRequest;
    readonly endpointColorStatus?: string;
    readonly endpointSceneLightScalePolicy?: 'endpoint-material-shading' | 'observer-incident-scale';
    readonly shadow?: LightSourceThreeShadowRequest;
};

type LightSourceThreeLightingObjects = {
    readonly lights: readonly unknown[];
    readonly sceneObjects?: readonly unknown[];
    readonly metadata: unknown;
};

type LightSourceThreeShadowRequest = {
    readonly enabled: boolean;
    readonly focusSceneUnits?: Position;
    readonly extentSceneUnits?: number;
    readonly lightDistanceSceneUnits?: number;
    readonly cameraNear?: number;
    readonly cameraFar?: number;
    readonly mapSize?: number;
    readonly bias?: number;
    readonly normalBias?: number;
};

type LightSourceThreeEndpointIndirectFillRequest = {
    readonly enabled: boolean;
    readonly policy?: 'general-ambient-fill' | 'opposite-directional-fill' | 'source-direction-falloff-fill';
    readonly anchorSceneUnits?: Position;
    readonly intensityRatio?: number;
    readonly distanceSceneUnits?: number;
};

interface LightSourceModel {
    describeIncidentRadianceCache(...args: readonly unknown[]): IncidentRadianceCacheDescriptor;
    createIncidentRadianceCache(...args: readonly unknown[]): IncidentRadianceCache;
    sampleDirectLighting(...args: readonly unknown[]): DirectLightingSample;
    resolveSourcePathLimit(...args: readonly unknown[]): SourcePathLimit;
    createThreeLightingObjects?(request?: LightSourceThreeLightingRequest): LightSourceThreeLightingObjects;
}

type DistantSunLightSourceConfig = {
    readonly directionToLight: UnitVector3;
    readonly spectralChannels: readonly SpectralChannelConstant[];
    readonly angularRadiusRadians: number;
    readonly cacheAltitudeBinCount?: number;
    readonly cacheDirectionCount?: number;
    readonly cacheBoundaryAltitudeMeters?: number;
};

type CanonicalSolarIlluminationSourceConfiguration = Readonly<{
    /** Supplies the existing canonical solar spectral-irradiance packet. */
    readonly irradiancePacket:
        import('../external-celestial-sources/SpectralDensityPacket.js').default;
    /** Supplies the exact unit direction from each atmosphere point to the Sun. */
    readonly directionToLight: UnitVector3;
    /** Supplies the exact apparent solar angular radius in radians. */
    readonly angularRadiusRadians: number;
    /** Supplies the required positive distant-cache altitude-bin count. */
    readonly cacheAltitudeBinCount: number;
    /** Supplies the required positive distant-cache direction count. */
    readonly cacheDirectionCount: number;
    /** Supplies the exact nonnegative cache boundary altitude in meters. */
    readonly cacheBoundaryAltitudeMeters: number;
}>;

type CanonicalSolarIncidentRadianceCacheRequest = Readonly<{
    /** Supplies the positive atmosphere bottom radius in meters. */
    readonly bottomRadiusMeters: number;
    /** Supplies the atmosphere top radius above the bottom radius in meters. */
    readonly topRadiusMeters: number;
    /** Supplies the calculator-facing basis with canonical channel centers. */
    readonly spectralBasis: SpectralBasis;
    /** Optionally repeats, but may not override, the source-owned boundary altitude. */
    readonly boundaryAltitudeMeters?: number;
}>;

type CanonicalSolarIlluminationOwnership = Readonly<{
    /** Confirms the constructor retained the supplied canonical packet object. */
    readonly canonicalPacketRetainedByIdentity: true;
    /** Confirms the constructor retained the supplied provenance object. */
    readonly canonicalProvenanceRetainedByIdentity: true;
    /** Identifies the retained canonical packet. */
    readonly canonicalPacketFingerprint: string;
    /** Identifies the canonical spectral-density basis. */
    readonly canonicalBasisFingerprint: string;
    /** Confirms direct-light samples expose the packet's immutable values by identity. */
    readonly incidentRadianceArrayRetainedByIdentity: true;
    /** States that direct lighting returns the retained packet values by identity. */
    readonly singleSpectrumPolicy: string;
    /** Lists integration seams intentionally absent from this source. */
    readonly excludedIntegrationSeams: readonly string[];
}>;

type CanonicalSolarIlluminationDescriptor = Readonly<{
    /** Names the reset-only canonical illumination contract. */
    readonly kind: 'canonical-solar-illumination-source-v1';
    /** Retains distant-Sun cache routing parity. */
    readonly sourceKey: 'distant-sun';
    /** Identifies the sole canonical irradiance packet. */
    readonly canonicalIrradiancePacketFingerprint: string;
    /** Identifies the canonical quantity-bearing basis. */
    readonly canonicalIrradianceBasisFingerprint: string;
    /** Retains canonical source identity without duplicating spectrum values. */
    readonly canonicalIrradianceSourceIdentity: Readonly<{
        readonly sourceId: string;
        readonly sourceVersion: string;
        readonly sourceHashSha256: string;
    }>;
    /** Stores the exact direction to the Sun. */
    readonly directionToLight: UnitVector3;
    /** Stores the exact apparent solar angular radius. */
    readonly angularRadiusRadians: number;
    /** Retains the source-owned distant-cache descriptor. */
    readonly incidentRadianceCache: IncidentRadianceCacheDescriptor;
    /** Retains quantity ownership and excluded legacy seams. */
    readonly ownership: Readonly<Record<string, string | readonly string[]>>;
    /** Identifies this immutable descriptor. */
    readonly fingerprint: string;
}>;

type CanonicalSolarIlluminationSourceModel = Readonly<{
    /** Retains the sole canonical solar irradiance packet by identity. */
    readonly irradiancePacket:
        import('../external-celestial-sources/SpectralDensityPacket.js').default;
    /** Identifies the retained canonical irradiance packet. */
    readonly canonicalIrradiancePacketFingerprint: string;
    /** Retains the canonical packet's exact provenance object by identity. */
    readonly canonicalIrradianceProvenance: Readonly<Record<string, unknown>>;
    /** Stores the exact direction to the Sun. */
    readonly directionToLight: UnitVector3;
    /** Stores the opposite exact source-emission direction. */
    readonly directionFromSource: UnitVector3;
    /** Stores the exact solar angular radius. */
    readonly angularRadiusRadians: number;
    /** Stores the source-owned cache altitude-bin count. */
    readonly cacheAltitudeBinCount: number;
    /** Stores the source-owned cache direction count. */
    readonly cacheDirectionCount: number;
    /** Stores the source-owned cache boundary altitude. */
    readonly cacheBoundaryAltitudeMeters: number;
    /** Retains the source-owned cache descriptor. */
    readonly incidentRadianceCacheDescriptor: IncidentRadianceCacheDescriptor;
    /** Retains the stable source descriptor body. */
    readonly descriptor: Omit<CanonicalSolarIlluminationDescriptor, 'fingerprint'>;
    /** Identifies the stable source descriptor. */
    readonly fingerprint: string;
    /** Retains canonical ownership and excluded legacy values. */
    readonly ownership: CanonicalSolarIlluminationOwnership;
    /** Describes this source and its fingerprint. */
    readonly describe: () => CanonicalSolarIlluminationDescriptor;
    /** Describes the distant incident-radiance cache. */
    readonly describeIncidentRadianceCache: () => IncidentRadianceCacheDescriptor;
    /** Creates the distant incident-radiance cache. */
    readonly createIncidentRadianceCache:
        (request: CanonicalSolarIncidentRadianceCacheRequest) => IncidentRadianceCache;
    /** Samples canonical direct solar irradiance. */
    readonly sampleDirectLighting: () => DirectLightingSample;
    /** Resolves the distant source path boundary. */
    readonly resolveSourcePathLimit: () => SourcePathLimit;
}>;

type LocalSunLightSourceConfig = {
    readonly sourceKey: string;
    readonly spectralChannels: readonly SpectralChannelConstant[];
    readonly referenceDistanceMeters: number;
    readonly referenceSpectralIncidentScale: number;
    readonly radiusMeters: number;
    readonly distanceFalloff?: boolean;
    readonly cacheZBinsMeters?: readonly number[];
    readonly cacheRhoBinsMeters?: readonly number[];
    readonly cacheDirectionCount?: number;
};
