const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const MINUTES_PER_DAY = 24 * 60;
const DEGREES_PER_ORBIT = 360;
const RADIANS_PER_DEGREE = Math.PI / 180;
const DEFAULT_WORLD_SURFACE_SOLAR_NOON_BRIGHTNESS = 1000;

/**
 * Resolve flat-world Sun synchronization facts for app-owned local Sun setup.
 */
export class FlatSynchronizer {
	/**
	 * Store the selected calibration mode.
	 *
	 * @type {string | null}
	 */
	_calibrationMode = null;

	/**
	 * Store the calibrated surface brightness value.
	 *
	 * @type {number}
	 */
	_worldSurfaceSolarNoonBrightness;

	/**
	 * Create a flat-world synchronization helper.
	 *
	 * @param {{ worldSurfaceSolarNoonBrightness?: number }} [configuration] -
	 * Supplies optional calibrated brightness overrides.
	 */
	constructor(configuration = {}) {
		this._worldSurfaceSolarNoonBrightness = finiteNumberOrDefault(
			configuration.worldSurfaceSolarNoonBrightness,
			DEFAULT_WORLD_SURFACE_SOLAR_NOON_BRIGHTNESS,
		);
	}

	/**
	 * Select world-synchronized calibration.
	 *
	 * @returns {FlatSynchronizer} This synchronizer for chaining.
	 */
	calibrateToWorld() {
		this._calibrationMode = 'world';

		return this;
	}

	/**
	 * Resolve the synchronized flat Sun latitude/longitude for an instant.
	 *
	 * World mode anchors the daily orbit at the latitude where the standard Sun
	 * is overhead for the UTC date and longitude `0`. The anchor time is
	 * Greenwich apparent solar noon, estimated with the equation of time. The
	 * returned longitude then follows one clockwise 24-hour orbit from that
	 * anchor.
	 *
	 * @param {Date | string | number} time - Supplies the target instant.
	 * @returns {FlatSynchronizedPosition} The synchronized position packet.
	 */
	getPosition(time) {
		this._assertWorldMode();
		const targetTime = dateFrom(time, 'FlatSynchronizer.getPosition requires a valid time.');
		const anchor = createWorldAnchor(targetTime);
		const elapsedMilliseconds = targetTime.getTime() - anchor.startTime.getTime();
		const orbitAngleDegrees = positiveModulo(
			elapsedMilliseconds / MILLISECONDS_PER_DAY * DEGREES_PER_ORBIT,
			DEGREES_PER_ORBIT,
		);

		return createPositionPacket({
			mode: 'world',
			startLatitude: anchor.startLatitude,
			startLongitude: anchor.startLongitude,
			startTime: anchor.startTime.toISOString(),
			orbitAngleDegrees,
			elapsedMilliseconds,
		});
	}

	/**
	 * Resolve a position from a supplied closest-approach point and orbit angle.
	 *
	 * The supplied latitude/longitude identifies the closest-approach point.
	 * The returned longitude applies the same clockwise orbit convention as
	 * world mode, so positive angles move west from the closest longitude.
	 *
	 * @param {Date | string | number} time - Supplies the target instant.
	 * @param {{ latitude?: number, longitude?: number, lat?: number, lon?: number } | readonly [number, number]} latLon -
	 * Supplies the closest-approach latitude/longitude.
	 * @param {number} angle - Supplies the clockwise orbit angle in degrees.
	 * @returns {FlatSynchronizedPosition} The synchronized position packet.
	 */
	getPositionFromClosest(time, latLon, angle) {
		const targetTime = dateFrom(time, 'FlatSynchronizer.getPositionFromClosest requires a valid time.');
		const closestPoint = closestPointFrom(latLon);
		const orbitAngleDegrees = positiveModulo(finiteNumberOrThrow(
			angle,
			'FlatSynchronizer.getPositionFromClosest requires a finite angle.',
		), DEGREES_PER_ORBIT);
		const elapsedMilliseconds = orbitAngleDegrees / DEGREES_PER_ORBIT * MILLISECONDS_PER_DAY;

		return createPositionPacket({
			mode: 'closest',
			startLatitude: closestPoint.latitude,
			startLongitude: closestPoint.longitude,
			startTime: targetTime.toISOString(),
			orbitAngleDegrees,
			elapsedMilliseconds,
		});
	}

	/**
	 * Resolve the orbit time from a date, closest-approach point, and angle.
	 *
	 * The supplied time provides the date used for the world seasonal latitude
	 * and Greenwich solar-noon anchor. The supplied longitude identifies when
	 * the flat Sun is closest to that location. The angle then offsets from that
	 * closest approach on the same clockwise 24-hour orbit.
	 *
	 * @param {Date | string | number} time - Supplies the date basis.
	 * @param {{ latitude?: number, longitude?: number, lat?: number, lon?: number } | readonly [number, number]} latLon -
	 * Supplies the closest-approach latitude/longitude.
	 * @param {number} angle - Supplies the clockwise orbit angle in degrees.
	 * @returns {string} The resolved orbit time as an ISO timestamp.
	 */
	getTimeFromClosest(time, latLon, angle) {
		const closestTime = dateFrom(time, 'FlatSynchronizer.getTimeFromClosest requires a valid time.');
		const closestPoint = closestPointFrom(latLon);
		const anchor = createWorldAnchor(closestTime);
		const orbitAngleDegrees = positiveModulo(finiteNumberOrThrow(
			angle,
			'FlatSynchronizer.getTimeFromClosest requires a finite angle.',
		) - closestPoint.longitude, DEGREES_PER_ORBIT);
		const elapsedMilliseconds = orbitAngleDegrees / DEGREES_PER_ORBIT * MILLISECONDS_PER_DAY;

		return new Date(anchor.startTime.getTime() + elapsedMilliseconds).toISOString();
	}

	/**
	 * Return the calibrated local Sun brightness for surface solar noon.
	 *
	 * @returns {number} The surface solar-noon brightness value.
	 */
	getBrightness() {
		return this._worldSurfaceSolarNoonBrightness;
	}

	/**
	 * Fail loudly when position resolution is requested before calibration.
	 *
	 * @returns {void}
	 */
	_assertWorldMode() {
		if (this._calibrationMode !== 'world') {
			throw new Error('FlatSynchronizer.getPosition requires calibrateToWorld() first.');
		}
	}
}

/**
 * Create a synchronized position packet.
 *
 * @param {{ mode: string, startLatitude: number, startLongitude: number, startTime: string, orbitAngleDegrees: number, elapsedMilliseconds: number }} request -
 * Supplies the position facts.
 * @returns {FlatSynchronizedPosition} The synchronized position packet.
 */
function createPositionPacket(request) {
	const longitude = normalizeLongitude(request.startLongitude - request.orbitAngleDegrees);

	return Object.freeze({
		mode: request.mode,
		latitude: request.startLatitude,
		longitude,
		startLatitude: request.startLatitude,
		startLongitude: request.startLongitude,
		startTime: request.startTime,
		orbitAngleDegrees: request.orbitAngleDegrees,
		elapsedMilliseconds: request.elapsedMilliseconds,
		orbitPeriodMilliseconds: MILLISECONDS_PER_DAY,
	});
}

/**
 * Create the UTC world anchor for the target date.
 *
 * @param {Date} targetTime - Supplies the target instant.
 * @returns {{ startLatitude: number, startLongitude: number, startTime: Date }}
 * The world anchor packet.
 */
function createWorldAnchor(targetTime) {
	const dateNoonUtc = new Date(Date.UTC(
		targetTime.getUTCFullYear(),
		targetTime.getUTCMonth(),
		targetTime.getUTCDate(),
		12,
		0,
		0,
		0,
	));
	const gamma = fractionalYearRadians(dateNoonUtc);
	const startLatitude = solarDeclinationDegrees(gamma);
	const equationOfTimeMinutes = equationOfTime(gamma);
	const solarNoonUtcMinutes = MINUTES_PER_DAY / 2 - equationOfTimeMinutes;
	const startTime = new Date(Date.UTC(
		targetTime.getUTCFullYear(),
		targetTime.getUTCMonth(),
		targetTime.getUTCDate(),
		0,
		0,
		0,
		0,
	) + solarNoonUtcMinutes * 60 * 1000);

	return Object.freeze({
		startLatitude,
		startLongitude: 0,
		startTime,
	});
}

/**
 * Resolve the NOAA-style fractional year angle for the UTC instant.
 *
 * @param {Date} time - Supplies a UTC instant.
 * @returns {number} The fractional year angle in radians.
 */
function fractionalYearRadians(time) {
	const dayOfYear = utcDayOfYear(time);
	const hour = time.getUTCHours()
		+ time.getUTCMinutes() / 60
		+ time.getUTCSeconds() / 3600
		+ time.getUTCMilliseconds() / 3600000;
	const yearDays = isLeapYear(time.getUTCFullYear()) ? 366 : 365;

	return 2 * Math.PI / yearDays * (dayOfYear - 1 + (hour - 12) / 24);
}

/**
 * Approximate solar declination for a fractional-year angle.
 *
 * @param {number} gamma - Supplies the fractional year angle in radians.
 * @returns {number} The solar declination in degrees.
 */
function solarDeclinationDegrees(gamma) {
	return (
		0.006918
		- 0.399912 * Math.cos(gamma)
		+ 0.070257 * Math.sin(gamma)
		- 0.006758 * Math.cos(2 * gamma)
		+ 0.000907 * Math.sin(2 * gamma)
		- 0.002697 * Math.cos(3 * gamma)
		+ 0.00148 * Math.sin(3 * gamma)
	) / RADIANS_PER_DEGREE;
}

/**
 * Approximate the equation of time.
 *
 * @param {number} gamma - Supplies the fractional year angle in radians.
 * @returns {number} The equation of time in minutes.
 */
function equationOfTime(gamma) {
	return 229.18 * (
		0.000075
		+ 0.001868 * Math.cos(gamma)
		- 0.032077 * Math.sin(gamma)
		- 0.014615 * Math.cos(2 * gamma)
		- 0.040849 * Math.sin(2 * gamma)
	);
}

/**
 * Resolve a UTC day-of-year number.
 *
 * @param {Date} time - Supplies a UTC instant.
 * @returns {number} The one-based UTC day of year.
 */
function utcDayOfYear(time) {
	const start = Date.UTC(time.getUTCFullYear(), 0, 1);
	const current = Date.UTC(time.getUTCFullYear(), time.getUTCMonth(), time.getUTCDate());

	return Math.floor((current - start) / MILLISECONDS_PER_DAY) + 1;
}

/**
 * Check whether a year is a leap year.
 *
 * @param {number} year - Supplies the year.
 * @returns {boolean} True when the year has 366 days.
 */
function isLeapYear(year) {
	return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/**
 * Convert supported date input into a Date.
 *
 * @param {Date | string | number} value - Supplies the date input.
 * @param {string} errorMessage - Supplies the failure message.
 * @returns {Date} The resolved Date.
 */
function dateFrom(value, errorMessage) {
	const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

	if (Number.isNaN(date.getTime())) {
		throw new TypeError(errorMessage);
	}

	return date;
}

/**
 * Resolve a closest-approach latitude/longitude packet.
 *
 * @param {{ latitude?: number, longitude?: number, lat?: number, lon?: number } | readonly [number, number]} value -
 * Supplies the closest-approach point.
 * @returns {{ latitude: number, longitude: number }} The resolved point.
 */
function closestPointFrom(value) {
	const latitude = Array.isArray(value) ? value[0] : value?.latitude ?? value?.lat;
	const longitude = Array.isArray(value) ? value[1] : value?.longitude ?? value?.lon;

	return {
		latitude: finiteNumberOrThrow(
			latitude,
			'FlatSynchronizer.getPositionFromClosest requires a finite latitude.',
		),
		longitude: normalizeLongitude(finiteNumberOrThrow(
			longitude,
			'FlatSynchronizer.getPositionFromClosest requires a finite longitude.',
		)),
	};
}

/**
 * Normalize an angle to `[-180, 180)`.
 *
 * @param {number} longitude - Supplies the longitude in degrees.
 * @returns {number} The normalized longitude.
 */
function normalizeLongitude(longitude) {
	const normalized = positiveModulo(longitude + 180, DEGREES_PER_ORBIT) - 180;

	return Object.is(normalized, -0) ? 0 : normalized;
}

/**
 * Resolve a positive modulo.
 *
 * @param {number} value - Supplies the value.
 * @param {number} divisor - Supplies the divisor.
 * @returns {number} The positive modulo result.
 */
function positiveModulo(value, divisor) {
	return ((value % divisor) + divisor) % divisor;
}

/**
 * Resolve a finite number with a default.
 *
 * @param {unknown} value - Supplies the candidate value.
 * @param {number} fallback - Supplies the fallback value.
 * @returns {number} The resolved number.
 */
function finiteNumberOrDefault(value, fallback) {
	return Number.isFinite(value) ? value : fallback;
}

/**
 * Resolve a finite number or fail loudly.
 *
 * @param {unknown} value - Supplies the candidate value.
 * @param {string} errorMessage - Supplies the failure message.
 * @returns {number} The resolved number.
 */
function finiteNumberOrThrow(value, errorMessage) {
	if (!Number.isFinite(value)) {
		throw new TypeError(errorMessage);
	}

	return value;
}

export default FlatSynchronizer;
