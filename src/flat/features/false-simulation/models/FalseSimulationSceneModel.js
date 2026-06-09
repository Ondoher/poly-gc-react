import { ProjectionModel } from '../../../shared/projection/index.js';
import { POC_CONSTELLATIONS } from '../../../shared/projection/PocConstellations.js';
import { POC_STARS } from '../../../shared/projection/PocStars.js';

export const MEAN_EARTH_RADIUS_KM = 6371.0088;
export const EARTH_PROJECTION_RADIUS_KM = Math.PI * MEAN_EARTH_RADIUS_KM;
export const KM_PER_MILE = 1.609344;
export const SOLAR_DAY_HOURS = 24;
export const SIDEREAL_DAY_HOURS = 23.9344696;
export const SOLAR_DAY_DISPLAY_SECONDS = 10;
export const SIDEREAL_DAY_DISPLAY_SECONDS = SOLAR_DAY_DISPLAY_SECONDS * (SIDEREAL_DAY_HOURS / SOLAR_DAY_HOURS);
export const KARMAN_LINE_KM = 100;

export const DEFAULT_ATMOSPHERE = Object.freeze({
	enabled: false,
	color: '#7fb2ff',
	opacity: 1,
	fullOpacityDistanceKm: 300 * KM_PER_MILE,
	seaLevelDensity: 1,
	atmosphereHeightKm: KARMAN_LINE_KM,
});

export const DEFAULT_FALSE_SIMULATION_OBJECTS = Object.freeze([
	Object.freeze({
		id: 'orange-reference-sphere',
		kind: 'surface-altitude-sphere',
		name: 'Orange reference sphere',
		lat: 24,
		lon: 58.1137,
		altitudeKm: 3000 * KM_PER_MILE,
		radiusKm: (32 * KM_PER_MILE) / 2,
		style: Object.freeze({
			color: '#ff8a1f',
		}),
		animation: Object.freeze({
			type: 'solar-day-fixed-latitude-rotation',
			simulatedDurationHours: SOLAR_DAY_HOURS,
			displayDurationSeconds: SOLAR_DAY_DISPLAY_SECONDS,
		}),
	}),
]);

export const DEFAULT_FALSE_SIMULATION_CONFIG = Object.freeze({
	root: Object.freeze({
		id: 'san-jose-ca-us',
		name: 'San Jose',
		admin1: 'CA',
		country: 'US',
		lat: 37.3382,
		lon: -121.8863,
		elevationMeters: 0,
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

export default class FalseSimulationSceneModel {
	constructor(config = {}) {
		this.config = {
			...DEFAULT_FALSE_SIMULATION_CONFIG,
			...config,
			root: {
				...DEFAULT_FALSE_SIMULATION_CONFIG.root,
				...(config.root || {}),
			},
			options: {
				...DEFAULT_FALSE_SIMULATION_CONFIG.options,
				...(config.options || {}),
			},
		};
		this.stars = config.stars || POC_STARS;
		this.objects = config.objects || DEFAULT_FALSE_SIMULATION_OBJECTS;
		this.constellations = config.constellations || POC_CONSTELLATIONS;
	}

	createProjectionModel() {
		return new ProjectionModel({
			id: 'flat-poc-false-simulation',
			root: this.config.root,
			time: this.config.time,
			earthProjection: this.config.earthProjection,
			celestialProjection: this.config.celestialProjection,
			skySurfaceProjection: this.config.skySurfaceProjection,
			options: this.config.options,
		});
	}

	createScene() {
		const projectionModel = this.createProjectionModel();

		const projectedStars = projectionModel.projectStars(this.stars);
		return {
			root: projectionModel.getRoot(),
			time: projectionModel.getTime(),
			model: projectionModel.describe(),
			observer: projectionModel.projectObserver(),
			earth: {
				radiusKm: this.config.options.earthProjectionRadiusKm,
			},
			dome: {
				radiusKm: this.config.options.domeRadiusKm,
			},
			atmosphere: {
				...DEFAULT_ATMOSPHERE,
				...(this.config.atmosphere || {}),
			},
			camera: this.config.camera || null,
			stars: projectedStars,
			constellations: this.projectConstellations(projectedStars),
			objects: this.projectObjects(projectionModel),
			animation: {
				solarDay: {
					simulatedDurationHours: SOLAR_DAY_HOURS,
					displayDurationSeconds: SOLAR_DAY_DISPLAY_SECONDS,
				},
				siderealDay: {
					simulatedDurationHours: SIDEREAL_DAY_HOURS,
					displayDurationSeconds: SIDEREAL_DAY_DISPLAY_SECONDS,
				},
			},
		};
	}

	projectConstellations(projectedStars) {
		const starsByName = new Map(projectedStars.map((star) => [star.name, star]));

		return this.constellations.map((constellation) => ({
			id: constellation.id,
			name: constellation.name,
			color: constellation.color,
			segments: constellation.segments.map(([fromName, toName]) => {
				const from = starsByName.get(fromName);
				const to = starsByName.get(toName);

				if (!from || !to) {
					throw new Error(`Constellation "${constellation.id}" references missing star "${from ? toName : fromName}".`);
				}

				return {
					from: from.name,
					to: to.name,
					points: [
						from.position,
						to.position,
					],
					visible: from.visible && to.visible,
				};
			}),
		}));
	}

	projectObjects(projectionModel) {
		return this.objects.map((object) => {
			if (object.kind !== 'surface-altitude-sphere') {
				return {
					...object,
					position: null,
					visible: false,
				};
			}

			const projected = projectionModel.projectEarthPoint({
				lat: object.lat,
				lon: object.lon,
				elevationMeters: object.altitudeKm * 1000,
			});

			return {
				kind: 'sphere',
				id: object.id,
				name: object.name,
				position: projected.position,
				radiusKm: object.radiusKm,
				visible: projected.visible,
				style: object.style,
				animation: object.animation,
				source: {
					lat: object.lat,
					lon: object.lon,
					altitudeKm: object.altitudeKm,
					diameterKm: object.radiusKm * 2,
				},
			};
		});
	}
}
