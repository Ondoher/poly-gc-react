/**
 * Describe one source spectral channel used by concrete light-source models.
 */
type SpectralChannelConstant = {
	/**
	 * Store an optional channel label.
	 */
	readonly name?: string;

	/**
	 * Store an optional production wavelength packet.
	 */
	readonly wavelength: Wavelength;

	/**
	 * Store source spectral irradiance/radiance input for the channel.
	 */
	readonly solarIrradiance: number;

	/**
	 * Store optional represented wavelength-bin width.
	 */
	readonly wavelengthBinWidth?: Wavelength;
};

/**
 * Configure a distant sun light source.
 */
type DistantSunLightSourceConfig = {
	/**
	 * Store the normalized or normalizable direction from sample to source.
	 */
	readonly directionToLight: UnitVector3;

	/**
	 * Store source spectral channels.
	 */
	readonly spectralChannels: readonly SpectralChannelConstant[];

	/**
	 * Store apparent source angular radius in radians.
	 */
	readonly angularRadiusRadians: number;

	/**
	 * Store optional cache altitude bin count.
	 */
	readonly cacheAltitudeBinCount?: number;

	/**
	 * Store optional cache incoming-direction count.
	 */
	readonly cacheDirectionCount?: number;

	/**
	 * Store optional cache boundary altitude in meters.
	 */
	readonly cacheBoundaryAltitudeMeters?: number;
};

/**
 * Configure a finite local sun light source.
 */
type LocalSunLightSourceConfig = {
	/**
	 * Store source-owned key used in descriptors and cache compatibility.
	 */
	readonly sourceKey: string;

	/**
	 * Store source spectral channels.
	 */
	readonly spectralChannels: readonly SpectralChannelConstant[];

	/**
	 * Store the reference distance for incident-scale calibration.
	 */
	readonly referenceDistanceMeters: number;

	/**
	 * Store the neutral spectral incident scale at the reference distance.
	 */
	readonly referenceSpectralIncidentScale: number;

	/**
	 * Store source radius in meters.
	 */
	readonly radiusMeters: number;

	/**
	 * Store whether inverse-square distance falloff is applied.
	 */
	readonly distanceFalloff?: boolean;

	/**
	 * Store local cache z bins in meters.
	 */
	readonly cacheZBinsMeters?: readonly number[];

	/**
	 * Store local cache rho bins in meters.
	 */
	readonly cacheRhoBinsMeters?: readonly number[];

	/**
	 * Store local cache incoming-direction count.
	 */
	readonly cacheDirectionCount?: number;
};

/**
 * Configure a distant incident-radiance cache.
 */
type DistantIncidentRadianceCacheConfig = {
	readonly sourceKey: string;
	readonly bottomRadiusMeters: number;
	readonly topRadiusMeters: number;
	readonly altitudeBinCount: number;
	readonly directionCount: number;
	readonly directionToLight: UnitVector3;
	readonly spectralBasis: SpectralBasis;
	readonly boundaryAltitudeMeters?: number;
};

/**
 * Configure a local incident-radiance cache.
 */
type LocalIncidentRadianceCacheConfig = {
	readonly sourceKey: string;
	readonly zBinsMeters: readonly number[];
	readonly rhoBinsMeters: readonly number[];
	readonly directionCount: number;
	readonly spectralBasis: SpectralBasis;
};

/**
 * Build one cache-owned coordinate.
 */
type CacheCoordinateBuildRequest = {
	readonly coordinate: CacheBuildCoordinate;
	readonly geometry: GeometryModel;
	readonly calculator: unknown;
	readonly pathIntervalCount?: number;
};
