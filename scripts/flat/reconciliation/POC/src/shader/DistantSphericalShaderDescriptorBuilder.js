// References:
// - agents/topics/apps/flat/reconciliation/shader-design.md, setup/config lifecycle descriptors.
// - scripts/flat/reconciliation/POC/src/constants/consts.js, canonical Algorithm32 constants.

import BrunetonColorDisplayModel from '../color/BrunetonColorDisplayModel.js';
import { ALGORITHM32_BASELINE_CONSTANTS } from '../constants/consts.js';
import { stableHash } from '../provenance/stableHash.js';

const DEFAULT_TAGS = Object.freeze([
    'algorithm32',
    'distant-light-source',
    'spherical-geometry',
    'bruneton-display',
]);

export default class DistantSphericalShaderDescriptorBuilder {
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
     * @param {ShaderDescriptorBuildRequest} [request] - Descriptor build request.
     * @returns {Algorithm32ShaderDescriptor} Shader descriptor.
     */
    build(request = {}) {
        const variantId = request.variantId ?? 'algorithm32-distant-spherical-first-pass';
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
                'geometry-spherical-earth',
                ['spherical-geometry'],
                {
                    coordinateFrame: 'earth-centered-world-with-observer-local-y-up-scene-frame',
                    bottomRadiusMeters: this._constants.atmosphere.bottomRadiusMeters,
                    topRadiusMeters: this._constants.atmosphere.topRadiusMeters,
                    observerUpDirection: Object.freeze([1, 0, 0]),
                    observerLocalSceneFrame: Object.freeze({
                        up: Object.freeze([1, 0, 0]),
                        right: Object.freeze([0, 1, 0]),
                        forward: Object.freeze([0, 0, -1]),
                    }),
                    cacheBoundaryAltitudeMeters: 2,
                    supportsSceneTerminationDistance: true,
                },
            ),
            atmosphere: section(
                'atmosphere-canonical',
                ['canonical-atmosphere'],
                this._constants.atmosphere,
            ),
            lightSource: section(
                'light-distant-sun',
                ['distant-light-source'],
                this._constants.distantSun,
            ),
            cache: section(
                'cache-distant-l2',
                ['incident-radiance-cache', 'cache-owned-texture-access'],
                {
                    cacheKind: 'distant-sun-incident-radiance-l2',
                    coordinateFrame: 'light-source-relative',
                    incidentDirectionCount: this._constants.runtimeNumericalControls.incidentDirectionCount,
                    incidentAltitudeBinCount: this._constants.runtimeNumericalControls.incidentAltitudeBinCount,
                    spectralChannelCount: this._constants.spectralChannels.length,
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
                'runtime-three-postprocess',
                ['three-fragment-shader', 'single-camera'],
                {
                    output: 'display-rgba',
                    depthPolicy: 'explicit-hit-mask-plus-opaque-hit-distance',
                    unsupportedDepthConfigurations: 'fail-configuration',
                    runtimeBoundaryPolicy: 'log-and-continue',
                },
            ),
        });
        const body = Object.freeze({
            descriptorId: 'algorithm32-shader-descriptor',
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
