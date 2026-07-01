const METERS_PER_KILOMETER = 1000;

/**
 * Create a distance packet in kilometers.
 *
 * @param {number} value - Supplies the distance value.
 * @returns {Distance} The distance packet.
 */
function inKilometers(value) {
	return {
		value,
		units: 'kilometer',
	};
}

/**
 * Create a distance packet in meters.
 *
 * @param {number} value - Supplies the distance value.
 * @returns {Distance} The distance packet.
 */
function inMeters(value) {
	return {
		value,
		units: 'meter',
	};
}

/**
 * Return a distance packet value in meters.
 *
 * @param {Distance} distance - Supplies the distance packet.
 * @returns {number} The distance in meters.
 */
function toMeters(distance) {
	if (distance.units === 'kilometer') {
		return distance.value * METERS_PER_KILOMETER;
	}

	return distance.value;
}

/**
 * Return a distance packet value in kilometers.
 *
 * @param {Distance} distance - Supplies the distance packet.
 * @returns {number} The distance in kilometers.
 */
function toKilometers(distance) {
	if (distance.units === 'meter') {
		return distance.value / METERS_PER_KILOMETER;
	}

	return distance.value;
}

/**
 * Add two distance packets and return the result in the left packet's units.
 *
 * @param {Distance} left - Supplies the left distance packet.
 * @param {Distance} right - Supplies the right distance packet.
 * @returns {Distance} The summed distance packet.
 */
function add(left, right) {
	return {
		value: left.units === 'kilometer' ? left.value + toKilometers(right) : left.value + toMeters(right),
		units: left.units,
	};
}

/**
 * Subtract one distance packet from another and return the result in the left packet's units.
 *
 * @param {Distance} left - Supplies the left distance packet.
 * @param {Distance} right - Supplies the right distance packet.
 * @returns {Distance} The difference distance packet.
 */
function subtract(left, right) {
	return {
		value: left.units === 'kilometer' ? left.value - toKilometers(right) : left.value - toMeters(right),
		units: left.units,
	};
}

/**
 * Scale a distance packet by a scalar factor.
 *
 * @param {Distance} distance - Supplies the distance packet.
 * @param {number} factor - Supplies the scalar factor.
 * @returns {Distance} The scaled distance packet.
 */
function scale(distance, factor) {
	return {
		value: distance.value * factor,
		units: distance.units,
	};
}

export default Object.freeze({
	add,
	inKilometers,
	inMeters,
	scale,
	subtract,
	toKilometers,
	toMeters,
});
