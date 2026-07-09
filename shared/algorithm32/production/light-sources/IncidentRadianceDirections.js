import VectorMath from '../utils/VectorMath.js';

/**
 * Return one direction from a deterministic Fibonacci sphere sequence.
 *
 * @param {number} directionIndex - Supplies the direction index.
 * @param {number} directionCount - Supplies the total direction count.
 * @returns {UnitVector3} The generated unit direction.
 */
export function fibonacciSphereDirection(directionIndex, directionCount) {
	assertDirectionIndex(directionIndex, directionCount);

	const centeredIndex = directionIndex + 0.5;
	const z = 1 - (2 * centeredIndex) / directionCount;
	const radius = Math.sqrt(Math.max(0, 1 - z * z));
	const longitude = Math.PI * (3 - Math.sqrt(5)) * centeredIndex;

	return Object.freeze([
		Math.cos(longitude) * radius,
		Math.sin(longitude) * radius,
		z,
	]);
}

/**
 * Return a deterministic Fibonacci sphere direction oriented around a source
 * axis.
 *
 * @param {number} directionIndex - Supplies the direction index.
 * @param {number} directionCount - Supplies the total direction count.
 * @param {UnitVector3} sourceAxis - Supplies the source-aligned x axis.
 * @returns {UnitVector3} The generated unit direction.
 */
export function sourceOrientedFibonacciSphereDirection(directionIndex, directionCount, sourceAxis) {
	assertDirectionIndex(directionIndex, directionCount);
	assertUnitVector(sourceAxis, 'sourceAxis');

	const centeredIndex = directionIndex - directionCount / 2;
	const xAxis = VectorMath.normalize(sourceAxis);
	const reference = Math.abs(VectorMath.dot(xAxis, [0, 0, 1])) < 0.95 ? [0, 0, 1] : [0, 1, 0];
	const zAxis = VectorMath.normalize(VectorMath.subtract(reference, VectorMath.scale(xAxis, VectorMath.dot(reference, xAxis))));
	const yAxis = VectorMath.normalize(VectorMath.cross(zAxis, xAxis));
	const z = (2 * centeredIndex) / directionCount;
	const latitude = Math.asin(z);
	const longitude = (2 * Math.PI * centeredIndex) / ((1 + Math.sqrt(5)) / 2);
	const horizontalScale = Math.cos(latitude);
	const localX = horizontalScale * Math.cos(longitude);
	const localY = horizontalScale * Math.sin(longitude);
	const localZ = z;

	return Object.freeze(VectorMath.normalize([
		xAxis[0] * localX + yAxis[0] * localY + zAxis[0] * localZ,
		xAxis[1] * localX + yAxis[1] * localY + zAxis[1] * localZ,
		xAxis[2] * localX + yAxis[2] * localY + zAxis[2] * localZ,
	]));
}

/**
 * Assert direction index inputs.
 *
 * @param {number} directionIndex - Supplies the direction index.
 * @param {number} directionCount - Supplies the total direction count.
 * @returns {void}
 */
function assertDirectionIndex(directionIndex, directionCount) {
	if (!Number.isInteger(directionCount) || directionCount < 1) {
		throw new RangeError('directionCount must be a positive integer.');
	}

	if (!Number.isInteger(directionIndex) || directionIndex < 0 || directionIndex >= directionCount) {
		throw new RangeError('directionIndex must be inside the direction count.');
	}
}

/**
 * Assert a finite three-component direction tuple.
 *
 * @param {unknown} vector - Supplies the candidate vector.
 * @param {string} label - Supplies the error label.
 * @returns {void}
 */
function assertUnitVector(vector, label) {
	if (!Array.isArray(vector) || vector.length !== 3 || !vector.every(Number.isFinite)) {
		throw new TypeError(`${label} must be a finite three-component vector.`);
	}
}
