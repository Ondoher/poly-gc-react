const METERS_PER_KILOMETER = 1000;
const METERS = 'meters';
const KILOMETERS = 'kilometers';

/**
 * Create a distance packet in kilometers.
 *
 * @param {number} value - Supplies the distance value.
 * @returns {Distance} The distance packet.
 */
function inKilometers(value) {
	return {
		value,
		units: KILOMETERS,
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
		units: METERS,
	};
}

/**
 * Return a distance packet value in meters.
 *
 * @param {Distance} distance - Supplies the distance packet.
 * @returns {number} The distance in meters.
 */
function toMeters(distance) {
	assertDistance(distance);

	if (distance.units === KILOMETERS) {
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
	assertDistance(distance);

	if (distance.units === METERS) {
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
	assertDistance(left, 'left distance');
	assertDistance(right, 'right distance');

	return {
		value: left.units === KILOMETERS ? left.value + toKilometers(right) : left.value + toMeters(right),
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
	assertDistance(left, 'left distance');
	assertDistance(right, 'right distance');

	return {
		value: left.units === KILOMETERS ? left.value - toKilometers(right) : left.value - toMeters(right),
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
	assertDistance(distance);

	return {
		value: distance.value * factor,
		units: distance.units,
	};
}

/**
 * Assert that a distance packet uses the production distance unit contract.
 *
 * @param {unknown} distance - Supplies the candidate distance packet.
 * @param {string} [label] - Supplies the error label.
 * @returns {void}
 */
function assertDistance(distance, label = 'distance') {
	if (!distance || typeof distance !== 'object') {
		throw new TypeError(`${label} must be a unit-bearing distance packet.`);
	}

	if (!Number.isFinite(distance.value)) {
		throw new TypeError(`${label}.value must be finite.`);
	}

	if (distance.units !== METERS && distance.units !== KILOMETERS) {
		throw new TypeError(`${label}.units must be "meters" or "kilometers".`);
	}
}

export default Object.freeze({
	add,
	assertDistance,
	inKilometers,
	inMeters,
	scale,
	subtract,
	toKilometers,
	toMeters,
});
