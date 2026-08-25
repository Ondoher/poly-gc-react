// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md,
//   ER6 exact returned-epoch San Jose/Union Glacier state matrix.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   ephemeris ownership, provenance, and legacy-radiometry exclusions.

import { createHash } from 'node:crypto';
import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { stableHash } from '../provenance/stableHash.js';
import Er6GlobeCaseMatrixResolver from './Er6GlobeCaseMatrixResolver.js';
import Er6HorizonsPhysicalGlobeStateProvider from './Er6HorizonsPhysicalGlobeStateProvider.js';

const REQUIRED_CASE_COUNT = 8;
const REQUIRED_QUERY_COUNT_PER_CASE = 5;
const ACQUISITION_REQUEST_FIELDS = Object.freeze(['caseMatrix']);
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;

export default class Er6PhysicalGlobeStateMatrixAcquirer {
    /**
     * Create a single-use sequential ER6 physical-state matrix acquirer.
     *
     * @param {Er6PhysicalGlobeStateMatrixAcquirerConfiguration} configuration -
     * Resolver and optional fresh-provider factory.
     */
    constructor({
        caseMatrixResolver,
        providerFactory = () => new Er6HorizonsPhysicalGlobeStateProvider(),
    } = {}) {
        if (!(caseMatrixResolver instanceof Er6GlobeCaseMatrixResolver)) {
            throw configurationError('ER6_STATE_MATRIX_RESOLVER_INVALID',
                'ER6 physical-state acquisition requires an Er6GlobeCaseMatrixResolver.');
        }
        if (typeof providerFactory !== 'function') {
            throw configurationError('ER6_STATE_MATRIX_PROVIDER_FACTORY_INVALID',
                'ER6 physical-state acquisition requires a provider factory function.');
        }
        this.caseMatrixResolver = caseMatrixResolver;
        this.providerFactory = providerFactory;
        this._started = false;
        this._descriptor = Object.freeze({
            kind: 'er6-physical-globe-state-matrix-acquirer-v1',
            resolverFingerprint: caseMatrixResolver.fingerprint,
            singleUse: true,
            requiredCaseCount: REQUIRED_CASE_COUNT,
            acquisitionOrder: 'sequential-ascending-case-ordinal',
            providerPolicy:
                'one fresh single-use Er6HorizonsPhysicalGlobeStateProvider per case',
            requiredQueryCountPerCase: REQUIRED_QUERY_COUNT_PER_CASE,
            rawProvenancePolicy:
                'retain each provider-owned raw payload, URL hash, API identity, '
                + 'and exact returned epoch',
            observerDiagnosticPolicy:
                'independently reconstruct the observer from Moon and Sun '
                + 'geocentric-minus-topocentric vectors',
            radiometryPolicy:
                'do not acquire or copy source radiometry, scene brightness, '
                + 'coverage, exposure, or display values',
        });
        this.fingerprint = stableHash(this._descriptor);
    }

    /**
     * Describe the exact sequential acquisition and provenance contract.
     *
     * @returns {Readonly<Record<string, unknown>>} Immutable acquirer descriptor.
     */
    describe() {
        return Object.freeze({
            ...this._descriptor,
            fingerprint: this.fingerprint,
        });
    }

    /**
     * Acquire and attach all eight resolver-owned cases in exact ordinal order.
     *
     * @param {Er6PhysicalGlobeStateMatrixAcquisitionRequest} request - Untampered resolver matrix.
     * @returns {Promise<Er6PhysicalGlobeStateMatrixAcquisition>} Immutable
     * forty-query acquisition matrix.
     */
    async acquire(request) {
        if (this._started) {
            throw configurationError('ER6_STATE_MATRIX_ACQUIRER_REUSE_PROHIBITED',
                'Use a fresh ER6 physical-state matrix acquirer for every acquisition attempt.');
        }
        const caseMatrix = validateAcquisitionRequest(
            request,
            this.caseMatrixResolver,
        );
        this._started = true;

        const providers = new Set();
        const caseIds = new Set();
        const caseFingerprints = new Set();
        const queryIdentities = new Set();
        const queryHashes = new Set();
        const payloadHashes = new Set();
        const queryUrls = new Set();
        const acquisitions = [];

        for (let ordinal = 0; ordinal < caseMatrix.cases.length; ordinal += 1) {
            const matrixCase = caseMatrix.cases[ordinal];
            requireUniqueCaseIdentity(
                matrixCase,
                ordinal,
                caseIds,
                caseFingerprints,
            );
            const provider = this.providerFactory(matrixCase);
            validateFreshProvider(provider, matrixCase, providers);
            providers.add(provider);

            const physicalState = await provider.resolve(matrixCase.ephemerisRequest);
            const rawQueries = validateCompletedProvider(
                provider,
                matrixCase,
            );
            const ephemerisAttachment = this.caseMatrixResolver.attachReturnedEphemeris({
                matrixCase,
                ephemerisState: physicalState,
                rawQueries,
            });
            validateAttachmentIdentity(
                ephemerisAttachment,
                matrixCase,
                physicalState,
                rawQueries,
            );

            const queryArtifacts = createQueryArtifacts({
                matrixCase,
                rawQueries,
                queryIdentities,
                queryHashes,
                payloadHashes,
                queryUrls,
            });
            const observerReconstruction = createObserverReconstructionDiagnostic(
                matrixCase,
                physicalState,
            );
            const acquisitionCore = Object.freeze({
                kind: 'er6-physical-globe-state-case-acquisition-v1',
                caseId: matrixCase.id,
                caseOrdinal: matrixCase.ordinal,
                matrixCase,
                physicalState,
                rawQueries,
                queryArtifacts,
                ephemerisAttachment,
                observerReconstruction,
                ownership: Object.freeze({
                    caseOwner: 'Er6GlobeCaseMatrixResolver',
                    physicalStateOwner: 'Er6HorizonsPhysicalGlobeStateProvider',
                    rawQueryOwner: 'Er6HorizonsPhysicalGlobeStateProvider.rawQueries',
                    attachmentOwner: 'Er6GlobeCaseMatrixResolver.attachReturnedEphemeris',
                    radiometryOwner: 'outside-this-acquirer',
                }),
            });
            acquisitions.push(Object.freeze({
                ...acquisitionCore,
                fingerprint: stableHash(caseAcquisitionFingerprintPayload(
                    acquisitionCore,
                )),
            }));
        }

        if (
            acquisitions.length !== REQUIRED_CASE_COUNT
            || queryHashes.size
                !== REQUIRED_CASE_COUNT * REQUIRED_QUERY_COUNT_PER_CASE
        ) {
            throw configurationError('ER6_STATE_MATRIX_ACQUISITION_CARDINALITY_INVALID',
                'ER6 physical-state acquisition must complete eight cases and '
                + 'forty unique queries.', {
                    acquiredCaseCount: acquisitions.length,
                    uniqueQueryCount: queryHashes.size,
                });
        }
        const frozenAcquisitions = Object.freeze(acquisitions);
        const observerReconstructionDiagnostics = summarizeObserverDiagnostics(
            frozenAcquisitions,
        );
        const matrixCore = Object.freeze({
            kind: 'er6-physical-globe-state-matrix-acquisition-v1',
            schemaVersion: 1,
            acquirerFingerprint: this.fingerprint,
            resolverFingerprint: this.caseMatrixResolver.fingerprint,
            caseMatrix,
            caseCount: REQUIRED_CASE_COUNT,
            queryCountPerCase: REQUIRED_QUERY_COUNT_PER_CASE,
            totalQueryCount: REQUIRED_CASE_COUNT * REQUIRED_QUERY_COUNT_PER_CASE,
            cases: frozenAcquisitions,
            observerReconstructionDiagnostics,
            ownership: Object.freeze({
                scheduleAndCases: 'Er6GlobeCaseMatrixResolver',
                physicalStatesAndRawPayloads:
                    'one fresh Er6HorizonsPhysicalGlobeStateProvider per case',
                returnedEpochAttachments: 'Er6GlobeCaseMatrixResolver',
                radiometryAndDisplay: 'excluded',
            }),
        });
        return Object.freeze({
            ...matrixCore,
            fingerprint: stableHash(matrixAcquisitionFingerprintPayload(matrixCore)),
        });
    }
}

function validateAcquisitionRequest(request, resolver) {
    requirePlainObject(request, 'ER6_STATE_MATRIX_ACQUISITION_REQUEST_REQUIRED',
        'ER6 physical-state acquisition requires a request object.');
    rejectUnknownFields(request, ACQUISITION_REQUEST_FIELDS, 'acquisition request');
    const caseMatrix = request.caseMatrix;
    requirePlainObject(caseMatrix, 'ER6_STATE_MATRIX_CASE_MATRIX_REQUIRED',
        'ER6 physical-state acquisition requires a resolved case matrix.');
    if (
        caseMatrix.kind !== 'er6-globe-case-matrix-v1'
        || caseMatrix.resolverFingerprint !== resolver.fingerprint
        || caseMatrix.caseCount !== REQUIRED_CASE_COUNT
        || !Array.isArray(caseMatrix.cases)
        || caseMatrix.cases.length !== REQUIRED_CASE_COUNT
        || !FINGERPRINT_PATTERN.test(caseMatrix.fingerprint ?? '')
    ) {
        throw configurationError('ER6_STATE_MATRIX_CASE_MATRIX_INVALID',
            'ER6 acquisition requires the resolver-owned exact eight-case matrix.');
    }

    let canonicalMatrix;
    let actualHash;
    let canonicalHash;
    try {
        canonicalMatrix = resolver.resolveCaseMatrix({
            sourceIdentities: caseMatrix.sourceIdentities,
        });
        actualHash = stableHash(caseMatrix);
        canonicalHash = stableHash(canonicalMatrix);
    } catch (error) {
        throw configurationError('ER6_STATE_MATRIX_CASE_MATRIX_INTEGRITY_INVALID',
            'ER6 acquisition could not reconstruct the canonical resolver matrix.', {
                cause: error instanceof Error ? error.message : String(error),
            });
    }
    if (
        caseMatrix.fingerprint !== canonicalMatrix.fingerprint
        || actualHash !== canonicalHash
    ) {
        throw configurationError('ER6_STATE_MATRIX_CASE_MATRIX_STALE_OR_TAMPERED',
            'ER6 acquisition rejects stale, copied-with-drift, or tampered matrix cases.', {
                expectedFingerprint: canonicalMatrix.fingerprint,
                actualFingerprint: caseMatrix.fingerprint,
            });
    }
    return caseMatrix;
}

function requireUniqueCaseIdentity(matrixCase, ordinal, ids, fingerprints) {
    if (
        matrixCase.ordinal !== ordinal
        || typeof matrixCase.id !== 'string'
        || matrixCase.id.trim() === ''
        || !FINGERPRINT_PATTERN.test(matrixCase.fingerprint ?? '')
    ) {
        throw configurationError('ER6_STATE_MATRIX_CASE_ORDER_INVALID',
            'ER6 cases must be acquired sequentially in exact ascending ordinal order.', {
                expectedOrdinal: ordinal,
                actualOrdinal: matrixCase.ordinal,
                caseId: matrixCase.id ?? null,
            });
    }
    if (ids.has(matrixCase.id) || fingerprints.has(matrixCase.fingerprint)) {
        throw configurationError('ER6_STATE_MATRIX_DUPLICATE_CASE_IDENTITY',
            'ER6 case ids and fingerprints must be unique.', {
                caseId: matrixCase.id,
                caseFingerprint: matrixCase.fingerprint,
            });
    }
    ids.add(matrixCase.id);
    fingerprints.add(matrixCase.fingerprint);
}

function validateFreshProvider(provider, matrixCase, providers) {
    if (!(provider instanceof Er6HorizonsPhysicalGlobeStateProvider)) {
        throw configurationError('ER6_STATE_MATRIX_PROVIDER_INVALID',
            'The provider factory must return an Er6HorizonsPhysicalGlobeStateProvider.', {
                caseId: matrixCase.id,
            });
    }
    if (
        providers.has(provider)
        || provider._started !== false
        || !Array.isArray(provider.rawQueries)
        || provider.rawQueries.length !== 0
    ) {
        throw configurationError('ER6_STATE_MATRIX_PROVIDER_NOT_FRESH',
            'Every ER6 case requires a distinct unused provider with no retained queries.', {
                caseId: matrixCase.id,
            });
    }
}

function validateCompletedProvider(provider, matrixCase) {
    const rawQueries = provider.rawQueries;
    if (
        provider._started !== true
        || !Array.isArray(rawQueries)
        || rawQueries.length !== REQUIRED_QUERY_COUNT_PER_CASE
        || !Object.isFrozen(rawQueries)
    ) {
        throw configurationError('ER6_STATE_MATRIX_PROVIDER_QUERY_COUNT_INVALID',
            'Every completed ER6 provider must retain exactly five immutable raw queries.', {
                caseId: matrixCase.id,
                actualQueryCount: Array.isArray(rawQueries) ? rawQueries.length : null,
            });
    }
    return rawQueries;
}

function validateAttachmentIdentity(attachment, matrixCase, physicalState, rawQueries) {
    if (
        attachment.matrixCase !== matrixCase
        || attachment.ephemerisState !== physicalState
        || attachment.lunarAspect !== physicalState.lunarAspect
        || attachment.returnedEpoch.requestedEpochIso !== matrixCase.exactTimeIso
        || !Array.isArray(attachment.queryIdentities)
        || attachment.queryIdentities.length !== rawQueries.length
    ) {
        throw configurationError('ER6_STATE_MATRIX_ATTACHMENT_IDENTITY_INVALID',
            'ER6 returned-epoch attachment must retain the exact case and '
            + 'provider-owned state identities.', {
                caseId: matrixCase.id,
            });
    }
}

function createQueryArtifacts({
    matrixCase,
    rawQueries,
    queryIdentities,
    queryHashes,
    payloadHashes,
    queryUrls,
}) {
    const artifacts = rawQueries.map((rawQuery, queryOrdinal) => {
        requirePlainObject(rawQuery, 'ER6_STATE_MATRIX_RAW_QUERY_INVALID',
            'Every provider raw query must be an object.', {
                caseId: matrixCase.id,
                queryOrdinal,
            });
        if (
            rawQuery.requestedEpochIso !== matrixCase.exactTimeIso
            || rawQuery.returnedEpochIso !== matrixCase.exactTimeIso
        ) {
            throw configurationError('ER6_STATE_MATRIX_NONEXACT_RETURNED_EPOCH',
                'Every provider query must request and return the exact case epoch.', {
                    caseId: matrixCase.id,
                    queryOrdinal,
                    expectedEpochIso: matrixCase.exactTimeIso,
                    requestedEpochIso: rawQuery.requestedEpochIso ?? null,
                    returnedEpochIso: rawQuery.returnedEpochIso ?? null,
                });
        }
        if (
            typeof rawQuery.url !== 'string'
            || rawQuery.url.trim() === ''
            || !FINGERPRINT_PATTERN.test(rawQuery.queryHash ?? '')
            || rawQuery.queryHash !== sha256(rawQuery.url)
            || typeof rawQuery.apiVersion !== 'string'
            || rawQuery.apiVersion.trim() === ''
            || typeof rawQuery.apiSource !== 'string'
            || rawQuery.apiSource.trim() === ''
        ) {
            throw configurationError('ER6_STATE_MATRIX_RAW_QUERY_PROVENANCE_INVALID',
                'Every raw query must retain an exact URL hash and versioned API identity.', {
                    caseId: matrixCase.id,
                    queryOrdinal,
                });
        }
        requirePlainObject(rawQuery.payload, 'ER6_STATE_MATRIX_RAW_PAYLOAD_INVALID',
            'Every raw query must retain its complete Horizons payload.', {
                caseId: matrixCase.id,
                queryOrdinal,
            });
        if (!Object.isFrozen(rawQuery) || !Object.isFrozen(rawQuery.payload)) {
            throw configurationError('ER6_STATE_MATRIX_RAW_QUERY_MUTABLE',
                'Every provider-owned raw query and payload must be immutable.', {
                    caseId: matrixCase.id,
                    queryOrdinal,
                });
        }
        let payloadHash;
        try {
            payloadHash = stableHash(rawQuery.payload);
        } catch (error) {
            throw configurationError('ER6_STATE_MATRIX_RAW_PAYLOAD_INVALID',
                'Every raw Horizons payload must be immutable JSON-compatible evidence.', {
                    caseId: matrixCase.id,
                    queryOrdinal,
                    cause: error instanceof Error ? error.message : String(error),
                });
        }
        const identity = stableHash({
            caseFingerprint: matrixCase.fingerprint,
            queryOrdinal,
            queryKind: rawQuery.queryKind,
            target: rawQuery.target,
            observerId: rawQuery.observerId,
            requestedEpochIso: rawQuery.requestedEpochIso,
            queryHash: rawQuery.queryHash,
            payloadHash,
        });
        if (
            queryIdentities.has(identity)
            || queryHashes.has(rawQuery.queryHash)
            || payloadHashes.has(payloadHash)
            || queryUrls.has(rawQuery.url)
        ) {
            throw configurationError('ER6_STATE_MATRIX_DUPLICATE_QUERY_IDENTITY',
                'All forty ER6 queries, URL hashes, and raw payload hashes must be unique.', {
                    caseId: matrixCase.id,
                    queryOrdinal,
                    queryHash: rawQuery.queryHash,
                    payloadHash,
                });
        }
        queryIdentities.add(identity);
        queryHashes.add(rawQuery.queryHash);
        payloadHashes.add(payloadHash);
        queryUrls.add(rawQuery.url);
        return Object.freeze({
            kind: 'er6-physical-globe-state-query-artifact-v1',
            ordinal: queryOrdinal,
            identity,
            payloadHash,
            rawQuery,
        });
    });
    return Object.freeze(artifacts);
}

function createObserverReconstructionDiagnostic(matrixCase, physicalState) {
    const worldState = physicalState.worldState;
    const observerState = physicalState.observerState;
    const validation = observerState.validation;
    const moonGeocentricPositionKm = requireVector(
        worldState.moon?.positionKm,
        matrixCase.id,
        'Moon geocentric position',
    );
    const sunGeocentricPositionKm = requireVector(
        worldState.sun?.positionKm,
        matrixCase.id,
        'Sun geocentric position',
    );
    const moonTopocentricPositionKm = requireVector(
        validation?.moonTopocentricPositionKm,
        matrixCase.id,
        'Moon topocentric position',
    );
    const sunTopocentricPositionKm = requireVector(
        validation?.sunTopocentricPositionKm,
        matrixCase.id,
        'Sun topocentric position',
    );
    const retainedObserverPositionKm = requireVector(
        observerState.positionKm,
        matrixCase.id,
        'retained observer position',
    );
    const observerFromMoonKm = subtract(
        moonGeocentricPositionKm,
        moonTopocentricPositionKm,
    );
    const observerFromSunKm = subtract(
        sunGeocentricPositionKm,
        sunTopocentricPositionKm,
    );
    const moonSunAgreementKm = distance(observerFromMoonKm, observerFromSunKm);
    const moonRetainedResidualKm = distance(
        observerFromMoonKm,
        retainedObserverPositionKm,
    );
    const sunRetainedResidualKm = distance(
        observerFromSunKm,
        retainedObserverPositionKm,
    );
    const providerReportedAgreementKm = validation?.observerPositionAgreementKm;
    if (!Number.isFinite(providerReportedAgreementKm)) {
        throw configurationError('ER6_STATE_MATRIX_OBSERVER_DIAGNOSTIC_INVALID',
            'Provider observer-reconstruction agreement must be finite.', {
                caseId: matrixCase.id,
            });
    }
    const providerAgreementResidualKm = Math.abs(
        moonSunAgreementKm - providerReportedAgreementKm,
    );
    return Object.freeze({
        kind: 'er6-observer-reconstruction-diagnostic-v1',
        caseId: matrixCase.id,
        epochIso: matrixCase.exactTimeIso,
        equation:
            'observer = bodyGeocentricPositionKm - bodyTopocentricPositionKm',
        observerFromMoonKm: Object.freeze(observerFromMoonKm),
        observerFromSunKm: Object.freeze(observerFromSunKm),
        retainedObserverPositionKm,
        moonSunAgreementKm,
        moonRetainedResidualKm,
        sunRetainedResidualKm,
        providerReportedAgreementKm,
        providerAgreementResidualKm,
    });
}

function summarizeObserverDiagnostics(acquisitions) {
    const cases = Object.freeze(acquisitions.map((entry) =>
        entry.observerReconstruction));
    return Object.freeze({
        kind: 'er6-observer-reconstruction-matrix-diagnostic-v1',
        cases,
        maximumMoonSunAgreementKm: Math.max(...cases.map((entry) =>
            entry.moonSunAgreementKm)),
        maximumMoonRetainedResidualKm: Math.max(...cases.map((entry) =>
            entry.moonRetainedResidualKm)),
        maximumSunRetainedResidualKm: Math.max(...cases.map((entry) =>
            entry.sunRetainedResidualKm)),
        maximumProviderAgreementResidualKm: Math.max(...cases.map((entry) =>
            entry.providerAgreementResidualKm)),
    });
}

function caseAcquisitionFingerprintPayload(value) {
    return Object.freeze({
        kind: value.kind,
        caseId: value.caseId,
        caseOrdinal: value.caseOrdinal,
        matrixCaseFingerprint: value.matrixCase.fingerprint,
        physicalStateFingerprint: value.physicalState.fingerprint,
        attachmentFingerprint: value.ephemerisAttachment.fingerprint,
        queryArtifacts: value.queryArtifacts.map((entry) => Object.freeze({
            ordinal: entry.ordinal,
            identity: entry.identity,
            queryHash: entry.rawQuery.queryHash,
            payloadHash: entry.payloadHash,
            apiSource: entry.rawQuery.apiSource,
            apiVersion: entry.rawQuery.apiVersion,
            returnedEpochIso: entry.rawQuery.returnedEpochIso,
        })),
        observerReconstruction: value.observerReconstruction,
        ownership: value.ownership,
    });
}

function matrixAcquisitionFingerprintPayload(value) {
    return Object.freeze({
        kind: value.kind,
        schemaVersion: value.schemaVersion,
        acquirerFingerprint: value.acquirerFingerprint,
        resolverFingerprint: value.resolverFingerprint,
        caseMatrixFingerprint: value.caseMatrix.fingerprint,
        caseCount: value.caseCount,
        queryCountPerCase: value.queryCountPerCase,
        totalQueryCount: value.totalQueryCount,
        caseFingerprints: value.cases.map((entry) => entry.fingerprint),
        observerReconstructionDiagnostics: value.observerReconstructionDiagnostics,
        ownership: value.ownership,
    });
}

function requireVector(value, caseId, label) {
    if (
        !Array.isArray(value)
        || value.length !== 3
        || !value.every(Number.isFinite)
    ) {
        throw configurationError('ER6_STATE_MATRIX_OBSERVER_VECTOR_INVALID',
            `ER6 ${label} must be a finite three-vector.`, {
                caseId,
                label,
            });
    }
    return value;
}

function subtract(left, right) {
    return left.map((value, index) => value - right[index]);
}

function distance(left, right) {
    return Math.hypot(...subtract(left, right));
}

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

function requirePlainObject(value, code, message, details = null) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw configurationError(code, message, details);
    }
}

function rejectUnknownFields(value, allowedFields, context) {
    const unknownFields = Object.keys(value).filter((field) =>
        !allowedFields.includes(field));
    if (unknownFields.length > 0) {
        throw configurationError('ER6_STATE_MATRIX_UNKNOWN_FIELDS',
            `ER6 ${context} contains unknown fields.`, { unknownFields });
    }
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
