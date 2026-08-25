// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER2 exact pixel solid angle.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { stableHash } from '../provenance/stableHash.js';

const UNIT_VECTOR_TOLERANCE = 1e-12;

export default class PerspectiveCameraRaster {
    /**
     * @param {PerspectiveCameraRasterConfiguration} configuration - Perspective raster facts.
     */
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw configurationError('ER2_CAMERA_CONFIGURATION_REQUIRED',
                'Perspective camera raster configuration is required.');
        }
        this.widthPixels = requirePositiveInteger(
            configuration.widthPixels,
            'widthPixels',
        );
        this.heightPixels = requirePositiveInteger(
            configuration.heightPixels,
            'heightPixels',
        );
        if (
            !Number.isFinite(configuration.verticalFovDegrees)
            || configuration.verticalFovDegrees <= 0
            || configuration.verticalFovDegrees >= 180
        ) {
            throw configurationError('ER2_CAMERA_VERTICAL_FOV_INVALID',
                'Perspective camera vertical FOV must be finite in (0, 180) degrees.');
        }
        this.verticalFovDegrees = configuration.verticalFovDegrees;
        this.aspectRatio = this.widthPixels / this.heightPixels;
        this.halfProjectionHeight = Math.tan(this.verticalFovDegrees * Math.PI / 360);
        this.halfProjectionWidth = this.halfProjectionHeight * this.aspectRatio;
        if (
            !Number.isFinite(this.halfProjectionHeight)
            || !Number.isFinite(this.halfProjectionWidth)
            || this.halfProjectionHeight <= 0
            || this.halfProjectionWidth <= 0
        ) {
            throw configurationError('ER2_CAMERA_PROJECTION_EXTENT_INVALID',
                'Perspective camera projection extents must be finite and positive.');
        }
        this.horizontalFovDegrees = 2 * Math.atan(this.halfProjectionWidth) * 180 / Math.PI;
        this.fingerprint = stableHash(this.describe());
        Object.freeze(this);
    }

    /**
     * @returns {Readonly<Record<string, unknown>>} Immutable camera descriptor.
     */
    describe() {
        return Object.freeze({
            widthPixels: this.widthPixels,
            heightPixels: this.heightPixels,
            verticalFovDegrees: this.verticalFovDegrees,
            horizontalFovDegrees: this.horizontalFovDegrees,
            aspectRatio: this.aspectRatio,
            projectionKind: 'symmetric-gnomonic-perspective-v1',
            cameraForward: '-z',
            rasterYDirection: 'down',
            rasterBoundaryConvention: 'integer coordinates are pixel edges; centers are half-integers',
            responseCoordinateConvention:
                'pixel-center index = raster boundary coordinate - 0.5; integer response coordinates are pixel centers',
        });
    }

    /**
     * Resolve a unit camera ray through one integer raster-boundary coordinate.
     *
     * @param {number} boundaryX - Boundary coordinate in [0, width].
     * @param {number} boundaryY - Boundary coordinate in [0, height].
     * @returns {UnitVector3} Camera-space unit direction.
     */
    cornerRay(boundaryX, boundaryY) {
        if (
            !Number.isSafeInteger(boundaryX)
            || !Number.isSafeInteger(boundaryY)
            || boundaryX < 0
            || boundaryX > this.widthPixels
            || boundaryY < 0
            || boundaryY > this.heightPixels
        ) {
            throw configurationError('ER2_CAMERA_CORNER_COORDINATE_INVALID',
                'Corner coordinates must be finite and inside the raster boundary.');
        }
        const projectionX = (2 * boundaryX / this.widthPixels - 1)
            * this.halfProjectionWidth;
        const projectionY = (1 - 2 * boundaryY / this.heightPixels)
            * this.halfProjectionHeight;
        return normalize([projectionX, projectionY, -1]);
    }

    /**
     * Resolve one camera-space unit direction from continuous pixel-center coordinates.
     *
     * @param {number} rasterX - Continuous x in pixel-center coordinates.
     * @param {number} rasterY - Continuous y in pixel-center coordinates.
     * @returns {UnitVector3} Camera-space unit direction.
     */
    rasterCenterToDirection(rasterX, rasterY) {
        requireFiniteCoordinate(rasterX, rasterY, 'ER2_CAMERA_RASTER_COORDINATE_INVALID');
        const boundaryX = rasterX + 0.5;
        const boundaryY = rasterY + 0.5;
        const projectionX = (2 * boundaryX / this.widthPixels - 1)
            * this.halfProjectionWidth;
        const projectionY = (1 - 2 * boundaryY / this.heightPixels)
            * this.halfProjectionHeight;
        return normalize([projectionX, projectionY, -1]);
    }

    /**
     * Project one forward camera-space unit direction into pixel-center coordinates.
     *
     * @param {UnitVector3} direction - Camera-space unit direction.
     * @returns {RasterCenterCoordinate} Continuous pixel-center coordinate.
     */
    directionToRasterCenter(direction) {
        validateUnitDirection(direction);
        if (!(direction[2] < 0)) {
            throw configurationError('ER2_CAMERA_DIRECTION_NOT_FORWARD',
                'Perspective camera direction must point into the -z forward hemisphere.');
        }
        const projectionX = direction[0] / -direction[2];
        const projectionY = direction[1] / -direction[2];
        const boundaryX = (projectionX / this.halfProjectionWidth + 1)
            * this.widthPixels / 2;
        const boundaryY = (1 - projectionY / this.halfProjectionHeight)
            * this.heightPixels / 2;
        const x = boundaryX - 0.5;
        const y = boundaryY - 0.5;
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw configurationError('ER2_CAMERA_PROJECTED_COORDINATE_INVALID',
                'Projected raster-center coordinate must be finite.');
        }
        return Object.freeze({ x, y });
    }

    /**
     * Resolve exact gnomonic projection bounds for one destination pixel.
     *
     * @param {number} pixelX - Integer pixel x.
     * @param {number} pixelY - Integer pixel y.
     * @returns {PerspectivePixelProjectionBounds} Projection-plane bounds.
     */
    pixelProjectionBounds(pixelX, pixelY) {
        validatePixel(pixelX, pixelY, this.widthPixels, this.heightPixels);
        return Object.freeze({
            left: (2 * pixelX / this.widthPixels - 1) * this.halfProjectionWidth,
            right: (2 * (pixelX + 1) / this.widthPixels - 1) * this.halfProjectionWidth,
            top: (1 - 2 * pixelY / this.heightPixels) * this.halfProjectionHeight,
            bottom: (1 - 2 * (pixelY + 1) / this.heightPixels) * this.halfProjectionHeight,
        });
    }

    /**
     * Resolve the ordered corner rays used by the production solid-angle path.
     *
     * @param {number} pixelX - Integer pixel x.
     * @param {number} pixelY - Integer pixel y.
     * @returns {Readonly<Record<string, UnitVector3>>} TL/TR/BR/BL corner rays.
     */
    pixelCornerRays(pixelX, pixelY) {
        validatePixel(pixelX, pixelY, this.widthPixels, this.heightPixels);
        return Object.freeze({
            topLeft: this.cornerRay(pixelX, pixelY),
            topRight: this.cornerRay(pixelX + 1, pixelY),
            bottomRight: this.cornerRay(pixelX + 1, pixelY + 1),
            bottomLeft: this.cornerRay(pixelX, pixelY + 1),
        });
    }

    /**
     * Compute one exact perspective pixel solid angle from its four corner rays.
     *
     * @param {number} pixelX - Integer pixel x.
     * @param {number} pixelY - Integer pixel y.
     * @returns {number} Pixel solid angle in steradians.
     */
    pixelSolidAngleSteradians(pixelX, pixelY) {
        validatePixel(pixelX, pixelY, this.widthPixels, this.heightPixels);
        const corners = this.pixelCornerRays(pixelX, pixelY);
        const first = sphericalTriangleSolidAngle(
            corners.topLeft,
            corners.topRight,
            corners.bottomRight,
        );
        const second = sphericalTriangleSolidAngle(
            corners.topLeft,
            corners.bottomRight,
            corners.bottomLeft,
        );
        const result = first + second;
        if (!Number.isFinite(result) || result <= 0) {
            throw configurationError('ER2_CAMERA_PIXEL_SOLID_ANGLE_INVALID',
                'Perspective pixel solid angle must be finite and positive.');
        }
        return result;
    }

    /**
     * @returns {number} Analytic full rectangular-frustum solid angle in steradians.
     */
    analyticFrustumSolidAngleSteradians() {
        const x = this.halfProjectionWidth;
        const y = this.halfProjectionHeight;
        return 4 * Math.atan2(x * y, Math.sqrt(1 + x * x + y * y));
    }
}

function sphericalTriangleSolidAngle(a, b, c) {
    const numerator = dot(a, cross(b, c));
    const denominator = 1 + dot(a, b) + dot(b, c) + dot(c, a);
    const result = 2 * Math.atan2(numerator, denominator);
    if (!Number.isFinite(result) || result <= 0) {
        throw configurationError('ER2_CAMERA_TRIANGLE_WINDING_INVALID',
            'Perspective pixel triangle must have positive oriented solid angle.');
    }
    return result;
}

function validateUnitDirection(direction) {
    if (
        !Array.isArray(direction)
        || direction.length !== 3
        || !direction.every(Number.isFinite)
    ) {
        throw configurationError('ER2_CAMERA_DIRECTION_INVALID',
            'Perspective camera direction must be a finite 3-tuple.');
    }
    const length = Math.hypot(...direction);
    if (Math.abs(length - 1) > UNIT_VECTOR_TOLERANCE) {
        throw configurationError('ER2_CAMERA_DIRECTION_NOT_UNIT',
            'Perspective camera direction must be unit length.', { length });
    }
}

function validatePixel(x, y, width, height) {
    if (
        !Number.isInteger(x)
        || !Number.isInteger(y)
        || x < 0
        || x >= width
        || y < 0
        || y >= height
    ) {
        throw configurationError('ER2_CAMERA_PIXEL_INVALID',
            'Perspective camera pixel must be an in-frame integer coordinate.');
    }
}

function requirePositiveInteger(value, fieldName) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw configurationError('ER2_CAMERA_DIMENSION_INVALID',
            `${fieldName} must be a positive integer.`);
    }
    return value;
}

function requireFiniteCoordinate(x, y, code) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        throw configurationError(code, 'Raster coordinates must be finite.');
    }
}

function normalize(value) {
    const length = Math.hypot(...value);
    if (!Number.isFinite(length) || length <= 0) {
        throw configurationError('ER2_CAMERA_DIRECTION_DERIVATION_INVALID',
            'Camera direction derivation must produce a finite nonzero vector.');
    }
    return Object.freeze(value.map((entry) => entry / length));
}

function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
    return Object.freeze([
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]);
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
