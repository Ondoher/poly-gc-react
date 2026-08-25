// Experimental snapshot references:
// - src/flat32/index.js, resolveCurrentTimeIso(...) and resolveGlobeTimePresetIso(...).
// - shared/algorithm32/production/light-sources/FlatSynchronizer.js, world synchronization formulas.
//
// This implementation intentionally copies the bounded calibration behavior
// into the reconciliation POC. It does not import or runtime-link external app
// or production modules.

import {
    FLAT32_SUBJECTIVE_FLAT_TIME_PRESETS,
    FLAT32_SUBJECTIVE_GLOBE_TIME_PRESETS,
    FLAT32_SUBJECTIVE_LOCATION_PRESETS,
    FLAT32_SUBJECTIVE_TIME_SNAPSHOT,
} from './consts.js';

const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MILLISECONDS_PER_HOUR = 60 * MILLISECONDS_PER_MINUTE;
const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;
const MINUTES_PER_DAY = 24 * 60;
const DEGREES_PER_ORBIT = 360;
const RADIANS_PER_DEGREE = Math.PI / 180;

export default class SubjectiveSceneTimeResolver {
    /**
     * Resolve a flat-basis time after location/date synchronization.
     *
     * @param {SubjectiveSceneLocationPreset} location - Supplies the selected location facts.
     * @param {SubjectiveSceneFlatTimePreset} preset - Supplies the selected flat time basis.
     * @param {string} synchronizedTimeIso - Supplies the synchronized zero-offset time.
     * @returns {SubjectiveSceneBasisResolution} The flat-basis resolution packet.
     */
    _resolveFlatBasis(location, preset, synchronizedTimeIso) {
        const normalizedOffsetDegrees = positiveModulo(preset.offsetDegrees, DEGREES_PER_ORBIT);
        const basisResolvedTimeIso = new Date(
            new Date(synchronizedTimeIso).getTime()
            + normalizedOffsetDegrees / DEGREES_PER_ORBIT * MILLISECONDS_PER_DAY,
        ).toISOString();

        return Object.freeze({
            basisResolvedTimeIso,
            basisAdjustment: Object.freeze({
                kind: 'flat-orbit-angle',
                offsetDegrees: preset.offsetDegrees,
                normalizedOffsetDegrees,
            }),
            eventAvailability: Object.freeze({
                status: 'not-applicable',
                requestedEvent: null,
                fallbackEvent: null,
                fallbackReason: null,
                synchronizedTimeIso,
            }),
            diagnostics: Object.freeze({
                solarDeclinationDegrees: worldAnchor(new Date(synchronizedTimeIso)).startLatitude,
                cosHourAngle: null,
            }),
        });
    }

    /**
     * Resolve a globe-basis time after location/date synchronization.
     *
     * @param {SubjectiveSceneLocationPreset} location - Supplies the selected location facts.
     * @param {SubjectiveSceneGlobeTimePreset} preset - Supplies the selected globe event basis.
     * @param {string} synchronizedTimeIso - Supplies synchronized solar noon.
     * @returns {SubjectiveSceneBasisResolution} The globe-basis resolution packet.
     */
    _resolveGlobeBasis(location, preset, synchronizedTimeIso) {
        const solarNoon = new Date(synchronizedTimeIso);
        const solarDeclinationDegrees = worldAnchor(solarNoon).startLatitude;

        if (preset.kind === 'solar-noon-offset') {
            const offsetHours = preset.offsetHours ?? 0;

            return Object.freeze({
                basisResolvedTimeIso: addHours(solarNoon, offsetHours),
                basisAdjustment: Object.freeze({
                    kind: 'globe-solar-event',
                    event: 'solar-noon',
                    offsetHours,
                }),
                eventAvailability: Object.freeze({
                    status: 'available',
                    requestedEvent: 'solar-noon',
                    fallbackEvent: null,
                    fallbackReason: null,
                    synchronizedTimeIso,
                }),
                diagnostics: Object.freeze({
                    solarDeclinationDegrees,
                    cosHourAngle: null,
                }),
            });
        }

        const latitudeRadians = degreesToRadians(location.latitude);
        const declinationRadians = degreesToRadians(solarDeclinationDegrees);
        const cosHourAngle = -Math.tan(latitudeRadians) * Math.tan(declinationRadians);

        if (cosHourAngle < -1 || cosHourAngle > 1) {
            return Object.freeze({
                basisResolvedTimeIso: synchronizedTimeIso,
                basisAdjustment: Object.freeze({
                    kind: 'globe-solar-event',
                    event: preset.kind,
                    offsetHours: 0,
                }),
                eventAvailability: Object.freeze({
                    status: 'unavailable',
                    requestedEvent: preset.kind,
                    fallbackEvent: 'solar-noon',
                    fallbackReason: cosHourAngle < -1 ? 'polar-day' : 'polar-night',
                    synchronizedTimeIso,
                }),
                diagnostics: Object.freeze({
                    solarDeclinationDegrees,
                    cosHourAngle,
                }),
            });
        }

        const hourAngleHours = radiansToDegrees(Math.acos(cosHourAngle)) / 15;
        const offsetHours = preset.kind === 'sunrise' ? -hourAngleHours : hourAngleHours;

        return Object.freeze({
            basisResolvedTimeIso: addHours(solarNoon, offsetHours),
            basisAdjustment: Object.freeze({
                kind: 'globe-solar-event',
                event: preset.kind,
                offsetHours,
            }),
            eventAvailability: Object.freeze({
                status: 'available',
                requestedEvent: preset.kind,
                fallbackEvent: null,
                fallbackReason: null,
                synchronizedTimeIso,
            }),
            diagnostics: Object.freeze({
                solarDeclinationDegrees,
                cosHourAngle,
            }),
        });
    }

    /**
     * Resolve a subjective scene time by synchronizing first and applying the selected basis second.
     *
     * @param {SubjectiveSceneTimeResolutionRequest} request - Supplies location, basis, preset, and explicit adjustment.
     * @returns {SubjectiveSceneTimeResolution} The complete time-resolution packet.
     */
    resolve(request) {
        if (!request || typeof request !== 'object') {
            throw new TypeError('Subjective scene time resolution requires a request object.');
        }

        const location = presetByKey(
            FLAT32_SUBJECTIVE_LOCATION_PRESETS,
            request.locationKey,
            'location',
        );
        const timeBasis = request.timeBasis;
        if (timeBasis !== 'flat' && timeBasis !== 'globe') {
            throw new TypeError(`Unsupported subjective scene time basis: ${String(timeBasis)}.`);
        }

        const synchronizedTimeIso = timeFromClosest(location.dateBasis, location, 0);
        const preset = timeBasis === 'flat'
            ? presetByKey(FLAT32_SUBJECTIVE_FLAT_TIME_PRESETS, request.timePresetKey, 'flat time')
            : presetByKey(FLAT32_SUBJECTIVE_GLOBE_TIME_PRESETS, request.timePresetKey, 'globe time');
        const basisResolution = timeBasis === 'flat'
            ? this._resolveFlatBasis(location, preset, synchronizedTimeIso)
            : this._resolveGlobeBasis(location, preset, synchronizedTimeIso);
        const hourOffset = finiteNumberOrDefault(request.hourOffset, 0, 'hourOffset');
        const minuteOffset = finiteNumberOrDefault(request.minuteOffset, 0, 'minuteOffset');
        const explicitAdjustmentMinutes = hourOffset * 60 + minuteOffset;
        const finalTimeIso = new Date(
            new Date(basisResolution.basisResolvedTimeIso).getTime()
            + explicitAdjustmentMinutes * MILLISECONDS_PER_MINUTE,
        ).toISOString();

        return Object.freeze({
            kind: 'subjective-scene-time-resolution',
            snapshot: FLAT32_SUBJECTIVE_TIME_SNAPSHOT,
            location,
            synchronizedTimeIso,
            timeBasis,
            timePreset: preset,
            basisResolvedTimeIso: basisResolution.basisResolvedTimeIso,
            basisAdjustment: basisResolution.basisAdjustment,
            explicitAdjustment: Object.freeze({
                hourOffset,
                minuteOffset,
                totalMinutes: explicitAdjustmentMinutes,
            }),
            finalTimeIso,
            eventAvailability: basisResolution.eventAvailability,
            diagnostics: basisResolution.diagnostics,
        });
    }
}

/**
 * Resolve a preset by key or fail loudly.
 *
 * @param {readonly object[]} presets - Supplies the available preset rows.
 * @param {unknown} key - Supplies the requested preset key.
 * @param {string} kind - Supplies the preset kind for the error message.
 * @returns {object} The matching preset.
 */
function presetByKey(presets, key, kind) {
    const preset = presets.find((candidate) => candidate.key === key);

    if (!preset) {
        throw new TypeError(`Unknown subjective scene ${kind} preset: ${String(key)}.`);
    }

    return preset;
}

/**
 * Resolve the synchronized orbit time from a location/date and angular basis.
 *
 * @param {string} dateBasis - Supplies the source date.
 * @param {SubjectiveSceneLocationPreset} location - Supplies the closest-approach location.
 * @param {number} offsetDegrees - Supplies the clockwise flat-orbit angle.
 * @returns {string} The synchronized ISO time.
 */
function timeFromClosest(dateBasis, location, offsetDegrees) {
    const targetTime = validDate(dateBasis, 'Subjective scene location requires a valid dateBasis.');
    const anchor = worldAnchor(targetTime);
    const longitude = normalizeLongitude(finiteNumber(location.longitude, 'Location longitude must be finite.'));
    const orbitAngleDegrees = positiveModulo(
        finiteNumber(offsetDegrees, 'Time-basis offsetDegrees must be finite.') - longitude,
        DEGREES_PER_ORBIT,
    );
    const elapsedMilliseconds = orbitAngleDegrees / DEGREES_PER_ORBIT * MILLISECONDS_PER_DAY;

    return new Date(anchor.startTime.getTime() + elapsedMilliseconds).toISOString();
}

/**
 * Create the UTC world anchor for a date.
 *
 * @param {Date} targetTime - Supplies the target date.
 * @returns {{ readonly startLatitude: number, readonly startTime: Date }} The world anchor.
 */
function worldAnchor(targetTime) {
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
    ) + solarNoonUtcMinutes * MILLISECONDS_PER_MINUTE);

    return Object.freeze({
        startLatitude: solarDeclinationDegrees(gamma),
        startTime,
    });
}

/**
 * Resolve the NOAA-style fractional-year angle.
 *
 * @param {Date} time - Supplies a UTC instant.
 * @returns {number} The fractional-year angle in radians.
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
 * @param {number} gamma - Supplies the fractional-year angle.
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
 * @param {number} gamma - Supplies the fractional-year angle.
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
 * Resolve a one-based UTC day of year.
 *
 * @param {Date} time - Supplies a UTC instant.
 * @returns {number} The one-based day number.
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
 * @returns {boolean} True when the year contains 366 days.
 */
function isLeapYear(year) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/**
 * Add hours to a date and return an ISO string.
 *
 * @param {Date} date - Supplies the base time.
 * @param {number} hours - Supplies the signed hour offset.
 * @returns {string} The adjusted ISO time.
 */
function addHours(date, hours) {
    return new Date(date.getTime() + hours * MILLISECONDS_PER_HOUR).toISOString();
}

/**
 * Resolve a finite optional number.
 *
 * @param {unknown} value - Supplies the candidate value.
 * @param {number} fallback - Supplies the default value.
 * @param {string} name - Supplies the field name.
 * @returns {number} The resolved number.
 */
function finiteNumberOrDefault(value, fallback, name) {
    return value === undefined ? fallback : finiteNumber(value, `${name} must be finite.`);
}

/**
 * Require a finite number.
 *
 * @param {unknown} value - Supplies the candidate value.
 * @param {string} message - Supplies the error message.
 * @returns {number} The finite value.
 */
function finiteNumber(value, message) {
    if (!Number.isFinite(value)) {
        throw new TypeError(message);
    }

    return value;
}

/**
 * Require a valid date.
 *
 * @param {Date | string | number} value - Supplies the candidate date.
 * @param {string} message - Supplies the error message.
 * @returns {Date} The valid date.
 */
function validDate(value, message) {
    const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

    if (Number.isNaN(date.getTime())) {
        throw new TypeError(message);
    }

    return date;
}

/**
 * Normalize longitude to `[-180, 180)`.
 *
 * @param {number} longitude - Supplies longitude in degrees.
 * @returns {number} The normalized longitude.
 */
function normalizeLongitude(longitude) {
    const normalized = positiveModulo(longitude + 180, DEGREES_PER_ORBIT) - 180;

    return Object.is(normalized, -0) ? 0 : normalized;
}

/**
 * Resolve positive modulo.
 *
 * @param {number} value - Supplies the dividend.
 * @param {number} divisor - Supplies the divisor.
 * @returns {number} The positive remainder.
 */
function positiveModulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
}

function degreesToRadians(degrees) {
    return degrees * RADIANS_PER_DEGREE;
}

function radiansToDegrees(radians) {
    return radians / RADIANS_PER_DEGREE;
}
