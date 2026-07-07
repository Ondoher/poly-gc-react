// References:
// - agents/topics/apps/flat/reconciliation/action-plan.md, Stage 3.1.1.
// - agents/topics/apps/flat/reconciliation/shader-design.md, CPU postprocess shader and hit-data routing.
// - agents/topics/apps/flat/reconciliation/shader-test-design.md, scene construction and diagnostics contract.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';

const RGB_FIELD_NAMES = Object.freeze([
    'rgb',
    'rgba',
    'color',
    'sceneColor',
    'displayColor',
    'capturedRgb',
    'capturedRgba',
    'albedoRgb',
    'materialColor',
]);

const CAPTURED_SCENE_ENDPOINT_POLICY =
    'captured-scene-color-inverse-tone-mapped-as-endpoint-radiance-proxy';

export default class SoftShaderSceneInputAdapter {
    /**
     * @param {SoftShaderSceneInputAdapterConfig} [configuration] - Adapter validation options.
     */
    constructor(configuration = {}) {
        this._configuration = Object.freeze({
            rejectRgbFields: configuration.rejectRgbFields ?? true,
        });
    }

    /**
     * @param {SoftShaderScenePixelInput} pixelInput - One scene pixel to prepare for spectral evaluation.
     * @returns {SoftShaderPreparedPixel} Evaluation request plus post-transport endpoint contribution data.
     */
    preparePixel(pixelInput) {
        this._assertObject(pixelInput, 'Soft-shader pixel input is required.', 'MISSING_SOFT_SHADER_PIXEL_INPUT');

        if (this._configuration.rejectRgbFields) {
            this._assertNoRgbFields(pixelInput, 'pixelInput', new Set(['endpointContribution']));
        }

        const diagnostics = [];
        const sceneIntersection = this._normalizeSceneIntersection(pixelInput.sceneIntersection, diagnostics);
        const endpointContribution = this._normalizeEndpointContribution(pixelInput.endpointContribution);
        const viewRayRequest = this._buildViewRayRequest(pixelInput, sceneIntersection);

        return Object.freeze({
            pixelId: this._requireString(pixelInput.pixelId, 'pixelId'),
            coordinate: this._normalizePixelCoordinate(pixelInput.coordinate),
            evaluationRequest: Object.freeze({
                viewRayRequest,
                pathIntervalCount: pixelInput.pathIntervalCount,
            }),
            endpointContribution,
            sceneIntersectionKind: sceneIntersection.kind,
            sceneIntersectionDistanceMeters: sceneIntersection.distanceMeters,
            diagnostics: Object.freeze(diagnostics),
        });
    }

    /**
     * @param {SoftShaderScenePixelInput} pixelInput - Source pixel input.
     * @param {SoftShaderSceneIntersection} sceneIntersection - Normalized scene intersection.
     * @returns {SoftShaderViewRayRequest} Geometry-facing view-ray request.
     */
    _buildViewRayRequest(pixelInput, sceneIntersection) {
        const ray = this._normalizeRay(pixelInput.ray);
        /** @type {Record<string, unknown>} */
        const viewRayRequest = {
            ray,
            origin: ray.origin,
            direction: ray.direction,
            groundBoundaryMode: pixelInput.groundBoundaryMode ?? 'scene-hit-owned',
        };

        if (sceneIntersection.kind === 'hit') {
            viewRayRequest.endDistanceMeters = sceneIntersection.distanceMeters;
        }

        return Object.freeze(viewRayRequest);
    }

    /**
     * @param {SoftShaderEndpointContribution | null | undefined} endpointContribution - Endpoint data.
     * @returns {SoftShaderEndpointContribution | null} Normalized endpoint contribution.
     */
    _normalizeEndpointContribution(endpointContribution) {
        if (endpointContribution == null) {
            return null;
        }

        this._assertObject(
            endpointContribution,
            'Endpoint contribution must be an object when present.',
            'INVALID_ENDPOINT_CONTRIBUTION',
        );

        const policy = endpointContribution.policy ?? 'none';
        if (![
            'none',
            'spectrum-id-reference-radiance',
            'precomputed-spectral-radiance',
            'matte-lambertian-linear-srgb',
            CAPTURED_SCENE_ENDPOINT_POLICY,
        ].includes(policy)) {
            throw new ReconciliationConfigurationError('Unsupported endpoint contribution policy.', {
                code: 'UNSUPPORTED_ENDPOINT_CONTRIBUTION_POLICY',
                details: { policy },
            });
        }

        if (this._configuration.rejectRgbFields && policy !== CAPTURED_SCENE_ENDPOINT_POLICY) {
            this._assertNoRgbFields(endpointContribution, 'endpointContribution');
        }

        const opacity = endpointContribution.opacity ?? 'opaque';
        if (opacity !== 'opaque') {
            throw new ReconciliationConfigurationError('Only opaque endpoint contributions are supported.', {
                code: 'UNSUPPORTED_ENDPOINT_OPACITY',
                details: { opacity },
            });
        }

        const capturedSceneColorDisplayRgb = endpointContribution.capturedSceneColorDisplayRgb
            ? this._normalizeRgbTriplet(
                endpointContribution.capturedSceneColorDisplayRgb,
                'endpointContribution.capturedSceneColorDisplayRgb',
            )
            : null;
        if (policy === CAPTURED_SCENE_ENDPOINT_POLICY && !capturedSceneColorDisplayRgb) {
            throw new ReconciliationConfigurationError('Captured scene endpoint policy requires capturedSceneColorDisplayRgb.', {
                code: 'MISSING_CAPTURED_SCENE_ENDPOINT_COLOR',
                details: { policy },
            });
        }

        return Object.freeze({
            policy,
            opacity,
            spectralReferenceId: endpointContribution.spectralReferenceId ?? null,
            endpointRadiance: endpointContribution.endpointRadiance ?? null,
            capturedSceneColorDisplayRgb,
            linearSrgbAlbedo: endpointContribution.linearSrgbAlbedo
                ? this._normalizePosition(endpointContribution.linearSrgbAlbedo, 'endpointContribution.linearSrgbAlbedo')
                : null,
            surfaceNormal: endpointContribution.surfaceNormal
                ? this._normalizePosition(endpointContribution.surfaceNormal, 'endpointContribution.surfaceNormal')
                : null,
            hitPosition: endpointContribution.hitPosition
                ? this._normalizePosition(endpointContribution.hitPosition, 'endpointContribution.hitPosition')
                : null,
            metadata: endpointContribution.metadata ?? null,
        });
    }

    /**
     * @param {SoftShaderSceneIntersection | null | undefined} sceneIntersection - Scene hit input.
     * @param {ReconciliationDiagnostic[]} diagnostics - Diagnostic collector.
     * @returns {SoftShaderSceneIntersection} Normalized scene intersection.
     */
    _normalizeSceneIntersection(sceneIntersection, diagnostics) {
        if (sceneIntersection == null) {
            return Object.freeze({ kind: 'no-hit' });
        }

        this._assertObject(
            sceneIntersection,
            'Scene intersection must be an object when present.',
            'INVALID_SCENE_INTERSECTION',
        );

        const kind = sceneIntersection.kind ?? 'no-hit';
        if (!['hit', 'no-hit', 'invalid'].includes(kind)) {
            throw new ReconciliationConfigurationError('Unsupported scene intersection kind.', {
                code: 'UNSUPPORTED_SCENE_INTERSECTION_KIND',
                details: { kind },
            });
        }

        if (kind === 'hit' && !Number.isFinite(sceneIntersection.distanceMeters)) {
            throw new ReconciliationConfigurationError('Scene hit must include finite distanceMeters.', {
                code: 'MISSING_SCENE_HIT_DISTANCE',
                details: { sceneIntersection },
            });
        }

        if (kind === 'invalid') {
            diagnostics.push(Object.freeze({
                id: 'soft-shader-invalid-scene-intersection',
                severity: 'warning',
                message: 'Scene intersection is invalid; geometry receives invalid classification without a hit cap.',
                details: {
                    invalidReason: sceneIntersection.invalidReason ?? null,
                },
            }));
        }

        return Object.freeze({
            kind,
            distanceMeters: kind === 'hit' ? sceneIntersection.distanceMeters : null,
            hitPosition: sceneIntersection.hitPosition ?? null,
            invalidReason: sceneIntersection.invalidReason ?? null,
            metadata: sceneIntersection.metadata ?? null,
        });
    }

    /**
     * @param {unknown} coordinate - Pixel coordinate input.
     * @returns {SoftShaderPixelCoordinate} Normalized pixel coordinate.
     */
    _normalizePixelCoordinate(coordinate) {
        this._assertObject(coordinate, 'Pixel coordinate is required.', 'MISSING_PIXEL_COORDINATE');
        const { x, y } = coordinate;
        if (!Number.isInteger(x) || !Number.isInteger(y)) {
            throw new ReconciliationConfigurationError('Pixel coordinate x/y must be integers.', {
                code: 'INVALID_PIXEL_COORDINATE',
                details: { coordinate },
            });
        }

        return Object.freeze({ x, y });
    }

    /**
     * @param {unknown} ray - Ray input.
     * @returns {Ray} Normalized ray.
     */
    _normalizeRay(ray) {
        this._assertObject(ray, 'Pixel ray is required.', 'MISSING_PIXEL_RAY');
        return Object.freeze({
            origin: this._normalizePosition(ray.origin, 'ray.origin'),
            direction: this._normalizePosition(ray.direction, 'ray.direction'),
        });
    }

    /**
     * @param {unknown} value - Position or direction tuple.
     * @param {string} fieldName - Field name for diagnostics.
     * @returns {Position} Normalized tuple.
     */
    _normalizePosition(value, fieldName) {
        if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
            throw new ReconciliationConfigurationError(`${fieldName} must be a finite 3-tuple.`, {
                code: 'INVALID_VECTOR3',
                details: { fieldName, value },
            });
        }

        return Object.freeze([value[0], value[1], value[2]]);
    }

    /**
     * @param {unknown} value - RGB tuple.
     * @param {string} fieldName - Field name for diagnostics.
     * @returns {readonly [number, number, number]} Normalized display RGB tuple.
     */
    _normalizeRgbTriplet(value, fieldName) {
        if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
            throw new ReconciliationConfigurationError(`${fieldName} must be a finite RGB triplet.`, {
                code: 'INVALID_RGB_TRIPLET',
                details: { fieldName, value },
            });
        }

        return Object.freeze(value.map((entry) => Math.max(0, Math.min(1, entry))));
    }

    /**
     * @param {unknown} value - Candidate string.
     * @param {string} fieldName - Field name.
     * @returns {string} String value.
     */
    _requireString(value, fieldName) {
        if (typeof value !== 'string' || value.length === 0) {
            throw new ReconciliationConfigurationError(`${fieldName} must be a non-empty string.`, {
                code: 'INVALID_STRING_FIELD',
                details: { fieldName, value },
            });
        }

        return value;
    }

    /**
     * @param {unknown} value - Candidate object.
     * @param {string} message - Error message.
     * @param {string} code - Error code.
     * @returns {void}
     */
    _assertObject(value, message, code) {
        if (!value || typeof value !== 'object') {
            throw new ReconciliationConfigurationError(message, { code });
        }
    }

    /**
     * @param {unknown} value - Value to scan.
     * @param {string} path - Current diagnostic path.
     * @returns {void}
     */
    _assertNoRgbFields(value, path, ignoredKeys = new Set()) {
        if (!value || typeof value !== 'object') {
            return;
        }

        for (const key of Object.keys(value)) {
            if (ignoredKeys.has(key)) {
                continue;
            }

            if (RGB_FIELD_NAMES.includes(key)) {
                throw new ReconciliationConfigurationError('RGB/display color fields are not soft-shader evaluate inputs.', {
                    code: 'RGB_FIELD_REJECTED_FROM_EVALUATE_INPUT',
                    details: { path: `${path}.${key}` },
                });
            }

            this._assertNoRgbFields(value[key], `${path}.${key}`, ignoredKeys);
        }
    }
}
