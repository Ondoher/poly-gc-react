// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER2 ideal response decision.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { stableHash } from '../provenance/stableHash.js';

export default class BilinearPointResponse {
    constructor() {
        this.kind = 'cardinal-bilinear-pixel-center-splat-v1';
        this.fingerprint = stableHash(this.describe());
        Object.freeze(this);
    }

    /**
     * @returns {Readonly<Record<string, unknown>>} Ideal response descriptor.
     */
    describe() {
        return Object.freeze({
            kind: this.kind,
            interpretation: 'ideal-achromatic-raster-reconstruction-response',
            coordinateSystem: 'continuous-pixel-center',
            support: 'discrete partition of unity over two pixel centers per axis; at most four destinations',
            fullResponseNormalization: 1,
            edgePolicy: 'retain off-raster weights; never renormalize on-frame weights',
            projectionDomainPolicy:
                'a source outside the forward perspective hemisphere retains one fully off-raster response weight',
            excludedClaims: [
                'diffraction',
                'aperture',
                'atmospheric seeing',
                'human eye',
                'camera sensor',
                'display bloom or glare',
            ],
        });
    }

    /**
     * Resolve full, on-frame, and off-raster response weights.
     *
     * @param {BilinearPointResponseRequest} request - Continuous raster location and frame.
     * @returns {Readonly<Record<string, unknown>>} Normalized response diagnostics.
     */
    resolve(request) {
        if (!request || typeof request !== 'object') {
            throw configurationError('ER2_RESPONSE_REQUEST_REQUIRED',
                'Bilinear point response request is required.');
        }
        rejectCoverageFields(request);
        if (!Number.isFinite(request.rasterX) || !Number.isFinite(request.rasterY)) {
            throw configurationError('ER2_RESPONSE_RASTER_COORDINATE_INVALID',
                'Bilinear response coordinates must be finite.');
        }
        if (
            !Number.isInteger(request.widthPixels)
            || request.widthPixels <= 0
            || !Number.isInteger(request.heightPixels)
            || request.heightPixels <= 0
        ) {
            throw configurationError('ER2_RESPONSE_FRAME_DIMENSION_INVALID',
                'Bilinear response frame dimensions must be positive integers.');
        }

        const xWeights = axisWeights(request.rasterX);
        const yWeights = axisWeights(request.rasterY);
        const destinations = [];
        for (const x of xWeights) {
            for (const y of yWeights) {
                const weight = x.weight * y.weight;
                if (weight === 0) {
                    continue;
                }
                destinations.push(Object.freeze({
                    pixelX: x.index,
                    pixelY: y.index,
                    weight,
                    onFrame: x.index >= 0
                        && x.index < request.widthPixels
                        && y.index >= 0
                        && y.index < request.heightPixels,
                }));
            }
        }
        const fullWeight = destinations.reduce((sum, destination) => sum + destination.weight, 0);
        const onFrameWeight = destinations.reduce((sum, destination) =>
            sum + (destination.onFrame ? destination.weight : 0), 0);
        const offRasterWeight = destinations.reduce((sum, destination) =>
            sum + (destination.onFrame ? 0 : destination.weight), 0);
        if (destinations.some((destination) => destination.weight < 0)) {
            throw configurationError('ER2_RESPONSE_WEIGHT_NEGATIVE',
                'Bilinear response produced a negative weight.');
        }
        if (Math.abs(fullWeight - 1) > 1e-15) {
            throw configurationError('ER2_RESPONSE_NOT_NORMALIZED',
                'Bilinear response full weights do not sum to one.', { fullWeight });
        }
        return Object.freeze({
            kind: this.kind,
            rasterX: request.rasterX,
            rasterY: request.rasterY,
            destinations: Object.freeze(destinations),
            onFrameDestinations: Object.freeze(destinations.filter((entry) => entry.onFrame)),
            offRasterDestinations: Object.freeze(destinations.filter((entry) => !entry.onFrame)),
            fullWeight,
            onFrameWeight,
            offRasterWeight,
            normalizationResidual: fullWeight - 1,
            accountingResidual: onFrameWeight + offRasterWeight - 1,
        });
    }

    /**
     * Resolve a normalized response for a source outside the perspective projection domain.
     *
     * @param {Readonly<Record<string, unknown>>} request - Raster dimensions retained for diagnostics.
     * @returns {Readonly<Record<string, unknown>>} Fully off-raster response diagnostics.
     */
    resolveOutsideForwardHemisphere(request) {
        if (!request || typeof request !== 'object') {
            throw configurationError('ER2_RESPONSE_OUTSIDE_REQUEST_REQUIRED',
                'Outside-hemisphere point response request is required.');
        }
        rejectCoverageFields(request);
        rejectUnknownFields(request, ['widthPixels', 'heightPixels']);
        if (
            !Number.isInteger(request.widthPixels)
            || request.widthPixels <= 0
            || !Number.isInteger(request.heightPixels)
            || request.heightPixels <= 0
        ) {
            throw configurationError('ER2_RESPONSE_FRAME_DIMENSION_INVALID',
                'Bilinear response frame dimensions must be positive integers.');
        }
        const destination = Object.freeze({
            pixelX: null,
            pixelY: null,
            weight: 1,
            onFrame: false,
            reason: 'outside-forward-camera-hemisphere',
        });
        return Object.freeze({
            kind: this.kind,
            rasterX: null,
            rasterY: null,
            projectionStatus: 'outside-forward-camera-hemisphere',
            frame: Object.freeze({
                widthPixels: request.widthPixels,
                heightPixels: request.heightPixels,
            }),
            destinations: Object.freeze([destination]),
            onFrameDestinations: Object.freeze([]),
            offRasterDestinations: Object.freeze([destination]),
            fullWeight: 1,
            onFrameWeight: 0,
            offRasterWeight: 1,
            normalizationResidual: 0,
            accountingResidual: 0,
        });
    }
}

function axisWeights(coordinate) {
    const lowerIndex = Math.floor(coordinate);
    if (!Number.isSafeInteger(lowerIndex) || !Number.isSafeInteger(lowerIndex + 1)) {
        throw configurationError('ER2_RESPONSE_RASTER_COORDINATE_UNSAFE',
            'Bilinear response coordinates must resolve to safe integer destinations.');
    }
    const upperWeight = coordinate - lowerIndex;
    return Object.freeze([
        Object.freeze({ index: lowerIndex, weight: 1 - upperWeight }),
        Object.freeze({ index: lowerIndex + 1, weight: upperWeight }),
    ]);
}

function rejectCoverageFields(request) {
    const prohibited = ['coverage', 'opacity', 'alpha', 'remainingCoverage', 'geometryCoverage'];
    const found = prohibited.filter((field) => Object.hasOwn(request, field));
    if (found.length > 0) {
        throw configurationError('ER2_RESPONSE_COVERAGE_FIELD_PROHIBITED',
            'Point-response weight is not coverage or opacity.', { fields: found });
    }
}

function rejectUnknownFields(request, allowedFields) {
    const unknown = Object.keys(request).filter((field) => !allowedFields.includes(field));
    if (unknown.length > 0) {
        throw configurationError('ER2_RESPONSE_FIELD_UNSUPPORTED',
            'Point response request contains unsupported fields.', { fields: unknown });
    }
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
