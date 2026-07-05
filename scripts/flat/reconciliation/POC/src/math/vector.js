// References:
// - agents/topics/apps/flat/reconciliation/algorithm32-abstraction-design.md, geometry-owned vector/ray handoffs.
// - agents/topics/apps/flat/algorithm32/conclusions.md, accepted spherical geometry equations.

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function dot(a, b) {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a, b) {
    return Object.freeze([
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]);
}

export function magnitude(vector) {
    return Math.sqrt(dot(vector, vector));
}

export function normalize(vector) {
    const length = magnitude(vector);

    if (!Number.isFinite(length) || length <= 0) {
        throw new RangeError('Cannot normalize a zero-length or non-finite vector.');
    }

    return Object.freeze([
        vector[0] / length,
        vector[1] / length,
        vector[2] / length,
    ]);
}

export function add(a, b) {
    return Object.freeze([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
}

export function scale(vector, scalar) {
    return Object.freeze([vector[0] * scalar, vector[1] * scalar, vector[2] * scalar]);
}

export function addScaled(origin, direction, distance) {
    return Object.freeze([
        origin[0] + direction[0] * distance,
        origin[1] + direction[1] * distance,
        origin[2] + direction[2] * distance,
    ]);
}

export function degreesToRadians(degrees) {
    return (degrees * Math.PI) / 180;
}

export function isFiniteVector3(vector) {
    return Array.isArray(vector) && vector.length === 3 && vector.every(Number.isFinite);
}

export function sphericalDirectionFromAltitudeAzimuth(altitudeDegrees, azimuthDegrees) {
    const altitude = degreesToRadians(altitudeDegrees);
    const azimuth = degreesToRadians(azimuthDegrees);
    const horizontalLength = Math.cos(altitude);

    return normalize([
        horizontalLength * Math.cos(azimuth),
        horizontalLength * Math.sin(azimuth),
        Math.sin(altitude),
    ]);
}

export function fibonacciSphereDirection(index, count) {
    if (!Number.isInteger(index) || index < 0 || !Number.isInteger(count) || count < 1 || index >= count) {
        throw new RangeError('Fibonacci direction index/count are out of range.');
    }

    const z = 1 - (2 * (index + 0.5)) / count;
    const radius = Math.sqrt(Math.max(0, 1 - z * z));
    const angle = index * Math.PI * (3 - Math.sqrt(5));

    return normalize([
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        z,
    ]);
}

export function sunOrientedFibonacciSphereDirection(index, count, sunDirection) {
    if (!Number.isInteger(index) || index < 0 || !Number.isInteger(count) || count < 1 || index >= count) {
        throw new RangeError('Fibonacci direction index/count are out of range.');
    }

    const halfCount = Math.floor(count / 2);
    const centeredIndex = index - halfCount;
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const sunAxis = normalize(sunDirection);
    const reference = Math.abs(dot(sunAxis, [0, 0, 1])) < 0.95 ? [0, 0, 1] : [0, 1, 0];
    const zAxis = normalize(add(reference, scale(sunAxis, -dot(reference, sunAxis))));
    const yAxis = normalize(cross(zAxis, sunAxis));
    const z = (2 * centeredIndex) / count;
    const latitude = Math.asin(z);
    const longitude = (2 * Math.PI * centeredIndex) / goldenRatio;
    const horizontalScale = Math.cos(latitude);
    const localX = horizontalScale * Math.cos(longitude);
    const localY = horizontalScale * Math.sin(longitude);
    const localZ = z;

    return normalize(add(
        add(scale(sunAxis, localX), scale(yAxis, localY)),
        scale(zAxis, localZ),
    ));
}
