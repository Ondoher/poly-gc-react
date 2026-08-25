import { createHash } from 'node:crypto';

import MoonPhaseCalculator from './MoonPhaseCalculator.js';

const HORIZONS_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api';

export default class HorizonsMoonPhaseSampleProvider {
    constructor({ fetchImplementation = globalThis.fetch, calculator = new MoonPhaseCalculator() } = {}) {
        if (typeof fetchImplementation !== 'function') throw new TypeError('A fetch implementation is required.');
        this.fetchImplementation = fetchImplementation;
        this.calculator = calculator;
        this.requestTail = Promise.resolve();
        this.rawQueries = [];
        this.normalizedSamples = [];
    }

    /**
     * Query sequential Moon and Sun ecliptic vector tables for an interval.
     *
     * @param {object} request - Supplies the UTC interval and sampling step.
     * @returns {Promise<readonly MoonPhaseAtTimeResult[]>} The normalized phase samples.
     */
    async sampleRange(request) {
        const moon = await this._queryVectors('301', request);
        const sun = await this._queryVectors('10', request);
        const sunByJulianDay = new Map(sun.rows.map((row) => [row.julianDay.toFixed(9), row]));
        const queryHashes = Object.freeze([moon.queryHash, sun.queryHash]);
        const fetchedAtIso = new Date().toISOString();
        const provenance = Object.freeze({
            source: 'NASA/JPL Horizons API',
            sourceVersion: moon.apiVersion,
            queryHashes,
            fetchedAtIso,
            normalizationVersion: 'moon-phase-v1',
        });
        const samples = Object.freeze(moon.rows.map((moonRow) => {
            const sunRow = sunByJulianDay.get(moonRow.julianDay.toFixed(9));
            if (!sunRow) throw new Error(`Sun vector is missing for Julian day ${moonRow.julianDay}.`);
            return this.calculator.calculate({
                timeIso: moonRow.timeIso,
                moonPositionKm: moonRow.positionKm,
                sunPositionKm: sunRow.positionKm,
                provenance,
            });
        }));
        this.normalizedSamples.push(...samples);
        return samples;
    }

    _queryVectors(targetId, request) {
        const operation = this.requestTail.then(() => this._executeVectorQuery(targetId, request));
        this.requestTail = operation.catch(() => undefined);
        return operation;
    }

    async _executeVectorQuery(targetId, request) {
        const url = buildUrl(targetId, request);
        const queryHash = sha256(url);
        const response = await this.fetchImplementation(url, { headers: { accept: 'application/json' } });
        if (!response.ok) throw new Error(`Horizons request failed with HTTP ${response.status}.`);
        const payload = await response.json();
        if (payload.error) throw new Error(`Horizons error: ${payload.error}`);
        if (typeof payload.result !== 'string' || typeof payload.signature?.version !== 'string') {
            throw new TypeError('Horizons response is missing result or signature version.');
        }
        const rows = parseVectorRows(payload.result);
        if (rows.length < 2) throw new RangeError('Horizons returned fewer than two vector rows.');
        this.rawQueries.push(Object.freeze({ targetId, url, queryHash, apiVersion: payload.signature.version, payload }));
        return Object.freeze({ rows, queryHash, apiVersion: payload.signature.version });
    }
}

function buildUrl(targetId, request) {
    const parameters = new URLSearchParams({
        format: 'json',
        COMMAND: `'${targetId}'`,
        OBJ_DATA: "'NO'",
        MAKE_EPHEM: "'YES'",
        EPHEM_TYPE: "'VECTORS'",
        CENTER: "'500@399'",
        START_TIME: `'${isoForHorizons(request.startTimeIso)}'`,
        STOP_TIME: `'${isoForHorizons(request.stopTimeIso)}'`,
        STEP_SIZE: `'${request.stepMinutes} m'`,
        TIME_TYPE: "'UT'",
        REF_PLANE: "'ECLIPTIC'",
        REF_SYSTEM: "'ICRF'",
        OUT_UNITS: "'KM-S'",
        VEC_TABLE: "'2'",
        VEC_CORR: "'NONE'",
        CSV_FORMAT: "'YES'",
        CAL_TYPE: "'GREGORIAN'",
        TIME_DIGITS: "'FRACSEC'",
    });
    return `${HORIZONS_URL}?${parameters.toString()}`;
}

function parseVectorRows(result) {
    const table = result.match(/\$\$SOE\s*([\s\S]*?)\s*\$\$EOE/);
    if (!table) throw new TypeError('Horizons vector table markers are missing.');
    return Object.freeze(table[1].trim().split(/\r?\n/).filter(Boolean).map((line) => {
        const columns = line.split(',').map((value) => value.trim()).filter((_, index) => index < 8);
        if (columns.length < 8) throw new TypeError(`Malformed Horizons vector row: ${line}`);
        const julianDay = Number(columns[0]);
        const positionKm = columns.slice(2, 5).map(Number);
        const velocityKmPerSecond = columns.slice(5, 8).map(Number);
        if (![julianDay, ...positionKm, ...velocityKmPerSecond].every(Number.isFinite)) {
            throw new TypeError(`Non-finite Horizons vector row: ${line}`);
        }
        return Object.freeze({
            julianDay,
            timeIso: julianDayToIso(julianDay),
            positionKm: Object.freeze(positionKm),
            velocityKmPerSecond: Object.freeze(velocityKmPerSecond),
        });
    }));
}

function julianDayToIso(julianDay) {
    return new Date((julianDay - 2440587.5) * 86400000).toISOString();
}

function isoForHorizons(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) throw new TypeError('A valid Horizons query timestamp is required.');
    return date.toISOString().replace('T', ' ').replace('Z', '');
}

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}
