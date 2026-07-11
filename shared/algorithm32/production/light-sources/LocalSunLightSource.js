import LocalSunIncidentRadianceCache from './LocalSunIncidentRadianceCache.js';
import { configureThreeShadowObject } from './ThreeShadowObjectConfigurator.js';
import { CANONICAL_SPECTRAL_CHANNELS } from '../constants/Algorithm32CanonicalData.js';
import VectorMath from '../utils/VectorMath.js';
import WavelengthMath from '../utils/WavelengthMath.js';

const SPECTRAL_CHANNEL_COUNT = CANONICAL_SPECTRAL_CHANNELS.length;
const DEFAULT_SCENE_AMBIENT_INTENSITY_RANGE = Object.freeze({
	min: 0.06,
	max: 0.5,
});

/**
 * Own direct lighting and incident-cache creation for a finite local sun source.
 */
export class LocalSunLightSource {
	/**
	 * Create a local sun light source.
	 *
	 * @param {LocalSunLightSourceConfig} configuration - Supplies source key,
	 * spectral channels, finite-source scale, and cache policy.
	 */
	constructor(configuration) {
		if (!configuration || typeof configuration !== 'object') {
			throw new TypeError('LocalSunLightSource configuration is required.');
		}

		const {
			sourceKey,
			spectralChannels,
			referenceDistanceMeters,
			referenceSpectralIncidentScale,
			radiusMeters,
			distanceFalloff = true,
			cacheZBinsMeters = [0],
			cacheRhoBinsMeters = [0],
			cacheDirectionCount = 1,
		} = configuration;

		if (!sourceKey || typeof sourceKey !== 'string') {
			throw new TypeError('LocalSunLightSource requires sourceKey.');
		}

		assertSpectralChannels(spectralChannels);

		if (![referenceDistanceMeters, referenceSpectralIncidentScale, radiusMeters].every(Number.isFinite)) {
			throw new TypeError('LocalSunLightSource distance, scale, and radius must be finite.');
		}

		if (referenceDistanceMeters <= 0 || referenceSpectralIncidentScale < 0 || radiusMeters < 0) {
			throw new RangeError('LocalSunLightSource distance, scale, and radius must be in valid ranges.');
		}

		if (!isFiniteNumberArray(cacheZBinsMeters) || !isFiniteNumberArray(cacheRhoBinsMeters)) {
			throw new TypeError('LocalSunLightSource cache z/rho bins must be finite arrays.');
		}

		if (!Number.isInteger(cacheDirectionCount) || cacheDirectionCount < 1) {
			throw new RangeError('LocalSunLightSource cacheDirectionCount must be a positive integer.');
		}

		this._configuration = Object.freeze({
			sourceKey,
			spectralChannels: freezeSpectralChannels(spectralChannels),
			referenceDistanceMeters,
			referenceSpectralIncidentScale,
			radiusMeters,
			distanceFalloff,
			cacheZBinsMeters: Object.freeze([...cacheZBinsMeters]),
			cacheRhoBinsMeters: Object.freeze([...cacheRhoBinsMeters]),
			cacheDirectionCount,
		});
	}

	/**
	 * Return the immutable source configuration snapshot.
	 *
	 * @returns {LocalSunLightSourceConfig} The source configuration.
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
		return this._configuration.sourceKey;
	}

	/**
	 * Return a serializable source descriptor.
	 *
	 * @returns {object} The source descriptor.
	 */
	describe() {
		return Object.freeze({
			kind: 'local-sun-light-source',
			sourceKey: this._configuration.sourceKey,
			referenceDistanceMeters: this._configuration.referenceDistanceMeters,
			referenceSpectralIncidentScale: this._configuration.referenceSpectralIncidentScale,
			radiusMeters: this._configuration.radiusMeters,
			distanceFalloff: this._configuration.distanceFalloff,
			spectralChannelCount: this._configuration.spectralChannels.length,
			incidentRadianceCachePolicy: Object.freeze({
				zBinCount: this._configuration.cacheZBinsMeters.length,
				rhoBinCount: this._configuration.cacheRhoBinsMeters.length,
				directionCount: this._configuration.cacheDirectionCount,
				lookupPolicy: 'nearest-neighbor-poc-grid',
			}),
		});
	}

	/**
	 * Create a local incident-radiance cache.
	 *
	 * @param {object} [request] - Supplies optional spectral basis override.
	 * @returns {IncidentRadianceCache} The incident-radiance cache.
	 */
	createIncidentRadianceCache(request = {}) {
		const spectralBasis = request.spectralBasis ?? createSpectralBasisFromChannels(
			this._configuration.spectralChannels,
		);

		return new LocalSunIncidentRadianceCache({
			sourceKey: this._configuration.sourceKey,
			zBinsMeters: this._configuration.cacheZBinsMeters,
			rhoBinsMeters: this._configuration.cacheRhoBinsMeters,
			directionCount: this._configuration.cacheDirectionCount,
			spectralBasis,
		});
	}

	/**
	 * Sample direct lighting from the finite source.
	 *
	 * @param {object} [request] - Supplies source-relative sample facts.
	 * @returns {DirectLightingSample} The direct lighting sample.
	 */
	sampleDirectLighting(request = {}) {
		const sourceRelativePosition = request.sourceRelativePosition;

		if (!sourceRelativePosition) {
			throw new TypeError('LocalSunLightSource.sampleDirectLighting requires sourceRelativePosition.');
		}

		const distanceFromSourceMeters = sourceRelativePosition.distanceFromSourceMeters;
		const directionToLight = normalizeDirection(
			sourceRelativePosition.directionToSource ?? [0, 0, 1],
			'sourceRelativePosition.directionToSource',
		);
		const safeDistanceMeters = Math.max(
			this._configuration.radiusMeters,
			Number.isFinite(distanceFromSourceMeters)
				? distanceFromSourceMeters
				: this._configuration.referenceDistanceMeters,
		);
		const falloffScale = this._configuration.distanceFalloff
			? (this._configuration.referenceDistanceMeters / safeDistanceMeters) ** 2
			: 1;
		const incidentScale = this._configuration.referenceSpectralIncidentScale * falloffScale;
		const incidentRadiance = this._configuration.spectralChannels.map((channel) =>
			channel.solarIrradiance * incidentScale);

		return Object.freeze({
			incidentRadiance: Object.freeze(incidentRadiance),
			directionToLight,
			metadata: Object.freeze({
				sourceKey: this._configuration.sourceKey,
				distanceFromSourceMeters,
				safeDistanceMeters,
				radiusMeters: this._configuration.radiusMeters,
				referenceDistanceMeters: this._configuration.referenceDistanceMeters,
				referenceSpectralIncidentScale: this._configuration.referenceSpectralIncidentScale,
				falloffScale,
				incidentScale,
				distanceClampedToRadius: safeDistanceMeters !== distanceFromSourceMeters,
				spectralScaleKind: 'neutral-no-tint',
			}),
		});
	}

	/**
	 * Resolve local scene-light percentages for a finite source.
	 *
	 * @param {object} [request] - Supplies source-relative observer facts.
	 * @returns {object} Direct and ambient light percentages.
	 */
	resolveSceneLightPercent(request = {}) {
		const directLighting = this.sampleDirectLighting({
			sourceRelativePosition: request.sourceRelativePosition,
		});
		const metadata = directLighting.metadata && typeof directLighting.metadata === 'object'
			? directLighting.metadata
			: {};
		const referenceScale = Math.max(
			Number.EPSILON,
			this._configuration.referenceSpectralIncidentScale,
		);
		const localLightPercent = clamp01(finiteNumberOrDefault(metadata.incidentScale, 0) / referenceScale);

		return Object.freeze({
			directLightPercent: localLightPercent,
			ambientLightPercent: localLightPercent,
			localLightPercent,
			incidentScale: metadata.incidentScale,
			referenceSpectralIncidentScale: this._configuration.referenceSpectralIncidentScale,
			policy: 'local-source-reference-incident-scene-light-percent',
		});
	}

	/**
	 * Add or create source-owned scene lighting for endpoint rendering.
	 *
	 * @param {LightSourceThreeLightingRequest & { scene?: unknown }} request - Supplies Three,
	 * optional scene, source-relative facts, scene positions, and shadow/fill policy.
	 * @returns {LightSourceThreeLightingObjects} The source-owned Three lights.
	 */
	addSceneLighting(request = {}) {
		const THREE = request.THREE;

		if (
			!THREE
			|| typeof THREE.AmbientLight !== 'function'
			|| typeof THREE.PointLight !== 'function'
			|| typeof THREE.DirectionalLight !== 'function'
			|| typeof THREE.Object3D !== 'function'
		) {
			throw new TypeError('LocalSunLightSource.addSceneLighting requires THREE lighting constructors.');
		}

		const sourcePositionSceneUnits = vector3Tuple(
			request.sourcePositionSceneUnits,
			'sourcePositionSceneUnits',
		);
		const observerScenePositionUnits = request.observerScenePositionUnits
			? vector3Tuple(request.observerScenePositionUnits, 'observerScenePositionUnits')
			: Object.freeze([0, 0, 0]);
		const lightingFacts = this._resolveEndpointLightingFacts(request);
		const {
			metadata,
			observerIncidentScale,
			calibrationScalar,
			ambientIntensityRange,
			ambientLightPercent,
			endpointSceneLightScalePolicy,
			endpointSceneIncidentScale,
			ambientIntensity,
		} = lightingFacts;
		const pointLightIntensity = calibrationScalar * endpointSceneIncidentScale;
		const endpointIndirectFill = endpointIndirectFillRequestOrNull(request.endpointIndirectFill);
		const endpointIndirectFillIntensity = endpointIndirectFill
			? pointLightIntensity * endpointIndirectFill.intensityRatio
			: 0;
		const ambient = this._createThreeAmbientLight({
			THREE,
			resolvedAmbientIntensity: ambientIntensity
				+ (endpointIndirectFill?.policy === 'general-ambient-fill' ? endpointIndirectFillIntensity : 0),
		});
		const directionToSourceScene = directionBetweenScenePoints(
			observerScenePositionUnits,
			sourcePositionSceneUnits,
		);
		const shadowObjects = shadowObjectRequests(request.shadow);
		const sceneObjects = [];
		const sourceDrivenLights = shadowObjects.length > 0
			? shadowObjects.map((shadowObject, index) => createShadowDirectionalLight({
				THREE,
				sourceKey: this._configuration.sourceKey,
				intensity: pointLightIntensity / shadowObjects.length,
				sourcePositionSceneUnits,
				shadowObject,
				objectIndex: index,
				sceneObjects,
			}))
			: createSourcePointLight({
				THREE,
				sourceKey: this._configuration.sourceKey,
				intensity: pointLightIntensity,
				sourcePositionSceneUnits,
				observerIncidentScale,
				endpointSceneIncidentScale,
				calibrationScalar,
				endpointSceneLightScalePolicy,
			});
		const endpointDirectionalFillLight = endpointIndirectFill?.policy === 'opposite-directional-fill'
			? createOppositeDirectionalFillLight({
				THREE,
				sourceKey: this._configuration.sourceKey,
				intensity: endpointIndirectFillIntensity,
				directionToSourceScene,
				focusSceneUnits: observerScenePositionUnits,
				distanceSceneUnits: endpointIndirectFill.distanceSceneUnits,
				sceneObjects,
			})
			: null;
		const endpointSourceFalloffFillLight = endpointIndirectFill?.policy === 'source-direction-falloff-fill'
			? createSourceDirectionFalloffFillLight({
				THREE,
				sourceKey: this._configuration.sourceKey,
				targetIntensity: endpointIndirectFillIntensity,
				directionToSourceScene,
				focusSceneUnits: observerScenePositionUnits,
				distanceSceneUnits: endpointIndirectFill.distanceSceneUnits,
				sceneObjects,
			})
			: null;

		const result = Object.freeze({
			lights: Object.freeze([
				ambient,
				...(Array.isArray(sourceDrivenLights) ? sourceDrivenLights : [sourceDrivenLights]),
				...(endpointDirectionalFillLight ? [endpointDirectionalFillLight] : []),
				...(endpointSourceFalloffFillLight ? [endpointSourceFalloffFillLight] : []),
			]),
			sceneObjects: Object.freeze(sceneObjects),
			metadata: Object.freeze({
				owner: 'LocalSunLightSource',
				lightingPolicy: shadowObjects.length > 0
					? 'source-driven-flat-local-directional-shadow-light'
					: 'source-driven-flat-local-point-light',
				endpointColorStatus:
					request.endpointColorStatus ?? 'three-lambert-shading-captured-from-effect-composer-render-pass',
				ambientIntensityRange,
				ambientLightPercent,
				observerScaledAmbientIntensity: ambientIntensity,
				ambientIntensity: ambient.intensity,
				pointLightIntensity,
				endpointIndirectFill: endpointIndirectFill
					? Object.freeze({
						...endpointIndirectFill,
						intensity: endpointIndirectFillIntensity,
						role: endpointIndirectFillRole(endpointIndirectFill.policy),
						directionToFillScene: endpointIndirectFillDirection(endpointIndirectFill.policy, directionToSourceScene),
					})
					: Object.freeze({
						enabled: false,
						policy: 'none',
					}),
				calibrationScalar,
				observerIncidentScale,
				endpointSceneIncidentScale,
				endpointSceneLightScalePolicy,
				falloffScale: metadata.falloffScale,
				distanceFromSourceMeters: metadata.distanceFromSourceMeters,
				safeDistanceMeters: metadata.safeDistanceMeters,
				referenceDistanceMeters: metadata.referenceDistanceMeters,
				referenceSpectralIncidentScale: metadata.referenceSpectralIncidentScale,
				distanceAttenuationPolicy: shadowObjects.length > 0
					? distanceAttenuationPolicyForDirectionalShadow(endpointSceneLightScalePolicy)
					: distanceAttenuationPolicyForPointLight(endpointSceneLightScalePolicy),
				shadowPolicy: shadowObjects.length > 0 ? 'three-shadow-map-from-local-source-direction' : 'shadows-disabled',
				shadow: shadowObjects.length > 0 ? Object.freeze({ ...shadowObjects[0] }) : null,
				shadowObjects: Object.freeze(shadowObjects.map((shadowObject) => Object.freeze({ ...shadowObject }))),
				shadowDirectionPolicy: shadowObjects.length > 0
					? 'per-shadow-focus-to-local-source-position'
					: 'none',
				directionToSourceScene,
				directionToSourceModel: lightingFacts.directLighting.directionToLight,
				sourcePositionSceneUnits,
				observerScenePositionUnits,
				sourceKey: this._configuration.sourceKey,
			}),
		});

		addLightingObjectsToScene(request.scene, result);

		return result;
	}

	/**
	 * Create the source-owned ambient fill light for endpoint scene rendering.
	 *
	 * @param {object} request - Supplies Three and source-relative lighting facts.
	 * @returns {unknown} The created Three AmbientLight.
	 */
	_createThreeAmbientLight(request = {}) {
		const THREE = request.THREE;

		if (!THREE || typeof THREE.AmbientLight !== 'function') {
			throw new TypeError('LocalSunLightSource.addSceneLighting requires THREE.AmbientLight.');
		}

		const ambientIntensityValue = Number.isFinite(request.resolvedAmbientIntensity)
			? request.resolvedAmbientIntensity
			: this._resolveEndpointLightingFacts(request).ambientIntensity;
		const ambientIntensity = Math.max(0, finiteNumberOrDefault(ambientIntensityValue, 0));
		const ambient = new THREE.AmbientLight(0xffffff, ambientIntensity);

		ambient.name = `${this._configuration.sourceKey}-ambient-fill`;
		ambient.userData.algorithm32SourceLight = true;
		ambient.userData.sourceKey = this._configuration.sourceKey;
		ambient.userData.lightingRole = 'ambient-fill';

		return ambient;
	}

	_resolveEndpointLightingFacts(request = {}) {
		const directLighting = this.sampleDirectLighting({
			sourceRelativePosition: request.sourceRelativePosition,
		});
		const metadata = directLighting.metadata && typeof directLighting.metadata === 'object'
			? directLighting.metadata
			: {};
		const observerIncidentScale = finiteNumberOrDefault(metadata.incidentScale, 1);
		const calibrationScalar = finiteNumberOrDefault(request.calibrationScalar, 2.4);
		const sceneLightPercent = this.resolveSceneLightPercent(request);
		const ambientLightPercent = sceneLightPercent.ambientLightPercent;
		const endpointSceneLightScalePolicy = endpointSceneLightScalePolicyOrDefault(
			request.endpointSceneLightScalePolicy,
		);
		const endpointSceneIncidentScale = endpointSceneLightScalePolicy === 'observer-incident-scale'
			? observerIncidentScale
			: 1;
		const ambientIntensityRange = sceneAmbientIntensityRangeOrDefault(
			request.ambientIntensityRange,
			DEFAULT_SCENE_AMBIENT_INTENSITY_RANGE.min,
			finiteNumberOrDefault(request.ambientIntensity, DEFAULT_SCENE_AMBIENT_INTENSITY_RANGE.max),
		);
		const ambientIntensity = scaleRange(ambientIntensityRange, ambientLightPercent);

		return Object.freeze({
			directLighting,
			metadata,
			observerIncidentScale,
			calibrationScalar,
			ambientIntensityRange,
			ambientLightPercent,
			endpointSceneLightScalePolicy,
			endpointSceneIncidentScale,
			ambientIntensity,
		});
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
			owner: 'LocalSunLightSource',
			sourceKey: this._configuration.sourceKey,
			shadowPolicy: 'three-shadow-map-from-local-source-direction',
		}, request);
	}

	/**
	 * Resolve the finite source path limit for one sample.
	 *
	 * @param {object} [request] - Supplies source-relative sample facts.
	 * @returns {SourcePathLimit} The source path limit.
	 */
	resolveSourcePathLimit(request = {}) {
		const distance = request.sourceRelativePosition?.distanceFromSourceMeters;

		return Object.freeze({
			maxDistanceMeters: Number.isFinite(distance) ? Math.max(0, distance) : null,
			reason: 'finite-local-source-distance',
		});
	}

	/**
	 * Create the light-source-owned local sun shader contribution.
	 *
	 * @param {ShaderContributionRequest} request - Supplies the active shader descriptor.
	 * @returns {ShaderContribution} Return the light-source shader contribution.
	 */
	createShaderContribution(request) {
		return this._createShaderContribution(request?.descriptor);
	}

	/**
	 * Create the light-source-owned local sun shader contribution.
	 *
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
	 * @returns {ShaderContribution} Return the light-source contribution.
	 */
	_createShaderContribution(descriptor) {
		const facts = resolveLocalLightFacts(descriptor);
		const falloffExpression = facts.distanceFalloff
			? 'pow(LOCAL_LIGHT_REFERENCE_DISTANCE_METERS / safeDistanceMeters, 2.0)'
			: '1.0';

		return shaderContribution({
			id: 'light-local-sun',
			owner: 'lightSource',
			descriptorFingerprint: descriptor.lightSource.fingerprint,
			compatibilityTags: descriptor.lightSource.compatibilityTags,
			provides: Object.freeze(['light.sampleDirectRadiance', 'light.sourceDirection']),
			requires: Object.freeze(['atmosphere.sourcePathTransmittance']),
			functions: Object.freeze([
				shaderBlock('light-source-constants', 'declareConstants', 0, `const vec3 LOCAL_LIGHT_SOURCE_POSITION_METERS = ${formatVec3(facts.sourcePositionMeters)};
const float LOCAL_LIGHT_REFERENCE_DISTANCE_METERS = ${formatFloat(facts.referenceDistanceMeters)};
const float LOCAL_LIGHT_REFERENCE_SPECTRAL_INCIDENT_SCALE = ${formatFloat(facts.referenceSpectralIncidentScale)};
const float LOCAL_LIGHT_RADIUS_METERS = ${formatFloat(facts.radiusMeters)};
const float LIGHT_SOURCE_SOLAR_IRRADIANCE[${SPECTRAL_CHANNEL_COUNT}] = float[${SPECTRAL_CHANNEL_COUNT}](${formatFloatArray(CANONICAL_SPECTRAL_CHANNELS.map((channel) => channel.solarIrradiance))});`),
				shaderBlock('light-source-helper', 'sampleLightSource', 0, `vec3 directionToLight(vec3 positionMeters) {
	return normalize(LOCAL_LIGHT_SOURCE_POSITION_METERS - positionMeters);
}

SpectralValue sampleDirectRadiance(vec3 positionMeters) {
	vec3 direction = directionToLight(positionMeters);
	float distanceMeters = length(LOCAL_LIGHT_SOURCE_POSITION_METERS - positionMeters);
	float safeDistanceMeters = max(LOCAL_LIGHT_RADIUS_METERS, max(distanceMeters, 0.0));
	float falloffScale = ${falloffExpression};
	float incidentScale = LOCAL_LIGHT_REFERENCE_SPECTRAL_INCIDENT_SCALE * falloffScale;
	SpectralValue sourceTransmittance = sourcePathTransmittance(positionMeters, direction);
	SpectralValue radiance;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		radiance.c[channelIndex] = LIGHT_SOURCE_SOLAR_IRRADIANCE[channelIndex]
			* incidentScale
			* sourceTransmittance.c[channelIndex];
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
 * Create a production spectral basis from source spectral channels.
 *
 * @param {readonly SpectralChannelConstant[]} spectralChannels - Supplies
 * spectral channels.
 * @returns {SpectralBasis} The production spectral basis.
 */
function createSpectralBasisFromChannels(spectralChannels) {
	return Object.freeze({
		wavelengths: Object.freeze(spectralChannels.map((channel) => {
			WavelengthMath.assertWavelength(channel?.wavelength, 'spectral channel wavelength');

			return Object.freeze({
				value: channel.wavelength.value,
				units: channel.wavelength.units,
			});
		})),
	});
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
 * Assert local source spectral channels.
 *
 * @param {unknown} spectralChannels - Supplies candidate channels.
 * @returns {void}
 */
function assertSpectralChannels(spectralChannels) {
	if (!Array.isArray(spectralChannels) || spectralChannels.length < 1) {
		throw new TypeError('LocalSunLightSource requires spectral channels.');
	}

	for (const channel of spectralChannels) {
		if (!Number.isFinite(channel?.solarIrradiance)) {
			throw new TypeError('LocalSunLightSource spectral channels require finite solarIrradiance values.');
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
 * Normalize the endpoint scene-light scale policy.
 *
 * @param {unknown} value - Supplies candidate policy.
 * @returns {"endpoint-material-shading" | "observer-incident-scale"} Resolved policy.
 */
function endpointSceneLightScalePolicyOrDefault(value) {
	return value === 'observer-incident-scale'
		? 'observer-incident-scale'
		: 'endpoint-material-shading';
}

/**
 * Describe the directional shadow attenuation policy.
 *
 * @param {string} endpointSceneLightScalePolicy - Supplies endpoint policy.
 * @returns {string} Policy explanation.
 */
function distanceAttenuationPolicyForDirectionalShadow(endpointSceneLightScalePolicy) {
	return endpointSceneLightScalePolicy === 'observer-incident-scale'
		? 'Directional shadow light uses the local source direction and observer incident scale for endpoint scene shading/shadows; Algorithm32 transport also applies finite source scale.'
		: 'Directional shadow light uses the local source direction for endpoint material shading/shadows; Algorithm32 transport applies finite source scale.';
}

/**
 * Describe the point-light attenuation policy.
 *
 * @param {string} endpointSceneLightScalePolicy - Supplies endpoint policy.
 * @returns {string} Policy explanation.
 */
function distanceAttenuationPolicyForPointLight(endpointSceneLightScalePolicy) {
	return endpointSceneLightScalePolicy === 'observer-incident-scale'
		? 'PointLight uses decay=0 and observer incident scale for endpoint scene shading; Algorithm32 transport also applies finite source scale.'
		: 'PointLight uses decay=0 and transport-neutral endpoint material shading intensity; Algorithm32 transport applies finite source scale.';
}

/**
 * Create a local-source point light.
 *
 * @param {object} request - Supplies light construction facts.
 * @returns {unknown} The created Three point light.
 */
function createSourcePointLight({
	THREE,
	sourceKey,
	intensity,
	sourcePositionSceneUnits,
	observerIncidentScale,
	endpointSceneIncidentScale,
	calibrationScalar,
	endpointSceneLightScalePolicy,
}) {
	const pointLight = new THREE.PointLight(0xffffff, intensity, 0, 0);

	pointLight.name = `${sourceKey}-source-driven-point-light`;
	pointLight.position.set(...sourcePositionSceneUnits);
	pointLight.userData.algorithm32SourceLight = true;
	pointLight.userData.sourceKey = sourceKey;
	pointLight.userData.observerIncidentScale = observerIncidentScale;
	pointLight.userData.endpointSceneIncidentScale = endpointSceneIncidentScale;
	pointLight.userData.endpointSceneLightScalePolicy = endpointSceneLightScalePolicy;
	pointLight.userData.calibrationScalar = calibrationScalar;
	pointLight.userData.distanceAttenuationPolicy =
		distanceAttenuationPolicyForPointLight(endpointSceneLightScalePolicy);

	return pointLight;
}

/**
 * Create a directional shadow light from the shadow focus toward the local source.
 *
 * @param {object} request - Supplies light construction facts.
 * @returns {unknown} The created Three directional light.
 */
function createShadowDirectionalLight({
	THREE,
	sourceKey,
	intensity,
	sourcePositionSceneUnits,
	shadowObject,
	objectIndex = 0,
	sceneObjects,
}) {
	const light = new THREE.DirectionalLight(0xffffff, intensity);
	const target = new THREE.Object3D();
	const focus = shadowObject.focusSceneUnits;
	const distance = shadowObject.lightDistanceSceneUnits;
	const directionToSourceScene = directionBetweenScenePoints(focus, sourcePositionSceneUnits);

	light.name = `${sourceKey}-source-driven-shadow-directional-light-${objectIndex}`;
	light.position.set(
		focus[0] + directionToSourceScene[0] * distance,
		focus[1] + directionToSourceScene[1] * distance,
		focus[2] + directionToSourceScene[2] * distance,
	);
	target.name = `${sourceKey}-source-driven-shadow-target-${objectIndex}`;
	target.position.set(...focus);
	light.target = target;
	light.castShadow = true;

	if (light.shadow) {
		if (light.shadow.mapSize) {
			light.shadow.mapSize.width = shadowObject.mapSize;
			light.shadow.mapSize.height = shadowObject.mapSize;
		}
		if (light.shadow.camera) {
			light.shadow.camera.left = shadowObject.cameraLeft;
			light.shadow.camera.right = shadowObject.cameraRight;
			light.shadow.camera.top = shadowObject.cameraTop;
			light.shadow.camera.bottom = shadowObject.cameraBottom;
			light.shadow.camera.near = shadowObject.cameraNear;
			light.shadow.camera.far = shadowObject.cameraFar;
			applyLayerIndex(light.shadow.camera, shadowObject.layerIndex);
			light.shadow.camera.updateProjectionMatrix?.();
		}
		light.shadow.bias = shadowObject.bias;
		light.shadow.normalBias = shadowObject.normalBias;
		light.shadow.radius = shadowObject.radius;
		light.shadow.intensity = shadowObject.shadowIntensity;
	}

	light.userData.algorithm32SourceLight = true;
	light.userData.sourceKey = sourceKey;
	light.userData.shadowPolicy = 'three-shadow-map-from-local-source-direction';
	light.userData.shadowObjectKey = shadowObject.objectKey;
	light.userData.shadowLayerIndex = shadowObject.layerIndex;
	light.userData.directionToSourceScene = directionToSourceScene;
	light.userData.shadowFocusSceneUnits = focus;
	light.userData.sourcePositionSceneUnits = sourcePositionSceneUnits;
	target.userData.algorithm32SourceLight = true;
	target.userData.sourceKey = sourceKey;
	target.userData.shadowPolicy = 'three-shadow-map-target';
	target.userData.shadowObjectKey = shadowObject.objectKey;
	target.userData.shadowLayerIndex = shadowObject.layerIndex;
	sceneObjects.push(target);

	return light;
}

/**
 * Create an opposite-direction endpoint fill light.
 *
 * @param {object} request - Supplies light construction facts.
 * @returns {unknown} The created Three directional light.
 */
function createOppositeDirectionalFillLight({
	THREE,
	sourceKey,
	intensity,
	directionToSourceScene,
	focusSceneUnits,
	distanceSceneUnits,
	sceneObjects,
}) {
	const fillDirection = oppositeDirectionalFillDirection(directionToSourceScene);
	const light = new THREE.DirectionalLight(0xffffff, intensity);
	const target = new THREE.Object3D();

	light.name = `${sourceKey}-opposite-directional-endpoint-fill`;
	light.position.set(
		focusSceneUnits[0] + fillDirection[0] * distanceSceneUnits,
		focusSceneUnits[1] + fillDirection[1] * distanceSceneUnits,
		focusSceneUnits[2] + fillDirection[2] * distanceSceneUnits,
	);
	target.name = `${sourceKey}-opposite-directional-endpoint-fill-target`;
	target.position.set(...focusSceneUnits);
	light.target = target;
	light.castShadow = false;
	light.userData.algorithm32SourceLight = true;
	light.userData.sourceKey = sourceKey;
	light.userData.lightingRole = 'opposite-directional-endpoint-fill';
	light.userData.endpointColorStatus = 'vacuum-endpoint-directional-fill-approximation';
	target.userData.algorithm32SourceLight = true;
	target.userData.sourceKey = sourceKey;
	target.userData.lightingRole = 'opposite-directional-endpoint-fill-target';
	sceneObjects.push(target);

	return light;
}

/**
 * Create a source-direction falloff endpoint fill light.
 *
 * @param {object} request - Supplies light construction facts.
 * @returns {unknown} The created Three point light.
 */
function createSourceDirectionFalloffFillLight({
	THREE,
	sourceKey,
	targetIntensity,
	directionToSourceScene,
	focusSceneUnits,
	distanceSceneUnits,
	sceneObjects,
}) {
	const fillDirection = normalizeDirection([
		directionToSourceScene[0],
		Math.abs(directionToSourceScene[1]),
		directionToSourceScene[2],
	], 'source-direction falloff fill direction');
	const lightDistanceSceneUnits = Math.max(1, distanceSceneUnits);
	const calibratedIntensity = targetIntensity * lightDistanceSceneUnits * lightDistanceSceneUnits;
	const light = new THREE.PointLight(0xffffff, calibratedIntensity, 0, 2);
	const marker = new THREE.Object3D();

	light.name = `${sourceKey}-source-direction-falloff-endpoint-fill`;
	light.position.set(
		focusSceneUnits[0] + fillDirection[0] * lightDistanceSceneUnits,
		focusSceneUnits[1] + fillDirection[1] * lightDistanceSceneUnits,
		focusSceneUnits[2] + fillDirection[2] * lightDistanceSceneUnits,
	);
	light.castShadow = false;
	light.userData.algorithm32SourceLight = true;
	light.userData.sourceKey = sourceKey;
	light.userData.lightingRole = 'source-direction-falloff-endpoint-fill';
	light.userData.endpointColorStatus = 'vacuum-endpoint-source-direction-falloff-fill-approximation';
	light.userData.targetIntensityAtFocus = targetIntensity;
	light.userData.distanceSceneUnits = lightDistanceSceneUnits;
	light.userData.decay = 2;
	marker.name = `${sourceKey}-source-direction-falloff-endpoint-fill-anchor`;
	marker.position.set(...focusSceneUnits);
	marker.userData.algorithm32SourceLight = true;
	marker.userData.sourceKey = sourceKey;
	marker.userData.lightingRole = 'source-direction-falloff-endpoint-fill-anchor';
	sceneObjects.push(marker);

	return light;
}

/**
 * Normalize optional shadow object requests.
 *
 * @param {LightSourceThreeShadowRequest | undefined} shadow - Supplies candidate shadow config.
 * @returns {readonly object[]} Normalized shadow object configs.
 */
function shadowObjectRequests(shadow) {
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
	}, defaultShadowIntensity)));
}

/**
 * Normalize one shadow object request.
 *
 * @param {LightSourceThreeShadowRequest} shadow - Supplies candidate shadow config.
 * @param {number} defaultShadowIntensity - Supplies default split-light shadow opacity.
 * @returns {object} Normalized shadow config.
 */
function normalizeShadowObjectRequest(shadow, defaultShadowIntensity = 1) {
	const focusSceneUnits = vector3Tuple(shadow.focusSceneUnits ?? [0, 0, 0], 'shadow.focusSceneUnits');
	const extentSceneUnits = Math.max(0.001, finiteNumberOrDefault(shadow.extentSceneUnits, 20));
	const lightDistanceSceneUnits = Math.max(
		extentSceneUnits * 2,
		finiteNumberOrDefault(shadow.lightDistanceSceneUnits, extentSceneUnits * 4),
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
		enabled: true,
		focusSceneUnits,
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
 * Normalize optional endpoint indirect-fill request.
 *
 * @param {LightSourceThreeEndpointIndirectFillRequest | undefined} endpointIndirectFill - Supplies candidate fill config.
 * @returns {object | null} Normalized fill config.
 */
function endpointIndirectFillRequestOrNull(endpointIndirectFill) {
	if (!endpointIndirectFill || endpointIndirectFill.enabled !== true) {
		return null;
	}

	const intensityRatio = Math.max(
		0,
		finiteNumberOrDefault(endpointIndirectFill.intensityRatio, 0.25),
	);

	return Object.freeze({
		enabled: true,
		policy: endpointIndirectFillPolicyOrDefault(endpointIndirectFill.policy),
		intensityRatio,
		distanceSceneUnits: Math.max(
			1,
			finiteNumberOrDefault(endpointIndirectFill.distanceSceneUnits, 100),
		),
	});
}

/**
 * Normalize endpoint indirect-fill policy.
 *
 * @param {unknown} policy - Supplies candidate policy.
 * @returns {string} Resolved policy.
 */
function endpointIndirectFillPolicyOrDefault(policy) {
	if (policy === 'opposite-directional-fill') {
		return 'opposite-directional-fill';
	}
	if (policy === 'source-direction-falloff-fill') {
		return 'source-direction-falloff-fill';
	}
	return 'general-ambient-fill';
}

/**
 * Resolve endpoint indirect-fill metadata role.
 *
 * @param {string} policy - Supplies fill policy.
 * @returns {string} Metadata role.
 */
function endpointIndirectFillRole(policy) {
	if (policy === 'opposite-directional-fill') {
		return 'vacuum-endpoint-opposite-directional-approximation';
	}
	if (policy === 'source-direction-falloff-fill') {
		return 'vacuum-endpoint-source-direction-falloff-approximation';
	}
	return 'vacuum-endpoint-general-ambient-approximation';
}

/**
 * Resolve endpoint indirect-fill direction metadata.
 *
 * @param {string} policy - Supplies fill policy.
 * @param {UnitVector3} directionToSourceScene - Supplies scene source direction.
 * @returns {UnitVector3 | null} Fill direction metadata.
 */
function endpointIndirectFillDirection(policy, directionToSourceScene) {
	if (policy === 'opposite-directional-fill') {
		return oppositeDirectionalFillDirection(directionToSourceScene);
	}
	if (policy === 'source-direction-falloff-fill') {
		return normalizeDirection([
			directionToSourceScene[0],
			Math.abs(directionToSourceScene[1]),
			directionToSourceScene[2],
		], 'source-direction falloff fill direction');
	}
	return null;
}

/**
 * Resolve the opposite fill direction.
 *
 * @param {UnitVector3} directionToSourceScene - Supplies scene source direction.
 * @returns {UnitVector3} Fill direction.
 */
function oppositeDirectionalFillDirection(directionToSourceScene) {
	const horizontalOpposite = [
		-directionToSourceScene[0],
		Math.abs(directionToSourceScene[1]),
		-directionToSourceScene[2],
	];

	return normalizeDirection(horizontalOpposite, 'opposite directional fill direction');
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

	throw new TypeError(`LocalSunLightSource.addSceneLighting requires finite ${label}.`);
}

/**
 * Resolve the direction between two scene points.
 *
 * @param {readonly number[]} from - Supplies start point.
 * @param {readonly number[]} to - Supplies end point.
 * @returns {UnitVector3} Direction from start to end.
 */
function directionBetweenScenePoints(from, to) {
	const delta = [
		to[0] - from[0],
		to[1] - from[1],
		to[2] - from[2],
	];

	return normalizeDirection(delta, 'source direction in scene space');
}

/**
 * Check for a finite numeric array.
 *
 * @param {unknown} values - Supplies candidate values.
 * @returns {boolean} True when all values are finite numbers.
 */
function isFiniteNumberArray(values) {
	return Array.isArray(values) && values.length > 0 && values.every(Number.isFinite);
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
 * Normalize local source descriptor facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {object} Return normalized light facts.
 */
function resolveLocalLightFacts(descriptor) {
	const lightFacts = descriptor?.lightSource?.facts ?? {};
	const geometryFacts = descriptor?.geometry?.facts ?? {};
	const facts = {
		...lightFacts,
		sourcePositionMeters: lightFacts.sourcePositionMeters ?? geometryFacts.sourcePositionMeters,
	};

	if (!descriptor?.lightSource) {
		throw new TypeError('LocalSunLightSource shader contribution requires a light-source descriptor.');
	}

	for (const field of ['referenceDistanceMeters', 'referenceSpectralIncidentScale', 'radiusMeters']) {
		if (!Number.isFinite(facts[field])) {
			throw new TypeError(`LocalSunLightSource shader contribution requires ${field}.`);
		}
	}

	if (!Array.isArray(facts.sourcePositionMeters) || facts.sourcePositionMeters.length !== 3) {
		throw new TypeError('LocalSunLightSource shader contribution requires sourcePositionMeters.');
	}

	return facts;
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
 * Format a GLSL vec3.
 *
 * @param {readonly number[]} values - Supplies vector values.
 * @returns {string} Return formatted vector source.
 */
function formatVec3(values) {
	return `vec3(${formatFloatArray(values)})`;
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

export default LocalSunLightSource;
