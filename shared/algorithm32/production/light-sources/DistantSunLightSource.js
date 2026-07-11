import DistantSunIncidentRadianceCache from './DistantSunIncidentRadianceCache.js';
import { configureThreeShadowObject } from './ThreeShadowObjectConfigurator.js';
import {
	CANONICAL_SPECTRAL_CHANNELS,
	RUNTIME_NUMERICAL_CONTROLS,
} from '../constants/Algorithm32CanonicalData.js';
import VectorMath from '../utils/VectorMath.js';

const SPECTRAL_CHANNEL_COUNT = CANONICAL_SPECTRAL_CHANNELS.length;
const DEFAULT_SCENE_AMBIENT_INTENSITY_RANGE = Object.freeze({
	min: 0.06,
	max: 0.5,
});

/**
 * Own direct lighting and incident-cache creation for a distant sun source.
 */
export class DistantSunLightSource {
	/**
	 * Create a distant sun light source.
	 *
	 * @param {DistantSunLightSourceConfig} configuration - Supplies source
	 * direction, spectral channels, apparent size metadata, and cache policy.
	 */
	constructor(configuration) {
		if (!configuration || typeof configuration !== 'object') {
			throw new TypeError('DistantSunLightSource configuration is required.');
		}

		const {
			directionToLight,
			spectralChannels,
			angularRadiusRadians,
			cacheAltitudeBinCount = RUNTIME_NUMERICAL_CONTROLS.incidentAltitudeBinCount,
			cacheDirectionCount = RUNTIME_NUMERICAL_CONTROLS.incidentDirectionCount,
			cacheBoundaryAltitudeMeters = 2,
			cacheAltitudeLookup = null,
		} = configuration;

		assertSpectralChannels(spectralChannels, 'DistantSunLightSource');

		if (!Number.isFinite(angularRadiusRadians) || angularRadiusRadians < 0) {
			throw new TypeError('DistantSunLightSource angularRadiusRadians must be finite and non-negative.');
		}

		if (!Number.isInteger(cacheAltitudeBinCount) || cacheAltitudeBinCount < 1) {
			throw new RangeError('DistantSunLightSource cacheAltitudeBinCount must be a positive integer.');
		}

		if (!Number.isInteger(cacheDirectionCount) || cacheDirectionCount < 1) {
			throw new RangeError('DistantSunLightSource cacheDirectionCount must be a positive integer.');
		}

		if (!Number.isFinite(cacheBoundaryAltitudeMeters) || cacheBoundaryAltitudeMeters < 0) {
			throw new TypeError('DistantSunLightSource cacheBoundaryAltitudeMeters must be finite and non-negative.');
		}

		this._configuration = Object.freeze({
			directionToLight: normalizeDirection(directionToLight, 'directionToLight'),
			spectralChannels: freezeSpectralChannels(spectralChannels),
			angularRadiusRadians,
			cacheAltitudeBinCount,
			cacheDirectionCount,
			cacheBoundaryAltitudeMeters,
			cacheAltitudeLookup: normalizeCacheAltitudeLookup(cacheAltitudeLookup),
		});
	}

	/**
	 * Return the immutable source configuration snapshot.
	 *
	 * @returns {DistantSunLightSourceConfig} The source configuration.
	 */
	get configuration() {
		return this._configuration;
	}

	/**
	 * Identify this configured source model instance for compatibility.
	 *
	 * @returns {string} The source id.
	 */
	get id() {
		return 'distant-sun';
	}

	/**
	 * Return a serializable source descriptor.
	 *
	 * @returns {object} The source descriptor.
	 */
	describe() {
		return Object.freeze({
			kind: 'distant-sun-light-source',
			sourceKey: 'distant-sun',
			directionToLight: this._configuration.directionToLight,
			angularRadiusRadians: this._configuration.angularRadiusRadians,
			spectralChannelCount: this._configuration.spectralChannels.length,
			incidentRadianceCachePolicy: Object.freeze({
				altitudeBinCount: this._configuration.cacheAltitudeBinCount,
				directionCount: this._configuration.cacheDirectionCount,
				boundaryAltitudeMeters: this._configuration.cacheBoundaryAltitudeMeters,
				boundarySamplePolicy: 'first-altitude-bin-samples-minimum-in-atmosphere-altitude',
				altitudeLookup: this._configuration.cacheAltitudeLookup,
			}),
		});
	}

	/**
	 * Create a distant incident-radiance cache.
	 *
	 * @param {object} request - Supplies geometry radii and spectral basis.
	 * @returns {IncidentRadianceCache} The incident-radiance cache.
	 */
	createIncidentRadianceCache(request = {}) {
		const {
			bottomRadiusMeters,
			topRadiusMeters,
			spectralBasis,
			boundaryAltitudeMeters,
		} = request;

		return new DistantSunIncidentRadianceCache({
			sourceKey: 'distant-sun',
			bottomRadiusMeters,
			topRadiusMeters,
			altitudeBinCount: this._configuration.cacheAltitudeBinCount,
			directionCount: this._configuration.cacheDirectionCount,
			directionToLight: this._configuration.directionToLight,
			spectralBasis,
			boundaryAltitudeMeters: boundaryAltitudeMeters
				?? this._configuration.cacheBoundaryAltitudeMeters,
			altitudeLookup: this._configuration.cacheAltitudeLookup,
		});
	}

	/**
	 * Sample direct source lighting at a transport point.
	 *
	 * @returns {DirectLightingSample} The direct lighting sample.
	 */
	sampleDirectLighting() {
		return Object.freeze({
			incidentRadiance: Object.freeze(
				this._configuration.spectralChannels.map((channel) => channel.solarIrradiance),
			),
			directionToLight: this._configuration.directionToLight,
			metadata: Object.freeze({
				directionFromSource: Object.freeze(VectorMath.scale(this._configuration.directionToLight, -1)),
				angularRadiusRadians: this._configuration.angularRadiusRadians,
			}),
		});
	}

	/**
	 * Resolve local scene-light percentages for a distant source.
	 *
	 * @param {object} [request] - Supplies optional scene light direction, local
	 * up vector, and twilight bounds.
	 * @returns {object} Direct and twilight-aware ambient light percentages.
	 */
	resolveSceneLightPercent(request = {}) {
		const directionToSourceScene = normalizeDirection(
			request.directionToLightScene
			?? request.directionToSourceScene
			?? this._configuration.directionToLight,
			'directionToLightScene',
		);
		const localUpScene = normalizeDirection(
			request.localUpScene ?? request.observerUpScene ?? [0, 1, 0],
			'localUpScene',
		);
		const sourceUpDot = dot(directionToSourceScene, localUpScene);
		const twilightStartSourceUpDot = finiteNumberOrDefault(
			request.twilightStartSourceUpDot,
			Math.sin(-12 * Math.PI / 180),
		);
		const fullAmbientSourceUpDot = finiteNumberOrDefault(
			request.fullAmbientSourceUpDot,
			Math.sin(12 * Math.PI / 180),
		);
		const ambientLightPercent = smoothStep(
			twilightStartSourceUpDot,
			fullAmbientSourceUpDot,
			sourceUpDot,
		);
		const directLightPercent = clamp01(sourceUpDot);

		return Object.freeze({
			directLightPercent,
			ambientLightPercent,
			localLightPercent: ambientLightPercent,
			sourceUpDot,
			twilightStartSourceUpDot,
			fullAmbientSourceUpDot,
			policy: 'distant-source-twilight-aware-scene-light-percent',
		});
	}

	/**
	 * Add or create source-owned scene lighting for endpoint rendering.
	 *
	 * @param {LightSourceThreeLightingRequest & { scene?: unknown }} request - Supplies Three,
	 * optional scene, direction, focus, intensity, ambient, and shadow policy.
	 * @returns {LightSourceThreeLightingObjects} The source-owned Three lights.
	 */
	addSceneLighting(request = {}) {
		const THREE = request.THREE;

		if (
			!THREE
			|| typeof THREE.DirectionalLight !== 'function'
			|| typeof THREE.AmbientLight !== 'function'
			|| typeof THREE.Object3D !== 'function'
		) {
			throw new TypeError('DistantSunLightSource.addSceneLighting requires THREE lighting constructors.');
		}

		const focusSceneUnits = vector3Tuple(request.focusSceneUnits ?? [0, 0, 0], 'focusSceneUnits');
		const directionToSourceScene = normalizeDirection(
			request.directionToLightScene
			?? request.directionToSourceScene
			?? this._configuration.directionToLight,
			'directionToLightScene',
		);
		const lightDistanceSceneUnits = Math.max(
			1,
			finiteNumberOrDefault(request.lightDistanceSceneUnits, 100),
		);
		const intensity = finiteNumberOrDefault(request.intensity, 3);
		const sceneLightPercent = this.resolveSceneLightPercent({
			...request,
			directionToLightScene: directionToSourceScene,
		});
		const ambientIntensityRange = sceneAmbientIntensityRangeOrDefault(
			request.ambientIntensityRange,
			DEFAULT_SCENE_AMBIENT_INTENSITY_RANGE.min,
			finiteNumberOrDefault(request.ambientIntensity, DEFAULT_SCENE_AMBIENT_INTENSITY_RANGE.max),
		);
		const ambientIntensity = scaleRange(
			ambientIntensityRange,
			sceneLightPercent.ambientLightPercent,
		);
		const shadowObjects = shadowObjectRequests(request.shadow, focusSceneUnits, lightDistanceSceneUnits);
		const sourceLights = shadowObjects.length > 0
			? shadowObjects.map((shadowObject, index) => createDirectionalLight({
				THREE,
				directionToSourceScene,
				intensity: intensity / shadowObjects.length,
				shadowObject,
				objectIndex: index,
			}))
			: [createDirectionalLight({
				THREE,
				directionToSourceScene,
				intensity,
				shadowObject: normalizeShadowObjectRequest(
					{ enabled: false, focusSceneUnits, lightDistanceSceneUnits },
					focusSceneUnits,
					lightDistanceSceneUnits,
				),
				objectIndex: 0,
			})];
		const sceneObjects = sourceLights.map(({ target }) => target);
		const lights = sourceLights.map(({ light }) => light);
		const primaryShadow = shadowObjects[0] ?? null;

		if (ambientIntensity > 0) {
			lights.unshift(this._createThreeAmbientLight({
				THREE,
				ambientIntensity,
			}));
		}

		const result = Object.freeze({
			lights: Object.freeze(lights),
			sceneObjects: Object.freeze(sceneObjects),
			metadata: Object.freeze({
				owner: 'DistantSunLightSource',
				sourceKey: 'distant-sun',
				lightingPolicy: 'source-driven-distant-directional-light',
				intensity,
				ambientIntensity,
				ambientIntensityRange,
				ambientLightPercent: sceneLightPercent.ambientLightPercent,
				directLightPercent: sceneLightPercent.directLightPercent,
				directionToSourceScene,
				directionToSourceModel: this._configuration.directionToLight,
				focusSceneUnits: primaryShadow?.focusSceneUnits ?? focusSceneUnits,
				lightDistanceSceneUnits: primaryShadow?.lightDistanceSceneUnits ?? lightDistanceSceneUnits,
				shadowPolicy: shadowObjects.length > 0 ? 'three-shadow-map-from-distant-source-direction' : 'shadows-disabled',
				shadow: primaryShadow ? Object.freeze({ ...primaryShadow }) : null,
				shadowObjects: Object.freeze(shadowObjects.map((shadowObject) => Object.freeze({ ...shadowObject }))),
			}),
		});

		addLightingObjectsToScene(request.scene, result);

		return result;
	}

	/**
	 * Create the source-owned ambient fill light for endpoint scene rendering.
	 *
	 * @param {object} request - Supplies Three and the ambient intensity.
	 * @returns {unknown} The created Three AmbientLight.
	 */
	_createThreeAmbientLight(request = {}) {
		const THREE = request.THREE;

		if (!THREE || typeof THREE.AmbientLight !== 'function') {
			throw new TypeError('DistantSunLightSource.addSceneLighting requires THREE.AmbientLight.');
		}

		const ambientIntensity = Math.max(
			0,
			finiteNumberOrDefault(request.ambientIntensity ?? request.intensity, 0),
		);
		const ambient = new THREE.AmbientLight(0xffffff, ambientIntensity);

		ambient.name = 'distant-sun-ambient-fill';
		ambient.userData.algorithm32SourceLight = true;
		ambient.userData.sourceKey = 'distant-sun';
		ambient.userData.lightingRole = 'ambient-fill';

		return ambient;
	}

	/**
	 * Configure an app-authored Three mesh or object tree for source shadows.
	 *
	 * @param {unknown} object - Supplies the Three object to configure.
	 * @param {object} [request] - Supplies shadow flag overrides.
	 * @returns {unknown} The configured object.
	 */
	configureThreeShadowObject(object, request = {}) {
		return configureThreeShadowObject(object, {
			owner: 'DistantSunLightSource',
			sourceKey: 'distant-sun',
			shadowPolicy: 'three-shadow-map-from-distant-source-direction',
		}, request);
	}

	/**
	 * Resolve the source path limit for a directional source.
	 *
	 * @returns {SourcePathLimit} The source path limit.
	 */
	resolveSourcePathLimit() {
		return Object.freeze({
			maxDistanceMeters: null,
			reason: 'distant-source-to-atmosphere-boundary',
		});
	}

	/**
	 * Create the light-source-owned distant sun shader contribution.
	 *
	 * @param {ShaderContributionRequest} request - Supplies the active shader descriptor.
	 * @returns {ShaderContribution} Return the light-source shader contribution.
	 */
	createShaderContribution(request) {
		return this._createShaderContribution(request?.descriptor);
	}

	/**
	 * Create the light-source-owned distant sun shader contribution.
	 *
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
	 * @returns {ShaderContribution} Return the light-source contribution.
	 */
	_createShaderContribution(descriptor) {
		const facts = resolveDistantLightFacts(descriptor);

		return shaderContribution({
			id: 'light-distant-sun',
			owner: 'lightSource',
			descriptorFingerprint: descriptor.lightSource.fingerprint,
			compatibilityTags: descriptor.lightSource.compatibilityTags,
			provides: Object.freeze(['light.sampleDirectRadiance', 'light.sourceDirection']),
			requires: Object.freeze(['atmosphere.sourcePathTransmittance']),
			uniforms: Object.freeze([
				shaderUniform('uDistantSunDirection', 'vec3', 'lightSource.direction', facts.directionToLight),
			]),
			functions: Object.freeze([
				shaderBlock('light-source-constants', 'declareConstants', 0, `const float LIGHT_SOURCE_SOLAR_IRRADIANCE[${SPECTRAL_CHANNEL_COUNT}] = float[${SPECTRAL_CHANNEL_COUNT}](${formatFloatArray(CANONICAL_SPECTRAL_CHANNELS.map((channel) => channel.solarIrradiance))});`),
				shaderBlock('light-source-helper', 'sampleLightSource', 0, `SpectralValue sampleDirectRadiance(vec3 positionMeters) {
	SpectralValue sourceTransmittance = sourcePathTransmittance(positionMeters, normalize(uDistantSunDirection));
	SpectralValue radiance;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		radiance.c[channelIndex] = LIGHT_SOURCE_SOLAR_IRRADIANCE[channelIndex] * sourceTransmittance.c[channelIndex];
	}
	return radiance;
}`),
			]),
			mainHooks: Object.freeze([
				shaderBlock('light-main-direct', 'sampleLightSource', 0, 'state.lightRadiance = sampleDirectRadiance(state.ray.originMeters + state.ray.direction * max(state.bounds.endDistanceMeters * 0.5, 0.0));'),
			]),
		});
	}
}

/**
 * Freeze spectral channel inputs.
 *
 * @param {readonly SpectralChannelConstant[]} spectralChannels - Supplies
 * spectral channels.
 * @returns {readonly SpectralChannelConstant[]} Frozen channels.
 */
function freezeSpectralChannels(spectralChannels) {
	return Object.freeze(spectralChannels.map((channel) => Object.freeze({ ...channel })));
}

/**
 * Assert source spectral channels.
 *
 * @param {unknown} spectralChannels - Supplies candidate channels.
 * @param {string} owner - Supplies the owner label.
 * @returns {void}
 */
function assertSpectralChannels(spectralChannels, owner) {
	if (!Array.isArray(spectralChannels) || spectralChannels.length < 1) {
		throw new TypeError(`${owner} requires spectral channels.`);
	}

	for (const channel of spectralChannels) {
		if (!Number.isFinite(channel?.solarIrradiance)) {
			throw new TypeError(`${owner} spectral channels require finite solarIrradiance values.`);
		}
	}
}

/**
 * Use a finite number or fallback.
 *
 * @param {unknown} value - Supplies candidate value.
 * @param {number} fallback - Supplies fallback value.
 * @returns {number} Resolved number.
 */
function finiteNumberOrDefault(value, fallback) {
	return Number.isFinite(value) ? value : fallback;
}

/**
 * Clamp a value to the unit interval.
 *
 * @param {number} value - Supplies the candidate value.
 * @returns {number} Clamped value.
 */
function clamp01(value) {
	return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
}

/**
 * Smoothly map a value between two edge values.
 *
 * @param {number} edge0 - Supplies the lower edge.
 * @param {number} edge1 - Supplies the upper edge.
 * @param {number} value - Supplies the candidate value.
 * @returns {number} Smoothly clamped percentage.
 */
function smoothStep(edge0, edge1, value) {
	if (Math.abs(edge1 - edge0) <= Number.EPSILON) {
		return value >= edge1 ? 1 : 0;
	}

	const t = clamp01((value - edge0) / (edge1 - edge0));

	return t * t * (3 - 2 * t);
}

/**
 * Normalize ambient intensity bounds.
 *
 * @param {unknown} range - Supplies optional requested range.
 * @param {number} defaultMin - Supplies default minimum intensity.
 * @param {number} defaultMax - Supplies default maximum intensity.
 * @returns {{ min: number, max: number }} Normalized range.
 */
function sceneAmbientIntensityRangeOrDefault(range, defaultMin, defaultMax) {
	const min = Math.max(0, finiteNumberOrDefault(range?.min, defaultMin));
	const max = Math.max(min, finiteNumberOrDefault(range?.max, defaultMax));

	return Object.freeze({ min, max });
}

/**
 * Scale a unit percentage into an intensity range.
 *
 * @param {{ min: number, max: number }} range - Supplies min/max bounds.
 * @param {number} percent - Supplies unit percentage.
 * @returns {number} Scaled value.
 */
function scaleRange(range, percent) {
	return range.min + (range.max - range.min) * clamp01(percent);
}

/**
 * Dot two vectors.
 *
 * @param {readonly number[]} left - Supplies the left vector.
 * @param {readonly number[]} right - Supplies the right vector.
 * @returns {number} Dot product.
 */
function dot(left, right) {
	return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

/**
 * Resolve optional Three layer index.
 *
 * @param {unknown} value - Supplies candidate layer index.
 * @returns {number | null} Layer index or null.
 */
function layerIndexOrNull(value) {
	if (value == null) {
		return null;
	}

	if (!Number.isInteger(value) || value < 0 || value > 31) {
		throw new RangeError('layerIndex must be an integer from 0 to 31.');
	}

	return value;
}

/**
 * Apply an optional Three layer index.
 *
 * @param {unknown} object - Supplies object with layers.
 * @param {number | null} layerIndex - Supplies optional layer index.
 * @returns {void}
 */
function applyLayerIndex(object, layerIndex) {
	if (layerIndex === null || !object?.layers || typeof object.layers.set !== 'function') {
		return;
	}

	object.layers.set(layerIndex);
}

/**
 * Convert a scene vector request to a tuple.
 *
 * @param {unknown} value - Supplies candidate vector.
 * @param {string} label - Supplies error label.
 * @returns {readonly [number, number, number]} The scene vector tuple.
 */
function vector3Tuple(value, label) {
	const vector = Array.isArray(value) ? value : value?.coordinates;

	if (Array.isArray(vector) && vector.length === 3 && vector.every(Number.isFinite)) {
		return Object.freeze([vector[0], vector[1], vector[2]]);
	}

	throw new TypeError(`DistantSunLightSource.addSceneLighting requires finite ${label}.`);
}

/**
 * Normalize optional shadow object requests.
 *
 * @param {LightSourceThreeShadowRequest | undefined} shadow - Supplies candidate shadow config.
 * @param {readonly [number, number, number]} focusSceneUnits - Supplies default focus point.
 * @param {number} defaultLightDistanceSceneUnits - Supplies default light distance.
 * @returns {readonly object[]} Normalized shadow object configs.
 */
function shadowObjectRequests(shadow, focusSceneUnits, defaultLightDistanceSceneUnits) {
	if (!shadow || shadow.enabled !== true) {
		return Object.freeze([]);
	}

	const objects = Array.isArray(shadow.objects) && shadow.objects.length > 0
		? shadow.objects
		: [shadow];
	const defaultShadowIntensity = objects.length;

	return Object.freeze(objects.map((object, index) => normalizeShadowObjectRequest({
		...shadow,
		...object,
		objectKey: object.objectKey ?? shadow.objectKey ?? `shadow-object-${index}`,
	}, focusSceneUnits, defaultLightDistanceSceneUnits, defaultShadowIntensity)));
}

/**
 * Normalize one shadow object request.
 *
 * @param {LightSourceThreeShadowRequest} shadow - Supplies candidate shadow config.
 * @param {readonly [number, number, number]} focusSceneUnits - Supplies default focus point.
 * @param {number} defaultLightDistanceSceneUnits - Supplies default light distance.
 * @param {number} defaultShadowIntensity - Supplies default split-light shadow opacity.
 * @returns {object} Normalized shadow config.
 */
function normalizeShadowObjectRequest(
	shadow,
	focusSceneUnits,
	defaultLightDistanceSceneUnits,
	defaultShadowIntensity = 1,
) {
	const shadowFocusSceneUnits = vector3Tuple(
		shadow.focusSceneUnits ?? focusSceneUnits,
		'shadow.focusSceneUnits',
	);
	const extentSceneUnits = Math.max(0.001, finiteNumberOrDefault(shadow.extentSceneUnits, 20));
	const lightDistanceSceneUnits = Math.max(
		extentSceneUnits * 2,
		finiteNumberOrDefault(shadow.lightDistanceSceneUnits, defaultLightDistanceSceneUnits),
	);
	const cameraNear = Math.max(0.001, finiteNumberOrDefault(shadow.cameraNear, 0.1));
	const cameraFar = Math.max(
		cameraNear + 0.001,
		finiteNumberOrDefault(shadow.cameraFar, lightDistanceSceneUnits + extentSceneUnits * 4),
	);
	const cameraLeft = finiteNumberOrDefault(shadow.cameraLeft, -extentSceneUnits);
	const cameraRight = Math.max(cameraLeft + 0.001, finiteNumberOrDefault(shadow.cameraRight, extentSceneUnits));
	const cameraBottom = finiteNumberOrDefault(shadow.cameraBottom, -extentSceneUnits);
	const cameraTop = Math.max(cameraBottom + 0.001, finiteNumberOrDefault(shadow.cameraTop, extentSceneUnits));
	const mapSize = Math.max(16, Math.floor(finiteNumberOrDefault(shadow.mapSize, 2048)));

	return Object.freeze({
		enabled: shadow.enabled === true,
		focusSceneUnits: shadowFocusSceneUnits,
		extentSceneUnits,
		lightDistanceSceneUnits,
		cameraLeft,
		cameraRight,
		cameraTop,
		cameraBottom,
		cameraNear,
		cameraFar,
		mapSize,
		bias: finiteNumberOrDefault(shadow.bias, -0.00002),
		normalBias: finiteNumberOrDefault(shadow.normalBias, 0.02),
		radius: Math.max(0, finiteNumberOrDefault(shadow.radius, 1)),
		shadowIntensity: Math.max(0, finiteNumberOrDefault(shadow.shadowIntensity, defaultShadowIntensity)),
		objectKey: String(shadow.objectKey ?? 'shadow-object'),
		layerIndex: layerIndexOrNull(shadow.layerIndex),
	});
}

/**
 * Create a directional source light and target pair.
 *
 * @param {object} request - Supplies light facts.
 * @returns {{ light: unknown, target: unknown }} Created pair.
 */
function createDirectionalLight({
	THREE,
	directionToSourceScene,
	intensity,
	shadowObject,
	objectIndex,
}) {
	const target = new THREE.Object3D();
	const sourceLight = new THREE.DirectionalLight(0xffffff, intensity);

	sourceLight.name = `distant-sun-source-directional-light-${objectIndex}`;
	sourceLight.position.set(
		shadowObject.focusSceneUnits[0] + directionToSourceScene[0] * shadowObject.lightDistanceSceneUnits,
		shadowObject.focusSceneUnits[1] + directionToSourceScene[1] * shadowObject.lightDistanceSceneUnits,
		shadowObject.focusSceneUnits[2] + directionToSourceScene[2] * shadowObject.lightDistanceSceneUnits,
	);
	target.name = `distant-sun-source-directional-target-${objectIndex}`;
	target.position.set(...shadowObject.focusSceneUnits);
	sourceLight.target = target;
	sourceLight.castShadow = shadowObject.enabled === true;
	sourceLight.userData.algorithm32SourceLight = true;
	sourceLight.userData.sourceKey = 'distant-sun';
	sourceLight.userData.lightingRole = 'source-directional-light';
	sourceLight.userData.directionToSourceScene = directionToSourceScene;
	sourceLight.userData.shadowObjectKey = shadowObject.objectKey;
	sourceLight.userData.shadowLayerIndex = shadowObject.layerIndex;
	target.userData.algorithm32SourceLight = true;
	target.userData.sourceKey = 'distant-sun';
	target.userData.lightingRole = 'source-directional-target';
	target.userData.shadowObjectKey = shadowObject.objectKey;
	target.userData.shadowLayerIndex = shadowObject.layerIndex;

	if (shadowObject.enabled === true) {
		applyDirectionalShadow(sourceLight, shadowObject);
	}

	return { light: sourceLight, target };
}

/**
 * Apply normalized directional shadow settings.
 *
 * @param {unknown} light - Supplies a Three directional light.
 * @param {object} shadow - Supplies normalized shadow settings.
 * @returns {void}
 */
function applyDirectionalShadow(light, shadow) {
	if (!light.shadow) {
		return;
	}

	if (light.shadow.mapSize) {
		light.shadow.mapSize.width = shadow.mapSize;
		light.shadow.mapSize.height = shadow.mapSize;
	}
	if (light.shadow.camera) {
		light.shadow.camera.left = shadow.cameraLeft;
		light.shadow.camera.right = shadow.cameraRight;
		light.shadow.camera.top = shadow.cameraTop;
		light.shadow.camera.bottom = shadow.cameraBottom;
		light.shadow.camera.near = shadow.cameraNear;
		light.shadow.camera.far = shadow.cameraFar;
		applyLayerIndex(light.shadow.camera, shadow.layerIndex);
		light.shadow.camera.updateProjectionMatrix?.();
	}
	light.shadow.bias = shadow.bias;
	light.shadow.normalBias = shadow.normalBias;
	light.shadow.radius = shadow.radius;
	light.shadow.intensity = shadow.shadowIntensity;
}

/**
 * Normalize a non-zero direction.
 *
 * @param {unknown} direction - Supplies the direction candidate.
 * @param {string} label - Supplies the error label.
 * @returns {UnitVector3} The normalized direction.
 */
function normalizeDirection(direction, label) {
	if (!Array.isArray(direction) || direction.length !== 3 || !direction.every(Number.isFinite)) {
		throw new TypeError(`${label} must be a finite three-component vector.`);
	}

	if (VectorMath.length(direction) <= Number.EPSILON) {
		throw new RangeError(`${label} must be non-zero.`);
	}

	return Object.freeze(VectorMath.normalize(direction));
}

/**
 * Normalize an optional distant cache altitude lookup policy.
 *
 * @param {unknown} altitudeLookup - Supplies candidate lookup policy.
 * @returns {object | null} Return normalized policy.
 */
function normalizeCacheAltitudeLookup(altitudeLookup) {
	if (altitudeLookup == null) {
		return null;
	}

	if (
		typeof altitudeLookup === 'object'
		&& ['nearest-bin', 'linear-altitude-v1'].includes(altitudeLookup.kind)
	) {
		return Object.freeze({
			kind: altitudeLookup.kind,
		});
	}

	throw new TypeError('DistantSunLightSource cacheAltitudeLookup must be nearest-bin or linear-altitude-v1.');
}

/**
 * Normalize distant source descriptor facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {{ readonly directionToLight: readonly number[] }} Return normalized light facts.
 */
function resolveDistantLightFacts(descriptor) {
	const facts = descriptor?.lightSource?.facts ?? {};
	const directionToLight = facts.directionToLight ?? facts.direction ?? [0, 0, 1];

	if (!descriptor?.lightSource) {
		throw new TypeError('DistantSunLightSource shader contribution requires a light-source descriptor.');
	}

	if (!Array.isArray(directionToLight) || directionToLight.length !== 3 || !directionToLight.every(Number.isFinite)) {
		throw new TypeError('DistantSunLightSource shader contribution requires directionToLight.');
	}

	return Object.freeze({
		directionToLight: Object.freeze([...directionToLight]),
	});
}

/**
 * Create one contribution object.
 *
 * @param {Partial<ShaderContribution>} configuration - Supplies contribution fields.
 * @returns {ShaderContribution} Return contribution.
 */
function shaderContribution(configuration) {
	return Object.freeze({
		defines: Object.freeze([]),
		uniforms: Object.freeze([]),
		textures: Object.freeze([]),
		functions: Object.freeze([]),
		mainHooks: Object.freeze([]),
		bindingRequirements: Object.freeze([]),
		diagnostics: null,
		...configuration,
	});
}

/**
 * Create one shader source block.
 *
 * @param {string} id - Supplies block id.
 * @param {ShaderSourceSlot} slot - Supplies assembly slot.
 * @param {number} order - Supplies slot-local order.
 * @param {string} code - Supplies GLSL source.
 * @returns {ShaderSourceBlock} Return source block.
 */
function shaderBlock(id, slot, order, code) {
	return Object.freeze({ id, slot, order, code });
}

/**
 * Create one shader uniform descriptor.
 *
 * @param {string} name - Supplies GLSL uniform name.
 * @param {string} type - Supplies GLSL uniform type.
 * @param {string} valueKey - Supplies runtime value key.
 * @param {unknown} [defaultValue] - Supplies optional default value.
 * @returns {ShaderUniformDescriptor} Return uniform descriptor.
 */
function shaderUniform(name, type, valueKey, defaultValue) {
	const descriptor = { name, type, valueKey };

	if (arguments.length >= 4) {
		descriptor.defaultValue = defaultValue;
	}

	return Object.freeze(descriptor);
}

/**
 * Format one number for GLSL output.
 *
 * @param {number} value - Supplies the value.
 * @returns {string} Return formatted GLSL number text.
 */
function formatFloat(value) {
	if (Number.isInteger(value)) {
		return value.toFixed(1);
	}

	return Number(value).toPrecision(12);
}

/**
 * Format numeric array entries for GLSL output.
 *
 * @param {readonly number[]} values - Supplies values.
 * @returns {string} Return formatted entries.
 */
function formatFloatArray(values) {
	return values.map((value) => formatFloat(value)).join(', ');
}

/**
 * Add created lighting objects to a Three scene when supplied.
 *
 * @param {unknown} scene - Supplies an optional Three scene.
 * @param {LightSourceThreeLightingObjects} lightingObjects - Supplies created lighting objects.
 * @returns {void}
 */
function addLightingObjectsToScene(scene, lightingObjects) {
	if (!scene || typeof scene.add !== 'function') {
		return;
	}

	for (const object of [...(lightingObjects.lights || []), ...(lightingObjects.sceneObjects || [])]) {
		scene.add(object);
	}
}

export default DistantSunLightSource;
