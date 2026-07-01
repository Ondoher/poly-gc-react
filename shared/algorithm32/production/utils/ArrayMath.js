/**
 * Create a fixed-length numeric array filled with zero.
 *
 * @param {number} length - Supplies the array length.
 * @returns {number[]} The initialized numeric array.
 */
function zeros(length) {
	return Array.from({ length }, () => 0);
}

/**
 * Create a fixed-length numeric array filled with one value.
 *
 * @param {number} length - Supplies the array length.
 * @param {number} value - Supplies the fill value.
 * @returns {number[]} The initialized numeric array.
 */
function fill(length, value) {
	return Array.from({ length }, () => value);
}

/**
 * Add two numeric arrays element by element.
 *
 * @param {readonly number[]} left - Supplies the first numeric array.
 * @param {readonly number[]} right - Supplies the second numeric array.
 * @returns {number[]} The element-wise sum.
 */
function add(left, right) {
	return left.map((value, index) => value + right[index]);
}

/**
 * Multiply two numeric arrays element by element.
 *
 * @param {readonly number[]} left - Supplies the first numeric array.
 * @param {readonly number[]} right - Supplies the second numeric array.
 * @returns {number[]} The element-wise product.
 */
function multiply(left, right) {
	return left.map((value, index) => value * right[index]);
}

/**
 * Compute the arithmetic mean of numeric array values.
 *
 * @param {readonly number[]} values - Supplies the numeric values.
 * @returns {number} The arithmetic mean, or zero for an empty array.
 */
function mean(values) {
	if (values.length === 0) {
		return 0;
	}

	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Compute the weighted sum of numeric array values.
 *
 * @param {readonly number[]} values - Supplies the numeric values.
 * @param {readonly number[]} weights - Supplies the per-value weights.
 * @returns {number} The weighted sum.
 */
function weightedSum(values, weights) {
	return values.reduce((sum, value, index) => sum + value * weights[index], 0);
}

/**
 * Map numeric array values into a new array.
 *
 * @param {readonly number[]} values - Supplies the numeric values.
 * @param {NumericArrayMapper} mapper - Supplies the mapping function.
 * @returns {number[]} The mapped numeric array.
 */
function map(values, mapper) {
	return values.map(mapper);
}

export default Object.freeze({
	add,
	fill,
	map,
	mean,
	multiply,
	weightedSum,
	zeros,
});
