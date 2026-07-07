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
