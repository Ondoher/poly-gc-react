import {
	CLEAR_DAY_EARTH_ATMOSPHERE,
	FLAT_ATMOSPHERE_FRAME,
	MEAN_EARTH_RADIUS_KM,
} from '../../../shared/consts.js';
import { createMountainSimulationRectangles } from './mountain-simulation.js';

export { MEAN_EARTH_RADIUS_KM };

/**
 * Store the north-pole azimuthal equidistant Earth floor radius.
 *
 * @type {number}
 */
export const EARTH_PROJECTION_RADIUS_KM = Math.PI * MEAN_EARTH_RADIUS_KM;
/**
 * Convert miles to kilometers.
 *
 * @type {number}
 */
export const KM_PER_MILE = 1.609344;
/**
 * Store one solar day in hours.
 *
 * @type {number}
 */
export const SOLAR_DAY_HOURS = 24;
/**
 * Store one sidereal day in hours.
 *
 * @type {number}
 */
export const SIDEREAL_DAY_HOURS = 23.9344696;
/**
 * Store the visible solar-day loop duration in seconds.
 *
 * @type {number}
 */
export const SOLAR_DAY_DISPLAY_SECONDS = 40;
/**
 * Store the visible sidereal-day loop duration in seconds.
 *
 * @type {number}
 */
export const SIDEREAL_DAY_DISPLAY_SECONDS = SOLAR_DAY_DISPLAY_SECONDS * (SIDEREAL_DAY_HOURS / SOLAR_DAY_HOURS);
/**
 * Store the Karman-line atmosphere height in kilometers.
 *
 * @type {number}
 */
export const KARMAN_LINE_KM = 100;
/**
 * Store the first local false-sun light strength assumption.
 *
 * The nearby false sun is intentionally not solar-calibrated yet; this value
 * keeps the point-sun implications while giving the atmosphere enough light to
 * scatter visibly.
 *
 * @type {number}
 */
export const FALSE_SUN_LIGHT_INTENSITY = 64;
/**
 * Store the false-model annual Sun migration latitude limit.
 *
 * @type {number}
 */
export const FALSE_SUN_TROPIC_LATITUDE_DEGREES = 23.5;
/**
 * Store the default annual false-Sun latitude rule.
 *
 * @type {Readonly<object>}
 */
export const DEFAULT_FALSE_SUN_LATITUDE_MODEL = Object.freeze({
	type: 'annual-tropic-migration',
	northLimitDeg: FALSE_SUN_TROPIC_LATITUDE_DEGREES,
	southLimitDeg: -FALSE_SUN_TROPIC_LATITUDE_DEGREES,
	northernSolsticeDayOfYear: 172,
	periodDays: 365.2422,
});

/**
 * Store the default georeferenced floor texture settings.
 *
 * @type {Readonly<FlatSimulationFloorTexture>}
 */
export const DEFAULT_EARTH_FLOOR_TEXTURE = Object.freeze({
	url: 'assets/images/natural-earth-2-50m.jpg',
	source: 'Natural Earth II with Shaded Relief and Water, 1:50m, version 3.2.0',
	sourceUrl: 'https://www.naturalearthdata.com/downloads/50m-raster-data/50m-natural-earth-2/',
	sourceProjection: 'equirectangular',
	floorProjection: 'north-pole-azimuthal-equidistant',
	textureRotationRad: 0,
	orientation: 'shader-inverse-azimuthal-equidistant-to-equirectangular-three-north-up',
});

/**
 * Store the default elevated observer view used for floor context.
 *
 * @type {Readonly<FlatSimulationObserverView>}
 */
export const DEFAULT_OBSERVER_VIEW = Object.freeze({
	altitudeKm: 0,
	cameraHeightKm: 0.01,
	purpose: 'ten-meter-rendered-camera-height',
});

/**
 * Store the default inspection camera above the projected north pole.
 *
 * The sky dome top is one dome radius above the north-pole projection origin;
 * this camera sits one eighth of that height below the dome top.
 *
 * @type {Readonly<object>}
 */
export const DEFAULT_NORTH_POLE_UNDER_DOME_CAMERA = Object.freeze({
	id: 'north-pole-under-dome-top',
	purpose: 'inspect-flat-model-from-under-dome-top',
	position: Object.freeze({
		x: 0,
		y: EARTH_PROJECTION_RADIUS_KM * (7 / 8),
		z: 0,
	}),
	target: Object.freeze({
		x: 0,
		y: 0,
		z: 0,
	}),
	fov: 72,
});

/**
 * Store the shared-atmosphere settings for the flat simulation.
 *
 * The renderer consumes this through the first depth-aware composer pass.
 *
 * @type {Readonly<FlatSimulationAtmosphereSettings>}
 */
export const DEFAULT_ATMOSPHERE = Object.freeze({
	enabled: true,
	model: 'shared-atmosphere',
	frame: FLAT_ATMOSPHERE_FRAME,
	profile: CLEAR_DAY_EARTH_ATMOSPHERE,
	rendering: Object.freeze({
		status: 'depth-aware-composer-clear-day-atmosphere',
		target: 'depth-aware-composition',
		debugMode: 'none',
		falseSunRadiance: Object.freeze({
			model: 'point-inverse-square-reference',
			referenceDistanceKm: 4800,
			distanceFalloff: true,
		}),
		threeLightUnitScale: 0.04,
		skyDiffuseIrradianceScale: 0.35,
		sampleToSunTransmittanceModel: 'air-mass',
		sampleToSunTransmittanceSteps: 4,
		backgroundAtmosphereViewDistanceKm: 100,
		flatSlabHorizonViewDistanceFactor: 0.25,
		starExposure: 0.02,
		constellationOverlayExposure: 0.04,
	}),
});

/**
 * Store canonical false-model sun assumptions before projection.
 *
 * @type {Readonly<FlatSimulationSunConfig>}
 */
export const DEFAULT_FLAT_SIMULATION_SUN = Object.freeze({
	id: 'false-sun',
	kind: 'surface-altitude-sun',
	name: 'Flat model sun',
	latitude: DEFAULT_FALSE_SUN_LATITUDE_MODEL,
	lon: 58.1137,
	altitudeKm: 3000 * KM_PER_MILE,
	radiusKm: (32 * KM_PER_MILE) / 2,
	style: Object.freeze({
		color: '#ff8a1f',
	}),
	rendering: Object.freeze({
		renderBody: true,
		sizeModel: 'physical-radius-km',
		apparentSizeSource: 'observer-position-and-body-radius',
	}),
	light: Object.freeze({
		kind: 'point',
		color: Object.freeze({ r: 1, g: 0.82, b: 0.55 }),
		intensity: FALSE_SUN_LIGHT_INTENSITY,
		anchor: Object.freeze({
			kind: 'flat-simulation-visible-sun',
			status: 'open',
		}),
	}),
	atmosphere: Object.freeze({
		color: Object.freeze({ r: 1, g: 0.98, b: 0.95 }),
		intensity: 1,
		solarIrradianceScale: 58,
		anchor: Object.freeze({
			kind: 'flat-simulation-visible-sun-atmosphere',
			status: 'open',
		}),
	}),
	animation: Object.freeze({
		type: 'solar-day-latitude-ring-rotation',
		simulatedDurationHours: SOLAR_DAY_HOURS,
		displayDurationSeconds: SOLAR_DAY_DISPLAY_SECONDS,
	}),
});

/**
 * Store default generic source objects for the flat simulation.
 *
 * @type {Readonly<FlatSimulationSourceObject[]>}
 */
export const DEFAULT_FLAT_SIMULATION_OBJECTS = Object.freeze(createMountainSimulationRectangles());

/**
 * Store the default flat-simulation scene-model configuration.
 *
 * @type {Readonly<FlatSimulationConfig>}
 */
export const DEFAULT_FLAT_SIMULATION_CONFIG = Object.freeze({
	root: Object.freeze({
		id: 'san-jose-ca-us',
		name: 'San Jose',
		admin1: 'CA',
		country: 'US',
		lat: 37.3382,
		lon: -121.8863,
		elevationMeters: 30.48,
	}),
	time: '2026-05-22T00:00:00-07:00',
	earthProjection: 'north-pole-azimuthal-equidistant',
	celestialProjection: 'north-celestial-pole-azimuthal-equidistant',
	skySurfaceProjection: 'upper-hemisphere-radial-lift',
	options: Object.freeze({
		meanEarthRadiusKm: MEAN_EARTH_RADIUS_KM,
		earthProjectionRadiusKm: EARTH_PROJECTION_RADIUS_KM,
		domeRadiusKm: EARTH_PROJECTION_RADIUS_KM,
		referenceRightAscensionDeg: 0,
	}),
});
