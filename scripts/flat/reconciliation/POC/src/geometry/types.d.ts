type AtmosphereCoordinate = {
    readonly altitudeMeters: number;
};

type AtmospherePathSample = {
    readonly atmosphereCoordinate: AtmosphereCoordinate;
    readonly measureMeters: number;
    readonly intervalLengthFromPreviousMeters: number;
};

type AtmospherePath = {
    readonly start: AtmosphereCoordinate;
    readonly end: AtmosphereCoordinate;
    readonly lengthMeters: number;
    readonly samples?: readonly AtmospherePathSample[];
    readonly blockedByGround?: boolean;
    readonly metadata?: unknown;
};

type SourceRelativePosition = {
    readonly directionFromSource: UnitVector3;
    readonly directionToSource?: UnitVector3;
    readonly distanceFromSourceMeters: number | null;
    readonly radialDistanceFromSourceSubpointMeters?: number;
    readonly altitudeMeters?: number;
    readonly metadata?: unknown;
};

type CacheAccess = {
    readonly cacheKey: string;
    readonly coordinates: readonly number[];
    readonly metadata?: unknown;
};

type FlatObserverCenteredDomeConfig = {
    readonly centerPolicy?: 'observer-centered';
    readonly apexAltitudeMeters: number;
    readonly maxObserverViewRayExtentMeters: number;
};

type FlatObserverCenteredDomeDescriptor = {
    readonly centerPolicy: 'observer-centered';
    readonly apexAltitudeMeters: number;
    readonly maxObserverViewRayExtentMeters: number;
    readonly observerAltitudeMeters: number;
    readonly sphereCenterMeters: Position;
    readonly sphereRadiusMeters: number;
};

interface GeometryModel {
    resolveViewRaySegment(...args: readonly unknown[]): RaySegment;
    resolveAtmosphereCoordinate(position: Position): AtmosphereCoordinate;
    resolveAtmospherePath(...args: readonly unknown[]): AtmospherePath;
    resolveSourceRelativePosition(...args: readonly unknown[]): SourceRelativePosition;
    resolveCacheAccess(...args: readonly unknown[]): CacheAccess;
    mapObserverLocalScenePointToModelPosition?(...args: readonly unknown[]): Position;
    mapObserverLocalSceneDirectionToModelDirection?(...args: readonly unknown[]): UnitVector3;
    createThreeEndpointObjects?(request?: GeometryThreeEndpointObjectsRequest): GeometryThreeEndpointObjects;
}

type GeometryThreeEndpointObjectsRequest = {
    readonly metersPerSceneUnit?: number;
    readonly scaleDenominator?: number;
    readonly spectralReferenceId?: string;
    readonly visualMaterialColor?: number;
    readonly widthSegments?: number;
    readonly heightSegments?: number;
    readonly name?: string;
};

type GeometryThreeEndpointObjects = {
    readonly visualObjects: readonly unknown[];
    readonly raycastObjects: readonly unknown[];
    readonly metadata: unknown;
};

type SphericalGeometryConfig = {
    readonly bottomRadiusMeters: number;
    readonly topRadiusMeters: number;
    readonly observerHeightMeters?: number;
    readonly observerUpDirection?: UnitVector3;
    readonly sourceDirection?: UnitVector3;
    readonly cacheAltitudeBinCount?: number;
    readonly cacheBoundaryAltitudeMeters?: number;
    readonly sourceTransmittanceIntervalCount?: number;
};

type FlatEarthGeometryConfig = {
    readonly observerPositionMeters?: Position;
    readonly sourcePositionMeters: Position;
    readonly topAltitudeMeters: number;
    readonly sceneSkyRayLimitMeters?: number;
    readonly observerCenteredDome?: FlatObserverCenteredDomeConfig | null;
    readonly sourceTransmittanceIntervalCount?: number;
    readonly cacheZBinsMeters?: readonly number[];
    readonly cacheRhoBinsMeters?: readonly number[];
    readonly runtimeDiagnosticLimit?: number;
};
