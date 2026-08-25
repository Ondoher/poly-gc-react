// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md,
//   ER6 exact returned-epoch physical Flat32 globe matrix.
// - tmp/atmosphere/reconciliation/050-er4c-sun-sirius-physical-transport-closure,
//   accepted typed point, extended, full-frame, and one-display contract.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import PerspectiveCameraRaster from '../camera/PerspectiveCameraRaster.js';
import BrunetonColorDisplayModel from '../color/BrunetonColorDisplayModel.js';
import Er6GlobeCaseMatrixResolver from
    '../er6-case-matrix/Er6GlobeCaseMatrixResolver.js';
import Er6LimeGlobeMoonIrradianceProvider from
    '../er6-case-matrix/Er6LimeGlobeMoonIrradianceProvider.js';
import Er6PhysicalGlobeSceneRenderer from
    '../er6-case-matrix/Er6PhysicalGlobeSceneRenderer.js';
import { validateEr6HorizonsPhysicalGlobeStateIntegrity } from
    '../er6-case-matrix/Er6HorizonsPhysicalGlobeStateProvider.js';
import createEr6PhysicalSourceIdentities from
    '../er6-case-matrix/createEr6PhysicalSourceIdentities.js';
import { ER6_FLAT32_DIAGNOSTIC_SOURCE_POLICY } from
    '../er6-case-matrix/er6Flat32DiagnosticSourcePolicyConsts.js';
import { ER6_FLAT32_SCENE_GEOMETRY_FACTS } from
    '../er6-case-matrix/er6Flat32PhysicalSceneGeometryConsts.js';
import LimeCalibrationFixtureReader from
    '../external-celestial-sources/LimeCalibrationFixtureReader.js';
import LimeCoefficientModel from
    '../external-celestial-sources/LimeCoefficientModel.js';
import { createCalspecSiriusIrradianceDensity } from
    '../external-celestial-sources/createCalspecSiriusIrradianceDensity.js';
import { createCanonicalSolarIrradianceDensity } from
    '../external-celestial-sources/createCanonicalSolarIrradianceDensity.js';
import { createCanonicalSpectralDensityBasis } from
    '../external-celestial-sources/createCanonicalSpectralDensityBasis.js';
import { EXTERNAL_CELESTIAL_FIXTURE_MANIFEST } from
    '../external-celestial-sources/fixtureManifest.js';
import LocalModuleGraphHasher from '../provenance/LocalModuleGraphHasher.js';
import { freezeJsonValue, stableHash } from '../provenance/stableHash.js';
import {
    appendRunLog,
    createFreshRecordDirectory,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const RUNNER = 'er6PhysicalGlobeSceneValidation';
const RUNNER_PATH = `scripts/flat/reconciliation/POC/src/runners/${RUNNER}.js`;
const EXPECTED_RECORD_ID = '056-er6-physical-globe-scene-validation';
const EXPECTED_RECORD_DIRECTORY =
    `tmp/atmosphere/reconciliation/${EXPECTED_RECORD_ID}`;
const SEALED_ACQUISITION_RECORD_ID = '054-er6-globe-state-acquisition';
const SEALED_ACQUISITION_DIRECTORY =
    `tmp/atmosphere/reconciliation/${SEALED_ACQUISITION_RECORD_ID}`;

// Fail-loud pre-run configuration pinned only after record 054 was accepted
// and sealed. The runner validates all four files before creating record 056,
// so an absent or tampered dependency cannot consume the number.
const SEALED_ACQUISITION_PINS = Object.freeze({
    resultSha256:
        '8023a1d7f6906ae598b38ca8d29dd8ac35e386259a44097d9ced41725359489c',
    criteriaResultsSha256:
        '42b7306b2eecf04f22718bf36892e30d13d509f2ecbc942940314ecffe7f0f5c',
    physicalStateAcquisitionSha256:
        '7f70035ccb704bfca6ef0c05450fa95859ae7ccfd268d08acc14245c2ad52747',
    sourceReferencesSha256:
        '633bb5d4a1071b417b92ca7ac7c75645106133b3e356f4095efb33624af35532',
});

const ACQUISITION_FILES = Object.freeze({
    result: 'result.json',
    criteriaResults: 'criteria-results.json',
    acquisition: 'physical-state-acquisition.json',
    sourceReferences: 'source-references.json',
    failure: 'failure.json',
});
const FIXTURE_ROOT =
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures';
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const REQUIRED_CASE_COUNT = 8;
const CAMERA_CONFIGURATION = Object.freeze({
    widthPixels: 8,
    heightPixels: 6,
    verticalFovDegrees: 70,
});
const ATMOSPHERE_CONTROLS = Object.freeze({
    pathIntervalCount: 6,
    sourceTransmittanceIntervalCount: 4,
    incidentDirectionCount: 4,
    incidentAltitudeBinCount: 4,
});
const EXTENDED_QUADRATURE = Object.freeze({
    sun: Object.freeze({ radialCount: 6, azimuthCount: 24 }),
    moon: Object.freeze({ radialCount: 6, azimuthCount: 24 }),
});
const DEPTH_TIE_TOLERANCE_METERS = 1e-6;
const ROTATION_TOLERANCE = 1e-12;
const OBSERVER_RECONSTRUCTION_TOLERANCE_KILOMETERS = 1e-5;
const SOURCE_DIRECTION_TOLERANCE = 1e-10;
const SOURCE_RECONSTRUCTION_RELATIVE_TOLERANCE = 1e-10;
const CONSERVATION_RELATIVE_TOLERANCE = 1e-12;
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
const PROHIBITED_PHYSICAL_SOURCE_FIELDS = Object.freeze(new Set([
    'albedo',
    'brightness',
    'calibrationScalar',
    'displayRgb',
    'displayRgba',
    'exposure',
    'gain',
    'movedDirection',
    'neutralAlbedo',
    'presentationDirectionOverride',
    'sceneRgb',
    'sourceGain',
]));

const mode = parseMode(process.argv);
assertSealedAcquisitionPinsConfigured();
const sealedDependency = await loadSealedAcquisitionDependency();
const prepared = await prepareStaticBoundary(mode, sealedDependency);
const startedAt = performance.now();
const completedCases = [];
let recordCreated = false;
let sourceBundle = null;

await createFreshRecordDirectory(mode.recordDirectory);
recordCreated = true;

try {
    await writeInitialArtifacts(mode.recordDirectory, prepared);
    await appendRunLog(
        mode.recordDirectory,
        `${RUNNER} started; sealed acquisition 054 and exact eight-case physical boundary verified.`,
    );

    sourceBundle = await loadPhysicalSources();
    await writeJson(
        mode.recordDirectory,
        'source-references.json',
        sourceBundle.recordDescriptor,
    );

    const renderer = new Er6PhysicalGlobeSceneRenderer({
        camera: new PerspectiveCameraRaster(CAMERA_CONFIGURATION),
        canonicalSolarIrradiance: sourceBundle.canonicalSolar,
        calspecSiriusIrradiance: sourceBundle.calspecSirius,
        lunarIrradianceProvider: sourceBundle.lunarProvider,
        displayModel: new BrunetonColorDisplayModel(),
        atmosphereControls: ATMOSPHERE_CONTROLS,
        extendedQuadrature: EXTENDED_QUADRATURE,
        depthTieToleranceMeters: DEPTH_TIE_TOLERANCE_METERS,
    });

    for (const caseAttachment of sealedDependency.attachments) {
        completedCases.push(renderer.renderCase({ caseAttachment }));
    }

    const artifacts = buildResultArtifacts({
        cases: Object.freeze(completedCases),
        renderer,
        prepared,
        sourceBundle,
        elapsedMilliseconds: performance.now() - startedAt,
    });
    await writeResultArtifacts(mode.recordDirectory, artifacts);

    console.log(JSON.stringify({
        status: artifacts.result.status,
        sealedAcquisitionStatus: artifacts.result.sealedAcquisitionStatus,
        geometryDepthStatus: artifacts.result.geometryDepthStatus,
        physicalRadiometryStatus: artifacts.result.physicalRadiometryStatus,
        mechanicalStatus: artifacts.result.mechanicalStatus,
        caseCount: artifacts.result.caseCount,
        acceptedCriterionCount: artifacts.result.acceptedCriterionCount,
        criterionCount: artifacts.result.criterionCount,
        recordDirectory: mode.recordDirectory,
    }));
} catch (error) {
    if (recordCreated) {
        await writeFailureArtifacts({
            recordDirectory: mode.recordDirectory,
            prepared,
            sourceBundle,
            completedCases,
            error,
            elapsedMilliseconds: performance.now() - startedAt,
        });
    }
    throw error;
}

async function loadSealedAcquisitionDependency() {
    const paths = Object.freeze(Object.fromEntries(Object.entries(ACQUISITION_FILES)
        .map(([id, filename]) => [id, resolve(SEALED_ACQUISITION_DIRECTORY, filename)])));
    const [
        resultBytes,
        criteriaBytes,
        acquisitionBytes,
        sourceReferencesBytes,
    ] = await Promise.all([
        readFile(paths.result),
        readFile(paths.criteriaResults),
        readFile(paths.acquisition),
        readFile(paths.sourceReferences),
    ]);
    let failureArtifactPresent = false;
    try {
        await readFile(paths.failure);
        failureArtifactPresent = true;
    } catch (error) {
        if (error?.code !== 'ENOENT') {
            throw error;
        }
    }
    if (failureArtifactPresent) {
        throw new Error('Sealed acquisition dependency contains failure.json.');
    }

    const actualHashes = Object.freeze({
        resultSha256: hashBytes(resultBytes),
        criteriaResultsSha256: hashBytes(criteriaBytes),
        physicalStateAcquisitionSha256: hashBytes(acquisitionBytes),
        sourceReferencesSha256: hashBytes(sourceReferencesBytes),
    });
    for (const [field, expected] of Object.entries(SEALED_ACQUISITION_PINS)) {
        if (actualHashes[field] !== expected) {
            throw new Error(
                `Sealed acquisition ${field} mismatch: expected ${expected}, received ${actualHashes[field]}.`,
            );
        }
    }

    const result = parseJson(resultBytes, ACQUISITION_FILES.result);
    const criteriaResults = parseJson(criteriaBytes, ACQUISITION_FILES.criteriaResults);
    const acquisition = parseJson(acquisitionBytes, ACQUISITION_FILES.acquisition);
    if (
        result.status !== 'accepted'
        || criteriaResults.status !== 'accepted'
        || !Array.isArray(criteriaResults.criteria)
        || criteriaResults.criteria.length === 0
        || !criteriaResults.criteria.every((entry) => entry.status === 'accepted')
        || acquisition.kind !== 'er6-physical-globe-state-matrix-acquisition-v1'
        || acquisition.caseCount !== REQUIRED_CASE_COUNT
        || acquisition.totalQueryCount !== 40
        || result.acquisitionFingerprint !== acquisition.fingerprint
        || !FINGERPRINT_PATTERN.test(acquisition.fingerprint ?? '')
    ) {
        throw new Error(
            'Record 054 is not an accepted, internally aligned eight-case acquisition.',
        );
    }

    const resolver = new Er6GlobeCaseMatrixResolver();
    const sourceIdentitySet = createEr6PhysicalSourceIdentities();
    const canonicalMatrix = resolver.resolveCaseMatrix({
        sourceIdentities: sourceIdentitySet.identities,
    });
    if (
        stableHash(acquisition.caseMatrix) !== stableHash(canonicalMatrix)
        || acquisition.caseMatrix.fingerprint !== canonicalMatrix.fingerprint
        || result.caseMatrixFingerprint !== canonicalMatrix.fingerprint
    ) {
        throw new Error(
            'Sealed acquisition case matrix does not reconstruct from the active resolver.',
        );
    }

    const attachments = acquisition.cases.map((entry, index) => {
        const expected = EXPECTED_CASES[index];
        if (
            entry.caseId !== expected.id
            || entry.caseOrdinal !== expected.ordinal
            || entry.matrixCase.exactTimeIso !== expected.exactTimeIso
            || entry.physicalState.worldState.epochIso !== expected.exactTimeIso
        ) {
            throw new Error(`Sealed acquisition case ${index} drifted from its exact epoch.`);
        }
        validateEr6HorizonsPhysicalGlobeStateIntegrity(entry.physicalState);
        const attachment = resolver.attachReturnedEphemeris({
            matrixCase: canonicalMatrix.cases[index],
            ephemerisState: entry.physicalState,
            rawQueries: entry.rawQueries,
        });
        if (
            attachment.fingerprint !== entry.ephemerisAttachment.fingerprint
            || attachment.returnedEpoch.requestedEpochIso !== expected.exactTimeIso
        ) {
            throw new Error(
                `Sealed acquisition attachment ${expected.id} failed exact reconstruction.`,
            );
        }
        return attachment;
    });

    return Object.freeze({
        recordId: SEALED_ACQUISITION_RECORD_ID,
        directory: SEALED_ACQUISITION_DIRECTORY,
        files: freezeJsonValue(Object.fromEntries([
            ['result', fileDescriptor(paths.result, resultBytes, actualHashes.resultSha256)],
            ['criteriaResults', fileDescriptor(
                paths.criteriaResults,
                criteriaBytes,
                actualHashes.criteriaResultsSha256,
            )],
            ['physicalStateAcquisition', fileDescriptor(
                paths.acquisition,
                acquisitionBytes,
                actualHashes.physicalStateAcquisitionSha256,
            )],
            ['sourceReferences', fileDescriptor(
                paths.sourceReferences,
                sourceReferencesBytes,
                actualHashes.sourceReferencesSha256,
            )],
        ])),
        result,
        criteriaResults,
        acquisition,
        resolver,
        canonicalMatrix,
        sourceIdentitySet,
        attachments: Object.freeze(attachments),
        descriptor: freezeJsonValue({
            kind: 'er6-sealed-globe-state-acquisition-dependency-v1',
            recordId: SEALED_ACQUISITION_RECORD_ID,
            directory: SEALED_ACQUISITION_DIRECTORY,
            acceptedStatus: result.status,
            acquisitionFingerprint: acquisition.fingerprint,
            caseMatrixFingerprint: canonicalMatrix.fingerprint,
            fileHashes: actualHashes,
            failureArtifactPresent,
            reconstructedAttachmentFingerprints:
                attachments.map((entry) => entry.fingerprint),
            maximumObserverReconstructionResidualKilometers:
                maximumObserverResidualFromAcquisition(acquisition),
            exactEpochs: EXPECTED_CASES,
        }),
    });
}

async function prepareStaticBoundary(modeConfiguration, dependency) {
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
            `ER6 physical validation graph contains prohibited modules: ${prohibitedRuntimeModules.join(', ')}.`,
        );
    }
    const dependencyLocks = Object.freeze(Object.fromEntries(await Promise.all(
        DEPENDENCY_LOCK_PATHS.map(async (path) => [path, await hashFile(path)]),
    )));

    return Object.freeze({
        command: Object.freeze({
            commands: Object.freeze([Object.freeze({
                command: modeConfiguration.command,
                timestamp: nowIso(),
                writesRecord: true,
                networkAcquisition: false,
            })]),
        }),
        stateGoal: stateGoalText(),
        inputs: buildInputs(dependency),
        equationsAndTolerances: buildEquationsAndTolerances(),
        acquisitionDependency: dependency.descriptor,
        reconstructedAttachments: freezeJsonValue(dependency.attachments),
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
                accepted: prohibitedRuntimeModules.length === 0,
            }),
            dependencyLocks,
            acquisitionRecord: SEALED_ACQUISITION_RECORD_ID,
            networkAcquisition: false,
            productionImports: false,
            flat32RuntimeImports: false,
        }),
    });
}

async function loadPhysicalSources() {
    const manifest = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST;
    const fixturePaths = Object.freeze({
        canonicalSolarRaw: resolve(FIXTURE_ROOT, manifest.canonicalSolar.fileName),
        calspecSirius: resolve(FIXTURE_ROOT, manifest.siriusCalspec.fileName),
        limeCoefficient: resolve(FIXTURE_ROOT, manifest.limeLunarCandidate
            .coefficients.fileName),
        limeRelease: resolve(FIXTURE_ROOT, manifest.limeLunarCandidate.release.fileName),
        limeAtbd: resolve(FIXTURE_ROOT, manifest.limeLunarCandidate.atbd.fileName),
    });
    const bytes = Object.freeze(Object.fromEntries(await Promise.all(
        Object.entries(fixturePaths).map(async ([id, path]) => [id, await readFile(path)]),
    )));
    const expectedHashes = Object.freeze({
        canonicalSolarRaw: manifest.canonicalSolar.sourceHashSha256,
        calspecSirius: manifest.siriusCalspec.sourceHashSha256,
        limeCoefficient: manifest.limeLunarCandidate.coefficients.sourceHashSha256,
        limeRelease: manifest.limeLunarCandidate.release.sourceHashSha256,
        limeAtbd: manifest.limeLunarCandidate.atbd.sourceHashSha256,
    });
    const fileDescriptors = Object.freeze(Object.fromEntries(
        Object.entries(bytes).map(([id, value]) => {
            const actualHash = hashBytes(value);
            if (actualHash !== expectedHashes[id]) {
                throw new Error(
                    `${id} SHA-256 mismatch: expected ${expectedHashes[id]}, received ${actualHash}.`,
                );
            }
            return [id, fileDescriptor(fixturePaths[id], value, actualHash)];
        }),
    ));

    const basis = createCanonicalSpectralDensityBasis();
    const canonicalSolar = createCanonicalSolarIrradianceDensity(basis);
    const calspec = createCalspecSiriusIrradianceDensity(bytes.calspecSirius, basis);
    const limeFixtures = await new LimeCalibrationFixtureReader().read();
    const limeModel = new LimeCoefficientModel({
        fixtures: limeFixtures,
        basis,
        canonicalSolar,
    });
    const lunarProvider = new Er6LimeGlobeMoonIrradianceProvider({
        model: limeModel,
        sourceId: manifest.limeLunarCandidate.sourceId,
    });
    const recordDescriptor = freezeJsonValue({
        kind: 'er6-physical-source-inputs-v1',
        manifestVersion: manifest.manifestVersion,
        fixtureFiles: fileDescriptors,
        limeEmbeddedAsd: limeFixtures.provenance.asd,
        basis: basis.describe(),
        canonicalSolar: canonicalSolar.describe(),
        calspecSirius: calspec.packet.describe(),
        limeModelPolicy: limeModel.describeExecutablePolicy(),
        lunarProvider: lunarProvider.describe(),
        canonicalRuntimeSolarOwner: manifest.canonicalSolar.runtimeOwner,
        sourceMagnitudePolicy:
            'source packets are consumed unchanged; no body-specific multiplier',
    });

    return Object.freeze({
        basis,
        canonicalSolar,
        calspecSirius: calspec.packet,
        lunarProvider,
        recordDescriptor,
    });
}

function buildResultArtifacts({
    cases,
    renderer,
    prepared: staticBoundary,
    sourceBundle: physicalSources,
    elapsedMilliseconds,
}) {
    const criteria = buildCriteria(cases, staticBoundary, physicalSources);
    const statuses = deriveStatuses(criteria);
    const acceptedCriterionCount = criteria.filter((entry) =>
        entry.status === 'accepted').length;
    const maximumObserverResidual = maximumObserverReconstructionResidual(
        staticBoundary.acquisitionDependency,
    );
    const result = Object.freeze({
        status: statuses.overallStatus,
        sealedAcquisitionStatus: statuses.sealedAcquisitionStatus,
        geometryDepthStatus: statuses.geometryDepthStatus,
        sourceIntegrityStatus: statuses.sourceIntegrityStatus,
        physicalRadiometryStatus: statuses.physicalRadiometryStatus,
        mechanicalStatus: statuses.mechanicalStatus,
        automatedReviewabilityStatus: 'not-claimed',
        humanReviewStatus: 'not-claimed',
        observationalStatus: 'not-claimed',
        caseCount: cases.length,
        expectedCaseCount: REQUIRED_CASE_COUNT,
        cameraPixelCount: CAMERA_CONFIGURATION.widthPixels
            * CAMERA_CONFIGURATION.heightPixels,
        maximumObserverReconstructionResidualKilometers: maximumObserverResidual,
        acquisitionFingerprint:
            staticBoundary.acquisitionDependency.acquisitionFingerprint,
        rendererFingerprint: renderer.fingerprint,
        sourceReferencesFingerprint: stableHash(physicalSources.recordDescriptor),
        acceptedCriterionCount,
        criterionCount: criteria.length,
        elapsedMilliseconds,
        imageCount: 0,
        artificialMoonPlacement: false,
        observerModelClaimed: false,
        gpuClaimed: false,
        productionClaimed: false,
        nextStep: statuses.overallStatus === 'accepted'
            ? 'bound observer/background out or validate a named observer in ER7'
            : 'route the failed criterion to its owning isolated phase and use a fresh record',
    });
    return Object.freeze({
        renderedCases: Object.freeze({
            kind: 'er6-physical-globe-scene-validation-matrix-v1',
            renderer: renderer.describe(),
            caseCount: cases.length,
            cases,
        }),
        criteriaResults: Object.freeze({
            status: statuses.overallStatus,
            ...statuses,
            automatedReviewabilityStatus: 'not-claimed',
            humanReviewStatus: 'not-claimed',
            observationalStatus: 'not-claimed',
            criteria,
        }),
        result,
        report: reportText(result, criteria),
    });
}

function buildCriteria(cases, staticBoundary, physicalSources) {
    const sourceIds = staticBoundary.acquisitionDependency
        .reconstructedAttachmentFingerprints.length === REQUIRED_CASE_COUNT
        ? staticBoundary.reconstructedAttachments[0].matrixCase.sourceIdentities
            .map((entry) => entry.id).sort()
        : [];
    const expectedSourceIds = createEr6PhysicalSourceIdentities().identities
        .map((entry) => entry.id).sort();
    const observerMaximum = maximumObserverReconstructionResidual(
        staticBoundary.acquisitionDependency,
    );
    const matrixResiduals = cases.flatMap((entry) => {
        const transforms = entry.geometry.scene.transforms;
        return [
            ...Object.values(transforms.rotationDiagnostics).flatMap((diagnostic) => [
                diagnostic.maximumRowNormResidual,
                diagnostic.maximumOrthogonalityResidual,
                diagnostic.determinantResidual,
            ]),
            ...Object.values(transforms.inverseDiagnostics),
            transforms.presentationForwardMaximumResidual,
        ];
    });
    const maximumRotationResidual = Math.max(...matrixResiduals);
    const routeResiduals = cases.flatMap((entry) => [
        entry.geometry.sun.modelRouteResidual,
        entry.geometry.sun.sceneRouteResidual,
        entry.geometry.moonDirectionResidual,
    ]);
    const maximumSourceRouteResidual = Math.max(...routeResiduals);
    const moonSourceId = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST
        .limeLunarCandidate.sourceId;
    const expectedBlockerIds = [
        ER6_FLAT32_SCENE_GEOMETRY_FACTS.globeGround.objectId,
        ...ER6_FLAT32_SCENE_GEOMETRY_FACTS.reviewBoxes.map((entry) => entry.objectId),
        moonSourceId,
    ].sort();
    const blockerSets = cases.map((entry) =>
        entry.geometry.blockers.map((blocker) => blocker.id).sort());
    const blockersExact = blockerSets.every((ids) =>
        stableHash(ids) === stableHash(expectedBlockerIds));
    const moonSelfExclusion = cases.every((entry) => {
        const matchingBlocker = entry.geometry.blockers.find((blocker) =>
            blocker.id === entry.sourceIds.moon);
        return matchingBlocker?.kind === 'opaque-finite-body'
            && entry.geometry.scene.moonBlockerPolicy
                === 'finite-sphere-from-same-source-id-center-depth-direction-and-angular-radius'
            && entry.transport.moon.samples.every((sample) =>
                sample.visibility.occluder?.id !== entry.sourceIds.moon
                && sample.visibility.diagnostics?.evaluations?.some((evaluation) =>
                    evaluation.blockerId === entry.sourceIds.moon
                    && evaluation.disposition === 'self-excluded'
                    && evaluation.callbackCallCount === 0));
    });
    const geometryDepthEvidence = cases.map((entry) => Object.freeze({
        caseId: entry.caseId,
        rendererStatus: entry.status.geometryDepthStatus,
        evidence: entry.geometry.depthEvidence,
        accepted: entry.status.geometryDepthStatus === 'accepted'
            && entry.geometry.depthEvidence.status === 'accepted',
    }));
    const renderedSourceIdsExact = cases.every((entry) =>
        stableHash(Object.values(entry.sourceIds).sort())
            === stableHash(expectedSourceIds));
    const canonicalPacketShared = cases.every((entry) =>
        entry.atmosphere.canonicalPacketSharedByIdentity === true
        && entry.sources.sun.geometry.canonicalIrradiancePacketFingerprint
            === physicalSources.canonicalSolar.fingerprint
        && entry.sources.lunarIrradianceEvaluation.canonicalSolar.fingerprint
            === physicalSources.canonicalSolar.fingerprint
        && entry.sources.moon.source.spectralMeasure.provenance
            .limeSourceIdentity.canonicalSolarFingerprint
            === physicalSources.canonicalSolar.fingerprint);
    const sourceReconstruction = cases.map((entry) => Object.freeze({
        caseId: entry.caseId,
        sunMaximumRelativeResidual:
            sunReconstructionResidual(entry, physicalSources.canonicalSolar),
        moonMaximumRelativeResidual:
            entry.sources.moon.reconstruction.maximumRelativeResidual,
        sunProjectedIntegrationMaximumRelativeResidual:
            maximumRelativeSpectralResidual(
                entry.transport.sun.integrals.total.input
                    .projectedSpectralIrradiance.values,
                physicalSources.canonicalSolar.values,
            ),
        moonProjectedIntegrationMaximumRelativeResidual:
            maximumRelativeSpectralResidual(
                entry.transport.moon.integrals.total.input
                    .projectedSpectralIrradiance.values,
                entry.sources.moon.reconstruction.inputSpectralIrradianceValues,
            ),
    }));
    const maximumSourceReconstructionResidual = Math.max(
        ...sourceReconstruction.flatMap((entry) => [
            entry.sunMaximumRelativeResidual,
            entry.moonMaximumRelativeResidual,
            entry.sunProjectedIntegrationMaximumRelativeResidual,
            entry.moonProjectedIntegrationMaximumRelativeResidual,
        ]),
    );
    const pointConservation = cases.map((entry) => {
        const transport = entry.transport.sirius;
        const scale = spectralScale(
            transport.transmittedSpectralIrradiance.values,
        );
        return Object.freeze({
            caseId: entry.caseId,
            residual: transport.accounting.maximumAbsoluteResidual,
            tolerance: scale * CONSERVATION_RELATIVE_TOLERANCE,
            accepted: transport.accounting.maximumAbsoluteResidual
                <= scale * CONSERVATION_RELATIVE_TOLERANCE,
        });
    });
    const extendedConservation = cases.flatMap((entry) => [
        extendedConservationCase(entry.caseId, 'sun', entry.transport.sun),
        extendedConservationCase(entry.caseId, 'moon', entry.transport.moon),
    ]);
    const rearPointCases = cases.filter((entry) =>
        entry.transport.sirius.rasterProjection.forwardCameraHemisphere === false);
    const forwardPointCases = cases.filter((entry) =>
        entry.transport.sirius.rasterProjection.forwardCameraHemisphere === true);
    const rearPointAccounting = rearPointCases.length > 0
        && forwardPointCases.length > 0
        && rearPointCases.every((entry) => {
        const point = entry.transport.sirius;
        return point.rasterProjection.status === 'outside-forward-camera-hemisphere'
            && point.rasterCenter === null
            && point.pixels.length === 0
            && point.response.onFrameWeight === 0
            && point.response.offRasterWeight === 1
            && point.accounting.onFrameResponseWeight === 0
            && point.accounting.offRasterResponseWeight === 1;
    });
    const expectedPixelCount = CAMERA_CONFIGURATION.widthPixels
        * CAMERA_CONFIGURATION.heightPixels;
    const completeBase = cases.every((entry) =>
        entry.baseFrame.complete === true
        && entry.baseFrame.basePixels.length === expectedPixelCount
        && entry.baseFrame.rays.length === expectedPixelCount
        && entry.baseFrame.endpointPolicy
            === 'typed-null-zero-physical-spectral-endpoint'
        && entry.baseFrame.basePixels.every((pixel) =>
            pixel.endpointSpectralRadianceDensity === null));
    const compositionResiduals = cases.map((entry) => {
        const scale = maximumFrameSpectralScale(entry.composition.pixels);
        const relativeResidual = entry.composition.maximumAbsoluteCompositionResidual
            / scale;
        return Object.freeze({
            caseId: entry.caseId,
            maximumAbsoluteResidual:
                entry.composition.maximumAbsoluteCompositionResidual,
            scale,
            relativeResidual,
            tolerance: CONSERVATION_RELATIVE_TOLERANCE,
            accepted: relativeResidual <= CONSERVATION_RELATIVE_TOLERANCE,
        });
    });
    const oneDisplayPerPixel = cases.every((entry) =>
        entry.composition.pixels.length === expectedPixelCount
        && entry.composition.displayPass.expectedCallCount === expectedPixelCount
        && entry.composition.displayPass.actualCallCount === expectedPixelCount
        && entry.composition.displayPass.sourceSpecificGain === false
        && entry.composition.displayPass.preDisplaySpectralValuesRetained === true);
    const syntheticPolicyAccepted = ER6_FLAT32_DIAGNOSTIC_SOURCE_POLICY
        .physicalPolicy.spectralFlux === 0
        && ER6_FLAT32_DIAGNOSTIC_SOURCE_POLICY.physicalPolicy.frameParticipation
            === 'excluded'
        && cases.every((entry) =>
            entry.sources.syntheticFlat32Diagnostics.physicalPolicy.spectralFlux === 0
            && entry.sources.syntheticFlat32Diagnostics.physicalPolicy
                .frameParticipation === 'excluded'
            && entry.transport.sirius.source.id
                === EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.siriusCalspec.sourceId);
    const physicalSourceBoundary = cases.map((entry) => Object.freeze({
        sourceIds: entry.sourceIds,
        sun: entry.sources.sun,
        moon: entry.sources.moon.source,
        sirius: entry.sources.sirius.source,
        atmosphereIllumination: entry.atmosphere.descriptor.illumination,
    }));
    const prohibitedFields = findProhibitedFields(
        physicalSourceBoundary,
        PROHIBITED_PHYSICAL_SOURCE_FIELDS,
    );
    const neutralPointOneTwoPaths = findNamedNumericValue(
        physicalSourceBoundary,
        /albedo/i,
        0.12,
    );
    const neutralPointOneTwoPresent = neutralPointOneTwoPaths.length > 0;
    const physicalOverridesAbsent = cases.every((entry) =>
        maximumAbsoluteDifference(
            entry.geometry.moonTransform.sourceDirectionJ2000,
            entry.sources.moon.source.geometry.sourceDirectionJ2000,
        ) <= SOURCE_DIRECTION_TOLERANCE
        && maximumAbsoluteDifference(
            entry.geometry.moonTransform.directionCamera,
            entry.sources.moon.centerDirectionCamera,
        ) <= SOURCE_DIRECTION_TOLERANCE
        && staticBoundary.reconstructedAttachments[entry.caseOrdinal]
            .sceneGeometry.moon.presentationOverride === null);
    const exactEpochs = cases.length === REQUIRED_CASE_COUNT
        && cases.every((entry, index) => {
        const expected = EXPECTED_CASES[index];
        return entry.caseOrdinal === expected.ordinal
            && entry.caseId === expected.id
            && entry.epochIso === expected.exactTimeIso
            && entry.returnedEpoch.requestedEpochIso === expected.exactTimeIso
            && entry.returnedEpoch.worldStateEpochIso === expected.exactTimeIso
            && entry.returnedEpoch.queryReturnedEpochs.every((epoch) =>
                epoch === expected.exactTimeIso);
    });
    const allCaseMechanicalStatusesAccepted = cases.length === REQUIRED_CASE_COUNT
        && cases.every((entry) => entry.status.mechanicalStatus === 'accepted');
    const allCasePhysicalStatusesAccepted = cases.length === REQUIRED_CASE_COUNT
        && cases.every((entry) =>
            entry.status.physicalRadiometryStatus === 'accepted'
            && entry.status.overallPhysicalCaseStatus === 'accepted');
    const claimsSeparated = cases.every((entry) =>
        entry.status.automatedReviewabilityStatus === 'not-claimed'
        && entry.status.humanReviewStatus === 'not-claimed'
        && entry.status.observationalStatus === 'not-claimed'
        && entry.qualifications.automatedReviewability === 'not-claimed'
        && entry.qualifications.humanReview === 'not-claimed'
        && entry.qualifications.observationalVisibility === 'not-claimed');

    return Object.freeze([
        criterion('sealed-acquisition', 'accepted record 054 bytes and fingerprints are pinned',
            true, staticBoundary.acquisitionDependency),
        criterion('exact-epochs', 'all eight returned epochs equal the predeclared case epochs',
            exactEpochs, { expectedCases: EXPECTED_CASES }),
        criterion('observer-reconstruction', 'sealed Moon/Sun observer reconstruction stays below 1e-5 km',
            observerMaximum < OBSERVER_RECONSTRUCTION_TOLERANCE_KILOMETERS, {
                maximumResidualKilometers: observerMaximum,
                toleranceKilometers: OBSERVER_RECONSTRUCTION_TOLERANCE_KILOMETERS,
            }),
        criterion('camera-geometry', 'all camera/frame matrices remain proper rotations and inverses',
            maximumRotationResidual <= ROTATION_TOLERANCE, {
                maximumRotationResidual,
                tolerance: ROTATION_TOLERANCE,
            }),
        criterion('source-geometry', 'Sun and Moon J2000/local/camera routes agree',
            maximumSourceRouteResidual <= SOURCE_DIRECTION_TOLERANCE, {
                maximumSourceRouteResidual,
                tolerance: SOURCE_DIRECTION_TOLERANCE,
            }),
        criterion('depth-visibility', 'ground, six review boxes, and Moon are exact blockers',
            blockersExact, { expectedBlockerIds, blockerSets }),
        criterion('depth-visibility', 'Moon blocker self-excludes from Moon quadrature',
            moonSelfExclusion, { moonSourceId }),
        criterion('depth-visibility', 'finite base/source depths and self-exclusion diagnostics pass',
            geometryDepthEvidence.length === REQUIRED_CASE_COUNT
                && geometryDepthEvidence.every((entry) => entry.accepted),
            geometryDepthEvidence),
        criterion('source-integrity', 'sealed and rendered Sun, Moon, and Sirius ids are exact',
            stableHash(sourceIds) === stableHash(expectedSourceIds)
                && renderedSourceIdsExact,
            { sourceIds, expectedSourceIds }),
        criterion('source-integrity', 'one canonical solar packet is shared by illumination and disk',
            canonicalPacketShared, {
                canonicalSolarFingerprint: physicalSources.canonicalSolar.fingerprint,
            }),
        criterion('source-integrity', 'Sun and Moon source integrals reconstruct within 1e-10 relative',
            maximumSourceReconstructionResidual
                <= SOURCE_RECONSTRUCTION_RELATIVE_TOLERANCE, {
                maximumSourceReconstructionResidual,
                tolerance: SOURCE_RECONSTRUCTION_RELATIVE_TOLERANCE,
                cases: sourceReconstruction,
            }),
        criterion('conservation', 'Sirius point accounting closes within 1e-12 scale-relative',
            pointConservation.every((entry) => entry.accepted), pointConservation),
        criterion('conservation', 'Sun and Moon extended accounting closes within 1e-12 scale-relative',
            extendedConservation.every((entry) => entry.accepted), extendedConservation),
        criterion('point-raster', 'rear-hemisphere Sirius cases retain full off-raster response',
            rearPointAccounting, {
                rearCaseIds: rearPointCases.map((entry) => entry.caseId),
                forwardCaseIds: forwardPointCases.map((entry) => entry.caseId),
                requirement:
                    'the exact matrix must exercise at least one rear and one forward Sirius projection',
            }),
        criterion('base-frame', 'every 8x6 base frame is complete with typed null endpoint radiometry',
            completeBase, { expectedPixelCount }),
        criterion('composition', 'every retained full-frame component residual closes within 1e-12 scale-relative',
            compositionResiduals.every((entry) => entry.accepted), compositionResiduals),
        criterion('display', 'one shared display conversion runs exactly once per pixel',
            oneDisplayPerPixel, { expectedCallCountPerCase: expectedPixelCount }),
        criterion('synthetic-policy', 'Flat32 synthetic stars and A-H ladder have zero physical flux and are excluded',
            syntheticPolicyAccepted, ER6_FLAT32_DIAGNOSTIC_SOURCE_POLICY),
        criterion('scope-boundary', 'physical sources contain no legacy gains, 0.12, moved bodies, or source/display RGB',
            prohibitedFields.length === 0
                && !neutralPointOneTwoPresent
                && physicalOverridesAbsent, {
                prohibitedFields,
                neutralPointOneTwoPresent,
                neutralPointOneTwoPaths,
                physicalOverridesAbsent,
                finalDisplayQualification:
                    'final composition RGB is retained only after physical spectral composition',
            }),
        criterion('physical-case-status', 'all eight renderer physical-radiometry statuses are accepted',
            allCasePhysicalStatusesAccepted, {
                caseStatuses: cases.map((entry) => Object.freeze({
                    caseId: entry.caseId,
                    physicalRadiometryStatus:
                        entry.status.physicalRadiometryStatus,
                    overallPhysicalCaseStatus:
                        entry.status.overallPhysicalCaseStatus,
                })),
            }),
        criterion('case-matrix', 'all eight renderer mechanical statuses are accepted',
            allCaseMechanicalStatusesAccepted, {
                caseStatuses: cases.map((entry) => Object.freeze({
                    caseId: entry.caseId,
                    mechanicalStatus: entry.status.mechanicalStatus,
                })),
            }),
        criterion('claim-separation', 'human, observer, and reviewability claims remain not-claimed',
            claimsSeparated, {
                automatedReviewability: 'not-claimed',
                humanReview: 'not-claimed',
                observationalVisibility: 'not-claimed',
                imageCount: 0,
                gpu: 'not-claimed',
                production: 'not-claimed',
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
    const sealedAcquisitionStatus = statusFor(['sealed-acquisition']);
    const geometryDepthStatus = statusFor([
        'exact-epochs',
        'observer-reconstruction',
        'camera-geometry',
        'source-geometry',
        'depth-visibility',
        'base-frame',
    ]);
    const sourceIntegrityStatus = statusFor(['source-integrity']);
    const physicalRadiometryStatus = statusFor([
        'source-integrity',
        'conservation',
        'point-raster',
        'physical-case-status',
        'synthetic-policy',
        'scope-boundary',
    ]);
    const mechanicalStatus = statusFor([
        'case-matrix',
        'composition',
        'display',
        'claim-separation',
    ]);
    const allAccepted = criteria.length > 0
        && criteria.every((entry) => entry.status === 'accepted');
    return Object.freeze({
        sealedAcquisitionStatus,
        geometryDepthStatus,
        sourceIntegrityStatus,
        physicalRadiometryStatus,
        mechanicalStatus,
        overallStatus: allAccepted
            && [
                sealedAcquisitionStatus,
                geometryDepthStatus,
                sourceIntegrityStatus,
                physicalRadiometryStatus,
                mechanicalStatus,
            ].every((status) => status === 'accepted')
            ? 'accepted'
            : 'rejected',
    });
}

function buildInputs(dependency) {
    return Object.freeze({
        recordId: EXPECTED_RECORD_ID,
        recordDirectory: EXPECTED_RECORD_DIRECTORY,
        stage: 'ER6-real-Flat32-globe-physical-matrix-validation',
        executionMode:
            'record-only; result-bearing preflight is disabled',
        networkAcquisition: false,
        sealedAcquisition: dependency.descriptor,
        expectedCases: EXPECTED_CASES,
        camera: CAMERA_CONFIGURATION,
        atmosphereControls: ATMOSPHERE_CONTROLS,
        extendedQuadrature: EXTENDED_QUADRATURE,
        depthTieToleranceMeters: DEPTH_TIE_TOLERANCE_METERS,
        sourceIdentities: dependency.sourceIdentitySet.identities,
        applicableXaGates: Object.freeze([
            'XA-G01',
            'XA-G02',
            'XA-G03',
            'XA-G04',
            'XA-G06',
            'XA-G07',
            'XA-G08',
            'XA-G10',
        ]),
        excludedClaims: Object.freeze([
            'automated reviewability',
            'human review',
            'observational visibility',
            'resolved lunar BRDF or texture',
            'near-Moon contact depth',
            'Sirius apparent-place astrometry',
            'GPU',
            'production',
        ]),
    });
}

function buildEquationsAndTolerances() {
    return Object.freeze({
        equations: Object.freeze({
            extendedTransport:
                'L_out(lambda,omega)=L_path(lambda,omega)+V(omega)T(lambda,omega)L_boundary(lambda,omega)',
            pointTransport:
                'L_point(lambda,i)=V_s T(lambda,omega_s) F(lambda) p_i/Omega_i',
            uniformDisk:
                'E_lambda=pi L_lambda sin(alpha)^2',
            pointAccounting:
                'sum_i(L_point(lambda,i)Omega_i)+F_transmitted(lambda)p_off=F_transmitted(lambda)',
            observerReconstruction:
                'observer=bodyGeocentricPosition-bodyTopocentricPosition',
        }),
        exactRequirements: Object.freeze({
            recordDirectory: EXPECTED_RECORD_DIRECTORY,
            acquisitionRecord: SEALED_ACQUISITION_RECORD_ID,
            caseCount: REQUIRED_CASE_COUNT,
            exactEpochs: EXPECTED_CASES,
            camera: CAMERA_CONFIGURATION,
            atmosphereControls: ATMOSPHERE_CONTROLS,
            extendedQuadrature: EXTENDED_QUADRATURE,
            completeBasePixelCount:
                CAMERA_CONFIGURATION.widthPixels * CAMERA_CONFIGURATION.heightPixels,
            componentComposition:
                'path plus transported endpoint plus extended plus point before display',
            displayCallCount: 'exactly one per pixel',
            syntheticSpectralFlux: 0,
        }),
        tolerances: Object.freeze({
            properRotationAndInverse: `<= ${ROTATION_TOLERANCE}`,
            observerReconstructionKilometers:
                `< ${OBSERVER_RECONSTRUCTION_TOLERANCE_KILOMETERS}`,
            sunMoonDirectionRoutes: `<= ${SOURCE_DIRECTION_TOLERANCE}`,
            sourceReconstructionRelative:
                `<= ${SOURCE_RECONSTRUCTION_RELATIVE_TOLERANCE}`,
            pointAndExtendedConservationScaleRelative:
                `<= ${CONSERVATION_RELATIVE_TOLERANCE}`,
            componentCompositionScaleRelative:
                `<= ${CONSERVATION_RELATIVE_TOLERANCE}`,
            sunDistanceKilometers: '<= 1e-6',
            moonDistanceKilometers: '<= 1e-9',
            depthTieMeters: DEPTH_TIE_TOLERANCE_METERS,
            allOtherRequirements: 'exact',
        }),
    });
}

async function writeInitialArtifacts(recordDirectory, staticBoundary) {
    await writeText(recordDirectory, 'state-goal.md', staticBoundary.stateGoal);
    await writeJson(recordDirectory, 'inputs.json', staticBoundary.inputs);
    await writeJson(recordDirectory, 'provenance.json', staticBoundary.provenance);
    await writeJson(
        recordDirectory,
        'sealed-acquisition-dependency.json',
        staticBoundary.acquisitionDependency,
    );
    await writeJson(
        recordDirectory,
        'reconstructed-case-attachments.json',
        staticBoundary.reconstructedAttachments,
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
        'physical-globe-scene-matrix.json',
        artifacts.renderedCases,
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
            + `${artifacts.result.acceptedCriterionCount}/${artifacts.result.criterionCount} criteria; `
            + 'human/observer not-claimed.',
    );
}

async function writeFailureArtifacts({
    recordDirectory,
    prepared: staticBoundary,
    sourceBundle: physicalSources,
    completedCases: cases,
    error,
    elapsedMilliseconds,
}) {
    if (physicalSources) {
        await writeJson(
            recordDirectory,
            'source-references.json',
            physicalSources.recordDescriptor,
        );
    }
    await writeJson(recordDirectory, 'partial-case-results.json', {
        kind: 'er6-partial-physical-globe-scene-validation-v1',
        qualification:
            'Invalid attempt evidence only; never consume as an accepted matrix.',
        caseCount: cases.length,
        cases,
    });
    await writeJson(recordDirectory, 'failure.json', {
        status: 'invalid',
        runner: RUNNER,
        error: serializeError(error),
    });
    await writeJson(recordDirectory, 'criteria-results.json', {
        status: 'invalid',
        sealedAcquisitionStatus: staticBoundary ? 'accepted' : 'invalid-attempt',
        geometryDepthStatus: 'invalid-attempt',
        sourceIntegrityStatus: 'invalid-attempt',
        physicalRadiometryStatus: 'invalid-attempt',
        mechanicalStatus: 'invalid-attempt',
        automatedReviewabilityStatus: 'not-claimed',
        humanReviewStatus: 'not-claimed',
        observationalStatus: 'not-claimed',
        criteria: [],
        qualification:
            'Physical rendering did not complete, so acceptance criteria were not evaluated.',
    });
    await writeJson(recordDirectory, 'result.json', {
        status: 'invalid',
        sealedAcquisitionStatus: staticBoundary ? 'accepted' : 'invalid-attempt',
        geometryDepthStatus: 'invalid-attempt',
        sourceIntegrityStatus: 'invalid-attempt',
        physicalRadiometryStatus: 'invalid-attempt',
        mechanicalStatus: 'invalid-attempt',
        automatedReviewabilityStatus: 'not-claimed',
        humanReviewStatus: 'not-claimed',
        observationalStatus: 'not-claimed',
        completedCaseCount: cases.length,
        elapsedMilliseconds,
        imageCount: 0,
        observerModelClaimed: false,
        gpuClaimed: false,
        productionClaimed: false,
    });
    await writeText(recordDirectory, 'report.md', `# ER6 Physical Globe Scene Validation

Overall status: **invalid**

The numbered physical-render attempt did not complete. See \`failure.json\` and
\`partial-case-results.json\`. This directory is immutable; any correction must
use a fresh numbered record.
`);
    await appendRunLog(
        recordDirectory,
        `${RUNNER} invalid after ${cases.length}/${REQUIRED_CASE_COUNT} cases.`,
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
        command: `node ${RUNNER_PATH} --record ${recordDirectory}`,
    });
}

function assertSealedAcquisitionPinsConfigured() {
    const invalid = Object.entries(SEALED_ACQUISITION_PINS).filter(([, value]) =>
        !FINGERPRINT_PATTERN.test(value));
    if (invalid.length > 0) {
        throw new Error(
            'Configure accepted record 054 SHA-256 pins before executing ER6 physical validation: '
                + invalid.map(([field]) => field).join(', '),
        );
    }
}

function maximumObserverReconstructionResidual(dependencyDescriptor) {
    if (dependencyDescriptor?.maximumObserverReconstructionResidualKilometers
        !== undefined) {
        return dependencyDescriptor.maximumObserverReconstructionResidualKilometers;
    }
    return maximumObserverResidualFromAcquisition(sealedDependency.acquisition);
}

function maximumObserverResidualFromAcquisition(acquisition) {
    const observer = acquisition.observerReconstructionDiagnostics;
    return Math.max(
        observer.maximumMoonSunAgreementKm,
        observer.maximumMoonRetainedResidualKm,
        observer.maximumSunRetainedResidualKm,
        observer.maximumProviderAgreementResidualKm,
    );
}

function sunReconstructionResidual(entry, canonicalSolar) {
    const radiance = entry.sources.sun.spectralMeasure.values;
    const projectedSolidAngle =
        entry.sources.sun.geometry.projectedSolidAngleSteradians;
    const residuals = radiance.map((value, index) => {
        const expected = canonicalSolar.values[index];
        const reconstructed = value * projectedSolidAngle;
        return Math.abs(reconstructed - expected) / Math.max(Math.abs(expected), 1e-30);
    });
    return Math.max(...residuals);
}

function maximumAbsoluteDifference(left, right) {
    return Math.max(...left.map((value, index) => Math.abs(value - right[index])));
}

function extendedConservationCase(caseId, sourceId, integration) {
    const residual = integration.componentConservation.maximumAbsoluteSpectralResidual;
    const scale = spectralScale(
        integration.integrals.total.input.spectralRadianceSolidAngleIntegral.values,
    );
    const tolerance = scale * CONSERVATION_RELATIVE_TOLERANCE;
    return Object.freeze({
        caseId,
        sourceId,
        residual,
        tolerance,
        accepted: residual <= tolerance,
    });
}

function spectralScale(values) {
    return Math.max(...values.map((value) => Math.abs(value)), 1e-30);
}

function maximumRelativeSpectralResidual(actual, expected) {
    return Math.max(...actual.map((value, index) =>
        Math.abs(value - expected[index]) / Math.max(Math.abs(expected[index]), 1e-30)));
}

function maximumFrameSpectralScale(pixels) {
    let maximum = 1e-30;
    for (const pixel of pixels) {
        for (const value of pixel.finalSpectralRadianceDensity) {
            maximum = Math.max(maximum, Math.abs(value));
        }
    }
    return maximum;
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

function findNamedNumericValue(value, fieldPattern, target, path = '$', found = []) {
    if (!value || typeof value !== 'object') {
        return found;
    }
    if (Array.isArray(value)) {
        value.forEach((entry, index) =>
            findNamedNumericValue(entry, fieldPattern, target, `${path}[${index}]`, found));
        return found;
    }
    for (const [field, entry] of Object.entries(value)) {
        const fieldPath = `${path}.${field}`;
        if (fieldPattern.test(field) && entry === target) {
            found.push(fieldPath);
        }
        findNamedNumericValue(entry, fieldPattern, target, fieldPath, found);
    }
    return found;
}

function stateGoalText() {
    return `# State Goal

Execute ${EXPECTED_RECORD_ID} once, without network access, against the exact
accepted and SHA-256-pinned record-054 returned-epoch acquisition. Reconstruct
all eight resolver-owned attachments from its raw acquisitions, then render the
bounded 8x6, 70-degree Flat32 globe matrix with frozen Algorithm32 controls,
canonical Sun, release-authoritative LIME Moon, CALSPEC Sirius, exact depth,
normalized point response, conservative Sun/Moon quadrature, and one display
conversion per pixel.

This record claims ER6 physical pre-display source transport, geometry, depth,
conservation, and composition. It produces no image and makes no automated
reviewability, human-review, observational-visibility, GPU, or production claim.

This is the fresh retry after immutable record 055. Record 055 passed 21/22
criteria, but its renderer status gate read the nonexistent
\`sun.reconstruction.maximumRelativeResidual\` field instead of the accepted
adapter's \`sun.reconstruction.maxRelativeResidual\` field. This retry changes
only that status wiring; it does not change physical inputs, settings,
criteria, or tolerances.
`;
}

function reportText(result, criteria) {
    return `# ER6 Physical Globe Scene Validation

Overall status: **${result.status}**

- Sealed acquisition: ${result.sealedAcquisitionStatus}
- Geometry and depth: ${result.geometryDepthStatus}
- Source integrity: ${result.sourceIntegrityStatus}
- Physical radiometry: ${result.physicalRadiometryStatus}
- Mechanical: ${result.mechanicalStatus}
- Cases: ${result.caseCount}/${result.expectedCaseCount}
- Observer residual: ${result.maximumObserverReconstructionResidualKilometers} km
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

function fileDescriptor(path, bytes, sha256) {
    return Object.freeze({
        path: path.replaceAll('\\', '/'),
        byteLength: bytes.length,
        sha256,
    });
}

function parseJson(bytes, label) {
    try {
        return JSON.parse(bytes.toString('utf8'));
    } catch (error) {
        throw new Error(`${label} is not valid JSON: ${error.message}.`);
    }
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
