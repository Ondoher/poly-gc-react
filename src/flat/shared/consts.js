/**
 * Store the mean Earth radius used by flat shared geometry.
 *
 * @type {number}
 */
export const MEAN_EARTH_RADIUS_KM = 6371.0088;

/**
 * Store the standard Earth atmosphere profile used by `Atmosphere`.
 *
 * @type {Readonly<FlatAtmosphereProfile>}
 */
export const STANDARD_EARTH_ATMOSPHERE = Object.freeze({
	id: 'earth-standard',
	topAltitudeKm: 100,
	seaLevelDensityKgM3: 1.225,
	rayleighScaleHeightKm: 8.5,
	aerosolScaleHeightKm: 1.2,
	rayleighBetaKm: Object.freeze({
		r: 0.005802,
		g: 0.013558,
		b: 0.0331,
	}),
	mieBetaKm: Object.freeze({
		r: 0.003996,
		g: 0.003996,
		b: 0.003996,
	}),
	mieStrength: 0.35,
	mieAnisotropy: 0.8,
	airlightColor: '#9fc7ff',
	maxAirlight: 0.85,
	integrationSteps: 16,
});

/**
 * Store the default flat-slab atmosphere frame for false simulation.
 *
 * @type {Readonly<FlatAtmosphereFlatSlabFrame>}
 */
export const FLAT_ATMOSPHERE_FRAME = Object.freeze({
	kind: 'flat-slab',
	origin: Object.freeze({ x: 0, y: 0, z: 0 }),
	up: Object.freeze({ x: 0, y: 1, z: 0 }),
});

/**
 * Store the default spherical-shell atmosphere frame for standard sky work.
 *
 * @type {Readonly<FlatAtmosphereSphericalShellFrame>}
 */
export const SPHERICAL_ATMOSPHERE_FRAME = Object.freeze({
	kind: 'spherical-shell',
	planetCenter: Object.freeze({ x: 0, y: 0, z: 0 }),
	planetRadiusKm: MEAN_EARTH_RADIUS_KM,
});

/**
 * Store the default directional sun state used by shared atmosphere work.
 *
 * @type {Readonly<FlatSunState>}
 */
export const STANDARD_SUN = Object.freeze({
	kind: 'directional',
	direction: Object.freeze({ x: 0, y: 1, z: 0 }),
	color: Object.freeze({ r: 1, g: 0.96, b: 0.88 }),
	intensity: 1,
	angularRadiusRad: 0.00465,
	radiusKm: 696340,
	anchor: Object.freeze({
		kind: 'known-value',
		status: 'open',
	}),
});
