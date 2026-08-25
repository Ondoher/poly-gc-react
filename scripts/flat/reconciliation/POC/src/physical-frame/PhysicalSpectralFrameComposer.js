// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   physically typed frame composition and the single global display boundary.

import PerspectiveCameraRaster from '../camera/PerspectiveCameraRaster.js';
import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';

const CHANNEL_COUNT = 15;
const RADIANCE_QUANTITY = 'spectral-radiance-density';
const RADIANCE_UNITS = 'W m^-2 sr^-1 nm^-1';
const TRANSMITTANCE_QUANTITY = 'spectral-transmittance';
const TRANSMITTANCE_UNITS = '1';
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;
const CONFIGURATION_FIELDS = Object.freeze(['camera', 'displayModel']);
const REQUEST_FIELDS = Object.freeze([
    'basisFingerprint',
    'basePixels',
    'extendedIntegrations',
    'pointAccumulations',
]);
const BASE_PIXEL_FIELDS = Object.freeze([
    'pixelX',
    'pixelY',
    'pathSpectralRadianceDensity',
    'viewSpectralTransmittance',
    'endpointSpectralRadianceDensity',
]);

export default class PhysicalSpectralFrameComposer {
    /**
     * @param {PhysicalSpectralFrameComposerConfiguration} configuration - Camera and sole display owner.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
            throw configurationError('ER4C_FRAME_COMPOSER_CONFIGURATION_REQUIRED',
                'Physical frame composer configuration is required.');
        }
        rejectUnknownFields(configuration, CONFIGURATION_FIELDS, 'configuration');
        if (!(configuration.camera instanceof PerspectiveCameraRaster)) {
            throw configurationError('ER4C_FRAME_COMPOSER_CAMERA_REQUIRED',
                'Physical frame composer requires a PerspectiveCameraRaster.');
        }
        if (
            !configuration.displayModel
            || typeof configuration.displayModel.radianceToDisplayRgb !== 'function'
            || typeof configuration.displayModel.describeDisplayConversion !== 'function'
        ) {
            throw configurationError('ER4C_FRAME_COMPOSER_DISPLAY_MODEL_INVALID',
                'Physical frame composer requires one radiance display model.');
        }

        let displayDescriptor;
        try {
            displayDescriptor = freezeJsonValue(
                configuration.displayModel.describeDisplayConversion(),
            );
        } catch (error) {
            throw configurationError('ER4C_FRAME_COMPOSER_DISPLAY_DESCRIPTOR_INVALID',
                'Display conversion descriptor must be finite JSON.', { cause: error.message });
        }

        this.camera = configuration.camera;
        this.displayDescriptor = displayDescriptor;
        this.displayFingerprint = stableHash(displayDescriptor);
        this._radianceToDisplayRgb = configuration.displayModel.radianceToDisplayRgb.bind(
            configuration.displayModel,
        );
        this.fingerprint = stableHash(this.describe());
        Object.freeze(this);
    }

    /**
     * Describe the full-frame physical ordering and the one display boundary.
     *
     * @returns {Readonly<Record<string, unknown>>} Immutable composer descriptor.
     */
    describe() {
        return Object.freeze({
            kind: 'physical-spectral-frame-composer-v1',
            channelCount: CHANNEL_COUNT,
            cameraFingerprint: this.camera.fingerprint,
            displayFingerprint: this.displayFingerprint,
            displayDescriptor: this.displayDescriptor,
            physicalOrder: Object.freeze([
                'path spectral radiance',
                'view transmittance times endpoint spectral radiance',
                'already transported extended spectral radiance',
                'already transported point spectral radiance',
                'channel-wise spectral-radiance addition',
                'one shared display conversion per completed pixel',
            ]),
            prohibitedBehavior: Object.freeze([
                'point-irradiance-added-directly-to-radiance',
                'destination-ray-transmittance-on-point-response',
                'second-transmittance-on-extended-contribution',
                'source-specific-display-gain',
                'display-before-full-spectral-composition',
            ]),
        });
    }

    /**
     * Prepare a complete, unique base frame and apply endpoint transport once.
     *
     * @param {readonly PhysicalBaseSpectralPixel[]} basePixels - Complete camera frame.
     * @param {string} basisFingerprint - Active spectral basis fingerprint.
     * @returns {ReadonlyMap<string, PreparedPhysicalBasePixel>} Prepared pixels by coordinate.
     */
    _prepareBasePixels(basePixels, basisFingerprint) {
        const expectedCount = this.camera.widthPixels * this.camera.heightPixels;
        if (!Array.isArray(basePixels) || basePixels.length !== expectedCount) {
            throw configurationError('ER4C_FRAME_COMPOSER_BASE_FRAME_INCOMPLETE',
                'Base spectral pixels must cover the complete camera frame exactly once.', {
                    expectedCount,
                    actualCount: Array.isArray(basePixels) ? basePixels.length : null,
                });
        }

        const prepared = new Map();
        for (const pixel of basePixels) {
            if (!pixel || typeof pixel !== 'object' || Array.isArray(pixel)) {
                throw configurationError('ER4C_FRAME_COMPOSER_BASE_PIXEL_INVALID',
                    'Every base frame pixel must be an object.');
            }
            rejectUnknownFields(pixel, BASE_PIXEL_FIELDS, 'base pixel');
            validatePixelCoordinate(pixel.pixelX, pixel.pixelY, this.camera);
            const key = pixelKey(pixel.pixelX, pixel.pixelY);
            if (prepared.has(key)) {
                throw configurationError('ER4C_FRAME_COMPOSER_BASE_PIXEL_DUPLICATE',
                    `Base frame pixel ${key} is duplicated.`);
            }

            const path = validateRadiancePacket(
                pixel.pathSpectralRadianceDensity,
                basisFingerprint,
                'path spectral radiance',
            );
            const transmittance = validateTransmittancePacket(
                pixel.viewSpectralTransmittance,
                basisFingerprint,
            );
            const endpoint = pixel.endpointSpectralRadianceDensity == null
                ? zeroSpectrum()
                : validateRadiancePacket(
                    pixel.endpointSpectralRadianceDensity,
                    basisFingerprint,
                    'endpoint spectral radiance',
                );
            const transportedEndpoint = multiplySpectra(
                endpoint,
                transmittance,
                'transported endpoint spectral radiance',
            );
            const base = addSpectra(path, transportedEndpoint, 'base spectral radiance');

            prepared.set(key, Object.freeze({
                pixelX: pixel.pixelX,
                pixelY: pixel.pixelY,
                pixelSolidAngleSteradians: this.camera.pixelSolidAngleSteradians(
                    pixel.pixelX,
                    pixel.pixelY,
                ),
                path,
                viewTransmittance: transmittance,
                endpoint,
                transportedEndpoint,
                base,
            }));
        }

        for (let pixelY = 0; pixelY < this.camera.heightPixels; pixelY += 1) {
            for (let pixelX = 0; pixelX < this.camera.widthPixels; pixelX += 1) {
                const key = pixelKey(pixelX, pixelY);
                if (!prepared.has(key)) {
                    throw configurationError('ER4C_FRAME_COMPOSER_BASE_PIXEL_MISSING',
                        `Base frame pixel ${key} is missing.`);
                }
            }
        }
        return prepared;
    }

    /**
     * Accumulate already transported extended contributions into the frame map.
     *
     * @param {readonly unknown[]} integrations - Extended integration outputs.
     * @param {string} basisFingerprint - Active basis fingerprint.
     * @param {Map<string, number[]>} target - Mutable accumulation map.
     * @param {Set<string>} sourceIds - Cross-measure source identity set.
     * @returns {Readonly<Record<string, unknown>>} Extended-source diagnostics.
     */
    _accumulateExtended(integrations, basisFingerprint, target, sourceIds) {
        if (!Array.isArray(integrations)) {
            throw configurationError('ER4C_FRAME_COMPOSER_EXTENDED_ARRAY_REQUIRED',
                'extendedIntegrations must be an array.');
        }
        const ids = [];
        let contributionCount = 0;
        for (const integration of integrations) {
            const sourceId = integration?.source?.id;
            validateSourceIdentity(sourceId, sourceIds, 'extended');
            validateContributionFingerprints(
                integration,
                this.camera.fingerprint,
                basisFingerprint,
                'extended',
            );
            if (!Array.isArray(integration.pixels)) {
                throw configurationError('ER4C_FRAME_COMPOSER_EXTENDED_PIXELS_REQUIRED',
                    `Extended source ${sourceId} must provide pixels.`);
            }
            ids.push(sourceId);
            const seenPixels = new Set();
            for (const pixel of integration.pixels) {
                validateContributionPixel(pixel, this.camera, basisFingerprint, {
                    quantity: 'transported-extended-spectral-radiance-density',
                    valuesField: 'transportedExtendedSpectralRadianceDensity',
                    sourceId,
                });
                const key = pixelKey(pixel.pixelX, pixel.pixelY);
                if (seenPixels.has(key)) {
                    throw configurationError('ER4C_FRAME_COMPOSER_EXTENDED_PIXEL_DUPLICATE',
                        `Extended source ${sourceId} duplicates pixel ${key}.`);
                }
                seenPixels.add(key);
                accumulateInto(target, key, pixel.transportedExtendedSpectralRadianceDensity);
                contributionCount += 1;
            }
        }
        return Object.freeze({ sourceIds: Object.freeze(ids), contributionCount });
    }

    /**
     * Accumulate already transported point-response radiance into the frame map.
     *
     * @param {readonly unknown[]} accumulations - Point accumulation outputs.
     * @param {string} basisFingerprint - Active basis fingerprint.
     * @param {Map<string, number[]>} target - Mutable accumulation map.
     * @param {Set<string>} sourceIds - Cross-measure source identity set.
     * @returns {Readonly<Record<string, unknown>>} Point-source diagnostics.
     */
    _accumulatePoints(accumulations, basisFingerprint, target, sourceIds) {
        if (!Array.isArray(accumulations)) {
            throw configurationError('ER4C_FRAME_COMPOSER_POINT_ARRAY_REQUIRED',
                'pointAccumulations must be an array.');
        }
        const ids = [];
        let contributionCount = 0;
        for (const accumulation of accumulations) {
            validateContributionFingerprints(
                accumulation,
                this.camera.fingerprint,
                basisFingerprint,
                'point',
            );
            const accumulationIds = Array.isArray(accumulation?.sourceIds)
                ? accumulation.sourceIds
                : [accumulation?.source?.id];
            if (accumulationIds.length === 0) {
                throw configurationError('ER4C_FRAME_COMPOSER_POINT_SOURCE_ID_REQUIRED',
                    'Point accumulation must retain at least one source id.');
            }
            for (const sourceId of accumulationIds) {
                validateSourceIdentity(sourceId, sourceIds, 'point');
                ids.push(sourceId);
            }
            if (!Array.isArray(accumulation.pixels)) {
                throw configurationError('ER4C_FRAME_COMPOSER_POINT_PIXELS_REQUIRED',
                    'Point accumulation must provide pixels.');
            }
            const seenPixels = new Set();
            for (const pixel of accumulation.pixels) {
                validateContributionPixel(pixel, this.camera, basisFingerprint, {
                    quantity: 'point-spectral-radiance-density',
                    valuesField: 'pointSpectralRadianceDensity',
                    sourceId: accumulationIds.join(','),
                });
                if (
                    !Array.isArray(pixel.contributingSourceIds)
                    || pixel.contributingSourceIds.length === 0
                    || pixel.contributingSourceIds.some((sourceId) =>
                        !accumulationIds.includes(sourceId))
                ) {
                    throw configurationError('ER4C_FRAME_COMPOSER_POINT_PIXEL_SOURCE_INVALID',
                        'Point pixel source ids must belong to the enclosing accumulation.');
                }
                const key = pixelKey(pixel.pixelX, pixel.pixelY);
                if (seenPixels.has(key)) {
                    throw configurationError('ER4C_FRAME_COMPOSER_POINT_PIXEL_DUPLICATE',
                        `Point accumulation duplicates pixel ${key}.`);
                }
                seenPixels.add(key);
                accumulateInto(target, key, pixel.pointSpectralRadianceDensity);
                contributionCount += 1;
            }
        }
        return Object.freeze({ sourceIds: Object.freeze(ids), contributionCount });
    }

    /**
     * Compose a complete physical spectral frame and invoke one shared display pass.
     *
     * @param {PhysicalSpectralFrameCompositionRequest} request - Base and transported contributions.
     * @returns {PhysicalSpectralFrameComposition} Complete pre-display and display diagnostics.
     */
    compose(request) {
        if (!request || typeof request !== 'object' || Array.isArray(request)) {
            throw configurationError('ER4C_FRAME_COMPOSER_REQUEST_REQUIRED',
                'Physical spectral frame composition request is required.');
        }
        rejectUnknownFields(request, REQUEST_FIELDS, 'composition request');
        if (!FINGERPRINT_PATTERN.test(request.basisFingerprint ?? '')) {
            throw configurationError('ER4C_FRAME_COMPOSER_BASIS_FINGERPRINT_INVALID',
                'Composition requires a SHA-256 spectral basis fingerprint.');
        }

        const baseByPixel = this._prepareBasePixels(
            request.basePixels,
            request.basisFingerprint,
        );
        const extendedByPixel = createZeroFrameMap(baseByPixel.keys());
        const pointByPixel = createZeroFrameMap(baseByPixel.keys());
        const sourceIds = new Set();
        const extended = this._accumulateExtended(
            request.extendedIntegrations ?? [],
            request.basisFingerprint,
            extendedByPixel,
            sourceIds,
        );
        const point = this._accumulatePoints(
            request.pointAccumulations ?? [],
            request.basisFingerprint,
            pointByPixel,
            sourceIds,
        );

        const totals = createComponentTotals();
        let maximumAbsoluteCompositionResidual = 0;
        let displayCallCount = 0;
        const pixels = [];
        for (let pixelY = 0; pixelY < this.camera.heightPixels; pixelY += 1) {
            for (let pixelX = 0; pixelX < this.camera.widthPixels; pixelX += 1) {
                const key = pixelKey(pixelX, pixelY);
                const base = baseByPixel.get(key);
                const extendedValues = Object.freeze([...extendedByPixel.get(key)]);
                const pointValues = Object.freeze([...pointByPixel.get(key)]);
                const finalValues = addSpectra(
                    addSpectra(base.base, extendedValues, 'base plus extended radiance'),
                    pointValues,
                    'final spectral radiance',
                );
                const reconstructed = addSpectra(
                    addSpectra(base.path, base.transportedEndpoint, 'reconstructed base'),
                    addSpectra(extendedValues, pointValues, 'reconstructed celestial'),
                    'reconstructed final spectral radiance',
                );
                const residual = subtractSpectra(
                    finalValues,
                    reconstructed,
                    'composition residual',
                );
                maximumAbsoluteCompositionResidual = Math.max(
                    maximumAbsoluteCompositionResidual,
                    ...residual.map(Math.abs),
                );

                const displayRgb = validateDisplayRgb(this._radianceToDisplayRgb(finalValues));
                displayCallCount += 1;
                accumulateComponentTotals(totals, base.pixelSolidAngleSteradians, {
                    path: base.path,
                    transportedEndpoint: base.transportedEndpoint,
                    extended: extendedValues,
                    point: pointValues,
                    final: finalValues,
                });
                pixels.push(Object.freeze({
                    pixelX,
                    pixelY,
                    pixelSolidAngleSteradians: base.pixelSolidAngleSteradians,
                    basisFingerprint: request.basisFingerprint,
                    quantity: RADIANCE_QUANTITY,
                    units: RADIANCE_UNITS,
                    components: Object.freeze({
                        pathSpectralRadianceDensity: base.path,
                        viewSpectralTransmittance: base.viewTransmittance,
                        endpointSpectralRadianceDensity: base.endpoint,
                        transportedEndpointSpectralRadianceDensity: base.transportedEndpoint,
                        extendedSpectralRadianceDensity: extendedValues,
                        pointSpectralRadianceDensity: pointValues,
                    }),
                    finalSpectralRadianceDensity: finalValues,
                    compositionResidual: residual,
                    display: Object.freeze({
                        displayFingerprint: this.displayFingerprint,
                        callCount: 1,
                        rgb: displayRgb,
                    }),
                }));
            }
        }

        const expectedDisplayCallCount = this.camera.widthPixels * this.camera.heightPixels;
        if (displayCallCount !== expectedDisplayCallCount) {
            throw configurationError('ER4C_FRAME_COMPOSER_DISPLAY_CALL_COUNT_INVALID',
                'The global display pass must run exactly once per completed pixel.');
        }
        const frozenTotals = freezeComponentTotals(totals, request.basisFingerprint);
        return Object.freeze({
            kind: 'physical-spectral-frame-composition-v1',
            widthPixels: this.camera.widthPixels,
            heightPixels: this.camera.heightPixels,
            pixels: Object.freeze(pixels),
            sources: Object.freeze({
                extended: extended.sourceIds,
                point: point.sourceIds,
            }),
            contributionCounts: Object.freeze({
                extendedPixels: extended.contributionCount,
                pointPixels: point.contributionCount,
            }),
            componentSpectralRadianceSolidAngleIntegrals: frozenTotals,
            maximumAbsoluteCompositionResidual,
            displayPass: Object.freeze({
                kind: 'one-global-post-composition-display-pass',
                displayFingerprint: this.displayFingerprint,
                displayDescriptor: this.displayDescriptor,
                expectedCallCount: expectedDisplayCallCount,
                actualCallCount: displayCallCount,
                sourceSpecificGain: false,
                preDisplaySpectralValuesRetained: true,
            }),
            quantity: RADIANCE_QUANTITY,
            units: RADIANCE_UNITS,
            fingerprints: Object.freeze({
                composer: this.fingerprint,
                camera: this.camera.fingerprint,
                display: this.displayFingerprint,
                basis: request.basisFingerprint,
            }),
        });
    }
}

function validateRadiancePacket(packet, basisFingerprint, label) {
    if (
        !packet
        || typeof packet !== 'object'
        || packet.quantity !== RADIANCE_QUANTITY
        || packet.units !== RADIANCE_UNITS
        || packet.basisFingerprint !== basisFingerprint
    ) {
        throw configurationError('ER4C_FRAME_COMPOSER_RADIANCE_PACKET_INVALID',
            `${label} must be typed spectral radiance density on the active basis.`);
    }
    return validateSpectrum(packet.values, label, false);
}

function validateTransmittancePacket(packet, basisFingerprint) {
    if (
        !packet
        || typeof packet !== 'object'
        || packet.quantity !== TRANSMITTANCE_QUANTITY
        || packet.units !== TRANSMITTANCE_UNITS
        || packet.basisFingerprint !== basisFingerprint
    ) {
        throw configurationError('ER4C_FRAME_COMPOSER_TRANSMITTANCE_PACKET_INVALID',
            'View transmittance must be typed and aligned with the active basis.');
    }
    const values = validateSpectrum(packet.values, 'view spectral transmittance', false);
    if (values.some((value) => value < 0 || value > 1)) {
        throw configurationError('ER4C_FRAME_COMPOSER_TRANSMITTANCE_RANGE_INVALID',
            'View spectral transmittance values must remain in [0, 1].');
    }
    return values;
}

function validateContributionPixel(pixel, camera, basisFingerprint, expected) {
    if (!pixel || typeof pixel !== 'object' || Array.isArray(pixel)) {
        throw configurationError('ER4C_FRAME_COMPOSER_CONTRIBUTION_PIXEL_INVALID',
            `${expected.sourceId} contribution pixel must be an object.`);
    }
    validatePixelCoordinate(pixel.pixelX, pixel.pixelY, camera);
    if (
        pixel.quantity !== expected.quantity
        || pixel.units !== RADIANCE_UNITS
        || pixel.basisFingerprint !== basisFingerprint
    ) {
        throw configurationError('ER4C_FRAME_COMPOSER_CONTRIBUTION_QUANTITY_INVALID',
            `${expected.sourceId} contribution is not aligned transported spectral radiance.`);
    }
    const exactSolidAngle = camera.pixelSolidAngleSteradians(pixel.pixelX, pixel.pixelY);
    if (
        !Number.isFinite(pixel.pixelSolidAngleSteradians)
        || Math.abs(pixel.pixelSolidAngleSteradians - exactSolidAngle) > 1e-15
    ) {
        throw configurationError('ER4C_FRAME_COMPOSER_PIXEL_SOLID_ANGLE_MISMATCH',
            `${expected.sourceId} contribution disagrees with the camera pixel solid angle.`);
    }
    validateSpectrum(pixel[expected.valuesField], `${expected.sourceId} contribution`, false);
}

function validateContributionFingerprints(
    result,
    expectedCameraFingerprint,
    expectedBasisFingerprint,
    label,
) {
    if (result?.fingerprints?.camera !== expectedCameraFingerprint) {
        throw configurationError('ER4C_FRAME_COMPOSER_CAMERA_FINGERPRINT_MISMATCH',
            `${label} contribution camera fingerprint does not match the frame camera.`);
    }
    if (result?.fingerprints?.basis !== expectedBasisFingerprint) {
        throw configurationError('ER4C_FRAME_COMPOSER_BASIS_FINGERPRINT_MISMATCH',
            `${label} contribution basis fingerprint does not match the frame basis.`);
    }
}

function validateSourceIdentity(sourceId, sourceIds, label) {
    if (typeof sourceId !== 'string' || sourceId.trim() === '') {
        throw configurationError('ER4C_FRAME_COMPOSER_SOURCE_ID_REQUIRED',
            `${label} contribution requires a source id.`);
    }
    if (sourceIds.has(sourceId)) {
        throw configurationError('ER4C_FRAME_COMPOSER_SOURCE_ID_DUPLICATE',
            `Celestial source id ${sourceId} is duplicated across frame inputs.`);
    }
    sourceIds.add(sourceId);
}

function validatePixelCoordinate(pixelX, pixelY, camera) {
    if (
        !Number.isInteger(pixelX)
        || !Number.isInteger(pixelY)
        || pixelX < 0
        || pixelX >= camera.widthPixels
        || pixelY < 0
        || pixelY >= camera.heightPixels
    ) {
        throw configurationError('ER4C_FRAME_COMPOSER_PIXEL_COORDINATE_INVALID',
            'Frame pixel coordinates must be in-frame integers.');
    }
}

function validateSpectrum(values, label, allowNegative) {
    if (
        !Array.isArray(values)
        || values.length !== CHANNEL_COUNT
        || !values.every(Number.isFinite)
        || (!allowNegative && values.some((value) => value < 0))
    ) {
        throw configurationError('ER4C_FRAME_COMPOSER_SPECTRUM_INVALID',
            `${label} must contain 15 finite${allowNegative ? '' : ' nonnegative'} values.`);
    }
    return Object.freeze([...values]);
}

function validateDisplayRgb(rgb) {
    if (
        !Array.isArray(rgb)
        || rgb.length !== 3
        || !rgb.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
    ) {
        throw configurationError('ER4C_FRAME_COMPOSER_DISPLAY_RGB_INVALID',
            'Global display conversion must return three finite values in [0, 1].');
    }
    return Object.freeze([...rgb]);
}

function createZeroFrameMap(keys) {
    const result = new Map();
    for (const key of keys) {
        result.set(key, Array(CHANNEL_COUNT).fill(0));
    }
    return result;
}

function accumulateInto(target, key, values) {
    const destination = target.get(key);
    if (!destination) {
        throw configurationError('ER4C_FRAME_COMPOSER_CONTRIBUTION_PIXEL_UNKNOWN',
            `Contribution targets unknown frame pixel ${key}.`);
    }
    for (let channel = 0; channel < CHANNEL_COUNT; channel += 1) {
        destination[channel] += values[channel];
    }
    if (!destination.every(Number.isFinite)) {
        throw configurationError('ER4C_FRAME_COMPOSER_CONTRIBUTION_SUM_NONFINITE',
            `Contribution sum at pixel ${key} is nonfinite.`);
    }
}

function createComponentTotals() {
    return {
        path: Array(CHANNEL_COUNT).fill(0),
        transportedEndpoint: Array(CHANNEL_COUNT).fill(0),
        extended: Array(CHANNEL_COUNT).fill(0),
        point: Array(CHANNEL_COUNT).fill(0),
        final: Array(CHANNEL_COUNT).fill(0),
    };
}

function accumulateComponentTotals(totals, solidAngle, components) {
    for (const [name, values] of Object.entries(components)) {
        for (let channel = 0; channel < CHANNEL_COUNT; channel += 1) {
            totals[name][channel] += values[channel] * solidAngle;
        }
    }
}

function freezeComponentTotals(totals, basisFingerprint) {
    return Object.freeze(Object.fromEntries(Object.entries(totals).map(([name, values]) => [
        name,
        Object.freeze({
            quantity: 'spectral-radiance-solid-angle-integral',
            units: 'W m^-2 nm^-1',
            basisFingerprint,
            values: Object.freeze([...values]),
        }),
    ])));
}

function multiplySpectra(left, right, label) {
    return validateSpectrum(left.map((value, index) => value * right[index]), label, false);
}

function addSpectra(left, right, label) {
    return validateSpectrum(left.map((value, index) => value + right[index]), label, false);
}

function subtractSpectra(left, right, label) {
    return validateSpectrum(left.map((value, index) => value - right[index]), label, true);
}

function zeroSpectrum() {
    return Object.freeze(Array(CHANNEL_COUNT).fill(0));
}

function pixelKey(pixelX, pixelY) {
    return `${pixelX},${pixelY}`;
}

function rejectUnknownFields(value, allowedFields, context) {
    const unknown = Object.keys(value).filter((field) => !allowedFields.includes(field));
    if (unknown.length > 0) {
        throw configurationError('ER4C_FRAME_COMPOSER_FIELD_UNSUPPORTED',
            `Unsupported ${context} fields are prohibited.`, { fields: unknown });
    }
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
