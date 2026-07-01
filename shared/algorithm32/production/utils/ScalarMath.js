/**
 * Check whether a value is a finite number.
 *
 * @param {unknown} value - Supplies the value to inspect.
 * @returns {boolean} True when the value is a finite number.
 */
function isFiniteNumber(value) {
	return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Clamp a number to an inclusive range.
 *
 * @param {number} value - Supplies the value to clamp.
 * @param {number} min - Supplies the inclusive lower bound.
 * @param {number} max - Supplies the inclusive upper bound.
 * @returns {number} The clamped value.
 */
function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

/**
 * Check whether a number is inside a range.
 *
 * @param {number} value - Supplies the value to inspect.
 * @param {number} min - Supplies the lower bound.
 * @param {number} max - Supplies the upper bound.
 * @param {RangeOptions} [options] - Supplies call-local range behavior.
 * @returns {boolean} True when the value is inside the requested range.
 */
function inRange(value, min, max, options = {}) {
	const inclusive = options.inclusive !== false;

	if (inclusive) {
		return value >= min && value <= max;
	}

	return value > min && value < max;
}

/**
 * Check whether two numbers are equal within a tolerance.
 *
 * @param {number} left - Supplies the first value.
 * @param {number} right - Supplies the second value.
 * @param {ToleranceOptions} [options] - Supplies call-local tolerance behavior.
 * @returns {boolean} True when the values differ by no more than epsilon.
 */
function nearlyEqual(left, right, options = {}) {
	const epsilon = options.epsilon ?? Number.EPSILON;

	return Math.abs(left - right) <= epsilon;
}

/**
 * Linearly interpolate between two values.
 *
 * @param {number} start - Supplies the value returned when amount is zero.
 * @param {number} end - Supplies the value returned when amount is one.
 * @param {number} amount - Supplies the interpolation amount.
 * @returns {number} The interpolated value.
 */
function lerp(start, end, amount) {
	return start + (end - start) * amount;
}

/**
 * Format a number using deterministic precision and trimming options.
 *
 * @param {number} value - Supplies the value to format.
 * @param {NumberFormatOptions} [options] - Supplies call-local formatting
 * behavior.
 * @returns {string} The formatted number.
 */
function formatNumber(value, options = {}) {
	const precision = options.precision ?? 6;
	const formatted = value.toFixed(precision);

	if (options.trim === false) {
		return formatted;
	}

	return formatted.includes('.')
		? formatted.replace(/\.?0+$/, '')
		: formatted;
}

export default Object.freeze({
	clamp,
	formatNumber,
	inRange,
	isFiniteNumber,
	lerp,
	nearlyEqual,
});
