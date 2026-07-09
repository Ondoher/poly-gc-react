import TextureBuilder from '../shader/TextureBuilder.js';
import {
	CANONICAL_SPECTRAL_CHANNELS,
	RUNTIME_NUMERICAL_CONTROLS,
} from '../constants/Algorithm32CanonicalData.js';

const SPECTRAL_CHANNEL_COUNT = CANONICAL_SPECTRAL_CHANNELS.length;
const SPECTRAL_GROUP_SIZE = 4;
const SPECTRAL_GROUP_COUNT = Math.ceil(SPECTRAL_CHANNEL_COUNT / SPECTRAL_GROUP_SIZE);
const IDENTITY_MATRIX4 = Object.freeze([
	1, 0, 0, 0,
	0, 1, 0, 0,
	0, 0, 1, 0,
	0, 0, 0, 1,
]);
const DEFAULT_FRAME = Object.freeze({
	up: Object.freeze([0, 0, 1]),
	right: Object.freeze([1, 0, 0]),
	forward: Object.freeze([0, -1, 0]),
});
const MAIN_SYMBOLS = Object.freeze([
	'runtime.initialState',
	'geometry.reconstructViewRay',
	'geometry.resolveAtmospherePath',
	'atmosphere.sampleMedium',
	'light.sampleDirectRadiance',
	'cache.lookupIncidentRadiance',
	'transport.evaluatePathRadiance',
	'color.composeSceneColor',
	'color.encodeOutput',
]);

/**
 * Build the POC-backed local flat shader contribution set.
 */
export class LocalFlatShaderContributionFactory {
	/**
	 * Create the shader contribution factory.
	 *
	 * @param {{ readonly textureBuilder?: TextureBuilder }} [configuration] - Supplies optional collaborators.
	 */
	constructor(configuration = {}) {
		this._textureBuilder = configuration.textureBuilder ?? new TextureBuilder();
	}

	/**
	 * Return symbols needed by the complete local flat shader main path.
	 *
	 * @returns {readonly string[]} Return required shader symbols.
	 */
	mainRequiredSymbols() {
		return MAIN_SYMBOLS;
	}

	/**
	 * Create the owner contributions for one active descriptor.
	 *
	 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active shader descriptor.
	 * @returns {readonly ShaderContribution[]} Return source/profile contributions.
	 */
	createContributions(descriptor) {
		assertDescriptor(descriptor);

		return Object.freeze([
			createFlatEarthGeometryShaderContribution(descriptor),
			createFlatCanonicalAtmosphereShaderContribution(descriptor),
			createLocalSunShaderContribution(descriptor),
			createLocalIncidentRadianceCacheShaderContribution(descriptor, this._textureBuilder),
			createLocalAlgorithm32TransportShaderContribution(descriptor),
		]);
	}
}

/**
 * Create the flat geometry shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {ShaderContribution} Return the geometry contribution.
 */
export function createFlatEarthGeometryShaderContribution(descriptor) {
	assertDescriptor(descriptor);

	return geometryContribution(descriptor);
}

/**
 * Create the canonical atmosphere shader contribution for flat geometry.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {ShaderContribution} Return the atmosphere contribution.
 */
export function createFlatCanonicalAtmosphereShaderContribution(descriptor) {
	assertDescriptor(descriptor);

	return atmosphereContribution(descriptor);
}

/**
 * Create the local sun shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {ShaderContribution} Return the light-source contribution.
 */
export function createLocalSunShaderContribution(descriptor) {
	assertDescriptor(descriptor);

	return lightContribution(descriptor);
}

/**
 * Create the local incident-radiance cache shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @param {TextureBuilder} [textureBuilder] - Supplies the texture descriptor builder.
 * @returns {ShaderContribution} Return the cache contribution.
 */
export function createLocalIncidentRadianceCacheShaderContribution(
	descriptor,
	textureBuilder = new TextureBuilder(),
) {
	assertDescriptor(descriptor);
	const cacheFacts = resolveLocalCacheFacts(descriptor);
	const cacheTexture = textureBuilder.createTexture({
		textureId: cacheFacts.textureId,
		owner: 'cache',
		dimensionality: '3d',
		dimensions: Object.freeze([
			cacheFacts.textureWidth,
			cacheFacts.textureHeight,
			cacheFacts.textureDepth,
		]),
		formatPreference: Object.freeze(['float32', 'half-float']),
		samplerPolicy: cacheFacts.samplerPolicy,
		valueKey: cacheFacts.valueKey,
		accessFunctionName: 'readLocalIncidentRadianceTexture',
	});

	return cacheContribution(descriptor, cacheTexture, cacheFacts);
}

/**
 * Create the local flat Algorithm32 transport shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {ShaderContribution} Return the transport contribution.
 */
export function createLocalAlgorithm32TransportShaderContribution(descriptor) {
	assertDescriptor(descriptor);

	return transportContribution(descriptor);
}

/**
 * Create the flat geometry shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {ShaderContribution} Return the geometry contribution.
 */
function geometryContribution(descriptor) {
	const facts = resolveFlatGeometryFacts(descriptor);
	const frame = facts.observerLocalSceneFrame ?? DEFAULT_FRAME;
	const dome = facts.observerCenteredDome;
	const domeEnabled = Boolean(dome);
	const domeCenterMeters = domeEnabled ? dome.sphereCenterMeters : [0, 0, 0];
	const domeRadiusMeters = domeEnabled ? dome.sphereRadiusMeters : 0;

	return contribution({
		id: 'geometry-flat-earth',
		owner: 'geometry',
		descriptorFingerprint: descriptor.geometry.fingerprint,
		compatibilityTags: descriptor.geometry.compatibilityTags,
		provides: Object.freeze([
			'geometry.reconstructViewRay',
			'geometry.resolveAtmospherePath',
			'geometry.cacheAccessCoordinate',
		]),
		requires: Object.freeze(['runtime.initialState', 'runtime.depthTexture', 'runtime.sceneHitTexture']),
		uniforms: Object.freeze([
			uniform('uInverseProjectionMatrix', 'mat4', 'geometry.inverseProjectionMatrix', IDENTITY_MATRIX4),
			uniform('uInverseViewMatrix', 'mat4', 'geometry.inverseViewMatrix', IDENTITY_MATRIX4),
			uniform('uCameraWorldPositionMeters', 'vec3', 'geometry.cameraWorldPositionMeters', facts.observerPositionMeters ?? [0, 0, 2]),
			uniform('uSceneTerminationMeters', 'float', 'geometry.sceneTerminationMeters', 0),
			uniform('uSceneDepthMaxMeters', 'float', 'geometry.sceneDepthMaxMeters', facts.sceneSkyRayLimitMeters ?? facts.topAltitudeMeters),
		]),
		functions: Object.freeze([
			block('geometry-constants', 'declareConstants', 0, `const float GEOMETRY_TOP_ALTITUDE_METERS = ${formatFloat(facts.topAltitudeMeters)};
const float GEOMETRY_SCENE_SKY_RAY_LIMIT_METERS = ${formatFloat(facts.sceneSkyRayLimitMeters ?? facts.topAltitudeMeters)};
const vec3 GEOMETRY_SOURCE_SUBPOINT_METERS = ${formatVec3(facts.sourceSubpointMeters ?? [facts.sourcePositionMeters[0], facts.sourcePositionMeters[1], 0])};
const vec3 GEOMETRY_OBSERVER_UP_DIRECTION = ${formatVec3(frame.up)};
const vec3 GEOMETRY_OBSERVER_RIGHT_DIRECTION = ${formatVec3(frame.right)};
const vec3 GEOMETRY_OBSERVER_FORWARD_DIRECTION = ${formatVec3(frame.forward)};
const bool GEOMETRY_OBSERVER_DOME_ENABLED = ${domeEnabled ? 'true' : 'false'};
const vec3 GEOMETRY_OBSERVER_DOME_CENTER_METERS = ${formatVec3(domeCenterMeters)};
const float GEOMETRY_OBSERVER_DOME_RADIUS_METERS = ${formatFloat(domeRadiusMeters)};`),
			block('geometry-reconstruct-helper', 'reconstructRay', 0, `ViewRay reconstructViewRay(vec2 uv) {
	vec4 clip = vec4(uv * 2.0 - 1.0, 1.0, 1.0);
	vec4 view = uInverseProjectionMatrix * clip;
	view.xyz /= max(view.w, 0.000001);
	vec3 sceneDirection = normalize((uInverseViewMatrix * vec4(normalize(view.xyz), 0.0)).xyz);
	vec3 direction = normalize(
		GEOMETRY_OBSERVER_RIGHT_DIRECTION * sceneDirection.x
		+ GEOMETRY_OBSERVER_UP_DIRECTION * sceneDirection.y
		+ GEOMETRY_OBSERVER_FORWARD_DIRECTION * sceneDirection.z
	);
	return ViewRay(uCameraWorldPositionMeters, direction);
}`),
			block('geometry-depth-helper', 'resolvePathBounds', 0, `float sceneTerminationMetersFromDepth(float sceneDepth) {
	float decodedTerminationMeters = max(sceneDepth * uSceneDepthMaxMeters, 0.0);
	return uSceneTerminationMeters > 0.0 ? uSceneTerminationMeters : decodedTerminationMeters;
}

float positiveBoundaryDistance(float distanceMeters) {
	return max(distanceMeters, 0.0);
}

bool observerDomeBoundaryDistance(vec3 originMeters, vec3 direction, out float distanceMeters) {
	if (!GEOMETRY_OBSERVER_DOME_ENABLED) {
		distanceMeters = 0.0;
		return false;
	}

	vec3 offsetFromCenter = originMeters - GEOMETRY_OBSERVER_DOME_CENTER_METERS;
	float b = dot(offsetFromCenter, direction);
	float c = dot(offsetFromCenter, offsetFromCenter)
		- GEOMETRY_OBSERVER_DOME_RADIUS_METERS * GEOMETRY_OBSERVER_DOME_RADIUS_METERS;
	float discriminant = b * b - c;

	if (discriminant < -0.000001) {
		distanceMeters = 0.0;
		return false;
	}

	float root = sqrt(max(discriminant, 0.0));
	float nearDistance = -b - root;
	float farDistance = -b + root;

	if (c <= 0.000001 && farDistance >= -0.000001) {
		distanceMeters = positiveBoundaryDistance(farDistance);
		return true;
	}
	if (nearDistance >= -0.000001) {
		distanceMeters = positiveBoundaryDistance(nearDistance);
		return true;
	}
	if (farDistance >= -0.000001) {
		distanceMeters = positiveBoundaryDistance(farDistance);
		return true;
	}

	distanceMeters = 0.0;
	return false;
}

void chooseNearestBoundary(float candidateDistanceMeters, bool hasCandidate, inout float selectedDistanceMeters, inout bool hasSelected) {
	if (hasCandidate && (!hasSelected || candidateDistanceMeters < selectedDistanceMeters)) {
		selectedDistanceMeters = candidateDistanceMeters;
		hasSelected = true;
	}
}`),
			block('geometry-path-helper', 'resolvePathBounds', 0, `PathBounds resolveAtmospherePath(ViewRay ray, float sceneTerminationMeters, bool hasSceneEndpoint) {
	bool hasTopBoundary = ray.direction.z > 0.000001;
	bool hasGroundBoundary = ray.direction.z < -0.000001;
	float topDistanceMeters = hasTopBoundary
		? positiveBoundaryDistance((GEOMETRY_TOP_ALTITUDE_METERS - ray.originMeters.z) / ray.direction.z)
		: 0.0;
	float groundDistanceMeters = hasGroundBoundary
		? positiveBoundaryDistance((0.0 - ray.originMeters.z) / ray.direction.z)
		: 0.0;
	float domeDistanceMeters = 0.0;
	bool hasDomeBoundary = observerDomeBoundaryDistance(ray.originMeters, ray.direction, domeDistanceMeters);
	bool hasAtmosphereBoundary = false;
	float boundaryDistanceMeters = 0.0;
	bool usesGroundBoundary = false;

	chooseNearestBoundary(topDistanceMeters, hasTopBoundary, boundaryDistanceMeters, hasAtmosphereBoundary);
	bool groundWouldWin = hasGroundBoundary
		&& (!hasAtmosphereBoundary || groundDistanceMeters <= boundaryDistanceMeters);
	chooseNearestBoundary(groundDistanceMeters, hasGroundBoundary, boundaryDistanceMeters, hasAtmosphereBoundary);
	usesGroundBoundary = groundWouldWin;
	chooseNearestBoundary(domeDistanceMeters, hasDomeBoundary, boundaryDistanceMeters, hasAtmosphereBoundary);

	float fallbackSkyDistanceMeters = max(GEOMETRY_SCENE_SKY_RAY_LIMIT_METERS, 0.0);
	float selectedBoundaryDistanceMeters = hasAtmosphereBoundary
		? boundaryDistanceMeters
		: fallbackSkyDistanceMeters;
	float endDistanceMeters = hasSceneEndpoint
		? min(max(sceneTerminationMeters, 0.0), selectedBoundaryDistanceMeters)
		: selectedBoundaryDistanceMeters;
	bool hasGroundEndpoint = hasGroundBoundary && groundDistanceMeters <= endDistanceMeters;
	bool valid = endDistanceMeters >= 0.0;
	return PathBounds(0.0, max(0.0, endDistanceMeters), sceneTerminationMeters, hasSceneEndpoint, hasGroundEndpoint, valid);
}`),
			block('geometry-cache-coordinate', 'lookupIncidentRadiance', 0, `int nearestLocalCacheZBinIndex(vec3 positionMeters) {
	float altitudeMeters = positionMeters.z;
	int bestIndex = 0;
	float bestDelta = abs(altitudeMeters - LOCAL_CACHE_Z_BINS_METERS[0]);
	for (int binIndex = 1; binIndex < LOCAL_CACHE_Z_BIN_COUNT; binIndex += 1) {
		float candidateDelta = abs(altitudeMeters - LOCAL_CACHE_Z_BINS_METERS[binIndex]);
		if (candidateDelta < bestDelta) {
			bestDelta = candidateDelta;
			bestIndex = binIndex;
		}
	}
	return bestIndex;
}

int nearestLocalCacheRhoBinIndex(vec3 positionMeters) {
	float rhoMeters = length(positionMeters.xy - GEOMETRY_SOURCE_SUBPOINT_METERS.xy);
	int bestIndex = 0;
	float bestDelta = abs(rhoMeters - LOCAL_CACHE_RHO_BINS_METERS[0]);
	for (int binIndex = 1; binIndex < LOCAL_CACHE_RHO_BIN_COUNT; binIndex += 1) {
		float candidateDelta = abs(rhoMeters - LOCAL_CACHE_RHO_BINS_METERS[binIndex]);
		if (candidateDelta < bestDelta) {
			bestDelta = candidateDelta;
			bestIndex = binIndex;
		}
	}
	return bestIndex;
}`),
		]),
		mainHooks: Object.freeze([
			block('geometry-main-ray', 'reconstructRay', 0, 'state.ray = reconstructViewRay(state.uv);'),
			block('geometry-main-bounds', 'resolvePathBounds', 0, 'state.bounds = resolveAtmospherePath(state.ray, sceneTerminationMetersFromDepth(state.sceneDepth), state.sceneHitMask > 0.5);'),
		]),
	});
}

/**
 * Create the flat-altitude canonical atmosphere shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {ShaderContribution} Return the atmosphere contribution.
 */
function atmosphereContribution(descriptor) {
	const facts = resolveAtmosphereFacts(descriptor);

	return contribution({
		id: 'atmosphere-canonical-flat-altitude',
		owner: 'atmosphere',
		descriptorFingerprint: descriptor.atmosphere.fingerprint,
		compatibilityTags: descriptor.atmosphere.compatibilityTags,
		provides: Object.freeze(['atmosphere.sampleMedium', 'atmosphere.sourcePathTransmittance']),
		requires: Object.freeze([]),
		functions: Object.freeze([
			block('atmosphere-constants', 'declareConstants', 0, `const float ATMOSPHERE_RAYLEIGH_SCALE_HEIGHT_METERS = ${formatFloat(facts.rayleighScaleHeightMeters)};
const float ATMOSPHERE_MIE_SCALE_HEIGHT_METERS = ${formatFloat(facts.mieScaleHeightMeters)};
const float ATMOSPHERE_RAYLEIGH_COEFFICIENT_SCALE = ${formatFloat(facts.rayleighCoefficientScale)};
const float ATMOSPHERE_MIE_ANGSTROM_ALPHA = ${formatFloat(facts.mieAngstromAlpha)};
const float ATMOSPHERE_MIE_ANGSTROM_BETA = ${formatFloat(facts.mieAngstromBeta)};
const float ATMOSPHERE_MIE_SINGLE_SCATTERING_ALBEDO = ${formatFloat(facts.mieSingleScatteringAlbedo)};
const float ATMOSPHERE_MIE_PHASE_FUNCTION_G = ${formatFloat(facts.miePhaseFunctionG)};
const float ATMOSPHERE_WAVELENGTH_MICROMETERS[${SPECTRAL_CHANNEL_COUNT}] = float[${SPECTRAL_CHANNEL_COUNT}](${formatFloatArray(CANONICAL_SPECTRAL_CHANNELS.map((channel) => channel.wavelengthNanometers / 1000))});`),
			block('atmosphere-sample-medium', 'sampleAtmosphere', 0, `MediumSample sampleAtmosphere(vec3 positionMeters) {
	float altitudeMeters = clamp(positionMeters.z, 0.0, GEOMETRY_TOP_ALTITUDE_METERS);
	float rayleighDensity = exp(-altitudeMeters / ATMOSPHERE_RAYLEIGH_SCALE_HEIGHT_METERS);
	float mieDensity = exp(-altitudeMeters / ATMOSPHERE_MIE_SCALE_HEIGHT_METERS);
	MediumSample medium;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		float wavelengthMicrometers = ATMOSPHERE_WAVELENGTH_MICROMETERS[channelIndex];
		float rayleighScattering = ATMOSPHERE_RAYLEIGH_COEFFICIENT_SCALE
			* pow(wavelengthMicrometers, -4.0)
			* rayleighDensity;
		float mieExtinction = (ATMOSPHERE_MIE_ANGSTROM_BETA / ATMOSPHERE_MIE_SCALE_HEIGHT_METERS)
			* pow(wavelengthMicrometers, -ATMOSPHERE_MIE_ANGSTROM_ALPHA)
			* mieDensity;
		float mieScattering = mieExtinction * ATMOSPHERE_MIE_SINGLE_SCATTERING_ALBEDO;
		medium.rayleighScattering.c[channelIndex] = rayleighScattering;
		medium.mieScattering.c[channelIndex] = mieScattering;
		medium.scattering.c[channelIndex] = rayleighScattering + mieScattering;
		medium.extinction.c[channelIndex] = rayleighScattering + mieExtinction;
	}
	return medium;
}

SpectralValue sourcePathTransmittance(vec3 positionMeters, vec3 sourceDirection) {
	vec3 direction = normalize(sourceDirection);
	float sourceDistanceMeters = length(LOCAL_LIGHT_SOURCE_POSITION_METERS - positionMeters);

	if (direction.z < -0.000001) {
		float groundDistanceMeters = (0.0 - positionMeters.z) / direction.z;
		if (groundDistanceMeters >= 0.0 && groundDistanceMeters < sourceDistanceMeters) {
			return zeroSpectral();
		}
	}

	float endDistanceMeters = sourceDistanceMeters;
	if (direction.z > 0.000001) {
		float topDistanceMeters = (GEOMETRY_TOP_ALTITUDE_METERS - positionMeters.z) / direction.z;
		if (topDistanceMeters >= 0.0) {
			endDistanceMeters = min(endDistanceMeters, topDistanceMeters);
		}
	}
	float domeDistanceMeters = 0.0;
	if (observerDomeBoundaryDistance(positionMeters, direction, domeDistanceMeters)) {
		endDistanceMeters = min(endDistanceMeters, domeDistanceMeters);
	}

	float stepMeters = max(endDistanceMeters, 0.0) / float(SOURCE_TRANSMITTANCE_INTERVAL_COUNT);
	SpectralValue opticalDepth = zeroSpectral();

	for (int pointIndex = 0; pointIndex <= SOURCE_TRANSMITTANCE_INTERVAL_COUNT; pointIndex += 1) {
		float distanceMeters = float(pointIndex) * stepMeters;
		vec3 samplePosition = positionMeters + direction * distanceMeters;
		MediumSample medium = sampleAtmosphere(samplePosition);
		float weight = (pointIndex == 0 || pointIndex == SOURCE_TRANSMITTANCE_INTERVAL_COUNT) ? 0.5 : 1.0;
		for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
			opticalDepth.c[channelIndex] += medium.extinction.c[channelIndex] * stepMeters * weight;
		}
	}

	SpectralValue transmittance;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		transmittance.c[channelIndex] = exp(-opticalDepth.c[channelIndex]);
	}
	return transmittance;
}`),
		]),
		mainHooks: Object.freeze([
			block('atmosphere-main-sample', 'sampleAtmosphere', 0, 'state.medium = sampleAtmosphere(state.ray.originMeters + state.ray.direction * max(state.bounds.endDistanceMeters * 0.5, 0.0));'),
		]),
	});
}

/**
 * Create the local source shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {ShaderContribution} Return the light contribution.
 */
function lightContribution(descriptor) {
	const facts = resolveLocalLightFacts(descriptor);
	const falloffExpression = facts.distanceFalloff
		? 'pow(LOCAL_LIGHT_REFERENCE_DISTANCE_METERS / safeDistanceMeters, 2.0)'
		: '1.0';

	return contribution({
		id: 'light-local-sun',
		owner: 'lightSource',
		descriptorFingerprint: descriptor.lightSource.fingerprint,
		compatibilityTags: descriptor.lightSource.compatibilityTags,
		provides: Object.freeze(['light.sampleDirectRadiance', 'light.sourceDirection']),
		requires: Object.freeze(['atmosphere.sourcePathTransmittance']),
		functions: Object.freeze([
			block('light-source-constants', 'declareConstants', 0, `const vec3 LOCAL_LIGHT_SOURCE_POSITION_METERS = ${formatVec3(facts.sourcePositionMeters)};
const float LOCAL_LIGHT_REFERENCE_DISTANCE_METERS = ${formatFloat(facts.referenceDistanceMeters)};
const float LOCAL_LIGHT_REFERENCE_SPECTRAL_INCIDENT_SCALE = ${formatFloat(facts.referenceSpectralIncidentScale)};
const float LOCAL_LIGHT_RADIUS_METERS = ${formatFloat(facts.radiusMeters)};
const float LIGHT_SOURCE_SOLAR_IRRADIANCE[${SPECTRAL_CHANNEL_COUNT}] = float[${SPECTRAL_CHANNEL_COUNT}](${formatFloatArray(CANONICAL_SPECTRAL_CHANNELS.map((channel) => channel.solarIrradiance))});`),
			block('light-source-helper', 'sampleLightSource', 0, `vec3 directionToLight(vec3 positionMeters) {
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
			block('light-main-direct', 'sampleLightSource', 0, 'state.lightRadiance = sampleDirectRadiance(state.ray.originMeters + state.ray.direction * max(state.bounds.endDistanceMeters * 0.5, 0.0));'),
		]),
	});
}

/**
 * Create the local incident-cache shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @param {ShaderTextureBuildResult} cacheTexture - Supplies texture descriptor.
 * @param {object} facts - Supplies normalized cache facts.
 * @returns {ShaderContribution} Return the cache contribution.
 */
function cacheContribution(descriptor, cacheTexture, facts) {
	return contribution({
		id: 'cache-local-l2-incident-radiance',
		owner: 'cache',
		descriptorFingerprint: descriptor.cache.fingerprint,
		compatibilityTags: descriptor.cache.compatibilityTags,
		provides: Object.freeze(['cache.lookupIncidentRadiance']),
		requires: Object.freeze(['geometry.cacheAccessCoordinate']),
		textures: Object.freeze([
			texture('uIncidentRadianceCacheTexture', 'sampler3D', cacheTexture.valueKey),
		]),
		bindingRequirements: Object.freeze([
			binding('cache.localIncidentRadianceTexture', 'cache', 'texture', 'setup', cacheTexture.valueKey, true),
		]),
		functions: Object.freeze([
			block('cache-constants', 'declareConstants', 0, `const int LOCAL_CACHE_DIRECTION_COUNT = ${facts.directionCount};
const int LOCAL_CACHE_RHO_BIN_COUNT = ${facts.rhoBinCount};
const int LOCAL_CACHE_Z_BIN_COUNT = ${facts.zBinCount};
const int LOCAL_CACHE_SPECTRAL_GROUP_COUNT = ${facts.spectralGroupCount};
const float LOCAL_CACHE_INCIDENT_DIRECTION_WEIGHT = ${formatFloat(facts.directionWeight)};
const float LOCAL_CACHE_GOLDEN_RATIO = 1.6180339887498948482;
const float LOCAL_CACHE_Z_BINS_METERS[${facts.zBinCount}] = float[${facts.zBinCount}](${formatFloatArray(facts.zBinsMeters)});
const float LOCAL_CACHE_RHO_BINS_METERS[${facts.rhoBinCount}] = float[${facts.rhoBinCount}](${formatFloatArray(facts.rhoBinsMeters)});`),
			block('cache-texture-access', 'lookupIncidentRadiance', 5, `int zSpectralGroupDepthIndex(int zBinIndex, int spectralGroupIndex) {
	int clampedZBinIndex = clamp(zBinIndex, 0, LOCAL_CACHE_Z_BIN_COUNT - 1);
	int clampedSpectralGroupIndex = clamp(spectralGroupIndex, 0, LOCAL_CACHE_SPECTRAL_GROUP_COUNT - 1);
	return clampedZBinIndex * LOCAL_CACHE_SPECTRAL_GROUP_COUNT + clampedSpectralGroupIndex;
}

vec4 readLocalIncidentRadianceTexture(sampler3D sourceTexture, int zBinIndex, int rhoBinIndex, int directionIndex, int spectralGroupIndex) {
	int clampedDirectionIndex = clamp(directionIndex, 0, LOCAL_CACHE_DIRECTION_COUNT - 1);
	int clampedRhoBinIndex = clamp(rhoBinIndex, 0, LOCAL_CACHE_RHO_BIN_COUNT - 1);
	int depthIndex = zSpectralGroupDepthIndex(zBinIndex, spectralGroupIndex);
	return texelFetch(sourceTexture, ivec3(clampedDirectionIndex, clampedRhoBinIndex, depthIndex), 0);
}

float unpackLocalIncidentRadianceChannel(int zBinIndex, int rhoBinIndex, int directionIndex, int channelIndex) {
	int spectralGroupIndex = channelIndex / ${SPECTRAL_GROUP_SIZE};
	int componentIndex = channelIndex - spectralGroupIndex * ${SPECTRAL_GROUP_SIZE};
	vec4 packed = readLocalIncidentRadianceTexture(
		uIncidentRadianceCacheTexture,
		zBinIndex,
		rhoBinIndex,
		directionIndex,
		spectralGroupIndex
	);
	if (componentIndex == 0) return packed.r;
	if (componentIndex == 1) return packed.g;
	if (componentIndex == 2) return packed.b;
	return packed.a;
}`),
			block('cache-lookup-helper', 'lookupIncidentRadiance', 10, `vec3 localIncidentDirection(int directionIndex) {
	float index = float(directionIndex);
	float z = 1.0 - (2.0 * (index + 0.5)) / float(LOCAL_CACHE_DIRECTION_COUNT);
	float horizontalScale = sqrt(max(0.0, 1.0 - z * z));
	float longitude = index * 3.14159265358979323846 * (3.0 - sqrt(5.0));
	return normalize(vec3(
		horizontalScale * cos(longitude),
		horizontalScale * sin(longitude),
		z
	));
}

SpectralValue lookupIncidentRadiance(vec3 positionMeters, int directionIndex) {
	int zBinIndex = nearestLocalCacheZBinIndex(positionMeters);
	int rhoBinIndex = nearestLocalCacheRhoBinIndex(positionMeters);
	SpectralValue radiance;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		radiance.c[channelIndex] = unpackLocalIncidentRadianceChannel(
			zBinIndex,
			rhoBinIndex,
			directionIndex,
			channelIndex
		);
	}
	return radiance;
}`),
		]),
		mainHooks: Object.freeze([
			block('cache-main-lookup', 'lookupIncidentRadiance', 0, 'state.incidentRadiance = lookupIncidentRadiance(state.ray.originMeters + state.ray.direction * max(state.bounds.endDistanceMeters * 0.5, 0.0), 0);'),
		]),
		diagnostics: Object.freeze({
			texture: cacheTexture,
			depthPacking: facts.depthPacking,
			lookupPolicy: facts.lookupPolicy,
		}),
	});
}

/**
 * Create the local flat transport shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {ShaderContribution} Return the transport contribution.
 */
function transportContribution(descriptor) {
	const facts = resolveTransportFacts(descriptor);

	return contribution({
		id: 'transport-algorithm32-local-flat',
		owner: 'transport',
		descriptorFingerprint: descriptor.transport.fingerprint,
		compatibilityTags: descriptor.transport.compatibilityTags,
		provides: Object.freeze(['transport.evaluatePathRadiance']),
		requires: Object.freeze([
			'atmosphere.sampleMedium',
			'light.sampleDirectRadiance',
			'cache.lookupIncidentRadiance',
		]),
		functions: Object.freeze([
			block('transport-constants', 'declareConstants', 0, `const int TRANSPORT_PATH_INTERVAL_COUNT = ${facts.pathIntervalCount};
const int SOURCE_TRANSMITTANCE_INTERVAL_COUNT = ${facts.sourceTransmittanceIntervalCount};`),
			block('transport-evaluate-helper', 'evaluateTransport', 0, `SpectralValue directScatteringForDirection(MediumSample medium, vec3 viewDirection, vec3 incomingDirection) {
	float mu = clamp(dot(normalize(viewDirection), normalize(incomingDirection)), -1.0, 1.0);
	float rayleighPhase = 0.05968310366 * (1.0 + mu * mu);
	float mieG = ATMOSPHERE_MIE_PHASE_FUNCTION_G;
	float mieK = (3.0 / 25.1327412287) * ((1.0 - mieG * mieG) / (2.0 + mieG * mieG));
	float mieDenominator = max(1.0 + mieG * mieG - 2.0 * mieG * mu, 0.000001);
	float miePhase = (mieK * (1.0 + mu * mu)) / pow(mieDenominator, 1.5);
	SpectralValue scattering;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		scattering.c[channelIndex] = medium.rayleighScattering.c[channelIndex] * rayleighPhase
			+ medium.mieScattering.c[channelIndex] * miePhase;
	}
	return scattering;
}

SpectralValue computeTrapezoidSegmentTransmittance(MediumSample previousMedium, MediumSample currentMedium, float intervalLengthMeters) {
	SpectralValue transmittance;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		transmittance.c[channelIndex] = exp(
			-0.5
			* (previousMedium.extinction.c[channelIndex] + currentMedium.extinction.c[channelIndex])
			* intervalLengthMeters
		);
	}
	return transmittance;
}

float pathSampleDistanceForIndex(ShaderState state, int pointIndex) {
	float uniformFraction = float(pointIndex) / float(max(TRANSPORT_PATH_INTERVAL_COUNT, 1));
	return mix(
		state.bounds.startDistanceMeters,
		state.bounds.endDistanceMeters,
		clamp(uniformFraction, 0.0, 1.0)
	);
}

float pathSampleMeasureMeters(ShaderState state, int pointIndex) {
	float stepMeters = max(state.bounds.endDistanceMeters - state.bounds.startDistanceMeters, 0.0)
		/ float(max(TRANSPORT_PATH_INTERVAL_COUNT, 1));
	return ((pointIndex == 0 || pointIndex == TRANSPORT_PATH_INTERVAL_COUNT) ? 0.5 : 1.0)
		* stepMeters;
}

void evaluatePathRadiance(inout ShaderState state) {
	if (!state.bounds.valid) {
		state.pathRadiance = zeroSpectral();
		state.transmittance = oneSpectral();
		return;
	}
	SpectralValue viewTransmittance = oneSpectral();
	SpectralValue radiance = zeroSpectral();
	MediumSample previousMedium;
	bool hasPreviousMedium = false;
	float previousDistanceMeters = state.bounds.startDistanceMeters;

	for (int pointIndex = 0; pointIndex <= TRANSPORT_PATH_INTERVAL_COUNT; pointIndex += 1) {
		float distanceMeters = pathSampleDistanceForIndex(state, pointIndex);
		vec3 positionMeters = state.ray.originMeters + state.ray.direction * distanceMeters;
		MediumSample medium = sampleAtmosphere(positionMeters);

		if (hasPreviousMedium) {
			float segmentLengthMeters = max(distanceMeters - previousDistanceMeters, 0.0);
			SpectralValue segmentTransmittance =
				computeTrapezoidSegmentTransmittance(previousMedium, medium, segmentLengthMeters);
			for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
				viewTransmittance.c[channelIndex] *= segmentTransmittance.c[channelIndex];
			}
		}

		SpectralValue directRadiance = sampleDirectRadiance(positionMeters);
		SpectralValue directScattering = directScatteringForDirection(
			medium,
			state.ray.direction,
			directionToLight(positionMeters)
		);
		float measureMeters = pathSampleMeasureMeters(state, pointIndex);

		for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
			radiance.c[channelIndex] += viewTransmittance.c[channelIndex]
				* directRadiance.c[channelIndex]
				* directScattering.c[channelIndex]
				* measureMeters;
		}

		for (int directionIndex = 0; directionIndex < LOCAL_CACHE_DIRECTION_COUNT; directionIndex += 1) {
			vec3 incomingDirection = localIncidentDirection(directionIndex);
			SpectralValue incidentRadiance = lookupIncidentRadiance(positionMeters, directionIndex);
			SpectralValue incidentScattering = directScatteringForDirection(
				medium,
				state.ray.direction,
				incomingDirection
			);

			for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
				radiance.c[channelIndex] += viewTransmittance.c[channelIndex]
					* incidentRadiance.c[channelIndex]
					* incidentScattering.c[channelIndex]
					* LOCAL_CACHE_INCIDENT_DIRECTION_WEIGHT
					* measureMeters;
			}
		}

		previousMedium = medium;
		previousDistanceMeters = distanceMeters;
		hasPreviousMedium = true;
	}
	state.transmittance = viewTransmittance;
	state.pathRadiance = radiance;
}`),
		]),
		mainHooks: Object.freeze([
			block('transport-main-evaluate', 'evaluateTransport', 0, 'evaluatePathRadiance(state);'),
		]),
	});
}

/**
 * Normalize flat geometry facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies descriptor.
 * @returns {object} Return normalized geometry facts.
 */
function resolveFlatGeometryFacts(descriptor) {
	const facts = descriptor.geometry.facts ?? {};

	if (facts.kind && facts.kind !== 'flat-earth-geometry') {
		throw new TypeError('Local flat shader contributions require flat Earth geometry.');
	}

	if (!Number.isFinite(facts.topAltitudeMeters) || !Array.isArray(facts.sourcePositionMeters)) {
		throw new TypeError('Local flat shader geometry facts require topAltitudeMeters and sourcePositionMeters.');
	}

	return facts;
}

/**
 * Normalize atmosphere facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies descriptor.
 * @returns {object} Return normalized atmosphere constants.
 */
function resolveAtmosphereFacts(descriptor) {
	const facts = descriptor.atmosphere.facts ?? {};
	const constants = facts.constants ?? facts;

	for (const field of [
		'rayleighScaleHeightMeters',
		'mieScaleHeightMeters',
		'rayleighCoefficientScale',
		'mieAngstromAlpha',
		'mieAngstromBeta',
		'mieSingleScatteringAlbedo',
		'miePhaseFunctionG',
	]) {
		if (!Number.isFinite(constants[field])) {
			throw new TypeError(`Local flat shader atmosphere facts require ${field}.`);
		}
	}

	return constants;
}

/**
 * Normalize local light facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies descriptor.
 * @returns {object} Return normalized light facts.
 */
function resolveLocalLightFacts(descriptor) {
	const lightFacts = descriptor.lightSource.facts ?? {};
	const geometryFacts = resolveFlatGeometryFacts(descriptor);
	const facts = {
		...lightFacts,
		sourcePositionMeters: lightFacts.sourcePositionMeters ?? geometryFacts.sourcePositionMeters,
	};

	for (const field of ['referenceDistanceMeters', 'referenceSpectralIncidentScale', 'radiusMeters']) {
		if (!Number.isFinite(facts[field])) {
			throw new TypeError(`Local flat shader light facts require ${field}.`);
		}
	}

	return facts;
}

/**
 * Normalize local cache facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies descriptor.
 * @returns {object} Return normalized cache facts.
 */
function resolveLocalCacheFacts(descriptor) {
	const facts = descriptor.cache.facts ?? {};
	const geometryFacts = descriptor.geometry.facts ?? {};
	const metadata = facts.metadata ?? {};
	const lookup = facts.lookup ?? {};
	const texture = facts.texture ?? {};
	const payloadDimensions = facts.payloadDimensions ?? [];
	const zBinsMeters = facts.zBinsMeters ?? lookup.zBinsMeters ?? geometryFacts.cacheZBinsMeters ?? [0];
	const rhoBinsMeters = facts.rhoBinsMeters ?? lookup.rhoBinsMeters ?? geometryFacts.cacheRhoBinsMeters ?? [0];
	const directionCount = facts.directionCount
		?? metadata.directionCount
		?? texture.width
		?? RUNTIME_NUMERICAL_CONTROLS.incidentDirectionCount;
	const zBinCount = facts.zBinCount ?? metadata.zBinCount ?? payloadDimensions[0] ?? zBinsMeters.length;
	const rhoBinCount = facts.rhoBinCount ?? metadata.rhoBinCount ?? payloadDimensions[1] ?? rhoBinsMeters.length;
	const spectralGroupCount = facts.spectralGroupCount ?? texture.spectralGroupCount ?? SPECTRAL_GROUP_COUNT;

	assertPositiveInteger(directionCount, 'directionCount');
	assertPositiveInteger(zBinCount, 'zBinCount');
	assertPositiveInteger(rhoBinCount, 'rhoBinCount');
	assertPositiveInteger(spectralGroupCount, 'spectralGroupCount');

	return Object.freeze({
		directionCount,
		zBinCount,
		rhoBinCount,
		spectralGroupCount,
		textureId: texture.textureId ?? 'incident-radiance-local-l2',
		valueKey: texture.valueKey ?? 'cache.localIncidentRadianceTexture',
		textureWidth: texture.width ?? directionCount,
		textureHeight: texture.height ?? rhoBinCount,
		textureDepth: texture.depth ?? zBinCount * spectralGroupCount,
		samplerPolicy: texture.samplerPolicy ?? 'nearest-clamp',
		zBinsMeters: Object.freeze([...zBinsMeters]),
		rhoBinsMeters: Object.freeze([...rhoBinsMeters]),
		directionWeight: facts.directionWeight ?? lookup.directionWeight ?? (4 * Math.PI) / directionCount,
		depthPacking: facts.depthPacking ?? lookup.depthPacking ?? 'z-then-spectral-group',
		lookupPolicy: facts.lookupPolicy ?? metadata.lookupPolicy ?? lookup.policy ?? 'nearest-neighbor-poc-grid',
	});
}

/**
 * Normalize transport facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies descriptor.
 * @returns {object} Return normalized transport facts.
 */
function resolveTransportFacts(descriptor) {
	const facts = descriptor.transport.facts ?? {};
	const execution = facts.execution ?? facts;
	const geometryFacts = descriptor.geometry.facts ?? {};
	const pathIntervalCount = execution.pathIntervalCount
		?? RUNTIME_NUMERICAL_CONTROLS.pathIntervalCount;
	const sourceTransmittanceIntervalCount = execution.sourceTransmittanceIntervalCount
		?? geometryFacts.sourceTransmittanceIntervalCount
		?? RUNTIME_NUMERICAL_CONTROLS.sourceTransmittanceIntervalCount;

	assertPositiveInteger(pathIntervalCount, 'pathIntervalCount');
	assertPositiveInteger(sourceTransmittanceIntervalCount, 'sourceTransmittanceIntervalCount');

	return Object.freeze({
		pathIntervalCount,
		sourceTransmittanceIntervalCount,
	});
}

/**
 * Assert descriptor shape and canonical spectral channel count.
 *
 * @param {unknown} descriptor - Supplies candidate descriptor.
 * @returns {void}
 */
function assertDescriptor(descriptor) {
	if (!descriptor?.geometry || !descriptor?.atmosphere || !descriptor?.lightSource || !descriptor?.cache || !descriptor?.transport) {
		throw new TypeError('LocalFlatShaderContributionFactory requires a complete shader descriptor.');
	}

	const channelCount = descriptor.spectralBasis?.facts?.channelCount
		?? descriptor.spectralBasis?.facts?.channels?.length
		?? descriptor.spectralBasis?.facts?.wavelengths?.length;

	if (channelCount !== SPECTRAL_CHANNEL_COUNT) {
		throw new RangeError('Local flat shader contributions require the canonical spectral channel count.');
	}
}

/**
 * Assert a positive integer.
 *
 * @param {unknown} value - Supplies candidate value.
 * @param {string} label - Supplies label.
 * @returns {void}
 */
function assertPositiveInteger(value, label) {
	if (!Number.isInteger(value) || value < 1) {
		throw new RangeError(`${label} must be a positive integer.`);
	}
}

function contribution(configuration) {
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

function block(id, slot, order, code) {
	return Object.freeze({ id, slot, order, code });
}

function uniform(name, type, valueKey, defaultValue) {
	const descriptor = { name, type, valueKey };

	if (arguments.length >= 4) {
		descriptor.defaultValue = defaultValue;
	}

	return Object.freeze(descriptor);
}

function texture(name, type, valueKey) {
	return Object.freeze({ name, type, valueKey });
}

function binding(id, owner, kind, updateFrequency, valueKey, required) {
	return Object.freeze({ id, owner, kind, updateFrequency, valueKey, required });
}

function formatFloat(value) {
	if (Number.isInteger(value)) {
		return value.toFixed(1);
	}

	return Number(value).toPrecision(12);
}

function formatFloatArray(values) {
	return values.map((value) => formatFloat(value)).join(', ');
}

function formatVec3(values) {
	return `vec3(${formatFloatArray(values)})`;
}

export default LocalFlatShaderContributionFactory;
