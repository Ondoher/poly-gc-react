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
 * Build the POC-backed distant spherical shader contribution set.
 */
export class DistantSphericalShaderContributionFactory {
	/**
	 * Create the shader contribution factory.
	 *
	 * @param {{ readonly textureBuilder?: TextureBuilder }} [configuration] - Supplies optional collaborators.
	 */
	constructor(configuration = {}) {
		this._textureBuilder = configuration.textureBuilder ?? new TextureBuilder();
	}

	/**
	 * Return symbols needed by the complete distant spherical shader main path.
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
			createSphericalEarthGeometryShaderContribution(descriptor),
			createSphericalCanonicalAtmosphereShaderContribution(descriptor),
			createDistantSunShaderContribution(descriptor),
			createDistantIncidentRadianceCacheShaderContribution(descriptor, this._textureBuilder),
			createDistantAlgorithm32TransportShaderContribution(descriptor),
		]);
	}
}

/**
 * Create the spherical geometry shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {ShaderContribution} Return the geometry contribution.
 */
export function createSphericalEarthGeometryShaderContribution(descriptor) {
	assertDescriptor(descriptor);

	return geometryContribution(descriptor);
}

/**
 * Create the canonical atmosphere shader contribution for spherical geometry.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {ShaderContribution} Return the atmosphere contribution.
 */
export function createSphericalCanonicalAtmosphereShaderContribution(descriptor) {
	assertDescriptor(descriptor);

	return atmosphereContribution(descriptor);
}

/**
 * Create the distant sun shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {ShaderContribution} Return the light-source contribution.
 */
export function createDistantSunShaderContribution(descriptor) {
	assertDescriptor(descriptor);

	return lightContribution(descriptor);
}

/**
 * Create the distant incident-radiance cache shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @param {TextureBuilder} [textureBuilder] - Supplies the texture descriptor builder.
 * @returns {ShaderContribution} Return the cache contribution.
 */
export function createDistantIncidentRadianceCacheShaderContribution(
	descriptor,
	textureBuilder = new TextureBuilder(),
) {
	assertDescriptor(descriptor);
	const cacheFacts = resolveDistantCacheFacts(descriptor);
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
		accessFunctionName: 'readIncidentRadianceTexture',
	});

	return cacheContribution(descriptor, cacheTexture, cacheFacts);
}

/**
 * Create the distant spherical Algorithm32 transport shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {ShaderContribution} Return the transport contribution.
 */
export function createDistantAlgorithm32TransportShaderContribution(descriptor) {
	assertDescriptor(descriptor);

	return transportContribution(descriptor);
}

/**
 * Create the spherical geometry shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {ShaderContribution} Return the geometry contribution.
 */
function geometryContribution(descriptor) {
	const facts = resolveSphericalGeometryFacts(descriptor);
	const frame = facts.observerLocalSceneFrame ?? Object.freeze({
		up: Object.freeze([1, 0, 0]),
		right: Object.freeze([0, 1, 0]),
		forward: Object.freeze([0, 0, -1]),
	});

	return contribution({
		id: 'geometry-spherical-earth',
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
			uniform('uCameraWorldPositionMeters', 'vec3', 'geometry.cameraWorldPositionMeters', [
				facts.bottomRadiusMeters + (facts.observerHeightMeters ?? 0),
				0,
				0,
			]),
			uniform('uSceneTerminationMeters', 'float', 'geometry.sceneTerminationMeters', 0),
			uniform('uSceneDepthMaxMeters', 'float', 'geometry.sceneDepthMaxMeters', facts.topRadiusMeters),
		]),
		functions: Object.freeze([
			block('geometry-constants', 'declareConstants', 0, `const float GEOMETRY_BOTTOM_RADIUS_METERS = ${formatFloat(facts.bottomRadiusMeters)};
const float GEOMETRY_TOP_RADIUS_METERS = ${formatFloat(facts.topRadiusMeters)};
const float GEOMETRY_CACHE_BOUNDARY_ALTITUDE_METERS = ${formatFloat(facts.cacheBoundaryAltitudeMeters ?? 2)};
const vec3 GEOMETRY_OBSERVER_UP_DIRECTION = ${formatVec3(frame.up)};
const vec3 GEOMETRY_OBSERVER_RIGHT_DIRECTION = ${formatVec3(frame.right)};
const vec3 GEOMETRY_OBSERVER_FORWARD_DIRECTION = ${formatVec3(frame.forward)};`),
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
}`),
			block('geometry-path-helper', 'resolvePathBounds', 0, `PathBounds resolveAtmospherePath(ViewRay ray, float sceneTerminationMeters, bool hasSceneEndpoint) {
	float radius = length(ray.originMeters);
	float mu = dot(ray.originMeters, ray.direction) / max(radius, 1.0);
	float topDiscriminant =
		radius * radius * (mu * mu - 1.0)
		+ GEOMETRY_TOP_RADIUS_METERS * GEOMETRY_TOP_RADIUS_METERS;
	if (topDiscriminant < 0.0) {
		return PathBounds(0.0, 0.0, 0.0, false, false, false);
	}
	float atmosphereExitMeters = max(0.0, -radius * mu + sqrt(topDiscriminant));
	float boundaryDistanceMeters = atmosphereExitMeters;
	bool hasGroundEndpoint = false;
	float endDistanceMeters = hasSceneEndpoint ? min(max(sceneTerminationMeters, 0.0), boundaryDistanceMeters) : boundaryDistanceMeters;
	return PathBounds(0.0, max(0.0, endDistanceMeters), sceneTerminationMeters, hasSceneEndpoint, hasGroundEndpoint, true);
}`),
			block('geometry-cache-coordinate', 'lookupIncidentRadiance', 0, `float resolveCacheAltitudeNormalized(vec3 positionMeters) {
	float altitudeMeters = max(
		length(positionMeters) - GEOMETRY_BOTTOM_RADIUS_METERS,
		GEOMETRY_CACHE_BOUNDARY_ALTITUDE_METERS
	);
	return clamp(
		altitudeMeters / max(GEOMETRY_TOP_RADIUS_METERS - GEOMETRY_BOTTOM_RADIUS_METERS, 1.0),
		0.0,
		0.999999999
	);
}

int resolveCacheAltitudeBinIndex(vec3 positionMeters) {
	float altitude = resolveCacheAltitudeNormalized(positionMeters);
	return int(floor(altitude * float(CACHE_INCIDENT_ALTITUDE_BIN_COUNT)));
}

float resolveCacheAltitudeBinCoordinate(vec3 positionMeters) {
	float altitude = resolveCacheAltitudeNormalized(positionMeters);
	return altitude * float(CACHE_INCIDENT_ALTITUDE_BIN_COUNT) - 0.5;
}`),
		]),
		mainHooks: Object.freeze([
			block('geometry-main-ray', 'reconstructRay', 0, 'state.ray = reconstructViewRay(state.uv);'),
			block('geometry-main-bounds', 'resolvePathBounds', 0, 'state.bounds = resolveAtmospherePath(state.ray, sceneTerminationMetersFromDepth(state.sceneDepth), state.sceneHitMask > 0.5);'),
		]),
	});
}

/**
 * Create the canonical atmosphere shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {ShaderContribution} Return the atmosphere contribution.
 */
function atmosphereContribution(descriptor) {
	const facts = resolveAtmosphereFacts(descriptor);

	return contribution({
		id: 'atmosphere-canonical',
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
	float altitudeMeters = max(0.0, length(positionMeters) - GEOMETRY_BOTTOM_RADIUS_METERS);
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
	float radius = length(positionMeters);
	float mu = dot(positionMeters, direction) / max(radius, 1.0);
	float groundDiscriminant =
		radius * radius * (mu * mu - 1.0)
		+ GEOMETRY_BOTTOM_RADIUS_METERS * GEOMETRY_BOTTOM_RADIUS_METERS;
	if (mu < 0.0 && groundDiscriminant >= 0.0) {
		float groundDistance = -radius * mu - sqrt(groundDiscriminant);
		if (groundDistance > 0.0) {
			return zeroSpectral();
		}
	}

	float topDiscriminant =
		radius * radius * (mu * mu - 1.0)
		+ GEOMETRY_TOP_RADIUS_METERS * GEOMETRY_TOP_RADIUS_METERS;
	if (topDiscriminant < 0.0) {
		return zeroSpectral();
	}

	float endDistanceMeters = max(0.0, -radius * mu + sqrt(topDiscriminant));
	float stepMeters = endDistanceMeters / float(SOURCE_TRANSMITTANCE_INTERVAL_COUNT);
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
 * Create the distant source shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {ShaderContribution} Return the light contribution.
 */
function lightContribution(descriptor) {
	const facts = resolveLightFacts(descriptor);

	return contribution({
		id: 'light-distant-sun',
		owner: 'lightSource',
		descriptorFingerprint: descriptor.lightSource.fingerprint,
		compatibilityTags: descriptor.lightSource.compatibilityTags,
		provides: Object.freeze(['light.sampleDirectRadiance', 'light.sourceDirection']),
		requires: Object.freeze(['atmosphere.sourcePathTransmittance']),
		uniforms: Object.freeze([
			uniform('uDistantSunDirection', 'vec3', 'lightSource.direction', facts.directionToLight),
		]),
		functions: Object.freeze([
			block('light-source-constants', 'declareConstants', 0, `const float LIGHT_SOURCE_SOLAR_IRRADIANCE[${SPECTRAL_CHANNEL_COUNT}] = float[${SPECTRAL_CHANNEL_COUNT}](${formatFloatArray(CANONICAL_SPECTRAL_CHANNELS.map((channel) => channel.solarIrradiance))});`),
			block('light-source-helper', 'sampleLightSource', 0, `SpectralValue sampleDirectRadiance(vec3 positionMeters) {
	SpectralValue sourceTransmittance = sourcePathTransmittance(positionMeters, normalize(uDistantSunDirection));
	SpectralValue radiance;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		radiance.c[channelIndex] = LIGHT_SOURCE_SOLAR_IRRADIANCE[channelIndex] * sourceTransmittance.c[channelIndex];
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
 * Create the distant incident-cache shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @param {ShaderTextureBuildResult} cacheTexture - Supplies the cache texture descriptor.
 * @param {object} cacheFacts - Supplies normalized cache facts.
 * @returns {ShaderContribution} Return the cache contribution.
 */
function cacheContribution(descriptor, cacheTexture, cacheFacts) {
	const cacheLookupHelper = cacheIncidentRadianceLookupHelper(
		cacheFacts.altitudeLookup?.kind ?? 'nearest-bin',
	);

	return contribution({
		id: 'cache-distant-l2-incident-radiance',
		owner: 'cache',
		descriptorFingerprint: descriptor.cache.fingerprint,
		compatibilityTags: descriptor.cache.compatibilityTags,
		provides: Object.freeze(['cache.lookupIncidentRadiance']),
		requires: Object.freeze(['geometry.cacheAccessCoordinate']),
		textures: Object.freeze([
			texture('uIncidentRadianceCacheTexture', 'sampler3D', cacheTexture.valueKey),
		]),
		bindingRequirements: Object.freeze([
			binding('cache.incidentRadianceTexture', 'cache', 'texture', 'setup', cacheTexture.valueKey, true),
		]),
		functions: Object.freeze([
			block('cache-constants', 'declareConstants', 0, `const int CACHE_INCIDENT_DIRECTION_COUNT = ${cacheFacts.incidentDirectionCount};
const int CACHE_INCIDENT_ALTITUDE_BIN_COUNT = ${cacheFacts.incidentAltitudeBinCount};
const int CACHE_SPECTRAL_GROUP_COUNT = ${cacheFacts.spectralGroupCount};
const float CACHE_INCIDENT_DIRECTION_WEIGHT = ${formatFloat((4 * Math.PI) / cacheFacts.incidentDirectionCount)};
const float CACHE_GOLDEN_RATIO = 1.6180339887498948482;`),
			block('cache-texture-access', 'lookupIncidentRadiance', 5, `vec4 readIncidentRadianceTexture(sampler3D sourceTexture, int altitudeBinIndex, int directionIndex, int spectralGroupIndex) {
	int clampedAltitudeBinIndex = clamp(altitudeBinIndex, 0, CACHE_INCIDENT_ALTITUDE_BIN_COUNT - 1);
	int clampedDirectionIndex = clamp(directionIndex, 0, CACHE_INCIDENT_DIRECTION_COUNT - 1);
	int clampedSpectralGroupIndex = clamp(spectralGroupIndex, 0, CACHE_SPECTRAL_GROUP_COUNT - 1);
	return texelFetch(sourceTexture, ivec3(clampedDirectionIndex, clampedAltitudeBinIndex, clampedSpectralGroupIndex), 0);
}

float unpackIncidentRadianceChannel(int altitudeBinIndex, int directionIndex, int channelIndex) {
	int spectralGroupIndex = channelIndex / ${SPECTRAL_GROUP_SIZE};
	int componentIndex = channelIndex - spectralGroupIndex * ${SPECTRAL_GROUP_SIZE};
	vec4 packed = readIncidentRadianceTexture(uIncidentRadianceCacheTexture, altitudeBinIndex, directionIndex, spectralGroupIndex);
	if (componentIndex == 0) return packed.r;
	if (componentIndex == 1) return packed.g;
	if (componentIndex == 2) return packed.b;
	return packed.a;
}

float unpackIncidentRadianceChannelInterpolated(float altitudeBinCoordinate, int directionIndex, int channelIndex) {
	int lowerAltitudeBinIndex = int(floor(altitudeBinCoordinate));
	int upperAltitudeBinIndex = lowerAltitudeBinIndex + 1;
	float blend = clamp(altitudeBinCoordinate - float(lowerAltitudeBinIndex), 0.0, 1.0);
	float lowerRadiance = unpackIncidentRadianceChannel(lowerAltitudeBinIndex, directionIndex, channelIndex);
	float upperRadiance = unpackIncidentRadianceChannel(upperAltitudeBinIndex, directionIndex, channelIndex);
	return mix(lowerRadiance, upperRadiance, blend);
}`),
			block('cache-lookup-helper', 'lookupIncidentRadiance', 10, `vec3 cacheBasisReference(vec3 sunAxis) {
	return abs(dot(sunAxis, vec3(0.0, 0.0, 1.0))) < 0.95
		? vec3(0.0, 0.0, 1.0)
		: vec3(0.0, 1.0, 0.0);
}

vec3 sunOrientedIncidentDirection(int directionIndex) {
	int halfCount = CACHE_INCIDENT_DIRECTION_COUNT / 2;
	float centeredIndex = float(directionIndex - halfCount);
	vec3 sunAxis = normalize(uDistantSunDirection);
	vec3 reference = cacheBasisReference(sunAxis);
	vec3 zAxis = normalize(reference - sunAxis * dot(reference, sunAxis));
	vec3 yAxis = normalize(cross(zAxis, sunAxis));
	float z = (2.0 * centeredIndex) / float(CACHE_INCIDENT_DIRECTION_COUNT);
	float latitude = asin(z);
	float longitude = (2.0 * 3.14159265358979323846 * centeredIndex) / CACHE_GOLDEN_RATIO;
	float horizontalScale = cos(latitude);
	float localX = horizontalScale * cos(longitude);
	float localY = horizontalScale * sin(longitude);
	float localZ = z;
	return normalize(sunAxis * localX + yAxis * localY + zAxis * localZ);
}

${cacheLookupHelper}`),
		]),
		mainHooks: Object.freeze([
			block('cache-main-lookup', 'lookupIncidentRadiance', 0, 'state.incidentRadiance = lookupIncidentRadiance(state.ray.originMeters + state.ray.direction * max(state.bounds.endDistanceMeters * 0.5, 0.0), 0);'),
		]),
		diagnostics: Object.freeze({
			texture: cacheTexture,
			altitudeLookup: cacheFacts.altitudeLookup ?? Object.freeze({ kind: 'nearest-bin' }),
		}),
	});
}

/**
 * Create the transport shader contribution.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {ShaderContribution} Return the transport contribution.
 */
function transportContribution(descriptor) {
	const facts = resolveTransportFacts(descriptor);
	const pathSampleHelper = transportPathSampleHelper(facts.pathSampleDistribution?.kind ?? 'uniform-distance');

	return contribution({
		id: 'transport-algorithm32',
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

${pathSampleHelper}

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
			normalize(uDistantSunDirection)
		);
		float measureMeters = pathSampleMeasureMeters(state, pointIndex);

		for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
			radiance.c[channelIndex] += viewTransmittance.c[channelIndex]
				* directRadiance.c[channelIndex]
				* directScattering.c[channelIndex]
				* measureMeters;
		}

		for (int directionIndex = 0; directionIndex < CACHE_INCIDENT_DIRECTION_COUNT; directionIndex += 1) {
			vec3 incomingDirection = sunOrientedIncidentDirection(directionIndex);
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
					* CACHE_INCIDENT_DIRECTION_WEIGHT
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
 * Build the cache lookup helper for the selected altitude policy.
 *
 * @param {string} kind - Supplies the lookup policy kind.
 * @returns {string} Return GLSL source.
 */
function cacheIncidentRadianceLookupHelper(kind) {
	if (kind === 'linear-altitude-v1') {
		return `SpectralValue lookupIncidentRadiance(vec3 positionMeters, int directionIndex) {
	float altitudeBinCoordinate = resolveCacheAltitudeBinCoordinate(positionMeters);
	SpectralValue radiance;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		radiance.c[channelIndex] = unpackIncidentRadianceChannelInterpolated(altitudeBinCoordinate, directionIndex, channelIndex);
	}
	return radiance;
}`;
	}

	return `SpectralValue lookupIncidentRadiance(vec3 positionMeters, int directionIndex) {
	int altitudeBinIndex = resolveCacheAltitudeBinIndex(positionMeters);
	SpectralValue radiance;
	for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
		radiance.c[channelIndex] = unpackIncidentRadianceChannel(altitudeBinIndex, directionIndex, channelIndex);
	}
	return radiance;
}`;
}

/**
 * Build the path-sampling GLSL helper.
 *
 * @param {string} kind - Supplies the path-sampling policy kind.
 * @returns {string} Return GLSL source.
 */
function transportPathSampleHelper(kind) {
	if (kind === 'tangent-density-adaptive-v1' || kind === 'tangent-density-adaptive-soft-v1') {
		const adaptiveBlend = kind === 'tangent-density-adaptive-soft-v1' ? '0.35' : '1.0';
		return `float pathSampleFraction(ShaderState state, float uniformFraction) {
	float startDistanceMeters = state.bounds.startDistanceMeters;
	float endDistanceMeters = state.bounds.endDistanceMeters;
	float pathLengthMeters = max(endDistanceMeters - startDistanceMeters, 0.0);
	if (pathLengthMeters <= 0.0) {
		return 0.0;
	}

	float tangentDistanceMeters = clamp(
		-dot(state.ray.originMeters, state.ray.direction),
		startDistanceMeters,
		endDistanceMeters
	);
	float tangentFraction = clamp(
		(tangentDistanceMeters - startDistanceMeters) / pathLengthMeters,
		0.0,
		1.0
	);
	bool hasInteriorTangent = tangentFraction > 0.08 && tangentFraction < 0.92;
	float adaptiveFraction = uniformFraction;

	if (hasInteriorTangent) {
		if (uniformFraction <= tangentFraction) {
			float localFraction = uniformFraction / max(tangentFraction, 0.0001);
			float warpedLocal = 1.0 - pow(1.0 - localFraction, 2.0);
			adaptiveFraction = tangentFraction * warpedLocal;
		} else {
			float remainingFraction = max(1.0 - tangentFraction, 0.0001);
			float localFraction = (uniformFraction - tangentFraction) / remainingFraction;
			float warpedLocal = pow(localFraction, 2.0);
			adaptiveFraction = tangentFraction + remainingFraction * warpedLocal;
		}
	} else {
		adaptiveFraction = pow(uniformFraction, 1.75);
	}

	return mix(uniformFraction, adaptiveFraction, ${adaptiveBlend});
}

float pathSampleDistanceForIndex(ShaderState state, int pointIndex) {
	float uniformFraction = float(pointIndex) / float(max(TRANSPORT_PATH_INTERVAL_COUNT, 1));
	float sampleFraction = pathSampleFraction(state, clamp(uniformFraction, 0.0, 1.0));
	return mix(state.bounds.startDistanceMeters, state.bounds.endDistanceMeters, sampleFraction);
}

float pathSampleMeasureMeters(ShaderState state, int pointIndex) {
	float previousDistanceMeters = pointIndex > 0
		? pathSampleDistanceForIndex(state, pointIndex - 1)
		: pathSampleDistanceForIndex(state, pointIndex);
	float nextDistanceMeters = pointIndex < TRANSPORT_PATH_INTERVAL_COUNT
		? pathSampleDistanceForIndex(state, pointIndex + 1)
		: pathSampleDistanceForIndex(state, pointIndex);
	return max(0.0, 0.5 * (nextDistanceMeters - previousDistanceMeters));
}`;
	}

	return `float pathSampleDistanceForIndex(ShaderState state, int pointIndex) {
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
}`;
}

/**
 * Normalize spherical geometry descriptor facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {object} Return normalized geometry facts.
 */
function resolveSphericalGeometryFacts(descriptor) {
	const facts = descriptor.geometry.facts ?? {};

	if (facts.kind && facts.kind !== 'spherical-earth-geometry') {
		throw new TypeError('Distant spherical shader contributions require spherical Earth geometry.');
	}

	return {
		...facts,
	};
}

/**
 * Normalize canonical atmosphere descriptor facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
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
			throw new TypeError(`Distant spherical shader atmosphere facts require ${field}.`);
		}
	}

	return constants;
}

/**
 * Normalize distant source descriptor facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {{ readonly directionToLight: readonly number[] }} Return normalized light facts.
 */
function resolveLightFacts(descriptor) {
	const facts = descriptor.lightSource.facts ?? {};
	const directionToLight = facts.directionToLight ?? facts.direction ?? [0, 0, 1];

	if (!Array.isArray(directionToLight) || directionToLight.length !== 3 || !directionToLight.every(Number.isFinite)) {
		throw new TypeError('Distant spherical shader light facts require directionToLight.');
	}

	return Object.freeze({
		directionToLight: Object.freeze([...directionToLight]),
	});
}

/**
 * Normalize distant incident-cache descriptor facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
 * @returns {object} Return normalized cache facts.
 */
function resolveDistantCacheFacts(descriptor) {
	const facts = descriptor.cache.facts ?? {};
	const metadata = facts.metadata ?? {};
	const texture = facts.texture ?? {};
	const incidentDirectionCount = facts.incidentDirectionCount
		?? facts.directionCount
		?? metadata.directionCount
		?? texture.width
		?? RUNTIME_NUMERICAL_CONTROLS.incidentDirectionCount;
	const incidentAltitudeBinCount = facts.incidentAltitudeBinCount
		?? facts.altitudeBinCount
		?? metadata.altitudeBinCount
		?? texture.height
		?? RUNTIME_NUMERICAL_CONTROLS.incidentAltitudeBinCount;
	const spectralGroupCount = facts.spectralGroupCount
		?? texture.spectralGroupCount
		?? SPECTRAL_GROUP_COUNT;

	assertPositiveInteger(incidentDirectionCount, 'incidentDirectionCount');
	assertPositiveInteger(incidentAltitudeBinCount, 'incidentAltitudeBinCount');
	assertPositiveInteger(spectralGroupCount, 'spectralGroupCount');

	return Object.freeze({
		incidentDirectionCount,
		incidentAltitudeBinCount,
		spectralGroupCount,
		textureId: texture.textureId ?? 'incident-radiance-distant-l2',
		valueKey: texture.valueKey ?? 'cache.incidentRadianceTexture',
		textureWidth: texture.width ?? incidentDirectionCount,
		textureHeight: texture.height ?? incidentAltitudeBinCount,
		textureDepth: texture.depth ?? spectralGroupCount,
		samplerPolicy: texture.samplerPolicy ?? 'nearest-clamp',
		altitudeLookup: facts.altitudeLookup,
	});
}

/**
 * Normalize transport descriptor facts.
 *
 * @param {Algorithm32ShaderDescriptor} descriptor - Supplies the active descriptor.
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
		pathSampleDistribution: execution.pathSampleDistribution,
	});
}

/**
 * Assert descriptor shape and canonical spectral channel count.
 *
 * @param {unknown} descriptor - Supplies the candidate descriptor.
 * @returns {void}
 */
function assertDescriptor(descriptor) {
	if (!descriptor?.geometry || !descriptor?.atmosphere || !descriptor?.lightSource || !descriptor?.cache || !descriptor?.transport) {
		throw new TypeError('DistantSphericalShaderContributionFactory requires a complete shader descriptor.');
	}

	const channelCount = descriptor.spectralBasis?.facts?.channelCount
		?? descriptor.spectralBasis?.facts?.channels?.length
		?? descriptor.spectralBasis?.facts?.wavelengths?.length;

	if (channelCount !== SPECTRAL_CHANNEL_COUNT) {
		throw new RangeError('Distant spherical shader contributions require the canonical spectral channel count.');
	}
}

/**
 * Assert a positive integer.
 *
 * @param {unknown} value - Supplies candidate value.
 * @param {string} label - Supplies the label.
 * @returns {void}
 */
function assertPositiveInteger(value, label) {
	if (!Number.isInteger(value) || value < 1) {
		throw new RangeError(`${label} must be a positive integer.`);
	}
}

/**
 * Create one contribution object.
 *
 * @param {Partial<ShaderContribution>} configuration - Supplies contribution fields.
 * @returns {ShaderContribution} Return contribution.
 */
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

/**
 * Create one source block.
 *
 * @param {string} id - Supplies block id.
 * @param {ShaderSourceSlot} slot - Supplies assembly slot.
 * @param {number} order - Supplies slot-local order.
 * @param {string} code - Supplies GLSL source.
 * @returns {ShaderSourceBlock} Return source block.
 */
function block(id, slot, order, code) {
	return Object.freeze({ id, slot, order, code });
}

/**
 * Create one uniform descriptor.
 *
 * @param {string} name - Supplies GLSL uniform name.
 * @param {string} type - Supplies GLSL uniform type.
 * @param {string} valueKey - Supplies runtime value key.
 * @param {unknown} [defaultValue] - Supplies optional default value.
 * @returns {ShaderUniformDescriptor} Return uniform descriptor.
 */
function uniform(name, type, valueKey, defaultValue) {
	const descriptor = { name, type, valueKey };

	if (arguments.length >= 4) {
		descriptor.defaultValue = defaultValue;
	}

	return Object.freeze(descriptor);
}

/**
 * Create one texture descriptor.
 *
 * @param {string} name - Supplies GLSL sampler name.
 * @param {string} type - Supplies sampler type.
 * @param {string} valueKey - Supplies runtime value key.
 * @returns {ShaderTextureDescriptor} Return texture descriptor.
 */
function texture(name, type, valueKey) {
	return Object.freeze({ name, type, valueKey });
}

/**
 * Create one binding requirement.
 *
 * @param {string} id - Supplies binding id.
 * @param {string} owner - Supplies binding owner.
 * @param {string} kind - Supplies binding kind.
 * @param {string} updateFrequency - Supplies update cadence.
 * @param {string} valueKey - Supplies runtime value key.
 * @param {boolean} required - Supplies whether setup must provide the value.
 * @returns {ShaderBindingRequirement} Return binding requirement.
 */
function binding(id, owner, kind, updateFrequency, valueKey, required) {
	return Object.freeze({ id, owner, kind, updateFrequency, valueKey, required });
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

export default DistantSphericalShaderContributionFactory;
