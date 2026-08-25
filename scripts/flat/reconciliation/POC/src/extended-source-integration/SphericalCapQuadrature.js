import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';

export default class SphericalCapQuadrature {
    constructor(configuration) {
        if (!configuration || typeof configuration !== 'object') {
            throw error('ER3_QUADRATURE_CONFIGURATION_REQUIRED', 'Spherical-cap quadrature configuration is required.');
        }
        this.angularRadiusRadians = configuration.angularRadiusRadians;
        this.radialCount = configuration.radialCount;
        this.azimuthCount = configuration.azimuthCount;
        if (!Number.isFinite(this.angularRadiusRadians) || this.angularRadiusRadians <= 0 || this.angularRadiusRadians >= Math.PI / 2) {
            throw error('ER3_QUADRATURE_RADIUS_INVALID', 'Spherical-cap radius must be finite in (0, pi/2).');
        }
        if (!Number.isSafeInteger(this.radialCount) || this.radialCount <= 0 || !Number.isSafeInteger(this.azimuthCount) || this.azimuthCount <= 0) {
            throw error('ER3_QUADRATURE_COUNT_INVALID', 'Spherical-cap quadrature counts must be positive safe integers.');
        }
    }

    sample(centerDirectionCamera) {
        validateUnit(centerDirectionCamera);
        const tangent = orthogonal(centerDirectionCamera);
        const bitangent = cross(centerDirectionCamera, tangent);
        // The half-angle form preserves the cap width for very small disks.
        const muMinimum = 1 - 2 * Math.sin(this.angularRadiusRadians / 2) ** 2;
        const radialWidth = (1 - muMinimum) / this.radialCount;
        const azimuthWidth = 2 * Math.PI / this.azimuthCount;
        const samples = [];
        for (let radialIndex = 0; radialIndex < this.radialCount; radialIndex += 1) {
            const mu = muMinimum + (radialIndex + 0.5) * radialWidth;
            const sinTheta = Math.sqrt(Math.max(0, 1 - mu * mu));
            for (let azimuthIndex = 0; azimuthIndex < this.azimuthCount; azimuthIndex += 1) {
                const phi = (azimuthIndex + 0.5) * azimuthWidth;
                const direction = normalize([
                    centerDirectionCamera[0] * mu
                        + tangent[0] * sinTheta * Math.cos(phi)
                        + bitangent[0] * sinTheta * Math.sin(phi),
                    centerDirectionCamera[1] * mu
                        + tangent[1] * sinTheta * Math.cos(phi)
                        + bitangent[1] * sinTheta * Math.sin(phi),
                    centerDirectionCamera[2] * mu
                        + tangent[2] * sinTheta * Math.cos(phi)
                        + bitangent[2] * sinTheta * Math.sin(phi),
                ]);
                samples.push(Object.freeze({
                    directionCamera: direction,
                    cosTheta: mu,
                    rhoSquared: (1 - mu * mu) / Math.max(Number.EPSILON, 1 - muMinimum * muMinimum),
                    solidAngleWeightSteradians: radialWidth * azimuthWidth,
                    radialIndex,
                    azimuthIndex,
                }));
            }
        }
        return Object.freeze(samples);
    }

    expectedSolidAngleSteradians() {
        return 4 * Math.PI * Math.sin(this.angularRadiusRadians / 2) ** 2;
    }
}

function validateUnit(direction) {
    if (!Array.isArray(direction) || direction.length !== 3 || !direction.every(Number.isFinite)) {
        throw error('ER3_QUADRATURE_CENTER_DIRECTION_INVALID', 'Cap center direction must be a finite 3-tuple.');
    }
    if (Math.abs(Math.hypot(...direction) - 1) > 1e-12) {
        throw error('ER3_QUADRATURE_CENTER_DIRECTION_NOT_UNIT', 'Cap center direction must be unit length.');
    }
}

function orthogonal(vector) {
    const reference = Math.abs(vector[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
    return normalize(cross(reference, vector));
}

function normalize(vector) {
    const length = Math.hypot(...vector);
    if (!Number.isFinite(length) || length <= 0) {
        throw error('ER3_QUADRATURE_BASIS_INVALID', 'Cap basis vector must be finite and nonzero.');
    }
    return Object.freeze(vector.map((value) => value / length));
}

function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function error(code, message) {
    return new ReconciliationConfigurationError(message, { code });
}
