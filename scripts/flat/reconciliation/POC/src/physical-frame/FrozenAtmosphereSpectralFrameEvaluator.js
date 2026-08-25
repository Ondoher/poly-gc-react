// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   frozen Algorithm32 directional sampling for base, point, and extended paths.

import PerspectiveCameraRaster from '../camera/PerspectiveCameraRaster.js';
import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';

const CHANNEL_COUNT = 15;
const RADIANCE_UNITS = 'W m^-2 sr^-1 nm^-1';
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;
const MATRIX_TOLERANCE = 1e-12;
const CONFIGURATION_FIELDS = Object.freeze([
    'camera',
    'evaluator',
    'basisFingerprint',
    'cameraToAtmosphereMatrix',
    'evaluatorDescriptor',
]);

export default class FrozenAtmosphereSpectralFrameEvaluator {
    /**
     * @param {FrozenAtmosphereSpectralFrameEvaluatorConfiguration} configuration - Frozen evaluator adapter facts.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object' || Array.isArray(configuration)) {
            throw configurationError('ER4C_ATMOSPHERE_FRAME_CONFIGURATION_REQUIRED',
                'Frozen atmosphere frame evaluator configuration is required.');
        }
        rejectUnknownFields(configuration, CONFIGURATION_FIELDS, 'configuration');
        if (!(configuration.camera instanceof PerspectiveCameraRaster)) {
            throw configurationError('ER4C_ATMOSPHERE_FRAME_CAMERA_REQUIRED',
                'Frozen atmosphere frame evaluator requires a PerspectiveCameraRaster.');
        }
        if (!configuration.evaluator || typeof configuration.evaluator.evaluate !== 'function') {
            throw configurationError('ER4C_ATMOSPHERE_FRAME_EVALUATOR_REQUIRED',
                'Frozen atmosphere frame evaluator requires a public evaluate method.');
        }
        if (!FINGERPRINT_PATTERN.test(configuration.basisFingerprint ?? '')) {
            throw configurationError('ER4C_ATMOSPHERE_FRAME_BASIS_INVALID',
                'Frozen atmosphere frame evaluator requires a SHA-256 basis fingerprint.');
        }

        let evaluatorDescriptor;
        try {
            evaluatorDescriptor = freezeJsonValue(configuration.evaluatorDescriptor);
        } catch (error) {
            throw configurationError('ER4C_ATMOSPHERE_FRAME_DESCRIPTOR_INVALID',
                'Frozen evaluator descriptor must be finite JSON.', { cause: error.message });
        }
        if (
            !evaluatorDescriptor
            || typeof evaluatorDescriptor !== 'object'
            || typeof evaluatorDescriptor.kind !== 'string'
            || evaluatorDescriptor.kind.trim() === ''
        ) {
            throw configurationError('ER4C_ATMOSPHERE_FRAME_DESCRIPTOR_KIND_REQUIRED',
                'Frozen evaluator descriptor requires a non-empty kind.');
        }

        this.camera = configuration.camera;
        this.basisFingerprint = configuration.basisFingerprint;
        this.cameraToAtmosphereMatrix = validateRotationMatrix(
            configuration.cameraToAtmosphereMatrix,
        );
        this.evaluatorDescriptor = evaluatorDescriptor;
        this._evaluate = configuration.evaluator.evaluate.bind(configuration.evaluator);
        this.fingerprint = stableHash(this.describe());
        Object.freeze(this);
    }

    /**
     * Describe the one directional adapter shared by base, point, and extended paths.
     *
     * @returns {Readonly<Record<string, unknown>>} Immutable directional adapter descriptor.
     */
    describe() {
        return Object.freeze({
            kind: 'frozen-atmosphere-spectral-frame-evaluator-v1',
            channelCount: CHANNEL_COUNT,
            cameraFingerprint: this.camera.fingerprint,
            basisFingerprint: this.basisFingerprint,
            cameraToAtmosphereMatrix: this.cameraToAtmosphereMatrix,
            evaluatorDescriptor: this.evaluatorDescriptor,
            directionPolicy: 'orthonormal-camera-to-atmosphere-map-without-center-substitution',
            sourceDepthPolicy:
                'finite-depth-clips-the-view-request; infinite-depth-runs-to-the-atmosphere-boundary',
            displayOwnership: 'outside-this-class',
        });
    }

    /**
     * Map one exact camera-space unit direction into the frozen atmosphere frame.
     *
     * @param {readonly number[]} directionCamera - Camera-space direction.
     * @returns {readonly [number, number, number]} Atmosphere-model direction.
     */
    _mapDirection(directionCamera) {
        validateUnitDirection(directionCamera, 'camera direction');
        const mapped = this.cameraToAtmosphereMatrix.map((row) =>
            row.reduce((sum, value, index) => sum + value * directionCamera[index], 0));
        validateUnitDirection(mapped, 'mapped atmosphere direction');
        return Object.freeze(mapped);
    }

    /**
     * Evaluate frozen Algorithm32 output at one exact direction and optional source depth.
     *
     * @param {readonly number[]} directionCamera - Exact camera-space direction.
     * @param {Readonly<Record<string, unknown>> | null} depth - Finite or infinite depth.
     * @returns {FrozenAtmosphereDirectionalEvaluation} Validated spectral result.
     */
    _evaluateDirection(directionCamera, depth = null) {
        const atmosphereDirection = this._mapDirection(directionCamera);
        const validatedDepth = depth == null ? Object.freeze({ kind: 'infinite' }) : validateDepth(depth);
        const viewRayRequest = {
            direction: atmosphereDirection,
        };
        if (validatedDepth.kind === 'finite') {
            viewRayRequest.endDistanceMeters = validatedDepth.distanceMeters;
        }
        const output = this._evaluate({ viewRayRequest });
        const path = validateEvaluationOutput(
            output,
            atmosphereDirection,
            validatedDepth.kind === 'finite' ? validatedDepth.distanceMeters : null,
        );
        return Object.freeze({
            directionCamera: Object.freeze([...directionCamera]),
            directionAtmosphere: atmosphereDirection,
            depth: validatedDepth,
            viewRayRequest: Object.freeze({ ...viewRayRequest }),
            pathLengthMeters: path.pathLengthMeters,
            pathSpectralRadianceDensity: radiancePacket(
                path.pathRadiance,
                this.basisFingerprint,
            ),
            viewSpectralTransmittance: transmittancePacket(
                path.transmittance,
                this.basisFingerprint,
            ),
        });
    }

    /**
     * Evaluate one public exact direction for diagnostics and discriminator tests.
     *
     * @param {readonly number[]} directionCamera - Exact camera-space unit direction.
     * @param {Readonly<Record<string, unknown>> | null} [depth] - Finite or infinite depth.
     * @returns {FrozenAtmosphereDirectionalEvaluation} Validated spectral result.
     */
    evaluateCameraDirection(directionCamera, depth = null) {
        return this._evaluateDirection(directionCamera, depth);
    }

    /**
     * Evaluate every destination-pixel center without celestial source composition.
     *
     * @returns {FrozenAtmosphereBaseFrameEvaluation} Complete base frame and ray diagnostics.
     */
    evaluateBaseFrame() {
        const basePixels = [];
        const directions = [];
        for (let pixelY = 0; pixelY < this.camera.heightPixels; pixelY += 1) {
            for (let pixelX = 0; pixelX < this.camera.widthPixels; pixelX += 1) {
                const directionCamera = this.camera.rasterCenterToDirection(pixelX, pixelY);
                const evaluation = this._evaluateDirection(directionCamera);
                basePixels.push(Object.freeze({
                    pixelX,
                    pixelY,
                    pathSpectralRadianceDensity: evaluation.pathSpectralRadianceDensity,
                    viewSpectralTransmittance: evaluation.viewSpectralTransmittance,
                    endpointSpectralRadianceDensity: null,
                }));
                directions.push(Object.freeze({
                    pixelX,
                    pixelY,
                    pixelSolidAngleSteradians: this.camera.pixelSolidAngleSteradians(
                        pixelX,
                        pixelY,
                    ),
                    directionCamera: evaluation.directionCamera,
                    directionAtmosphere: evaluation.directionAtmosphere,
                    pathLengthMeters: evaluation.pathLengthMeters,
                }));
            }
        }
        return Object.freeze({
            kind: 'frozen-atmosphere-base-spectral-frame-v1',
            widthPixels: this.camera.widthPixels,
            heightPixels: this.camera.heightPixels,
            basePixels: Object.freeze(basePixels),
            directions: Object.freeze(directions),
            quantity: Object.freeze({
                path: 'spectral-radiance-density',
                transmittance: 'spectral-transmittance',
                endpoint: 'absent',
            }),
            units: Object.freeze({
                path: RADIANCE_UNITS,
                transmittance: '1',
                pathLength: 'm',
            }),
            fingerprints: Object.freeze({
                frameEvaluator: this.fingerprint,
                camera: this.camera.fingerprint,
                basis: this.basisFingerprint,
            }),
        });
    }

    /**
     * Sample exact-source point transmittance before response spreading.
     *
     * @param {ExactPointSourceRay} ray - Exact point-source ray.
     * @returns {ExactPointSourceTransmittanceResult} Typed aligned transmittance.
     */
    sampleExactSourceTransmittance(ray) {
        validateRay(ray, 'point');
        return callbackTransmittance(
            this._evaluateDirection(ray.directionCamera, ray.depth).viewSpectralTransmittance,
        );
    }

    /**
     * Sample transmittance independently at one extended-source quadrature ray.
     *
     * @param {ExactExtendedSampleRay} ray - Exact quadrature ray.
     * @returns {ExactExtendedSampleTransmittanceResult} Typed aligned transmittance.
     */
    sampleExtendedSampleTransmittance(ray) {
        validateRay(ray, 'extended');
        return callbackTransmittance(
            this._evaluateDirection(ray.directionCamera, ray.depth).viewSpectralTransmittance,
        );
    }
}

function validateEvaluationOutput(output, expectedDirection, maximumDistanceMeters) {
    const pathRadiance = output?.pathRadiance;
    const inScattered = pathRadiance?.inScattered;
    const transmittance = pathRadiance?.transmittance;
    if (output?.outputKind !== 'spectral') {
        throw configurationError('ER4C_ATMOSPHERE_FRAME_OUTPUT_KIND_INVALID',
            'Frozen atmosphere evaluator must return spectral output.');
    }
    validateSpectrum(inScattered, 'path spectral radiance', false);
    validateSpectrum(transmittance, 'view spectral transmittance', false);
    if (transmittance.some((value) => value < 0 || value > 1)) {
        throw configurationError('ER4C_ATMOSPHERE_FRAME_TRANSMITTANCE_RANGE_INVALID',
            'Frozen atmosphere transmittance values must remain in [0, 1].');
    }
    const segment = output.viewRaySegment;
    const start = segment?.startDistanceMeters;
    const end = segment?.endDistanceMeters;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) {
        throw configurationError('ER4C_ATMOSPHERE_FRAME_PATH_LENGTH_INVALID',
            'Frozen atmosphere output must retain an ordered finite view segment.');
    }
    validateUnitDirection(segment?.ray?.direction, 'returned atmosphere direction');
    if (maximumAbsoluteDifference(segment.ray.direction, expectedDirection) > 1e-12) {
        throw configurationError('ER4C_ATMOSPHERE_FRAME_RETURNED_DIRECTION_MISMATCH',
            'Frozen atmosphere output direction must equal the exact requested direction.');
    }
    if (
        maximumDistanceMeters !== null
        && end > maximumDistanceMeters + 1e-9 * Math.max(1, maximumDistanceMeters)
    ) {
        throw configurationError('ER4C_ATMOSPHERE_FRAME_FINITE_DEPTH_EXCEEDED',
            'Frozen atmosphere output extends beyond the requested finite source depth.', {
                maximumDistanceMeters,
                returnedEndDistanceMeters: end,
            });
    }
    if (containsDisplayField(output)) {
        throw configurationError('ER4C_ATMOSPHERE_FRAME_DISPLAY_OUTPUT_PROHIBITED',
            'Frozen atmosphere evaluator must not return display-domain output.');
    }
    return Object.freeze({
        pathRadiance: Object.freeze([...inScattered]),
        transmittance: Object.freeze([...transmittance]),
        pathLengthMeters: end - start,
    });
}

function containsDisplayField(value, ancestors = new Set()) {
    if (!value || typeof value !== 'object') {
        return false;
    }
    if (ancestors.has(value)) {
        return false;
    }
    ancestors.add(value);
    const result = Object.entries(value).some(([key, entry]) =>
        /display|(^|[-_])rgba?($|[-_])|srgb|tone.?map/i.test(key)
        || containsDisplayField(entry, ancestors));
    ancestors.delete(value);
    return result;
}

function validateRay(ray, label) {
    if (!ray || typeof ray !== 'object' || Array.isArray(ray)) {
        throw configurationError('ER4C_ATMOSPHERE_FRAME_EXACT_RAY_REQUIRED',
            `${label} transmittance requires an exact ray object.`);
    }
    validateUnitDirection(ray.directionCamera, `${label} exact direction`);
    validateDepth(ray.depth);
}

function validateDepth(depth) {
    if (!depth || typeof depth !== 'object' || Array.isArray(depth)) {
        throw configurationError('ER4C_ATMOSPHERE_FRAME_DEPTH_REQUIRED',
            'Directional atmosphere sampling requires finite or infinite depth.');
    }
    if (depth.kind === 'infinite' && Object.keys(depth).length === 1) {
        return Object.freeze({ kind: 'infinite' });
    }
    if (
        depth.kind === 'finite'
        && Object.keys(depth).every((key) => ['kind', 'distanceMeters'].includes(key))
        && Number.isFinite(depth.distanceMeters)
        && depth.distanceMeters > 0
    ) {
        return Object.freeze({ kind: 'finite', distanceMeters: depth.distanceMeters });
    }
    throw configurationError('ER4C_ATMOSPHERE_FRAME_DEPTH_INVALID',
        'Directional atmosphere depth must be infinite or positive finite meters.');
}

function validateRotationMatrix(matrix) {
    if (
        !Array.isArray(matrix)
        || matrix.length !== 3
        || !matrix.every((row) =>
            Array.isArray(row) && row.length === 3 && row.every(Number.isFinite))
    ) {
        throw configurationError('ER4C_ATMOSPHERE_FRAME_ROTATION_MATRIX_INVALID',
            'cameraToAtmosphereMatrix must be a finite 3x3 matrix.');
    }
    const rows = matrix.map((row) => Object.freeze([...row]));
    for (let row = 0; row < 3; row += 1) {
        for (let other = 0; other < 3; other += 1) {
            const product = rows[row].reduce((sum, value, column) =>
                sum + value * rows[other][column], 0);
            const expected = row === other ? 1 : 0;
            if (Math.abs(product - expected) > MATRIX_TOLERANCE) {
                throw configurationError('ER4C_ATMOSPHERE_FRAME_ROTATION_NOT_ORTHONORMAL',
                    'cameraToAtmosphereMatrix rows must be orthonormal.');
            }
        }
    }
    const determinant = rows[0][0] * (rows[1][1] * rows[2][2] - rows[1][2] * rows[2][1])
        - rows[0][1] * (rows[1][0] * rows[2][2] - rows[1][2] * rows[2][0])
        + rows[0][2] * (rows[1][0] * rows[2][1] - rows[1][1] * rows[2][0]);
    if (Math.abs(determinant - 1) > MATRIX_TOLERANCE) {
        throw configurationError('ER4C_ATMOSPHERE_FRAME_ROTATION_HANDEDNESS_INVALID',
            'cameraToAtmosphereMatrix must be a proper rotation with determinant +1.');
    }
    return Object.freeze(rows);
}

function validateUnitDirection(direction, label) {
    if (
        !Array.isArray(direction)
        || direction.length !== 3
        || !direction.every(Number.isFinite)
        || Math.abs(Math.hypot(...direction) - 1) > 1e-12
    ) {
        throw configurationError('ER4C_ATMOSPHERE_FRAME_DIRECTION_INVALID',
            `${label} must be a finite unit vector.`);
    }
}

function maximumAbsoluteDifference(left, right) {
    return Math.max(...left.map((value, index) => Math.abs(value - right[index])));
}

function validateSpectrum(values, label, allowNegative) {
    if (
        !Array.isArray(values)
        || values.length !== CHANNEL_COUNT
        || !values.every(Number.isFinite)
        || (!allowNegative && values.some((value) => value < 0))
    ) {
        throw configurationError('ER4C_ATMOSPHERE_FRAME_SPECTRUM_INVALID',
            `${label} must contain 15 finite${allowNegative ? '' : ' nonnegative'} values.`);
    }
}

function radiancePacket(values, basisFingerprint) {
    return Object.freeze({
        quantity: 'spectral-radiance-density',
        units: RADIANCE_UNITS,
        basisFingerprint,
        values: Object.freeze([...values]),
    });
}

function transmittancePacket(values, basisFingerprint) {
    return Object.freeze({
        quantity: 'spectral-transmittance',
        units: '1',
        basisFingerprint,
        values: Object.freeze([...values]),
    });
}

function callbackTransmittance(packet) {
    return Object.freeze({
        units: packet.units,
        basisFingerprint: packet.basisFingerprint,
        values: packet.values,
    });
}

function rejectUnknownFields(value, allowedFields, context) {
    const unknown = Object.keys(value).filter((field) => !allowedFields.includes(field));
    if (unknown.length > 0) {
        throw configurationError('ER4C_ATMOSPHERE_FRAME_FIELD_UNSUPPORTED',
            `Unsupported ${context} fields are prohibited.`, { fields: unknown });
    }
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
