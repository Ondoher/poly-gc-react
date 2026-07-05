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

interface LightSourceModel {
    describeIncidentRadianceCache(...args: readonly unknown[]): IncidentRadianceCacheDescriptor;
    createIncidentRadianceCache(...args: readonly unknown[]): IncidentRadianceCache;
    sampleDirectLighting(...args: readonly unknown[]): DirectLightingSample;
    resolveSourcePathLimit(...args: readonly unknown[]): SourcePathLimit;
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
