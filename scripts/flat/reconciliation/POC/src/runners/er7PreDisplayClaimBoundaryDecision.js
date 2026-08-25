// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md,
//   ER7 conditional observer and sky-background validation.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md,
//   display and observer boundary.
// - tmp/atmosphere/reconciliation/056-er6-physical-globe-scene-validation,
//   accepted real-scene physical transport dependency.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import LocalModuleGraphHasher from '../provenance/LocalModuleGraphHasher.js';
import {
    appendRunLog,
    createFreshRecordDirectory,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const RUNNER = 'er7PreDisplayClaimBoundaryDecision';
const RUNNER_PATH = `scripts/flat/reconciliation/POC/src/runners/${RUNNER}.js`;
const EXPECTED_RECORD_ID = '059-er7-pre-display-claim-boundary';
const EXPECTED_RECORD_DIRECTORY =
    `tmp/atmosphere/reconciliation/${EXPECTED_RECORD_ID}`;
const REJECTED_PREDECESSORS = Object.freeze([
    Object.freeze({
        recordId: '057-er7-pre-display-claim-boundary',
        status: 'rejected-after-audit',
        reason:
            'Its sealed-dependency criterion was literal true and its no-mutation claim lacked an active import-graph audit.',
        claimSelectionChanged: false,
    }),
    Object.freeze({
        recordId: '058-er7-pre-display-claim-boundary',
        status: 'rejected-after-audit',
        reason:
            'Its boundary component, basis, display, source-id, observer-term, and background-term criteria did not all require exact equality with their sealed or canonical owners.',
        claimSelectionChanged: false,
    }),
]);
const SEALED_ER6_RECORD_ID = '056-er6-physical-globe-scene-validation';
const SEALED_ER6_DIRECTORY =
    `tmp/atmosphere/reconciliation/${SEALED_ER6_RECORD_ID}`;
const REQUIRED_CASE_COUNT = 8;
const REQUIRED_CHANNEL_COUNT = 15;
const PHYSICAL_QUANTITY = 'spectral-radiance-density';
const PHYSICAL_UNITS = 'W m^-2 sr^-1 nm^-1';
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;

// These pins were configured only after record 056 was accepted and sealed.
// They are verified before record 059 is created so a missing, rejected, or
// modified ER6 dependency cannot consume the next immutable record number.
const SEALED_ER6_PINS = Object.freeze({
    resultSha256:
        '1d8c0415b6c58a7c42ce117ac25b79f9d35438628ce363cba9bce3bb5ef71550',
    criteriaResultsSha256:
        '22f38188926a3b221d5b4f3de89278bebcb7ff3d92f617bbe49ee950e2fbe96f',
    physicalGlobeSceneMatrixSha256:
        'ac3ca5fd0be281a20e629b9fb669731132703c0106ffdde3c2f2e3ed4245f167',
    sourceReferencesSha256:
        '79290c5d148fd2233f02b706900c63ecf6ceafeacd750bb29262fa3d740b7a49',
});

const SEALED_ER6_FILES = Object.freeze({
    result: 'result.json',
    criteriaResults: 'criteria-results.json',
    physicalGlobeSceneMatrix: 'physical-globe-scene-matrix.json',
    sourceReferences: 'source-references.json',
    failure: 'failure.json',
});

const EXPECTED_CASES = Object.freeze([
    expectedCase(0, 'san-jose-globe-sunrise'),
    expectedCase(1, 'san-jose-globe-solar-noon'),
    expectedCase(2, 'san-jose-globe-sunset'),
    expectedCase(3, 'san-jose-globe-sunset-plus-1'),
    expectedCase(4, 'union-glacier-globe-sunrise'),
    expectedCase(5, 'union-glacier-globe-solar-noon'),
    expectedCase(6, 'union-glacier-globe-sunset'),
    expectedCase(7, 'union-glacier-globe-sunset-plus-1'),
]);

const PHYSICAL_COMPONENT_FIELDS = Object.freeze([
    'endpointSpectralRadianceDensity',
    'extendedSpectralRadianceDensity',
    'pathSpectralRadianceDensity',
    'pointSpectralRadianceDensity',
    'transportedEndpointSpectralRadianceDensity',
    'viewSpectralTransmittance',
]);

const EXPECTED_SOURCE_IDS = Object.freeze({
    extended: Object.freeze([
        'algorithm32-canonical-astm-g173-etr',
        'esa-lime-lunar-reflectance-model',
    ]),
    point: Object.freeze(['stsci-calspec-sirius']),
});
const CANONICAL_OBSERVER_TERMS = Object.freeze([
    'named human observer or calibrated camera',
    'pupil or aperture',
    'adaptation or exposure',
    'optical PSF, glare, or seeing',
    'calibrated display luminance and dynamic range',
    'independent observer or detector threshold',
]);
const CANONICAL_BACKGROUND_TERMS = Object.freeze([
    'diffuse celestial sky',
    'airglow',
    'aurora',
    'local light pollution',
]);

const PROVENANCE_PATHS = Object.freeze([
    RUNNER_PATH,
    'scripts/flat/reconciliation/POC/src/runners/recordWriter.js',
    'scripts/flat/reconciliation/POC/src/runners/er6PhysicalGlobeSceneValidation.js',
    'scripts/flat/reconciliation/POC/src/er6-case-matrix/Er6PhysicalGlobeSceneRenderer.js',
    'scripts/flat/reconciliation/POC/src/physical-frame/PhysicalSpectralFrameComposer.js',
    'scripts/flat/reconciliation/POC/src/color/BrunetonColorDisplayModel.js',
    'agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md',
    'agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md',
    'agents/topics/apps/flat/reconciliation/extra-atmosphere-objects.md',
]);
const EXPECTED_ACTIVE_MODULE_PATHS = Object.freeze([
    'scripts/flat/reconciliation/POC/src/provenance/LocalModuleGraphHasher.js',
    'scripts/flat/reconciliation/POC/src/provenance/stableHash.js',
    RUNNER_PATH,
    'scripts/flat/reconciliation/POC/src/runners/recordWriter.js',
].sort());
const PROHIBITED_ACTIVE_MODULE_FRAGMENTS = Object.freeze([
    '/atmosphere/',
    '/browser/',
    '/camera/',
    '/color/',
    '/directional-visibility/',
    '/er6-case-matrix/',
    '/extended-source-integration/',
    '/external-celestial-sources/',
    '/incident-radiance/',
    '/light/',
    '/physical-frame/',
    '/point-source-raster/',
    '/shader/',
    'acquir',
    'horizons',
    'network',
]);

const mode = parseMode(process.argv);
assertSealedEr6PinsConfigured();
const dependency = await loadSealedEr6Dependency();
const artifacts = await prepareArtifacts(mode, dependency);
let recordCreated = false;

await createFreshRecordDirectory(mode.recordDirectory);
recordCreated = true;

try {
    await writeArtifacts(mode.recordDirectory, artifacts);
    await appendRunLog(
        mode.recordDirectory,
        `${RUNNER} accepted; active reset claim ends at physical pre-display radiance; `
            + 'observer/background, human review, and numerical detection not claimed.',
    );
    console.log(JSON.stringify({
        status: artifacts.result.status,
        claimBoundaryStatus: artifacts.result.claimBoundaryStatus,
        observerBackgroundValidationStatus:
            artifacts.result.observerBackgroundValidationStatus,
        observationalStatus: artifacts.result.observationalStatus,
        acceptedCriterionCount: artifacts.result.acceptedCriterionCount,
        criterionCount: artifacts.result.criterionCount,
        recordDirectory: mode.recordDirectory,
    }));
} catch (error) {
    if (recordCreated) {
        await writeFailureArtifacts(mode.recordDirectory, error);
    }
    throw error;
}

async function loadSealedEr6Dependency() {
    const paths = Object.freeze(Object.fromEntries(
        Object.entries(SEALED_ER6_FILES).map(([id, filename]) => [
            id,
            resolve(SEALED_ER6_DIRECTORY, filename),
        ]),
    ));
    const [resultBytes, criteriaBytes, matrixBytes, sourceReferenceBytes] =
        await Promise.all([
            readFile(paths.result),
            readFile(paths.criteriaResults),
            readFile(paths.physicalGlobeSceneMatrix),
            readFile(paths.sourceReferences),
        ]);
    const actualHashes = Object.freeze({
        resultSha256: sha256(resultBytes),
        criteriaResultsSha256: sha256(criteriaBytes),
        physicalGlobeSceneMatrixSha256: sha256(matrixBytes),
        sourceReferencesSha256: sha256(sourceReferenceBytes),
    });
    const fileHashesMatch = deepEqualJson(actualHashes, SEALED_ER6_PINS);

    if (!fileHashesMatch) {
        throw new Error(
            'Accepted record 056 hashes do not match the configured ER7 pins.',
        );
    }

    const failureArtifactPresent = await fileExists(paths.failure);
    if (failureArtifactPresent) {
        throw new Error('Accepted record 056 unexpectedly contains failure.json.');
    }

    const result = parseJson(resultBytes, SEALED_ER6_FILES.result);
    const criteriaResults = parseJson(criteriaBytes, SEALED_ER6_FILES.criteriaResults);
    const matrix = parseJson(matrixBytes, SEALED_ER6_FILES.physicalGlobeSceneMatrix);
    const sourceReferences = parseJson(
        sourceReferenceBytes,
        SEALED_ER6_FILES.sourceReferences,
    );

    const sourceReferencesSchemaValid =
        sourceReferences.kind === 'er6-physical-source-inputs-v1';
    if (!sourceReferencesSchemaValid) {
        throw new Error('Record 056 source-reference artifact has the wrong schema.');
    }

    const acceptanceAudit = auditAcceptedEr6Result(result, criteriaResults);
    if (acceptanceAudit.status !== 'accepted') {
        throw new Error(
            'Record 056 result/criteria do not retain the accepted physical-only boundary.',
        );
    }
    const matrixAudit = validateAcceptedEr6Matrix(matrix);
    const integrityAudit = Object.freeze({
        status: fileHashesMatch
            && !failureArtifactPresent
            && sourceReferencesSchemaValid
            && acceptanceAudit.status === 'accepted'
            ? 'accepted'
            : 'rejected',
        expectedFileHashes: SEALED_ER6_PINS,
        actualFileHashes: actualHashes,
        fileHashesMatch,
        failureArtifactPresent,
        failureArtifactAbsent: !failureArtifactPresent,
        sourceReferencesSchemaValid,
        resultAcceptance: acceptanceAudit.resultAcceptance,
        criteriaAcceptance: acceptanceAudit.criteriaAcceptance,
    });

    return Object.freeze({
        result,
        criteriaResults,
        matrix,
        sourceReferences,
        descriptor: Object.freeze({
            kind: 'sealed-er6-physical-globe-scene-dependency-v1',
            recordId: SEALED_ER6_RECORD_ID,
            directory: SEALED_ER6_DIRECTORY,
            fileHashes: actualHashes,
            failureArtifactPresent,
            integrityAudit,
            resultStatus: result.status,
            physicalRadiometryStatus: result.physicalRadiometryStatus,
            geometryDepthStatus: result.geometryDepthStatus,
            mechanicalStatus: result.mechanicalStatus,
            automatedReviewabilityStatus: result.automatedReviewabilityStatus,
            humanReviewStatus: result.humanReviewStatus,
            observationalStatus: result.observationalStatus,
            observerModelClaimed: result.observerModelClaimed,
            caseCount: result.caseCount,
            acceptedCriterionCount: result.acceptedCriterionCount,
            criterionCount: result.criterionCount,
            sourceReferencesKind: sourceReferences.kind,
            basisFingerprint: matrixAudit.basisFingerprint,
            displayFingerprint: matrixAudit.displayFingerprint,
            caseSummaries: matrixAudit.caseSummaries,
            physicalFrame: matrixAudit.physicalFrame,
        }),
        matrixAudit,
    });
}

function auditAcceptedEr6Result(result, criteriaResults) {
    const acceptedResultStatuses = [
        result.status,
        result.sealedAcquisitionStatus,
        result.geometryDepthStatus,
        result.sourceIntegrityStatus,
        result.physicalRadiometryStatus,
        result.mechanicalStatus,
    ];
    const resultAcceptance = Object.freeze({
        allPhysicalStatusesAccepted:
            acceptedResultStatuses.every((status) => status === 'accepted'),
        automatedReviewabilityNotClaimed:
            result.automatedReviewabilityStatus === 'not-claimed',
        humanReviewNotClaimed: result.humanReviewStatus === 'not-claimed',
        observationalVisibilityNotClaimed:
            result.observationalStatus === 'not-claimed',
        observerModelNotClaimed: result.observerModelClaimed === false,
        exactCaseCount: result.caseCount === REQUIRED_CASE_COUNT
            && result.expectedCaseCount === REQUIRED_CASE_COUNT,
        exactCriteriaAcceptance: result.acceptedCriterionCount === result.criterionCount
            && result.criterionCount === 22,
    });

    const acceptedCriteriaStatuses = [
        criteriaResults.status,
        criteriaResults.sealedAcquisitionStatus,
        criteriaResults.geometryDepthStatus,
        criteriaResults.sourceIntegrityStatus,
        criteriaResults.physicalRadiometryStatus,
        criteriaResults.mechanicalStatus,
    ];
    const criteriaAcceptance = Object.freeze({
        allPhysicalStatusesAccepted:
            acceptedCriteriaStatuses.every((status) => status === 'accepted'),
        automatedReviewabilityNotClaimed:
            criteriaResults.automatedReviewabilityStatus === 'not-claimed',
        humanReviewNotClaimed: criteriaResults.humanReviewStatus === 'not-claimed',
        observationalVisibilityNotClaimed:
            criteriaResults.observationalStatus === 'not-claimed',
        exactAcceptedCriterionSet: Array.isArray(criteriaResults.criteria)
            && criteriaResults.criteria.length === 22
            && criteriaResults.criteria.every((entry) => entry.status === 'accepted'),
    });
    const resultAccepted = Object.values(resultAcceptance).every(Boolean);
    const criteriaAccepted = Object.values(criteriaAcceptance).every(Boolean);

    return Object.freeze({
        status: resultAccepted && criteriaAccepted ? 'accepted' : 'rejected',
        resultAcceptance,
        criteriaAcceptance,
    });
}

function validateAcceptedEr6Matrix(matrix) {
    if (
        matrix.kind !== 'er6-physical-globe-scene-validation-matrix-v1'
        || matrix.caseCount !== REQUIRED_CASE_COUNT
        || !Array.isArray(matrix.cases)
        || matrix.cases.length !== REQUIRED_CASE_COUNT
    ) {
        throw new Error('Record 056 does not contain the exact eight-case ER6 matrix.');
    }

    let basisFingerprint = null;
    let displayFingerprint = null;
    const caseSummaries = [];
    for (let index = 0; index < EXPECTED_CASES.length; index += 1) {
        const expected = EXPECTED_CASES[index];
        const entry = matrix.cases[index];
        if (entry.caseId !== expected.caseId || entry.caseOrdinal !== expected.caseOrdinal) {
            throw new Error(`Record 056 case ${index} identity/order changed.`);
        }
        if (
            entry.status?.overallPhysicalCaseStatus !== 'accepted'
            || entry.status?.physicalRadiometryStatus !== 'accepted'
            || entry.status?.mechanicalStatus !== 'accepted'
            || entry.status?.geometryDepthStatus !== 'accepted'
            || entry.status?.automatedReviewabilityStatus !== 'not-claimed'
            || entry.status?.humanReviewStatus !== 'not-claimed'
            || entry.status?.observationalStatus !== 'not-claimed'
        ) {
            throw new Error(`Record 056 case ${entry.caseId} is not accepted as physical-only.`);
        }

        const composition = entry.composition;
        if (
            composition?.kind !== 'physical-spectral-frame-composition-v1'
            || composition.quantity !== PHYSICAL_QUANTITY
            || composition.units !== PHYSICAL_UNITS
            || !Array.isArray(composition.pixels)
            || composition.pixels.length === 0
            || composition.displayPass?.kind
                !== 'one-global-post-composition-display-pass'
            || composition.displayPass.preDisplaySpectralValuesRetained !== true
            || composition.displayPass.sourceSpecificGain !== false
            || composition.displayPass.actualCallCount
                !== composition.displayPass.expectedCallCount
        ) {
            throw new Error(`Record 056 case ${entry.caseId} physical frame is incomplete.`);
        }
        assertDeepEqualJson(composition.sources, EXPECTED_SOURCE_IDS,
            `Record 056 case ${entry.caseId} source identities changed.`);

        for (const pixel of composition.pixels) {
            validatePhysicalPixel(pixel, entry.caseId);
            basisFingerprint ??= pixel.basisFingerprint;
            displayFingerprint ??= pixel.display?.displayFingerprint;
            if (
                pixel.basisFingerprint !== basisFingerprint
                || pixel.display?.displayFingerprint !== displayFingerprint
            ) {
                throw new Error(`Record 056 case ${entry.caseId} changed basis/display identity.`);
            }
        }
        if (composition.displayPass.displayFingerprint !== displayFingerprint) {
            throw new Error(`Record 056 case ${entry.caseId} display identity is inconsistent.`);
        }

        caseSummaries.push(Object.freeze({
            caseId: entry.caseId,
            caseOrdinal: entry.caseOrdinal,
            epochIso: entry.epochIso,
            physicalStatus: entry.status.overallPhysicalCaseStatus,
            automatedReviewabilityStatus: entry.status.automatedReviewabilityStatus,
            humanReviewStatus: entry.status.humanReviewStatus,
            observationalStatus: entry.status.observationalStatus,
        }));
    }

    return Object.freeze({
        basisFingerprint,
        displayFingerprint,
        caseSummaries: Object.freeze(caseSummaries),
        physicalFrame: Object.freeze({
            quantity: PHYSICAL_QUANTITY,
            units: PHYSICAL_UNITS,
            channelCount: REQUIRED_CHANNEL_COUNT,
            components: Object.freeze([
                'path spectral radiance density',
                'view transmittance times endpoint spectral radiance density',
                'already transported extended spectral radiance density',
                'already transported point spectral radiance density',
            ]),
            sourceIds: EXPECTED_SOURCE_IDS,
            preDisplaySpectralValuesRetained: true,
            oneGlobalReviewDisplayPass: true,
        }),
    });
}

function validatePhysicalPixel(pixel, caseId) {
    if (
        pixel.quantity !== PHYSICAL_QUANTITY
        || pixel.units !== PHYSICAL_UNITS
        || !FINGERPRINT_PATTERN.test(pixel.basisFingerprint ?? '')
        || !Array.isArray(pixel.finalSpectralRadianceDensity)
        || pixel.finalSpectralRadianceDensity.length !== REQUIRED_CHANNEL_COUNT
        || !pixel.finalSpectralRadianceDensity.every(Number.isFinite)
        || !FINGERPRINT_PATTERN.test(pixel.display?.displayFingerprint ?? '')
        || pixel.display?.callCount !== 1
    ) {
        throw new Error(`Record 056 case ${caseId} has an invalid physical output pixel.`);
    }
    const actualComponentFields = Object.keys(pixel.components ?? {}).sort();
    const expectedComponentFields = [...PHYSICAL_COMPONENT_FIELDS].sort();
    assertDeepEqualJson(actualComponentFields, expectedComponentFields,
        `Record 056 case ${caseId} physical component set changed.`);
    for (const field of PHYSICAL_COMPONENT_FIELDS) {
        const values = pixel.components[field];
        if (
            !Array.isArray(values)
            || values.length !== REQUIRED_CHANNEL_COUNT
            || !values.every(Number.isFinite)
        ) {
            throw new Error(`Record 056 case ${caseId} component ${field} is invalid.`);
        }
    }
}

async function prepareArtifacts(runMode, sealedDependency) {
    const provenanceBundle = await buildProvenance();
    const claimBoundary = buildClaimBoundary(
        sealedDependency,
        provenanceBundle.moduleGraphAudit,
    );
    const criteria = buildCriteria(
        sealedDependency,
        claimBoundary,
        provenanceBundle.moduleGraphAudit,
    );
    const acceptedCriterionCount = criteria.filter((entry) =>
        entry.status === 'accepted').length;
    const status = acceptedCriterionCount === criteria.length ? 'accepted' : 'rejected';
    const result = Object.freeze({
        status,
        claimBoundaryStatus: status,
        er6DependencyStatus: sealedDependency.descriptor.integrityAudit.status,
        physicalTransportClaimStatus:
            sealedDependency.result.physicalRadiometryStatus,
        observerBackgroundValidationStatus: 'out-of-scope',
        xaR11Status: 'deferred',
        automatedReviewabilityStatus: 'not-claimed',
        humanReviewStatus: 'not-claimed',
        numericalDetectionStatus: 'not-claimed',
        observationalStatus: 'not-claimed',
        observerModelClaimed: false,
        cameraVisibilityClaimed: false,
        humanVisibilityClaimed: false,
        completeSkyBackgroundClaimed: false,
        caseCount: sealedDependency.result.caseCount,
        acceptedCriterionCount,
        criterionCount: criteria.length,
        imageCount: 0,
        gpuClaimed: false,
        productionClaimed: false,
        correctionOf: REJECTED_PREDECESSORS,
        nextStep: 'ER8 CPU convergence and POC cleanup',
    });

    return Object.freeze({
        stateGoal: buildStateGoal(),
        command: Object.freeze({
            runner: RUNNER,
            mode: runMode.kind,
            correctionOf: REJECTED_PREDECESSORS,
            command: runMode.command,
            recordDirectory: runMode.recordDirectory,
            networkAccess: false,
            physicalRendering: false,
            resultBearingPreflight: false,
        }),
        inputs: Object.freeze({
            kind: 'er7-pre-display-claim-boundary-inputs-v3',
            createdAt: nowIso(),
            correctionOf: REJECTED_PREDECESSORS,
            dependencyRecordId: SEALED_ER6_RECORD_ID,
            dependencyFileHashes: SEALED_ER6_PINS,
            selectedClaim: claimBoundary.selectedClaim,
            governingDesignSection:
                'extra-atmosphere-reset-design.md#display-and-observer-boundary',
            governingPlanSection:
                'extra-atmosphere-reset-plan.md#er7-conditional-observer-and-sky-background-validation',
            noNewPhysicalInputs: true,
            noNetworkAcquisition: true,
            noPhysicalRender: true,
        }),
        dependency: sealedDependency.descriptor,
        activeModuleGraph: provenanceBundle.activeModuleGraph,
        claimBoundary,
        equationsAndTolerances: buildEquationsAndTolerances(),
        provenance: provenanceBundle.provenance,
        criteriaResults: Object.freeze({
            status,
            correctionOf: REJECTED_PREDECESSORS,
            claimBoundaryStatus: status,
            er6DependencyStatus: sealedDependency.descriptor.integrityAudit.status,
            physicalTransportClaimStatus:
                sealedDependency.result.physicalRadiometryStatus,
            observerBackgroundValidationStatus: 'out-of-scope',
            xaR11Status: 'deferred',
            automatedReviewabilityStatus: 'not-claimed',
            humanReviewStatus: 'not-claimed',
            numericalDetectionStatus: 'not-claimed',
            observationalStatus: 'not-claimed',
            criteria,
        }),
        result,
        report: buildReport(result),
    });
}

function buildClaimBoundary(dependency, moduleGraphAudit) {
    return Object.freeze({
        kind: 'er7-pre-display-claim-boundary-v3',
        correctionOf: REJECTED_PREDECESSORS,
        decisionOwner:
            'agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md#display-and-observer-boundary',
        scope: 'active-phase-6-reset-physical-pipeline',
        selectedClaim: 'physically-transported-pre-display-spectral-radiance-only',
        physicalOutput: Object.freeze({
            quantity: PHYSICAL_QUANTITY,
            units: PHYSICAL_UNITS,
            channelCount: REQUIRED_CHANNEL_COUNT,
            basisFingerprint: dependency.matrixAudit.basisFingerprint,
            terminalField: 'finalSpectralRadianceDensity',
            components: dependency.matrixAudit.physicalFrame.components,
            sourceIds: EXPECTED_SOURCE_IDS,
            status: 'accepted',
        }),
        displayDisposition: Object.freeze({
            displayFingerprint: dependency.matrixAudit.displayFingerprint,
            role: 'global-review-transfer-after-retained-physical-frame',
            physicalSourceCalibration: false,
            observerOrCameraCalibration: false,
            visibilityEvidence: false,
            qualification:
                'The Figure-1 display conversion is retained mechanical XA-G08 evidence only.',
        }),
        atmospherePathQualification: Object.freeze({
            modeledTerm: 'Algorithm32 direct-solar atmosphere path radiance',
            retainedAsPhysicalTransport: true,
            completeLocalSkyBackgroundClaimed: false,
            qualification:
                'The accepted path term is not relabeled as a complete observed local sky background.',
        }),
        observerBackgroundDisposition: Object.freeze({
            validationStatus: 'out-of-scope',
            xaR11Status: 'deferred',
            observerModelClaimed: false,
            cameraVisibilityClaimed: false,
            humanVisibilityClaimed: false,
            numericalDetectionClaimed: false,
            completeSkyBackgroundClaimed: false,
            omittedObserverTerms: CANONICAL_OBSERVER_TERMS,
            unvalidatedBackgroundTerms: CANONICAL_BACKGROUND_TERMS,
        }),
        executionIsolation: Object.freeze({
            moduleGraphAuditStatus: moduleGraphAudit.status,
            graphFingerprint: moduleGraphAudit.graphFingerprint,
            expectedFileSetExact: moduleGraphAudit.expectedFileSetExact,
            sourcePhysicalAtmosphereModulesExcluded:
                moduleGraphAudit.sourcePhysicalAtmosphereModulesExcluded,
            networkModulesExcluded: moduleGraphAudit.networkModulesExcluded,
        }),
        independentStatuses: Object.freeze({
            mechanical: 'accepted-by-sealed-er6-dependency',
            physicalRadiometry: 'accepted-by-sealed-er6-dependency',
            automatedReviewability: 'not-claimed',
            humanReview: 'not-claimed',
            numericalDetection: 'not-claimed',
            observationalVisibility: 'not-claimed',
        }),
        legacyQualification:
            'This decision governs only the accepted Phase-6 reset path. Legacy POC exports remain non-governing pending ER8 removal and public-surface narrowing.',
        consequence: Object.freeze({
            er7Status: 'resolved-by-explicit-scope-boundary',
            observerBranchSelected: false,
            continueTo: 'ER8 CPU convergence and POC cleanup',
        }),
    });
}

function buildCriteria(dependency, boundary, moduleGraphAudit) {
    const caseStatusesAccepted = dependency.descriptor.caseSummaries.length
        === REQUIRED_CASE_COUNT
        && dependency.descriptor.caseSummaries.every((entry) =>
            entry.physicalStatus === 'accepted');
    const physicalFrameExact = boundary.physicalOutput.quantity === PHYSICAL_QUANTITY
        && boundary.physicalOutput.units === PHYSICAL_UNITS
        && boundary.physicalOutput.channelCount === REQUIRED_CHANNEL_COUNT
        && FINGERPRINT_PATTERN.test(boundary.physicalOutput.basisFingerprint)
        && boundary.physicalOutput.basisFingerprint
            === dependency.matrixAudit.basisFingerprint;
    const expectedComponents = dependency.matrixAudit.physicalFrame.components;
    const componentsExact = deepEqualJson(
        boundary.physicalOutput.components,
        expectedComponents,
    );
    const sourceIdsExact = deepEqualJson(
        boundary.physicalOutput.sourceIds,
        EXPECTED_SOURCE_IDS,
    );
    const reviewOnlyDisplay = boundary.displayDisposition.visibilityEvidence === false
        && boundary.displayDisposition.physicalSourceCalibration === false
        && boundary.displayDisposition.observerOrCameraCalibration === false
        && FINGERPRINT_PATTERN.test(boundary.displayDisposition.displayFingerprint)
        && boundary.displayDisposition.displayFingerprint
            === dependency.matrixAudit.displayFingerprint;
    const noObserverClaim = boundary.observerBackgroundDisposition.observerModelClaimed === false
        && boundary.observerBackgroundDisposition.cameraVisibilityClaimed === false
        && boundary.observerBackgroundDisposition.humanVisibilityClaimed === false
        && boundary.observerBackgroundDisposition.numericalDetectionClaimed === false
        && boundary.observerBackgroundDisposition.completeSkyBackgroundClaimed === false;
    const observerTermsExact = canonicalTermArrayExact(
        boundary.observerBackgroundDisposition.omittedObserverTerms,
        CANONICAL_OBSERVER_TERMS,
    );
    const backgroundTermsExact = canonicalTermArrayExact(
        boundary.observerBackgroundDisposition.unvalidatedBackgroundTerms,
        CANONICAL_BACKGROUND_TERMS,
    );
    const omissionsExplicit = observerTermsExact && backgroundTermsExact;
    const independentStatuses = boundary.independentStatuses.mechanical
        === 'accepted-by-sealed-er6-dependency'
        && dependency.result.mechanicalStatus === 'accepted'
        && boundary.independentStatuses.physicalRadiometry
            === 'accepted-by-sealed-er6-dependency'
        && dependency.result.physicalRadiometryStatus === 'accepted'
        && boundary.independentStatuses.automatedReviewability === 'not-claimed'
        && boundary.independentStatuses.humanReview === 'not-claimed'
        && boundary.independentStatuses.numericalDetection === 'not-claimed'
        && boundary.independentStatuses.observationalVisibility === 'not-claimed';
    const dependencyIntegrity = dependency.descriptor.integrityAudit;
    const dependencyAcceptedFromEvidence = dependencyIntegrity.status === 'accepted'
        && dependencyIntegrity.fileHashesMatch === true
        && dependencyIntegrity.failureArtifactAbsent === true
        && dependencyIntegrity.sourceReferencesSchemaValid === true
        && Object.values(dependencyIntegrity.resultAcceptance).every(Boolean)
        && Object.values(dependencyIntegrity.criteriaAcceptance).every(Boolean)
        && deepEqualJson(
            dependencyIntegrity.actualFileHashes,
            dependencyIntegrity.expectedFileHashes,
        );
    const executionGraphIsolated = moduleGraphAudit.status === 'accepted'
        && moduleGraphAudit.expectedFileSetExact === true
        && moduleGraphAudit.entrySetExact === true
        && moduleGraphAudit.sourcePhysicalAtmosphereModulesExcluded === true
        && moduleGraphAudit.networkModulesExcluded === true;

    return Object.freeze([
        criterion('dependency', 'sealed-er6-integrity-and-acceptance',
            dependencyAcceptedFromEvidence, {
            recordId: SEALED_ER6_RECORD_ID,
            integrityAudit: dependencyIntegrity,
            acceptedCriteria: `${dependency.result.acceptedCriterionCount}/${dependency.result.criterionCount}`,
            }),
        criterion('dependency', 'exact-eight-case-physical-matrix-accepted',
            caseStatusesAccepted, {
                caseCount: dependency.descriptor.caseSummaries.length,
                cases: dependency.descriptor.caseSummaries,
            }),
        criterion('claim', 'terminal-physical-quantity-units-and-basis-explicit',
            physicalFrameExact, {
                boundaryPhysicalOutput: boundary.physicalOutput,
                sealedBasisFingerprint: dependency.matrixAudit.basisFingerprint,
            }),
        criterion('claim', 'accepted-frame-components-and-source-identities-exact',
            componentsExact && sourceIdsExact, {
                expectedComponents,
                actualComponents: boundary.physicalOutput.components,
                expectedSourceIds: EXPECTED_SOURCE_IDS,
                actualSourceIds: boundary.physicalOutput.sourceIds,
            }),
        criterion('display', 'global-display-is-review-transfer-not-visibility-evidence',
            reviewOnlyDisplay, {
                disposition: boundary.displayDisposition,
                sealedDisplayFingerprint: dependency.matrixAudit.displayFingerprint,
            }),
        criterion('observer', 'no-human-camera-or-numerical-detection-claim',
            noObserverClaim, boundary.observerBackgroundDisposition),
        criterion('background', 'observer-and-background-omissions-enumerated',
            omissionsExplicit, {
                omittedObserverTerms:
                    boundary.observerBackgroundDisposition.omittedObserverTerms,
                unvalidatedBackgroundTerms:
                    boundary.observerBackgroundDisposition.unvalidatedBackgroundTerms,
                canonicalObserverTerms: CANONICAL_OBSERVER_TERMS,
                canonicalBackgroundTerms: CANONICAL_BACKGROUND_TERMS,
                observerTermsExact,
                backgroundTermsExact,
            }),
        criterion('background', 'algorithm32-path-not-relabeled-complete-sky',
            boundary.atmospherePathQualification.completeLocalSkyBackgroundClaimed === false,
            boundary.atmospherePathQualification),
        criterion('observer', 'xa-r11-remains-deferred-not-falsely-accepted',
            boundary.observerBackgroundDisposition.validationStatus === 'out-of-scope'
                && boundary.observerBackgroundDisposition.xaR11Status === 'deferred', {
                    validationStatus:
                        boundary.observerBackgroundDisposition.validationStatus,
                    xaR11Status: boundary.observerBackgroundDisposition.xaR11Status,
                }),
        criterion('classification', 'physical-review-and-observational-statuses-independent',
            independentStatuses, {
                boundaryStatuses: boundary.independentStatuses,
                sealedMechanicalStatus: dependency.result.mechanicalStatus,
                sealedPhysicalRadiometryStatus:
                    dependency.result.physicalRadiometryStatus,
            }),
        criterion('integrity', 'no-source-flux-or-algorithm32-constant-change',
            executionGraphIsolated, moduleGraphAudit),
        criterion('scope', 'legacy-poc-surfaces-excluded-from-accepted-claim',
            boundary.scope === 'active-phase-6-reset-physical-pipeline'
                && boundary.legacyQualification.includes('ER8'), {
                    scope: boundary.scope,
                    qualification: boundary.legacyQualification,
                }),
        criterion('routing', 'observer-branch-not-selected-and-er8-is-next',
            boundary.consequence.observerBranchSelected === false
                && boundary.consequence.continueTo === 'ER8 CPU convergence and POC cleanup',
            boundary.consequence),
    ]);
}

function criterion(scope, name, accepted, evidence) {
    return Object.freeze({
        scope,
        name,
        status: accepted ? 'accepted' : 'rejected',
        evidence,
    });
}

function canonicalTermArrayExact(actual, expected) {
    return Array.isArray(actual)
        && deepEqualJson(actual, expected)
        && actual.every((entry) => typeof entry === 'string' && entry.trim().length > 0)
        && new Set(actual).size === actual.length;
}

function buildEquationsAndTolerances() {
    return Object.freeze({
        kind: 'er7-claim-boundary-equations-and-tolerances-v3',
        correctionOf: REJECTED_PREDECESSORS,
        physicalComposition: Object.freeze({
            equation:
                'L_final(lambda,i) = L_path(lambda,i) + T_view(lambda,i)L_endpoint(lambda,i) + L_extended,transported(lambda,i) + L_point,transported(lambda,i)',
            terminalQuantity: PHYSICAL_QUANTITY,
            terminalUnits: PHYSICAL_UNITS,
            channelCount: REQUIRED_CHANNEL_COUNT,
            displayOrdering:
                'retain L_final before one shared review display conversion',
        }),
        decisionLogic: Object.freeze({
            equation:
                'ER7 accepted = accepted sealed ER6 physical dependency AND explicit pre-display-only claim AND observer/background statuses remain out-of-scope/not-claimed',
            numericalTolerance: 'not-applicable; exact classification and identity checks only',
            physicalRecomputation: 'none',
        }),
    });
}

async function buildProvenance() {
    const localModuleGraph = await new LocalModuleGraphHasher({
        workspaceRoot: process.cwd(),
        allowedRoot: 'scripts/flat/reconciliation/POC/src',
    }).collect([RUNNER_PATH]);
    const actualModulePaths = Object.keys(localModuleGraph.files).sort();
    const prohibitedModulePaths = actualModulePaths.filter((path) => {
        const normalized = `/${path.toLowerCase()}`;
        return PROHIBITED_ACTIVE_MODULE_FRAGMENTS.some((fragment) =>
            normalized.includes(fragment));
    });
    const networkImportSpecifiers = await findNetworkImportSpecifiers(actualModulePaths);
    const expectedFileSetExact = deepEqualJson(
        actualModulePaths,
        EXPECTED_ACTIVE_MODULE_PATHS,
    );
    const entrySetExact = deepEqualJson(localModuleGraph.entries, [RUNNER_PATH]);
    const sourcePhysicalAtmosphereModulesExcluded = prohibitedModulePaths.length === 0;
    const networkModulesExcluded = networkImportSpecifiers.length === 0;
    const moduleGraphAudit = Object.freeze({
        kind: 'er7-active-module-graph-audit-v1',
        status: expectedFileSetExact
            && entrySetExact
            && sourcePhysicalAtmosphereModulesExcluded
            && networkModulesExcluded
            ? 'accepted'
            : 'rejected',
        graphFingerprint: localModuleGraph.graphFingerprint,
        expectedModulePaths: EXPECTED_ACTIVE_MODULE_PATHS,
        actualModulePaths: Object.freeze(actualModulePaths),
        expectedFileSetExact,
        expectedEntries: Object.freeze([RUNNER_PATH]),
        actualEntries: localModuleGraph.entries,
        entrySetExact,
        prohibitedModuleFragments: PROHIBITED_ACTIVE_MODULE_FRAGMENTS,
        prohibitedModulePaths: Object.freeze(prohibitedModulePaths),
        sourcePhysicalAtmosphereModulesExcluded,
        networkImportSpecifiers: Object.freeze(networkImportSpecifiers),
        networkModulesExcluded,
        qualification:
            'The active decision graph may read sealed evidence and write record artifacts only; it cannot execute renderer, source, atmosphere, acquisition, browser, or network modules.',
    });
    if (moduleGraphAudit.status !== 'accepted') {
        throw new Error(
            'ER7 active module graph reaches an unapproved implementation or network surface.',
        );
    }

    const entries = await Promise.all(PROVENANCE_PATHS.map(async (path) => {
        const bytes = await readFile(resolve(path));
        return Object.freeze({ path, sha256: sha256(bytes) });
    }));
    return Object.freeze({
        activeModuleGraph: Object.freeze({
            kind: 'er7-active-module-graph-evidence-v1',
            correctionOf: REJECTED_PREDECESSORS,
            graph: localModuleGraph,
            audit: moduleGraphAudit,
        }),
        moduleGraphAudit,
        provenance: Object.freeze({
            kind: 'er7-pre-display-claim-boundary-provenance-v3',
            correctionOf: REJECTED_PREDECESSORS,
            sealedDependencyRecordId: SEALED_ER6_RECORD_ID,
            sealedDependencyFileHashes: SEALED_ER6_PINS,
            activeModuleGraphFingerprint: localModuleGraph.graphFingerprint,
            activeModuleGraphAuditStatus: moduleGraphAudit.status,
            localFiles: Object.freeze(entries),
            networkAccess: false,
            physicalRendering: false,
            decisionMethod:
                'exact classification over a hash-pinned accepted ER6 dependency plus active import-graph isolation audit',
        }),
    });
}

function buildStateGoal() {
    return `# ER7 Pre-Display Claim Boundary\n\n`
        + `Record: \`${EXPECTED_RECORD_ID}\`\n\n`
        + '## Corrected Attempt\n\n'
        + 'Records `057-er7-pre-display-claim-boundary` and '
        + '`058-er7-pre-display-claim-boundary` are immutable and rejected after audit. '
        + 'Record 057 used a literal dependency criterion and lacked an active import-graph '
        + 'audit. Record 058 added those audits but did not require exact equality for all '
        + 'sealed boundary identities and canonical observer/background term arrays. This '
        + 'correction does not change the selected pre-display-only claim.\n\n'
        + '## Goal\n\n'
        + 'Resolve the conditional ER7 branch without inventing an observer or sky model. '
        + 'The accepted Phase-6 reset claim ends at physically transported, retained '
        + 'pre-display spectral-radiance density. The shared Figure-1 conversion is review '
        + 'output only. Observer/background validation, human review, numerical detection, '
        + 'and observational visibility remain explicitly out of scope/not claimed.\n\n'
        + '## Dependency\n\n'
        + `Use only sealed accepted record \`${SEALED_ER6_RECORD_ID}\` through four exact `
        + 'SHA-256 pins. Do not render, access the network, change physical source flux, '
        + 'or change Algorithm32 constants.\n\n'
        + '## Exit\n\n'
        + 'Accept only if the physical and observational classifications remain separate, '
        + 'XA-R11 remains deferred, and ER8 is selected next.\n';
}

function buildReport(result) {
    return `# ER7 Pre-Display Claim Boundary\n\n`
        + `Overall decision status: **${result.status}**\n\n`
        + `- Physical transport claim: ${result.physicalTransportClaimStatus}\n`
        + `- Observer/background validation: ${result.observerBackgroundValidationStatus}\n`
        + `- XA-R11: ${result.xaR11Status}\n`
        + `- Automated reviewability: ${result.automatedReviewabilityStatus}\n`
        + `- Human review: ${result.humanReviewStatus}\n`
        + `- Numerical detection: ${result.numericalDetectionStatus}\n`
        + `- Observational visibility: ${result.observationalStatus}\n`
        + `- Criteria: ${result.acceptedCriterionCount}/${result.criterionCount}\n\n`
        + 'The accepted reset claim ends at retained pre-display spectral radiance. '
        + 'Figure-1 RGB is a review transfer, not an eye/camera or visibility model. '
        + 'Proceed to ER8 CPU convergence and POC cleanup.\n';
}

async function writeArtifacts(recordDirectory, value) {
    await writeText(recordDirectory, 'state-goal.md', value.stateGoal);
    await writeJson(recordDirectory, 'command.json', value.command);
    await writeJson(recordDirectory, 'inputs.json', value.inputs);
    await writeJson(
        recordDirectory,
        'sealed-er6-dependency.json',
        value.dependency,
    );
    await writeJson(
        recordDirectory,
        'active-module-graph.json',
        value.activeModuleGraph,
    );
    await writeJson(recordDirectory, 'claim-boundary.json', value.claimBoundary);
    await writeJson(
        recordDirectory,
        'equations-and-tolerances.json',
        value.equationsAndTolerances,
    );
    await writeJson(recordDirectory, 'provenance.json', value.provenance);
    await writeJson(recordDirectory, 'criteria-results.json', value.criteriaResults);
    await writeJson(recordDirectory, 'result.json', value.result);
    await writeText(recordDirectory, 'report.md', value.report);
}

async function writeFailureArtifacts(recordDirectory, error) {
    await writeJson(recordDirectory, 'failure.json', {
        status: 'invalid',
        runner: RUNNER,
        error: serializeError(error),
    });
    await writeJson(recordDirectory, 'criteria-results.json', {
        status: 'invalid',
        claimBoundaryStatus: 'invalid-attempt',
        observerBackgroundValidationStatus: 'out-of-scope',
        automatedReviewabilityStatus: 'not-claimed',
        humanReviewStatus: 'not-claimed',
        numericalDetectionStatus: 'not-claimed',
        observationalStatus: 'not-claimed',
        criteria: [],
    });
    await writeJson(recordDirectory, 'result.json', {
        status: 'invalid',
        claimBoundaryStatus: 'invalid-attempt',
        observerBackgroundValidationStatus: 'out-of-scope',
        xaR11Status: 'deferred',
        automatedReviewabilityStatus: 'not-claimed',
        humanReviewStatus: 'not-claimed',
        numericalDetectionStatus: 'not-claimed',
        observationalStatus: 'not-claimed',
        observerModelClaimed: false,
    });
    await writeText(recordDirectory, 'report.md', `# ER7 Pre-Display Claim Boundary\n\n`
        + 'Overall status: **invalid**\n\n'
        + 'The decision record did not complete. This numbered directory is immutable; '
        + 'any correction must use a fresh record.\n');
    await appendRunLog(recordDirectory, `${RUNNER} invalid.`);
}

function parseMode(argv) {
    if (argv.includes('--preflight')) {
        throw new Error(
            'Result-bearing preflight is disabled; execute only the predeclared numbered record.',
        );
    }
    if (argv.length !== 4 || argv[2] !== '--record') {
        throw new Error(`Runner requires exactly --record ${EXPECTED_RECORD_DIRECTORY}.`);
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
        command: `node ${RUNNER_PATH} --record ${recordDirectory}`,
    });
}

function assertSealedEr6PinsConfigured() {
    const invalid = Object.entries(SEALED_ER6_PINS).filter(([, value]) =>
        !FINGERPRINT_PATTERN.test(value));
    if (invalid.length > 0) {
        throw new Error(
            'Configure accepted record 056 SHA-256 pins before executing ER7: '
                + invalid.map(([field]) => field).join(', '),
        );
    }
}

function expectedCase(caseOrdinal, caseId) {
    return Object.freeze({ caseOrdinal, caseId });
}

function parseJson(bytes, filename) {
    try {
        return JSON.parse(bytes.toString('utf8'));
    } catch (error) {
        throw new Error(`Cannot parse sealed ER6 ${filename}: ${error.message}`);
    }
}

function sha256(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}

async function findNetworkImportSpecifiers(modulePaths) {
    const found = [];
    const networkPattern = /(?:from\s*|import\s*\(\s*)['"]((?:node:)?(?:http|https|net|tls|dns|dgram|undici)(?:\/[^'"]*)?)['"]/gu;
    for (const path of modulePaths) {
        const source = await readFile(resolve(path), 'utf8');
        for (const match of source.matchAll(networkPattern)) {
            found.push(Object.freeze({ path, specifier: match[1] }));
        }
    }
    return Object.freeze(found);
}

async function fileExists(path) {
    try {
        await readFile(path);
        return true;
    } catch (error) {
        if (error?.code === 'ENOENT') {
            return false;
        }
        throw error;
    }
}

function assertDeepEqualJson(actual, expected, message) {
    if (!deepEqualJson(actual, expected)) {
        throw new Error(message);
    }
}

function deepEqualJson(actual, expected) {
    return canonicalJson(actual) === canonicalJson(expected);
}

function canonicalJson(value) {
    if (Array.isArray(value)) {
        return `[${value.map(canonicalJson).join(',')}]`;
    }
    if (value && typeof value === 'object') {
        return `{${Object.keys(value).sort().map((key) =>
            `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
    }
    return JSON.stringify(value);
}

function serializeError(error) {
    return Object.freeze({
        name: error?.name ?? 'Error',
        message: error?.message ?? String(error),
        stack: error?.stack ?? null,
    });
}
