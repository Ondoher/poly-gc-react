// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md,
//   ER6 exact returned-epoch San Jose/Union Glacier acquisition.
// - https://ssd-api.jpl.nasa.gov/doc/horizons.html, Horizons API parameters.
// - https://ssd.jpl.nasa.gov/horizons/manual.html, observer quantities 14 and 15.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import Er6GlobeCaseMatrixResolver from
    '../er6-case-matrix/Er6GlobeCaseMatrixResolver.js';
import Er6HorizonsPhysicalGlobeStateProvider, {
    validateEr6HorizonsPhysicalGlobeStateIntegrity,
} from '../er6-case-matrix/Er6HorizonsPhysicalGlobeStateProvider.js';
import Er6PhysicalGlobeStateMatrixAcquirer from
    '../er6-case-matrix/Er6PhysicalGlobeStateMatrixAcquirer.js';
import createEr6PhysicalSourceIdentities from
    '../er6-case-matrix/createEr6PhysicalSourceIdentities.js';
import LocalModuleGraphHasher from '../provenance/LocalModuleGraphHasher.js';
import { stableHash } from '../provenance/stableHash.js';
import {
    appendRunLog,
    createFreshRecordDirectory,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const RUNNER = 'acquireEr6GlobeCaseMatrix';
const RUNNER_PATH = `scripts/flat/reconciliation/POC/src/runners/${RUNNER}.js`;
const EXPECTED_RECORD_ID = '054-er6-globe-state-acquisition';
const EXPECTED_RECORD_DIRECTORY =
    `tmp/atmosphere/reconciliation/${EXPECTED_RECORD_ID}`;
const PREDECESSOR_RECORD_DIRECTORY =
    'tmp/atmosphere/reconciliation/053-er6-globe-state-acquisition';
const PREDECESSOR_ACQUISITION_PATH =
    `${PREDECESSOR_RECORD_DIRECTORY}/physical-state-acquisition.json`;
const PREDECESSOR_RESULT_PATH = `${PREDECESSOR_RECORD_DIRECTORY}/result.json`;
const PREDECESSOR_FAILURE_PATH = `${PREDECESSOR_RECORD_DIRECTORY}/failure.json`;
const EXPECTED_PREDECESSOR_ACQUISITION_HASH =
    '77f96e07f2e0bafa521550f935023353bf3b6038f56a18088bc5610cdf8f7877';
const EXPECTED_PREDECESSOR_RESULT_HASH =
    'edcf08ffe08eaa2d9338865b98a3a63c93c542234ac79ce9ef8c5c6e2e9fad3a';
const EXPECTED_PREDECESSOR_FAILURE_HASH =
    '4e8b38219a30d438dfad0a775a8a0708e4e14133e618f37a9ef0c225e80d9156';
const EXPECTED_API_SOURCE = 'NASA/JPL Horizons API';
const EXPECTED_API_VERSION = '1.2';
const REQUIRED_CASE_COUNT = 8;
const REQUIRED_QUERY_COUNT_PER_CASE = 5;
const REQUIRED_TOTAL_QUERY_COUNT =
    REQUIRED_CASE_COUNT * REQUIRED_QUERY_COUNT_PER_CASE;
const OBSERVER_RECONSTRUCTION_TOLERANCE_KM = 1e-5;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const DEPENDENCY_LOCK_PATHS = Object.freeze(['package.json', 'package-lock.json']);

const EXPECTED_CASES = Object.freeze([
    expectedCase(0, 'san-jose-globe-sunrise', '2024-06-20T12:51:29.018Z'),
    expectedCase(1, 'san-jose-globe-solar-noon', '2024-06-20T20:08:46.261Z'),
    expectedCase(2, 'san-jose-globe-sunset', '2024-06-21T03:26:03.503Z'),
    expectedCase(3, 'san-jose-globe-sunset-plus-1', '2024-06-21T04:26:03.503Z'),
    expectedCase(4, 'union-glacier-globe-sunrise', '2024-12-14T10:10:24.244Z'),
    expectedCase(5, 'union-glacier-globe-solar-noon', '2024-12-14T17:27:41.487Z'),
    expectedCase(6, 'union-glacier-globe-sunset', '2024-12-15T00:44:58.729Z'),
    expectedCase(7, 'union-glacier-globe-sunset-plus-1', '2024-12-15T01:44:58.729Z'),
]);

const EXPECTED_QUERY_ORDER = Object.freeze([
    expectedQuery('moon-geocentric-vector', 'vector', '301', false),
    expectedQuery('sun-geocentric-vector', 'vector', '10', false),
    expectedQuery('moon-topocentric-vector', 'vector', '301', true),
    expectedQuery('sun-topocentric-vector', 'vector', '10', true),
    expectedQuery(
        'moon-topocentric-observer-quantities-14-15',
        'lunar-aspect-observer',
        '301',
        true,
    ),
]);

const PROHIBITED_ACQUISITION_FIELDS = Object.freeze([
    'albedo',
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
    'sceneRgb',
    'sourceGain',
    'spectralIrradiance',
    'spectralRadiance',
    'spectralValues',
]);

const mode = parseMode(process.argv);
const startedAt = performance.now();
const capturedProviders = [];
let recordCreated = false;
let prepared = null;
let completedAcquisition = null;

await createFreshRecordDirectory(mode.recordDirectory);
recordCreated = true;

try {
    prepared = await prepareStaticBoundary(mode);
    await writeStaticArtifacts(mode.recordDirectory, prepared);
    await appendRunLog(
        mode.recordDirectory,
        `${RUNNER} started; exact eight-case, forty-query acquisition boundary sealed.`,
    );

    const acquirer = new Er6PhysicalGlobeStateMatrixAcquirer({
        caseMatrixResolver: prepared.resolver,
        providerFactory(matrixCase) {
            const provider = new Er6HorizonsPhysicalGlobeStateProvider();
            capturedProviders.push(Object.freeze({
                caseId: matrixCase.id,
                caseOrdinal: matrixCase.ordinal,
                provider,
            }));
            return provider;
        },
    });
    const acquisition = await acquirer.acquire({
        caseMatrix: prepared.caseMatrix,
    });
    completedAcquisition = acquisition;
    const artifacts = buildResultArtifacts({
        acquisition,
        acquirer,
        prepared,
        elapsedMilliseconds: performance.now() - startedAt,
    });
    await writeResultArtifacts(mode.recordDirectory, artifacts);

    console.log(JSON.stringify({
        status: artifacts.result.status,
        geometryAcquisitionStatus: artifacts.result.geometryAcquisitionStatus,
        apiIdentityStatus: artifacts.result.apiIdentityStatus,
        attachmentIntegrityStatus: artifacts.result.attachmentIntegrityStatus,
        observerReconstructionStatus:
            artifacts.result.observerReconstructionStatus,
        caseCount: artifacts.result.caseCount,
        totalQueryCount: artifacts.result.totalQueryCount,
        acceptedCriterionCount: artifacts.result.acceptedCriterionCount,
        criterionCount: artifacts.result.criterionCount,
        maximumObserverReconstructionResidualKm:
            artifacts.result.maximumObserverReconstructionResidualKm,
        recordDirectory: mode.recordDirectory,
    }));
} catch (error) {
    if (recordCreated) {
        await writeFailureArtifacts({
            recordDirectory: mode.recordDirectory,
            mode,
            prepared,
            capturedProviders,
            completedAcquisition,
            error,
            elapsedMilliseconds: performance.now() - startedAt,
        });
    }
    throw error;
}

async function prepareStaticBoundary(modeConfiguration) {
    const predecessor = Object.freeze({
        recordDirectory: PREDECESSOR_RECORD_DIRECTORY,
        acquisition: Object.freeze({
            path: PREDECESSOR_ACQUISITION_PATH,
            expectedHashSha256: EXPECTED_PREDECESSOR_ACQUISITION_HASH,
            actualHashSha256: await hashFile(PREDECESSOR_ACQUISITION_PATH),
        }),
        result: Object.freeze({
            path: PREDECESSOR_RESULT_PATH,
            expectedHashSha256: EXPECTED_PREDECESSOR_RESULT_HASH,
            actualHashSha256: await hashFile(PREDECESSOR_RESULT_PATH),
        }),
        failure: Object.freeze({
            path: PREDECESSOR_FAILURE_PATH,
            expectedHashSha256: EXPECTED_PREDECESSOR_FAILURE_HASH,
            actualHashSha256: await hashFile(PREDECESSOR_FAILURE_PATH),
        }),
        disposition:
            'immutable complete 40-query acquisition invalidated by a missing runner import',
    });
    if (
        predecessor.acquisition.actualHashSha256
            !== predecessor.acquisition.expectedHashSha256
        || predecessor.result.actualHashSha256
            !== predecessor.result.expectedHashSha256
        || predecessor.failure.actualHashSha256
            !== predecessor.failure.expectedHashSha256
    ) {
        throw new Error('Record 053 evidence drifted from the pinned retry dependency.');
    }
    const resolver = new Er6GlobeCaseMatrixResolver();
    const sourceReferences = createEr6PhysicalSourceIdentities();
    const caseMatrix = resolver.resolveCaseMatrix({
        sourceIdentities: sourceReferences.identities,
    });
    validatePredeclaredCaseMatrix(caseMatrix);

    const providerDescriptor = new Er6HorizonsPhysicalGlobeStateProvider().describe();
    const localModuleGraph = await new LocalModuleGraphHasher({
        workspaceRoot: process.cwd(),
        allowedRoot: 'scripts/flat/reconciliation/POC/src',
    }).collect([RUNNER_PATH]);
    const prohibitedModuleFragments = Object.freeze([
        '/archive/',
        '/external-boundary-radiance/',
        '/external-celestial-candidates/',
        '/flat32/',
    ]);
    const prohibitedRuntimeModules = Object.freeze(
        Object.keys(localModuleGraph.files).filter((path) =>
            prohibitedModuleFragments.some((fragment) => path.includes(fragment))),
    );
    if (prohibitedRuntimeModules.length > 0) {
        throw new Error(
            `ER6 acquisition graph contains prohibited modules: ${prohibitedRuntimeModules.join(', ')}.`,
        );
    }
    const dependencyLocks = Object.freeze(Object.fromEntries(await Promise.all(
        DEPENDENCY_LOCK_PATHS.map(async (path) => [path, await hashFile(path)]),
    )));
    const command = Object.freeze({
        commands: Object.freeze([Object.freeze({
            command: modeConfiguration.command,
            timestamp: nowIso(),
            writesRecord: true,
            networkAcquisition: true,
        })]),
    });

    return Object.freeze({
        resolver,
        caseMatrix,
        command,
        stateGoal: stateGoalText(),
        inputs: buildInputs(caseMatrix, sourceReferences),
        equationsAndTolerances: buildEquationsAndTolerances(),
        sourceReferences: Object.freeze({
            kind: 'er6-globe-state-source-references-v1',
            sourceIdentities: sourceReferences,
            horizons: Object.freeze({
                apiSource: EXPECTED_API_SOURCE,
                apiVersion: EXPECTED_API_VERSION,
                endpoint: providerDescriptor.endpoint,
                providerDescriptor,
                apiDocumentation: 'https://ssd-api.jpl.nasa.gov/doc/horizons.html',
                manual: 'https://ssd.jpl.nasa.gov/horizons/manual.html',
                rawPayloadOwner:
                    'physical-state-acquisition.json#/cases/*/rawQueries/*/payload',
            }),
        }),
        provenance: Object.freeze({
            runner: RUNNER,
            recordId: EXPECTED_RECORD_ID,
            expectedRecordDirectory: EXPECTED_RECORD_DIRECTORY,
            runtime: Object.freeze({
                node: process.version,
                v8: process.versions.v8,
                platform: process.platform,
                architecture: process.arch,
            }),
            localModuleGraph,
            moduleBoundaryAudit: Object.freeze({
                prohibitedModuleFragments,
                prohibitedRuntimeModules,
                accepted: true,
            }),
            dependencyLocks,
            sourceIdentityOwner:
                'er6-case-matrix/createEr6PhysicalSourceIdentities.js',
            predecessor,
            retryChange:
                'import the already selected canonical stable-hash helper; physical inputs, criteria, and tolerances are unchanged',
            scheduleOwner: 'Er6GlobeCaseMatrixResolver',
            acquisitionOwner: 'Er6PhysicalGlobeStateMatrixAcquirer',
            physicalStateOwner:
                'one fresh Er6HorizonsPhysicalGlobeStateProvider per case',
            externalRuntimeLinks: false,
            productionImports: false,
            radiometryAcquired: false,
            displayEvaluated: false,
        }),
    });
}

function validatePredeclaredCaseMatrix(caseMatrix) {
    if (
        caseMatrix.caseCount !== REQUIRED_CASE_COUNT
        || !Array.isArray(caseMatrix.cases)
        || caseMatrix.cases.length !== REQUIRED_CASE_COUNT
    ) {
        throw new Error('ER6 resolver did not produce the predeclared eight-case matrix.');
    }
    for (const expected of EXPECTED_CASES) {
        const actual = caseMatrix.cases[expected.ordinal];
        if (
            actual?.ordinal !== expected.ordinal
            || actual?.id !== expected.id
            || actual?.exactTimeIso !== expected.exactTimeIso
            || actual?.ephemerisRequest?.timeIso !== expected.exactTimeIso
        ) {
            throw new Error(
                `ER6 case ${expected.ordinal} drifted from the predeclared id/time boundary.`,
            );
        }
    }
}

function buildResultArtifacts({
    acquisition,
    acquirer,
    prepared: staticBoundary,
    elapsedMilliseconds,
}) {
    const criteria = buildCriteria(acquisition, staticBoundary);
    const statuses = deriveStatuses(criteria);
    const acceptedCriterionCount = criteria.filter((entry) =>
        entry.status === 'accepted').length;
    const observer = acquisition.observerReconstructionDiagnostics;
    const maximumObserverReconstructionResidualKm = Math.max(
        observer.maximumMoonSunAgreementKm,
        observer.maximumMoonRetainedResidualKm,
        observer.maximumSunRetainedResidualKm,
        observer.maximumProviderAgreementResidualKm,
    );
    const result = Object.freeze({
        status: statuses.overallStatus,
        geometryAcquisitionStatus: statuses.geometryAcquisitionStatus,
        apiIdentityStatus: statuses.apiIdentityStatus,
        attachmentIntegrityStatus: statuses.attachmentIntegrityStatus,
        observerReconstructionStatus: statuses.observerReconstructionStatus,
        mechanicalStatus: statuses.geometryAcquisitionStatus,
        physicalRadiometryStatus: 'not-claimed',
        automatedReviewabilityStatus: 'not-claimed',
        humanReviewStatus: 'not-claimed',
        observationalStatus: 'not-claimed',
        caseCount: acquisition.caseCount,
        queryCountPerCase: acquisition.queryCountPerCase,
        totalQueryCount: acquisition.totalQueryCount,
        expectedApiSource: EXPECTED_API_SOURCE,
        expectedApiVersion: EXPECTED_API_VERSION,
        acquisitionFingerprint: acquisition.fingerprint,
        caseMatrixFingerprint: acquisition.caseMatrix.fingerprint,
        maximumObserverReconstructionResidualKm,
        observerReconstructionToleranceKm:
            OBSERVER_RECONSTRUCTION_TOLERANCE_KM,
        acceptedCriterionCount,
        criterionCount: criteria.length,
        elapsedMilliseconds,
        imageCount: 0,
        radiometryClaimed: false,
        displayClaimed: false,
        gpuClaimed: false,
        productionClaimed: false,
        nextStep: statuses.overallStatus === 'accepted'
            ? 'consume this sealed acquisition in ER6 physical scene validation'
            : 'correct the acquisition boundary and use a fresh numbered record',
    });
    return Object.freeze({
        acquisition,
        acquirerDescriptor: acquirer.describe(),
        criteriaResults: Object.freeze({
            status: statuses.overallStatus,
            ...statuses,
            mechanicalStatus: statuses.geometryAcquisitionStatus,
            physicalRadiometryStatus: 'not-claimed',
            automatedReviewabilityStatus: 'not-claimed',
            humanReviewStatus: 'not-claimed',
            observationalStatus: 'not-claimed',
            criteria: Object.freeze(criteria),
        }),
        result,
        report: reportText(result, criteria),
    });
}

function buildCriteria(acquisition, staticBoundary) {
    const flattenedQueries = acquisition.cases.flatMap((entry) =>
        entry.rawQueries);
    const flattenedArtifacts = acquisition.cases.flatMap((entry) =>
        entry.queryArtifacts);
    const exactCaseOrder = acquisition.cases.every((entry, index) => {
        const expected = EXPECTED_CASES[index];
        return entry.caseOrdinal === expected.ordinal
            && entry.caseId === expected.id
            && entry.matrixCase === staticBoundary.caseMatrix.cases[index]
            && entry.matrixCase.exactTimeIso === expected.exactTimeIso;
    });
    const exactQueryOrder = acquisition.cases.every((entry) =>
        entry.rawQueries.length === REQUIRED_QUERY_COUNT_PER_CASE
        && entry.rawQueries.every((query, index) => {
            const expected = EXPECTED_QUERY_ORDER[index];
            return query.queryKind === expected.queryKind
                && query.target === expected.target
                && (expected.observer
                    ? query.observerId === entry.matrixCase.observer.id
                    : query.observerId === null);
        }));
    const exactEpochs = acquisition.cases.every((entry) =>
        entry.physicalState.worldState.epochIso === entry.matrixCase.exactTimeIso
        && entry.physicalState.lunarAspect.epochIso === entry.matrixCase.exactTimeIso
        && entry.rawQueries.every((query) =>
            query.requestedEpochIso === entry.matrixCase.exactTimeIso
            && query.returnedEpochIso === entry.matrixCase.exactTimeIso));
    const apiIdentity = flattenedQueries.every((query) =>
        query.apiSource === EXPECTED_API_SOURCE
        && query.apiVersion === EXPECTED_API_VERSION)
        && acquisition.cases.every((entry) =>
            entry.physicalState.provenance.source === EXPECTED_API_SOURCE
            && entry.physicalState.provenance.sourceVersion === EXPECTED_API_VERSION);
    const uniqueQueries = flattenedQueries.length === REQUIRED_TOTAL_QUERY_COUNT
        && uniqueCount(flattenedQueries.map((entry) => entry.url))
            === REQUIRED_TOTAL_QUERY_COUNT
        && uniqueCount(flattenedQueries.map((entry) => entry.queryHash))
            === REQUIRED_TOTAL_QUERY_COUNT
        && uniqueCount(flattenedArtifacts.map((entry) => entry.identity))
            === REQUIRED_TOTAL_QUERY_COUNT
        && uniqueCount(flattenedArtifacts.map((entry) => entry.payloadHash))
            === REQUIRED_TOTAL_QUERY_COUNT;
    const attachmentIntegrity = FINGERPRINT_PATTERN.test(acquisition.fingerprint)
        && acquisition.caseMatrix === staticBoundary.caseMatrix
        && FINGERPRINT_PATTERN.test(acquisition.caseMatrix.fingerprint)
        && acquisition.cases.every((entry) => {
            validateEr6HorizonsPhysicalGlobeStateIntegrity(entry.physicalState);
            return entry.ephemerisAttachment.matrixCase === entry.matrixCase
                && entry.ephemerisAttachment.ephemerisState === entry.physicalState
                && entry.ephemerisAttachment.lunarAspect
                    === entry.physicalState.lunarAspect
                && entry.ephemerisAttachment.returnedEpoch.requestedEpochIso
                    === entry.matrixCase.exactTimeIso
                && entry.ephemerisAttachment.queryIdentities.length
                    === REQUIRED_QUERY_COUNT_PER_CASE
                && FINGERPRINT_PATTERN.test(entry.fingerprint)
                && FINGERPRINT_PATTERN.test(entry.physicalState.fingerprint)
                && FINGERPRINT_PATTERN.test(entry.ephemerisAttachment.fingerprint);
        });
    const observer = acquisition.observerReconstructionDiagnostics;
    const observerReconstruction = [
        observer.maximumMoonSunAgreementKm,
        observer.maximumMoonRetainedResidualKm,
        observer.maximumSunRetainedResidualKm,
        observer.maximumProviderAgreementResidualKm,
    ].every((value) => Number.isFinite(value)
        && value < OBSERVER_RECONSTRUCTION_TOLERANCE_KM);
    const prohibitedFields = findProhibitedFields(
        acquisition,
        new Set(PROHIBITED_ACQUISITION_FIELDS),
    );
    const oracleAccepted = acquisition.cases.every((entry) =>
        entry.rawQueries.length === REQUIRED_QUERY_COUNT_PER_CASE)
        && staticBoundary.sourceReferences.horizons.providerDescriptor
            .signedPhaseOracle.accepted === true;

    return Object.freeze([
        criterion('geometry-acquisition', 'exact predeclared case order and epochs',
            exactCaseOrder, { expectedCases: EXPECTED_CASES }),
        criterion('geometry-acquisition', 'exact eight-case acquisition cardinality',
            acquisition.caseCount === REQUIRED_CASE_COUNT
                && acquisition.cases.length === REQUIRED_CASE_COUNT,
            { actualCaseCount: acquisition.cases.length }),
        criterion('query-contract', 'exact five-query order for every case',
            exactQueryOrder, { expectedQueryOrder: EXPECTED_QUERY_ORDER }),
        criterion('query-contract', 'exact forty-query acquisition cardinality',
            acquisition.totalQueryCount === REQUIRED_TOTAL_QUERY_COUNT
                && flattenedQueries.length === REQUIRED_TOTAL_QUERY_COUNT,
            { actualTotalQueryCount: flattenedQueries.length }),
        criterion('query-contract', 'all forty query and payload identities are unique',
            uniqueQueries, {
                uniqueUrls: uniqueCount(flattenedQueries.map((entry) => entry.url)),
                uniqueQueryHashes:
                    uniqueCount(flattenedQueries.map((entry) => entry.queryHash)),
                uniqueArtifactIdentities:
                    uniqueCount(flattenedArtifacts.map((entry) => entry.identity)),
                uniquePayloadHashes:
                    uniqueCount(flattenedArtifacts.map((entry) => entry.payloadHash)),
            }),
        criterion('returned-epoch', 'every requested and returned epoch is exact',
            exactEpochs, { equalityTolerance: 'exact-string-equality' }),
        criterion('api-identity', 'every query retains the predeclared API identity',
            apiIdentity, {
                expectedApiSource: EXPECTED_API_SOURCE,
                expectedApiVersion: EXPECTED_API_VERSION,
            }),
        criterion('attachment-integrity',
            'state, aspect, case, and returned-epoch attachment identities are intact',
            attachmentIntegrity, {
                caseFingerprints: acquisition.cases.map((entry) => entry.fingerprint),
            }),
        criterion('observer-reconstruction',
            'Moon and Sun independently reconstruct the retained observer',
            observerReconstruction, {
                toleranceKm: OBSERVER_RECONSTRUCTION_TOLERANCE_KM,
                diagnostics: observer,
            }),
        criterion('lunar-aspect', 'signed-phase oracle and MOON_ME aspect are retained',
            oracleAccepted && acquisition.cases.every((entry) =>
                entry.physicalState.lunarAspect.frame === 'MOON_ME'
                && entry.physicalState.lunarAspect.longitudeConvention
                    === 'east-positive'),
            {
                signedPhaseOracle: staticBoundary.sourceReferences.horizons
                    .providerDescriptor.signedPhaseOracle,
            }),
        criterion('source-identity',
            'case matrix retains the exact shared identity-only source list',
            FINGERPRINT_PATTERN.test(
                staticBoundary.sourceReferences.sourceIdentities.fingerprint,
            )
                && stableHash(staticBoundary.caseMatrix.sourceIdentities)
                    === stableHash(
                        staticBoundary.sourceReferences.sourceIdentities.identities,
                    )
                && staticBoundary.caseMatrix.sourceIdentities.every((entry) =>
                    Object.keys(entry).every((field) =>
                        ['id', 'kind', 'fingerprint'].includes(field))),
            {
                sourceIdentityContractFingerprint:
                    staticBoundary.sourceReferences.sourceIdentities.fingerprint,
                sourceIdentities: staticBoundary.caseMatrix.sourceIdentities,
            }),
        criterion('scope-boundary', 'radiometry and display fields are absent',
            prohibitedFields.length === 0, { prohibitedFields }),
        criterion('scope-boundary', 'record makes no image, GPU, or production claim',
            true, {
                imageCount: 0,
                radiometryClaimed: false,
                displayClaimed: false,
                gpuClaimed: false,
                productionClaimed: false,
            }),
    ]);
}

function deriveStatuses(criteria) {
    const statusFor = (scopes) => {
        const selected = criteria.filter((entry) => scopes.includes(entry.scope));
        return selected.length > 0
            && selected.every((entry) => entry.status === 'accepted')
            ? 'accepted'
            : 'rejected';
    };
    const geometryAcquisitionStatus = statusFor([
        'geometry-acquisition',
        'query-contract',
        'returned-epoch',
        'lunar-aspect',
        'source-identity',
        'scope-boundary',
    ]);
    const apiIdentityStatus = statusFor(['api-identity']);
    const attachmentIntegrityStatus = statusFor(['attachment-integrity']);
    const observerReconstructionStatus = statusFor(['observer-reconstruction']);
    const allAccepted = criteria.length > 0
        && criteria.every((entry) => entry.status === 'accepted');
    return Object.freeze({
        geometryAcquisitionStatus,
        apiIdentityStatus,
        attachmentIntegrityStatus,
        observerReconstructionStatus,
        overallStatus: allAccepted
            && [
                geometryAcquisitionStatus,
                apiIdentityStatus,
                attachmentIntegrityStatus,
                observerReconstructionStatus,
            ].every((status) => status === 'accepted')
            ? 'accepted'
            : 'rejected',
    });
}

function buildInputs(caseMatrix, sourceReferences) {
    return Object.freeze({
        recordId: EXPECTED_RECORD_ID,
        recordDirectory: EXPECTED_RECORD_DIRECTORY,
        stage: 'ER6-exact-returned-epoch-physical-globe-state-acquisition',
        predecessorRecord: PREDECESSOR_RECORD_DIRECTORY,
        retryChange:
            'add the missing stableHash import after record 053 completed acquisition but failed before criteria evaluation',
        modes: Object.freeze({
            record: 'the only execution mode; one fresh immutable numbered record',
            preflight:
                'disabled because every result-bearing execution must use a numbered record',
        }),
        expectedCases: EXPECTED_CASES,
        expectedQueryOrder: EXPECTED_QUERY_ORDER,
        expectedApiSource: EXPECTED_API_SOURCE,
        expectedApiVersion: EXPECTED_API_VERSION,
        caseMatrixFingerprint: caseMatrix.fingerprint,
        resolverFingerprint: caseMatrix.resolverFingerprint,
        sourceIdentityContractFingerprint: sourceReferences.fingerprint,
        sourceIdentities: sourceReferences.identities,
        applicableXaGates: Object.freeze(['XA-G02', 'XA-G10']),
        activeWorkItem: 'XA-R14',
        claim:
            'exact returned-epoch state acquisition and serialization only',
        excludedClaims: Object.freeze([
            'source radiometry',
            'atmosphere transport',
            'display',
            'observer visibility',
            'GPU',
            'production',
        ]),
    });
}

function buildEquationsAndTolerances() {
    return Object.freeze({
        equations: Object.freeze({
            observerReconstruction:
                'observerPositionKm=bodyGeocentricPositionKm-bodyTopocentricPositionKm',
            observerAgreement:
                'norm(observerFromMoonKm-observerFromSunKm)',
            signedLunarPhase:
                'sign(shortestEastPositive(ObsSub-LON-SunSub-LON))*sphericalSeparation(ObsSub,SunSub)',
        }),
        exactRequirements: Object.freeze({
            caseCount: REQUIRED_CASE_COUNT,
            queryCountPerCase: REQUIRED_QUERY_COUNT_PER_CASE,
            totalQueryCount: REQUIRED_TOTAL_QUERY_COUNT,
            caseOrder: EXPECTED_CASES,
            queryOrder: EXPECTED_QUERY_ORDER,
            requestedReturnedEpochEquality: 'exact-string-equality',
            apiSource: EXPECTED_API_SOURCE,
            apiVersion: EXPECTED_API_VERSION,
            queryUrlHash: 'SHA-256 exact recomputation in the acquirer',
            attachmentIdentity: 'exact runtime object identity plus fingerprints',
        }),
        tolerances: Object.freeze({
            observerReconstructionKilometers:
                `< ${OBSERVER_RECONSTRUCTION_TOLERANCE_KM}`,
            signedPhaseOracleDegrees: '<= 1e-12',
            allOtherRequirements: 'exact',
        }),
    });
}

async function writeStaticArtifacts(recordDirectory, staticBoundary) {
    await writeText(recordDirectory, 'state-goal.md', staticBoundary.stateGoal);
    await writeJson(recordDirectory, 'inputs.json', staticBoundary.inputs);
    await writeJson(recordDirectory, 'provenance.json', staticBoundary.provenance);
    await writeJson(
        recordDirectory,
        'source-references.json',
        staticBoundary.sourceReferences,
    );
    await writeJson(
        recordDirectory,
        'equations-and-tolerances.json',
        staticBoundary.equationsAndTolerances,
    );
    await writeJson(recordDirectory, 'command.json', staticBoundary.command);
}

async function writeResultArtifacts(recordDirectory, artifacts) {
    await writeJson(
        recordDirectory,
        'physical-state-acquisition.json',
        artifacts.acquisition,
    );
    await writeJson(
        recordDirectory,
        'acquirer-descriptor.json',
        artifacts.acquirerDescriptor,
    );
    await writeJson(
        recordDirectory,
        'criteria-results.json',
        artifacts.criteriaResults,
    );
    await writeJson(recordDirectory, 'result.json', artifacts.result);
    await writeText(recordDirectory, 'report.md', artifacts.report);
    await appendRunLog(
        recordDirectory,
        `${RUNNER} ${artifacts.result.status}; ${artifacts.result.caseCount} cases, `
            + `${artifacts.result.totalQueryCount} queries; radiometry/display not-claimed.`,
    );
}

async function writeFailureArtifacts({
    recordDirectory,
    mode: modeConfiguration,
    prepared: staticBoundary,
    capturedProviders: providers,
    completedAcquisition: acquisition,
    error,
    elapsedMilliseconds,
}) {
    if (!staticBoundary) {
        await writeJson(recordDirectory, 'command.json', {
            commands: [{
                command: modeConfiguration.command,
                timestamp: nowIso(),
                writesRecord: true,
                networkAcquisition: true,
            }],
        });
    }
    const partialCases = providers.map((entry) => Object.freeze({
        caseId: entry.caseId,
        caseOrdinal: entry.caseOrdinal,
        providerStarted: entry.provider._started === true,
        completed: Object.isFrozen(entry.provider.rawQueries)
            && entry.provider.rawQueries.length === REQUIRED_QUERY_COUNT_PER_CASE,
        retainedQueryCount: entry.provider.rawQueries.length,
        rawQueries: entry.provider.rawQueries,
    }));
    if (acquisition) {
        await writeJson(
            recordDirectory,
            'physical-state-acquisition.json',
            acquisition,
        );
    }
    await writeJson(recordDirectory, 'partial-query-payloads.json', {
        kind: 'er6-partial-query-payload-retention-v1',
        qualification:
            'Invalid attempt evidence only; never consumed as a sealed acquisition.',
        caseCountStarted: partialCases.length,
        retainedQueryCount: partialCases.reduce((sum, entry) =>
            sum + entry.retainedQueryCount, 0),
        cases: partialCases,
    });
    await writeJson(recordDirectory, 'failure.json', {
        status: 'invalid',
        runner: RUNNER,
        error: serializeError(error),
    });
    await writeJson(recordDirectory, 'criteria-results.json', {
        status: 'invalid',
        geometryAcquisitionStatus: 'invalid-attempt',
        apiIdentityStatus: 'invalid-attempt',
        attachmentIntegrityStatus: 'invalid-attempt',
        observerReconstructionStatus: 'invalid-attempt',
        mechanicalStatus: 'invalid-attempt',
        physicalRadiometryStatus: 'not-claimed',
        automatedReviewabilityStatus: 'not-claimed',
        humanReviewStatus: 'not-claimed',
        observationalStatus: 'not-claimed',
        criteria: [],
        qualification:
            'Acquisition did not complete, so acceptance criteria were not evaluated.',
    });
    await writeJson(recordDirectory, 'result.json', {
        status: 'invalid',
        geometryAcquisitionStatus: 'invalid-attempt',
        apiIdentityStatus: 'invalid-attempt',
        attachmentIntegrityStatus: 'invalid-attempt',
        observerReconstructionStatus: 'invalid-attempt',
        mechanicalStatus: 'invalid-attempt',
        physicalRadiometryStatus: 'not-claimed',
        automatedReviewabilityStatus: 'not-claimed',
        humanReviewStatus: 'not-claimed',
        observationalStatus: 'not-claimed',
        elapsedMilliseconds,
        imageCount: 0,
        radiometryClaimed: false,
        displayClaimed: false,
        gpuClaimed: false,
        productionClaimed: false,
    });
    await writeText(recordDirectory, 'report.md', `# ER6 Globe-State Acquisition

Overall status: **invalid**

The numbered acquisition attempt did not complete. See \`failure.json\` and
\`partial-query-payloads.json\`. This directory is immutable and cannot be
resumed; any correction must use a fresh numbered record.
`);
    await appendRunLog(
        recordDirectory,
        `${RUNNER} invalid; retained ${partialCases.reduce((sum, entry) =>
            sum + entry.retainedQueryCount, 0)} partial raw queries.`,
    );
}

function parseMode(argv) {
    if (argv.includes('--preflight')) {
        throw new Error(
            'Result-bearing preflight is disabled; execute only the predeclared numbered record.',
        );
    }
    if (argv.length !== 4 || argv[2] !== '--record') {
        throw new Error(
            `Runner requires exactly --record ${EXPECTED_RECORD_DIRECTORY}.`,
        );
    }
    const recordDirectory = parseRecordDirectory(argv);
    if (recordDirectory.replaceAll('\\', '/') !== EXPECTED_RECORD_DIRECTORY) {
        throw new Error(
            `This predeclared runner may write only ${EXPECTED_RECORD_DIRECTORY}.`,
        );
    }
    return Object.freeze({
        kind: 'record',
        recordDirectory,
        command: `node --use-system-ca ${RUNNER_PATH} --record ${recordDirectory}`,
    });
}

function criterion(scope, name, accepted, evidence) {
    return Object.freeze({
        scope,
        name,
        status: accepted ? 'accepted' : 'rejected',
        evidence,
    });
}

function expectedCase(ordinal, id, exactTimeIso) {
    return Object.freeze({ ordinal, id, exactTimeIso });
}

function expectedQuery(id, queryKind, target, observer) {
    return Object.freeze({ id, queryKind, target, observer });
}

function uniqueCount(values) {
    return new Set(values).size;
}

function findProhibitedFields(value, prohibited, path = '$', found = []) {
    if (!value || typeof value !== 'object') {
        return found;
    }
    if (Array.isArray(value)) {
        value.forEach((entry, index) =>
            findProhibitedFields(entry, prohibited, `${path}[${index}]`, found));
        return found;
    }
    for (const [field, entry] of Object.entries(value)) {
        const fieldPath = `${path}.${field}`;
        if (prohibited.has(field)) {
            found.push(fieldPath);
        }
        findProhibitedFields(entry, prohibited, fieldPath, found);
    }
    return found;
}

function stateGoalText() {
    return `# State Goal

Execute ${EXPECTED_RECORD_ID} once to acquire the exact eight-case San Jose and
Union Glacier ER6 globe matrix through forty unique live JPL Horizons queries.
Retain every raw JSON payload, exact URL and hash, API identity, returned epoch,
provider-owned physical state, resolver-owned attachment, and independent Moon/
Sun observer reconstruction.

This record claims ER6 returned-epoch geometry and the XA-R14 POC acquisition
boundary through XA-G02 and the mechanical/status separation of XA-G10. It does
not evaluate source radiometry, atmosphere transport, display, observer
visibility, images, GPU behavior, or production behavior.
`;
}

function reportText(result, criteria) {
    return `# ER6 Globe-State Acquisition

Overall status: **${result.status}**

- Geometry acquisition: ${result.geometryAcquisitionStatus}
- API identity: ${result.apiIdentityStatus}
- Attachment integrity: ${result.attachmentIntegrityStatus}
- Observer reconstruction: ${result.observerReconstructionStatus}
- Cases: ${result.caseCount}
- Queries: ${result.totalQueryCount}
- Maximum observer residual: ${result.maximumObserverReconstructionResidualKm} km
- Physical radiometry: ${result.physicalRadiometryStatus}
- Automated reviewability: ${result.automatedReviewabilityStatus}
- Human review: ${result.humanReviewStatus}
- Observational status: ${result.observationalStatus}
- Criteria: ${result.acceptedCriterionCount}/${result.criterionCount}

Rejected criteria:
${criteria.filter((entry) => entry.status !== 'accepted')
        .map((entry) => `- ${entry.name}`)
        .join('\n') || '- none'}
`;
}

async function hashFile(path) {
    return hashBytes(await readFile(path));
}

function hashBytes(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}

function serializeError(error) {
    return Object.freeze({
        name: error?.name ?? 'Error',
        code: error?.code ?? null,
        message: error?.message ?? String(error),
        details: error?.details ?? null,
        stack: error?.stack ?? null,
    });
}
