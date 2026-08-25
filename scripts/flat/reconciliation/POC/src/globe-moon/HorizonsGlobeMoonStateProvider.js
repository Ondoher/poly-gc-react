import { createHash } from 'node:crypto';

const URL_BASE = 'https://ssd.jpl.nasa.gov/api/horizons.api';

export default class HorizonsGlobeMoonStateProvider {
    constructor({ fetchImplementation = globalThis.fetch } = {}) { this.fetchImplementation = fetchImplementation; this.tail = Promise.resolve(); this.rawQueries = []; }

    /** Acquire one shared state and topocentric observer validation at an exact time. */
    async resolve({ timeIso, observer }) {
        const moonGeo = await this._query('301', timeIso, null);
        const sunGeo = await this._query('10', timeIso, null);
        const moonTopo = await this._query('301', timeIso, observer);
        const sunTopo = await this._query('10', timeIso, observer);
        const observerFromMoon = subtract(moonGeo.row.positionKm, moonTopo.row.positionKm);
        const observerFromSun = subtract(sunGeo.row.positionKm, sunTopo.row.positionKm);
        const observerAgreementKm = magnitude(subtract(observerFromMoon, observerFromSun));
        const provenance = Object.freeze({
            source: 'NASA/JPL Horizons API', sourceVersion: moonGeo.apiVersion,
            queryHashes: Object.freeze(this.rawQueries.map((entry) => entry.queryHash)),
            fetchedAtIso: new Date().toISOString(), normalizationVersion: 'globe-moon-state-v1',
        });
        return Object.freeze({
            worldState: Object.freeze({
                schemaVersion: 1, epochIso: moonGeo.row.epochIso, frame: 'earth-centered-ecliptic-j2000', units: 'km-km-per-second',
                moon: bodyState(moonGeo.row, 1737.4),
                sun: bodyState(sunGeo.row, 695700),
                provenance,
            }),
            observerState: Object.freeze({
                schemaVersion: 1, id: observer.id, latitudeDegrees: observer.latitudeDegrees,
                longitudeDegrees: observer.longitudeDegrees, elevationKm: observer.elevationKm,
                positionKm: Object.freeze(observerFromMoon),
                validation: Object.freeze({ observerPositionAgreementKm: observerAgreementKm, moonTopocentricPositionKm: moonTopo.row.positionKm, sunTopocentricPositionKm: sunTopo.row.positionKm }),
            }),
            provenance,
        });
    }

    _query(target, timeIso, observer) {
        const operation = this.tail.then(() => this._execute(target, timeIso, observer));
        this.tail = operation.catch(() => undefined); return operation;
    }

    async _execute(target, timeIso, observer) {
        const requestedEpochIso = new Date(timeIso).toISOString();
        const params = new URLSearchParams({
            format: 'json', COMMAND: `'${target}'`, OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'VECTORS'",
            CENTER: observer ? "'coord@399'" : "'500@399'", TLIST: `'${requestedEpochIso.replace('T', ' ').replace('Z', '')}'`,
            TIME_TYPE: "'UT'", REF_PLANE: "'ECLIPTIC'", REF_SYSTEM: "'ICRF'", OUT_UNITS: "'KM-S'", VEC_TABLE: "'2'", VEC_CORR: "'NONE'", CSV_FORMAT: "'YES'", CAL_TYPE: "'GREGORIAN'", TIME_DIGITS: "'FRACSEC'",
        });
        if (observer) { params.set('COORD_TYPE', "'GEODETIC'"); params.set('SITE_COORD', `'${observer.longitudeDegrees},${observer.latitudeDegrees},${observer.elevationKm}'`); }
        const url = `${URL_BASE}?${params.toString()}`; const queryHash = createHash('sha256').update(url).digest('hex');
        const response = await this.fetchImplementation(url, { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error(`Horizons HTTP ${response.status}.`);
        const payload = await response.json(); if (payload.error) throw new Error(`Horizons error: ${payload.error}`);
        const row = parseRow(payload.result); const apiVersion = payload.signature?.version;
        if (typeof apiVersion !== 'string') throw new TypeError('Horizons signature version is missing.');
        this.rawQueries.push(Object.freeze({
            target,
            observerId: observer?.id ?? null,
            requestedEpochIso,
            returnedEpochIso: row.epochIso,
            returnedEpochJulianDateUt: row.epochJulianDateUt,
            returnedEpochCalendarDateUt: row.epochCalendarDateUt,
            url,
            queryHash,
            apiVersion,
            payload,
        }));
        return Object.freeze({ row, apiVersion, queryHash });
    }
}

function parseRow(result) {
    const table = result?.match(/\$\$SOE\s*([\s\S]*?)\s*\$\$EOE/); if (!table) throw new TypeError('Horizons table is missing.');
    const columns = table[1].trim().split(/\r?\n/)[0].split(',').map((value) => value.trim());
    const epochJulianDateUt = Number(columns[0]);
    const epochCalendarDateUt = columns[1];
    const epochIso = parseCalendarDateUt(epochCalendarDateUt);
    const positionKm = columns.slice(2, 5).map(Number); const velocityKmPerSecond = columns.slice(5, 8).map(Number);
    if (!Number.isFinite(epochJulianDateUt) || ![...positionKm, ...velocityKmPerSecond].every(Number.isFinite)) throw new TypeError('Horizons vector row is malformed.');
    return Object.freeze({
        epochIso,
        epochJulianDateUt,
        epochCalendarDateUt,
        positionKm: Object.freeze(positionKm),
        velocityKmPerSecond: Object.freeze(velocityKmPerSecond),
    });
}

function parseCalendarDateUt(value) {
    const match = /^(A\.D\.)\s+(\d{4,})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/.exec(value);
    if (!match) throw new TypeError('Horizons vector epoch is malformed or unsupported.');
    const [, , yearText, monthName, dayText, hourText, minuteText, secondText, fractionText = ''] = match;
    const monthIndex = HORIZONS_MONTH_INDEX[monthName.toLowerCase()];
    if (!Number.isInteger(monthIndex)) throw new TypeError('Horizons vector epoch month is unsupported.');
    if (/[^0]/.test(fractionText.slice(3))) throw new TypeError('Horizons vector epoch has unsupported sub-millisecond precision.');
    const parts = {
        year: Number(yearText),
        month: monthIndex,
        day: Number(dayText),
        hour: Number(hourText),
        minute: Number(minuteText),
        second: Number(secondText),
        millisecond: Number(fractionText.padEnd(3, '0').slice(0, 3)),
    };
    const date = new Date(0);
    date.setUTCFullYear(parts.year, parts.month, parts.day);
    date.setUTCHours(parts.hour, parts.minute, parts.second, parts.millisecond);
    if (date.getUTCFullYear() !== parts.year
        || date.getUTCMonth() !== parts.month
        || date.getUTCDate() !== parts.day
        || date.getUTCHours() !== parts.hour
        || date.getUTCMinutes() !== parts.minute
        || date.getUTCSeconds() !== parts.second
        || date.getUTCMilliseconds() !== parts.millisecond) {
        throw new TypeError('Horizons vector epoch is not a valid Gregorian timestamp.');
    }
    return date.toISOString();
}

function bodyState(row, radiusKm) {
    return Object.freeze({ positionKm: row.positionKm, velocityKmPerSecond: row.velocityKmPerSecond, radiusKm });
}

const HORIZONS_MONTH_INDEX = Object.freeze({
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
});

function subtract(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function magnitude(a) { return Math.hypot(...a); }
