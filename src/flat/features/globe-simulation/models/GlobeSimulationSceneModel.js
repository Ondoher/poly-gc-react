import {
	ASTRONOMICAL_UNIT_KM,
	DEFAULT_GLOBE_ATMOSPHERE_FRAME,
	DEFAULT_GLOBE_ATMOSPHERE_PROFILE,
	DEFAULT_GLOBE_CONFIG,
	DEFAULT_GLOBE_DISPLAY,
	DEFAULT_GLOBE_SOLAR_SOURCE,
	DEFAULT_GLOBE_SUN,
	DEFAULT_GLOBE_SURFACE_MATERIAL,
	EARTH_AXIAL_TILT_DEG,
	J2000_JULIAN_DATE,
	MEAN_SOLAR_RADIUS_KM,
	MILLISECONDS_PER_DAY,
} from './consts.js';
import Atmosphere from '../../../shared/Atmosphere.js';
import { createRadiometricDisplayConfig } from '../../../shared/RadiometricDisplay.js';
import Sun from '../../../shared/Sun.js';
import { createMountainSimulationRectangles } from '../../../shared/mountain-simulation.js';
import { placeObjectForGeometry } from '../../../shared/object-placement.js';
import { createBearingDirection } from '../../../shared/observer-relative-placement.js';
import { POC_STARS } from '../../../shared/projection/PocStars.js';

const UNIX_EPOCH_JULIAN_DATE = 2440587.5;
const DEFAULT_CAMERA_HEIGHT_METERS = 10;
const NORTHERN_BRIGHT_STAR_COUNT = 50;
const STAR_SKY_DISTANCE_KM = 1000000;

/**
 * Create plain spherical globe scene view models.
 */
export default class GlobeSimulationSceneModel {
	/**
	 * Create a globe scene model.
	 *
	 * @param {Partial<GlobeSceneConfig>} config - Override default scene assumptions.
	 */
	constructor(config = {}) {
		this.config = {
			...DEFAULT_GLOBE_CONFIG,
			...config,
			time: config.time || DEFAULT_GLOBE_CONFIG.time,
			root: {
				...DEFAULT_GLOBE_CONFIG.root,
				...(config.root || {}),
			},
			display: {
				...DEFAULT_GLOBE_DISPLAY,
				...(config.display || {}),
			},
		};
		this.stars = config.stars || POC_STARS;
	}

	/**
	 * Convert degrees to radians.
	 *
	 * @param {number} degrees - Store the angle in degrees.
	 * @returns {number} The angle in radians.
	 */
	degreesToRadians(degrees) {
		return degrees * Math.PI / 180;
	}

	/**
	 * Convert radians to degrees.
	 *
	 * @param {number} radians - Store the angle in radians.
	 * @returns {number} The angle in degrees.
	 */
	radiansToDegrees(radians) {
		return radians * 180 / Math.PI;
	}

	/**
	 * Normalize degrees to the range `[0, 360)`.
	 *
	 * @param {number} degrees - Store the angle in degrees.
	 * @returns {number} The normalized angle.
	 */
	normalizeDegrees(degrees) {
		return ((degrees % 360) + 360) % 360;
	}

	/**
	 * Normalize a vector.
	 *
	 * @param {{ x: number, y: number, z: number }} vector - Store the source vector.
	 * @returns {{ x: number, y: number, z: number }} The normalized vector.
	 */
	normalize(vector) {
		const length = Math.hypot(vector.x, vector.y, vector.z) || 1;

		return {
			x: vector.x / length,
			y: vector.y / length,
			z: vector.z / length,
		};
	}

	/**
	 * Scale a vector.
	 *
	 * @param {{ x: number, y: number, z: number }} vector - Store the source vector.
	 * @param {number} scale - Store the scale factor.
	 * @returns {{ x: number, y: number, z: number }} The scaled vector.
	 */
	scaleVector(vector, scale) {
		return {
			x: vector.x * scale,
			y: vector.y * scale,
			z: vector.z * scale,
		};
	}

	/**
	 * Add scaled vectors.
	 *
	 * @param {Array<{ vector: { x: number, y: number, z: number }, scale: number }>} terms - Store vector terms.
	 * @returns {{ x: number, y: number, z: number }} The summed vector.
	 */
	addScaledVectors(terms) {
		return terms.reduce((sum, term) => ({
			x: sum.x + term.vector.x * term.scale,
			y: sum.y + term.vector.y * term.scale,
			z: sum.z + term.vector.z * term.scale,
		}), { x: 0, y: 0, z: 0 });
	}

	/**
	 * Resolve the scene timestamp.
	 *
	 * @returns {Date} The timestamp.
	 */
	createDate() {
		const date = new Date(this.config.time);

		if (Number.isNaN(date.getTime())) {
			throw new Error(`Invalid globe simulation time: ${this.config.time}`);
		}

		return date;
	}

	/**
	 * Convert a timestamp to Julian date.
	 *
	 * @param {Date} date - Store the timestamp.
	 * @returns {number} The Julian date.
	 */
	createJulianDate(date) {
		return date.getTime() / MILLISECONDS_PER_DAY + UNIX_EPOCH_JULIAN_DATE;
	}

	/**
	 * Convert equatorial coordinates into the scene ecliptic frame.
	 *
	 * The scene frame uses `x` for the vernal-equinox direction, `y` for
	 * ecliptic north, and `z` for ecliptic longitude 90 degrees.
	 *
	 * @param {{ x: number, y: number, z: number }} vector - Store an equatorial vector.
	 * @returns {{ x: number, y: number, z: number }} The scene-frame vector.
	 */
	equatorialToScene(vector) {
		const tiltRad = this.degreesToRadians(EARTH_AXIAL_TILT_DEG);
		const cosTilt = Math.cos(tiltRad);
		const sinTilt = Math.sin(tiltRad);

		return {
			x: vector.x,
			y: -vector.y * sinTilt + vector.z * cosTilt,
			z: vector.y * cosTilt + vector.z * sinTilt,
		};
	}

	/**
	 * Calculate approximate solar-system state for the timestamp.
	 *
	 * This is a low-precision solar model suitable for the first visual
	 * calibration scene. It should be replaced by an ephemeris source when we
	 * need sub-arcminute accuracy.
	 *
	 * @param {Date} date - Store the scene timestamp.
	 * @returns {object} The approximate solar-system state.
	 */
	createSolarSystemState(date) {
		const julianDate = this.createJulianDate(date);
		const daysSinceJ2000 = julianDate - J2000_JULIAN_DATE;
		const centuriesSinceJ2000 = daysSinceJ2000 / 36525;
		const meanLongitudeDeg = this.normalizeDegrees(
			280.46646
			+ 36000.76983 * centuriesSinceJ2000
			+ 0.0003032 * centuriesSinceJ2000 * centuriesSinceJ2000,
		);
		const meanAnomalyDeg = this.normalizeDegrees(
			357.52911
			+ 35999.05029 * centuriesSinceJ2000
			- 0.0001537 * centuriesSinceJ2000 * centuriesSinceJ2000,
		);
		const meanAnomalyRad = this.degreesToRadians(meanAnomalyDeg);
		const equationOfCenterDeg =
			(1.914602 - 0.004817 * centuriesSinceJ2000 - 0.000014 * centuriesSinceJ2000 * centuriesSinceJ2000) * Math.sin(meanAnomalyRad)
			+ (0.019993 - 0.000101 * centuriesSinceJ2000) * Math.sin(2 * meanAnomalyRad)
			+ 0.000289 * Math.sin(3 * meanAnomalyRad);
		const trueLongitudeDeg = meanLongitudeDeg + equationOfCenterDeg;
		const trueAnomalyDeg = meanAnomalyDeg + equationOfCenterDeg;
		const omegaDeg = 125.04 - 1934.136 * centuriesSinceJ2000;
		const apparentLongitudeDeg = this.normalizeDegrees(
			trueLongitudeDeg
			- 0.00569
			- 0.00478 * Math.sin(this.degreesToRadians(omegaDeg)),
		);
		const eccentricity = 0.016708634
			- 0.000042037 * centuriesSinceJ2000
			- 0.0000001267 * centuriesSinceJ2000 * centuriesSinceJ2000;
		const distanceAu = 1.000001018 * (1 - eccentricity * eccentricity)
			/ (1 + eccentricity * Math.cos(this.degreesToRadians(trueAnomalyDeg)));
		const distanceKm = ASTRONOMICAL_UNIT_KM * distanceAu;
		const sunLongitudeRad = this.degreesToRadians(apparentLongitudeDeg);
		const sunPositionKm = {
			x: Math.cos(sunLongitudeRad) * distanceKm,
			y: 0,
			z: Math.sin(sunLongitudeRad) * distanceKm,
		};
		const greenwichSiderealDeg = this.normalizeDegrees(
			280.46061837
			+ 360.98564736629 * daysSinceJ2000
			+ 0.000387933 * centuriesSinceJ2000 * centuriesSinceJ2000
			- centuriesSinceJ2000 * centuriesSinceJ2000 * centuriesSinceJ2000 / 38710000,
		);
		const axisNorth = this.normalize(this.equatorialToScene({ x: 0, y: 0, z: 1 }));

		return {
			julianDate,
			daysSinceJ2000,
			greenwichSiderealDeg,
			earthAxis: {
				tiltDeg: EARTH_AXIAL_TILT_DEG,
				north: axisNorth,
			},
			sun: {
				apparentEclipticLongitudeDeg: apparentLongitudeDeg,
				distanceAu,
				distanceKm,
				positionKm: sunPositionKm,
				directionFromEarth: this.normalize(sunPositionKm),
				radiusKm: MEAN_SOLAR_RADIUS_KM,
				apparentAngularRadiusRad: Math.asin(MEAN_SOLAR_RADIUS_KM / distanceKm),
				apparentAngularDiameterRad: 2 * Math.asin(MEAN_SOLAR_RADIUS_KM / distanceKm),
			},
		};
	}

	/**
	 * Create the local observer basis vectors from latitude and longitude.
	 *
	 * @param {{ greenwichSiderealDeg: number }} solarSystem - Store date-derived state.
	 * @returns {{ east: object, north: object, up: object }} The local ENU basis.
	 */
	createObserverFrame(solarSystem) {
		const latRad = this.degreesToRadians(this.config.root.lat);
		const lonRad = this.degreesToRadians(this.config.root.lon);
		const siderealRad = this.degreesToRadians(solarSystem.greenwichSiderealDeg);
		const theta = siderealRad + lonRad;
		const sinLat = Math.sin(latRad);
		const cosLat = Math.cos(latRad);
		const sinTheta = Math.sin(theta);
		const cosTheta = Math.cos(theta);
		const eastEquatorial = {
			x: -sinTheta,
			y: cosTheta,
			z: 0,
		};
		const northEquatorial = {
			x: -sinLat * cosTheta,
			y: -sinLat * sinTheta,
			z: cosLat,
		};
		const upEquatorial = {
			x: cosLat * cosTheta,
			y: cosLat * sinTheta,
			z: sinLat,
		};

		return {
			east: this.normalize(this.equatorialToScene(eastEquatorial)),
			north: this.normalize(this.equatorialToScene(northEquatorial)),
			up: this.normalize(this.equatorialToScene(upEquatorial)),
		};
	}

	/**
	 * Create the observer world position on the spherical Earth.
	 *
	 * @param {{ x: number, y: number, z: number }} up - Store the local up vector.
	 * @returns {{ x: number, y: number, z: number }} The observer position in kilometers.
	 */
	createObserverPosition(up) {
		const elevationKm = this.config.root.elevationMeters / 1000;

		return this.scaleVector(up, this.config.earthRadiusKm + elevationKm);
	}

	/**
	 * Resolve the camera height above the rendered spherical ground.
	 *
	 * @returns {number} The camera height above the sphere in kilometers.
	 */
	cameraHeightKm() {
		const cameraHeightMeters = Number(this.config.cameraHeightMeters);

		return (Number.isFinite(cameraHeightMeters) ? cameraHeightMeters : DEFAULT_CAMERA_HEIGHT_METERS) / 1000;
	}

	/**
	 * Create a camera anchored above the rendered spherical ground.
	 *
	 * @param {{ positionKm: object, frame: { north: object, up: object } }} observer - Store the observer state.
	 * @returns {{ positionKm: object, targetKm: object, nearKm: number, farKm: number, fov: number }} The camera state.
	 */
	createCamera(observer) {
		const heightAboveSurfaceKm = this.cameraHeightKm();

		return {
			positionKm: this.scaleVector(observer.frame.up, this.config.earthRadiusKm + heightAboveSurfaceKm),
			targetKm: { ...observer.lookTargetKm },
			up: { ...observer.frame.up },
			heightAboveSurfaceKm,
			nearKm: 0.00001,
			farKm: ASTRONOMICAL_UNIT_KM * 1.05,
			fov: 60,
		};
	}

	/**
	 * Resolve the Sun's local altitude and azimuth.
	 *
	 * @param {{ east: object, north: object, up: object }} frame - Store the observer frame.
	 * @param {{ x: number, y: number, z: number }} direction - Store the observer-to-Sun direction.
	 * @returns {{ altitudeDeg: number, azimuthDeg: number }} The local Sun pose.
	 */
	createSunPose(frame, direction) {
		const east = direction.x * frame.east.x + direction.y * frame.east.y + direction.z * frame.east.z;
		const north = direction.x * frame.north.x + direction.y * frame.north.y + direction.z * frame.north.z;
		const up = direction.x * frame.up.x + direction.y * frame.up.y + direction.z * frame.up.z;
		const altitudeRad = Math.asin(Math.max(-1, Math.min(1, up)));
		const azimuthRad = Math.atan2(east, north);

		return {
			altitudeDeg: this.radiansToDegrees(altitudeRad),
			azimuthDeg: this.normalizeDegrees(this.radiansToDegrees(azimuthRad)),
		};
	}

	/**
	 * Convert per-channel transmittance into a luminance-weighted scalar.
	 *
	 * @param {FlatRgbColor} transmittance - Store linear RGB transmittance.
	 * @returns {number} Approximate visible-light transmittance.
	 */
	luminanceTransmittance(transmittance) {
		return transmittance.r * 0.2126
			+ transmittance.g * 0.7152
			+ transmittance.b * 0.0722;
	}

	/**
	 * Estimate relative optical air mass from Sun altitude.
	 *
	 * @param {number} altitudeDeg - Store Sun altitude above the local horizon.
	 * @returns {number | null} Relative air mass, or null below the horizon.
	 */
	createRelativeAirMass(altitudeDeg) {
		if (altitudeDeg <= 0) {
			return null;
		}

		return 1 / (
			Math.sin(this.degreesToRadians(altitudeDeg))
			+ 0.50572 * ((altitudeDeg + 6.07995) ** -1.6364)
		);
	}

	/**
	 * Calculate physical solar irradiance probes for the globe calibration view.
	 *
	 * @param {object} solarSystem - Store date-derived solar-system state.
	 * @param {{ positionKm: FlatVector3, frame: { up: FlatVector3 } }} observer - Store observer state.
	 * @param {{ altitudeDeg: number }} sunPose - Store local Sun pose.
	 * @returns {object} The physical source and irradiance probes.
	 */
	createSolarIrradianceProbes(solarSystem, observer, sunPose) {
		const source = DEFAULT_GLOBE_SOLAR_SOURCE;
		const topOfAtmosphereIrradianceWm2 = source.totalSolarIrradianceWm2
			* ((source.astronomicalUnitKm / solarSystem.sun.distanceKm) ** 2);
		const sunUpCos = Math.max(
			0,
			Math.sin(this.degreesToRadians(sunPose.altitudeDeg)),
		);
		const atmosphere = new Atmosphere({
			frame: {
				...DEFAULT_GLOBE_ATMOSPHERE_FRAME,
				planetRadiusKm: this.config.earthRadiusKm,
			},
			profile: DEFAULT_GLOBE_ATMOSPHERE_PROFILE,
		});
		const sun = new Sun({
			...DEFAULT_GLOBE_SUN,
			position: solarSystem.sun.positionKm,
			distanceKm: solarSystem.sun.distanceKm,
			radiusKm: solarSystem.sun.radiusKm,
		}).lightFrom(observer.positionKm);
		const transmittanceSample = atmosphere.sampleLightTransmittance(
			observer.positionKm,
			sun,
			{ steps: 64 },
		);
		const visibleTransmittance = transmittanceSample.shadowed
			? 0
			: this.luminanceTransmittance(transmittanceSample.transmittance);
		const directNormalIrradianceAtObserverWm2 =
			topOfAtmosphereIrradianceWm2 * visibleTransmittance;
		const directHorizontalIrradianceAtObserverWm2 =
			directNormalIrradianceAtObserverWm2 * sunUpCos;
		const removedDirectIrradianceWm2 = Math.max(
			0,
			topOfAtmosphereIrradianceWm2 - directNormalIrradianceAtObserverWm2,
		);
		const estimatedDiffuseSkyIrradianceWm2 = removedDirectIrradianceWm2
			* sunUpCos
			* source.diffuseSkyIrradianceLossFraction;
		const rendererAtmosphereSourceScale = topOfAtmosphereIrradianceWm2
			/ source.rendererIrradianceReferenceWm2;

		return {
			model: 'single-scattering-clear-sky-probes',
			topOfAtmosphereIrradianceWm2,
			directNormalIrradianceAtObserverWm2,
			directHorizontalIrradianceAtObserverWm2,
			estimatedDiffuseSkyIrradianceWm2,
			relativeAirMass: this.createRelativeAirMass(sunPose.altitudeDeg),
			sunUpCos,
			visibleTransmittance,
			transmittance: transmittanceSample.transmittance,
			opticalDepth: transmittanceSample.opticalDepth || null,
			shadowed: transmittanceSample.shadowed,
			renderer: {
				atmosphereSourceScale: rendererAtmosphereSourceScale,
				irradianceReferenceWm2: source.rendererIrradianceReferenceWm2,
				bridge: source.rendererBridge,
			},
		};
	}

	/**
	 * Project an observer-relative synthetic mountain marker onto the globe.
	 *
	 * @param {FlatMountainSimulationRectangleSource} rectangle - Store the shared mountain source.
	 * @param {{ frame: { east: object, north: object, up: object } }} observer - Store the observer state.
	 * @returns {GlobeSimulationMountainBox} The globe-space mountain marker.
	 */
	projectMountainSimulationRectangle(rectangle, observer) {
		const frame = {
			kind: 'spherical-surface',
			planetRadiusKm: this.config.earthRadiusKm,
			east: observer.frame.east,
			north: observer.frame.north,
			up: observer.frame.up,
		};
		const bearingDirection = createBearingDirection(frame, rectangle.bearingRad);
		const centerDistanceKm = rectangle.distanceKm + rectangle.depthKm / 2;
		const centerAngularDistanceRad = centerDistanceKm / this.config.earthRadiusKm;
		const nearEdgeAngularDistanceRad = rectangle.distanceKm / this.config.earthRadiusKm;
		const surfaceNormal = this.normalize(this.addScaledVectors([
			{ vector: observer.frame.up, scale: Math.cos(centerAngularDistanceRad) },
			{ vector: bearingDirection, scale: Math.sin(centerAngularDistanceRad) },
		]));
		const nearEdgeNormal = this.normalize(this.addScaledVectors([
			{ vector: observer.frame.up, scale: Math.cos(nearEdgeAngularDistanceRad) },
			{ vector: bearingDirection, scale: Math.sin(nearEdgeAngularDistanceRad) },
		]));
		const forward = this.normalize(this.addScaledVectors([
			{ vector: observer.frame.up, scale: -Math.sin(centerAngularDistanceRad) },
			{ vector: bearingDirection, scale: Math.cos(centerAngularDistanceRad) },
		]));
		const surfaceCenter = this.scaleVector(surfaceNormal, this.config.earthRadiusKm);
		const nearEdgeCenter = this.scaleVector(nearEdgeNormal, this.config.earthRadiusKm);
		const placement = placeObjectForGeometry({
			geometry: {
				kind: 'sphere',
				center: { x: 0, y: 0, z: 0 },
				radiusKm: this.config.earthRadiusKm,
			},
			position: {
				surfacePoint: surfaceCenter,
				surfaceNormal,
			},
			referenceDirection: forward,
			bearingRad: 0,
			bounds: {
				min: {
					x: -rectangle.widthKm / 2,
					y: -rectangle.heightKm / 2,
					z: -rectangle.depthKm / 2,
				},
				max: {
					x: rectangle.widthKm / 2,
					y: rectangle.heightKm / 2,
					z: rectangle.depthKm / 2,
				},
			},
		});

		return {
			kind: 'box',
			role: 'mountain-simulation',
			id: rectangle.id,
			name: rectangle.name,
			position: placement.position,
			size: {
				x: rectangle.widthKm,
				y: rectangle.heightKm,
				z: rectangle.depthKm,
			},
			orientation: placement.orientation,
			surface: {
				centerKm: surfaceCenter,
				normal: surfaceNormal,
				bearingDirection: placement.orientation.zAxis,
				geodesicDistanceKm: centerDistanceKm,
				nearEdgeCenterKm: nearEdgeCenter,
				nearEdgeDistanceKm: rectangle.distanceKm,
			},
			visible: true,
			style: rectangle.style,
			source: rectangle.source,
		};
	}

	/**
	 * Create synthetic globe mountain markers from the shared calibration source.
	 *
	 * @param {{ frame: { east: object, north: object, up: object } }} observer - Store the observer state.
	 * @returns {GlobeSimulationMountainBox[]} The projected marker boxes.
	 */
	createMountainSimulationObjects(observer) {
		return createMountainSimulationRectangles()
			.map((rectangle) => this.projectMountainSimulationRectangle(rectangle, observer));
	}

	/**
	 * Convert J2000 right ascension/declination to the globe scene frame.
	 *
	 * @param {{ raDeg: number, decDeg: number }} star - Store source star coordinates.
	 * @returns {{ x: number, y: number, z: number }} The normalized scene direction.
	 */
	createStarDirection(star) {
		const raRad = this.degreesToRadians(Number(star.raDeg) || 0);
		const decRad = this.degreesToRadians(Number(star.decDeg) || 0);
		const cosDec = Math.cos(decRad);
		const equatorial = {
			x: cosDec * Math.cos(raRad),
			y: cosDec * Math.sin(raRad),
			z: Math.sin(decRad),
		};

		return this.normalize(this.equatorialToScene(equatorial));
	}

	/**
	 * Create bright northern-celestial-hemisphere stars for daylight tests.
	 *
	 * @param {{ frame: { east: object, north: object, up: object } }} observer - Store the observer state.
	 * @returns {GlobeSimulationStar[]} The selected star evidence layer.
	 */
	createStars(observer) {
		return this.stars
			.filter((star) => Number(star.decDeg) > 0)
			.slice()
			.sort((left, right) => Number(left.magnitude) - Number(right.magnitude))
			.slice(0, NORTHERN_BRIGHT_STAR_COUNT)
			.map((star) => {
				const direction = this.createStarDirection(star);
				const east = direction.x * observer.frame.east.x
					+ direction.y * observer.frame.east.y
					+ direction.z * observer.frame.east.z;
				const north = direction.x * observer.frame.north.x
					+ direction.y * observer.frame.north.y
					+ direction.z * observer.frame.north.z;
				const up = direction.x * observer.frame.up.x
					+ direction.y * observer.frame.up.y
					+ direction.z * observer.frame.up.z;
				const altitudeRad = Math.asin(Math.max(-1, Math.min(1, up)));
				const azimuthRad = Math.atan2(east, north);
				const magnitude = Number(star.magnitude);

				return {
					kind: 'star',
					role: 'daytime-sky-visibility-calibration',
					id: star.id,
					name: star.name,
					direction,
					position: this.scaleVector(direction, STAR_SKY_DISTANCE_KM),
					raDeg: Number(star.raDeg),
					decDeg: Number(star.decDeg),
					magnitude,
					relativeFlux: 10 ** (-0.4 * magnitude),
					altitudeDeg: this.radiansToDegrees(altitudeRad),
					azimuthDeg: this.normalizeDegrees(this.radiansToDegrees(azimuthRad)),
					visible: true,
					style: {
						color: '#ffffff',
					},
					source: star.source,
				};
			});
	}

	/**
	 * Create a plain scene view model for the globe feature.
	 *
	 * @returns {object} The globe scene.
	 */
	createScene() {
		const date = this.createDate();
		const solarSystem = this.createSolarSystemState(date);
		const observerFrame = this.createObserverFrame(solarSystem);
		const observerPositionKm = this.createObserverPosition(observerFrame.up);
		const observerToSun = this.normalize({
			x: solarSystem.sun.positionKm.x - observerPositionKm.x,
			y: solarSystem.sun.positionKm.y - observerPositionKm.y,
			z: solarSystem.sun.positionKm.z - observerPositionKm.z,
		});
		const sunPose = this.createSunPose(observerFrame, observerToSun);
		const observer = {
			positionKm: observerPositionKm,
			frame: observerFrame,
			elevationKm: this.config.root.elevationMeters / 1000,
			lookTargetKm: solarSystem.sun.positionKm,
		};
		const solarIrradiance = this.createSolarIrradianceProbes(
			solarSystem,
			observer,
			sunPose,
		);
		const objects = this.createMountainSimulationObjects(observer);
		const stars = this.createStars(observer);

		return {
			id: 'globe-simulation-sun-atmosphere',
			time: date.toISOString(),
			status: 'spherical-shell-sun-mountain-calibration',
			root: { ...this.config.root },
			geometry: {
				kind: 'spherical-earth',
				earthRadiusKm: this.config.earthRadiusKm,
				earth: {
					centerKm: { x: 0, y: 0, z: 0 },
					radiusKm: this.config.earthRadiusKm,
					axis: solarSystem.earthAxis,
					greenwichSiderealDeg: solarSystem.greenwichSiderealDeg,
				},
				sun: {
					centerKm: solarSystem.sun.positionKm,
					radiusKm: solarSystem.sun.radiusKm,
					distanceKm: solarSystem.sun.distanceKm,
					distanceAu: solarSystem.sun.distanceAu,
					apparentEclipticLongitudeDeg: solarSystem.sun.apparentEclipticLongitudeDeg,
				},
			},
			surface: {
				material: DEFAULT_GLOBE_SURFACE_MATERIAL,
			},
			display: createRadiometricDisplayConfig(this.config.display),
			observer,
			camera: this.createCamera(observer),
			atmosphere: {
				frame: {
					...DEFAULT_GLOBE_ATMOSPHERE_FRAME,
					planetRadiusKm: this.config.earthRadiusKm,
				},
				profile: DEFAULT_GLOBE_ATMOSPHERE_PROFILE,
			},
			sun: {
				...DEFAULT_GLOBE_SUN,
				position: solarSystem.sun.positionKm,
				direction: observerToSun,
				distanceKm: solarSystem.sun.distanceKm,
				radiusKm: solarSystem.sun.radiusKm,
				apparentAngularRadiusRad: solarSystem.sun.apparentAngularRadiusRad,
				apparentAngularDiameterRad: solarSystem.sun.apparentAngularDiameterRad,
				altitudeDeg: sunPose.altitudeDeg,
				azimuthDeg: sunPose.azimuthDeg,
				source: DEFAULT_GLOBE_SOLAR_SOURCE,
				irradiance: solarIrradiance,
				solarIrradianceScale: solarIrradiance.renderer.atmosphereSourceScale,
			},
			objects,
			stars,
			scope: {
				celestialObjects: ['sun', 'northern-bright-stars'],
				terrain: 'synthetic-mountain-markers',
				clouds: false,
			},
		};
	}
}
