type IncidentRadianceSample = {
    readonly incomingDirection: UnitVector3;
    readonly radiance: SpectralValue;
    readonly weight: number;
};

interface IncidentRadianceSampler {
    (cacheAccess: CacheAccess): readonly IncidentRadianceSample[];
}

type IncidentRadianceSampling = {
    readonly cacheDescriptor: IncidentRadianceCacheDescriptor;
    readonly incidentRadianceSampler: IncidentRadianceSampler;
};

type CacheBuildCoordinate = {
    readonly coordinateKey: string;
    readonly coordinates: readonly number[];
    readonly altitudeBinIndex?: number;
    readonly directionIndex?: number;
    readonly zBinIndex?: number;
    readonly rhoBinIndex?: number;
    readonly altitudeMeters?: number;
    readonly rhoMeters?: number;
    readonly incomingDirection?: UnitVector3;
    readonly metadata?: unknown;
};

type CacheShaderPayloadDescriptor = {
    readonly payloadKind: string;
    readonly dimensions: readonly number[];
    readonly format: string;
    readonly texture?: CacheShaderTexturePayload;
    readonly lookup?: unknown;
    readonly metadata?: unknown;
};

type CacheShaderTexturePayload = {
    readonly kind: string;
    readonly textureId: string;
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    readonly dimensionality: '3d';
    readonly format: string;
    readonly samplerPolicy: string;
    readonly coordinateOrder: readonly string[];
    readonly spectralGroupSize: number;
    readonly spectralGroupCount: number;
    readonly spectralChannelCount: number;
    readonly rgbaFloat32: readonly number[];
};

interface IncidentRadianceCache {
    readonly descriptor: IncidentRadianceCacheDescriptor;
    coordinates(): Iterable<CacheBuildCoordinate>;
    addCoordinateToCache(...args: readonly unknown[]): void;
    createIncidentRadianceSampler(): IncidentRadianceSampler;
    createShaderPayload?(): CacheShaderPayloadDescriptor;
}

type DistantIncidentRadianceCacheConfig = {
    readonly descriptor: IncidentRadianceCacheDescriptor;
    readonly bottomRadiusMeters: number;
    readonly topRadiusMeters: number;
    readonly altitudeBinCount: number;
    readonly directionCount: number;
    readonly directionToLight: UnitVector3;
    readonly spectralBasis: SpectralBasis;
    readonly boundaryAltitudeMeters?: number;
};

type LocalIncidentRadianceCacheConfig = {
    readonly descriptor: IncidentRadianceCacheDescriptor;
    readonly zBinsMeters: readonly number[];
    readonly rhoBinsMeters: readonly number[];
    readonly directionCount: number;
    readonly spectralBasis: SpectralBasis;
};
