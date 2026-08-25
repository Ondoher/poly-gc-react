// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   directional extended-source transport and conservative pixel integration.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import ExternalCelestialSource from '../external-celestial-sources/ExternalCelestialSource.js';
import {
    EXTENDED_CELESTIAL_SOURCE,
    SPECTRAL_RADIANCE_DENSITY,
} from '../external-celestial-sources/consts.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';
import PerspectiveCameraRaster from '../camera/PerspectiveCameraRaster.js';
import SphericalCapQuadrature from './SphericalCapQuadrature.js';

const CANONICAL_CHANNEL_COUNT = 15;
const TRANSMITTANCE_UNITS = '1';
const RADIANCE_UNITS = 'W m^-2 sr^-1 nm^-1';
const INTEGRATED_RADIANCE_UNITS = 'W m^-2 nm^-1';
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;
const CONFIGURATION_FIELDS = Object.freeze([
    'camera',
    'visibilityResolver',
    'transmittanceSampler',
]);
const REQUEST_FIELDS = Object.freeze([
    'source',
    'sourceDepth',
    'radialCount',
    'azimuthCount',
]);
const COVERAGE_AND_OPACITY_FIELDS = Object.freeze([
    'coverage',
    'geometryCoverage',
    'remainingCoverage',
    'opacity',
    'alpha',
]);
const TRANSMITTANCE_SHORTCUT_FIELDS = Object.freeze([
    'centerTransmittance',
    'centerSpectralTransmittance',
    'diskCenterTransmittance',
    'sourceCenterTransmittance',
    'destinationRayTransmittance',
    'destinationRayTransmittances',
    'destinationTransmittance',
    'destinationTransmittances',
    'pixelTransmittance',
    'pixelTransmittances',
    'perPixelTransmittance',
    'spectralTransmittance',
    'transmittance',
    'transmittanceByDestination',
    'transmittanceByPixel',
    'viewTransmittance',
    'viewTransmittances',
]);
const PATH_AND_DISPLAY_FIELDS = Object.freeze([
    'baseRadiance',
    'displayRgb',
    'endpointRadiance',
    'finalDisplay',
    'finalDisplayRgb',
    'pathRadiance',
    'pathSpectralRadiance',
    'spectralPathRadiance',
]);

export default class TransportedExtendedSourceIntegrator {
    /**
     * @param {TransportedExtendedSourceIntegratorConfiguration} configuration - Directional transport dependencies.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw configurationError('ER4C_EXTENDED_INTEGRATOR_CONFIGURATION_REQUIRED',
                'Transported extended-source integrator configuration is required.');
        }
        rejectProhibitedFields(configuration, 'configuration');
        rejectUnknownFields(configuration, CONFIGURATION_FIELDS, 'configuration');
        if (!(configuration.camera instanceof PerspectiveCameraRaster)) {
            throw configurationError('ER4C_EXTENDED_INTEGRATOR_CAMERA_REQUIRED',
                'Transported extended-source integrator requires a PerspectiveCameraRaster.');
        }

        const visibility = normalizeCallbackProvider(
            configuration.visibilityResolver,
            'resolveExtendedSampleVisibility',
            'ER4C_EXTENDED_INTEGRATOR_VISIBILITY_RESOLVER_INVALID',
        );
        const transmittance = normalizeCallbackProvider(
            configuration.transmittanceSampler,
            'sampleExtendedSampleTransmittance',
            'ER4C_EXTENDED_INTEGRATOR_TRANSMITTANCE_SAMPLER_INVALID',
        );

        this.camera = configuration.camera;
        this.visibilityResolverFingerprint = visibility.fingerprint;
        this.visibilityResolverKind = visibility.providerKind;
        this.visibilityResolverFingerprintDerivation = visibility.fingerprintDerivation;
        this.transmittanceSamplerFingerprint = transmittance.fingerprint;
        this.transmittanceSamplerKind = transmittance.providerKind;
        this.transmittanceSamplerFingerprintDerivation = transmittance.fingerprintDerivation;
        this._resolveExtendedSampleVisibility = visibility.callback;
        this._sampleExtendedSampleTransmittance = transmittance.callback;
        this.fingerprint = stableHash(this.describe());
        Object.freeze(this);
    }

    /**
     * Describe the reset-only extended transport owner and its exclusions.
     *
     * @returns {Readonly<Record<string, unknown>>} Immutable integrator descriptor.
     */
    describe() {
        return Object.freeze({
            kind: 'transported-extended-source-integrator-v1',
            channelCount: CANONICAL_CHANNEL_COUNT,
            physicalOrder: Object.freeze([
                'sample top-of-atmosphere radiance once at each quadrature direction',
                'resolve visibility once at that direction and source depth',
                'sample aligned transmittance once at the same direction only when visible',
                'multiply top-of-atmosphere radiance by transmittance once',
                'accumulate transported radiance times quadrature solid-angle weight',
                'divide each on-frame integral by exact destination-pixel solid angle',
            ]),
            rasterAssignment: 'nearest-destination-pixel-from-exact-sample-direction',
            cameraFingerprint: this.camera.fingerprint,
            visibilityResolverFingerprint: this.visibilityResolverFingerprint,
            visibilityResolverKind: this.visibilityResolverKind,
            visibilityResolverFingerprintDerivation:
                this.visibilityResolverFingerprintDerivation,
            transmittanceSamplerFingerprint: this.transmittanceSamplerFingerprint,
            transmittanceSamplerKind: this.transmittanceSamplerKind,
            transmittanceSamplerFingerprintDerivation:
                this.transmittanceSamplerFingerprintDerivation,
            sourceQuantity: SPECTRAL_RADIANCE_DENSITY,
            sourceUnits: RADIANCE_UNITS,
            transmittanceUnits: TRANSMITTANCE_UNITS,
            outputQuantity: 'transported-extended-spectral-radiance-density',
            outputUnits: RADIANCE_UNITS,
            executionPath: 'directional-spherical-cap-quadrature-only',
            collapsedOptimization: 'absent',
            excludedInputs: Object.freeze([
                'coverage-or-opacity',
                'source-center-or-destination-transmittance',
                'path-or-endpoint-radiance',
                'display-values',
            ]),
            outsideThisClass: Object.freeze([
                'path-radiance-integration',
                'endpoint-radiance-composition',
                'final-display-transform',
            ]),
        });
    }

    /**
     * Integrate one typed extended source in physical directional order.
     *
     * @param {TransportedExtendedSourceIntegrationRequest} request - Source, depth, and quadrature controls.
     * @returns {TransportedExtendedSourceIntegration} Conservative transport diagnostics.
     */
    integrate(request) {
        const prepared = prepareRequest(request);
        const source = prepared.source;
        const packet = source.packet;
        const basisFingerprint = packet.basis.fingerprint;
        const sourceDescriptor = Object.freeze({
            id: source.source.id,
            kind: source.source.kind,
            geometry: source.source.geometry,
            fingerprint: source.source.fingerprint,
        });
        const quadrature = new SphericalCapQuadrature({
            angularRadiusRadians: source.angularRadiusRadians,
            radialCount: prepared.radialCount,
            azimuthCount: prepared.azimuthCount,
        });
        const quadratureSamples = quadrature.sample(source.centerDirectionCamera);
        const quadratureDescriptor = describeQuadrature(quadrature, quadratureSamples);
        const totals = createPartitions();
        const pixelMap = new Map();
        const samples = [];
        const solidAngles = createSolidAngleAccounting();

        for (const sample of quadratureSamples) {
            const topOfAtmosphere = validateRadianceSample(
                source.radianceForSample(sample),
                packet.values.length,
            );
            const exactSampleRay = Object.freeze({
                source: sourceDescriptor,
                directionCamera: sample.directionCamera,
                directionFrame: 'camera-space-unit-vector-forward-minus-z',
                depth: prepared.sourceDepth,
            });
            const visibility = validateAndFreezeVisibility(
                this._resolveExtendedSampleVisibility(exactSampleRay),
            );
            let transmittance = null;
            let transmitted = zeroSpectrum();
            if (visibility.visible) {
                transmittance = validateAndFreezeTransmittance(
                    this._sampleExtendedSampleTransmittance(exactSampleRay),
                    basisFingerprint,
                    packet.values.length,
                    this.transmittanceSamplerFingerprint,
                );
                transmitted = multiplySpectraOnce(topOfAtmosphere, transmittance.values);
            }
            const blocked = visibility.visible ? zeroSpectrum() : topOfAtmosphere;
            const visible = visibility.visible ? topOfAtmosphere : zeroSpectrum();
            const atmosphericAttenuation = visibility.visible
                ? subtractSpectra(visible, transmitted, 'sample atmospheric attenuation')
                : zeroSpectrum();
            const weight = sample.solidAngleWeightSteradians;
            const projectedWeight = weight * sample.cosTheta;
            const raster = resolveNearestRaster(this.camera, sample.directionCamera);
            const destination = raster.onFrame ? totals.onFrame : totals.offRaster;

            addWeightedSpectrum(totals.total.input, topOfAtmosphere, weight, projectedWeight);
            addWeightedSpectrum(totals.total.visible, visible, weight, projectedWeight);
            addWeightedSpectrum(totals.total.blocked, blocked, weight, projectedWeight);
            addWeightedSpectrum(totals.total.atmosphericAttenuation,
                atmosphericAttenuation, weight, projectedWeight);
            addWeightedSpectrum(totals.total.transmitted, transmitted, weight, projectedWeight);
            addWeightedSpectrum(destination.input, topOfAtmosphere, weight, projectedWeight);
            addWeightedSpectrum(destination.visible, visible, weight, projectedWeight);
            addWeightedSpectrum(destination.blocked, blocked, weight, projectedWeight);
            addWeightedSpectrum(destination.atmosphericAttenuation,
                atmosphericAttenuation, weight, projectedWeight);
            addWeightedSpectrum(destination.transmitted, transmitted, weight, projectedWeight);
            accumulateSolidAngles(solidAngles, visibility.visible, raster.onFrame, weight);

            if (raster.onFrame) {
                accumulatePixel(pixelMap, this.camera, raster, {
                    topOfAtmosphere,
                    visible,
                    blocked,
                    atmosphericAttenuation,
                    transmitted,
                    weight,
                    projectedWeight,
                    isVisible: visibility.visible,
                });
            }

            samples.push(createSampleEvidence({
                sample,
                exactSampleRay,
                topOfAtmosphere,
                visibility,
                transmittance,
                transmitted,
                raster,
                basisFingerprint,
                visibilityResolverFingerprint: this.visibilityResolverFingerprint,
                transmittanceSamplerFingerprint: this.transmittanceSamplerFingerprint,
            }));
        }

        const pixels = freezePixels(pixelMap, basisFingerprint);
        const reconstructedOnFrame = reconstructOnFrame(pixels);
        const integrals = freezePartitions(totals, basisFingerprint);
        const conservation = createConservationDiagnostics({
            totals,
            reconstructedOnFrame,
            solidAngles,
            quadratureDescriptor,
            basisFingerprint,
        });

        return Object.freeze({
            source: source.source.describe(),
            sourceDepth: prepared.sourceDepth,
            centerDirectionCamera: source.centerDirectionCamera,
            angularRadiusRadians: source.angularRadiusRadians,
            quadrature: quadratureDescriptor,
            pixels,
            samples: Object.freeze(samples),
            integrals,
            reconstructedOnFrameSpectralIntegral: integratedSpectrum(
                reconstructedOnFrame,
                basisFingerprint,
                'reconstructed-on-frame-transported-spectral-radiance-solid-angle-integral',
            ),
            derivedCoverage: freezeDerivedCoverage(solidAngles),
            componentConservation: conservation,
            transportCalls: Object.freeze({
                physicalOrder: this.describe().physicalOrder,
                sampleCount: samples.length,
                radianceSampleCallCount: samples.length,
                visibilityCallCount: samples.length,
                transmittanceCallCount: samples.reduce((sum, entry) =>
                    sum + entry.transportCalls.transmittance.callCount, 0),
                sameDirectionAndDepthObjectForVisibleCallbacks: samples
                    .filter((entry) => entry.visibility.visible)
                    .every((entry) => entry.transportCalls.sameExactSampleRayObject),
            }),
            quantity: Object.freeze({
                source: SPECTRAL_RADIANCE_DENSITY,
                transmitted: SPECTRAL_RADIANCE_DENSITY,
                destination: 'transported-extended-spectral-radiance-density',
                pathRadianceOwnership: 'outside-this-class',
                finalDisplayOwnership: 'outside-this-class',
                coverage: 'derived-diagnostic-only',
            }),
            units: Object.freeze({
                sourceSpectralRadiance: RADIANCE_UNITS,
                transmittance: TRANSMITTANCE_UNITS,
                spectralRadianceSolidAngleIntegral: INTEGRATED_RADIANCE_UNITS,
                projectedSpectralIrradiance: INTEGRATED_RADIANCE_UNITS,
                destinationSpectralRadiance: RADIANCE_UNITS,
                solidAngle: 'sr',
                sourceDepth: 'm',
            }),
            fingerprints: Object.freeze({
                integrator: this.fingerprint,
                camera: this.camera.fingerprint,
                visibilityResolver: this.visibilityResolverFingerprint,
                transmittanceSampler: this.transmittanceSamplerFingerprint,
                source: source.source.fingerprint,
                sourceSpectrum: packet.fingerprint,
                basis: basisFingerprint,
                quadrature: quadratureDescriptor.fingerprint,
            }),
        });
    }
}

function prepareRequest(request) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_REQUEST_REQUIRED',
            'Transported extended-source integration request is required.');
    }
    rejectProhibitedFields(request, 'integration request');
    rejectUnknownFields(request, REQUEST_FIELDS, 'integration request');
    const source = request.source;
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_SOURCE_MODEL_REQUIRED',
            'Transported extended-source integration requires a source model.');
    }
    rejectProhibitedFields(source, 'extended source model');
    if (!(source.source instanceof ExternalCelestialSource)) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_TYPED_SOURCE_REQUIRED',
            'Extended source model requires an ExternalCelestialSource owner.');
    }
    if (
        source.source.kind !== EXTENDED_CELESTIAL_SOURCE
        || source.source.spectralMeasure.quantity !== SPECTRAL_RADIANCE_DENSITY
    ) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_RADIANCE_REQUIRED',
            'Transported extended-source integrator accepts typed extended radiance only.');
    }
    if (source.packet !== source.source.spectralMeasure) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_PACKET_OWNER_MISMATCH',
            'Extended source packet must be the canonical source spectral measure.');
    }
    if (
        source.packet.units !== RADIANCE_UNITS
        || source.packet.values.length !== CANONICAL_CHANNEL_COUNT
    ) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_CANONICAL_SPECTRUM_REQUIRED',
            'Extended source must provide 15 aligned channels in W m^-2 sr^-1 nm^-1.', {
                channelCount: source.packet.values.length,
                units: source.packet.units,
            });
    }
    if (typeof source.radianceForSample !== 'function') {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_RADIANCE_SAMPLER_REQUIRED',
            'Extended source model requires radianceForSample.');
    }
    validateUnitDirection(source.centerDirectionCamera);
    if (
        !Number.isFinite(source.angularRadiusRadians)
        || source.angularRadiusRadians <= 0
        || source.angularRadiusRadians >= Math.PI / 2
    ) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_ANGULAR_RADIUS_INVALID',
            'Extended source angular radius must be finite in (0, pi/2).');
    }
    const radialCount = requirePositiveInteger(request.radialCount, 'radialCount');
    const azimuthCount = requirePositiveInteger(request.azimuthCount, 'azimuthCount');
    return Object.freeze({
        source,
        sourceDepth: validateAndFreezeDepth(request.sourceDepth),
        radialCount,
        azimuthCount,
    });
}

function normalizeCallbackProvider(provider, callbackName, code) {
    let callback;
    let providerKind;
    if (typeof provider === 'function') {
        callback = provider;
        providerKind = 'plain-function';
    } else if (
        provider
        && typeof provider === 'object'
        && typeof provider[callbackName] === 'function'
    ) {
        callback = provider[callbackName].bind(provider);
        providerKind = 'method-provider';
    } else {
        throw configurationError(code,
            `${callbackName} requires a callback function or provider method.`);
    }

    const suppliedFingerprint = provider.fingerprint;
    const fingerprint = FINGERPRINT_PATTERN.test(suppliedFingerprint ?? '')
        ? suppliedFingerprint
        : stableHash({
            kind: 'inline-callback-source-text-v1',
            callbackName,
            implementation: Function.prototype.toString.call(
                typeof provider === 'function' ? provider : provider[callbackName],
            ),
        });
    return Object.freeze({
        callback,
        providerKind,
        fingerprint,
        fingerprintDerivation: FINGERPRINT_PATTERN.test(suppliedFingerprint ?? '')
            ? 'supplied-sha256'
            : 'stable-sha256-of-callback-source-text',
    });
}

function validateAndFreezeDepth(depth) {
    if (!depth || typeof depth !== 'object' || Array.isArray(depth)) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_DEPTH_REQUIRED',
            'Extended source depth requires a finite or infinite descriptor.');
    }
    rejectProhibitedFields(depth, 'source depth');
    if (depth.kind === 'finite') {
        rejectUnknownFields(depth, ['kind', 'distanceMeters'], 'finite source depth');
        if (!Number.isFinite(depth.distanceMeters) || depth.distanceMeters <= 0) {
            throw configurationError('ER4C_EXTENDED_INTEGRATOR_FINITE_DEPTH_INVALID',
                'Finite extended source depth must be positive meters.');
        }
        return Object.freeze({ kind: 'finite', distanceMeters: depth.distanceMeters });
    }
    if (depth.kind === 'infinite') {
        rejectUnknownFields(depth, ['kind'], 'infinite source depth');
        return Object.freeze({ kind: 'infinite' });
    }
    throw configurationError('ER4C_EXTENDED_INTEGRATOR_DEPTH_KIND_INVALID',
        'Extended source depth kind must be finite or infinite.');
}

function validateRadianceSample(values, channelCount) {
    if (
        !Array.isArray(values)
        || values.length !== channelCount
        || !values.every((value) => Number.isFinite(value) && value >= 0)
    ) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_RADIANCE_SAMPLE_INVALID',
            'Extended radiance sampler must return aligned finite nonnegative values.');
    }
    return Object.freeze([...values]);
}

function validateAndFreezeVisibility(result) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_VISIBILITY_RESULT_INVALID',
            'Extended-sample visibility resolver must return an object.');
    }
    rejectProhibitedFields(result, 'visibility result');
    if (typeof result.visible !== 'boolean') {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_VISIBILITY_BOOLEAN_REQUIRED',
            'Extended-sample visibility result requires a visible boolean.');
    }
    if (result.visible && result.occluder !== null) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_VISIBLE_OCCLUDER_INVALID',
            'A visible extended-source sample must report a null occluder.');
    }
    if (
        !result.visible
        && (!result.occluder || typeof result.occluder !== 'object'
            || Array.isArray(result.occluder))
    ) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_BLOCKED_OCCLUDER_REQUIRED',
            'A blocked extended-source sample must retain an occluder descriptor.');
    }
    try {
        return Object.freeze({
            visible: result.visible,
            occluder: result.visible ? null : freezeJsonValue(result.occluder),
            diagnostics: result.diagnostics == null
                ? null
                : freezeJsonValue(result.diagnostics),
        });
    } catch (error) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_OCCLUDER_INVALID',
            'Extended-source occluder must be finite JSON diagnostics.', {
                cause: error.message,
            });
    }
}

function validateAndFreezeTransmittance(
    result,
    basisFingerprint,
    channelCount,
    samplerFingerprint,
) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_TRANSMITTANCE_RESULT_INVALID',
            'Extended-sample transmittance sampler must return a typed object.');
    }
    rejectProhibitedFields(result, 'transmittance result');
    rejectUnknownFields(
        result,
        ['units', 'basisFingerprint', 'values'],
        'transmittance result',
    );
    if (result.units !== TRANSMITTANCE_UNITS) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_TRANSMITTANCE_UNITS_INVALID',
            'Extended-sample transmittance must use dimensionless units 1.');
    }
    if (result.basisFingerprint !== basisFingerprint) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_TRANSMITTANCE_BASIS_MISMATCH',
            'Extended-sample transmittance must align with the source basis fingerprint.');
    }
    if (
        !Array.isArray(result.values)
        || result.values.length !== channelCount
        || !result.values.every((value) =>
            Number.isFinite(value) && value >= 0 && value <= 1)
    ) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_TRANSMITTANCE_VALUES_INVALID',
            'Extended-sample transmittance requires aligned finite values in [0, 1].');
    }
    return Object.freeze({
        quantity: 'spectral-transmittance',
        units: TRANSMITTANCE_UNITS,
        basisFingerprint,
        values: Object.freeze([...result.values]),
        samplerFingerprint,
    });
}

function describeQuadrature(quadrature, samples) {
    const expectedSolidAngleSteradians = quadrature.expectedSolidAngleSteradians();
    const sampledSolidAngleSteradians = samples.reduce((sum, sample) =>
        sum + sample.solidAngleWeightSteradians, 0);
    const solidAngleResidualSteradians = sampledSolidAngleSteradians
        - expectedSolidAngleSteradians;
    const descriptor = {
        method: 'spherical-cap-midpoint-equal-solid-angle-v1',
        angularRadiusRadians: quadrature.angularRadiusRadians,
        radialCount: quadrature.radialCount,
        azimuthCount: quadrature.azimuthCount,
        sampleCount: samples.length,
        expectedSolidAngleSteradians,
        sampledSolidAngleSteradians,
        solidAngleResidualSteradians,
        relativeSolidAngleResidual: solidAngleResidualSteradians
            / expectedSolidAngleSteradians,
    };
    return Object.freeze({ ...descriptor, fingerprint: stableHash(descriptor) });
}

function resolveNearestRaster(camera, directionCamera) {
    if (!(directionCamera[2] < 0)) {
        return Object.freeze({
            rasterCenter: null,
            pixelX: null,
            pixelY: null,
            onFrame: false,
            offRasterReason: 'outside-forward-camera-hemisphere',
        });
    }
    const rasterCenter = camera.directionToRasterCenter(directionCamera);
    const pixelX = Math.floor(rasterCenter.x + 0.5);
    const pixelY = Math.floor(rasterCenter.y + 0.5);
    const onFrame = pixelX >= 0
        && pixelX < camera.widthPixels
        && pixelY >= 0
        && pixelY < camera.heightPixels;
    return Object.freeze({
        rasterCenter,
        pixelX,
        pixelY,
        onFrame,
        offRasterReason: onFrame ? null : 'nearest-destination-outside-raster',
    });
}

function createPartitions() {
    return {
        total: createComponentSet(),
        onFrame: createComponentSet(),
        offRaster: createComponentSet(),
    };
}

function createComponentSet() {
    return {
        input: createMutableIntegral(),
        visible: createMutableIntegral(),
        blocked: createMutableIntegral(),
        atmosphericAttenuation: createMutableIntegral(),
        transmitted: createMutableIntegral(),
    };
}

function createMutableIntegral() {
    return {
        solidAngleIntegral: Array(CANONICAL_CHANNEL_COUNT).fill(0),
        projectedIrradiance: Array(CANONICAL_CHANNEL_COUNT).fill(0),
    };
}

function addWeightedSpectrum(component, values, weight, projectedWeight) {
    for (let channel = 0; channel < values.length; channel += 1) {
        component.solidAngleIntegral[channel] += values[channel] * weight;
        component.projectedIrradiance[channel] += values[channel] * projectedWeight;
    }
    requireFiniteSpectrum(component.solidAngleIntegral, 'spectral solid-angle integral');
    requireFiniteSpectrum(component.projectedIrradiance, 'projected spectral irradiance');
}

function createSolidAngleAccounting() {
    return {
        input: 0,
        visible: 0,
        blocked: 0,
        onFrame: 0,
        offRaster: 0,
        onFrameVisible: 0,
        onFrameBlocked: 0,
        offRasterVisible: 0,
        offRasterBlocked: 0,
    };
}

function accumulateSolidAngles(accounting, visible, onFrame, weight) {
    accounting.input += weight;
    accounting[visible ? 'visible' : 'blocked'] += weight;
    accounting[onFrame ? 'onFrame' : 'offRaster'] += weight;
    const partition = `${onFrame ? 'onFrame' : 'offRaster'}${visible ? 'Visible' : 'Blocked'}`;
    accounting[partition] += weight;
}

function accumulatePixel(pixelMap, camera, raster, contribution) {
    const key = `${raster.pixelX},${raster.pixelY}`;
    let pixel = pixelMap.get(key);
    if (!pixel) {
        pixel = {
            pixelX: raster.pixelX,
            pixelY: raster.pixelY,
            pixelSolidAngleSteradians: camera.pixelSolidAngleSteradians(
                raster.pixelX,
                raster.pixelY,
            ),
            inputSolidAngleSteradians: 0,
            visibleSolidAngleSteradians: 0,
            blockedSolidAngleSteradians: 0,
            components: createComponentSet(),
        };
    }
    pixel.inputSolidAngleSteradians += contribution.weight;
    pixel[contribution.isVisible
        ? 'visibleSolidAngleSteradians'
        : 'blockedSolidAngleSteradians'] += contribution.weight;
    addWeightedSpectrum(pixel.components.input, contribution.topOfAtmosphere,
        contribution.weight, contribution.projectedWeight);
    addWeightedSpectrum(pixel.components.visible, contribution.visible,
        contribution.weight, contribution.projectedWeight);
    addWeightedSpectrum(pixel.components.blocked, contribution.blocked,
        contribution.weight, contribution.projectedWeight);
    addWeightedSpectrum(pixel.components.atmosphericAttenuation,
        contribution.atmosphericAttenuation,
        contribution.weight,
        contribution.projectedWeight);
    addWeightedSpectrum(pixel.components.transmitted, contribution.transmitted,
        contribution.weight, contribution.projectedWeight);
    pixelMap.set(key, pixel);
}

function freezePixels(pixelMap, basisFingerprint) {
    return Object.freeze([...pixelMap.values()]
        .sort((left, right) => left.pixelY - right.pixelY || left.pixelX - right.pixelX)
        .map((pixel) => {
            const transportedExtendedSpectralRadianceDensity =
                pixel.components.transmitted.solidAngleIntegral.map((value) =>
                    value / pixel.pixelSolidAngleSteradians);
            requireFiniteSpectrum(
                transportedExtendedSpectralRadianceDensity,
                'destination transported extended spectral radiance density',
            );
            return Object.freeze({
                pixelX: pixel.pixelX,
                pixelY: pixel.pixelY,
                pixelSolidAngleSteradians: pixel.pixelSolidAngleSteradians,
                solidAngles: Object.freeze({
                    inputSteradians: pixel.inputSolidAngleSteradians,
                    visibleSteradians: pixel.visibleSolidAngleSteradians,
                    blockedSteradians: pixel.blockedSolidAngleSteradians,
                }),
                derivedCoverage: Object.freeze({
                    qualification: 'derived-diagnostic-only-not-an-input-or-opacity',
                    input: pixel.inputSolidAngleSteradians
                        / pixel.pixelSolidAngleSteradians,
                    visible: pixel.visibleSolidAngleSteradians
                        / pixel.pixelSolidAngleSteradians,
                    blocked: pixel.blockedSolidAngleSteradians
                        / pixel.pixelSolidAngleSteradians,
                }),
                integrals: freezeComponentSet(pixel.components, basisFingerprint),
                basisFingerprint,
                quantity: 'transported-extended-spectral-radiance-density',
                units: RADIANCE_UNITS,
                transportedExtendedSpectralRadianceDensity: Object.freeze(
                    transportedExtendedSpectralRadianceDensity,
                ),
            });
        }));
}

function freezePartitions(partitions, basisFingerprint) {
    return Object.freeze({
        total: freezeComponentSet(partitions.total, basisFingerprint),
        onFrame: freezeComponentSet(partitions.onFrame, basisFingerprint),
        offRaster: freezeComponentSet(partitions.offRaster, basisFingerprint),
    });
}

function freezeComponentSet(components, basisFingerprint) {
    return Object.freeze({
        input: freezeIntegral(components.input, basisFingerprint, 'input'),
        visible: freezeIntegral(components.visible, basisFingerprint, 'visible'),
        blocked: freezeIntegral(components.blocked, basisFingerprint, 'blocked'),
        atmosphericAttenuation: freezeIntegral(
            components.atmosphericAttenuation,
            basisFingerprint,
            'atmospheric-attenuation',
        ),
        transmitted: freezeIntegral(components.transmitted, basisFingerprint, 'transmitted'),
    });
}

function freezeIntegral(component, basisFingerprint, componentName) {
    return Object.freeze({
        spectralRadianceSolidAngleIntegral: integratedSpectrum(
            Object.freeze([...component.solidAngleIntegral]),
            basisFingerprint,
            `${componentName}-spectral-radiance-solid-angle-integral`,
        ),
        projectedSpectralIrradiance: integratedSpectrum(
            Object.freeze([...component.projectedIrradiance]),
            basisFingerprint,
            `${componentName}-projected-spectral-irradiance-density`,
        ),
    });
}

function createSampleEvidence({
    sample,
    exactSampleRay,
    topOfAtmosphere,
    visibility,
    transmittance,
    transmitted,
    raster,
    basisFingerprint,
    visibilityResolverFingerprint,
    transmittanceSamplerFingerprint,
}) {
    return Object.freeze({
        radialIndex: sample.radialIndex,
        azimuthIndex: sample.azimuthIndex,
        cosTheta: sample.cosTheta,
        rhoSquared: sample.rhoSquared,
        solidAngleWeightSteradians: sample.solidAngleWeightSteradians,
        exactSampleRay,
        raster,
        topOfAtmosphereSpectralRadiance: radianceSpectrum(
            topOfAtmosphere,
            basisFingerprint,
            'top-of-atmosphere-spectral-radiance-density',
        ),
        visibility: Object.freeze({
            visible: visibility.visible,
            occluder: visibility.occluder,
            diagnostics: visibility.diagnostics,
            resolverFingerprint: visibilityResolverFingerprint,
        }),
        transmittance,
        transmittedSpectralRadiance: radianceSpectrum(
            transmitted,
            basisFingerprint,
            'transported-extended-spectral-radiance-density',
        ),
        transportCalls: Object.freeze({
            order: Object.freeze(visibility.visible
                ? [
                    'radianceForSample',
                    'resolveExtendedSampleVisibility',
                    'sampleExtendedSampleTransmittance',
                ]
                : ['radianceForSample', 'resolveExtendedSampleVisibility']),
            radiance: Object.freeze({
                callback: 'radianceForSample',
                callCount: 1,
                directionCamera: sample.directionCamera,
            }),
            visibility: Object.freeze({
                callback: 'resolveExtendedSampleVisibility',
                callCount: 1,
                exactSampleRay,
            }),
            transmittance: Object.freeze({
                callback: 'sampleExtendedSampleTransmittance',
                callCount: visibility.visible ? 1 : 0,
                exactSampleRay: visibility.visible ? exactSampleRay : null,
                samplerFingerprint: transmittanceSamplerFingerprint,
            }),
            sameExactSampleRayObject: visibility.visible ? true : null,
            sameDirectionObject: visibility.visible ? true : null,
        }),
    });
}

function reconstructOnFrame(pixels) {
    const values = Array(CANONICAL_CHANNEL_COUNT).fill(0);
    for (const pixel of pixels) {
        for (let channel = 0; channel < CANONICAL_CHANNEL_COUNT; channel += 1) {
            values[channel] += pixel.transportedExtendedSpectralRadianceDensity[channel]
                * pixel.pixelSolidAngleSteradians;
        }
    }
    requireFiniteSpectrum(values, 'reconstructed on-frame spectral integral');
    return Object.freeze(values);
}

function freezeDerivedCoverage(solidAngles) {
    return Object.freeze({
        qualification: 'derived-diagnostic-only-not-an-input-or-opacity',
        solidAnglesSteradians: Object.freeze({ ...solidAngles }),
        fractionsOfInputSolidAngle: Object.freeze({
            visible: safeRatio(solidAngles.visible, solidAngles.input),
            blocked: safeRatio(solidAngles.blocked, solidAngles.input),
            onFrame: safeRatio(solidAngles.onFrame, solidAngles.input),
            offRaster: safeRatio(solidAngles.offRaster, solidAngles.input),
        }),
    });
}

function createConservationDiagnostics({
    totals,
    reconstructedOnFrame,
    solidAngles,
    quadratureDescriptor,
    basisFingerprint,
}) {
    const inputVisibilityResidual = subtractMany(
        totals.total.input.solidAngleIntegral,
        [totals.total.visible.solidAngleIntegral, totals.total.blocked.solidAngleIntegral],
        'input visibility partition residual',
    );
    const visibleTransportResidual = subtractMany(
        totals.total.visible.solidAngleIntegral,
        [
            totals.total.transmitted.solidAngleIntegral,
            totals.total.atmosphericAttenuation.solidAngleIntegral,
        ],
        'visible transport partition residual',
    );
    const transmittedRasterResidual = subtractMany(
        totals.total.transmitted.solidAngleIntegral,
        [
            totals.onFrame.transmitted.solidAngleIntegral,
            totals.offRaster.transmitted.solidAngleIntegral,
        ],
        'transmitted raster partition residual',
    );
    const reconstructedOnFrameResidual = subtractSpectra(
        reconstructedOnFrame,
        totals.onFrame.transmitted.solidAngleIntegral,
        'reconstructed on-frame residual',
    );
    const completeComponentResidual = subtractMany(
        totals.total.input.solidAngleIntegral,
        [
            totals.total.blocked.solidAngleIntegral,
            totals.total.atmosphericAttenuation.solidAngleIntegral,
            totals.onFrame.transmitted.solidAngleIntegral,
            totals.offRaster.transmitted.solidAngleIntegral,
        ],
        'complete component residual',
    );
    const projectedComponentResidual = subtractMany(
        totals.total.input.projectedIrradiance,
        [
            totals.total.blocked.projectedIrradiance,
            totals.total.atmosphericAttenuation.projectedIrradiance,
            totals.onFrame.transmitted.projectedIrradiance,
            totals.offRaster.transmitted.projectedIrradiance,
        ],
        'projected component residual',
    );
    const residuals = Object.freeze({
        inputVisibility: integratedSpectrum(
            inputVisibilityResidual,
            basisFingerprint,
            'input-minus-visible-minus-blocked-residual',
        ),
        visibleTransport: integratedSpectrum(
            visibleTransportResidual,
            basisFingerprint,
            'visible-minus-transmitted-minus-atmospheric-attenuation-residual',
        ),
        transmittedRaster: integratedSpectrum(
            transmittedRasterResidual,
            basisFingerprint,
            'transmitted-minus-on-frame-minus-off-raster-residual',
        ),
        reconstructedOnFrame: integratedSpectrum(
            reconstructedOnFrameResidual,
            basisFingerprint,
            'reconstructed-minus-on-frame-transmitted-residual',
        ),
        completeComponents: integratedSpectrum(
            completeComponentResidual,
            basisFingerprint,
            'input-minus-blocked-minus-attenuation-minus-accounted-transmitted-residual',
        ),
        projectedComponents: integratedSpectrum(
            projectedComponentResidual,
            basisFingerprint,
            'projected-input-minus-blocked-minus-attenuation-minus-accounted-residual',
        ),
    });
    const maximumAbsoluteSpectralResidual = Math.max(
        ...Object.values(residuals).map((entry) => maxAbsolute(entry.values)),
    );
    return Object.freeze({
        equations: Object.freeze([
            'input = visible + blocked',
            'visible = transmitted + atmosphericAttenuation',
            'transmitted = onFrameTransmitted + offRasterTransmitted',
            'sum_i(destinationRadiance_i * exactPixelSolidAngle_i) = onFrameTransmitted',
            'input = blocked + atmosphericAttenuation + onFrameTransmitted + offRasterTransmitted',
        ]),
        residuals,
        maximumAbsoluteSpectralResidual,
        solidAngleResidualsSteradians: Object.freeze({
            quadrature: quadratureDescriptor.solidAngleResidualSteradians,
            visibilityPartition: solidAngles.input
                - solidAngles.visible
                - solidAngles.blocked,
            rasterPartition: solidAngles.input
                - solidAngles.onFrame
                - solidAngles.offRaster,
            onFrameVisibilityPartition: solidAngles.onFrame
                - solidAngles.onFrameVisible
                - solidAngles.onFrameBlocked,
            offRasterVisibilityPartition: solidAngles.offRaster
                - solidAngles.offRasterVisible
                - solidAngles.offRasterBlocked,
        }),
    });
}

function radianceSpectrum(values, basisFingerprint, quantity) {
    return Object.freeze({
        quantity,
        units: RADIANCE_UNITS,
        basisFingerprint,
        values,
    });
}

function integratedSpectrum(values, basisFingerprint, quantity) {
    return Object.freeze({
        quantity,
        units: INTEGRATED_RADIANCE_UNITS,
        basisFingerprint,
        values,
    });
}

function multiplySpectraOnce(left, right) {
    const result = left.map((value, index) => value * right[index]);
    requireFiniteSpectrum(result, 'transmitted extended spectral radiance');
    return Object.freeze(result);
}

function subtractSpectra(left, right, label) {
    const result = left.map((value, index) => value - right[index]);
    requireFiniteSpectrum(result, label);
    return Object.freeze(result);
}

function subtractMany(input, components, label) {
    const result = input.map((value, channel) =>
        components.reduce((residual, component) => residual - component[channel], value));
    requireFiniteSpectrum(result, label);
    return Object.freeze(result);
}

function zeroSpectrum() {
    return Object.freeze(Array(CANONICAL_CHANNEL_COUNT).fill(0));
}

function requireFiniteSpectrum(values, label) {
    if (
        values.length !== CANONICAL_CHANNEL_COUNT
        || !values.every(Number.isFinite)
    ) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_DERIVED_SPECTRUM_INVALID',
            `${label} must contain 15 finite values.`);
    }
}

function validateUnitDirection(direction) {
    if (
        !Array.isArray(direction)
        || direction.length !== 3
        || !direction.every(Number.isFinite)
    ) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_CENTER_DIRECTION_INVALID',
            'Extended source center direction must be a finite 3-tuple.');
    }
    if (Math.abs(Math.hypot(...direction) - 1) > 1e-12) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_CENTER_DIRECTION_NOT_UNIT',
            'Extended source center direction must be unit length.');
    }
}

function requirePositiveInteger(value, fieldName) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_QUADRATURE_COUNT_INVALID',
            `${fieldName} must be a positive safe integer.`);
    }
    return value;
}

function safeRatio(numerator, denominator) {
    return denominator === 0 ? 0 : numerator / denominator;
}

function maxAbsolute(values) {
    return Math.max(...values.map(Math.abs));
}

function rejectProhibitedFields(value, context) {
    rejectCoverageAndOpacityFields(value, context);
    const transmittanceFields = TRANSMITTANCE_SHORTCUT_FIELDS.filter((field) =>
        Object.hasOwn(value, field));
    if (transmittanceFields.length > 0) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_TRANSMITTANCE_SHORTCUT_PROHIBITED',
            'Extended transport accepts transmittance only from each exact sample direction.', {
                context,
                fields: transmittanceFields,
            });
    }
    const pathAndDisplayFields = PATH_AND_DISPLAY_FIELDS.filter((field) =>
        Object.hasOwn(value, field));
    if (pathAndDisplayFields.length > 0) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_PATH_DISPLAY_PROHIBITED',
            'Path radiance and final display remain outside the extended-source integrator.', {
                context,
                fields: pathAndDisplayFields,
            });
    }
}

function rejectCoverageAndOpacityFields(value, context) {
    const found = COVERAGE_AND_OPACITY_FIELDS.filter((field) => Object.hasOwn(value, field));
    if (found.length > 0) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_COVERAGE_FIELD_PROHIBITED',
            'Extended transport does not accept scalar coverage or opacity fields.', {
                context,
                fields: found,
            });
    }
}

function rejectUnknownFields(value, allowedFields, context) {
    const unknown = Object.keys(value).filter((field) => !allowedFields.includes(field));
    if (unknown.length > 0) {
        throw configurationError('ER4C_EXTENDED_INTEGRATOR_FIELD_UNSUPPORTED',
            `Unsupported ${context} fields are prohibited.`, { fields: unknown });
    }
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
