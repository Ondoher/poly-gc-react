import { Algorithm32 } from '../../../shared/algorithm32/production/Algorithm32.js';
import CanonicalAtmosphere from '../../../shared/algorithm32/production/atmospheres/CanonicalAtmosphere.js';
import BrunetonColorDisplayModel from '../../../shared/algorithm32/production/color/BrunetonColorDisplayModel.js';
import {
	CANONICAL_ATMOSPHERE_CONSTANTS,
	CANONICAL_SPECTRAL_BASIS,
	CANONICAL_SPECTRAL_CHANNELS,
	FIGURE1_DISPLAY_CONSTANTS,
	shaderQualityProfileById,
} from '../../../shared/algorithm32/production/constants/Algorithm32CanonicalData.js';
import FlatEarthGeometry from '../../../shared/algorithm32/production/geometries/FlatEarthGeometry.js';
import SphericalEarthGeometry from '../../../shared/algorithm32/production/geometries/SphericalEarthGeometry.js';
import DistantSunLightSource from '../../../shared/algorithm32/production/light-sources/DistantSunLightSource.js';
import LocalSunLightSource from '../../../shared/algorithm32/production/light-sources/LocalSunLightSource.js';
import { createAlgorithm32BindingValues as createDefaultAlgorithm32BindingValues } from '../../../shared/algorithm32/production/react/Algorithm32ReactUtils.js';

export const ALGORITHM32_METERS_PER_SCENE_UNIT = 1000;

const DEFAULT_LOCAL_SOURCE_REFERENCE_DISTANCE_METERS = 4800000;
const DEFAULT_FLAT_BACKGROUND_DISTANCE_METERS = 100000;
const DEFAULT_ALGORITHM32_SHADER_QUALITY_PROFILE = shaderQualityProfileById('fast');

/**
 * Create a production Algorithm32 facade for one config.
 *
 * @param {Config} config - Supplies the Algorithm32 config.
 * @returns {Algorithm32} The facade instance.
 */
export function createAlgorithm32(config) {
	return new Algorithm32(config);
}

/**
 * Create the preliminary flat/local Algorithm32 config from a flat scene.
 *
 * @param {object | null | undefined} scene - Supplies the flat simulation scene.
 * @param {object | null | undefined} atmosphereSun - Supplies the resolved atmosphere sun.
 * @returns {Config} The Algorithm32 config.
 */
export function createFlatAlgorithm32Config(scene, atmosphereSun) {
	const controls = DEFAULT_ALGORITHM32_SHADER_QUALITY_PROFILE.numericalControls;
	const observerPosition = scene?.observer?.position ?? {};
	const sun = atmosphereSun ?? scene?.lighting?.atmosphereSun ?? scene?.lighting?.sun ?? {};
	const sourcePositionMeters = flatScenePointToModelMeters(
		sun.position,
		observerPosition,
	);
	const topAltitudeMeters = atmosphereTopAltitudeMeters(scene);
	const sceneSkyRayLimitMeters = flatSceneSkyRayLimitMeters(scene);
	const cacheRhoMaxMeters = Math.max(
		horizontalLength(sourcePositionMeters),
		sceneSkyRayLimitMeters,
		1,
	);
	const cacheZBinsMeters = spreadBins(0, topAltitudeMeters, 5);
	const cacheRhoBinsMeters = spreadBins(0, cacheRhoMaxMeters, 5);
	const referenceDistanceMeters = positiveFiniteOrDefault(
		Number(scene?.atmosphere?.rendering?.falseSunRadiance?.referenceDistanceKm) * 1000,
		positiveFiniteOrDefault(Number(sun.distanceKm) * 1000, DEFAULT_LOCAL_SOURCE_REFERENCE_DISTANCE_METERS),
	);

	return {
		lightSource: new LocalSunLightSource({
			sourceKey: 'flat-simulation-local-sun',
			spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
			referenceDistanceMeters,
			referenceSpectralIncidentScale: positiveFiniteOrDefault(
				Number(sun.solarIrradianceScale),
				1,
			),
			radiusMeters: Math.max(Number(sun.radiusKm) * 1000 || 0, 0),
			distanceFalloff: scene?.atmosphere?.rendering?.falseSunRadiance?.distanceFalloff !== false,
			cacheZBinsMeters,
			cacheRhoBinsMeters,
			cacheDirectionCount: controls.incidentDirectionCount,
		}),
		atmosphere: createCanonicalAtmosphere(),
		geometry: new FlatEarthGeometry({
			observerPositionMeters: flatScenePointToModelMeters(
				scene?.observer?.position,
				observerPosition,
			),
			sourcePositionMeters,
			topAltitudeMeters,
			sceneSkyRayLimitMeters,
			observerCenteredDome: {
				apexAltitudeMeters: topAltitudeMeters,
				maxObserverViewRayExtentMeters: sceneSkyRayLimitMeters,
			},
			sourceTransmittanceIntervalCount: controls.sourceTransmittanceIntervalCount,
			cacheZBinsMeters,
			cacheRhoBinsMeters,
		}),
		color: createColorDisplay(),
		spectral: CANONICAL_SPECTRAL_BASIS,
		execution: {
			pathIntervalCount: controls.pathIntervalCount,
			sourceTransmittanceIntervalCount: controls.sourceTransmittanceIntervalCount,
			incidentDirectionCount: controls.incidentDirectionCount,
			incidentAltitudeBinCount: controls.incidentAltitudeBinCount,
			cachePathIntervalCount: controls.pathIntervalCount,
			pathSampleDistribution: DEFAULT_ALGORITHM32_SHADER_QUALITY_PROFILE.transportOptimization?.pathSampleDistribution ?? null,
		},
		shader: {
			metersPerSceneUnit: ALGORITHM32_METERS_PER_SCENE_UNIT,
		},
	};
}

/**
 * Create the preliminary globe/spherical Algorithm32 config from a globe scene.
 *
 * @param {object | null | undefined} scene - Supplies the globe simulation scene.
 * @returns {Config} The Algorithm32 config.
 */
export function createGlobeAlgorithm32Config(scene) {
	const controls = DEFAULT_ALGORITHM32_SHADER_QUALITY_PROFILE.numericalControls;
	const bottomRadiusMeters = positiveFiniteOrDefault(
		Number(scene?.geometry?.earthRadiusKm) * 1000,
		CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
	);
	const topAltitudeMeters = atmosphereTopAltitudeMeters(scene);
	const sourceDirection = vectorToArray(scene?.sun?.direction, [0, 1, 0]);
	const observerUpDirection = vectorToArray(scene?.observer?.frame?.up, [0, 1, 0]);

	return {
		lightSource: new DistantSunLightSource({
			directionToLight: sourceDirection,
			spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
			angularRadiusRadians: Math.max(Number(scene?.sun?.apparentAngularRadiusRad) || 0, 0),
			cacheAltitudeBinCount: controls.incidentAltitudeBinCount,
			cacheDirectionCount: controls.incidentDirectionCount,
			cacheAltitudeLookup: DEFAULT_ALGORITHM32_SHADER_QUALITY_PROFILE.cacheOptimization?.altitudeLookup ?? null,
		}),
		atmosphere: createCanonicalAtmosphere(),
		geometry: new SphericalEarthGeometry({
			bottomRadiusMeters,
			topRadiusMeters: bottomRadiusMeters + topAltitudeMeters,
			observerHeightMeters: globeObserverHeightMeters(scene, bottomRadiusMeters),
			observerUpDirection,
			sceneFrame: {
				kind: 'model-space',
			},
			sourceDirection,
			cacheAltitudeBinCount: controls.incidentAltitudeBinCount,
			sourceTransmittanceIntervalCount: controls.sourceTransmittanceIntervalCount,
		}),
		color: createColorDisplay(),
		spectral: CANONICAL_SPECTRAL_BASIS,
		execution: {
			pathIntervalCount: controls.pathIntervalCount,
			sourceTransmittanceIntervalCount: controls.sourceTransmittanceIntervalCount,
			incidentDirectionCount: controls.incidentDirectionCount,
			incidentAltitudeBinCount: controls.incidentAltitudeBinCount,
			cachePathIntervalCount: controls.pathIntervalCount,
			pathSampleDistribution: DEFAULT_ALGORITHM32_SHADER_QUALITY_PROFILE.transportOptimization?.pathSampleDistribution ?? null,
		},
		shader: {
			metersPerSceneUnit: ALGORITHM32_METERS_PER_SCENE_UNIT,
		},
	};
}

/**
 * Create binding values consumed by the production shader builder.
 *
 * @param {unknown} THREE - Supplies the Three namespace.
 * @param {number | null} [sceneDepthMaxMeters] - Supplies an optional app
 * override for the geometry-owned scene-depth cap.
 * @returns {Record<string, unknown>} Mutable shader binding values.
 */
export function createAlgorithm32BindingValues(THREE, sceneDepthMaxMeters = null) {
	return createDefaultAlgorithm32BindingValues(THREE, sceneDepthMaxMeters);
}

/**
 * Update flat shader bindings from the live camera.
 *
 * @param {Record<string, unknown>} bindings - Supplies mutable binding values.
 * @param {unknown} camera - Supplies the Three camera.
 * @param {object | null | undefined} scene - Supplies the flat scene.
 * @param {Config} config - Supplies the active flat Algorithm32 config.
 * @returns {void}
 */
export function updateFlatAlgorithm32BindingValues(bindings, camera, scene, config) {
	const geometry = config?.geometry;

	if (typeof geometry?.mapObserverLocalScenePointToModelPosition !== 'function') {
		throw new TypeError('Flat Algorithm32 binding updates require observer-local geometry mapping.');
	}

	updateCameraMatrices(bindings, camera);
	setVector3FromArray(
		bindings['geometry.cameraWorldPositionMeters'],
		geometry.mapObserverLocalScenePointToModelPosition(camera?.position, {
			metersPerSceneUnit: ALGORITHM32_METERS_PER_SCENE_UNIT,
		}),
	);
}

/**
 * Update globe shader bindings from the live camera.
 *
 * @param {Record<string, unknown>} bindings - Supplies mutable binding values.
 * @param {unknown} camera - Supplies the Three camera.
 * @returns {void}
 */
export function updateGlobeAlgorithm32BindingValues(bindings, camera) {
	updateCameraMatrices(bindings, camera);
	setVector3FromArray(
		bindings['geometry.cameraWorldPositionMeters'],
		[
			(Number(camera?.position?.x) || 0) * 1000,
			(Number(camera?.position?.y) || 0) * 1000,
			(Number(camera?.position?.z) || 0) * 1000,
		],
	);
}

/**
 * Return true when the scene wants Algorithm32 composition.
 *
 * @param {object | null | undefined} scene - Supplies the simulation scene.
 * @returns {boolean} True when enabled.
 */
export function algorithm32AtmosphereEnabled(scene) {
	return Boolean(scene?.atmosphere?.enabled ?? scene?.atmosphere);
}

/**
 * Create the canonical atmosphere model.
 *
 * @returns {CanonicalAtmosphere} The atmosphere model.
 */
function createCanonicalAtmosphere() {
	return new CanonicalAtmosphere({
		constants: CANONICAL_ATMOSPHERE_CONSTANTS,
		spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
	});
}

/**
 * Create the canonical display conversion model.
 *
 * @returns {BrunetonColorDisplayModel} The color model.
 */
function createColorDisplay() {
	return new BrunetonColorDisplayModel({
		displayConstants: FIGURE1_DISPLAY_CONSTANTS,
	});
}

/**
 * Copy camera matrices into shader binding values.
 *
 * @param {Record<string, unknown>} bindings - Supplies binding values.
 * @param {unknown} camera - Supplies the Three camera.
 * @returns {void}
 */
function updateCameraMatrices(bindings, camera) {
	camera?.updateMatrixWorld?.();
	camera?.updateProjectionMatrix?.();
	bindings['geometry.inverseProjectionMatrix']?.copy?.(camera?.projectionMatrixInverse);
	bindings['geometry.inverseViewMatrix']?.copy?.(camera?.matrixWorld);
}

/**
 * Convert a flat scene point into Algorithm32 flat model meters.
 *
 * @param {object | null | undefined} point - Supplies a y-up scene point in kilometers.
 * @param {object | null | undefined} observer - Supplies the observer origin point in kilometers.
 * @returns {readonly [number, number, number]} The model-space point in meters.
 */
function flatScenePointToModelMeters(point, observer) {
	const scenePoint = point ?? {};
	const observerPoint = observer ?? {};

	return Object.freeze([
		((Number(scenePoint.x) || 0) - (Number(observerPoint.x) || 0)) * 1000,
		-((Number(scenePoint.z) || 0) - (Number(observerPoint.z) || 0)) * 1000,
		(Number(scenePoint.y) || 0) * 1000,
	]);
}

/**
 * Return the atmosphere top altitude for a scene.
 *
 * @param {object | null | undefined} scene - Supplies a simulation scene.
 * @returns {number} Top altitude in meters.
 */
function atmosphereTopAltitudeMeters(scene) {
	return positiveFiniteOrDefault(
		Number(scene?.atmosphere?.profile?.topAltitudeKm) * 1000,
		CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters
			- CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
	);
}

/**
 * Return the flat sky-ray limit.
 *
 * @param {object | null | undefined} scene - Supplies the flat scene.
 * @returns {number} Scene sky-ray limit in meters.
 */
function flatSceneSkyRayLimitMeters(scene) {
	return positiveFiniteOrDefault(
		Number(scene?.atmosphere?.rendering?.backgroundAtmosphereViewDistanceKm) * 1000,
		DEFAULT_FLAT_BACKGROUND_DISTANCE_METERS,
	);
}

/**
 * Return the globe observer height from camera position.
 *
 * @param {object | null | undefined} scene - Supplies the globe scene.
 * @param {number} bottomRadiusMeters - Supplies the bottom radius.
 * @returns {number} Observer height in meters.
 */
function globeObserverHeightMeters(scene, bottomRadiusMeters) {
	const cameraPosition = vectorToArray(scene?.camera?.positionKm, null);

	if (cameraPosition) {
		return Math.max(0, vectorLength(cameraPosition) * 1000 - bottomRadiusMeters);
	}

	return Math.max(0, Number(scene?.observer?.elevationKm) * 1000 || 0);
}

/**
 * Convert an object vector to an array.
 *
 * @param {object | null | undefined} vector - Supplies the vector.
 * @param {readonly [number, number, number] | null} fallback - Supplies fallback.
 * @returns {readonly [number, number, number] | null} The vector array.
 */
function vectorToArray(vector, fallback) {
	if (!vector) {
		return fallback;
	}

	return Object.freeze([
		Number(vector.x) || 0,
		Number(vector.y) || 0,
		Number(vector.z) || 0,
	]);
}

/**
 * Set a Three vector from an array.
 *
 * @param {unknown} target - Supplies the mutable vector.
 * @param {readonly number[]} value - Supplies coordinates.
 * @returns {void}
 */
function setVector3FromArray(target, value) {
	target?.set?.(value[0], value[1], value[2]);
}

/**
 * Return evenly spread bins.
 *
 * @param {number} min - Supplies the first value.
 * @param {number} max - Supplies the last value.
 * @param {number} count - Supplies the bin count.
 * @returns {readonly number[]} The bins.
 */
function spreadBins(min, max, count) {
	if (count <= 1) {
		return Object.freeze([min]);
	}

	const span = Math.max(max - min, 0);

	return Object.freeze(Array.from({ length: count }, (_, index) =>
		min + span * (index / (count - 1))));
}

/**
 * Return the length of a vector.
 *
 * @param {readonly number[]} vector - Supplies the vector.
 * @returns {number} The length.
 */
function vectorLength(vector) {
	return Math.hypot(vector[0], vector[1], vector[2]);
}

/**
 * Return horizontal length of a model-space vector.
 *
 * @param {readonly number[]} vector - Supplies the vector.
 * @returns {number} The horizontal length.
 */
function horizontalLength(vector) {
	return Math.hypot(vector[0], vector[1]);
}

/**
 * Return a positive finite number or fallback.
 *
 * @param {unknown} value - Supplies the candidate.
 * @param {number} fallback - Supplies the fallback.
 * @returns {number} The normalized value.
 */
function positiveFiniteOrDefault(value, fallback) {
	return Number.isFinite(value) && value > 0 ? value : fallback;
}
