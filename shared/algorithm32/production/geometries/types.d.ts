/**
 * Configure spherical Earth atmosphere geometry.
 */
type SphericalEarthGeometryConfig = {
	/**
	 * Store ground radius in meters.
	 */
	readonly bottomRadiusMeters: number;

	/**
	 * Store top atmosphere radius in meters.
	 */
	readonly topRadiusMeters: number;

	/**
	 * Store observer height above the ground radius in meters.
	 */
	readonly observerHeightMeters?: number;

	/**
	 * Store observer up direction.
	 */
	readonly observerUpDirection?: UnitVector3;

	/**
	 * Store how Three scene directions map into spherical model space.
	 */
	readonly sceneFrame?: SphericalEarthSceneFrameConfig | null;

	/**
	 * Store the configured source direction.
	 */
	readonly sourceDirection?: UnitVector3;

	/**
	 * Store altitude bin count for distant incident-radiance cache access.
	 */
	readonly cacheAltitudeBinCount?: number;

	/**
	 * Store minimum cache altitude in meters.
	 */
	readonly cacheBoundaryAltitudeMeters?: number;

	/**
	 * Store source-path optical-depth integration interval count.
	 */
	readonly sourceTransmittanceIntervalCount?: number;
};

/**
 * Configure scene-direction basis mapping for spherical shader setup.
 */
type SphericalEarthSceneFrameConfig = {
	/**
	 * Use observer-local axes or direct model-space axes.
	 */
	readonly kind: "observer-local" | "model-space";
};

/**
 * Configure flat Earth atmosphere geometry.
 */
type FlatEarthGeometryConfig = {
	/**
	 * Store observer position in flat meters.
	 */
	readonly observerPositionMeters?: readonly [number, number, number];

	/**
	 * Store local source position in flat meters.
	 */
	readonly sourcePositionMeters: readonly [number, number, number];

	/**
	 * Store top atmosphere altitude in meters.
	 */
	readonly topAltitudeMeters: number;

	/**
	 * Store optional sky ray cap in meters for unbounded flat rays.
	 */
	readonly sceneSkyRayLimitMeters?: number | null;

	/**
	 * Store optional observer-centered dome configuration.
	 */
	readonly observerCenteredDome?: FlatObserverCenteredDomeConfig | null;

	/**
	 * Store source-path optical-depth integration interval count.
	 */
	readonly sourceTransmittanceIntervalCount?: number;

	/**
	 * Store local cache z bins in meters.
	 */
	readonly cacheZBinsMeters?: readonly number[];

	/**
	 * Store local cache rho bins in meters.
	 */
	readonly cacheRhoBinsMeters?: readonly number[];

	/**
	 * Store diagnostic retention limit.
	 */
	readonly runtimeDiagnosticLimit?: number;
};

/**
 * Configure an observer-centered flat atmosphere dome.
 */
type FlatObserverCenteredDomeConfig = {
	/**
	 * Store the dome center policy.
	 */
	readonly centerPolicy?: "observer-centered";

	/**
	 * Store dome apex altitude in meters.
	 */
	readonly apexAltitudeMeters: number;

	/**
	 * Store maximum observer view-ray extent in meters.
	 */
	readonly maxObserverViewRayExtentMeters: number;
};

/**
 * Store derived observer-centered dome facts.
 */
type FlatObserverCenteredDomeDescriptor = {
	readonly centerPolicy: "observer-centered";
	readonly apexAltitudeMeters: number;
	readonly maxObserverViewRayExtentMeters: number;
	readonly observerAltitudeMeters: number;
	readonly sphereCenterMeters: readonly [number, number, number];
	readonly sphereRadiusMeters: number;
};
