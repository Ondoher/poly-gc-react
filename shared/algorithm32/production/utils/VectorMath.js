/**
 * Create a numeric vector filled with zeroes.
 *
 * @param {number} length - Supplies the vector length.
 * @returns {number[]} The initialized numeric vector.
 */
function zero(length) {
	return Array.from({ length }, () => 0);
}

/**
 * Create a numeric vector filled with ones.
 *
 * @param {number} length - Supplies the vector length.
 * @returns {number[]} The initialized numeric vector.
 */
function ones(length) {
	return filled(length, 1);
}

/**
 * Create a numeric vector filled with one value.
 *
 * @param {number} length - Supplies the vector length.
 * @param {number} value - Supplies the fill value.
 * @returns {number[]} The initialized numeric vector.
 */
function filled(length, value) {
	return Array.from({ length }, () => value);
}

/**
 * Add two numeric vectors.
 *
 * @template {readonly number[]} LeftVector
 * @template {readonly number[]} RightVector
 * @param {LeftVector} left - Supplies the first vector.
 * @param {RightVector} right - Supplies the second vector.
 * @returns {number[]} The summed vector.
 */
function add(left, right) {
	return left.map((value, index) => value + right[index]);
}

/**
 * Subtract one numeric vector from another.
 *
 * @template {readonly number[]} LeftVector
 * @template {readonly number[]} RightVector
 * @param {LeftVector} left - Supplies the vector to subtract from.
 * @param {RightVector} right - Supplies the vector to subtract.
 * @returns {number[]} The difference vector.
 */
function subtract(left, right) {
	return left.map((value, index) => value - right[index]);
}

/**
 * Scale a numeric vector.
 *
 * @template {readonly number[]} Vector
 * @param {Vector} vector - Supplies the vector to scale.
 * @param {number} scalar - Supplies the scale factor.
 * @returns {number[]} The scaled vector.
 */
function scale(vector, scalar) {
	return vector.map((value) => value * scalar);
}

/**
 * Add a scaled vector to another vector.
 *
 * @template {readonly number[]} BaseVector
 * @template {readonly number[]} DirectionVector
 * @param {BaseVector} base - Supplies the base vector.
 * @param {DirectionVector} direction - Supplies the vector to scale and add.
 * @param {number} scalar - Supplies the scale factor for the direction vector.
 * @returns {number[]} The combined vector.
 */
function addScaled(base, direction, scalar) {
	return base.map((value, index) => value + direction[index] * scalar);
}

/**
 * Compute the dot product of two numeric vectors.
 *
 * @template {readonly number[]} LeftVector
 * @template {readonly number[]} RightVector
 * @param {LeftVector} left - Supplies the first vector.
 * @param {RightVector} right - Supplies the second vector.
 * @returns {number} The dot product.
 */
function dot(left, right) {
	return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

/**
 * Compute the cross product of two 3D tuples.
 *
 * @param {readonly [number, number, number]} left - Supplies the first 3D
 * tuple.
 * @param {readonly [number, number, number]} right - Supplies the second 3D
 * tuple.
 * @returns {[number, number, number]} The cross product.
 */
function cross(left, right) {
	return [
		left[1] * right[2] - left[2] * right[1],
		left[2] * right[0] - left[0] * right[2],
		left[0] * right[1] - left[1] * right[0],
	];
}

/**
 * Compute the Euclidean norm of a numeric vector.
 *
 * @template {readonly number[]} Vector
 * @param {Vector} vector - Supplies the vector to measure.
 * @returns {number} The Euclidean norm.
 */
function length(vector) {
	return Math.sqrt(dot(vector, vector));
}

/**
 * Compute the Euclidean distance between two numeric vectors.
 *
 * @template {readonly number[]} LeftVector
 * @template {readonly number[]} RightVector
 * @param {LeftVector} left - Supplies the first vector.
 * @param {RightVector} right - Supplies the second vector.
 * @returns {number} The Euclidean distance between vectors.
 */
function distance(left, right) {
	return length(subtract(left, right));
}

/**
 * Normalize a numeric vector.
 *
 * @template {readonly number[]} Vector
 * @param {Vector} vector - Supplies the vector to normalize.
 * @param {ToleranceOptions} [options] - Supplies call-local zero-length
 * tolerance behavior.
 * @returns {number[]} The normalized vector, or a zero vector when length is at
 * or below epsilon.
 */
function normalize(vector, options = {}) {
	const epsilon = options.epsilon ?? 0;
	const vectorLength = length(vector);

	if (vectorLength <= epsilon) {
		return vector.map(() => 0);
	}

	return scale(vector, 1 / vectorLength);
}

/**
 * Check whether every vector value is finite.
 *
 * @template {readonly number[]} Vector
 * @param {Vector} vector - Supplies the vector to inspect.
 * @returns {boolean} True when every vector value is finite.
 */
function isFiniteVector(vector) {
	return vector.every(Number.isFinite);
}

/**
 * Check whether a vector has unit length within tolerance.
 *
 * @template {readonly number[]} Vector
 * @param {Vector} vector - Supplies the vector to inspect.
 * @param {ToleranceOptions} [options] - Supplies call-local tolerance behavior.
 * @returns {boolean} True when the vector length is within epsilon of one.
 */
function isNormalized(vector, options = {}) {
	const epsilon = options.epsilon ?? Number.EPSILON;

	return Math.abs(length(vector) - 1) <= epsilon;
}

export default Object.freeze({
	add,
	addScaled,
	cross,
	distance,
	dot,
	filled,
	isFiniteVector,
	isNormalized,
	length,
	normalize,
	ones,
	scale,
	subtract,
	zero,
});
