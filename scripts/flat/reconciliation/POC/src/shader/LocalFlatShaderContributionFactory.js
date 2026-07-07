// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Subgoal 4.2 local GPU cache texture and lookup.
// - agents/topics/apps/flat/reconciliation/shader-design.md, owner contributions and cache texture access.

import TextureBuilder from './TextureBuilder.js';
import BrunetonColorDisplayModel from '../color/BrunetonColorDisplayModel.js';
import {
    CANONICAL_SPECTRAL_CHANNELS,
    FIGURE1_DISPLAY_CONSTANTS,
} from '../constants/consts.js';

const SPECTRAL_CHANNEL_COUNT = CANONICAL_SPECTRAL_CHANNELS.length;
const SPECTRAL_GROUP_SIZE = 4;
const DISPLAY_LINEAR_SRGB_BY_CHANNEL = buildDisplayLinearSrgbByChannel();

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

export default class LocalFlatShaderContributionFactory {
    /**
     * @param {{ readonly textureBuilder?: TextureBuilder }} [configuration] - Factory configuration.
     */
    constructor(configuration = {}) {
        this._textureBuilder = configuration.textureBuilder ?? new TextureBuilder();
    }

    /**
     * @returns {readonly string[]} Symbols required by the generic shader main.
     */
    mainRequiredSymbols() {
        return MAIN_SYMBOLS;
    }

    /**
     * @param {Algorithm32ShaderDescriptor} descriptor - Active shader descriptor.
     * @returns {readonly ShaderContribution[]} Owner contributions.
     */
    createContributions(descriptor) {
        const cacheTexture = this._textureBuilder.createTexture({
            textureId: descriptor.cache.facts.textureId,
            owner: 'cache',
            dimensionality: '3d',
            dimensions: descriptor.cache.facts.textureDimensions,
            formatPreference: Object.freeze(['float32', 'half-float']),
            samplerPolicy: descriptor.cache.facts.samplerPolicy,
            valueKey: 'cache.localIncidentRadianceTexture',
            accessFunctionName: 'readLocalIncidentRadianceTexture',
        });

        return Object.freeze([
            runtimeContribution(descriptor),
            geometryContribution(descriptor),
            atmosphereContribution(descriptor),
            lightContribution(descriptor),
            cacheContribution(descriptor, cacheTexture),
            transportContribution(descriptor),
            colorContribution(descriptor),
            diagnosticContribution(descriptor),
        ]);
    }
}

function runtimeContribution(descriptor) {
    return contribution({
        id: 'runtime-three-single-camera-local-flat',
        owner: 'runtime',
        descriptorFingerprint: descriptor.runtime.fingerprint,
        compatibilityTags: descriptor.runtime.compatibilityTags,
        provides: Object.freeze(['runtime.initialState', 'runtime.depthTexture', 'runtime.sceneHitTexture']),
        requires: Object.freeze([]),
        textures: Object.freeze([
            texture('uSceneColorTexture', 'sampler2D', 'runtime.sceneColorTexture'),
            texture('uSceneDepthTexture', 'sampler2D', 'runtime.sceneDepthTexture'),
            texture('uSceneHitTexture', 'sampler2D', 'runtime.sceneHitTexture'),
        ]),
        uniforms: Object.freeze([
            uniform('uViewportPixels', 'vec2', 'runtime.viewportPixels'),
            uniform('uEndpointRadianceScale', 'float', 'runtime.endpointRadianceScale'),
            uniform('uEndpointCameraDistanceScaleEnabled', 'float', 'runtime.endpointCameraDistanceScale.enabled'),
            uniform('uEndpointCameraDistanceReferenceMeters', 'float', 'runtime.endpointCameraDistanceScale.referenceMeters'),
            uniform('uEndpointCameraDistanceMinScale', 'float', 'runtime.endpointCameraDistanceScale.minScale'),
            uniform('uEndpointCameraDistanceMaxScale', 'float', 'runtime.endpointCameraDistanceScale.maxScale'),
        ]),
        functions: Object.freeze([
            block('runtime-types', 'declareTypes', 0, `const int SPECTRAL_CHANNEL_COUNT = ${SPECTRAL_CHANNEL_COUNT};

struct SpectralValue {
    float c[${SPECTRAL_CHANNEL_COUNT}];
};

struct ViewRay {
    vec3 originMeters;
    vec3 direction;
};

struct PathBounds {
    float startDistanceMeters;
    float endDistanceMeters;
    float endpointDistanceMeters;
    bool hasSceneEndpoint;
    bool hasGroundEndpoint;
    bool valid;
};

struct MediumSample {
    SpectralValue rayleighScattering;
    SpectralValue mieScattering;
    SpectralValue scattering;
    SpectralValue extinction;
};

struct ShaderState {
    vec2 uv;
    float sceneDepth;
    float sceneHitMask;
    ViewRay ray;
    PathBounds bounds;
    MediumSample medium;
    SpectralValue lightRadiance;
    SpectralValue incidentRadiance;
    SpectralValue pathRadiance;
    SpectralValue transmittance;
    vec3 sceneDisplayRgb;
    vec4 outputRgba;
};

SpectralValue zeroSpectral() {
    SpectralValue value;
    for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
        value.c[channelIndex] = 0.0;
    }
    return value;
}

SpectralValue oneSpectral() {
    SpectralValue value;
    for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
        value.c[channelIndex] = 1.0;
    }
    return value;
}`),
            block('runtime-initial-state', 'declareHelpers', 0, `ShaderState createInitialShaderState(vec2 uv) {
    ShaderState state;
    state.uv = uv;
    vec4 sceneDepthSample = texture(uSceneDepthTexture, uv);
    vec4 sceneHitSample = texture(uSceneHitTexture, uv);
    vec3 depthBytes = floor(sceneDepthSample.rgb * 255.0 + 0.5);
    state.sceneDepth = dot(depthBytes, vec3(65536.0, 256.0, 1.0)) / 16777214.0;
    state.sceneHitMask = sceneHitSample.r > 0.5 ? 1.0 : 0.0;
    state.ray = ViewRay(vec3(0.0), vec3(0.0, 0.0, 1.0));
    state.bounds = PathBounds(0.0, 0.0, 0.0, false, false, true);
    state.medium = MediumSample(zeroSpectral(), zeroSpectral(), zeroSpectral(), zeroSpectral());
    state.lightRadiance = zeroSpectral();
    state.incidentRadiance = zeroSpectral();
    state.pathRadiance = zeroSpectral();
    state.transmittance = oneSpectral();
    state.sceneDisplayRgb = texture(uSceneColorTexture, uv).rgb;
    state.outputRgba = vec4(state.sceneDisplayRgb, 1.0);
    return state;
}`),
        ]),
    });
}

function geometryContribution(descriptor) {
    const facts = descriptor.geometry.facts;
    const frame = facts.observerLocalSceneFrame;
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
            uniform('uInverseProjectionMatrix', 'mat4', 'geometry.inverseProjectionMatrix'),
            uniform('uInverseViewMatrix', 'mat4', 'geometry.inverseViewMatrix'),
            uniform('uCameraWorldPositionMeters', 'vec3', 'geometry.cameraWorldPositionMeters'),
            uniform('uSceneTerminationMeters', 'float', 'geometry.sceneTerminationMeters'),
            uniform('uSceneDepthMaxMeters', 'float', 'geometry.sceneDepthMaxMeters'),
        ]),
        functions: Object.freeze([
            block('geometry-constants', 'declareConstants', 0, `const float GEOMETRY_TOP_ALTITUDE_METERS = ${formatFloat(facts.topAltitudeMeters)};
const float GEOMETRY_SCENE_SKY_RAY_LIMIT_METERS = ${formatFloat(facts.sceneSkyRayLimitMeters)};
const vec3 GEOMETRY_SOURCE_SUBPOINT_METERS = ${formatVec3(facts.sourceSubpointMeters)};
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
    return max(sceneDepth * uSceneDepthMaxMeters, 0.0);
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

function atmosphereContribution(descriptor) {
    const facts = descriptor.atmosphere.facts;

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

function lightContribution(descriptor) {
    const facts = descriptor.lightSource.facts;
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

function cacheContribution(descriptor, cacheTexture) {
    const facts = descriptor.cache.facts;

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

function transportContribution(descriptor) {
    const facts = descriptor.transport.facts;

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

function colorContribution(descriptor) {
    const facts = descriptor.color.facts;

    return contribution({
        id: 'color-bruneton-display-local-flat',
        owner: 'color',
        descriptorFingerprint: descriptor.color.fingerprint,
        compatibilityTags: descriptor.color.compatibilityTags,
        provides: Object.freeze(['color.composeSceneColor', 'color.encodeOutput']),
        requires: Object.freeze(['transport.evaluatePathRadiance']),
        functions: Object.freeze([
            block('color-constants', 'declareConstants', 0, `const float DISPLAY_TONE_MAP_K = ${formatFloat(facts.metadata.paperFigure1ToneMapK)};
const float DISPLAY_LINEAR_SRGB_R_BY_CHANNEL[${SPECTRAL_CHANNEL_COUNT}] = float[${SPECTRAL_CHANNEL_COUNT}](${formatFloatArray(DISPLAY_LINEAR_SRGB_BY_CHANNEL.r)});
const float DISPLAY_LINEAR_SRGB_G_BY_CHANNEL[${SPECTRAL_CHANNEL_COUNT}] = float[${SPECTRAL_CHANNEL_COUNT}](${formatFloatArray(DISPLAY_LINEAR_SRGB_BY_CHANNEL.g)});
const float DISPLAY_LINEAR_SRGB_B_BY_CHANNEL[${SPECTRAL_CHANNEL_COUNT}] = float[${SPECTRAL_CHANNEL_COUNT}](${formatFloatArray(DISPLAY_LINEAR_SRGB_BY_CHANNEL.b)});`),
            block('color-compose-helper', 'composeSceneColor', 0, `vec3 spectralRadianceToLinearSrgb(SpectralValue radiance) {
    vec3 linearSrgb = vec3(0.0);
    for (int channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
        linearSrgb.r += radiance.c[channelIndex] * DISPLAY_LINEAR_SRGB_R_BY_CHANNEL[channelIndex];
        linearSrgb.g += radiance.c[channelIndex] * DISPLAY_LINEAR_SRGB_G_BY_CHANNEL[channelIndex];
        linearSrgb.b += radiance.c[channelIndex] * DISPLAY_LINEAR_SRGB_B_BY_CHANNEL[channelIndex];
    }
    return linearSrgb;
}

vec3 spectralTransmittanceToRgbBands(SpectralValue transmittance) {
    float red = 0.0;
    for (int channelIndex = 8; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
        red += transmittance.c[channelIndex];
    }
    float green = 0.0;
    for (int channelIndex = 4; channelIndex < 9; channelIndex += 1) {
        green += transmittance.c[channelIndex];
    }
    float blue = 0.0;
    for (int channelIndex = 0; channelIndex < 5; channelIndex += 1) {
        blue += transmittance.c[channelIndex];
    }
    return vec3(red / 7.0, green / 5.0, blue / 5.0);
}

vec3 displayRgbToLinearSrgb(vec3 displayRgb) {
    vec3 clamped = clamp(displayRgb, vec3(0.0), vec3(0.999999));
    return -log(vec3(1.0) - clamped) / DISPLAY_TONE_MAP_K;
}

float endpointCameraDistanceBoostScale(ShaderState state) {
    if (uEndpointCameraDistanceScaleEnabled < 0.5) {
        return 0.0;
    }
    float referenceMeters = max(uEndpointCameraDistanceReferenceMeters, 0.000001);
    float normalizedDistance = max(state.bounds.endDistanceMeters, 0.0) / referenceMeters;
    return clamp(
        normalizedDistance * normalizedDistance,
        max(uEndpointCameraDistanceMinScale, 0.0),
        max(uEndpointCameraDistanceMaxScale, max(uEndpointCameraDistanceMinScale, 0.0))
    );
}

vec3 composeSceneLinearSrgb(ShaderState state) {
    vec3 skyLinearSrgb = spectralRadianceToLinearSrgb(state.pathRadiance);
    if (state.bounds.hasSceneEndpoint) {
        vec3 endpointLinearSrgb = displayRgbToLinearSrgb(state.sceneDisplayRgb);
        vec3 transmittanceRgb = spectralTransmittanceToRgbBands(state.transmittance);
        float endpointCameraDistanceScale = 1.0 + endpointCameraDistanceBoostScale(state);
        return skyLinearSrgb + endpointLinearSrgb * transmittanceRgb * uEndpointRadianceScale * endpointCameraDistanceScale;
    }
    return skyLinearSrgb;
}`),
            block('color-encode-helper', 'encodeOutput', 0, `vec4 encodeDisplayOutput(vec3 linearSrgb) {
    vec3 mapped = clamp(vec3(1.0) - exp(-max(linearSrgb, vec3(0.0)) * DISPLAY_TONE_MAP_K), vec3(0.0), vec3(1.0));
    return vec4(mapped, 1.0);
}`),
        ]),
        mainHooks: Object.freeze([
            block('color-main-compose', 'composeSceneColor', 0, 'state.outputRgba = encodeDisplayOutput(composeSceneLinearSrgb(state));'),
            block('color-main-output', 'encodeOutput', 0, 'outColor = state.outputRgba;'),
        ]),
    });
}

function diagnosticContribution(descriptor) {
    const diagnostic = descriptor.runtime.facts.diagnosticCacheLookup;
    const geometryDiagnostic = descriptor.runtime.facts.diagnosticFlatGeometry;

    return contribution({
        id: 'runtime-local-cache-lookup-diagnostic',
        owner: 'runtime',
        descriptorFingerprint: descriptor.runtime.fingerprint,
        compatibilityTags: descriptor.runtime.compatibilityTags,
        provides: Object.freeze([]),
        requires: Object.freeze([
            'geometry.reconstructViewRay',
            'geometry.resolveAtmospherePath',
            'cache.lookupIncidentRadiance',
        ]),
        functions: Object.freeze([
            block('diagnostic-cache-lookup-constants', 'diagnosticOutput', 0, `const bool LOCAL_CACHE_LOOKUP_DIAGNOSTIC_ENABLED = ${diagnostic.enabled ? 'true' : 'false'};
const vec3 LOCAL_CACHE_LOOKUP_DIAGNOSTIC_POSITION_METERS = ${formatVec3(diagnostic.positionMeters)};
const int LOCAL_CACHE_LOOKUP_DIAGNOSTIC_DIRECTION_INDEX = ${diagnostic.directionIndex};
const float LOCAL_CACHE_LOOKUP_DIAGNOSTIC_SCALE = ${formatFloat(diagnostic.outputScale)};
const bool LOCAL_FLAT_GEOMETRY_DIAGNOSTIC_ENABLED = ${geometryDiagnostic.enabled ? 'true' : 'false'};
const int LOCAL_FLAT_GEOMETRY_DIAGNOSTIC_MODE = ${geometryDiagnostic.modeId};
const float LOCAL_FLAT_GEOMETRY_DIAGNOSTIC_DISTANCE_SCALE_METERS = ${formatFloat(geometryDiagnostic.distanceScaleMeters)};
const float LOCAL_FLAT_GEOMETRY_DIAGNOSTIC_ALTITUDE_SCALE_METERS = ${formatFloat(geometryDiagnostic.altitudeScaleMeters)};`),
            block('diagnostic-cache-lookup-output', 'diagnosticOutput', 1, `vec4 localCacheLookupDiagnosticOutput() {
    SpectralValue radiance = lookupIncidentRadiance(
        LOCAL_CACHE_LOOKUP_DIAGNOSTIC_POSITION_METERS,
        LOCAL_CACHE_LOOKUP_DIAGNOSTIC_DIRECTION_INDEX
    );
    vec3 display = vec3(
        radiance.c[${diagnostic.redChannelIndex}],
        radiance.c[${diagnostic.greenChannelIndex}],
        radiance.c[${diagnostic.blueChannelIndex}]
    ) * LOCAL_CACHE_LOOKUP_DIAGNOSTIC_SCALE;
    return vec4(clamp(display, vec3(0.0), vec3(1.0)), 1.0);
}

vec4 localFlatGeometryDiagnosticOutput(ShaderState state) {
    if (LOCAL_FLAT_GEOMETRY_DIAGNOSTIC_MODE == 1) {
        return vec4(clamp(state.ray.direction * 0.5 + vec3(0.5), vec3(0.0), vec3(1.0)), 1.0);
    }

    vec3 samplePositionMeters = state.ray.originMeters
        + state.ray.direction * max(state.bounds.endDistanceMeters * 0.5, 0.0);

    if (LOCAL_FLAT_GEOMETRY_DIAGNOSTIC_MODE == 2) {
        return vec4(
            clamp(state.bounds.endDistanceMeters / LOCAL_FLAT_GEOMETRY_DIAGNOSTIC_DISTANCE_SCALE_METERS, 0.0, 1.0),
            state.bounds.hasSceneEndpoint ? 1.0 : 0.0,
            state.bounds.hasGroundEndpoint ? 1.0 : 0.0,
            state.bounds.valid ? 1.0 : 0.0
        );
    }

    if (LOCAL_FLAT_GEOMETRY_DIAGNOSTIC_MODE == 3) {
        int zBinIndex = nearestLocalCacheZBinIndex(samplePositionMeters);
        int rhoBinIndex = nearestLocalCacheRhoBinIndex(samplePositionMeters);
        return vec4(
            clamp(samplePositionMeters.z / LOCAL_FLAT_GEOMETRY_DIAGNOSTIC_ALTITUDE_SCALE_METERS, 0.0, 1.0),
            float(zBinIndex) / max(float(LOCAL_CACHE_Z_BIN_COUNT - 1), 1.0),
            float(rhoBinIndex) / max(float(LOCAL_CACHE_RHO_BIN_COUNT - 1), 1.0),
            1.0
        );
    }

    return vec4(0.0, 0.0, 0.0, 1.0);
}`),
        ]),
        mainHooks: Object.freeze([
            block('diagnostic-cache-lookup-main', 'diagnosticOutput', 0, `if (LOCAL_FLAT_GEOMETRY_DIAGNOSTIC_ENABLED) {
        outColor = localFlatGeometryDiagnosticOutput(state);
    } else if (LOCAL_CACHE_LOOKUP_DIAGNOSTIC_ENABLED) {
        outColor = localCacheLookupDiagnosticOutput();
    }`),
        ]),
    });
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

function uniform(name, type, valueKey) {
    return Object.freeze({ name, type, valueKey });
}

function texture(name, type, valueKey) {
    return Object.freeze({ name, type, valueKey });
}

function binding(id, owner, kind, updateFrequency, valueKey, required) {
    return Object.freeze({ id, owner, kind, updateFrequency, valueKey, required });
}

function formatFloat(value) {
    if (Number.isInteger(value)) {
        return `${value.toFixed(1)}`;
    }

    return `${Number(value).toPrecision(12)}`;
}

function formatFloatArray(values) {
    return values.map((value) => formatFloat(value)).join(', ');
}

function formatVec3(values) {
    return `vec3(${formatFloatArray(values)})`;
}

function buildDisplayLinearSrgbByChannel() {
    const displayModel = new BrunetonColorDisplayModel({
        displayConstants: FIGURE1_DISPLAY_CONSTANTS,
    });
    const rows = {
        r: [],
        g: [],
        b: [],
    };

    for (let channelIndex = 0; channelIndex < SPECTRAL_CHANNEL_COUNT; channelIndex += 1) {
        const basis = CANONICAL_SPECTRAL_CHANNELS.map((_, index) => index === channelIndex ? 1 : 0);
        const linearSrgb = displayModel.radianceToLinearSrgb(basis);

        rows.r.push(linearSrgb[0]);
        rows.g.push(linearSrgb[1]);
        rows.b.push(linearSrgb[2]);
    }

    return Object.freeze({
        r: Object.freeze(rows.r),
        g: Object.freeze(rows.g),
        b: Object.freeze(rows.b),
    });
}
