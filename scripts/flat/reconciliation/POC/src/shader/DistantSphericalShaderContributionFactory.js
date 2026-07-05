// References:
// - agents/topics/apps/flat/reconciliation/shader-design.md, owner contributions and cache texture access.
// - scripts/flat/reconciliation/POC/src/color/BrunetonColorDisplayModel.js, accepted display adapter policy.

import TextureBuilder from './TextureBuilder.js';
import BrunetonColorDisplayModel from '../color/BrunetonColorDisplayModel.js';
import {
    CANONICAL_SPECTRAL_CHANNELS,
    FIGURE1_DISPLAY_CONSTANTS,
} from '../constants/consts.js';

const SPECTRAL_CHANNEL_COUNT = CANONICAL_SPECTRAL_CHANNELS.length;
const SPECTRAL_GROUP_SIZE = 4;
const SPECTRAL_GROUP_COUNT = Math.ceil(SPECTRAL_CHANNEL_COUNT / SPECTRAL_GROUP_SIZE);
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

export default class DistantSphericalShaderContributionFactory {
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
            textureId: 'incident-radiance-distant-l2',
            owner: 'cache',
            dimensionality: '3d',
            dimensions: Object.freeze([
                descriptor.cache.facts.incidentDirectionCount,
                descriptor.cache.facts.incidentAltitudeBinCount,
                SPECTRAL_GROUP_COUNT,
            ]),
            formatPreference: Object.freeze(['float32', 'half-float']),
            samplerPolicy: 'nearest-clamp',
            valueKey: 'cache.incidentRadianceTexture',
            accessFunctionName: 'readIncidentRadianceTexture',
        });

        return Object.freeze([
            runtimeContribution(descriptor),
            geometryContribution(descriptor),
            atmosphereContribution(descriptor),
            lightContribution(descriptor),
            cacheContribution(descriptor, cacheTexture),
            transportContribution(descriptor),
            colorContribution(descriptor),
        ]);
    }
}

function runtimeContribution(descriptor) {
    return contribution({
        id: 'runtime-three-single-camera',
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
            uniform('uInverseProjectionMatrix', 'mat4', 'geometry.inverseProjectionMatrix'),
            uniform('uInverseViewMatrix', 'mat4', 'geometry.inverseViewMatrix'),
            uniform('uCameraWorldPositionMeters', 'vec3', 'geometry.cameraWorldPositionMeters'),
            uniform('uSceneTerminationMeters', 'float', 'geometry.sceneTerminationMeters'),
            uniform('uSceneDepthMaxMeters', 'float', 'geometry.sceneDepthMaxMeters'),
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
    return max(sceneDepth * uSceneDepthMaxMeters, 0.0);
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

function atmosphereContribution(descriptor) {
    const facts = descriptor.atmosphere.facts;

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

function lightContribution(descriptor) {
    return contribution({
        id: 'light-distant-sun',
        owner: 'lightSource',
        descriptorFingerprint: descriptor.lightSource.fingerprint,
        compatibilityTags: descriptor.lightSource.compatibilityTags,
        provides: Object.freeze(['light.sampleDirectRadiance', 'light.sourceDirection']),
        requires: Object.freeze(['atmosphere.sourcePathTransmittance']),
        uniforms: Object.freeze([
            uniform('uDistantSunDirection', 'vec3', 'lightSource.direction'),
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

function cacheContribution(descriptor, cacheTexture) {
    const cacheLookupHelper = cacheIncidentRadianceLookupHelper(
        descriptor.cache.facts.altitudeLookup?.kind ?? 'nearest-bin',
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
            block('cache-constants', 'declareConstants', 0, `const int CACHE_INCIDENT_DIRECTION_COUNT = ${descriptor.cache.facts.incidentDirectionCount};
const int CACHE_INCIDENT_ALTITUDE_BIN_COUNT = ${descriptor.cache.facts.incidentAltitudeBinCount};
const int CACHE_SPECTRAL_GROUP_COUNT = ${SPECTRAL_GROUP_COUNT};
const float CACHE_INCIDENT_DIRECTION_WEIGHT = ${formatFloat((4 * Math.PI) / descriptor.cache.facts.incidentDirectionCount)};
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
            altitudeLookup: descriptor.cache.facts.altitudeLookup ?? Object.freeze({ kind: 'nearest-bin' }),
        }),
    });
}

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

function transportContribution(descriptor) {
    const facts = descriptor.transport.facts;
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

function colorContribution(descriptor) {
    const facts = descriptor.color.facts;

    return contribution({
        id: 'color-bruneton-display',
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

vec3 composeSceneLinearSrgb(ShaderState state) {
    vec3 skyLinearSrgb = spectralRadianceToLinearSrgb(state.pathRadiance);
    if (state.bounds.hasSceneEndpoint) {
        vec3 endpointLinearSrgb = displayRgbToLinearSrgb(state.sceneDisplayRgb);
        vec3 transmittanceRgb = spectralTransmittanceToRgbBands(state.transmittance);
        return skyLinearSrgb + endpointLinearSrgb * transmittanceRgb;
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
