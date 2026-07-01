const DEGREES_TO_RADIANS = Math.PI / 180;
const RADIANS_TO_DEGREES = 180 / Math.PI;

/**
 * Create an angle packet in degrees.
 *
 * @param {number} value - Supplies the angle value.
 * @returns {Angle} The angle packet.
 */
function inDegrees(value) {
	return {
		value,
		units: 'degree',
	};
}

/**
 * Create an angle packet in radians.
 *
 * @param {number} value - Supplies the angle value.
 * @returns {Angle} The angle packet.
 */
function inRadians(value) {
	return {
		value,
		units: 'radian',
	};
}

/**
 * Return an angle packet value in radians.
 *
 * @param {Angle} angle - Supplies the angle packet.
 * @returns {number} The angle in radians.
 */
function toRadians(angle) {
	if (angle.units === 'degree') {
		return angle.value * DEGREES_TO_RADIANS;
	}

	return angle.value;
}

/**
 * Return an angle packet value in degrees.
 *
 * @param {Angle} angle - Supplies the angle packet.
 * @returns {number} The angle in degrees.
 */
function toDegrees(angle) {
	if (angle.units === 'radian') {
		return angle.value * RADIANS_TO_DEGREES;
	}

	return angle.value;
}

/**
 * Add two angle packets and return the result in the left packet's units.
 *
 * @param {Angle} left - Supplies the left angle packet.
 * @param {Angle} right - Supplies the right angle packet.
 * @returns {Angle} The summed angle packet.
 */
function add(left, right) {
	return {
		value: left.units === 'radian' ? left.value + toRadians(right) : left.value + toDegrees(right),
		units: left.units,
	};
}

/**
 * Subtract one angle packet from another and return the result in the left packet's units.
 *
 * @param {Angle} left - Supplies the left angle packet.
 * @param {Angle} right - Supplies the right angle packet.
 * @returns {Angle} The difference angle packet.
 */
function subtract(left, right) {
	return {
		value: left.units === 'radian' ? left.value - toRadians(right) : left.value - toDegrees(right),
		units: left.units,
	};
}

/**
 * Scale an angle packet by a scalar factor.
 *
 * @param {Angle} angle - Supplies the angle packet.
 * @param {number} factor - Supplies the scalar factor.
 * @returns {Angle} The scaled angle packet.
 */
function scale(angle, factor) {
	return {
		value: angle.value * factor,
		units: angle.units,
	};
}

/**
 * Wrap a value into the half-open range [min, max).
 *
 * @param {number} value - Supplies the value to wrap.
 * @param {number} min - Supplies the inclusive lower bound.
 * @param {number} max - Supplies the exclusive upper bound.
 * @returns {number} The wrapped value.
 */
function wrap(value, min, max) {
	const size = max - min;

	return ((value - min) % size + size) % size + min;
}

/**
 * Wrap an angle in radians.
 *
 * @param {number} radians - Supplies the angle in radians.
 * @param {AngleWrapOptions} [options] - Supplies call-local wrap bounds.
 * @returns {number} The wrapped angle in radians.
 */
function wrapRadians(radians, options = {}) {
	return wrap(radians, options.min ?? 0, options.max ?? Math.PI * 2);
}

/**
 * Wrap an angle in degrees.
 *
 * @param {number} degrees - Supplies the angle in degrees.
 * @param {AngleWrapOptions} [options] - Supplies call-local wrap bounds.
 * @returns {number} The wrapped angle in degrees.
 */
function wrapDegrees(degrees, options = {}) {
	return wrap(degrees, options.min ?? 0, options.max ?? 360);
}

export default Object.freeze({
	add,
	inDegrees,
	inRadians,
	scale,
	subtract,
	toDegrees,
	toRadians,
	wrapDegrees,
	wrapRadians,
});
