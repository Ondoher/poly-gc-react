import {
	CLEAR_DAY_EARTH_ATMOSPHERE,
	MEAN_EARTH_RADIUS_KM,
	SPHERICAL_ATMOSPHERE_FRAME,
	STANDARD_SUN,
} from '../../../shared/consts.js';

/**
 * Store the astronomical unit in kilometers.
 *
 * @type {number}
 */
export const ASTRONOMICAL_UNIT_KM = 149597870.7;
/**
 * Store the mean solar radius in kilometers.
 *
 * @type {number}
 */
export const MEAN_SOLAR_RADIUS_KM = 696340;
/**
 * Store Earth's mean obliquity for the first real-geometry globe model.
 *
 * @type {number}
 */
export const EARTH_AXIAL_TILT_DEG = 23.43928;
/**
 * Store the J2000 Julian date.
 *
 * @type {number}
 */
export const J2000_JULIAN_DATE = 2451545.0;
/**
 * Store milliseconds per day.
 *
 * @type {number}
 */
export const MILLISECONDS_PER_DAY = 86400000;

/**
 * Store the default globe observer.
 *
 * @type {Readonly<GlobeLocation>}
 */
export const DEFAULT_GLOBE_ROOT = Object.freeze({
	id: 'san-jose-ca',
	name: 'San Jose',
	admin1: 'CA',
	country: 'US',
	lat: 37.3382,
	lon: -121.8863,
	elevationMeters: 30.48,
});

/**
 * Store the fixed globe calibration timestamp.
 *
 * This is San Jose solar noon for the current calibration date.
 *
 * @type {string}
 */
export const DEFAULT_GLOBE_TIME = '2026-06-13T13:07:44-07:00';

/**
 * Store the first globe surface material for atmosphere-only calibration.
 *
 * @type {Readonly<GlobeSurfaceMaterial>}
 */
export const DEFAULT_GLOBE_SURFACE_MATERIAL = Object.freeze({
	model: 'matte-solid-color',
	color: '#3f7f45',
	roughness: 1,
	metalness: 0,
	surfaceFeatures: false,
});

/**
 * Store the default atmosphere profile for spherical calibration.
 *
 * @type {Readonly<FlatAtmosphereProfile>}
 */
export const DEFAULT_GLOBE_ATMOSPHERE_PROFILE = CLEAR_DAY_EARTH_ATMOSPHERE;

/**
 * Store the default atmosphere frame for spherical calibration.
 *
 * @type {Readonly<FlatAtmosphereSphericalShellFrame>}
 */
export const DEFAULT_GLOBE_ATMOSPHERE_FRAME = SPHERICAL_ATMOSPHERE_FRAME;

/**
 * Store Earth-like solar-source notes for the first globe shell.
 *
 * @type {Readonly<Record<string, unknown>>}
 */
export const DEFAULT_GLOBE_SOLAR_SOURCE = Object.freeze({
	model: 'approximate-real-solar-system',
	totalSolarIrradianceWm2: 1361,
	colorTemperatureK: 5778,
	targetDirectNormalIrradianceWm2AtReferencePoint: 1000,
	astronomicalUnitKm: ASTRONOMICAL_UNIT_KM,
	diffuseSkyIrradianceLossFraction: 0.5,
	rendererIrradianceReferenceWm2: 340.25,
	rendererBridge: Object.freeze({
		model: 'temporary-irradiance-to-scattering-source-scale',
		status: 'replace-with-display-exposure-in-phase-4',
	}),
});

/**
 * Store the default radiometric display mapping for globe calibration.
 *
 * @type {Readonly<FlatRadiometricDisplayConfig>}
 */
export const DEFAULT_GLOBE_DISPLAY = Object.freeze({
	model: 'radiometric-display-v1',
	radiometricToSceneRgbScale: 1 / DEFAULT_GLOBE_SOLAR_SOURCE.rendererIrradianceReferenceWm2,
	exposure: 1,
	toneMapping: 'reinhard',
});

/**
 * Store the default globe scene config.
 *
 * @type {Readonly<GlobeSceneConfig>}
 */
export const DEFAULT_GLOBE_CONFIG = Object.freeze({
	root: DEFAULT_GLOBE_ROOT,
	time: DEFAULT_GLOBE_TIME,
	earthRadiusKm: MEAN_EARTH_RADIUS_KM,
	display: DEFAULT_GLOBE_DISPLAY,
});

/**
 * Store the base directional Sun config for globe calibration.
 *
 * @type {Readonly<FlatSunState>}
 */
export const DEFAULT_GLOBE_SUN = Object.freeze({
	...STANDARD_SUN,
	kind: 'point',
	color: Object.freeze({ r: 1, g: 0.98, b: 0.95 }),
	solarIrradianceScale: 1,
	radiusKm: MEAN_SOLAR_RADIUS_KM,
	anchor: Object.freeze({
		kind: 'globe-simulation-date-derived-sun',
		status: 'open',
	}),
});
