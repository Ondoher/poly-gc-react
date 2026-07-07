// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Subgoal 4.2 local GPU cache texture and lookup.
// - agents/topics/apps/flat/reconciliation/shader-design.md, cache-owned texture/access descriptor flow.

import BrunetonColorDisplayModel from '../color/BrunetonColorDisplayModel.js';
import { ALGORITHM32_BASELINE_CONSTANTS } from '../constants/consts.js';
import { stableHash } from './stableHash.js';

const DEFAULT_TAGS = Object.freeze([
    'algorithm32',
    'local-light-source',
    'flat-geometry',
    'bruneton-display',
]);

const DEFAULT_FLAT_FRAME = Object.freeze({
    up: Object.freeze([0, 0, 1]),
    right: Object.freeze([1, 0, 0]),
    forward: Object.freeze([0, -1, 0]),
});

export default class LocalFlatShaderDescriptorBuilder {
    /**
     * @param {{
     *   readonly constants?: Algorithm32BaselineConstants,
     *   readonly colorDisplayModel?: BrunetonColorDisplayModel
     * }} [configuration] - Builder configuration.
     */
    constructor(configuration = {}) {
        this._constants = configuration.constants ?? ALGORITHM32_BASELINE_CONSTANTS;
        this._colorDisplayModel = configuration.colorDisplayModel ?? new BrunetonColorDisplayModel();
    }

    /**
     * @param {ShaderDescriptorBuildRequest & {
 *   readonly localFlat?: unknown,
 *   readonly cachePayload?: CacheShaderPayloadDescriptor,
 *   readonly diagnosticCacheLookup?: unknown,
 *   readonly diagnosticFlatGeometry?: unknown
 * }} [request] - Descriptor build request.
 * @returns {Algorithm32ShaderDescriptor} Shader descriptor.
 */
    build(request = {}) {
        const localFlat = normalizeLocalFlatFacts(request.localFlat, this._constants.m2LocalFlatSeed);
        const cachePayload = normalizeLocalCachePayload(request.cachePayload, localFlat);
        const texture = cachePayload.texture;
        const variantId = request.variantId ?? 'algorithm32-local-flat-first-pass';
        const compatibilityTags = Object.freeze([
            ...DEFAULT_TAGS,
            ...(request.compatibilityTags ?? []),
        ]);
        const sections = Object.freeze({
            spectralBasis: section(
                'spectral-basis',
                ['spectral-15-channel'],
                {
                    wavelengthsNanometers: this._constants.spectralBasis.wavelengthsNanometers,
                    channels: this._constants.spectralChannels,
                },
            ),
            geometry: section(
                'geometry-flat-earth',
                ['flat-geometry'],
                {
                    coordinateFrame: 'flat-z-up-observer-local-y-up-scene-frame',
                    observerPositionMeters: localFlat.observerPositionMeters,
                    sourcePositionMeters: localFlat.sourcePositionMeters,
                    sourceSubpointMeters: Object.freeze([
                        localFlat.sourcePositionMeters[0],
                        localFlat.sourcePositionMeters[1],
                        0,
                    ]),
                    topAltitudeMeters: localFlat.topAltitudeMeters,
                    sceneSkyRayLimitMeters: localFlat.sceneSkyRayLimitMeters,
                    observerCenteredDome: localFlat.observerCenteredDome,
                    observerLocalSceneFrame: DEFAULT_FLAT_FRAME,
                    cacheZBinsMeters: cachePayload.lookup.zBinsMeters,
                    cacheRhoBinsMeters: cachePayload.lookup.rhoBinsMeters,
                    supportsSceneTerminationDistance: true,
                },
            ),
            atmosphere: section(
                'atmosphere-canonical-flat-altitude',
                ['canonical-atmosphere', 'flat-altitude-density'],
                this._constants.atmosphere,
            ),
            lightSource: section(
                'light-local-sun',
                ['local-light-source'],
                {
                    sourceKey: localFlat.sourceKey,
                    sourcePositionMeters: localFlat.sourcePositionMeters,
                    referenceDistanceMeters: localFlat.referenceDistanceMeters,
                    referenceSpectralIncidentScale: localFlat.referenceSpectralIncidentScale,
                    radiusMeters: localFlat.radiusMeters,
                    distanceFalloff: localFlat.distanceFalloff,
                    spectralScaleKind: 'neutral-no-tint',
                },
            ),
            cache: section(
                'cache-local-l2',
                ['incident-radiance-cache', 'local-cache', 'cache-owned-texture-access'],
                {
                    cacheKind: 'local',
                    sourceKey: localFlat.sourceKey,
                    textureId: texture.textureId,
                    textureKind: texture.kind,
                    textureFormat: texture.format,
                    samplerPolicy: texture.samplerPolicy,
                    coordinateOrder: texture.coordinateOrder,
                    depthPacking: cachePayload.lookup.depthPacking,
                    lookupPolicy: cachePayload.lookup.policy,
                    directionSequence: cachePayload.lookup.directionSequence,
                    directionWeight: cachePayload.lookup.directionWeight,
                    directionCount: texture.width,
                    rhoBinCount: texture.height,
                    zBinCount: cachePayload.lookup.zBinsMeters.length,
                    spectralGroupSize: texture.spectralGroupSize,
                    spectralGroupCount: texture.spectralGroupCount,
                    spectralChannelCount: texture.spectralChannelCount,
                    zBinsMeters: cachePayload.lookup.zBinsMeters,
                    rhoBinsMeters: cachePayload.lookup.rhoBinsMeters,
                    textureDimensions: Object.freeze([texture.width, texture.height, texture.depth]),
                    uploadValueCount: texture.rgbaFloat32.length,
                    ...(request.cacheOptimization ?? {}),
                },
            ),
            transport: section(
                'transport-algorithm32',
                ['algorithm32-transport'],
                {
                    ...this._constants.runtimeNumericalControls,
                    ...(request.transportOptimization ?? {}),
                },
            ),
            color: section(
                'color-bruneton-display',
                ['bruneton-display'],
                this._colorDisplayModel.describeDisplayConversion(),
            ),
            runtime: section(
                'runtime-three-postprocess-local-flat',
                ['three-fragment-shader', 'single-camera'],
                {
                    output: 'display-rgba',
                    depthPolicy: 'explicit-hit-mask-plus-opaque-hit-distance',
                    unsupportedDepthConfigurations: 'fail-configuration',
                    runtimeBoundaryPolicy: 'log-and-continue',
                    diagnosticCacheLookup: normalizeDiagnosticCacheLookup(
                        request.diagnosticCacheLookup,
                        cachePayload,
                        localFlat,
                    ),
                    diagnosticFlatGeometry: normalizeDiagnosticFlatGeometry(request.diagnosticFlatGeometry),
                },
            ),
        });
        const body = Object.freeze({
            descriptorId: 'algorithm32-local-flat-shader-descriptor',
            variantId,
            compatibilityTags,
            ...sections,
        });

        return Object.freeze({
            ...body,
            fingerprint: stableHash(body),
        });
    }
}

function normalizeLocalFlatFacts(localFlat, seed) {
    const candidate = localFlat && typeof localFlat === 'object'
        ? localFlat
        : {};
    const scene = seed.currentReviewScenes[0];
    const observerPositionMeters = vector3(
        candidate.observerPositionMeters ?? seed.observerPositionMeters,
        'localFlat.observerPositionMeters',
    );
    const sourcePositionMeters = vector3(
        candidate.sourcePositionMeters ?? scene.sourcePositionMeters,
        'localFlat.sourcePositionMeters',
    );
    const observerCenteredDome = normalizeObserverCenteredDome(
        candidate.observerCenteredDome ?? seed.observerCenteredDome ?? null,
        observerPositionMeters,
    );

    return Object.freeze({
        sourceKey: stringOrDefault(candidate.sourceKey, scene.id),
        observerPositionMeters,
        sourcePositionMeters,
        topAltitudeMeters: positiveNumber(
            candidate.topAltitudeMeters ?? seed.topAltitudeMeters,
            'localFlat.topAltitudeMeters',
        ),
        sceneSkyRayLimitMeters: positiveNumber(
            candidate.sceneSkyRayLimitMeters ?? seed.sceneSkyRayLimitMeters,
            'localFlat.sceneSkyRayLimitMeters',
        ),
        observerCenteredDome,
        referenceDistanceMeters: positiveNumber(
            candidate.referenceDistanceMeters ?? seed.referenceDistanceMeters,
            'localFlat.referenceDistanceMeters',
        ),
        referenceSpectralIncidentScale: finiteNumber(
            candidate.referenceSpectralIncidentScale
                ?? scene.referenceSpectralIncidentScale
                ?? seed.referenceSpectralIncidentScale,
            'localFlat.referenceSpectralIncidentScale',
        ),
        radiusMeters: positiveNumber(
            candidate.radiusMeters ?? seed.sourceRadiusMeters,
            'localFlat.radiusMeters',
        ),
        distanceFalloff: candidate.distanceFalloff !== false,
    });
}

function normalizeObserverCenteredDome(value, observerPositionMeters) {
    if (!value) {
        return null;
    }

    const candidate = value && typeof value === 'object'
        ? value
        : {};
    const centerPolicy = stringOrDefault(candidate.centerPolicy, 'observer-centered');

    if (centerPolicy !== 'observer-centered') {
        throw new RangeError('localFlat.observerCenteredDome only supports observer-centered policy.');
    }

    if (Array.isArray(candidate.sphereCenterMeters) && Number.isFinite(candidate.sphereRadiusMeters)) {
        return Object.freeze({
            centerPolicy,
            apexAltitudeMeters: finiteNumber(
                candidate.apexAltitudeMeters,
                'localFlat.observerCenteredDome.apexAltitudeMeters',
            ),
            maxObserverViewRayExtentMeters: positiveNumber(
                candidate.maxObserverViewRayExtentMeters,
                'localFlat.observerCenteredDome.maxObserverViewRayExtentMeters',
            ),
            observerAltitudeMeters: finiteNumber(
                candidate.observerAltitudeMeters ?? observerPositionMeters[2],
                'localFlat.observerCenteredDome.observerAltitudeMeters',
            ),
            sphereCenterMeters: vector3(
                candidate.sphereCenterMeters,
                'localFlat.observerCenteredDome.sphereCenterMeters',
            ),
            sphereRadiusMeters: positiveNumber(
                candidate.sphereRadiusMeters,
                'localFlat.observerCenteredDome.sphereRadiusMeters',
            ),
        });
    }

    const apexAltitudeMeters = finiteNumber(
        candidate.apexAltitudeMeters,
        'localFlat.observerCenteredDome.apexAltitudeMeters',
    );
    const maxObserverViewRayExtentMeters = positiveNumber(
        candidate.maxObserverViewRayExtentMeters,
        'localFlat.observerCenteredDome.maxObserverViewRayExtentMeters',
    );
    const observerAltitudeMeters = observerPositionMeters[2];

    if (apexAltitudeMeters <= observerAltitudeMeters) {
        throw new RangeError('localFlat.observerCenteredDome.apexAltitudeMeters must be above the observer.');
    }

    const centerZ = (
        apexAltitudeMeters ** 2
        - observerAltitudeMeters ** 2
        - maxObserverViewRayExtentMeters ** 2
    ) / (2 * (apexAltitudeMeters - observerAltitudeMeters));
    const sphereRadiusMeters = apexAltitudeMeters - centerZ;

    if (!Number.isFinite(centerZ) || !Number.isFinite(sphereRadiusMeters) || sphereRadiusMeters <= 0) {
        throw new RangeError('localFlat.observerCenteredDome produced an invalid derived sphere.');
    }

    return Object.freeze({
        centerPolicy,
        apexAltitudeMeters,
        maxObserverViewRayExtentMeters,
        observerAltitudeMeters,
        sphereCenterMeters: Object.freeze([
            observerPositionMeters[0],
            observerPositionMeters[1],
            centerZ,
        ]),
        sphereRadiusMeters,
    });
}

function normalizeLocalCachePayload(cachePayload, localFlat) {
    if (!cachePayload || typeof cachePayload !== 'object') {
        throw new TypeError('LocalFlatShaderDescriptorBuilder requires cachePayload.');
    }
    const texture = cachePayload.texture;
    const lookup = cachePayload.lookup;

    if (
        cachePayload.payloadKind !== 'local-incident-radiance-cache'
        || !texture
        || texture.kind !== 'rgba32f-3d-texture-v1'
        || texture.dimensionality !== '3d'
        || texture.format !== 'rgba32f'
        || !Array.isArray(texture.rgbaFloat32)
        || texture.rgbaFloat32.length !== texture.width * texture.height * texture.depth * 4
        || !lookup
        || lookup.policy !== 'z-rho-bin-all-directions'
        || !Array.isArray(lookup.zBinsMeters)
        || !Array.isArray(lookup.rhoBinsMeters)
    ) {
        throw new TypeError('Local cache payload must be an uploadable local rgba32f 3D texture payload.');
    }

    return Object.freeze({
        ...cachePayload,
        texture,
        lookup: Object.freeze({
            policy: lookup.policy,
            directionSequence: lookup.directionSequence ?? 'fibonacci-sphere',
            directionWeight: finiteNumber(
                lookup.directionWeight ?? ((4 * Math.PI) / texture.width),
                'cachePayload.lookup.directionWeight',
            ),
            zBinsMeters: Object.freeze([...lookup.zBinsMeters]),
            rhoBinsMeters: Object.freeze([...lookup.rhoBinsMeters]),
            depthPacking: lookup.depthPacking ?? 'z-bin-major-spectral-group-minor',
            diagnosticSourceKey: localFlat.sourceKey,
        }),
    });
}

function normalizeDiagnosticCacheLookup(value, cachePayload, localFlat) {
    const candidate = value && typeof value === 'object'
        ? value
        : {};
    const zBinIndex = clampInteger(candidate.zBinIndex, 0, cachePayload.lookup.zBinsMeters.length - 1, 0);
    const rhoBinIndex = clampInteger(candidate.rhoBinIndex, 0, cachePayload.lookup.rhoBinsMeters.length - 1, 0);
    const directionIndex = clampInteger(candidate.directionIndex, 0, cachePayload.texture.width - 1, 0);
    const spectralChannelCount = cachePayload.texture.spectralChannelCount;
    const sourceSubpointMeters = [
        localFlat.sourcePositionMeters[0],
        localFlat.sourcePositionMeters[1],
        0,
    ];

    return Object.freeze({
        enabled: candidate.enabled === true,
        zBinIndex,
        rhoBinIndex,
        directionIndex,
        positionMeters: Object.freeze([
            sourceSubpointMeters[0] + cachePayload.lookup.rhoBinsMeters[rhoBinIndex],
            sourceSubpointMeters[1],
            cachePayload.lookup.zBinsMeters[zBinIndex],
        ]),
        redChannelIndex: clampInteger(candidate.redChannelIndex, 0, spectralChannelCount - 1, 10),
        greenChannelIndex: clampInteger(candidate.greenChannelIndex, 0, spectralChannelCount - 1, 6),
        blueChannelIndex: clampInteger(candidate.blueChannelIndex, 0, spectralChannelCount - 1, 2),
        outputScale: finiteNumber(candidate.outputScale ?? 1, 'diagnosticCacheLookup.outputScale'),
    });
}

function normalizeDiagnosticFlatGeometry(value) {
    const candidate = value && typeof value === 'object'
        ? value
        : {};
    const mode = typeof candidate.mode === 'string' ? candidate.mode : 'none';
    const modeId = {
        none: 0,
        'ray-direction': 1,
        'path-bounds': 2,
        'cache-coordinate': 3,
    }[mode] ?? 0;

    return Object.freeze({
        enabled: candidate.enabled === true && modeId > 0,
        mode,
        modeId,
        distanceScaleMeters: positiveNumber(
            candidate.distanceScaleMeters ?? 1,
            'diagnosticFlatGeometry.distanceScaleMeters',
        ),
        altitudeScaleMeters: positiveNumber(
            candidate.altitudeScaleMeters ?? 1,
            'diagnosticFlatGeometry.altitudeScaleMeters',
        ),
    });
}

function section(descriptorId, compatibilityTags, facts) {
    const body = Object.freeze({
        descriptorId,
        compatibilityTags: Object.freeze([...compatibilityTags]),
        facts: deepFreeze(cloneJson(facts)),
    });

    return Object.freeze({
        ...body,
        fingerprint: stableHash(body),
    });
}

function vector3(value, fieldName) {
    if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
        throw new TypeError(`${fieldName} must be a finite vec3.`);
    }
    return Object.freeze([...value]);
}

function positiveNumber(value, fieldName) {
    if (!Number.isFinite(value) || value <= 0) {
        throw new TypeError(`${fieldName} must be a positive finite number.`);
    }
    return value;
}

function finiteNumber(value, fieldName) {
    if (!Number.isFinite(value)) {
        throw new TypeError(`${fieldName} must be finite.`);
    }
    return value;
}

function stringOrDefault(value, fallback) {
    return typeof value === 'string' && value ? value : fallback;
}

function clampInteger(value, min, max, fallback) {
    const rounded = Number.isFinite(value) ? Math.round(value) : fallback;
    return Math.max(min, Math.min(max, rounded));
}

function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value) {
    if (Array.isArray(value)) {
        value.forEach(deepFreeze);
    } else if (value && typeof value === 'object') {
        Object.values(value).forEach(deepFreeze);
    }

    return Object.freeze(value);
}
