// References:
// - https://ssd-api.jpl.nasa.gov/doc/horizons.html, Horizons API 1.3 parameters.
// - https://ssd.jpl.nasa.gov/horizons/manual.html, observer quantities 14 and 15.
// - https://doi.org/10.18434/mds2-3397, AIR-LUSI signed lunar phase oracle.

import { createHash } from 'node:crypto';

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';

const URL_BASE = 'https://ssd.jpl.nasa.gov/api/horizons.api';
const MOON_TARGET = '301';
const SUN_TARGET = '10';
const VECTOR_QUERY_KIND = 'vector';
const LUNAR_ASPECT_QUERY_KIND = 'lunar-aspect-observer';
const VECTOR_FRAME = 'earth-centered-ecliptic-j2000';
const VECTOR_UNITS = 'km-km-per-second';
const LUNAR_ASPECT_FRAME = 'MOON_ME';
const LUNAR_LONGITUDE_CONVENTION = 'east-positive';
const MOON_RADIUS_KM = 1737.4;
const SUN_RADIUS_KM = 695700;
const ORACLE_TOLERANCE_DEGREES = 1e-12;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const PHYSICAL_STATE_QUERY_COUNT = 5;
const HORIZONS_MONTH_INDEX = Object.freeze({
    jan: 0,
    feb: 1,
    mar: 2,
    apr: 3,
    may: 4,
    jun: 5,
    jul: 6,
    aug: 7,
    sep: 8,
    oct: 9,
    nov: 10,
    dec: 11,
});
const AIR_LUSI_SIGNED_PHASE_ORACLE = Object.freeze([
    oracleRow(
        1,
        '2022-03-13T06:10:13.282187Z',
        -59.69592672591374,
        -3.380465528095946,
        -5.3778464548122775,
        56.310535590798224,
        -1.405128636116908,
    ),
    oracleRow(
        3,
        '2022-03-15T03:55:38.217681Z',
        -37.58549377967715,
        -4.222121671886732,
        -6.385647718334912,
        33.129141661902246,
        -1.3772775681487992,
    ),
    oracleRow(
        4,
        '2022-03-16T07:25:15.703350Z',
        -24.777347511743777,
        -5.15511080483183,
        -6.193665978839728,
        19.20666431970749,
        -1.357336865098705,
    ),
    oracleRow(
        5,
        '2022-03-17T06:49:06.175018Z',
        -13.097906426735724,
        -4.9408735970725335,
        -5.911379743610432,
        7.360834578490522,
        -1.3384779634693607,
    ),
]);

export default class Er6HorizonsPhysicalGlobeStateProvider {
    /**
     * Create a single-case physical Horizons acquisition owner.
     *
     * @param {Er6HorizonsPhysicalGlobeStateProviderConfiguration} [configuration] - Fetch dependency.
     */
    constructor({ fetchImplementation = globalThis.fetch } = {}) {
        if (typeof fetchImplementation !== 'function') {
            throw configurationError('ER6_HORIZONS_FETCH_IMPLEMENTATION_INVALID',
                'ER6 Horizons provider requires a fetch implementation.');
        }
        this.fetchImplementation = fetchImplementation;
        this.rawQueries = [];
        this._started = false;
        this.signedPhaseOracle = evaluateSignedPhaseOracle();
        if (this.signedPhaseOracle.maximumAbsoluteResidualDegrees > ORACLE_TOLERANCE_DEGREES) {
            throw configurationError('ER6_HORIZONS_SIGNED_PHASE_ORACLE_FAILED',
                'Signed lunar phase implementation failed the retained AIR-LUSI oracle.', {
                    maximumAbsoluteResidualDegrees:
                        this.signedPhaseOracle.maximumAbsoluteResidualDegrees,
                    toleranceDegrees: ORACLE_TOLERANCE_DEGREES,
                });
        }
        this.fingerprint = stableHash(this.describe());
    }

    /**
     * Describe the five-query physical state contract and signed-phase self-check.
     *
     * @returns {Readonly<Record<string, unknown>>} Immutable provider descriptor.
     */
    describe() {
        return freezeJsonValue({
            kind: 'er6-horizons-physical-globe-state-provider-v1',
            endpoint: URL_BASE,
            singleUse: true,
            queryOrder: Object.freeze([
                'moon-geocentric-vector',
                'sun-geocentric-vector',
                'moon-topocentric-vector',
                'sun-topocentric-vector',
                'moon-topocentric-observer-quantities-14-15',
            ]),
            vectorContract: Object.freeze({
                ephemerisType: 'VECTORS',
                referencePlane: 'ECLIPTIC',
                referenceSystem: 'ICRF',
                vectorCorrections: 'NONE',
                outputUnits: 'KM-S',
            }),
            lunarAspectContract: Object.freeze({
                ephemerisType: 'OBSERVER',
                quantities: '14,15',
                apparent: 'AIRLESS',
                csv: true,
                timeType: 'UT',
                timeDigits: 'FRACSEC',
                extraPrecision: true,
                targetPoleFrame: LUNAR_ASPECT_FRAME,
                longitudeConvention: LUNAR_LONGITUDE_CONVENTION,
            }),
            signedPhaseMethod:
                'sign(shortestEastPositive(ObsSub-LON-SunSub-LON)) * sphericalAngularSeparation(ObsSub,SolarSub)',
            signedPhaseOracle: this.signedPhaseOracle,
        });
    }

    /**
     * Fetch and validate one versioned Horizons JSON payload.
     *
     * @param {string} url - Exact query URL.
     * @returns {Promise<Readonly<Record<string, unknown>>>} Payload and API identity.
     */
    async _fetchPayload(url) {
        let response;
        try {
            response = await this.fetchImplementation(url, {
                headers: { accept: 'application/json' },
            });
        } catch (error) {
            throw configurationError('ER6_HORIZONS_FETCH_FAILED',
                'ER6 Horizons request failed before an HTTP response.', {
                    cause: error instanceof Error ? error.message : String(error),
                });
        }
        if (!response?.ok) {
            throw configurationError('ER6_HORIZONS_HTTP_FAILED',
                'ER6 Horizons request returned a non-success HTTP status.', {
                    status: response?.status ?? null,
                });
        }
        const payload = await response.json();
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            throw configurationError('ER6_HORIZONS_PAYLOAD_INVALID',
                'ER6 Horizons response must be a JSON object.');
        }
        if (payload.error) {
            throw configurationError('ER6_HORIZONS_API_ERROR',
                'ER6 Horizons response reported an API error.', {
                    apiError: payload.error,
                });
        }
        if (
            typeof payload.result !== 'string'
            || typeof payload.signature?.version !== 'string'
            || payload.signature.version.trim() === ''
            || typeof payload.signature?.source !== 'string'
            || payload.signature.source.trim() === ''
        ) {
            throw configurationError('ER6_HORIZONS_SIGNATURE_INVALID',
                'ER6 Horizons response requires result text and a versioned API signature.');
        }
        return Object.freeze({
            payload: freezeJsonValue(payload),
            apiVersion: payload.signature.version,
            apiSource: payload.signature.source,
        });
    }

    /**
     * Execute one exact-time geometric state-vector query.
     *
     * @param {string} target - Horizons target code.
     * @param {string} timeIso - Exact canonical UTC.
     * @param {Er6HorizonsObserver | null} observer - Topocentric observer or geocenter.
     * @returns {Promise<Readonly<Record<string, unknown>>>} Parsed vector query.
     */
    async _queryVector(target, timeIso, observer) {
        const url = buildVectorUrl(target, timeIso, observer);
        const queryHash = sha256(url);
        const fetched = await this._fetchPayload(url);
        const row = parseVectorRow(fetched.payload.result);
        requireExactReturnedEpoch(row.epochIso, timeIso, VECTOR_QUERY_KIND, target);
        const query = Object.freeze({
            queryKind: VECTOR_QUERY_KIND,
            target,
            observerId: observer?.id ?? null,
            requestedEpochIso: timeIso,
            returnedEpochIso: row.epochIso,
            returnedEpochJulianDateUt: row.epochJulianDateUt,
            returnedEpochCalendarDateUt: row.epochCalendarDateUt,
            url,
            queryHash,
            apiVersion: fetched.apiVersion,
            apiSource: fetched.apiSource,
            payload: fetched.payload,
        });
        this.rawQueries.push(query);
        return Object.freeze({ row, query });
    }

    /**
     * Execute the exact-time AIRLESS lunar physical-aspect query.
     *
     * @param {string} timeIso - Exact canonical UTC.
     * @param {Er6HorizonsObserver} observer - Topocentric Earth observer.
     * @returns {Promise<Readonly<Record<string, unknown>>>} Parsed aspect query.
     */
    async _queryLunarAspect(timeIso, observer) {
        const url = buildLunarAspectUrl(timeIso, observer);
        const queryHash = sha256(url);
        const fetched = await this._fetchPayload(url);
        const row = parseLunarAspectRow(fetched.payload.result);
        requireExactReturnedEpoch(row.epochIso, timeIso, LUNAR_ASPECT_QUERY_KIND, MOON_TARGET);
        const aspectCore = freezeJsonValue({
            schemaVersion: 1,
            epochIso: row.epochIso,
            frame: LUNAR_ASPECT_FRAME,
            longitudeConvention: LUNAR_LONGITUDE_CONVENTION,
            subobserverLongitudeDegrees: row.subobserverLongitudeDegrees,
            subobserverLatitudeDegrees: row.subobserverLatitudeDegrees,
            subsolarLongitudeDegrees: row.subsolarLongitudeDegrees,
            subsolarLatitudeDegrees: row.subsolarLatitudeDegrees,
            shortestEastPositiveLongitudeDeltaDegrees:
                row.shortestEastPositiveLongitudeDeltaDegrees,
            absolutePhaseDegrees: row.absolutePhaseDegrees,
            signedPhaseDegrees: row.signedPhaseDegrees,
            method:
                'signed spherical separation of observer and solar subpoints in MOON_ME',
            header: row.header,
            provenance: Object.freeze({
                source: fetched.apiSource,
                sourceVersion: fetched.apiVersion,
                queryHash,
                quantities: '14,15',
                apparent: 'AIRLESS',
                extraPrecision: true,
            }),
        });
        const lunarAspect = Object.freeze({
            ...aspectCore,
            fingerprint: createEr6LunarPhysicalAspectFingerprint(aspectCore),
        });
        const query = Object.freeze({
            queryKind: LUNAR_ASPECT_QUERY_KIND,
            target: MOON_TARGET,
            observerId: observer.id,
            requestedEpochIso: timeIso,
            returnedEpochIso: row.epochIso,
            returnedEpochJulianDateUt: null,
            returnedEpochCalendarDateUt: row.epochCalendarDateUt,
            lunarAspectFingerprint: lunarAspect.fingerprint,
            url,
            queryHash,
            apiVersion: fetched.apiVersion,
            apiSource: fetched.apiSource,
            payload: fetched.payload,
        });
        this.rawQueries.push(query);
        return Object.freeze({ lunarAspect, query });
    }

    /**
     * Return the retained four-case AIR-LUSI signed-phase implementation diagnostic.
     *
     * @returns {Er6SignedPhaseOracleDiagnostic} Immutable oracle result.
     */
    evaluateSignedPhaseOracle() {
        return this.signedPhaseOracle;
    }

    /**
     * Acquire one exact-time Sun/Moon physical state through exactly five queries.
     *
     * @param {Er6HorizonsPhysicalGlobeStateRequest} request - Exact UTC and observer.
     * @returns {Promise<Er6HorizonsPhysicalGlobeState>} Provider-owned physical state.
     */
    async resolve(request) {
        if (this._started) {
            throw configurationError('ER6_HORIZONS_PROVIDER_REUSE_PROHIBITED',
                'Use a fresh ER6 Horizons provider instance for every case.');
        }
        this._started = true;
        const normalized = validateRequest(request);
        const moonGeocentric = await this._queryVector(MOON_TARGET, normalized.timeIso, null);
        const sunGeocentric = await this._queryVector(SUN_TARGET, normalized.timeIso, null);
        const moonTopocentric = await this._queryVector(
            MOON_TARGET,
            normalized.timeIso,
            normalized.observer,
        );
        const sunTopocentric = await this._queryVector(
            SUN_TARGET,
            normalized.timeIso,
            normalized.observer,
        );
        const aspect = await this._queryLunarAspect(
            normalized.timeIso,
            normalized.observer,
        );
        if (this.rawQueries.length !== 5) {
            throw configurationError('ER6_HORIZONS_QUERY_COUNT_INVALID',
                'ER6 physical state acquisition must retain exactly five queries.', {
                    queryCount: this.rawQueries.length,
                });
        }
        const versions = new Set(this.rawQueries.map((entry) => entry.apiVersion));
        const sources = new Set(this.rawQueries.map((entry) => entry.apiSource));
        if (versions.size !== 1 || sources.size !== 1) {
            throw configurationError('ER6_HORIZONS_API_IDENTITY_MISMATCH',
                'All five Horizons responses must share one API source and version.');
        }

        const observerFromMoon = subtract(
            moonGeocentric.row.positionKm,
            moonTopocentric.row.positionKm,
        );
        const observerFromSun = subtract(
            sunGeocentric.row.positionKm,
            sunTopocentric.row.positionKm,
        );
        const observerAgreementKm = magnitude(subtract(observerFromMoon, observerFromSun));
        if (!Number.isFinite(observerAgreementKm)) {
            throw configurationError('ER6_HORIZONS_OBSERVER_RECONSTRUCTION_INVALID',
                'Independent Moon and Sun observer reconstructions must be finite.');
        }
        const queryHashes = Object.freeze(this.rawQueries.map((entry) => entry.queryHash));
        const apiVersion = this.rawQueries[0].apiVersion;
        const apiSource = this.rawQueries[0].apiSource;
        const provenance = Object.freeze({
            source: apiSource,
            sourceVersion: apiVersion,
            queryHashes,
            fetchedAtIso: new Date().toISOString(),
            normalizationVersion: 'er6-physical-globe-state-v1',
            queryCount: 5,
        });
        const worldState = Object.freeze({
            schemaVersion: 1,
            epochIso: normalized.timeIso,
            frame: VECTOR_FRAME,
            units: VECTOR_UNITS,
            moon: bodyState(moonGeocentric.row, MOON_RADIUS_KM),
            sun: bodyState(sunGeocentric.row, SUN_RADIUS_KM),
            provenance,
        });
        const observerState = Object.freeze({
            schemaVersion: 1,
            id: normalized.observer.id,
            latitudeDegrees: normalized.observer.latitudeDegrees,
            longitudeDegrees: normalized.observer.longitudeDegrees,
            elevationKm: normalized.observer.elevationKm,
            positionKm: Object.freeze(observerFromMoon),
            validation: Object.freeze({
                observerPositionAgreementKm: observerAgreementKm,
                moonTopocentricPositionKm: moonTopocentric.row.positionKm,
                sunTopocentricPositionKm: sunTopocentric.row.positionKm,
            }),
        });
        const stateCore = Object.freeze({
            kind: 'er6-horizons-physical-globe-state-v1',
            schemaVersion: 1,
            worldState,
            observerState,
            lunarAspect: aspect.lunarAspect,
            provenance,
        });
        const state = Object.freeze({
            ...stateCore,
            fingerprint: createEr6HorizonsPhysicalGlobeStateFingerprint(stateCore),
        });
        this.rawQueries = Object.freeze([...this.rawQueries]);
        return validateEr6HorizonsPhysicalGlobeStateIntegrity(state);
    }
}

/**
 * Reconstruct the canonical ER6 physical-state fingerprint without shadow state.
 *
 * @param {Er6HorizonsPhysicalGlobeState | Omit<Er6HorizonsPhysicalGlobeState, 'fingerprint'>} value - State or state core.
 * @returns {string} Stable SHA-256 fingerprint.
 */
export function createEr6HorizonsPhysicalGlobeStateFingerprint(value) {
    return stableHash({
        kind: value.kind,
        schemaVersion: value.schemaVersion,
        worldState: Object.freeze({
            schemaVersion: value.worldState?.schemaVersion,
            epochIso: value.worldState?.epochIso,
            frame: value.worldState?.frame,
            units: value.worldState?.units,
            moon: value.worldState?.moon,
            sun: value.worldState?.sun,
        }),
        observerState: value.observerState,
        lunarAspect: value.lunarAspect,
        source: value.provenance?.source,
        sourceVersion: value.provenance?.sourceVersion,
        queryHashes: value.provenance?.queryHashes,
    });
}

/**
 * Reconstruct the canonical ER6 physical lunar-aspect fingerprint.
 *
 * @param {Er6LunarPhysicalAspect | Omit<Er6LunarPhysicalAspect, 'fingerprint'>} value - Aspect or aspect core.
 * @returns {string} Stable SHA-256 fingerprint.
 */
export function createEr6LunarPhysicalAspectFingerprint(value) {
    const { fingerprint: _fingerprint, ...body } = value;
    return stableHash(body);
}

/**
 * Validate one untampered five-query physical state at every consumer seam.
 *
 * @param {Er6HorizonsPhysicalGlobeState} value - Provider-owned physical state.
 * @returns {Er6HorizonsPhysicalGlobeState} The unchanged validated state.
 */
export function validateEr6HorizonsPhysicalGlobeStateIntegrity(value) {
    const lunarAspect = value?.lunarAspect;
    const provenance = value?.provenance;
    let expectedStateFingerprint = null;
    let expectedLunarAspectFingerprint = null;
    try {
        expectedStateFingerprint = createEr6HorizonsPhysicalGlobeStateFingerprint(value);
        expectedLunarAspectFingerprint = createEr6LunarPhysicalAspectFingerprint(
            lunarAspect,
        );
    } catch {
        expectedStateFingerprint = null;
        expectedLunarAspectFingerprint = null;
    }
    if (
        !value
        || typeof value !== 'object'
        || Array.isArray(value)
        || value.kind !== 'er6-horizons-physical-globe-state-v1'
        || value.schemaVersion !== 1
        || !FINGERPRINT_PATTERN.test(value.fingerprint ?? '')
        || value.fingerprint !== expectedStateFingerprint
        || !lunarAspect
        || lunarAspect.epochIso !== value.worldState?.epochIso
        || lunarAspect.frame !== LUNAR_ASPECT_FRAME
        || lunarAspect.longitudeConvention !== LUNAR_LONGITUDE_CONVENTION
        || !FINGERPRINT_PATTERN.test(lunarAspect.fingerprint ?? '')
        || lunarAspect.fingerprint !== expectedLunarAspectFingerprint
        || provenance?.queryCount !== PHYSICAL_STATE_QUERY_COUNT
        || !Array.isArray(provenance?.queryHashes)
        || provenance.queryHashes.length !== PHYSICAL_STATE_QUERY_COUNT
        || !provenance.queryHashes.every((hash) => FINGERPRINT_PATTERN.test(hash))
        || typeof provenance?.source !== 'string'
        || provenance.source.trim() === ''
        || typeof provenance?.sourceVersion !== 'string'
        || provenance.sourceVersion.trim() === ''
    ) {
        throw configurationError('ER6_HORIZONS_PHYSICAL_STATE_INTEGRITY_INVALID',
            'ER6 physical state must retain the exact five-query state, aspect, and provenance fingerprints.');
    }
    for (const field of [
        'signedPhaseDegrees',
        'absolutePhaseDegrees',
        'subobserverLongitudeDegrees',
        'subobserverLatitudeDegrees',
        'subsolarLongitudeDegrees',
        'subsolarLatitudeDegrees',
    ]) {
        if (!Number.isFinite(lunarAspect[field])) {
            throw configurationError('ER6_HORIZONS_LUNAR_ASPECT_INTEGRITY_INVALID',
                'ER6 lunar physical-aspect values must be finite.', { field });
        }
    }
    return value;
}

function buildVectorUrl(target, timeIso, observer) {
    const params = new URLSearchParams({
        format: 'json',
        COMMAND: `'${target}'`,
        OBJ_DATA: "'NO'",
        MAKE_EPHEM: "'YES'",
        EPHEM_TYPE: "'VECTORS'",
        CENTER: observer ? "'coord@399'" : "'500@399'",
        TLIST: `'${horizonsTime(timeIso)}'`,
        TLIST_TYPE: "'CAL'",
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
    if (observer) {
        params.set('COORD_TYPE', "'GEODETIC'");
        params.set('SITE_COORD', siteCoordinates(observer));
    }
    return `${URL_BASE}?${params.toString()}`;
}

function buildLunarAspectUrl(timeIso, observer) {
    const params = new URLSearchParams({
        format: 'json',
        COMMAND: `'${MOON_TARGET}'`,
        OBJ_DATA: "'NO'",
        MAKE_EPHEM: "'YES'",
        EPHEM_TYPE: "'OBSERVER'",
        CENTER: "'coord@399'",
        TLIST: `'${horizonsTime(timeIso)}'`,
        TLIST_TYPE: "'CAL'",
        TIME_TYPE: "'UT'",
        QUANTITIES: "'14,15'",
        APPARENT: "'AIRLESS'",
        CSV_FORMAT: "'YES'",
        CAL_TYPE: "'GREGORIAN'",
        TIME_DIGITS: "'FRACSEC'",
        EXTRA_PREC: "'YES'",
        COORD_TYPE: "'GEODETIC'",
        SITE_COORD: siteCoordinates(observer),
    });
    return `${URL_BASE}?${params.toString()}`;
}

function parseVectorRow(result) {
    const row = singleTableRow(result, VECTOR_QUERY_KIND);
    const columns = splitCsv(row);
    if (columns.length < 8) {
        throw configurationError('ER6_HORIZONS_VECTOR_ROW_INVALID',
            'Horizons vector table row does not contain a complete state vector.');
    }
    const epochJulianDateUt = Number(columns[0]);
    const epochCalendarDateUt = columns[1];
    const epochIso = parseCalendarDateUt(epochCalendarDateUt);
    const positionKm = columns.slice(2, 5).map(Number);
    const velocityKmPerSecond = columns.slice(5, 8).map(Number);
    if (
        !Number.isFinite(epochJulianDateUt)
        || ![...positionKm, ...velocityKmPerSecond].every(Number.isFinite)
    ) {
        throw configurationError('ER6_HORIZONS_VECTOR_ROW_INVALID',
            'Horizons vector table row contains non-finite state values.');
    }
    return Object.freeze({
        epochIso,
        epochJulianDateUt,
        epochCalendarDateUt,
        positionKm: Object.freeze(positionKm),
        velocityKmPerSecond: Object.freeze(velocityKmPerSecond),
    });
}

function parseLunarAspectRow(result) {
    if (typeof result !== 'string') {
        throw configurationError('ER6_HORIZONS_LUNAR_ASPECT_RESULT_INVALID',
            'Horizons lunar-aspect result must be text.');
    }
    const poleMatch = result.match(
        /Target pole\/equ\s*:\s*MOON_ME[^\r\n]*\{East-longitude positive\}/,
    );
    if (!poleMatch) {
        throw configurationError('ER6_HORIZONS_LUNAR_ASPECT_FRAME_INVALID',
            'Horizons lunar aspect must declare MOON_ME with east-positive longitude.');
    }
    if (!/Target body name\s*:\s*Moon\s*\(301\)/i.test(result)) {
        throw configurationError('ER6_HORIZONS_LUNAR_ASPECT_TARGET_INVALID',
            'Horizons lunar aspect must identify Moon target 301.');
    }
    const startIndex = result.indexOf('$$SOE');
    if (startIndex < 0) {
        throw configurationError('ER6_HORIZONS_TABLE_MISSING',
            'Horizons lunar-aspect table start marker is missing.');
    }
    const headerLine = result.slice(0, startIndex).split(/\r?\n/).reverse().find((line) =>
        line.includes('ObsSub-LON')
        && line.includes('ObsSub-LAT')
        && line.includes('SunSub-LON')
        && line.includes('SunSub-LAT'));
    if (!headerLine) {
        throw configurationError('ER6_HORIZONS_LUNAR_ASPECT_COLUMNS_MISSING',
            'Horizons lunar-aspect CSV labels are missing.');
    }
    const labels = splitCsv(headerLine);
    const timeIndex = labels.findIndex((label) => label.includes('Date__(UT)'));
    const observerLongitudeIndex = labels.indexOf('ObsSub-LON');
    const observerLatitudeIndex = labels.indexOf('ObsSub-LAT');
    const solarLongitudeIndex = labels.indexOf('SunSub-LON');
    const solarLatitudeIndex = labels.indexOf('SunSub-LAT');
    if (
        timeIndex < 0
        || observerLongitudeIndex < 0
        || observerLatitudeIndex !== observerLongitudeIndex + 1
        || solarLongitudeIndex !== observerLatitudeIndex + 1
        || solarLatitudeIndex !== solarLongitudeIndex + 1
    ) {
        throw configurationError('ER6_HORIZONS_LUNAR_ASPECT_COLUMN_ORDER_INVALID',
            'Horizons quantities 14 and 15 must retain their documented CSV label order.', {
                labels,
            });
    }
    const row = splitCsv(singleTableRow(result, LUNAR_ASPECT_QUERY_KIND));
    const epochCalendarDateUt = row[timeIndex];
    const epochIso = parseCalendarDateUt(epochCalendarDateUt);
    const subobserverLongitudeDegrees = finiteLongitude(
        row[observerLongitudeIndex],
        'ObsSub-LON',
    );
    const subobserverLatitudeDegrees = finiteLatitude(
        row[observerLatitudeIndex],
        'ObsSub-LAT',
    );
    const subsolarLongitudeDegrees = finiteLongitude(
        row[solarLongitudeIndex],
        'SunSub-LON',
    );
    const subsolarLatitudeDegrees = finiteLatitude(
        row[solarLatitudeIndex],
        'SunSub-LAT',
    );
    const phase = signedSphericalPhaseDegrees({
        subobserverLongitudeDegrees,
        subobserverLatitudeDegrees,
        subsolarLongitudeDegrees,
        subsolarLatitudeDegrees,
    });
    return Object.freeze({
        epochIso,
        epochCalendarDateUt,
        subobserverLongitudeDegrees,
        subobserverLatitudeDegrees,
        subsolarLongitudeDegrees,
        subsolarLatitudeDegrees,
        ...phase,
        header: Object.freeze({
            targetPoleFrame: LUNAR_ASPECT_FRAME,
            longitudeConvention: LUNAR_LONGITUDE_CONVENTION,
            matchedPoleLine: poleMatch[0],
            csvLabels: Object.freeze(labels),
        }),
    });
}

function signedSphericalPhaseDegrees({
    subobserverLongitudeDegrees,
    subobserverLatitudeDegrees,
    subsolarLongitudeDegrees,
    subsolarLatitudeDegrees,
}) {
    const observer = sphericalUnitVector(
        subobserverLongitudeDegrees,
        subobserverLatitudeDegrees,
    );
    const solar = sphericalUnitVector(
        subsolarLongitudeDegrees,
        subsolarLatitudeDegrees,
    );
    const crossProduct = cross(observer, solar);
    const separationRadians = Math.atan2(magnitude(crossProduct), dot(observer, solar));
    const absolutePhaseDegrees = separationRadians * 180 / Math.PI;
    const shortestEastPositiveLongitudeDeltaDegrees = wrapSignedDegrees(
        subobserverLongitudeDegrees - subsolarLongitudeDegrees,
    );
    const sign = Math.sign(shortestEastPositiveLongitudeDeltaDegrees);
    return Object.freeze({
        shortestEastPositiveLongitudeDeltaDegrees,
        absolutePhaseDegrees,
        signedPhaseDegrees: sign === 0 ? 0 : sign * absolutePhaseDegrees,
    });
}

function evaluateSignedPhaseOracle() {
    const cases = AIR_LUSI_SIGNED_PHASE_ORACLE.map((entry) => {
        const result = signedSphericalPhaseDegrees(entry);
        const residualDegrees = result.signedPhaseDegrees - entry.expectedSignedPhaseDegrees;
        return Object.freeze({
            flightId: entry.flightId,
            timestampUtc: entry.timestampUtc,
            expectedSignedPhaseDegrees: entry.expectedSignedPhaseDegrees,
            actualSignedPhaseDegrees: result.signedPhaseDegrees,
            residualDegrees,
            absoluteResidualDegrees: Math.abs(residualDegrees),
        });
    });
    const maximumAbsoluteResidualDegrees = Math.max(...cases.map((entry) =>
        entry.absoluteResidualDegrees));
    return Object.freeze({
        source: 'NIST AIR-LUSI 2022 campaign fixture',
        sourceDoi: 'https://doi.org/10.18434/mds2-3397',
        sourceHashSha256:
            'ab428b8e91ca02cbcd4f154cb5e524dada87514447bb3384af318d255bb9459a',
        method: 'atan2(norm(cross),dot) spherical separation with shortest east-positive longitude sign',
        toleranceDegrees: ORACLE_TOLERANCE_DEGREES,
        maximumAbsoluteResidualDegrees,
        accepted: maximumAbsoluteResidualDegrees <= ORACLE_TOLERANCE_DEGREES,
        cases: Object.freeze(cases),
    });
}

function validateRequest(request) {
    if (!request || typeof request !== 'object' || Array.isArray(request)) {
        throw configurationError('ER6_HORIZONS_REQUEST_REQUIRED',
            'ER6 Horizons physical state requires a request object.');
    }
    const unknown = Object.keys(request).filter((field) =>
        !['timeIso', 'observer'].includes(field));
    if (unknown.length > 0) {
        throw configurationError('ER6_HORIZONS_REQUEST_FIELD_UNSUPPORTED',
            'ER6 Horizons request contains unsupported fields.', { fields: unknown });
    }
    const timeIso = requireCanonicalIso(request.timeIso);
    const observer = validateObserver(request.observer);
    return Object.freeze({ timeIso, observer });
}

function validateObserver(observer) {
    if (!observer || typeof observer !== 'object' || Array.isArray(observer)) {
        throw configurationError('ER6_HORIZONS_OBSERVER_REQUIRED',
            'ER6 Horizons request requires an observer object.');
    }
    const unknown = Object.keys(observer).filter((field) =>
        !['id', 'latitudeDegrees', 'longitudeDegrees', 'elevationKm'].includes(field));
    if (unknown.length > 0) {
        throw configurationError('ER6_HORIZONS_OBSERVER_FIELD_UNSUPPORTED',
            'ER6 Horizons observer contains unsupported fields.', { fields: unknown });
    }
    if (
        typeof observer.id !== 'string'
        || observer.id.trim() === ''
        || observer.id !== observer.id.trim()
    ) {
        throw configurationError('ER6_HORIZONS_OBSERVER_ID_INVALID',
            'ER6 Horizons observer id must be non-empty without outer whitespace.');
    }
    if (
        !Number.isFinite(observer.latitudeDegrees)
        || observer.latitudeDegrees < -90
        || observer.latitudeDegrees > 90
    ) {
        throw configurationError('ER6_HORIZONS_OBSERVER_LATITUDE_INVALID',
            'ER6 Horizons observer latitude must be finite in [-90, 90] degrees.');
    }
    if (
        !Number.isFinite(observer.longitudeDegrees)
        || observer.longitudeDegrees < -180
        || observer.longitudeDegrees > 180
    ) {
        throw configurationError('ER6_HORIZONS_OBSERVER_LONGITUDE_INVALID',
            'ER6 Horizons observer longitude must be finite in [-180, 180] degrees.');
    }
    if (!Number.isFinite(observer.elevationKm)) {
        throw configurationError('ER6_HORIZONS_OBSERVER_ELEVATION_INVALID',
            'ER6 Horizons observer elevation must be finite in kilometers.');
    }
    return Object.freeze({
        id: observer.id,
        latitudeDegrees: observer.latitudeDegrees,
        longitudeDegrees: observer.longitudeDegrees,
        elevationKm: observer.elevationKm,
    });
}

function requireCanonicalIso(value) {
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
        throw configurationError('ER6_HORIZONS_TIME_INVALID',
            'ER6 Horizons time must be a canonical millisecond ISO UTC timestamp.', { value });
    }
    return value;
}

function singleTableRow(result, kind) {
    if (typeof result !== 'string') {
        throw configurationError('ER6_HORIZONS_TABLE_INVALID',
            'Horizons table result must be text.', { kind });
    }
    const table = result.match(/\$\$SOE\s*([\s\S]*?)\s*\$\$EOE/);
    if (!table) {
        throw configurationError('ER6_HORIZONS_TABLE_MISSING',
            'Horizons table markers are missing.', { kind });
    }
    const rows = table[1].trim().split(/\r?\n/).filter((line) => line.trim() !== '');
    if (rows.length !== 1) {
        throw configurationError('ER6_HORIZONS_TABLE_ROW_COUNT_INVALID',
            'Exact-time Horizons query must return exactly one table row.', {
                kind,
                rowCount: rows.length,
            });
    }
    return rows[0];
}

function parseCalendarDateUt(value) {
    const match = /^(?:A\.D\.\s+)?(\d{4,})-([A-Za-z]{3})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/
        .exec(value);
    if (!match) {
        throw configurationError('ER6_HORIZONS_EPOCH_FORMAT_INVALID',
            'Horizons returned epoch is malformed or unsupported.', { value });
    }
    const [, yearText, monthName, dayText, hourText, minuteText, secondText,
        fractionText = ''] = match;
    const monthIndex = HORIZONS_MONTH_INDEX[monthName.toLowerCase()];
    if (!Number.isInteger(monthIndex) || /[^0]/.test(fractionText.slice(3))) {
        throw configurationError('ER6_HORIZONS_EPOCH_PRECISION_INVALID',
            'Horizons returned epoch month or sub-millisecond precision is unsupported.', {
                value,
            });
    }
    const year = Number(yearText);
    const date = new Date(0);
    date.setUTCFullYear(year, monthIndex, Number(dayText));
    date.setUTCHours(
        Number(hourText),
        Number(minuteText),
        Number(secondText),
        Number(fractionText.padEnd(3, '0').slice(0, 3)),
    );
    if (
        date.getUTCFullYear() !== year
        || date.getUTCMonth() !== monthIndex
        || date.getUTCDate() !== Number(dayText)
        || date.getUTCHours() !== Number(hourText)
        || date.getUTCMinutes() !== Number(minuteText)
        || date.getUTCSeconds() !== Number(secondText)
    ) {
        throw configurationError('ER6_HORIZONS_EPOCH_VALUE_INVALID',
            'Horizons returned epoch is not a valid Gregorian timestamp.', { value });
    }
    return date.toISOString();
}

function requireExactReturnedEpoch(actual, expected, queryKind, target) {
    if (actual !== expected) {
        throw configurationError('ER6_HORIZONS_RETURNED_EPOCH_MISMATCH',
            'Horizons returned epoch must exactly equal the requested UTC.', {
                queryKind,
                target,
                expected,
                actual,
            });
    }
}

function finiteLongitude(value, label) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || Math.abs(numberValue) > 360) {
        throw configurationError('ER6_HORIZONS_LUNAR_LONGITUDE_INVALID',
            'Horizons lunar longitude must be finite within 360 degrees.', {
                label,
                value,
            });
    }
    return numberValue;
}

function finiteLatitude(value, label) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || Math.abs(numberValue) > 90) {
        throw configurationError('ER6_HORIZONS_LUNAR_LATITUDE_INVALID',
            'Horizons lunar latitude must be finite within 90 degrees.', {
                label,
                value,
            });
    }
    return numberValue;
}

function sphericalUnitVector(longitudeDegrees, latitudeDegrees) {
    const longitudeRadians = longitudeDegrees * Math.PI / 180;
    const latitudeRadians = latitudeDegrees * Math.PI / 180;
    const latitudeCosine = Math.cos(latitudeRadians);
    return Object.freeze([
        latitudeCosine * Math.cos(longitudeRadians),
        latitudeCosine * Math.sin(longitudeRadians),
        Math.sin(latitudeRadians),
    ]);
}

function wrapSignedDegrees(value) {
    const wrapped = ((value + 180) % 360 + 360) % 360 - 180;
    return Object.is(wrapped, -0) ? 0 : wrapped;
}

function horizonsTime(timeIso) {
    return timeIso.replace('T', ' ').replace('Z', '');
}

function siteCoordinates(observer) {
    return `'${observer.longitudeDegrees},${observer.latitudeDegrees},${observer.elevationKm}'`;
}

function splitCsv(value) {
    return value.split(',').map((entry) => entry.trim());
}

function bodyState(row, radiusKm) {
    return Object.freeze({
        positionKm: row.positionKm,
        velocityKmPerSecond: row.velocityKmPerSecond,
        radiusKm,
    });
}

function oracleRow(
    flightId,
    timestampUtc,
    expectedSignedPhaseDegrees,
    subobserverLongitudeDegrees,
    subobserverLatitudeDegrees,
    subsolarLongitudeDegrees,
    subsolarLatitudeDegrees,
) {
    return Object.freeze({
        flightId,
        timestampUtc,
        expectedSignedPhaseDegrees,
        subobserverLongitudeDegrees,
        subobserverLatitudeDegrees,
        subsolarLongitudeDegrees,
        subsolarLatitudeDegrees,
    });
}

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

function subtract(left, right) {
    return left.map((value, index) => value - right[index]);
}

function cross(left, right) {
    return [
        left[1] * right[2] - left[2] * right[1],
        left[2] * right[0] - left[0] * right[2],
        left[0] * right[1] - left[1] * right[0],
    ];
}

function dot(left, right) {
    return left.reduce((sum, value, index) => sum + value * right[index], 0);
}

function magnitude(value) {
    return Math.hypot(...value);
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
