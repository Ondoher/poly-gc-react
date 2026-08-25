// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   exact-direction point-source transport and full-frame accumulation.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import ExternalCelestialSource from '../external-celestial-sources/ExternalCelestialSource.js';
import {
    POINT_CELESTIAL_SOURCE,
    SPECTRAL_IRRADIANCE_DENSITY,
} from '../external-celestial-sources/consts.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';
import PerspectiveCameraRaster from '../camera/PerspectiveCameraRaster.js';
import BilinearPointResponse from './BilinearPointResponse.js';

const CANONICAL_CHANNEL_COUNT = 15;
const TRANSMITTANCE_UNITS = '1';
const IRRADIANCE_UNITS = 'W m^-2 nm^-1';
const RADIANCE_UNITS = 'W m^-2 sr^-1 nm^-1';
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;
const CONFIGURATION_FIELDS = Object.freeze([
    'camera',
    'response',
    'visibilityResolver',
    'transmittanceSampler',
]);
const POINT_REQUEST_FIELDS = Object.freeze([
    'source',
    'sourceDirectionCamera',
    'sourceDepth',
]);
const COVERAGE_AND_OPACITY_FIELDS = Object.freeze([
    'coverage',
    'geometryCoverage',
    'remainingCoverage',
    'opacity',
    'alpha',
]);
const DESTINATION_TRANSMITTANCE_FIELDS = Object.freeze([
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
const PATH_RADIANCE_FIELDS = Object.freeze([
    'baseRadiance',
    'endpointRadiance',
    'pathRadiance',
    'pathSpectralRadiance',
    'spectralPathRadiance',
]);

export default class TransportedPointSourceAccumulator {
    /**
     * @param {TransportedPointSourceAccumulatorConfiguration} configuration - Exact-source transport dependencies.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw configurationError('ER4C_POINT_ACCUMULATOR_CONFIGURATION_REQUIRED',
                'Transported point-source accumulator configuration is required.');
        }
        rejectProhibitedFields(configuration, 'configuration');
        rejectUnknownFields(configuration, CONFIGURATION_FIELDS, 'configuration');
        if (!(configuration.camera instanceof PerspectiveCameraRaster)) {
            throw configurationError('ER4C_POINT_ACCUMULATOR_CAMERA_REQUIRED',
                'Transported point-source accumulator requires a PerspectiveCameraRaster.');
        }
        if (!(configuration.response instanceof BilinearPointResponse)) {
            throw configurationError('ER4C_POINT_ACCUMULATOR_RESPONSE_REQUIRED',
                'Transported point-source accumulator requires a BilinearPointResponse.');
        }
        validateCallbackProvider(
            configuration.visibilityResolver,
            'resolveExactSourceVisibility',
            'ER4C_POINT_ACCUMULATOR_VISIBILITY_RESOLVER_INVALID',
        );
        validateCallbackProvider(
            configuration.transmittanceSampler,
            'sampleExactSourceTransmittance',
            'ER4C_POINT_ACCUMULATOR_TRANSMITTANCE_SAMPLER_INVALID',
        );

        this.camera = configuration.camera;
        this.response = configuration.response;
        this.visibilityResolverFingerprint = configuration.visibilityResolver.fingerprint;
        this.transmittanceSamplerFingerprint = configuration.transmittanceSampler.fingerprint;
        this._resolveExactSourceVisibility =
            configuration.visibilityResolver.resolveExactSourceVisibility.bind(
                configuration.visibilityResolver,
            );
        this._sampleExactSourceTransmittance =
            configuration.transmittanceSampler.sampleExactSourceTransmittance.bind(
                configuration.transmittanceSampler,
            );
        this.fingerprint = stableHash(this.describe());
        Object.freeze(this);
    }

    /**
     * Describe the reset-only point transport owner and its exclusions.
     *
     * @returns {Readonly<Record<string, unknown>>} Immutable accumulator descriptor.
     */
    describe() {
        return Object.freeze({
            kind: 'transported-point-source-accumulator-v2',
            channelCount: CANONICAL_CHANNEL_COUNT,
            physicalOrder: Object.freeze([
                'resolve exact-source visibility once',
                'sample exact-source transmittance once only when visible',
                'form transmitted spectral irradiance once',
                'spread through normalized bilinear response or retain a fully off-raster rear response',
                'divide each destination contribution by exact pixel solid angle',
            ]),
            projectionPolicy:
                'exact-source transport precedes raster projection; sources outside the forward camera hemisphere retain offRasterWeight=1',
            cameraFingerprint: this.camera.fingerprint,
            responseFingerprint: this.response.fingerprint,
            visibilityResolverFingerprint: this.visibilityResolverFingerprint,
            transmittanceSamplerFingerprint: this.transmittanceSamplerFingerprint,
            sourceQuantity: SPECTRAL_IRRADIANCE_DENSITY,
            sourceUnits: IRRADIANCE_UNITS,
            transmittanceUnits: TRANSMITTANCE_UNITS,
            outputQuantity: 'point-spectral-radiance-density',
            outputUnits: RADIANCE_UNITS,
            excludedInputs: Object.freeze([
                'coverage-or-opacity',
                'destination-ray-transmittance',
                'path-or-endpoint-radiance',
                'display-values',
            ]),
        });
    }

    /**
     * Validate and detach one request before invoking either transport callback.
     *
     * @param {TransportedPointSourceRequest} request - Point source and exact physical ray.
     * @returns {PreparedTransportedPointSourceRequest} Prepared request.
     */
    _prepareRequest(request) {
        validatePointRequest(request);
        rejectProhibitedFields(request, 'point request');
        rejectUnknownFields(request, POINT_REQUEST_FIELDS, 'point request');

        const directionCamera = validateAndFreezeUnitDirection(
            request.sourceDirectionCamera,
        );
        const forwardCameraHemisphere = directionCamera[2] < 0;
        const rasterCenter = forwardCameraHemisphere
            ? this.camera.directionToRasterCenter(directionCamera)
            : null;
        const depth = validateAndFreezeDepth(request.sourceDepth);
        const exactSourceRay = Object.freeze({
            sourceId: request.source.id,
            sourceGeometry: request.source.geometry,
            directionCamera,
            directionFrame: 'camera-space-unit-vector-forward-minus-z',
            depth,
        });
        return Object.freeze({
            source: request.source,
            rasterCenter,
            forwardCameraHemisphere,
            exactSourceRay,
        });
    }

    /**
     * Accumulate one already validated request in the required physical order.
     *
     * @param {PreparedTransportedPointSourceRequest} prepared - Prepared source request.
     * @returns {TransportedPointSourceAccumulation} Individual transport diagnostics.
     */
    _accumulatePrepared(prepared) {
        const source = prepared.source;
        const spectralMeasure = source.spectralMeasure;
        const exactSourceRay = prepared.exactSourceRay;
        const rawVisibility = this._resolveExactSourceVisibility(exactSourceRay);
        const visibility = validateAndFreezeVisibility(rawVisibility);

        let transmittance = null;
        let transmittedValues = zeroSpectrum();
        if (visibility.visible) {
            const rawTransmittance = this._sampleExactSourceTransmittance(exactSourceRay);
            transmittance = validateAndFreezeTransmittance(
                rawTransmittance,
                spectralMeasure.basis.fingerprint,
                this.transmittanceSamplerFingerprint,
            );
            transmittedValues = multiplySpectraOnce(
                spectralMeasure.values,
                transmittance.values,
            );
        }

        const response = prepared.forwardCameraHemisphere
            ? this.response.resolve({
                rasterX: prepared.rasterCenter.x,
                rasterY: prepared.rasterCenter.y,
                widthPixels: this.camera.widthPixels,
                heightPixels: this.camera.heightPixels,
            })
            : this.response.resolveOutsideForwardHemisphere({
                widthPixels: this.camera.widthPixels,
                heightPixels: this.camera.heightPixels,
            });
        const pixels = visibility.visible
            ? Object.freeze(response.onFrameDestinations.map((destination) =>
                createPixelContribution(
                    this.camera,
                    destination,
                    transmittedValues,
                    spectralMeasure.basis.fingerprint,
                    source.id,
                )))
            : Object.freeze([]);
        const reconstructedOnFrameValues = reconstructOnFrame(pixels);
        const offRasterValues = scaleSpectrum(
            transmittedValues,
            response.offRasterWeight,
            'off-raster point irradiance',
        );
        const accountedValues = addSpectra(
            reconstructedOnFrameValues,
            offRasterValues,
            'accounted point irradiance',
        );
        const accountingResidualValues = subtractSpectra(
            accountedValues,
            transmittedValues,
            'point irradiance accounting residual',
        );
        const basisFingerprint = spectralMeasure.basis.fingerprint;

        return Object.freeze({
            source: Object.freeze({
                id: source.id,
                kind: source.kind,
                geometry: source.geometry,
                fingerprint: source.fingerprint,
            }),
            exactSourceRay,
            visibility: Object.freeze({
                visible: visibility.visible,
                occluder: visibility.occluder,
                resolverFingerprint: this.visibilityResolverFingerprint,
            }),
            transmittance,
            rasterCenter: prepared.rasterCenter,
            rasterProjection: Object.freeze({
                forwardCameraHemisphere: prepared.forwardCameraHemisphere,
                status: prepared.forwardCameraHemisphere
                    ? 'projected'
                    : 'outside-forward-camera-hemisphere',
            }),
            response,
            pixels,
            sourceSpectralIrradiance: spectralMeasure.describe(),
            transmittedSpectralIrradiance: irradianceSpectrum(
                transmittedValues,
                basisFingerprint,
            ),
            reconstructedOnFrameSpectralIrradiance: irradianceSpectrum(
                reconstructedOnFrameValues,
                basisFingerprint,
            ),
            offRasterSpectralIrradiance: irradianceSpectrum(
                offRasterValues,
                basisFingerprint,
            ),
            accountedSpectralIrradiance: irradianceSpectrum(
                accountedValues,
                basisFingerprint,
            ),
            accountingResidualSpectralIrradiance: irradianceSpectrum(
                accountingResidualValues,
                basisFingerprint,
                'spectral-irradiance-density-accounting-residual',
            ),
            accounting: Object.freeze({
                equation:
                    'sum_i(pointSpectralRadianceDensity_i * pixelSolidAngle_i)'
                    + ' + transmittedSpectralIrradiance * offRasterWeight'
                    + ' = transmittedSpectralIrradiance',
                onFrameResponseWeight: response.onFrameWeight,
                offRasterResponseWeight: response.offRasterWeight,
                fullResponseWeight: response.fullWeight,
                maximumAbsoluteResidual: maxAbsolute(accountingResidualValues),
            }),
            transportCalls: Object.freeze({
                order: Object.freeze(visibility.visible
                    ? ['resolveExactSourceVisibility', 'sampleExactSourceTransmittance']
                    : ['resolveExactSourceVisibility']),
                visibility: Object.freeze({
                    callback: 'resolveExactSourceVisibility',
                    callCount: 1,
                    exactSourceRay,
                }),
                transmittance: Object.freeze({
                    callback: 'sampleExactSourceTransmittance',
                    callCount: visibility.visible ? 1 : 0,
                    exactSourceRay: visibility.visible ? exactSourceRay : null,
                }),
                sameExactSourceRayObject: visibility.visible ? true : null,
            }),
            quantity: Object.freeze({
                source: SPECTRAL_IRRADIANCE_DENSITY,
                transmitted: SPECTRAL_IRRADIANCE_DENSITY,
                destination: 'point-spectral-radiance-density',
                pathRadianceOwnership: 'outside-this-class',
            }),
            units: Object.freeze({
                sourceSpectralIrradiance: IRRADIANCE_UNITS,
                transmittance: TRANSMITTANCE_UNITS,
                pointSpectralRadiance: RADIANCE_UNITS,
                pixelSolidAngle: 'sr',
                sourceDepth: 'm',
            }),
            fingerprints: Object.freeze({
                accumulator: this.fingerprint,
                camera: this.camera.fingerprint,
                response: this.response.fingerprint,
                visibilityResolver: this.visibilityResolverFingerprint,
                transmittanceSampler: this.transmittanceSamplerFingerprint,
                source: source.fingerprint,
                sourceSpectrum: spectralMeasure.fingerprint,
                basis: basisFingerprint,
            }),
        });
    }

    /**
     * Combine individual point contributions through channel-wise linear addition.
     *
     * @param {readonly TransportedPointSourceAccumulation[]} sources - Individual results.
     * @returns {TransportedPointSourceBatchAccumulation} Additive frame diagnostics.
     */
    _combineAccumulations(sources) {
        const first = sources[0];
        const basisFingerprint = first.sourceSpectralIrradiance.basis.fingerprint;
        const pixels = combinePixels(sources, basisFingerprint);
        const sourceValues = sumNamedSpectra(
            sources,
            'sourceSpectralIrradiance',
            'batch source spectral irradiance',
        );
        const transmittedValues = sumNamedSpectra(
            sources,
            'transmittedSpectralIrradiance',
            'batch transmitted spectral irradiance',
        );
        const reconstructedOnFrameValues = reconstructOnFrame(pixels);
        const offRasterValues = sumNamedSpectra(
            sources,
            'offRasterSpectralIrradiance',
            'batch off-raster spectral irradiance',
        );
        const accountedValues = addSpectra(
            reconstructedOnFrameValues,
            offRasterValues,
            'batch accounted spectral irradiance',
        );
        const accountingResidualValues = subtractSpectra(
            accountedValues,
            transmittedValues,
            'batch point irradiance accounting residual',
        );

        return Object.freeze({
            sourceIds: Object.freeze(sources.map((entry) => entry.source.id)),
            sources,
            pixels,
            sourceSpectralIrradiance: irradianceSpectrum(sourceValues, basisFingerprint),
            transmittedSpectralIrradiance: irradianceSpectrum(
                transmittedValues,
                basisFingerprint,
            ),
            reconstructedOnFrameSpectralIrradiance: irradianceSpectrum(
                reconstructedOnFrameValues,
                basisFingerprint,
            ),
            offRasterSpectralIrradiance: irradianceSpectrum(
                offRasterValues,
                basisFingerprint,
            ),
            accountedSpectralIrradiance: irradianceSpectrum(
                accountedValues,
                basisFingerprint,
            ),
            accountingResidualSpectralIrradiance: irradianceSpectrum(
                accountingResidualValues,
                basisFingerprint,
                'spectral-irradiance-density-accounting-residual',
            ),
            accounting: Object.freeze({
                equation:
                    'sum_i(combinedPointSpectralRadianceDensity_i * pixelSolidAngle_i)'
                    + ' + sum_s(offRasterSpectralIrradiance_s)'
                    + ' = sum_s(transmittedSpectralIrradiance_s)',
                maximumAbsoluteResidual: maxAbsolute(accountingResidualValues),
                addition: 'linear-channel-wise-without-coverage-or-opacity',
            }),
            transportCalls: Object.freeze({
                visibilityCallCount: sources.reduce((sum, entry) =>
                    sum + entry.transportCalls.visibility.callCount, 0),
                transmittanceCallCount: sources.reduce((sum, entry) =>
                    sum + entry.transportCalls.transmittance.callCount, 0),
                bySource: Object.freeze(sources.map((entry) => Object.freeze({
                    sourceId: entry.source.id,
                    exactSourceRay: entry.exactSourceRay,
                    visibilityCallCount: entry.transportCalls.visibility.callCount,
                    transmittanceCallCount: entry.transportCalls.transmittance.callCount,
                }))),
            }),
            quantity: first.quantity,
            units: first.units,
            fingerprints: Object.freeze({
                accumulator: this.fingerprint,
                camera: this.camera.fingerprint,
                response: this.response.fingerprint,
                visibilityResolver: this.visibilityResolverFingerprint,
                transmittanceSampler: this.transmittanceSamplerFingerprint,
                basis: basisFingerprint,
                sourceSpectra: Object.freeze(sources.map((entry) =>
                    entry.fingerprints.sourceSpectrum)),
            }),
        });
    }

    /**
     * Accumulate one typed point source after exact-source visibility and transport.
     *
     * @param {TransportedPointSourceRequest} request - Point source and exact physical ray.
     * @returns {TransportedPointSourceAccumulation} Point contribution and accounting diagnostics.
     */
    accumulate(request) {
        return this._accumulatePrepared(this._prepareRequest(request));
    }

    /**
     * Accumulate unique point sources with linear addition and individual diagnostics.
     *
     * @param {TransportedPointSourceBatchRequest} request - Nonempty point-source batch.
     * @returns {TransportedPointSourceBatchAccumulation} Additive frame diagnostics.
     */
    accumulateMany(request) {
        if (!request || typeof request !== 'object' || !Array.isArray(request.points)) {
            throw configurationError('ER4C_POINT_ACCUMULATOR_BATCH_REQUIRED',
                'Transported point-source batch requires a points array.');
        }
        rejectProhibitedFields(request, 'batch request');
        rejectUnknownFields(request, ['points'], 'batch request');
        if (request.points.length === 0) {
            throw configurationError('ER4C_POINT_ACCUMULATOR_BATCH_EMPTY',
                'Transported point-source batch requires at least one point.');
        }

        const prepared = Object.freeze(request.points.map((point) =>
            this._prepareRequest(point)));
        const ids = new Set();
        for (const entry of prepared) {
            if (ids.has(entry.source.id)) {
                throw configurationError('ER4C_POINT_ACCUMULATOR_SOURCE_ID_DUPLICATE',
                    `Point source id ${entry.source.id} is duplicated.`);
            }
            ids.add(entry.source.id);
        }
        const basisFingerprint = prepared[0].source.spectralMeasure.basis.fingerprint;
        if (prepared.some((entry) =>
            entry.source.spectralMeasure.basis.fingerprint !== basisFingerprint)) {
            throw configurationError('ER4C_POINT_ACCUMULATOR_SOURCE_BASIS_MISMATCH',
                'Point source batch packets must share one basis fingerprint.');
        }

        const sources = Object.freeze(prepared.map((entry) =>
            this._accumulatePrepared(entry)));
        return this._combineAccumulations(sources);
    }
}

function validatePointRequest(request) {
    if (!request || typeof request !== 'object') {
        throw configurationError('ER4C_POINT_ACCUMULATOR_REQUEST_REQUIRED',
            'Transported point-source request is required.');
    }
    if (!(request.source instanceof ExternalCelestialSource)) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_TYPED_SOURCE_REQUIRED',
            'Transported point-source request requires an ExternalCelestialSource.');
    }
    const measure = request.source.spectralMeasure;
    if (
        request.source.kind !== POINT_CELESTIAL_SOURCE
        || measure.quantity !== SPECTRAL_IRRADIANCE_DENSITY
    ) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_IRRADIANCE_REQUIRED',
            'Transported point-source accumulator accepts typed point irradiance only.');
    }
    if (measure.units !== IRRADIANCE_UNITS || measure.values.length !== CANONICAL_CHANNEL_COUNT) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_CANONICAL_SPECTRUM_REQUIRED',
            'Point source must provide 15 aligned channels in W m^-2 nm^-1.', {
                channelCount: measure.values.length,
                units: measure.units,
            });
    }
}

function validateAndFreezeUnitDirection(direction) {
    if (
        !Array.isArray(direction)
        || direction.length !== 3
        || !direction.every(Number.isFinite)
    ) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_DIRECTION_INVALID',
            'Point source direction must be a finite camera-space 3-tuple.');
    }
    const length = Math.hypot(...direction);
    if (Math.abs(length - 1) > 1e-12) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_DIRECTION_NOT_UNIT',
            'Point source direction must be unit length.', { length });
    }
    return Object.freeze([...direction]);
}

function validateAndFreezeDepth(depth) {
    if (!depth || typeof depth !== 'object' || Array.isArray(depth)) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_DEPTH_REQUIRED',
            'Point source depth requires a finite or infinite descriptor.');
    }
    rejectProhibitedFields(depth, 'source depth');
    if (depth.kind === 'finite') {
        rejectUnknownFields(depth, ['kind', 'distanceMeters'], 'finite source depth');
        if (!Number.isFinite(depth.distanceMeters) || depth.distanceMeters <= 0) {
            throw configurationError('ER4C_POINT_ACCUMULATOR_FINITE_DEPTH_INVALID',
                'Finite point source depth must be positive meters.');
        }
        return Object.freeze({ kind: 'finite', distanceMeters: depth.distanceMeters });
    }
    if (depth.kind === 'infinite') {
        rejectUnknownFields(depth, ['kind'], 'infinite source depth');
        return Object.freeze({ kind: 'infinite' });
    }
    throw configurationError('ER4C_POINT_ACCUMULATOR_DEPTH_KIND_INVALID',
        'Point source depth kind must be finite or infinite.');
}

function validateCallbackProvider(provider, callbackName, code) {
    if (
        !provider
        || (typeof provider !== 'object' && typeof provider !== 'function')
        || !FINGERPRINT_PATTERN.test(provider.fingerprint ?? '')
        || typeof provider[callbackName] !== 'function'
    ) {
        throw configurationError(code,
            `${callbackName} requires a provider with a SHA-256 fingerprint and callback.`);
    }
}

function validateAndFreezeVisibility(result) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_VISIBILITY_RESULT_INVALID',
            'Exact-source visibility resolver must return an object.');
    }
    rejectProhibitedFields(result, 'visibility result');
    if (typeof result.visible !== 'boolean') {
        throw configurationError('ER4C_POINT_ACCUMULATOR_VISIBILITY_BOOLEAN_REQUIRED',
            'Exact-source visibility result requires a visible boolean.');
    }
    if (result.visible && result.occluder !== null) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_VISIBLE_OCCLUDER_INVALID',
            'A visible point source must report a null occluder.');
    }
    if (
        !result.visible
        && (!result.occluder || typeof result.occluder !== 'object'
            || Array.isArray(result.occluder))
    ) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_BLOCKED_OCCLUDER_REQUIRED',
            'A blocked point source must retain an occluder descriptor.');
    }
    try {
        return Object.freeze({
            visible: result.visible,
            occluder: result.visible ? null : freezeJsonValue(result.occluder),
        });
    } catch (error) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_OCCLUDER_INVALID',
            'Point source occluder must be finite JSON diagnostics.', {
                cause: error.message,
            });
    }
}

function validateAndFreezeTransmittance(result, basisFingerprint, samplerFingerprint) {
    if (!result || typeof result !== 'object' || Array.isArray(result)) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_TRANSMITTANCE_RESULT_INVALID',
            'Exact-source transmittance sampler must return a typed object.');
    }
    rejectCoverageAndOpacityFields(result, 'transmittance result');
    if (result.units !== TRANSMITTANCE_UNITS) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_TRANSMITTANCE_UNITS_INVALID',
            'Exact-source transmittance must use dimensionless units 1.');
    }
    if (result.basisFingerprint !== basisFingerprint) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_TRANSMITTANCE_BASIS_MISMATCH',
            'Exact-source transmittance must align with the source basis fingerprint.');
    }
    if (
        !Array.isArray(result.values)
        || result.values.length !== CANONICAL_CHANNEL_COUNT
        || !result.values.every((value) =>
            Number.isFinite(value) && value >= 0 && value <= 1)
    ) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_TRANSMITTANCE_VALUES_INVALID',
            'Exact-source transmittance requires 15 finite values in [0, 1].');
    }
    return Object.freeze({
        quantity: 'spectral-transmittance',
        units: TRANSMITTANCE_UNITS,
        basisFingerprint,
        values: Object.freeze([...result.values]),
        samplerFingerprint,
    });
}

function createPixelContribution(camera, destination, transmittedValues, basisFingerprint, sourceId) {
    const pixelSolidAngleSteradians = camera.pixelSolidAngleSteradians(
        destination.pixelX,
        destination.pixelY,
    );
    const pointSpectralRadianceDensity = transmittedValues.map((value) =>
        value * destination.weight / pixelSolidAngleSteradians);
    requireFiniteSpectrum(pointSpectralRadianceDensity, 'point spectral radiance density');
    return Object.freeze({
        pixelX: destination.pixelX,
        pixelY: destination.pixelY,
        contributingSourceIds: Object.freeze([sourceId]),
        responseWeight: destination.weight,
        pixelSolidAngleSteradians,
        basisFingerprint,
        quantity: 'point-spectral-radiance-density',
        units: RADIANCE_UNITS,
        pointSpectralRadianceDensity: Object.freeze(pointSpectralRadianceDensity),
    });
}

function combinePixels(sources, basisFingerprint) {
    const pixelMap = new Map();
    for (const source of sources) {
        for (const pixel of source.pixels) {
            const key = `${pixel.pixelX},${pixel.pixelY}`;
            const current = pixelMap.get(key);
            if (!current) {
                pixelMap.set(key, pixel);
                continue;
            }
            if (current.pixelSolidAngleSteradians !== pixel.pixelSolidAngleSteradians) {
                throw configurationError('ER4C_POINT_ACCUMULATOR_PIXEL_SOLID_ANGLE_MISMATCH',
                    'Overlapping point contributions disagree on pixel solid angle.');
            }
            pixelMap.set(key, Object.freeze({
                pixelX: current.pixelX,
                pixelY: current.pixelY,
                contributingSourceIds: Object.freeze([
                    ...current.contributingSourceIds,
                    ...pixel.contributingSourceIds,
                ]),
                responseWeight: null,
                pixelSolidAngleSteradians: current.pixelSolidAngleSteradians,
                basisFingerprint,
                quantity: 'point-spectral-radiance-density',
                units: RADIANCE_UNITS,
                pointSpectralRadianceDensity: Object.freeze(addSpectra(
                    current.pointSpectralRadianceDensity,
                    pixel.pointSpectralRadianceDensity,
                    'combined point spectral radiance density',
                )),
            }));
        }
    }
    return Object.freeze([...pixelMap.values()].sort((left, right) =>
        left.pixelY - right.pixelY || left.pixelX - right.pixelX));
}

function reconstructOnFrame(pixels) {
    const values = Array(CANONICAL_CHANNEL_COUNT).fill(0);
    for (const pixel of pixels) {
        for (let channel = 0; channel < CANONICAL_CHANNEL_COUNT; channel += 1) {
            values[channel] += pixel.pointSpectralRadianceDensity[channel]
                * pixel.pixelSolidAngleSteradians;
        }
    }
    requireFiniteSpectrum(values, 'reconstructed on-frame spectral irradiance');
    return Object.freeze(values);
}

function multiplySpectraOnce(left, right) {
    const result = left.map((value, index) => value * right[index]);
    requireFiniteSpectrum(result, 'transmitted spectral irradiance');
    return Object.freeze(result);
}

function scaleSpectrum(values, scale, label) {
    const result = values.map((value) => value * scale);
    requireFiniteSpectrum(result, label);
    return Object.freeze(result);
}

function addSpectra(left, right, label) {
    const result = left.map((value, index) => value + right[index]);
    requireFiniteSpectrum(result, label);
    return Object.freeze(result);
}

function subtractSpectra(left, right, label) {
    const result = left.map((value, index) => value - right[index]);
    requireFiniteSpectrum(result, label);
    return Object.freeze(result);
}

function sumNamedSpectra(sources, field, label) {
    const values = Array(CANONICAL_CHANNEL_COUNT).fill(0);
    for (const source of sources) {
        for (let channel = 0; channel < CANONICAL_CHANNEL_COUNT; channel += 1) {
            values[channel] += source[field].values[channel];
        }
    }
    requireFiniteSpectrum(values, label);
    return Object.freeze(values);
}

function zeroSpectrum() {
    return Object.freeze(Array(CANONICAL_CHANNEL_COUNT).fill(0));
}

function irradianceSpectrum(values, basisFingerprint, quantity = SPECTRAL_IRRADIANCE_DENSITY) {
    return Object.freeze({
        quantity,
        units: IRRADIANCE_UNITS,
        basisFingerprint,
        values,
    });
}

function requireFiniteSpectrum(values, label) {
    if (
        values.length !== CANONICAL_CHANNEL_COUNT
        || !values.every(Number.isFinite)
    ) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_DERIVED_SPECTRUM_INVALID',
            `${label} must contain 15 finite values.`);
    }
}

function maxAbsolute(values) {
    return Math.max(...values.map(Math.abs));
}

function rejectProhibitedFields(value, context) {
    rejectCoverageAndOpacityFields(value, context);
    const destinationFields = DESTINATION_TRANSMITTANCE_FIELDS.filter((field) =>
        Object.hasOwn(value, field));
    if (destinationFields.length > 0) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_DESTINATION_TRANSMITTANCE_PROHIBITED',
            'Point transport accepts transmittance only from the exact-source sampler.', {
                context,
                fields: destinationFields,
            });
    }
    const pathFields = PATH_RADIANCE_FIELDS.filter((field) => Object.hasOwn(value, field));
    if (pathFields.length > 0) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_PATH_RADIANCE_PROHIBITED',
            'Path and endpoint radiance remain outside the point-source accumulator.', {
                context,
                fields: pathFields,
            });
    }
}

function rejectCoverageAndOpacityFields(value, context) {
    const found = COVERAGE_AND_OPACITY_FIELDS.filter((field) => Object.hasOwn(value, field));
    if (found.length > 0) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_COVERAGE_FIELD_PROHIBITED',
            'Point transport does not accept coverage or opacity fields.', {
                context,
                fields: found,
            });
    }
}

function rejectUnknownFields(value, allowedFields, context) {
    const unknown = Object.keys(value).filter((field) => !allowedFields.includes(field));
    if (unknown.length > 0) {
        throw configurationError('ER4C_POINT_ACCUMULATOR_FIELD_UNSUPPORTED',
            `Unsupported ${context} fields are prohibited.`, { fields: unknown });
    }
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
