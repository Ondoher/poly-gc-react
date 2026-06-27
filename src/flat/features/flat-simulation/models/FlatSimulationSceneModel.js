import { ProjectionModel } from '../../../shared/projection/index.js';
import Sun from '../../../shared/Sun.js';
import { POC_CONSTELLATIONS } from '../../../shared/projection/PocConstellations.js';
import { POC_STARS } from '../../../shared/projection/PocStars.js';
import {
	DEFAULT_ATMOSPHERE,
	DEFAULT_EARTH_FLOOR_TEXTURE,
	DEFAULT_FLAT_SIMULATION_CONFIG,
	DEFAULT_FLAT_SIMULATION_OBJECTS,
	DEFAULT_FLAT_SIMULATION_SUN,
	DEFAULT_OBSERVER_VIEW,
	SIDEREAL_DAY_DISPLAY_SECONDS,
	SIDEREAL_DAY_HOURS,
	SOLAR_DAY_DISPLAY_SECONDS,
	SOLAR_DAY_HOURS,
} from './consts.js';
import { projectMountainSimulationRectangle } from './mountain-simulation.js';
import {
	resolveAnimatedAtmosphereSun,
	resolveAnimatedSun,
	resolveClosestSunRotationAngleRad,
} from './sun-animation.js';
import { resolveFalseSunLatitudeDeg } from './sun-latitude.js';

/**
 * Create plain flat-simulation scene view models from projection, catalog,
 * atmosphere, and false-sun assumptions.
 */
export default class FlatSimulationSceneModel {
	/**
	 * Create a scene model.
	 *
	 * @param {Partial<FlatSimulationConfig>} config - Override default scene assumptions.
	 */
	constructor(config = {}) {
		/**
		 * Store normalized scene-model configuration.
		 *
		 * @type {FlatSimulationConfig}
		 */
		this.config = {
			...DEFAULT_FLAT_SIMULATION_CONFIG,
			...config,
			root: {
				...DEFAULT_FLAT_SIMULATION_CONFIG.root,
				...(config.root || {}),
			},
			options: {
				...DEFAULT_FLAT_SIMULATION_CONFIG.options,
				...(config.options || {}),
			},
		};
		/**
		 * Store source star records projected into the false sky.
		 *
		 * @type {object[]}
		 */
		this.stars = config.stars || POC_STARS;
		/**
		 * Store generic source objects projected into the scene.
		 *
		 * @type {FlatSimulationSourceObject[]}
		 */
		this.objects = config.objects || DEFAULT_FLAT_SIMULATION_OBJECTS;
		/**
		 * Store source constellation overlays.
		 *
		 * @type {object[]}
		 */
		this.constellations = config.constellations || POC_CONSTELLATIONS;
		/**
		 * Store merged false-sun assumptions or `null` when disabled.
		 *
		 * @type {FlatSimulationSunConfig | null}
		 */
		this.sun = config.sun === null
			? null
			: this.mergeSunConfig(config.sun || {});
	}

	/**
	 * Merge false-sun overrides with canonical defaults.
	 *
	 * @param {Partial<FlatSimulationSunConfig>} sun - Override false-sun assumptions.
	 * @returns {FlatSimulationSunConfig}
	 */
	mergeSunConfig(sun = {}) {
		return {
			...DEFAULT_FLAT_SIMULATION_SUN,
			...sun,
			style: {
				...DEFAULT_FLAT_SIMULATION_SUN.style,
				...(sun.style || {}),
			},
			rendering: {
				...DEFAULT_FLAT_SIMULATION_SUN.rendering,
				...(sun.rendering || {}),
			},
			latitude: {
				...DEFAULT_FLAT_SIMULATION_SUN.latitude,
				...(sun.latitude || {}),
			},
			light: {
				...DEFAULT_FLAT_SIMULATION_SUN.light,
				...(sun.light || {}),
				color: {
					...DEFAULT_FLAT_SIMULATION_SUN.light.color,
					...(sun.light?.color || {}),
				},
				anchor: {
					...DEFAULT_FLAT_SIMULATION_SUN.light.anchor,
					...(sun.light?.anchor || {}),
				},
			},
			atmosphere: {
				...DEFAULT_FLAT_SIMULATION_SUN.atmosphere,
				...(sun.atmosphere || {}),
				color: {
					...DEFAULT_FLAT_SIMULATION_SUN.atmosphere.color,
					...(sun.atmosphere?.color || {}),
				},
				anchor: {
					...DEFAULT_FLAT_SIMULATION_SUN.atmosphere.anchor,
					...(sun.atmosphere?.anchor || {}),
				},
			},
			animation: {
				...DEFAULT_FLAT_SIMULATION_SUN.animation,
				...(sun.animation || {}),
			},
		};
	}

	/**
	 * Create the configured projection model for this scene.
	 *
	 * @returns {ProjectionModel}
	 */
	createProjectionModel() {
		return new ProjectionModel({
			id: 'flat-poc-flat-simulation',
			root: this.config.root,
			time: this.config.time,
			earthProjection: this.config.earthProjection,
			celestialProjection: this.config.celestialProjection,
			skySurfaceProjection: this.config.skySurfaceProjection,
			options: this.config.options,
		});
	}

	/**
	 * Create the complete plain scene view model consumed by the renderer.
	 *
	 * @returns {FlatSimulationScene}
	 */
	createScene() {
		const projectionModel = this.createProjectionModel();

		const projectedObserver = projectionModel.projectObserver();
		const projectedStars = projectionModel.projectStars(this.stars);
		const projectedSun = this.projectSun(projectionModel, projectedObserver.position);
		const projectedObjects = this.projectObjects(projectionModel, projectedObserver.position);
		const fixedSolarRotationAngleRad = projectedSun
			? resolveClosestSunRotationAngleRad(projectedSun, projectedObserver.position)
			: 0;
		const fixedSun = projectedSun
			? resolveAnimatedSun(projectedSun, fixedSolarRotationAngleRad, {
				observerPosition: projectedObserver.position,
			})
			: null;
		const fixedAtmosphereSun = projectedSun
			? resolveAnimatedAtmosphereSun(projectedSun, fixedSolarRotationAngleRad, {
				observerPosition: projectedObserver.position,
			})
			: null;
		return {
			root: projectionModel.getRoot(),
			time: projectionModel.getTime(),
			model: projectionModel.describe(),
			observer: {
				...projectedObserver,
				view: {
					...DEFAULT_OBSERVER_VIEW,
					...(this.config.observerView || {}),
				},
			},
			earth: {
				radiusKm: this.config.options.earthProjectionRadiusKm,
				floorTexture: {
					...DEFAULT_EARTH_FLOOR_TEXTURE,
					...(this.config.earth?.floorTexture || {}),
				},
			},
			dome: {
				radiusKm: this.config.options.domeRadiusKm,
			},
			atmosphere: {
				...DEFAULT_ATMOSPHERE,
				...(this.config.atmosphere || {}),
			},
			sun: projectedSun,
			lighting: {
				sun: fixedSun?.light || projectedSun?.light || null,
				atmosphereSun: fixedAtmosphereSun,
			},
			camera: this.config.camera || null,
			stars: projectedStars,
			constellations: this.projectConstellations(projectedStars),
			objects: [
				projectedSun?.object,
				...projectedObjects,
			].filter(Boolean),
			animation: {
				playback: {
					mode: 'fixed',
					fixedSolarRotationAngleRad,
					reason: 'closest-false-sun-to-observer',
				},
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

	/**
	 * Project source constellation definitions through the projected star list.
	 *
	 * @param {FlatSimulationProjectedStar[]} projectedStars - Provide projected stars keyed by name.
	 * @returns {FlatSimulationProjectedConstellation[]}
	 */
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

	/**
	 * Project the configured false-model sun into body, apparent-size, and
	 * lighting state.
	 *
	 * @param {ProjectionModel} projectionModel - Provide the active projection model.
	 * @param {FlatVector3} observerPosition - Provide the projected observer position.
	 * @returns {FlatSimulationSunScene | null}
	 */
	projectSun(projectionModel, observerPosition) {
		if (!this.sun) {
			return null;
		}

		const sourceLatitudeDeg = resolveFalseSunLatitudeDeg(
			this.sun,
			this.config.time,
		);
		const projected = projectionModel.projectEarthPoint({
			lat: sourceLatitudeDeg,
			lon: this.sun.lon,
			elevationMeters: this.sun.altitudeKm * 1000,
		});
		const light = new Sun({
			...this.sun.light,
			position: projected.position,
			radiusKm: this.sun.radiusKm,
		}).lightFrom(observerPosition);
		const apparent = {
			distanceKm: light.distanceKm,
			angularRadiusRad: light.apparentAngularRadiusRad,
			angularDiameterRad: light.apparentAngularDiameterRad,
			source: this.sun.rendering.apparentSizeSource,
		};
		const object = {
			kind: 'sphere',
			role: 'sun',
			id: this.sun.id,
			name: this.sun.name,
			position: projected.position,
			radiusKm: this.sun.radiusKm,
			visible: projected.visible,
			style: this.sun.style,
			rendering: this.sun.rendering,
			apparent,
			animation: this.sun.animation,
			source: {
				lat: sourceLatitudeDeg,
				lon: this.sun.lon,
				altitudeKm: this.sun.altitudeKm,
				diameterKm: this.sun.radiusKm * 2,
				latitude: this.sun.latitude,
				latitudeResolvedAt: this.config.time,
			},
		};

		return {
			kind: 'sun',
			id: this.sun.id,
			name: this.sun.name,
			position: projected.position,
			radiusKm: this.sun.radiusKm,
			visible: projected.visible,
			rendering: this.sun.rendering,
			apparent,
			object,
			light,
			atmosphere: this.sun.atmosphere,
			animation: this.sun.animation,
			source: object.source,
		};
	}

	/**
	 * Project generic source objects into renderable scene spheres.
	 *
	 * @param {ProjectionModel} projectionModel - Provide the active projection model.
	 * @param {FlatVector3} observerPosition - Provide the projected observer position.
	 * @returns {FlatSimulationProjectedObject[]}
	 */
	projectObjects(projectionModel, observerPosition) {
		return this.objects.map((object) => {
			if (object.kind === 'mountain-simulation-rectangle') {
				return projectMountainSimulationRectangle(object, observerPosition);
			}

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
