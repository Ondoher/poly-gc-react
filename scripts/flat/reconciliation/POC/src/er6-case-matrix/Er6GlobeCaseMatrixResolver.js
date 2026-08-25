// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md,
//   ER6 San Jose/Union Glacier globe validation matrix.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   returned-epoch geometry and physical-source ownership boundaries.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';
import GlobeEphemerisSceneAdapter from '../subjective-scenes/GlobeEphemerisSceneAdapter.js';
import SubjectiveSceneTimeResolver from '../subjective-scenes/SubjectiveSceneTimeResolver.js';
import {
    validateEr6HorizonsPhysicalGlobeStateIntegrity,
} from './Er6HorizonsPhysicalGlobeStateProvider.js';
import {
    FLAT32_SUBJECTIVE_TIME_SNAPSHOT,
} from '../subjective-scenes/consts.js';
import {
    ER6_FLAT32_SCENE_GEOMETRY_FACTS,
    ER6_FLAT32_SCENE_IDENTITY,
} from './er6Flat32PhysicalSceneGeometryConsts.js';

const MILLISECONDS_PER_MINUTE = 60 * 1000;
const METERS_PER_KILOMETER = 1000;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;
const LOCATION_ORDER = Object.freeze([
    'san-jose',
    'union-glacier',
]);
const TIME_SLOTS = Object.freeze([
    Object.freeze({
        id: 'sunrise',
        timePresetKey: 'globe-sunrise',
        hourOffset: 0,
        nativeTimePresetKey: 'globe-sunrise',
    }),
    Object.freeze({
        id: 'solar-noon',
        timePresetKey: 'globe-solar-noon',
        hourOffset: 0,
        nativeTimePresetKey: 'globe-solar-noon',
    }),
    Object.freeze({
        id: 'sunset',
        timePresetKey: 'globe-sunset',
        hourOffset: 0,
        nativeTimePresetKey: 'globe-sunset',
    }),
    Object.freeze({
        id: 'sunset-plus-1',
        timePresetKey: 'globe-sunset',
        hourOffset: 1,
        nativeTimePresetKey: 'globe-sunset',
    }),
]);
const HORIZONS_QUERY_ORDER = Object.freeze([
    Object.freeze({ queryKind: 'vector', target: '301', observer: false }),
    Object.freeze({ queryKind: 'vector', target: '10', observer: false }),
    Object.freeze({ queryKind: 'vector', target: '301', observer: true }),
    Object.freeze({ queryKind: 'vector', target: '10', observer: true }),
    Object.freeze({
        queryKind: 'lunar-aspect-observer',
        target: '301',
        observer: true,
    }),
]);
const MATRIX_REQUEST_FIELDS = Object.freeze([
    'sourceIdentities',
]);
const ATTACHMENT_REQUEST_FIELDS = Object.freeze([
    'matrixCase',
    'ephemerisState',
    'rawQueries',
]);
const PROHIBITED_SOURCE_FIELDS = Object.freeze([
    'albedo',
    'angularDisk',
    'authoredRadius',
    'brightness',
    'calibrationScalar',
    'coverage',
    'displayRgb',
    'displayRgba',
    'displayValue',
    'exposure',
    'gain',
    'neutralAlbedo',
    'opacity',
    'radiusDistanceRatio',
    'sceneRgb',
    'sourceGain',
]);
const EXCLUSIONS = freezeJsonValue({
    oldSceneSurfaces: Object.freeze([
        'Flat32SceneStateResolver syntheticStars',
        'Flat32SceneStateResolver starCalibration',
        'Flat32SceneCelestialProvider',
        'Flat32CpuSoftShaderSceneRenderer radiometry',
    ]),
    prohibitedFacts: Object.freeze([
        'authored-star-angular-disks',
        'neutral-moon-albedo-0.12',
        'source-specific-gains-or-exposure',
        'display-rgb-or-display-values',
        'legacy-coverage-or-opacity-radiometry',
    ]),
    retainedFacts: Object.freeze([
        'bounded-scene-identity',
        'location-owned-date-basis',
        'time-resolver-owned-exact-utc',
        'source-id-kind-fingerprint-only',
        'provider-owned-returned-epoch-state',
        'observer-local-ephemeris-geometry',
    ]),
});

export default class Er6GlobeCaseMatrixResolver {
    constructor() {
        this._timeResolver = new SubjectiveSceneTimeResolver();
        this._ephemerisAdapter = new GlobeEphemerisSceneAdapter();
        this.sceneIdentity = createSceneIdentity();
        this._descriptor = freezeJsonValue({
            kind: 'er6-globe-case-matrix-resolver-v1',
            caseCount: LOCATION_ORDER.length * TIME_SLOTS.length,
            locationOrder: LOCATION_ORDER,
            timeSlots: TIME_SLOTS.map((slot) => Object.freeze({
                id: slot.id,
                sanJoseTimePresetKey: slot.timePresetKey,
                sanJoseHourOffset: slot.hourOffset,
                unionNativeTimePresetKey: slot.nativeTimePresetKey,
            })),
            sceneIdentity: this.sceneIdentity,
            timeSnapshot: Object.freeze({
                id: FLAT32_SUBJECTIVE_TIME_SNAPSHOT.id,
                sourceRevision: FLAT32_SUBJECTIVE_TIME_SNAPSHOT.sourceRevision,
            }),
            timePolicy:
                'derive San Jose events through SubjectiveSceneTimeResolver; apply their signed millisecond offsets around Union Glacier resolver-owned solar noon',
            ephemerisPolicy:
                'acquire one provider-owned exact-time state per case and reject any requested/returned epoch mismatch',
            ephemerisAttachmentContract: Object.freeze({
                provider: 'Er6HorizonsPhysicalGlobeStateProvider',
                queryCount: HORIZONS_QUERY_ORDER.length,
                queryOrder: HORIZONS_QUERY_ORDER,
                lunarAspectFrame: 'MOON_ME',
                lunarLongitudeConvention: 'east-positive',
                lunarAspectIdentity: 'retain-the-provider-owned-object',
            }),
            exclusions: EXCLUSIONS,
        });
        this.fingerprint = stableHash(this._descriptor);
        Object.freeze(this);
    }

    /**
     * Describe the reset-only case-matrix view and its ownership boundaries.
     *
     * @returns {Readonly<Record<string, unknown>>} Immutable resolver descriptor.
     */
    describe() {
        return Object.freeze({
            ...this._descriptor,
            fingerprint: this.fingerprint,
        });
    }

    /**
     * Resolve one native location event through the existing time owner.
     *
     * @param {string} locationKey - Canonical Flat32 location key.
     * @param {Readonly<Record<string, unknown>>} slot - ER6 event slot.
     * @returns {SubjectiveSceneTimeResolution} Existing resolver-owned time packet.
     */
    _resolveNativeTime(locationKey, slot) {
        return this._timeResolver.resolve({
            locationKey,
            timeBasis: 'globe',
            timePresetKey: slot.timePresetKey,
            hourOffset: slot.hourOffset,
        });
    }

    /**
     * Resolve one native event-availability probe without applying ER6 offsets.
     *
     * @param {string} locationKey - Canonical Flat32 location key.
     * @param {Readonly<Record<string, unknown>>} slot - ER6 event slot.
     * @returns {SubjectiveSceneTimeResolution} Native availability packet.
     */
    _resolveNativeAvailability(locationKey, slot) {
        return this._timeResolver.resolve({
            locationKey,
            timeBasis: 'globe',
            timePresetKey: slot.nativeTimePresetKey,
        });
    }

    /**
     * Create one immutable matrix case from resolver-owned time and location facts.
     *
     * @param {Readonly<Record<string, unknown>>} values - Derived case inputs.
     * @returns {Er6GlobeCaseDefinition} Immutable case and acquisition request.
     */
    _createCase(values) {
        const observer = Object.freeze({
            id: values.timeResolution.location.key,
            latitudeDegrees: values.timeResolution.location.latitude,
            longitudeDegrees: values.timeResolution.location.longitude,
            elevationKm: this.sceneIdentity.observerElevationKm,
        });
        const schedule = Object.freeze({
            policy: values.locationKey === 'san-jose'
                ? 'san-jose-native-authored-globe-event'
                : 'union-authored-date-plus-derived-san-jose-event-offset',
            referenceLocationKey: 'san-jose',
            referenceExactTimeIso: values.sanJoseTime.finalTimeIso,
            referenceSolarNoonIso: values.sanJoseSolarNoon.finalTimeIso,
            signedOffsetMilliseconds: values.signedOffsetMilliseconds,
            nativeEventTimeIso: values.nativeAvailability.finalTimeIso,
            nativeEventAvailability: values.nativeAvailability.eventAvailability,
        });
        const core = Object.freeze({
            kind: 'er6-globe-case-v1',
            resolverFingerprint: this.fingerprint,
            id: `${values.locationKey}-globe-${values.slot.id}`,
            ordinal: values.ordinal,
            eventId: values.slot.id,
            sceneIdentity: this.sceneIdentity,
            sourceIdentities: values.sourceIdentities,
            location: values.timeResolution.location,
            exactTimeIso: values.timeResolution.finalTimeIso,
            timeResolution: values.timeResolution,
            schedule,
            observer,
            ephemerisRequest: Object.freeze({
                timeIso: values.timeResolution.finalTimeIso,
                observer,
            }),
            exclusions: EXCLUSIONS,
        });
        return Object.freeze({
            ...core,
            fingerprint: stableHash(caseFingerprintPayload(core)),
        });
    }

    /**
     * Resolve the exact eight ER6 cases without acquiring ephemeris or radiometry.
     *
     * @param {Er6GlobeCaseMatrixRequest} request - Canonical physical source identities.
     * @returns {Er6GlobeCaseMatrix} Deterministic schedule and Horizons requests.
     */
    resolveCaseMatrix(request) {
        requirePlainObject(request, 'ER6_CASE_MATRIX_REQUEST_REQUIRED',
            'ER6 globe case-matrix resolution requires a request object.');
        rejectUnknownFields(request, MATRIX_REQUEST_FIELDS, 'case-matrix request');
        const sourceIdentities = normalizeSourceIdentities(request.sourceIdentities);
        const sanJoseTimes = new Map(TIME_SLOTS.map((slot) =>
            [slot.id, this._resolveNativeTime('san-jose', slot)]));
        const sanJoseSolarNoon = sanJoseTimes.get('solar-noon');
        const unionSolarNoon = this._resolveNativeAvailability(
            'union-glacier',
            TIME_SLOTS.find((slot) => slot.id === 'solar-noon'),
        );
        const cases = [];

        for (const locationKey of LOCATION_ORDER) {
            for (const slot of TIME_SLOTS) {
                const sanJoseTime = sanJoseTimes.get(slot.id);
                const signedOffsetMilliseconds = parseIso(sanJoseTime.finalTimeIso)
                    - parseIso(sanJoseSolarNoon.finalTimeIso);
                const nativeAvailability = this._resolveNativeAvailability(locationKey, slot);
                const timeResolution = locationKey === 'san-jose'
                    ? sanJoseTime
                    : this._timeResolver.resolve({
                        locationKey,
                        timeBasis: 'globe',
                        timePresetKey: 'globe-solar-noon',
                        minuteOffset: signedOffsetMilliseconds / MILLISECONDS_PER_MINUTE,
                    });
                if (locationKey === 'union-glacier') {
                    const expectedUnionTime = new Date(
                        parseIso(unionSolarNoon.finalTimeIso) + signedOffsetMilliseconds,
                    ).toISOString();
                    if (timeResolution.finalTimeIso !== expectedUnionTime) {
                        throw configurationError('ER6_CASE_MATRIX_UNION_OFFSET_DRIFT',
                            'Union Glacier exact time drifted from the derived San Jose offset.', {
                                slotId: slot.id,
                                expectedUnionTime,
                                actualUnionTime: timeResolution.finalTimeIso,
                            });
                    }
                }
                cases.push(this._createCase({
                    locationKey,
                    slot,
                    ordinal: cases.length,
                    timeResolution,
                    nativeAvailability,
                    sanJoseTime,
                    sanJoseSolarNoon,
                    signedOffsetMilliseconds,
                    sourceIdentities,
                }));
            }
        }

        validateUniqueCaseIds(cases);
        const matrixFingerprint = stableHash({
            resolverFingerprint: this.fingerprint,
            sceneIdentity: this.sceneIdentity,
            sourceIdentities,
            caseFingerprints: cases.map((entry) => entry.fingerprint),
        });
        return Object.freeze({
            kind: 'er6-globe-case-matrix-v1',
            resolverFingerprint: this.fingerprint,
            fingerprint: matrixFingerprint,
            sceneIdentity: this.sceneIdentity,
            sourceIdentities,
            locationOrder: LOCATION_ORDER,
            timeSlotOrder: Object.freeze(TIME_SLOTS.map((slot) => slot.id)),
            caseCount: cases.length,
            cases: Object.freeze(cases),
            exclusions: EXCLUSIONS,
        });
    }

    /**
     * Validate and attach one provider-owned returned-epoch state to a matrix case.
     *
     * @param {Er6ReturnedEphemerisAttachmentRequest} request - Case, state, and raw Horizons queries.
     * @returns {Er6GlobeCaseWithEphemeris} Exact returned-epoch geometry attachment.
     */
    attachReturnedEphemeris(request) {
        requirePlainObject(request, 'ER6_CASE_MATRIX_EPHEMERIS_REQUEST_REQUIRED',
            'ER6 returned-epoch attachment requires a request object.');
        rejectUnknownFields(request, ATTACHMENT_REQUEST_FIELDS, 'ephemeris attachment request');
        const matrixCase = validateMatrixCase(request.matrixCase, this.fingerprint);
        const ephemerisState = validateEphemerisState(
            request.ephemerisState,
            matrixCase,
        );
        const queryIdentities = validateRawQueries(
            request.rawQueries,
            matrixCase,
            ephemerisState,
        );
        const sceneGeometry = this._ephemerisAdapter.resolve({ ephemerisState });
        if (
            sceneGeometry.epochIso !== matrixCase.exactTimeIso
            || sceneGeometry.observerId !== matrixCase.observer.id
        ) {
            throw configurationError('ER6_CASE_MATRIX_ADAPTED_EPOCH_MISMATCH',
                'Observer-local scene geometry must retain the exact returned epoch and observer.');
        }
        const returnedEpoch = freezeJsonValue({
            requestedEpochIso: matrixCase.exactTimeIso,
            worldStateEpochIso: ephemerisState.worldState.epochIso,
            queryReturnedEpochs: queryIdentities.map((entry) => entry.returnedEpochIso),
            queryHashes: queryIdentities.map((entry) => entry.queryHash),
        });
        const fingerprint = stableHash({
            resolverFingerprint: this.fingerprint,
            caseFingerprint: matrixCase.fingerprint,
            returnedEpoch,
            lunarAspect: ephemerisState.lunarAspect,
            sceneGeometry,
        });

        return Object.freeze({
            kind: 'er6-globe-case-with-ephemeris-v1',
            fingerprint,
            matrixCase,
            ephemerisState,
            lunarAspect: ephemerisState.lunarAspect,
            sceneGeometry,
            returnedEpoch,
            queryIdentities,
            ownership: Object.freeze({
                ephemerisStateOwner: 'Er6HorizonsPhysicalGlobeStateProvider',
                sameEphemerisStateObject: true,
                sameLunarAspectObject: true,
                sceneGeometryOwner: 'GlobeEphemerisSceneAdapter',
                caseMatrixOwner: 'Er6GlobeCaseMatrixResolver',
                radiometryOwner: 'outside-this-adapter',
            }),
            exclusions: EXCLUSIONS,
        });
    }
}

function createSceneIdentity() {
    const observerElevationKm = ER6_FLAT32_SCENE_GEOMETRY_FACTS
        .camera.positionSceneUnits[1]
        * ER6_FLAT32_SCENE_GEOMETRY_FACTS.units.metersPerSceneUnit
        / METERS_PER_KILOMETER;
    if (!Number.isFinite(observerElevationKm) || observerElevationKm < 0) {
        throw configurationError('ER6_CASE_MATRIX_OBSERVER_ELEVATION_INVALID',
            'Flat32 scene snapshot must provide a finite nonnegative observer elevation.');
    }
    return freezeJsonValue({
        ...ER6_FLAT32_SCENE_IDENTITY,
        observerElevationKm,
    });
}

function normalizeSourceIdentities(values) {
    if (!Array.isArray(values) || values.length === 0) {
        throw configurationError('ER6_CASE_MATRIX_SOURCE_IDENTITIES_REQUIRED',
            'ER6 case matrix requires at least one canonical physical source identity.');
    }
    const ids = new Set();
    const normalized = values.map((value, index) => {
        requirePlainObject(value, 'ER6_CASE_MATRIX_SOURCE_IDENTITY_INVALID',
            'Every ER6 source identity must be an object.', { index });
        const prohibited = PROHIBITED_SOURCE_FIELDS.filter((field) => Object.hasOwn(value, field));
        if (prohibited.length > 0) {
            throw configurationError('ER6_CASE_MATRIX_SOURCE_RADIOMETRY_PROHIBITED',
                'ER6 case-matrix source inputs may carry identity only, not legacy radiometry or display facts.', {
                    index,
                    fields: prohibited,
                });
        }
        const id = requireIdentifier(value.id, `source identity at index ${index}`);
        if (ids.has(id)) {
            throw configurationError('ER6_CASE_MATRIX_DUPLICATE_SOURCE_ID',
                'ER6 source identity ids must be unique.', { id });
        }
        ids.add(id);
        if (value.kind !== 'point' && value.kind !== 'extended') {
            throw configurationError('ER6_CASE_MATRIX_SOURCE_KIND_INVALID',
                'ER6 physical source identity kind must be point or extended.', {
                    id,
                    kind: value.kind,
                });
        }
        if (!FINGERPRINT_PATTERN.test(value.fingerprint ?? '')) {
            throw configurationError('ER6_CASE_MATRIX_SOURCE_FINGERPRINT_INVALID',
                'ER6 source identity requires a SHA-256 fingerprint.', { id });
        }
        return Object.freeze({
            id,
            kind: value.kind,
            fingerprint: value.fingerprint.toLowerCase(),
        });
    });
    normalized.sort((left, right) => compareIds(left.id, right.id));
    return Object.freeze(normalized);
}

function validateMatrixCase(value, resolverFingerprint) {
    requirePlainObject(value, 'ER6_CASE_MATRIX_CASE_REQUIRED',
        'Returned-epoch attachment requires a matrix case.');
    if (
        value.kind !== 'er6-globe-case-v1'
        || value.resolverFingerprint !== resolverFingerprint
        || !FINGERPRINT_PATTERN.test(value.fingerprint ?? '')
        || value.fingerprint !== stableHash(caseFingerprintPayload(value))
    ) {
        throw configurationError('ER6_CASE_MATRIX_CASE_INVALID',
            'Returned-epoch attachment requires an untampered case from this resolver.');
    }
    return value;
}

function validateEphemerisState(value, matrixCase) {
    requirePlainObject(value, 'ER6_CASE_MATRIX_EPHEMERIS_STATE_REQUIRED',
        'Returned-epoch attachment requires a provider-owned ephemeris state.');
    requirePlainObject(value.worldState, 'ER6_CASE_MATRIX_WORLD_STATE_REQUIRED',
        'Returned-epoch attachment requires worldState.');
    requirePlainObject(value.observerState, 'ER6_CASE_MATRIX_OBSERVER_STATE_REQUIRED',
        'Returned-epoch attachment requires observerState.');
    requirePlainObject(value.lunarAspect, 'ER6_CASE_MATRIX_LUNAR_ASPECT_REQUIRED',
        'Returned-epoch attachment requires provider-owned lunarAspect.');
    try {
        validateEr6HorizonsPhysicalGlobeStateIntegrity(value);
    } catch (error) {
        throw configurationError('ER6_CASE_MATRIX_PHYSICAL_STATE_INVALID',
            'Returned-epoch attachment requires the untampered ER6 physical Horizons state schema.', {
                cause: error instanceof Error ? error.message : String(error),
            });
    }
    if (value.worldState.epochIso !== matrixCase.exactTimeIso) {
        throw configurationError('ER6_CASE_MATRIX_WORLD_EPOCH_MISMATCH',
            'Horizons world-state returned epoch must equal the exact case UTC.', {
                expected: matrixCase.exactTimeIso,
                actual: value.worldState.epochIso,
            });
    }
    if (
        value.lunarAspect.epochIso !== matrixCase.exactTimeIso
        || value.lunarAspect.frame !== 'MOON_ME'
        || value.lunarAspect.longitudeConvention !== 'east-positive'
        || !Number.isFinite(value.lunarAspect.signedPhaseDegrees)
    ) {
        throw configurationError('ER6_CASE_MATRIX_LUNAR_ASPECT_INVALID',
            'Provider-owned lunar aspect must retain exact UTC, MOON_ME east-positive frame, signed phase, and fingerprint.');
    }
    const observer = value.observerState;
    const expected = matrixCase.observer;
    if (
        observer.id !== expected.id
        || observer.latitudeDegrees !== expected.latitudeDegrees
        || observer.longitudeDegrees !== expected.longitudeDegrees
        || observer.elevationKm !== expected.elevationKm
    ) {
        throw configurationError('ER6_CASE_MATRIX_OBSERVER_MISMATCH',
            'Horizons observer state must equal the case-owned location and elevation.', {
                expected,
                actual: Object.freeze({
                    id: observer.id,
                    latitudeDegrees: observer.latitudeDegrees,
                    longitudeDegrees: observer.longitudeDegrees,
                    elevationKm: observer.elevationKm,
                }),
            });
    }
    return value;
}

function validateRawQueries(values, matrixCase, ephemerisState) {
    if (!Array.isArray(values) || values.length !== HORIZONS_QUERY_ORDER.length) {
        throw configurationError('ER6_CASE_MATRIX_RAW_QUERY_COUNT_INVALID',
            'Every ER6 case requires exactly five Horizons query results.', {
                expected: HORIZONS_QUERY_ORDER.length,
                actual: Array.isArray(values) ? values.length : null,
            });
    }
    const identities = values.map((query, index) => {
        requirePlainObject(query, 'ER6_CASE_MATRIX_RAW_QUERY_INVALID',
            'Every Horizons query result must be an object.', { index });
        const expected = HORIZONS_QUERY_ORDER[index];
        const expectedObserverId = expected.observer ? matrixCase.observer.id : null;
        if (
            query.queryKind !== expected.queryKind
            || query.target !== expected.target
            || query.observerId !== expectedObserverId
            || query.requestedEpochIso !== matrixCase.exactTimeIso
            || query.returnedEpochIso !== matrixCase.exactTimeIso
        ) {
            throw configurationError('ER6_CASE_MATRIX_RAW_QUERY_EPOCH_MISMATCH',
                'Horizons query target, observer, requested epoch, and returned epoch must match the case.', {
                    index,
                    expected: Object.freeze({
                        queryKind: expected.queryKind,
                        target: expected.target,
                        observerId: expectedObserverId,
                        epochIso: matrixCase.exactTimeIso,
                    }),
                    actual: Object.freeze({
                        queryKind: query.queryKind,
                        target: query.target,
                        observerId: query.observerId,
                        requestedEpochIso: query.requestedEpochIso,
                        returnedEpochIso: query.returnedEpochIso,
                    }),
                });
        }
        const julianDateValid = expected.queryKind === 'vector'
            ? Number.isFinite(query.returnedEpochJulianDateUt)
            : query.returnedEpochJulianDateUt === null;
        const lunarAspectIdentityValid = expected.queryKind === 'lunar-aspect-observer'
            ? query.lunarAspectFingerprint === ephemerisState.lunarAspect.fingerprint
            : query.lunarAspectFingerprint === undefined;
        if (
            !julianDateValid
            || !lunarAspectIdentityValid
            || typeof query.returnedEpochCalendarDateUt !== 'string'
            || query.returnedEpochCalendarDateUt.trim() === ''
            || !FINGERPRINT_PATTERN.test(query.queryHash ?? '')
            || typeof query.apiVersion !== 'string'
            || query.apiVersion.trim() === ''
        ) {
            throw configurationError('ER6_CASE_MATRIX_RAW_QUERY_PROVENANCE_INVALID',
                'Horizons query result requires returned-epoch and versioned query provenance.', {
                    index,
                });
        }
        return Object.freeze({
            queryKind: query.queryKind,
            target: query.target,
            observerId: query.observerId,
            requestedEpochIso: query.requestedEpochIso,
            returnedEpochIso: query.returnedEpochIso,
            returnedEpochJulianDateUt: query.returnedEpochJulianDateUt,
            returnedEpochCalendarDateUt: query.returnedEpochCalendarDateUt,
            lunarAspectFingerprint: query.lunarAspectFingerprint ?? null,
            queryHash: query.queryHash.toLowerCase(),
            apiVersion: query.apiVersion,
        });
    });
    const expectedHashes = identities.map((entry) => entry.queryHash);
    const provenanceHashes = ephemerisState.provenance?.queryHashes
        ?? ephemerisState.worldState.provenance?.queryHashes;
    if (
        !Array.isArray(provenanceHashes)
        || provenanceHashes.length !== expectedHashes.length
        || provenanceHashes.some((hash, index) => hash !== expectedHashes[index])
    ) {
        throw configurationError('ER6_CASE_MATRIX_QUERY_HASH_OWNERSHIP_MISMATCH',
            'Provider-owned ephemeris provenance must retain the exact five raw query hashes.');
    }
    const sourceVersion = ephemerisState.provenance?.sourceVersion
        ?? ephemerisState.worldState.provenance?.sourceVersion;
    if (
        typeof sourceVersion !== 'string'
        || sourceVersion.trim() === ''
        || identities.some((entry) => entry.apiVersion !== sourceVersion)
    ) {
        throw configurationError('ER6_CASE_MATRIX_API_VERSION_MISMATCH',
            'Every raw query API version must equal the provider-owned state version.');
    }
    return Object.freeze(identities);
}

function caseFingerprintPayload(value) {
    return Object.freeze({
        kind: value.kind,
        resolverFingerprint: value.resolverFingerprint,
        id: value.id,
        ordinal: value.ordinal,
        eventId: value.eventId,
        sceneIdentity: value.sceneIdentity,
        sourceIdentities: value.sourceIdentities,
        location: value.location,
        exactTimeIso: value.exactTimeIso,
        timeResolution: value.timeResolution,
        schedule: value.schedule,
        observer: value.observer,
        ephemerisRequest: value.ephemerisRequest,
        exclusions: value.exclusions,
    });
}

function validateUniqueCaseIds(cases) {
    const ids = new Set();
    for (const matrixCase of cases) {
        if (ids.has(matrixCase.id)) {
            throw configurationError('ER6_CASE_MATRIX_DUPLICATE_CASE_ID',
                'ER6 case ids must be unique.', { id: matrixCase.id });
        }
        ids.add(matrixCase.id);
    }
}

function requireIdentifier(value, context) {
    if (typeof value !== 'string' || value.trim() === '' || value !== value.trim()) {
        throw configurationError('ER6_CASE_MATRIX_ID_INVALID',
            'ER6 case-matrix ids must be non-empty strings without outer whitespace.', {
                context,
                value,
            });
    }
    return value;
}

function parseIso(value) {
    const milliseconds = Date.parse(value);
    if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
        throw configurationError('ER6_CASE_MATRIX_TIME_INVALID',
            'ER6 case times must be canonical ISO UTC timestamps.', { value });
    }
    return milliseconds;
}

function requirePlainObject(value, code, message, details = null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw configurationError(code, message, details);
    }
}

function rejectUnknownFields(value, allowedFields, context) {
    const unknown = Object.keys(value).filter((field) => !allowedFields.includes(field));
    if (unknown.length > 0) {
        throw configurationError('ER6_CASE_MATRIX_FIELD_UNSUPPORTED',
            'ER6 case-matrix request contains unsupported fields.', {
                context,
                fields: unknown,
            });
    }
}

function compareIds(left, right) {
    if (left < right) {
        return -1;
    }
    if (left > right) {
        return 1;
    }
    return 0;
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
