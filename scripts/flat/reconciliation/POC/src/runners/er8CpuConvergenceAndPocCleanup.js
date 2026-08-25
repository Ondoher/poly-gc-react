// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md,
//   ER8 CPU convergence and POC cleanup.
// - tmp/atmosphere/reconciliation/056-er6-physical-globe-scene-validation,
//   accepted exact eight-case physical-rendering dependency.
// - tmp/atmosphere/reconciliation/060-er8-cpu-convergence-and-poc-cleanup,
//   accepted mechanics/cleanup and routed atmosphere-control convergence attempt.
// - tmp/atmosphere/reconciliation/064-er8-cpu-convergence-and-poc-cleanup,
//   exact rejected 96/64-to-192/128 routed predecessor for this retry.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import PerspectiveCameraRaster from '../camera/PerspectiveCameraRaster.js';
import BrunetonColorDisplayModel from '../color/BrunetonColorDisplayModel.js';
import Er6LimeGlobeMoonIrradianceProvider from
    '../er6-case-matrix/Er6LimeGlobeMoonIrradianceProvider.js';
import Er6PhysicalGlobeSceneRenderer from
    '../er6-case-matrix/Er6PhysicalGlobeSceneRenderer.js';
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

const RUNNER = 'er8CpuConvergenceAndPocCleanup';
const RUNNER_PATH = `scripts/flat/reconciliation/POC/src/runners/${RUNNER}.js`;
const EXPECTED_RECORD_ID = '065-er8-cpu-convergence-and-poc-cleanup';
const EXPECTED_RECORD_DIRECTORY =
    `tmp/atmosphere/reconciliation/${EXPECTED_RECORD_ID}`;
const SEALED_ER6_RECORD_ID = '056-er6-physical-globe-scene-validation';
const SEALED_ER6_DIRECTORY =
    `tmp/atmosphere/reconciliation/${SEALED_ER6_RECORD_ID}`;
const SEALED_ER8_RECORD_ID = '060-er8-cpu-convergence-and-poc-cleanup';
const SEALED_ER8_DIRECTORY =
    `tmp/atmosphere/reconciliation/${SEALED_ER8_RECORD_ID}`;
const SEALED_ROUTED_RECORD_ID = '064-er8-cpu-convergence-and-poc-cleanup';
const SEALED_ROUTED_DIRECTORY =
    `tmp/atmosphere/reconciliation/${SEALED_ROUTED_RECORD_ID}`;
const FIXTURE_ROOT =
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures';
const ROOT_PUBLIC_INDEX = 'scripts/flat/reconciliation/POC/src/index.js';
const ER6_PUBLIC_INDEX =
    'scripts/flat/reconciliation/POC/src/er6-case-matrix/index.js';
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const REQUIRED_CASE_COUNT = 8;
const CANONICAL_CHANNEL_COUNT = 15;
const EXPECTED_PROFILE_CASE_COUNT = REQUIRED_CASE_COUNT * 2;
const DEPTH_TIE_TOLERANCE_METERS = 1e-6;
const CONSERVATION_RELATIVE_TOLERANCE = 1e-12;
const TENT_RESPONSE_ABSOLUTE_TOLERANCE = 1e-15;
const SPECTRAL_SCALE_FLOOR = 1e-30;

const SEALED_ER6_FILES = Object.freeze({
    result: 'result.json',
    criteriaResults: 'criteria-results.json',
    sceneMatrix: 'physical-globe-scene-matrix.json',
    attachments: 'reconstructed-case-attachments.json',
    sourceReferences: 'source-references.json',
    acquisitionDependency: 'sealed-acquisition-dependency.json',
    failure: 'failure.json',
});

const SEALED_ER6_PINS = Object.freeze({
    resultSha256:
        '1d8c0415b6c58a7c42ce117ac25b79f9d35438628ce363cba9bce3bb5ef71550',
    criteriaResultsSha256:
        '22f38188926a3b221d5b4f3de89278bebcb7ff3d92f617bbe49ee950e2fbe96f',
    sceneMatrixSha256:
        'ac3ca5fd0be281a20e629b9fb669731132703c0106ffdde3c2f2e3ed4245f167',
    attachmentsSha256:
        '66736ad48d3f927f769a161353dd3fa7a5f0bdaccaa09682873431e37d0629de',
    sourceReferencesSha256:
        '79290c5d148fd2233f02b706900c63ecf6ceafeacd750bb29262fa3d740b7a49',
    acquisitionDependencySha256:
        'ee7c0b8b9b7acc156afa35b01070543b5964c2665a36971a39a37ef9f834a627',
});

const SEALED_ER8_FILES = Object.freeze({
    result: 'result.json',
    criteriaResults: 'criteria-results.json',
    sealedRuntimeReproduction: 'sealed-runtime-reproduction.json',
    cleanupInventory: 'cleanup-inventory.json',
    publicSurface: 'public-surface.json',
    activeModuleGraphs: 'active-module-graph.json',
    convergenceResults: 'convergence-results.json',
    failure: 'failure.json',
});

const SEALED_ER8_PINS = Object.freeze({
    resultSha256:
        '0e282e9cd62490ddf8f2db08c850b9c1c1d05ad6e6533e0768853f4d6e52e288',
    criteriaResultsSha256:
        '44e760c1db5249dbbccd160bb55a85edcd47527a5072ecf909a5616a17039b5f',
    sealedRuntimeReproductionSha256:
        '2c4c7295a4da0c8cd3893a2783170c1b36276e39cfa2c6265157610fcdfdcb1c',
    cleanupInventorySha256:
        '27bcbd04d36c2580f8ba914a6478d29e8a1aec64cd8a4ecde1d146ef74eaca9d',
    publicSurfaceSha256:
        '7e9b093eb6c0bfe75020f1a4e325d0efbf4b87beeca09c91d8ea9ea1fd847ffe',
    activeModuleGraphsSha256:
        'aa375f43cf4a137965d4df776892ed8d99921968dd6221d786f5aa5b0358d0b9',
    convergenceResultsSha256:
        '78dbb679e4fc2e7000427e9d754a5a0db8f2f5d6ac1c37ac3a59229ef108463b',
});

const SEALED_ROUTED_FILES = Object.freeze({
    result: 'result.json',
    criteriaResults: 'criteria-results.json',
    convergenceResults: 'convergence-results.json',
    failure: 'failure.json',
});

const SEALED_ROUTED_PINS = Object.freeze({
    resultSha256:
        'e170d353221d557118eb75fe45705c2ac8a1609d716669b58d0247c6cd607f04',
    criteriaResultsSha256:
        'b3fb3b75c476196ef770a7ed6db3f3ab83729faefece0fac5e348d98aa336910',
    convergenceResultsSha256:
        'a93684c312f50a26c64ec38d85243584c98890309e0dcfc474ec6e1f93ac85f4',
});

const SEALED_ROUTED_PROFILE_FINGERPRINTS = Object.freeze({
    runtime:
        'f78159068392d3c2e71e732c9179e0e34013cfa495845f18085dfeeb1055f619',
    reference:
        '24ec8b3315d5038fdfd2f4cc5bd36eb8bd613ce8c39d850ff2256e562b82d4c4',
});

const EXPECTED_ER8_060_REJECTED_CRITERIA = Object.freeze([
    Object.freeze({ scope: 'path', name:
        'path spectral radiance is within one percent per-channel peak-normalized residual' }),
    Object.freeze({ scope: 'transmittance', name:
        'base view transmittance is within 0.005 absolute' }),
    Object.freeze({ scope: 'transmittance', name:
        'exact-source Sirius transmittance is within 0.005 absolute' }),
    Object.freeze({ scope: 'point-transport', name:
        'accounted Sirius transported irradiance is within 0.5 percent' }),
    Object.freeze({ scope: 'extended-transport', name:
        'Sun transported projected irradiance is within 0.5 percent' }),
    Object.freeze({ scope: 'extended-transport', name:
        'Moon transported projected irradiance is within 0.5 percent' }),
    Object.freeze({ scope: 'composition', name:
        'final pre-display spectrum is within one percent per-channel peak-normalized residual' }),
    Object.freeze({ scope: 'display', name:
        'shared display RGB is within one 8-bit code value' }),
]);

const EXPECTED_ROUTED_REJECTED_CRITERIA = Object.freeze([
    Object.freeze({ scope: 'path', name:
        'path spectral radiance is within one percent per-channel peak-normalized residual' }),
    Object.freeze({ scope: 'extended-transport', name:
        'Moon transported projected irradiance is within 0.5 percent' }),
]);

const CAMERA_CONFIGURATION = Object.freeze({
    widthPixels: 8,
    heightPixels: 6,
    verticalFovDegrees: 70,
});
const EXPECTED_PIXEL_SAMPLE_COUNT = REQUIRED_CASE_COUNT
    * CAMERA_CONFIGURATION.widthPixels
    * CAMERA_CONFIGURATION.heightPixels;

const RUNTIME_PROFILE = freezeJsonValue({
    id: 'routed-er8-runtime-path192-source128',
    atmosphereControls: {
        pathIntervalCount: 192,
        sourceTransmittanceIntervalCount: 128,
        incidentDirectionCount: 4,
        incidentAltitudeBinCount: 4,
    },
    extendedQuadrature: {
        sun: { radialCount: 6, azimuthCount: 24 },
        moon: { radialCount: 6, azimuthCount: 24 },
    },
});

const REFERENCE_PROFILE = freezeJsonValue({
    id: 'routed-er8-reference-path384-source256',
    atmosphereControls: {
        pathIntervalCount: 384,
        sourceTransmittanceIntervalCount: 256,
        incidentDirectionCount: 4,
        incidentAltitudeBinCount: 4,
    },
    extendedQuadrature: {
        sun: { radialCount: 6, azimuthCount: 24 },
        moon: { radialCount: 6, azimuthCount: 24 },
    },
});

const TOLERANCES = Object.freeze({
    pathSpectralPeakNormalizedRelative: 0.01,
    viewTransmittanceAbsolute: 0.005,
    exactPointTransmittanceAbsolute: 0.005,
    pointTransportedSpectralPeakNormalizedRelative: 0.005,
    extendedInputProjectedSpectralPeakNormalizedRelative: 0.005,
    extendedTransportedProjectedSpectralPeakNormalizedRelative: 0.005,
    finalSpectralPeakNormalizedRelative: 0.01,
    displayRgbAbsolute: 1 / 255,
    pointResponseAbsolute: TENT_RESPONSE_ABSOLUTE_TOLERANCE,
    componentConservationRelative: CONSERVATION_RELATIVE_TOLERANCE,
});

const EXPECTED_ABSENT_PATHS = Object.freeze([
    'scripts/flat/reconciliation/POC/browser-page/runner.js',
    'scripts/flat/reconciliation/POC/src/external-boundary-radiance/ExternalBoundaryRadiance.js',
    'scripts/flat/reconciliation/POC/src/external-boundary-radiance/consts.js',
    'scripts/flat/reconciliation/POC/src/external-boundary-radiance/types.d.ts',
    'scripts/flat/reconciliation/POC/src/external-celestial-candidates/ControlledCelestialSampleProvider.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-candidates/DistantSunBoundaryCandidateProvider.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-candidates/ExternalCelestialCandidate.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-candidates/ExternalCelestialDepthResolver.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-candidates/GlobeMoonBoundaryCandidateProvider.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-candidates/LocalSunBoundaryCandidateProvider.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-candidates/fixtures/flat-bright-star-subset.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-candidates/sunCandidateUtils.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-candidates/types.d.ts',
    'scripts/flat/reconciliation/POC/src/moon/GlobeMoonSceneRenderer.js',
    'scripts/flat/reconciliation/POC/src/moon/types.d.ts',
    'scripts/flat/reconciliation/POC/src/shader/DistantSphericalShaderContributionFactory.js',
    'scripts/flat/reconciliation/POC/src/soft-shader/CpuPostprocessSoftShader.js',
    'scripts/flat/reconciliation/POC/src/subjective-scenes/Flat32CpuSoftShaderSceneRenderer.js',
    'scripts/flat/reconciliation/POC/src/subjective-scenes/Flat32SceneCelestialProvider.js',
    'scripts/flat/reconciliation/POC/src/subjective-scenes/Flat32SceneStateResolver.js',
]);

const EXPECTED_ROOT_PUBLIC_EXPORT_PATHS = Object.freeze([
    './atmosphere/CanonicalAtmosphere.js',
    './calculator/SpectralCalculator.js',
    './camera/PerspectiveCameraRaster.js',
    './color/BrunetonColorDisplayModel.js',
    './constants/consts.js',
    './directional-visibility/ExactDirectionalVisibilityResolver.js',
    './errors/ReconciliationConfigurationError.js',
    './evaluation/SpectralReferenceEvaluator.js',
    './extended-source-integration/CanonicalUniformSunDiskSource.js',
    './extended-source-integration/SphericalCapQuadrature.js',
    './extended-source-integration/TransportedExtendedSourceIntegrator.js',
    './external-celestial-sources/ExternalCelestialSource.js',
    './external-celestial-sources/SpectralDensityBasis.js',
    './external-celestial-sources/SpectralDensityPacket.js',
    './external-celestial-sources/binPiecewiseLinearSpectralDensity.js',
    './external-celestial-sources/consts.js',
    './external-celestial-sources/createCalspecSiriusIrradianceDensity.js',
    './external-celestial-sources/createCanonicalSolarIrradianceDensity.js',
    './external-celestial-sources/createCanonicalSpectralDensityBasis.js',
    './geometry/SphericalEarthGeometry.js',
    './light/CanonicalSolarIlluminationSource.js',
    './physical-frame/FrozenAtmosphereSpectralFrameEvaluator.js',
    './physical-frame/PhysicalSpectralFrameComposer.js',
    './point-source-raster/BilinearPointResponse.js',
    './point-source-raster/TransportedPointSourceAccumulator.js',
]);

const EXPECTED_ER6_PUBLIC_EXPORT_PATHS = Object.freeze([
    './Er6GlobeCaseMatrixResolver.js',
    './Er6PhysicalGlobeSceneRenderer.js',
    './Er6PhysicalGlobeStateMatrixAcquirer.js',
]);

const EXPECTED_ROOT_PUBLIC_EXPORT_NAMES = Object.freeze([
    'BilinearPointResponse',
    'BrunetonColorDisplayModel',
    'CANONICAL_ATMOSPHERE_CONSTANTS',
    'CANONICAL_DENSITY_BASIS_ID',
    'CANONICAL_DENSITY_QUADRATURE',
    'CANONICAL_DENSITY_SAMPLE_SEMANTICS',
    'CANONICAL_SPECTRAL_BASIS',
    'CANONICAL_SPECTRAL_CHANNELS',
    'CELESTIAL_SOURCE_MEASURE_QUANTITY',
    'CanonicalAtmosphere',
    'CanonicalSolarIlluminationSource',
    'CanonicalUniformSunDiskSource',
    'EXTENDED_CELESTIAL_SOURCE',
    'ExactDirectionalVisibilityResolver',
    'ExternalCelestialSource',
    'FrozenAtmosphereSpectralFrameEvaluator',
    'POINT_CELESTIAL_SOURCE',
    'PerspectiveCameraRaster',
    'PhysicalSpectralFrameComposer',
    'ReconciliationConfigurationError',
    'SPECTRAL_DENSITY_UNITS',
    'SPECTRAL_IRRADIANCE_DENSITY',
    'SPECTRAL_RADIANCE_DENSITY',
    'SpectralCalculator',
    'SpectralDensityBasis',
    'SpectralDensityPacket',
    'SpectralReferenceEvaluator',
    'SphericalCapQuadrature',
    'SphericalEarthGeometry',
    'TransportedExtendedSourceIntegrator',
    'TransportedPointSourceAccumulator',
    'WAVELENGTH_UNITS_NANOMETERS',
    'binPiecewiseLinearSpectralDensity',
    'createCalspecSiriusIrradianceDensity',
    'createCanonicalSolarIrradianceDensity',
    'createCanonicalSpectralDensityBasis',
]);

const EXPECTED_ER6_PUBLIC_EXPORT_NAMES = Object.freeze([
    'Er6GlobeCaseMatrixResolver',
    'Er6PhysicalGlobeSceneRenderer',
    'Er6PhysicalGlobeStateMatrixAcquirer',
]);

const FORBIDDEN_ACTIVE_MODULE_SUFFIXES = Object.freeze([
    '/external-boundary-radiance/ExternalBoundaryRadiance.js',
    '/external-celestial-candidates/ControlledCelestialSampleProvider.js',
    '/external-celestial-candidates/DistantSunBoundaryCandidateProvider.js',
    '/external-celestial-candidates/ExternalCelestialCandidate.js',
    '/external-celestial-candidates/ExternalCelestialDepthResolver.js',
    '/external-celestial-candidates/GlobeMoonBoundaryCandidateProvider.js',
    '/external-celestial-candidates/LocalSunBoundaryCandidateProvider.js',
    '/external-celestial-candidates/sunCandidateUtils.js',
    '/moon/GlobeMoonSceneRenderer.js',
    '/shader/DistantSphericalShaderContributionFactory.js',
    '/soft-shader/CpuPostprocessSoftShader.js',
    '/subjective-scenes/Flat32CpuSoftShaderSceneRenderer.js',
    '/subjective-scenes/Flat32SceneCelestialProvider.js',
    '/subjective-scenes/Flat32SceneStateResolver.js',
    '/subjective-scenes/flat32SceneSnapshot.js',
]);

const RETAINED_SYMBOL_ABSENCE_CHECKS = Object.freeze([
    Object.freeze({
        path: 'scripts/flat/reconciliation/POC/src/color/BrunetonColorDisplayModel.js',
        symbols: Object.freeze([
            'displayRgbToLinearSrgb',
            'neutralLinearSrgbAppearanceTargetToSpectralRadiance',
            'linearSrgbAlbedoToSpectralReflectance',
        ]),
    }),
    Object.freeze({
        path: 'scripts/flat/reconciliation/POC/src/color/types.d.ts',
        symbols: Object.freeze([
            'displayRgbToLinearSrgb',
            'neutralLinearSrgbAppearanceTargetToSpectralRadiance',
            'linearSrgbAlbedoToSpectralReflectance',
        ]),
    }),
    Object.freeze({
        path: 'scripts/flat/reconciliation/POC/src/light/DistantSunLightSource.js',
        symbols: Object.freeze(['createVisibleBodyCandidateProvider']),
    }),
    Object.freeze({
        path: 'scripts/flat/reconciliation/POC/src/light/LocalSunLightSource.js',
        symbols: Object.freeze(['createVisibleBodyCandidateProvider']),
    }),
    Object.freeze({
        path: 'scripts/flat/reconciliation/POC/src/light/types.d.ts',
        symbols: Object.freeze(['createVisibleBodyCandidateProvider']),
    }),
    Object.freeze({
        path: 'scripts/flat/reconciliation/POC/src/soft-shader/types.d.ts',
        symbols: Object.freeze([
            'CpuPostprocessSoftShader',
            'ExternalBoundaryRadianceSample',
        ]),
    }),
    Object.freeze({
        path: 'scripts/flat/reconciliation/POC/src/subjective-scenes/consts.js',
        symbols: Object.freeze(['RECORD_020_PROTOTYPE_STAR_CALIBRATION']),
    }),
]);

const mode = parseMode(process.argv);
assertPinsConfigured();
const sealedEr6 = await loadSealedEr6Dependency();
const sealedEr8 = await loadSealedEr8AttemptDependency();
const sealedRouted = await loadSealedRoutedAttemptDependency(sealedEr8);
const startedAt = performance.now();
let recordCreated = false;
let completedRuntimeCases = [];
let completedReferenceCases = [];

await createFreshRecordDirectory(mode.recordDirectory);
recordCreated = true;

try {
    await writeInitialArtifacts(
        mode.recordDirectory,
        sealedEr6,
        sealedEr8,
        sealedRouted,
        mode,
    );
    await appendRunLog(
        mode.recordDirectory,
        `${RUNNER} started; records 056, 060, and routed predecessor 064 pins verified; no network permitted.`,
    );

    const cleanupAudit = await auditCleanupAndPublicSurface();
    await writeJson(mode.recordDirectory, 'cleanup-inventory.json', cleanupAudit.inventory);
    await writeJson(mode.recordDirectory, 'public-surface.json', cleanupAudit.publicSurface);
    await writeJson(
        mode.recordDirectory,
        'active-module-graph.json',
        cleanupAudit.moduleGraphs,
    );

    const physicalSources = await loadPhysicalSources();
    const sourceDependencyAligned = stableHash(physicalSources.recordDescriptor)
        === sealedEr6.result.sourceReferencesFingerprint
        && stableHash(sealedEr6.sourceReferences)
            === sealedEr6.result.sourceReferencesFingerprint;
    if (!sourceDependencyAligned) {
        throw new Error(
            'Active physical source bundle does not reconstruct accepted record 056.',
        );
    }
    await writeJson(
        mode.recordDirectory,
        'source-references.json',
        physicalSources.recordDescriptor,
    );

    const runtimeExecution = await renderProfile({
        profile: RUNTIME_PROFILE,
        attachments: sealedEr6.attachments,
        physicalSources,
        recordDirectory: mode.recordDirectory,
    });
    completedRuntimeCases = runtimeExecution.cases;
    const referenceExecution = await renderProfile({
        profile: REFERENCE_PROFILE,
        attachments: sealedEr6.attachments,
        physicalSources,
        recordDirectory: mode.recordDirectory,
    });
    completedReferenceCases = referenceExecution.cases;

    const convergence = compareProfiles(
        completedRuntimeCases,
        completedReferenceCases,
    );
    const sealedIdentity = compareSealedIdentity({
        sealedEr6,
        sealedEr8,
        physicalSources,
        convergence,
    });
    const cacheEvidence = buildInactiveCacheEvidence(cleanupAudit.moduleGraphs);
    const criteria = buildCriteria({
        sealedEr6,
        cleanupAudit,
        convergence,
        cacheEvidence,
        sourceDependencyAligned,
        sealedEr8,
        sealedRouted,
        sealedIdentity,
    });
    const statuses = deriveStatuses(criteria);
    const result = freezeJsonValue({
        status: statuses.overallStatus,
        mechanicalStatus: statuses.mechanicalStatus,
        convergenceStatus: statuses.convergenceStatus,
        cleanupStatus: statuses.cleanupStatus,
        cacheStatus: 'not-applicable-inactive',
        sealedEr6Status: sealedEr6.result.status,
        routedEr8Record060Status: sealedEr8.result.status,
        routedEr8Record064Status: sealedRouted.result.status,
        caseCount: completedRuntimeCases.length,
        referenceCaseCount: completedReferenceCases.length,
        acceptedCriterionCount:
            criteria.filter((entry) => entry.status === 'accepted').length,
        criterionCount: criteria.length,
        runtimeProfileFingerprint: stableHash(RUNTIME_PROFILE),
        referenceProfileFingerprint: stableHash(REFERENCE_PROFILE),
        maximumResiduals: convergence.maximumResiduals,
        sealedBaselineReproductionStatus:
            sealedEr8.sealedRuntimeReproduction.accepted
                ? 'accepted'
                : 'rejected',
        elapsedMilliseconds: performance.now() - startedAt,
        networkAcquisition: false,
        observerModelClaimed: false,
        gpuClaimed: false,
        productionClaimed: false,
        nextStep: statuses.overallStatus === 'accepted'
            ? 'make the ER9 GPU and production promotion decision'
            : 'route the two remaining rejected convergence criteria to their owning controls without weakening tolerances',
    });

    await writeJson(
        mode.recordDirectory,
        'runtime-profile.json',
        compactProfile(runtimeExecution),
    );
    await writeJson(
        mode.recordDirectory,
        'reference-profile.json',
        compactProfile(referenceExecution),
    );
    await writeJson(mode.recordDirectory, 'convergence-results.json', convergence);
    await writeJson(mode.recordDirectory, 'sealed-identity.json', sealedIdentity);
    await writeJson(mode.recordDirectory, 'inactive-cache-evidence.json', cacheEvidence);
    await writeJson(mode.recordDirectory, 'criteria-results.json', {
        status: statuses.overallStatus,
        statuses,
        criteria,
    });
    await writeJson(mode.recordDirectory, 'result.json', result);
    await writeText(mode.recordDirectory, 'report.md', reportText(result, criteria));
    await appendRunLog(
        mode.recordDirectory,
        `${RUNNER} ${result.status}; convergence=${result.convergenceStatus}; cleanup=${result.cleanupStatus}.`,
    );

    console.log(JSON.stringify({
        status: result.status,
        mechanicalStatus: result.mechanicalStatus,
        convergenceStatus: result.convergenceStatus,
        cleanupStatus: result.cleanupStatus,
        acceptedCriterionCount: result.acceptedCriterionCount,
        criterionCount: result.criterionCount,
        recordDirectory: mode.recordDirectory,
    }));
} catch (error) {
    if (recordCreated) {
        await writeFailureArtifacts({
            recordDirectory: mode.recordDirectory,
            error,
            sealedEr6,
            sealedEr8,
            sealedRouted,
            completedRuntimeCases,
            completedReferenceCases,
            elapsedMilliseconds: performance.now() - startedAt,
        });
    }
    throw error;
}

async function loadSealedEr6Dependency() {
    const paths = freezeJsonValue(Object.fromEntries(
        Object.entries(SEALED_ER6_FILES)
            .map(([id, filename]) => [id, resolve(SEALED_ER6_DIRECTORY, filename)]),
    ));
    const ids = [
        'result',
        'criteriaResults',
        'sceneMatrix',
        'attachments',
        'sourceReferences',
        'acquisitionDependency',
    ];
    const bytes = Object.freeze(Object.fromEntries(await Promise.all(
        ids.map(async (id) => [id, await readFile(paths[id])]),
    )));
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
        throw new Error('Accepted ER6 dependency unexpectedly contains failure.json.');
    }

    const hashes = freezeJsonValue({
        resultSha256: hashBytes(bytes.result),
        criteriaResultsSha256: hashBytes(bytes.criteriaResults),
        sceneMatrixSha256: hashBytes(bytes.sceneMatrix),
        attachmentsSha256: hashBytes(bytes.attachments),
        sourceReferencesSha256: hashBytes(bytes.sourceReferences),
        acquisitionDependencySha256: hashBytes(bytes.acquisitionDependency),
    });
    for (const [field, expected] of Object.entries(SEALED_ER6_PINS)) {
        if (hashes[field] !== expected) {
            throw new Error(
                `Accepted record 056 ${field} mismatch: expected ${expected}, received ${hashes[field]}.`,
            );
        }
    }

    const result = parseJson(bytes.result, SEALED_ER6_FILES.result);
    const criteriaResults = parseJson(
        bytes.criteriaResults,
        SEALED_ER6_FILES.criteriaResults,
    );
    const attachments = parseJson(bytes.attachments, SEALED_ER6_FILES.attachments);
    const sourceReferences = parseJson(
        bytes.sourceReferences,
        SEALED_ER6_FILES.sourceReferences,
    );
    const acquisitionDependency = parseJson(
        bytes.acquisitionDependency,
        SEALED_ER6_FILES.acquisitionDependency,
    );
    if (
        result.status !== 'accepted'
        || result.physicalRadiometryStatus !== 'accepted'
        || result.geometryDepthStatus !== 'accepted'
        || result.caseCount !== REQUIRED_CASE_COUNT
        || criteriaResults.status !== 'accepted'
        || !Array.isArray(criteriaResults.criteria)
        || !criteriaResults.criteria.every((entry) => entry.status === 'accepted')
        || !Array.isArray(attachments)
        || attachments.length !== REQUIRED_CASE_COUNT
        || !FINGERPRINT_PATTERN.test(result.rendererFingerprint ?? '')
        || stableHash(sourceReferences) !== result.sourceReferencesFingerprint
    ) {
        throw new Error(
            'Record 056 is not the accepted internally aligned ER6 physical matrix.',
        );
    }

    return Object.freeze({
        recordId: SEALED_ER6_RECORD_ID,
        directory: SEALED_ER6_DIRECTORY,
        result,
        criteriaResults,
        attachments: freezeJsonValue(attachments),
        sourceReferences: freezeJsonValue(sourceReferences),
        acquisitionDependency: freezeJsonValue(acquisitionDependency),
        descriptor: freezeJsonValue({
            kind: 'er8-sealed-er6-physical-scene-dependency-v1',
            recordId: SEALED_ER6_RECORD_ID,
            directory: SEALED_ER6_DIRECTORY,
            acceptedStatus: result.status,
            physicalRadiometryStatus: result.physicalRadiometryStatus,
            geometryDepthStatus: result.geometryDepthStatus,
            caseCount: result.caseCount,
            rendererFingerprint: result.rendererFingerprint,
            sourceReferencesFingerprint: result.sourceReferencesFingerprint,
            acquisitionFingerprint: result.acquisitionFingerprint,
            fileHashes: hashes,
            failureArtifactPresent,
            attachmentFingerprints:
                attachments.map((entry) => entry.fingerprint),
        }),
    });
}

async function loadSealedEr8AttemptDependency() {
    const paths = freezeJsonValue(Object.fromEntries(
        Object.entries(SEALED_ER8_FILES)
            .map(([id, filename]) => [id, resolve(SEALED_ER8_DIRECTORY, filename)]),
    ));
    const ids = [
        'result',
        'criteriaResults',
        'sealedRuntimeReproduction',
        'cleanupInventory',
        'publicSurface',
        'activeModuleGraphs',
        'convergenceResults',
    ];
    const bytes = Object.freeze(Object.fromEntries(await Promise.all(
        ids.map(async (id) => [id, await readFile(paths[id])]),
    )));
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
        throw new Error('Routed ER8 record 060 unexpectedly contains failure.json.');
    }
    const hashes = freezeJsonValue(Object.fromEntries(ids.map((id) => [
        `${id}Sha256`,
        hashBytes(bytes[id]),
    ])));
    for (const [field, expected] of Object.entries(SEALED_ER8_PINS)) {
        if (hashes[field] !== expected) {
            throw new Error(
                `Immutable record 060 ${field} mismatch: expected ${expected}, received ${hashes[field]}.`,
            );
        }
    }
    const parsed = Object.freeze(Object.fromEntries(ids.map((id) => [
        id,
        freezeJsonValue(parseJson(bytes[id], SEALED_ER8_FILES[id])),
    ])));
    const rejectedCriteria = parsed.criteriaResults.criteria
        .filter((entry) => entry.status === 'rejected')
        .map((entry) => ({ scope: entry.scope, name: entry.name }));
    const acceptedCriteria = parsed.criteriaResults.criteria
        .filter((entry) => entry.status === 'accepted');
    const routedFailureSetExact = stableHash(rejectedCriteria)
        === stableHash(EXPECTED_ER8_060_REJECTED_CRITERIA);
    const record060RoutingEvidenceAccepted = validateRecord060RoutingEvidence(
        parsed.convergenceResults,
    );
    const boundaryAccepted = parsed.result.status === 'rejected'
        && parsed.result.mechanicalStatus === 'accepted'
        && parsed.result.cleanupStatus === 'accepted'
        && parsed.result.convergenceStatus === 'rejected'
        && parsed.result.acceptedCriterionCount === 16
        && parsed.result.criterionCount === 24
        && parsed.criteriaResults.status === 'rejected'
        && parsed.criteriaResults.statuses.mechanicalStatus === 'accepted'
        && parsed.criteriaResults.statuses.cleanupStatus === 'accepted'
        && parsed.criteriaResults.statuses.convergenceStatus === 'rejected'
        && parsed.criteriaResults.criteria.length === 24
        && acceptedCriteria.length === 16
        && rejectedCriteria.length === 8
        && routedFailureSetExact
        && parsed.sealedRuntimeReproduction.accepted === true
        && parsed.sealedRuntimeReproduction.rendererFingerprintMatches === true
        && parsed.sealedRuntimeReproduction.sceneMatrixSha256Matches === true
        && parsed.cleanupInventory.accepted === true
        && parsed.publicSurface.accepted === true
        && parsed.activeModuleGraphs.accepted === true
        && parsed.convergenceResults.accepted === false
        && record060RoutingEvidenceAccepted;
    if (!boundaryAccepted) {
        throw new Error(
            'Record 060 is not the exact accepted-cleanup, rejected-only-routed-convergence dependency.',
        );
    }
    return Object.freeze({
        recordId: SEALED_ER8_RECORD_ID,
        directory: SEALED_ER8_DIRECTORY,
        ...parsed,
        descriptor: freezeJsonValue({
            kind: 'er8-routed-record-060-dependency-v1',
            recordId: SEALED_ER8_RECORD_ID,
            directory: SEALED_ER8_DIRECTORY,
            hashes,
            failureArtifactPresent,
            mechanicalStatus: parsed.result.mechanicalStatus,
            cleanupStatus: parsed.result.cleanupStatus,
            convergenceStatus: parsed.result.convergenceStatus,
            acceptedCriterionCount: acceptedCriteria.length,
            rejectedCriterionCount: rejectedCriteria.length,
            rejectedCriteria,
            routedFailureSetExact,
            record060RoutingEvidenceAccepted,
            sealedBaselineReproductionAccepted:
                parsed.sealedRuntimeReproduction.accepted,
            cleanupAccepted: parsed.cleanupInventory.accepted,
            publicSurfaceAccepted: parsed.publicSurface.accepted,
            activeModuleGraphsAccepted: parsed.activeModuleGraphs.accepted,
        }),
    });
}

function validateRecord060RoutingEvidence(convergence) {
    const expectedRuntime = {
        id: 'accepted-er6-runtime',
        atmosphereControls: {
            pathIntervalCount: 6,
            sourceTransmittanceIntervalCount: 4,
            incidentDirectionCount: 4,
            incidentAltitudeBinCount: 4,
        },
        extendedQuadrature: {
            sun: { radialCount: 6, azimuthCount: 24 },
            moon: { radialCount: 6, azimuthCount: 24 },
        },
    };
    const expectedReference = {
        id: 'strict-two-times-er6-reference',
        atmosphereControls: {
            pathIntervalCount: 12,
            sourceTransmittanceIntervalCount: 8,
            incidentDirectionCount: 8,
            incidentAltitudeBinCount: 8,
        },
        extendedQuadrature: {
            sun: { radialCount: 12, azimuthCount: 48 },
            moon: { radialCount: 12, azimuthCount: 48 },
        },
    };
    return stableHash(convergence.runtimeProfile) === stableHash(expectedRuntime)
        && stableHash(convergence.referenceProfile) === stableHash(expectedReference)
        && convergence.metrics.pointResponse.accepted === true
        && convergence.metrics.sunInputProjectedIrradiance.accepted === true
        && convergence.metrics.moonInputProjectedIrradiance.accepted === true
        && convergence.metrics.componentConservation.accepted === true
        && convergence.pointTransmittancePartition.accepted === true
        && convergence.geometryComparisons.length === REQUIRED_CASE_COUNT
        && convergence.geometryComparisons.every((entry) => entry.accepted);
}

async function loadSealedRoutedAttemptDependency(sealedEr8) {
    const paths = freezeJsonValue(Object.fromEntries(
        Object.entries(SEALED_ROUTED_FILES)
            .map(([id, filename]) => [
                id,
                resolve(SEALED_ROUTED_DIRECTORY, filename),
            ]),
    ));
    const ids = ['result', 'criteriaResults', 'convergenceResults'];
    const bytes = Object.freeze(Object.fromEntries(await Promise.all(
        ids.map(async (id) => [id, await readFile(paths[id])]),
    )));
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
        throw new Error('Routed ER8 predecessor 064 unexpectedly contains failure.json.');
    }
    const hashes = freezeJsonValue(Object.fromEntries(ids.map((id) => [
        `${id}Sha256`,
        hashBytes(bytes[id]),
    ])));
    for (const [field, expected] of Object.entries(SEALED_ROUTED_PINS)) {
        if (hashes[field] !== expected) {
            throw new Error(
                `Immutable record 064 ${field} mismatch: expected ${expected}, received ${hashes[field]}.`,
            );
        }
    }
    const parsed = Object.freeze(Object.fromEntries(ids.map((id) => [
        id,
        freezeJsonValue(parseJson(bytes[id], SEALED_ROUTED_FILES[id])),
    ])));
    const rejectedCriteria = parsed.criteriaResults.criteria
        .filter((entry) => entry.status === 'rejected')
        .map((entry) => ({ scope: entry.scope, name: entry.name }));
    const acceptedCriteria = parsed.criteriaResults.criteria
        .filter((entry) => entry.status === 'accepted');
    const routedFailureSetExact = stableHash(rejectedCriteria)
        === stableHash(EXPECTED_ROUTED_REJECTED_CRITERIA);
    const profilesExact = validateRecord064Profiles(
        parsed.result,
        parsed.convergenceResults,
    );
    const baselineIdentityExact = stableHash(
        parsed.convergenceResults.geometryComparisons,
    ) === stableHash(sealedEr8.convergenceResults.geometryComparisons)
        && stableHash(parsed.convergenceResults.pointTransmittancePartition)
            === stableHash(sealedEr8.convergenceResults.pointTransmittancePartition);
    const boundaryAccepted = parsed.result.status === 'rejected'
        && parsed.result.mechanicalStatus === 'accepted'
        && parsed.result.cleanupStatus === 'accepted'
        && parsed.result.convergenceStatus === 'rejected'
        && parsed.result.acceptedCriterionCount === 24
        && parsed.result.criterionCount === 26
        && parsed.criteriaResults.status === 'rejected'
        && parsed.criteriaResults.statuses.mechanicalStatus === 'accepted'
        && parsed.criteriaResults.statuses.cleanupStatus === 'accepted'
        && parsed.criteriaResults.statuses.convergenceStatus === 'rejected'
        && parsed.criteriaResults.criteria.length === 26
        && acceptedCriteria.length === 24
        && rejectedCriteria.length === 2
        && routedFailureSetExact
        && profilesExact
        && baselineIdentityExact
        && parsed.convergenceResults.accepted === false
        && stableHash(parsed.convergenceResults.tolerances)
            === stableHash(TOLERANCES);
    if (!boundaryAccepted) {
        throw new Error(
            'Record 064 is not the exact 24/26 routed-control predecessor.',
        );
    }
    return Object.freeze({
        recordId: SEALED_ROUTED_RECORD_ID,
        directory: SEALED_ROUTED_DIRECTORY,
        ...parsed,
        descriptor: freezeJsonValue({
            kind: 'er8-routed-record-064-dependency-v1',
            recordId: SEALED_ROUTED_RECORD_ID,
            directory: SEALED_ROUTED_DIRECTORY,
            hashes,
            failureArtifactPresent,
            mechanicalStatus: parsed.result.mechanicalStatus,
            cleanupStatus: parsed.result.cleanupStatus,
            convergenceStatus: parsed.result.convergenceStatus,
            acceptedCriterionCount: acceptedCriteria.length,
            rejectedCriterionCount: rejectedCriteria.length,
            rejectedCriteria,
            routedFailureSetExact,
            profilesExact,
            baselineIdentityExact,
            runtimeProfileFingerprint:
                parsed.result.runtimeProfileFingerprint,
            referenceProfileFingerprint:
                parsed.result.referenceProfileFingerprint,
        }),
    });
}

function validateRecord064Profiles(result, convergence) {
    const expectedRuntime = {
        id: 'routed-er8-runtime-path96-source64',
        atmosphereControls: {
            pathIntervalCount: 96,
            sourceTransmittanceIntervalCount: 64,
            incidentDirectionCount: 4,
            incidentAltitudeBinCount: 4,
        },
        extendedQuadrature: {
            sun: { radialCount: 6, azimuthCount: 24 },
            moon: { radialCount: 6, azimuthCount: 24 },
        },
    };
    const expectedReference = {
        id: 'routed-er8-reference-path192-source128',
        atmosphereControls: {
            pathIntervalCount: 192,
            sourceTransmittanceIntervalCount: 128,
            incidentDirectionCount: 4,
            incidentAltitudeBinCount: 4,
        },
        extendedQuadrature: {
            sun: { radialCount: 6, azimuthCount: 24 },
            moon: { radialCount: 6, azimuthCount: 24 },
        },
    };
    return stableHash(convergence.runtimeProfile) === stableHash(expectedRuntime)
        && stableHash(convergence.referenceProfile) === stableHash(expectedReference)
        && result.runtimeProfileFingerprint
            === SEALED_ROUTED_PROFILE_FINGERPRINTS.runtime
        && result.referenceProfileFingerprint
            === SEALED_ROUTED_PROFILE_FINGERPRINTS.reference
        && stableHash(convergence.runtimeProfile)
            === result.runtimeProfileFingerprint
        && stableHash(convergence.referenceProfile)
            === result.referenceProfileFingerprint;
}

async function loadPhysicalSources() {
    const manifest = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST;
    const fixturePaths = Object.freeze({
        canonicalSolarRaw: resolve(FIXTURE_ROOT, manifest.canonicalSolar.fileName),
        calspecSirius: resolve(FIXTURE_ROOT, manifest.siriusCalspec.fileName),
        limeCoefficient: resolve(
            FIXTURE_ROOT,
            manifest.limeLunarCandidate.coefficients.fileName,
        ),
        limeRelease: resolve(FIXTURE_ROOT, manifest.limeLunarCandidate.release.fileName),
        limeAtbd: resolve(FIXTURE_ROOT, manifest.limeLunarCandidate.atbd.fileName),
    });
    const bytes = Object.freeze(Object.fromEntries(await Promise.all(
        Object.entries(fixturePaths)
            .map(async ([id, path]) => [id, await readFile(path)]),
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

async function renderProfile({
    profile,
    attachments,
    physicalSources,
    recordDirectory,
}) {
    const renderer = new Er6PhysicalGlobeSceneRenderer({
        camera: new PerspectiveCameraRaster(CAMERA_CONFIGURATION),
        canonicalSolarIrradiance: physicalSources.canonicalSolar,
        calspecSiriusIrradiance: physicalSources.calspecSirius,
        lunarIrradianceProvider: physicalSources.lunarProvider,
        displayModel: new BrunetonColorDisplayModel(),
        atmosphereControls: profile.atmosphereControls,
        extendedQuadrature: profile.extendedQuadrature,
        depthTieToleranceMeters: DEPTH_TIE_TOLERANCE_METERS,
    });
    const cases = [];
    const profileStartedAt = performance.now();
    for (const attachment of attachments) {
        cases.push(renderer.renderCase({ caseAttachment: attachment }));
        await appendRunLog(
            recordDirectory,
            `${profile.id} completed ${cases.length}/${attachments.length}: ${attachment.matrixCase.id}.`,
        );
    }
    return Object.freeze({
        profile,
        renderer: renderer.describe(),
        rendererFingerprint: renderer.fingerprint,
        cases: Object.freeze(cases),
        elapsedMilliseconds: performance.now() - profileStartedAt,
    });
}

function compareProfiles(runtimeCases, referenceCases) {
    if (
        runtimeCases.length !== REQUIRED_CASE_COUNT
        || referenceCases.length !== REQUIRED_CASE_COUNT
    ) {
        throw new Error('ER8 convergence requires exactly eight cases in each profile.');
    }
    const geometryComparisons = [];
    const pathSamples = [];
    const viewTransmittanceSamples = [];
    const pointTransmittanceSamples = [];
    const pointTransportSamples = [];
    const sunInputSamples = [];
    const moonInputSamples = [];
    const sunTransportSamples = [];
    const moonTransportSamples = [];
    const finalSamples = [];
    const displaySamples = [];
    const responseComparisons = [];
    const pointTransmittancePartition = [];

    for (let caseIndex = 0; caseIndex < REQUIRED_CASE_COUNT; caseIndex += 1) {
        const runtime = runtimeCases[caseIndex];
        const reference = referenceCases[caseIndex];
        if (runtime.caseId !== reference.caseId || runtime.caseOrdinal !== caseIndex) {
            throw new Error(`Profile case-order mismatch at ordinal ${caseIndex}.`);
        }
        assertComparablePixelLayouts(runtime, reference);
        geometryComparisons.push(compareGeometry(runtime, reference));
        for (let pixelIndex = 0; pixelIndex < runtime.baseFrame.basePixels.length;
            pixelIndex += 1) {
            const runtimePixel = runtime.baseFrame.basePixels[pixelIndex];
            const referencePixel = reference.baseFrame.basePixels[pixelIndex];
            const location = `${runtime.caseId}/base/${runtimePixel.pixelX},${runtimePixel.pixelY}`;
            pathSamples.push(spectralSample(
                packetValues(runtimePixel.pathSpectralRadianceDensity, `${location}/runtime-path`),
                packetValues(referencePixel.pathSpectralRadianceDensity, `${location}/reference-path`),
                location,
            ));
            viewTransmittanceSamples.push(spectralSample(
                packetValues(runtimePixel.viewSpectralTransmittance, `${location}/runtime-T`),
                packetValues(referencePixel.viewSpectralTransmittance, `${location}/reference-T`),
                location,
            ));
        }
        collectPointComparisons({
            runtime,
            reference,
            pointTransmittanceSamples,
            pointTransportSamples,
            responseComparisons,
        });
        const runtimePoint = runtime.transport.sirius;
        const referencePoint = reference.transport.sirius;
        pointTransmittancePartition.push(freezeJsonValue({
            caseId: runtime.caseId,
            runtimeVisible: runtimePoint.visibility.visible,
            referenceVisible: referencePoint.visibility.visible,
            runtimeTransmittancePresent: runtimePoint.transmittance != null,
            referenceTransmittancePresent: referencePoint.transmittance != null,
            runtimeSourceDirectionCamera:
                runtimePoint.exactSourceRay.directionCamera,
            referenceSourceDirectionCamera:
                referencePoint.exactSourceRay.directionCamera,
            accepted: runtimePoint.visibility.visible === referencePoint.visibility.visible
                && (runtimePoint.transmittance != null)
                    === runtimePoint.visibility.visible
                && (referencePoint.transmittance != null)
                    === referencePoint.visibility.visible
                && stableHash(runtimePoint.exactSourceRay.directionCamera)
                    === stableHash(referencePoint.exactSourceRay.directionCamera),
        }));
        collectExtendedComparison(
            runtime,
            reference,
            'sun',
            sunInputSamples,
            sunTransportSamples,
        );
        collectExtendedComparison(
            runtime,
            reference,
            'moon',
            moonInputSamples,
            moonTransportSamples,
        );
        for (let pixelIndex = 0; pixelIndex < runtime.composition.pixels.length;
            pixelIndex += 1) {
            const runtimePixel = runtime.composition.pixels[pixelIndex];
            const referencePixel = reference.composition.pixels[pixelIndex];
            const location = `${runtime.caseId}/final/${runtimePixel.pixelX},${runtimePixel.pixelY}`;
            finalSamples.push(spectralSample(
                packetValues(runtimePixel.finalSpectralRadianceDensity, `${location}/runtime`),
                packetValues(referencePixel.finalSpectralRadianceDensity, `${location}/reference`),
                location,
            ));
            displaySamples.push(Object.freeze({
                runtime: validateRgb(runtimePixel.display.rgb, `${location}/runtime-display`),
                reference: validateRgb(
                    referencePixel.display.rgb,
                    `${location}/reference-display`,
                ),
                location,
            }));
        }
    }

    const expectedPointTransmittanceCount = pointTransmittancePartition
        .filter((entry) => entry.runtimeVisible).length;
    const metrics = freezeJsonValue({
        pathSpectral: peakNormalizedSpectralMetric(
            pathSamples,
            TOLERANCES.pathSpectralPeakNormalizedRelative,
            EXPECTED_PIXEL_SAMPLE_COUNT,
        ),
        viewTransmittance: absoluteVectorMetric(
            viewTransmittanceSamples,
            TOLERANCES.viewTransmittanceAbsolute,
            EXPECTED_PIXEL_SAMPLE_COUNT,
        ),
        exactPointTransmittance: absoluteVectorMetric(
            pointTransmittanceSamples,
            TOLERANCES.exactPointTransmittanceAbsolute,
            expectedPointTransmittanceCount,
        ),
        pointTransportedIrradiance: peakNormalizedSpectralMetric(
            pointTransportSamples,
            TOLERANCES.pointTransportedSpectralPeakNormalizedRelative,
            REQUIRED_CASE_COUNT,
        ),
        sunInputProjectedIrradiance: peakNormalizedSpectralMetric(
            sunInputSamples,
            TOLERANCES.extendedInputProjectedSpectralPeakNormalizedRelative,
            REQUIRED_CASE_COUNT,
        ),
        moonInputProjectedIrradiance: peakNormalizedSpectralMetric(
            moonInputSamples,
            TOLERANCES.extendedInputProjectedSpectralPeakNormalizedRelative,
            REQUIRED_CASE_COUNT,
        ),
        sunTransportedProjectedIrradiance: peakNormalizedSpectralMetric(
            sunTransportSamples,
            TOLERANCES.extendedTransportedProjectedSpectralPeakNormalizedRelative,
            REQUIRED_CASE_COUNT,
        ),
        moonTransportedProjectedIrradiance: peakNormalizedSpectralMetric(
            moonTransportSamples,
            TOLERANCES.extendedTransportedProjectedSpectralPeakNormalizedRelative,
            REQUIRED_CASE_COUNT,
        ),
        finalSpectral: peakNormalizedSpectralMetric(
            finalSamples,
            TOLERANCES.finalSpectralPeakNormalizedRelative,
            EXPECTED_PIXEL_SAMPLE_COUNT,
        ),
        displayRgb: absoluteVectorMetric(
            displaySamples,
            TOLERANCES.displayRgbAbsolute,
            EXPECTED_PIXEL_SAMPLE_COUNT,
        ),
        pointResponse: combineResponseComparisons(responseComparisons),
        componentConservation: typedConservationMetric(
            runtimeCases,
            referenceCases,
        ),
    });
    const maximumResiduals = freezeJsonValue(Object.fromEntries(
        Object.entries(metrics).map(([id, metric]) => [id, metric.maximumResidual]),
    ));
    return freezeJsonValue({
        kind: 'er8-runtime-reference-convergence-v1',
        runtimeProfile: RUNTIME_PROFILE,
        referenceProfile: REFERENCE_PROFILE,
        tolerances: TOLERANCES,
        geometryComparisons,
        pointTransmittancePartition: {
            cases: pointTransmittancePartition,
            expectedVisibleSampleCount: expectedPointTransmittanceCount,
            blockedSampleCount: REQUIRED_CASE_COUNT
                - expectedPointTransmittanceCount,
            accepted: expectedPointTransmittanceCount > 0
                && pointTransmittancePartition.length === REQUIRED_CASE_COUNT
                && pointTransmittancePartition.every((entry) => entry.accepted),
        },
        profileCaseStatuses: {
            runtime: runtimeCases.map((entry) => ({
                caseId: entry.caseId,
                ...entry.status,
            })),
            reference: referenceCases.map((entry) => ({
                caseId: entry.caseId,
                ...entry.status,
            })),
        },
        metrics,
        maximumResiduals,
        accepted: geometryComparisons.length === REQUIRED_CASE_COUNT
            && geometryComparisons.every((entry) => entry.accepted)
            && expectedPointTransmittanceCount > 0
            && pointTransmittancePartition.length === REQUIRED_CASE_COUNT
            && pointTransmittancePartition.every((entry) => entry.accepted)
            && Object.values(metrics).every((entry) => entry.accepted),
        failureRouting: {
            pathSpectral: 'increase pathIntervalCount and compare against the next doubling',
            viewOrPointTransmittance:
                'increase the owning path/source-transmittance interval count and compare against the next doubling',
            pointResponse: 'repair the analytic response implementation; do not tune a footprint',
            extended:
                'increase only the failing source quadrature and compare against the next doubling',
            display: 'route to the upstream spectral residual; do not add a display gain',
        },
    });
}

function compareSealedIdentity({
    sealedEr6,
    sealedEr8,
    physicalSources,
    convergence,
}) {
    const attachmentFingerprints = sealedEr6.attachments
        .map((entry) => entry.fingerprint);
    const sealedAttachmentFingerprints = sealedEr6.descriptor
        .attachmentFingerprints;
    const geometryComparisonsMatch = stableHash(convergence.geometryComparisons)
        === stableHash(sealedEr8.convergenceResults.geometryComparisons);
    const pointPartitionMatch = stableHash(convergence.pointTransmittancePartition)
        === stableHash(sealedEr8.convergenceResults.pointTransmittancePartition);
    const sourceReferencesFingerprint = stableHash(physicalSources.recordDescriptor);
    return freezeJsonValue({
        kind: 'er8-routed-sealed-identity-comparison-v1',
        attachmentFingerprints,
        sealedAttachmentFingerprints,
        attachmentFingerprintsMatch:
            stableHash(attachmentFingerprints)
                === stableHash(sealedAttachmentFingerprints),
        expectedSourceReferencesFingerprint:
            sealedEr6.result.sourceReferencesFingerprint,
        actualSourceReferencesFingerprint: sourceReferencesFingerprint,
        sourceReferencesFingerprintMatches:
            sourceReferencesFingerprint
                === sealedEr6.result.sourceReferencesFingerprint,
        sealedGeometryComparisons:
            sealedEr8.convergenceResults.geometryComparisons,
        routedGeometryComparisons: convergence.geometryComparisons,
        geometryComparisonsMatch,
        sealedPointTransmittancePartition:
            sealedEr8.convergenceResults.pointTransmittancePartition,
        routedPointTransmittancePartition:
            convergence.pointTransmittancePartition,
        pointPartitionMatch,
        sealedBaselineReproductionAccepted:
            sealedEr8.sealedRuntimeReproduction.accepted === true,
        accepted: stableHash(attachmentFingerprints)
                === stableHash(sealedAttachmentFingerprints)
            && sourceReferencesFingerprint
                === sealedEr6.result.sourceReferencesFingerprint
            && geometryComparisonsMatch
            && pointPartitionMatch
            && sealedEr8.sealedRuntimeReproduction.accepted === true,
    });
}

function compareGeometry(runtime, reference) {
    const runtimeSignature = geometrySignature(runtime);
    const referenceSignature = geometrySignature(reference);
    return freezeJsonValue({
        caseId: runtime.caseId,
        runtimeFingerprint: stableHash(runtimeSignature),
        referenceFingerprint: stableHash(referenceSignature),
        accepted: stableHash(runtimeSignature) === stableHash(referenceSignature),
    });
}

function assertComparablePixelLayouts(runtime, reference) {
    const expectedPixelCount = CAMERA_CONFIGURATION.widthPixels
        * CAMERA_CONFIGURATION.heightPixels;
    const arrays = [
        ['runtime base', runtime.baseFrame.basePixels],
        ['reference base', reference.baseFrame.basePixels],
        ['runtime composition', runtime.composition.pixels],
        ['reference composition', reference.composition.pixels],
    ];
    for (const [label, pixels] of arrays) {
        if (!Array.isArray(pixels) || pixels.length !== expectedPixelCount) {
            throw new Error(
                `${runtime.caseId} ${label} requires ${expectedPixelCount} pixels.`,
            );
        }
    }
    for (let index = 0; index < expectedPixelCount; index += 1) {
        const coordinates = arrays.map(([, pixels]) =>
            `${pixels[index].pixelX},${pixels[index].pixelY}`);
        if (!coordinates.every((coordinate) => coordinate === coordinates[0])) {
            throw new Error(
                `${runtime.caseId} pixel order mismatch at index ${index}: ${coordinates.join(' versus ')}.`,
            );
        }
    }
}

function geometrySignature(entry) {
    return freezeJsonValue({
        caseId: entry.caseId,
        caseOrdinal: entry.caseOrdinal,
        epochIso: entry.epochIso,
        attachmentFingerprint: entry.attachmentFingerprint,
        physicalStateFingerprint: entry.physicalStateFingerprint,
        sourceIdentitySetFingerprint: entry.sourceIdentitySetFingerprint,
        sourceIds: entry.sourceIds,
        sourceAltitudesDegrees: entry.sourceAltitudesDegrees,
        returnedEpoch: entry.returnedEpoch,
        scene: entry.geometry.scene,
        sun: entry.geometry.sun,
        moonTransform: entry.geometry.moonTransform,
        blockers: entry.geometry.blockers,
        baseRayGeometry: entry.baseFrame.rays.map((ray) => ray.geometry),
        sourceDescriptors: {
            sun: entry.transport.sun.source,
            moon: entry.transport.moon.source,
            sirius: entry.transport.sirius.source,
        },
        sourceDepths: {
            sun: entry.transport.sun.sourceDepth,
            moon: entry.transport.moon.sourceDepth,
            sirius: entry.transport.sirius.exactSourceRay.depth,
        },
        pointVisibility: entry.transport.sirius.visibility,
        pointRasterCenter: entry.transport.sirius.rasterCenter,
        pointRasterProjection: entry.transport.sirius.rasterProjection,
    });
}

function collectPointComparisons({
    runtime,
    reference,
    pointTransmittanceSamples,
    pointTransportSamples,
    responseComparisons,
}) {
    const runtimePoint = runtime.transport.sirius;
    const referencePoint = reference.transport.sirius;
    const location = `${runtime.caseId}/sirius`;
    if ((runtimePoint.transmittance == null) !== (referencePoint.transmittance == null)) {
        pointTransmittanceSamples.push(spectralSample(
            Array(CANONICAL_CHANNEL_COUNT).fill(1),
            Array(CANONICAL_CHANNEL_COUNT).fill(0),
            `${location}/visibility-mismatch`,
        ));
    } else if (runtimePoint.transmittance != null) {
        pointTransmittanceSamples.push(spectralSample(
            packetValues(runtimePoint.transmittance, `${location}/runtime-T`),
            packetValues(referencePoint.transmittance, `${location}/reference-T`),
            `${location}/T`,
        ));
    }
    pointTransportSamples.push(spectralSample(
        packetValues(
            runtimePoint.accountedSpectralIrradiance,
            `${location}/runtime-accounted`,
        ),
        packetValues(
            referencePoint.accountedSpectralIrradiance,
            `${location}/reference-accounted`,
        ),
        `${location}/accounted`,
    ));
    responseComparisons.push(compareTentResponse(
        runtime.caseId,
        runtimePoint,
        referencePoint,
    ));
}

function collectExtendedComparison(
    runtime,
    reference,
    sourceId,
    inputSamples,
    transportedSamples,
) {
    const runtimeTransport = runtime.transport[sourceId];
    const referenceTransport = reference.transport[sourceId];
    const location = `${runtime.caseId}/${sourceId}`;
    inputSamples.push(spectralSample(
        packetValues(
            runtimeTransport.integrals.total.input.projectedSpectralIrradiance,
            `${location}/runtime-input`,
        ),
        packetValues(
            referenceTransport.integrals.total.input.projectedSpectralIrradiance,
            `${location}/reference-input`,
        ),
        `${location}/input`,
    ));
    transportedSamples.push(spectralSample(
        packetValues(
            runtimeTransport.integrals.total.transmitted.projectedSpectralIrradiance,
            `${location}/runtime-transmitted`,
        ),
        packetValues(
            referenceTransport.integrals.total.transmitted.projectedSpectralIrradiance,
            `${location}/reference-transmitted`,
        ),
        `${location}/transmitted`,
    ));
}

function compareTentResponse(caseId, runtimePoint, referencePoint) {
    const oracle = tentResponseOracle({
        rasterProjection: runtimePoint.rasterProjection,
        rasterCenter: runtimePoint.rasterCenter,
        widthPixels: CAMERA_CONFIGURATION.widthPixels,
        heightPixels: CAMERA_CONFIGURATION.heightPixels,
    });
    const runtimeComparison = responseDifference(runtimePoint.response, oracle);
    const referenceComparison = responseDifference(referencePoint.response, oracle);
    return freezeJsonValue({
        caseId,
        runtimeReferenceIdentical:
            stableHash(runtimePoint.response) === stableHash(referencePoint.response),
        runtimeOracle: runtimeComparison,
        referenceOracle: referenceComparison,
        maximumResidual: Math.max(
            runtimeComparison.maximumResidual,
            referenceComparison.maximumResidual,
        ),
        accepted: stableHash(runtimePoint.response) === stableHash(referencePoint.response)
            && runtimeComparison.accepted
            && referenceComparison.accepted,
    });
}

function tentResponseOracle({
    rasterProjection,
    rasterCenter,
    widthPixels,
    heightPixels,
}) {
    if (rasterProjection.status === 'outside-forward-camera-hemisphere') {
        return freezeJsonValue({
            destinations: [{
                pixelX: null,
                pixelY: null,
                weight: 1,
                onFrame: false,
                reason: 'outside-forward-camera-hemisphere',
            }],
            fullWeight: 1,
            onFrameWeight: 0,
            offRasterWeight: 1,
        });
    }
    if (
        rasterProjection.status !== 'projected'
        || !Number.isFinite(rasterCenter?.x)
        || !Number.isFinite(rasterCenter?.y)
    ) {
        throw new Error('Tent-response oracle requires a projected center or rear source.');
    }
    const x0 = Math.floor(rasterCenter.x);
    const y0 = Math.floor(rasterCenter.y);
    const tx = rasterCenter.x - x0;
    const ty = rasterCenter.y - y0;
    const destinations = [
        [x0, y0, (1 - tx) * (1 - ty)],
        [x0, y0 + 1, (1 - tx) * ty],
        [x0 + 1, y0, tx * (1 - ty)],
        [x0 + 1, y0 + 1, tx * ty],
    ].filter(([, , weight]) => weight !== 0).map(([pixelX, pixelY, weight]) =>
        Object.freeze({
            pixelX,
            pixelY,
            weight,
            onFrame: pixelX >= 0
                && pixelX < widthPixels
                && pixelY >= 0
                && pixelY < heightPixels,
        }));
    return freezeJsonValue({
        destinations,
        fullWeight: destinations.reduce((sum, entry) => sum + entry.weight, 0),
        onFrameWeight: destinations.reduce(
            (sum, entry) => sum + (entry.onFrame ? entry.weight : 0),
            0,
        ),
        offRasterWeight: destinations.reduce(
            (sum, entry) => sum + (entry.onFrame ? 0 : entry.weight),
            0,
        ),
    });
}

function responseDifference(actual, expected) {
    const actualDestinations = [...actual.destinations].sort(destinationOrder);
    const expectedDestinations = [...expected.destinations].sort(destinationOrder);
    let structuralMatch = actualDestinations.length === expectedDestinations.length;
    let maximumResidual = Math.max(
        Math.abs(actual.fullWeight - expected.fullWeight),
        Math.abs(actual.onFrameWeight - expected.onFrameWeight),
        Math.abs(actual.offRasterWeight - expected.offRasterWeight),
    );
    for (let index = 0; index < Math.max(
        actualDestinations.length,
        expectedDestinations.length,
    ); index += 1) {
        const left = actualDestinations[index];
        const right = expectedDestinations[index];
        if (!left || !right) {
            structuralMatch = false;
            continue;
        }
        structuralMatch = structuralMatch
            && left.pixelX === right.pixelX
            && left.pixelY === right.pixelY
            && left.onFrame === right.onFrame
            && (left.reason ?? null) === (right.reason ?? null);
        maximumResidual = Math.max(maximumResidual, Math.abs(left.weight - right.weight));
    }
    return freezeJsonValue({
        structuralMatch,
        maximumResidual,
        tolerance: TOLERANCES.pointResponseAbsolute,
        accepted: structuralMatch
            && maximumResidual <= TOLERANCES.pointResponseAbsolute,
    });
}

function destinationOrder(left, right) {
    return String(left.pixelX).localeCompare(String(right.pixelX))
        || String(left.pixelY).localeCompare(String(right.pixelY));
}

function peakNormalizedSpectralMetric(samples, tolerance, expectedSampleCount) {
    if (samples.length === 0) {
        return freezeJsonValue({
            sampleCount: 0,
            expectedSampleCount,
            referenceChannelPeaks: Array(CANONICAL_CHANNEL_COUNT).fill(0),
            requiredMinimumReferencePeakExclusive: SPECTRAL_SCALE_FLOOR,
            allReferenceChannelPeaksPositive: false,
            maximumResidual: 0,
            tolerance,
            worst: null,
            accepted: false,
        });
    }
    const referenceChannelPeaks = Array(CANONICAL_CHANNEL_COUNT).fill(0);
    for (const sample of samples) {
        for (let channel = 0; channel < CANONICAL_CHANNEL_COUNT; channel += 1) {
            referenceChannelPeaks[channel] = Math.max(
                referenceChannelPeaks[channel],
                Math.abs(sample.reference[channel]),
            );
        }
    }
    const allReferenceChannelPeaksPositive = referenceChannelPeaks
        .every((peak) => peak > SPECTRAL_SCALE_FLOOR);
    let maximumResidual = 0;
    let worst = null;
    for (const sample of samples) {
        for (let channel = 0; channel < CANONICAL_CHANNEL_COUNT; channel += 1) {
            const residual = Math.abs(sample.runtime[channel] - sample.reference[channel])
                / Math.max(referenceChannelPeaks[channel], SPECTRAL_SCALE_FLOOR);
            if (residual > maximumResidual) {
                maximumResidual = residual;
                worst = freezeJsonValue({
                    location: sample.location,
                    channel,
                    runtime: sample.runtime[channel],
                    reference: sample.reference[channel],
                    channelReferencePeak: referenceChannelPeaks[channel],
                    residual,
                });
            }
        }
    }
    return freezeJsonValue({
        sampleCount: samples.length,
        expectedSampleCount,
        cardinalityAccepted: samples.length === expectedSampleCount
            && expectedSampleCount > 0,
        referenceChannelPeaks,
        requiredMinimumReferencePeakExclusive: SPECTRAL_SCALE_FLOOR,
        allReferenceChannelPeaksPositive,
        maximumResidual,
        tolerance,
        worst,
        accepted: samples.length === expectedSampleCount
            && expectedSampleCount > 0
            && allReferenceChannelPeaksPositive
            && Number.isFinite(maximumResidual)
            && maximumResidual <= tolerance,
    });
}

function absoluteVectorMetric(samples, tolerance, expectedSampleCount) {
    let maximumResidual = 0;
    let maximumReferenceMagnitude = 0;
    let worst = null;
    for (const sample of samples) {
        for (let channel = 0; channel < sample.runtime.length; channel += 1) {
            maximumReferenceMagnitude = Math.max(
                maximumReferenceMagnitude,
                Math.abs(sample.reference[channel]),
            );
            const residual = Math.abs(sample.runtime[channel] - sample.reference[channel]);
            if (residual > maximumResidual) {
                maximumResidual = residual;
                worst = freezeJsonValue({
                    location: sample.location,
                    channel,
                    runtime: sample.runtime[channel],
                    reference: sample.reference[channel],
                    residual,
                });
            }
        }
    }
    return freezeJsonValue({
        sampleCount: samples.length,
        expectedSampleCount,
        cardinalityAccepted: samples.length === expectedSampleCount
            && expectedSampleCount > 0,
        maximumReferenceMagnitude,
        positiveReferenceMagnitude: maximumReferenceMagnitude > 0,
        maximumResidual,
        tolerance,
        worst,
        accepted: samples.length === expectedSampleCount
            && expectedSampleCount > 0
            && maximumReferenceMagnitude > 0
            && Number.isFinite(maximumResidual)
            && maximumResidual <= tolerance,
    });
}

function combineResponseComparisons(comparisons) {
    const maximumResidual = comparisons.reduce(
        (maximum, entry) => Math.max(maximum, entry.maximumResidual),
        0,
    );
    return freezeJsonValue({
        caseCount: comparisons.length,
        expectedCaseCount: REQUIRED_CASE_COUNT,
        cardinalityAccepted: comparisons.length === REQUIRED_CASE_COUNT,
        comparisons,
        maximumResidual,
        tolerance: TOLERANCES.pointResponseAbsolute,
        accepted: comparisons.length === REQUIRED_CASE_COUNT
            && comparisons.every((entry) => entry.accepted),
    });
}

function typedConservationMetric(runtimeCases, referenceCases) {
    const samples = {
        composition: [],
        sun: [],
        moon: [],
        sirius: [],
    };
    for (const [profileId, cases] of [
        [RUNTIME_PROFILE.id, runtimeCases],
        [REFERENCE_PROFILE.id, referenceCases],
    ]) {
        for (const entry of cases) {
            const compositionScale = maximumCompositionScale(entry.composition.pixels);
            samples.composition.push(conservationSample({
                profileId,
                caseId: entry.caseId,
                quantity: 'spectral-radiance-density',
                units: 'W m^-2 sr^-1 nm^-1',
                absoluteResidual:
                    entry.composition.maximumAbsoluteCompositionResidual,
                scale: compositionScale,
                reportedRelativeResidual:
                    entry.status.metrics.compositionRelativeResidual,
            }));
            for (const sourceId of ['sun', 'moon']) {
                const transport = entry.transport[sourceId];
                const inputValues = packetValues(
                    transport.integrals.total.input.spectralRadianceSolidAngleIntegral,
                    `${entry.caseId}/${sourceId}/conservation-scale`,
                );
                samples[sourceId].push(conservationSample({
                    profileId,
                    caseId: entry.caseId,
                    quantity: 'spectral-radiance-solid-angle-integral',
                    units: 'W m^-2 nm^-1',
                    absoluteResidual:
                        transport.componentConservation.maximumAbsoluteSpectralResidual,
                    scale: spectralScale(inputValues),
                    reportedRelativeResidual: sourceId === 'sun'
                        ? entry.status.metrics.sunConservationRelativeResidual
                        : entry.status.metrics.moonConservationRelativeResidual,
                }));
            }
            const point = entry.transport.sirius;
            samples.sirius.push(conservationSample({
                profileId,
                caseId: entry.caseId,
                quantity: 'spectral-irradiance-density',
                units: 'W m^-2 nm^-1',
                absoluteResidual: point.accounting.maximumAbsoluteResidual,
                scale: spectralScale(packetValues(
                    point.sourceSpectralIrradiance,
                    `${entry.caseId}/sirius/conservation-scale`,
                )),
                reportedRelativeResidual:
                    entry.status.metrics.siriusAccountingRelativeResidual,
            }));
        }
    }
    const submetrics = freezeJsonValue(Object.fromEntries(
        Object.entries(samples).map(([id, entries]) => [
            id,
            conservationSubmetric(id, entries),
        ]),
    ));
    const maximumResidual = Math.max(...Object.values(submetrics)
        .map((entry) => entry.maximumRelativeResidual));
    return freezeJsonValue({
        kind: 'er8-unit-consistent-conservation-metric-v1',
        submetrics,
        maximumResidual,
        tolerance: TOLERANCES.componentConservationRelative,
        accepted: Object.values(submetrics).every((entry) => entry.accepted),
    });
}

function conservationSample({
    profileId,
    caseId,
    quantity,
    units,
    absoluteResidual,
    scale,
    reportedRelativeResidual,
}) {
    if (![absoluteResidual, scale, reportedRelativeResidual].every(Number.isFinite)) {
        throw new Error(`${caseId} ${quantity} conservation evidence must be finite.`);
    }
    const relativeResidual = Math.abs(absoluteResidual) / Math.max(
        Math.abs(scale),
        SPECTRAL_SCALE_FLOOR,
    );
    const positiveOwningInputScale = scale > SPECTRAL_SCALE_FLOOR;
    return freezeJsonValue({
        profileId,
        caseId,
        quantity,
        units,
        absoluteResidual,
        scale,
        allowedAbsoluteResidual: scale * TOLERANCES.componentConservationRelative,
        requiredMinimumOwningInputScaleExclusive: SPECTRAL_SCALE_FLOOR,
        positiveOwningInputScale,
        relativeResidual,
        reportedRelativeResidual,
        reportedResidualMatches: Math.abs(relativeResidual - reportedRelativeResidual)
            <= Number.EPSILON * Math.max(1, Math.abs(relativeResidual)),
    });
}

function conservationSubmetric(id, samples) {
    const maximumRelativeResidual = Math.max(
        ...samples.map((entry) => entry.relativeResidual),
    );
    return freezeJsonValue({
        id,
        sampleCount: samples.length,
        expectedSampleCount: EXPECTED_PROFILE_CASE_COUNT,
        cardinalityAccepted: samples.length === EXPECTED_PROFILE_CASE_COUNT,
        samples,
        allOwningInputScalesPositive:
            samples.every((entry) => entry.positiveOwningInputScale),
        maximumRelativeResidual,
        tolerance: TOLERANCES.componentConservationRelative,
        accepted: samples.length === EXPECTED_PROFILE_CASE_COUNT
            && samples.length > 0
            && samples.every((entry) => entry.positiveOwningInputScale)
            && samples.every((entry) => entry.reportedResidualMatches)
            && maximumRelativeResidual <= TOLERANCES.componentConservationRelative,
    });
}

function maximumCompositionScale(pixels) {
    return Math.max(
        0,
        ...pixels.flatMap((pixel) => packetValues(
            pixel.finalSpectralRadianceDensity,
            `${pixel.pixelX},${pixel.pixelY}/final-conservation-scale`,
        ).map(Math.abs)),
    );
}

function spectralScale(values) {
    return Math.max(0, ...values.map(Math.abs));
}

async function auditCleanupAndPublicSurface() {
    const absentChecks = await Promise.all(EXPECTED_ABSENT_PATHS.map(async (path) => {
        let present = false;
        try {
            await readFile(path);
            present = true;
        } catch (error) {
            if (error?.code !== 'ENOENT') {
                throw error;
            }
        }
        return freezeJsonValue({ path, present, accepted: !present });
    }));
    const symbolChecks = await Promise.all(RETAINED_SYMBOL_ABSENCE_CHECKS.map(
        async (check) => {
            let source = null;
            let readError = null;
            try {
                source = await readFile(check.path, 'utf8');
            } catch (error) {
                readError = serializeError(error);
            }
            const presentSymbols = source == null
                ? [...check.symbols]
                : check.symbols.filter((symbol) => source.includes(symbol));
            return freezeJsonValue({
                path: check.path,
                prohibitedSymbols: check.symbols,
                presentSymbols,
                readError,
                accepted: source != null && presentSymbols.length === 0,
            });
        },
    ));
    const rootSurface = await readPublicSurface(
        ROOT_PUBLIC_INDEX,
        EXPECTED_ROOT_PUBLIC_EXPORT_PATHS,
        EXPECTED_ROOT_PUBLIC_EXPORT_NAMES,
    );
    const er6Surface = await readPublicSurface(
        ER6_PUBLIC_INDEX,
        EXPECTED_ER6_PUBLIC_EXPORT_PATHS,
        EXPECTED_ER6_PUBLIC_EXPORT_NAMES,
    );
    const runnerGraph = await safeCollectModuleGraph([RUNNER_PATH]);
    const publicGraph = await safeCollectModuleGraph([
        ROOT_PUBLIC_INDEX,
        ER6_PUBLIC_INDEX,
    ]);
    const graphChecks = [runnerGraph, publicGraph].map((graph) => {
        const paths = graph.graph == null ? [] : Object.keys(graph.graph.files);
        const prohibitedModules = paths.filter((path) =>
            FORBIDDEN_ACTIVE_MODULE_SUFFIXES.some((suffix) => path.endsWith(suffix)));
        return freezeJsonValue({
            id: graph.id,
            collected: graph.graph != null,
            error: graph.error,
            prohibitedModules,
            accepted: graph.graph != null && prohibitedModules.length === 0,
        });
    });
    return freezeJsonValue({
        inventory: {
            kind: 'er8-poc-cleanup-inventory-v1',
            absentChecks,
            retainedSymbolChecks: symbolChecks,
            historicalRunnerPolicy:
                'sealed historical runners remain inert and are not reachable from either public entry; broken imports are fail-loud and receive no aliases',
            accepted: absentChecks.every((entry) => entry.accepted)
                && symbolChecks.every((entry) => entry.accepted),
        },
        publicSurface: {
            kind: 'er8-public-surface-audit-v1',
            root: rootSurface,
            er6: er6Surface,
            accepted: rootSurface.accepted && er6Surface.accepted,
        },
        moduleGraphs: {
            kind: 'er8-active-module-graphs-v1',
            runner: runnerGraph,
            public: publicGraph,
            checks: graphChecks,
            accepted: graphChecks.every((entry) => entry.accepted),
        },
        accepted: absentChecks.every((entry) => entry.accepted)
            && symbolChecks.every((entry) => entry.accepted)
            && rootSurface.accepted
            && er6Surface.accepted
            && graphChecks.every((entry) => entry.accepted),
    });
}

async function readPublicSurface(path, expectedPaths, expectedNames) {
    let source = null;
    let readError = null;
    try {
        source = await readFile(path, 'utf8');
    } catch (error) {
        readError = serializeError(error);
    }
    const exportSurface = source == null
        ? { paths: [], names: [], wildcardPaths: [] }
        : extractExportSurface(source);
    const actualPaths = exportSurface.paths;
    const expected = [...expectedPaths].sort();
    const missing = expected.filter((entry) => !actualPaths.includes(entry));
    const unexpected = actualPaths.filter((entry) => !expected.includes(entry));
    const expectedExportNames = [...expectedNames].sort();
    const missingNames = expectedExportNames
        .filter((entry) => !exportSurface.names.includes(entry));
    const unexpectedNames = exportSurface.names
        .filter((entry) => !expectedExportNames.includes(entry));
    return freezeJsonValue({
        path,
        expectedExportPaths: expected,
        actualExportPaths: actualPaths,
        missing,
        unexpected,
        expectedExportNames,
        actualExportNames: exportSurface.names,
        missingNames,
        unexpectedNames,
        wildcardExportPaths: exportSurface.wildcardPaths,
        readError,
        accepted: source != null
            && missing.length === 0
            && unexpected.length === 0
            && missingNames.length === 0
            && unexpectedNames.length === 0
            && exportSurface.wildcardPaths.length === 0,
    });
}

async function safeCollectModuleGraph(entries) {
    try {
        const graph = await new LocalModuleGraphHasher({
            workspaceRoot: process.cwd(),
            allowedRoot: 'scripts/flat/reconciliation/POC',
        }).collect(entries);
        return freezeJsonValue({
            id: entries.join('+'),
            graph,
            error: null,
        });
    } catch (error) {
        return freezeJsonValue({
            id: entries.join('+'),
            graph: null,
            error: serializeError(error),
        });
    }
}

function buildInactiveCacheEvidence(moduleGraphs) {
    const graphFiles = Object.keys(moduleGraphs.runner.graph?.files ?? {});
    const cacheBuilderModules = graphFiles.filter((path) =>
        path.endsWith('/setup/buildIncidentRadianceCache.js'));
    const rendererPath =
        'scripts/flat/reconciliation/POC/src/er6-case-matrix/Er6PhysicalGlobeSceneRenderer.js';
    const frameEvaluatorPath =
        'scripts/flat/reconciliation/POC/src/physical-frame/FrozenAtmosphereSpectralFrameEvaluator.js';
    const renderer = moduleGraphs.runner.graph?.files?.[rendererPath] ?? null;
    const frameEvaluator = moduleGraphs.runner.graph?.files?.[frameEvaluatorPath] ?? null;
    const accepted = moduleGraphs.runner.graph != null
        && cacheBuilderModules.length === 0
        && renderer != null
        && frameEvaluator != null;
    return freezeJsonValue({
        kind: 'er8-inactive-incident-radiance-cache-evidence-v1',
        status: accepted ? 'not-applicable-inactive' : 'rejected',
        accepted,
        cacheBuilderModules,
        rendererModulePresent: renderer != null,
        frameEvaluatorModulePresent: frameEvaluator != null,
        operationBoundary:
            'ER6 constructs no incidentRadianceSampling operation and never calls buildIncidentRadianceCache; incidentDirectionCount and incidentAltitudeBinCount are descriptor metadata only in this matrix',
        xaG11Disposition:
            'cache convergence is N/A for this selected no-cache operation; path, direct-source transmittance, point response, and extended integration are bounded separately',
        excludedClaim:
            'this does not validate a future multiple-scattering incident-radiance cache',
    });
}

function buildCriteria({
    sealedEr6,
    sealedEr8,
    sealedRouted,
    cleanupAudit,
    convergence,
    cacheEvidence,
    sourceDependencyAligned,
    sealedIdentity,
}) {
    const metric = convergence.metrics;
    return freezeJsonValue([
        criterion('dependency', 'accepted record 056 pins and eight attachments reconstruct',
            sealedEr6.result.status === 'accepted'
                && sealedEr6.attachments.length === REQUIRED_CASE_COUNT,
            sealedEr6.descriptor),
        criterion('routed-dependency', 'record 060 accepts mechanics and cleanup and rejects only the exact eight atmosphere-dependent criteria',
            sealedEr8.descriptor.routedFailureSetExact
                && sealedEr8.descriptor.mechanicalStatus === 'accepted'
                && sealedEr8.descriptor.cleanupStatus === 'accepted'
                && sealedEr8.descriptor.convergenceStatus === 'rejected'
                && sealedEr8.descriptor.rejectedCriterionCount === 8,
            sealedEr8.descriptor),
        criterion('routed-predecessor', 'record 064 is exactly 24/26 with mechanics and cleanup accepted and only path radiance and Moon transported irradiance rejected in order',
            sealedRouted.descriptor.routedFailureSetExact
                && sealedRouted.descriptor.profilesExact
                && sealedRouted.descriptor.baselineIdentityExact
                && sealedRouted.descriptor.mechanicalStatus === 'accepted'
                && sealedRouted.descriptor.cleanupStatus === 'accepted'
                && sealedRouted.descriptor.convergenceStatus === 'rejected'
                && sealedRouted.descriptor.acceptedCriterionCount === 24
                && sealedRouted.descriptor.rejectedCriterionCount === 2,
            sealedRouted.descriptor),
        criterion('source-integrity', 'runtime and reference use the accepted physical source bundle unchanged',
            sourceDependencyAligned, {
                acceptedFingerprint: sealedEr6.result.sourceReferencesFingerprint,
            }),
        criterion('sealed-identity', 'sealed attachments, physical sources, geometry, visibility, and accepted record 060 baseline remain identical',
            sealedIdentity.accepted, sealedIdentity),
        criterion('profile', 'only routed active path and source-transmittance controls double while cache and accepted source quadrature remain fixed',
            profileFollowsRoutedPolicy(RUNTIME_PROFILE, REFERENCE_PROFILE), {
                runtime: RUNTIME_PROFILE,
                reference: REFERENCE_PROFILE,
                routing: {
                    promotedRuntimeFromRecord064Reference: {
                        pathIntervalCount: 192,
                        sourceTransmittanceIntervalCount: 128,
                    },
                    doubledReference: {
                        pathIntervalCount: 384,
                        sourceTransmittanceIntervalCount: 256,
                    },
                    fixedInactiveCache: {
                        incidentDirectionCount: 4,
                        incidentAltitudeBinCount: 4,
                    },
                    fixedAcceptedQuadrature: {
                        sun: { radialCount: 6, azimuthCount: 24 },
                        moon: { radialCount: 6, azimuthCount: 24 },
                    },
                },
            }),
        criterion('geometry-depth', 'case, source, camera, depth, and point-visibility facts are profile invariant',
            convergence.geometryComparisons.every((entry) => entry.accepted),
            convergence.geometryComparisons),
        criterion('physical-status', 'both profiles retain accepted ER6 mechanical, geometry, and physical-radiometry statuses',
            profilesRetainPhysicalAcceptance(convergence), {
                runtimeCaseStatuses: convergence.profileCaseStatuses.runtime,
                referenceCaseStatuses: convergence.profileCaseStatuses.reference,
            }),
        criterion('path', 'path spectral radiance is within one percent per-channel peak-normalized residual',
            metric.pathSpectral.accepted, metric.pathSpectral),
        criterion('transmittance', 'base view transmittance is within 0.005 absolute',
            metric.viewTransmittance.accepted, metric.viewTransmittance),
        criterion('transmittance', 'exact-source Sirius transmittance is within 0.005 absolute',
            metric.exactPointTransmittance.accepted
                && convergence.pointTransmittancePartition.accepted, {
                metric: metric.exactPointTransmittance,
                partition: convergence.pointTransmittancePartition,
            }),
        criterion('point-response', 'independent separable-tent oracle and both profiles agree within 1e-15',
            metric.pointResponse.accepted, metric.pointResponse),
        criterion('point-transport', 'accounted Sirius transported irradiance is within 0.5 percent',
            metric.pointTransportedIrradiance.accepted,
            metric.pointTransportedIrradiance),
        criterion('extended-quadrature', 'Sun input projected irradiance is within 0.5 percent',
            metric.sunInputProjectedIrradiance.accepted,
            metric.sunInputProjectedIrradiance),
        criterion('extended-quadrature', 'Moon input projected irradiance is within 0.5 percent',
            metric.moonInputProjectedIrradiance.accepted,
            metric.moonInputProjectedIrradiance),
        criterion('extended-transport', 'Sun transported projected irradiance is within 0.5 percent',
            metric.sunTransportedProjectedIrradiance.accepted,
            metric.sunTransportedProjectedIrradiance),
        criterion('extended-transport', 'Moon transported projected irradiance is within 0.5 percent',
            metric.moonTransportedProjectedIrradiance.accepted,
            metric.moonTransportedProjectedIrradiance),
        criterion('composition', 'final pre-display spectrum is within one percent per-channel peak-normalized residual',
            metric.finalSpectral.accepted, metric.finalSpectral),
        criterion('display', 'shared display RGB is within one 8-bit code value',
            metric.displayRgb.accepted, metric.displayRgb),
        criterion('conservation', 'composition, Sun, Moon, and Sirius each retain typed scale-relative conservation within 1e-12',
            metric.componentConservation.accepted, metric.componentConservation),
        criterion('cache-scope', 'incident-radiance cache is explicitly inactive and N/A',
            cacheEvidence.accepted, cacheEvidence),
        criterion('cleanup', 'all superseded v1 implementation paths are absent',
            cleanupAudit.inventory.absentChecks.every((entry) => entry.accepted),
            cleanupAudit.inventory.absentChecks),
        criterion('cleanup', 'retained modules contain none of the rejected calibration or candidate seams',
            cleanupAudit.inventory.retainedSymbolChecks.every((entry) => entry.accepted),
            cleanupAudit.inventory.retainedSymbolChecks),
        criterion('public-surface', 'root index is exactly the accepted reset primitive allowlist',
            cleanupAudit.publicSurface.root.accepted,
            cleanupAudit.publicSurface.root),
        criterion('public-surface', 'ER6 index exports only resolver, acquirer, and physical renderer',
            cleanupAudit.publicSurface.er6.accepted,
            cleanupAudit.publicSurface.er6),
        criterion('module-graph', 'runner and public entries reach no superseded v1 module',
            cleanupAudit.moduleGraphs.accepted,
            cleanupAudit.moduleGraphs.checks),
    ]);
}

function deriveStatuses(criteria) {
    const byScope = (scopes) => criteria
        .filter((entry) => scopes.includes(entry.scope))
        .every((entry) => entry.status === 'accepted');
    const mechanicalStatus = byScope([
        'dependency',
        'routed-dependency',
        'routed-predecessor',
        'source-integrity',
        'sealed-identity',
        'profile',
        'geometry-depth',
        'physical-status',
        'conservation',
        'cache-scope',
    ]) ? 'accepted' : 'rejected';
    const convergenceStatus = byScope([
        'path',
        'transmittance',
        'point-response',
        'point-transport',
        'extended-quadrature',
        'extended-transport',
        'composition',
        'display',
        'conservation',
        'cache-scope',
    ]) ? 'accepted' : 'rejected';
    const cleanupStatus = byScope([
        'cleanup',
        'public-surface',
        'module-graph',
    ]) ? 'accepted' : 'rejected';
    return freezeJsonValue({
        mechanicalStatus,
        convergenceStatus,
        cleanupStatus,
        overallStatus: criteria.every((entry) => entry.status === 'accepted')
            ? 'accepted'
            : 'rejected',
        automatedReviewabilityStatus: 'not-claimed',
        humanReviewStatus: 'not-claimed',
        observationalStatus: 'not-claimed',
        gpuStatus: 'not-claimed',
        productionStatus: 'not-claimed',
    });
}

function profilesRetainPhysicalAcceptance(convergence) {
    return [...convergence.profileCaseStatuses.runtime,
        ...convergence.profileCaseStatuses.reference].every((entry) =>
        entry.mechanicalStatus === 'accepted'
            && entry.geometryDepthStatus === 'accepted'
            && entry.physicalRadiometryStatus === 'accepted'
            && entry.overallPhysicalCaseStatus === 'accepted');
}

function profileFollowsRoutedPolicy(runtime, reference) {
    return runtime.atmosphereControls.pathIntervalCount === 192
        && reference.atmosphereControls.pathIntervalCount === 384
        && reference.atmosphereControls.pathIntervalCount
            === runtime.atmosphereControls.pathIntervalCount * 2
        && runtime.atmosphereControls.sourceTransmittanceIntervalCount === 128
        && reference.atmosphereControls.sourceTransmittanceIntervalCount === 256
        && reference.atmosphereControls.sourceTransmittanceIntervalCount
            === runtime.atmosphereControls.sourceTransmittanceIntervalCount * 2
        && runtime.atmosphereControls.incidentDirectionCount === 4
        && reference.atmosphereControls.incidentDirectionCount === 4
        && runtime.atmosphereControls.incidentAltitudeBinCount === 4
        && reference.atmosphereControls.incidentAltitudeBinCount === 4
        && stableHash(runtime.extendedQuadrature)
            === stableHash(reference.extendedQuadrature)
        && stableHash(runtime.extendedQuadrature) === stableHash({
            sun: { radialCount: 6, azimuthCount: 24 },
            moon: { radialCount: 6, azimuthCount: 24 },
        });
}

function compactProfile(execution) {
    return freezeJsonValue({
        kind: 'er8-compact-physical-profile-v1',
        profile: execution.profile,
        renderer: execution.renderer,
        rendererFingerprint: execution.rendererFingerprint,
        elapsedMilliseconds: execution.elapsedMilliseconds,
        caseCount: execution.cases.length,
        cases: execution.cases.map(compactCase),
        omissionPolicy:
            'per-quadrature sample arrays are omitted; source integrals, per-pixel outputs, conservation, code graph, inputs, and exact settings are retained',
    });
}

function compactCase(entry) {
    return freezeJsonValue({
        caseId: entry.caseId,
        caseOrdinal: entry.caseOrdinal,
        epochIso: entry.epochIso,
        attachmentFingerprint: entry.attachmentFingerprint,
        physicalStateFingerprint: entry.physicalStateFingerprint,
        sourceIdentitySetFingerprint: entry.sourceIdentitySetFingerprint,
        sourceIds: entry.sourceIds,
        sourceAltitudesDegrees: entry.sourceAltitudesDegrees,
        returnedEpoch: entry.returnedEpoch,
        nativeEventAvailability: entry.nativeEventAvailability,
        geometrySignature: geometrySignature(entry),
        baseFrame: entry.baseFrame,
        transport: {
            sun: compactExtendedTransport(entry.transport.sun),
            moon: compactExtendedTransport(entry.transport.moon),
            sirius: entry.transport.sirius,
        },
        composition: entry.composition,
        status: entry.status,
        qualifications: entry.qualifications,
        fingerprints: entry.fingerprints,
    });
}

function compactExtendedTransport(entry) {
    return freezeJsonValue({
        quantity: entry.quantity,
        units: entry.units,
        source: entry.source,
        sourceDepth: entry.sourceDepth,
        centerDirectionCamera: entry.centerDirectionCamera,
        angularRadiusRadians: entry.angularRadiusRadians,
        quadrature: entry.quadrature,
        integrals: entry.integrals,
        pixels: entry.pixels,
        reconstructedOnFrameSpectralIntegral:
            entry.reconstructedOnFrameSpectralIntegral,
        componentConservation: entry.componentConservation,
        derivedCoverage: entry.derivedCoverage,
        transportCalls: entry.transportCalls,
        fingerprints: entry.fingerprints,
        omittedSampleCount: entry.samples.length,
    });
}

async function writeInitialArtifacts(
    recordDirectory,
    er6Dependency,
    er8Dependency,
    routedDependency,
    modeConfiguration,
) {
    await Promise.all([
        writeText(recordDirectory, 'state-goal.md', stateGoalText()),
        writeJson(recordDirectory, 'command.json', {
            commands: [{
                command: modeConfiguration.command,
                timestamp: nowIso(),
                writesRecord: true,
                networkAcquisition: false,
            }],
        }),
        writeJson(recordDirectory, 'inputs.json', {
            kind: 'er8-cpu-convergence-and-cleanup-inputs-v1',
            sealedEr6Dependency: er6Dependency.descriptor,
            routedEr8Record060Dependency: er8Dependency.descriptor,
            routedEr8Record064Dependency: routedDependency.descriptor,
            camera: CAMERA_CONFIGURATION,
            runtimeProfile: RUNTIME_PROFILE,
            referenceProfile: REFERENCE_PROFILE,
            expectedCleanupPaths: EXPECTED_ABSENT_PATHS,
            expectedRootPublicExportPaths: EXPECTED_ROOT_PUBLIC_EXPORT_PATHS,
            expectedRootPublicExportNames: EXPECTED_ROOT_PUBLIC_EXPORT_NAMES,
            expectedEr6PublicExportPaths: EXPECTED_ER6_PUBLIC_EXPORT_PATHS,
            expectedEr6PublicExportNames: EXPECTED_ER6_PUBLIC_EXPORT_NAMES,
        }),
        writeJson(recordDirectory, 'equations-and-tolerances.json', {
            kind: 'er8-convergence-equations-and-tolerances-v1',
            equations: {
                perChannelPeakNormalized:
                    'max_i |runtime(lambda,i)-reference(lambda,i)| / max_i |reference(lambda,i)|, accepted only when all 15 retained reference-channel peaks are strictly greater than 1e-30',
                transmittanceAbsolute: '|T_runtime - T_reference|',
                pointTent:
                    'p(x,y) = [1-tx,tx] tensor [1-ty,ty]; on-frame plus off-raster equals one',
                displayAbsolute:
                    '|rgb_runtime-rgb_reference|, accepted only when retained maximum reference magnitude is greater than zero',
                typedConservation:
                    'relativeResidual = absoluteResidual / max(owning composition-or-source input scale, 1e-30); every retained owning input scale must be strictly greater than 1e-30 and composition, Sun, Moon, and Sirius are gated separately at 1e-12',
            },
            tolerances: TOLERANCES,
            requiredSampleCounts: {
                pathViewFinalAndDisplay: EXPECTED_PIXEL_SAMPLE_COUNT,
                pointAndEachExtendedAggregate: REQUIRED_CASE_COUNT,
                typedConservationPerComponent: EXPECTED_PROFILE_CASE_COUNT,
                exactPointTransmittance:
                    'derived from all eight exact-source visibility results, retained explicitly, and required greater than zero',
            },
            routing:
                'record 064 remained rejected only in path spectral radiance and Moon transported projected irradiance, in that order; runtime promotes its 192/128 reference to runtime and compares against 384/256, routing those two remaining criteria to their owning controls while inactive cache controls stay 4/4, accepted source quadrature stays 6x24, all positive-scale/cardinality gates remain required, and no tolerance or criterion changes',
            cache:
                'incident-radiance cache is not constructed by the selected ER6 operation and is N/A',
        }),
        writeJson(
            recordDirectory,
            'sealed-er6-dependency.json',
            er6Dependency.descriptor,
        ),
        writeJson(
            recordDirectory,
            'sealed-er8-record-060-dependency.json',
            er8Dependency.descriptor,
        ),
        writeJson(
            recordDirectory,
            'sealed-er8-record-064-dependency.json',
            routedDependency.descriptor,
        ),
        writeJson(recordDirectory, 'provenance.json', {
            runner: RUNNER,
            runnerPath: RUNNER_PATH,
            recordId: EXPECTED_RECORD_ID,
            expectedRecordDirectory: EXPECTED_RECORD_DIRECTORY,
            runtime: {
                node: process.version,
                v8: process.versions.v8,
                platform: process.platform,
                architecture: process.arch,
            },
            dependencies: [
                SEALED_ER6_RECORD_ID,
                SEALED_ER8_RECORD_ID,
                SEALED_ROUTED_RECORD_ID,
            ],
            networkAcquisition: false,
            productionImports: false,
            flat32RuntimeImports: false,
        }),
    ]);
}

async function writeFailureArtifacts({
    recordDirectory,
    error,
    sealedEr6,
    sealedEr8,
    sealedRouted,
    completedRuntimeCases,
    completedReferenceCases,
    elapsedMilliseconds,
}) {
    const failure = freezeJsonValue({
        status: 'invalid',
        runner: RUNNER,
        recordId: EXPECTED_RECORD_ID,
        error: serializeError(error),
        sealedEr6RecordId: sealedEr6.recordId,
        sealedEr8RecordId: sealedEr8.recordId,
        sealedRoutedRecordId: sealedRouted.recordId,
        completedRuntimeCaseIds: completedRuntimeCases.map((entry) => entry.caseId),
        completedReferenceCaseIds: completedReferenceCases.map((entry) => entry.caseId),
        elapsedMilliseconds,
    });
    await writeJson(recordDirectory, 'failure.json', failure);
    await writeJson(recordDirectory, 'result.json', failure);
    await writeText(
        recordDirectory,
        'report.md',
        `# ER8 CPU Convergence And POC Cleanup\n\nStatus: **invalid**\n\n${error.message}\n`,
    );
    await appendRunLog(recordDirectory, `${RUNNER} invalid: ${error.message}`);
}

function stateGoalText() {
    return `# State Goal

Bound XA-G11 for the exact accepted eight-case ER6 physical matrix after
record 064 retained accepted mechanics and cleanup but still rejected only
path spectral radiance and Moon transported projected irradiance, in that
order. Promote its 192/128 reference path/source-transmittance settings to
runtime, then compare them with 384/256, routing those two remaining criteria
to their owning controls.
Keep inactive cache controls fixed at 4/4 and accepted Sun/Moon quadrature
fixed at 6x24.
Retain path, transmittance, point-response, extended-source, full-frame, and
display residuals without changing source facts or adding a gain.

In the same immutable record, prove that the coverage-resolved v1 boundary,
candidate, CPU-renderer, prototype-calibration, and celestial GPU/browser
paths are absent; that the public POC surface contains only the accepted reset
primitives; and that historical runners are unreachable and receive no alias.

Every residual retains non-vacuous reference/input-scale evidence and the
existing positive-scale and exact-cardinality gates. No tolerance changes. The
incident-radiance cache is not constructed by this selected operation, so
its XA-G11 status is explicitly N/A rather than a false numerical pass. This
record makes no observer, GPU, or production claim.
`;
}

function reportText(result, criteria) {
    const rejected = criteria.filter((entry) => entry.status !== 'accepted');
    return `# ER8 CPU Convergence And POC Cleanup

Status: **${result.status}**

- Mechanical: ${result.mechanicalStatus}
- Convergence: ${result.convergenceStatus}
- Cleanup: ${result.cleanupStatus}
- Cache: ${result.cacheStatus}
- Criteria: ${result.acceptedCriterionCount}/${result.criterionCount}
- Rejected: ${rejected.length === 0
        ? 'none'
        : rejected.map((entry) => `${entry.scope}: ${entry.name}`).join('; ')}

Runtime and reference use the same accepted ER6 attachments and physical
source packets. No network, observer, GPU, or production claim is made.
`;
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

function assertPinsConfigured() {
    const invalid = [
        ...Object.entries(SEALED_ER6_PINS)
            .map(([field, value]) => [`record056.${field}`, value]),
        ...Object.entries(SEALED_ER8_PINS)
            .map(([field, value]) => [`record060.${field}`, value]),
        ...Object.entries(SEALED_ROUTED_PINS)
            .map(([field, value]) => [`record064.${field}`, value]),
    ].filter(([, value]) => !FINGERPRINT_PATTERN.test(value));
    if (invalid.length > 0) {
        throw new Error(
            'Configure all record 056, record 060, and record 064 SHA-256 pins before ER8 execution: '
                + invalid.map(([field]) => field).join(', '),
        );
    }
}

function extractExportSurface(source) {
    const namedPattern = /\bexport\s+\{([^}]*)\}\s+from\s+['"]([^'"]+)['"]/gu;
    const wildcardPattern = /\bexport\s+\*\s+from\s+['"]([^'"]+)['"]/gu;
    const paths = [];
    const names = [];
    for (const match of source.matchAll(namedPattern)) {
        paths.push(match[2]);
        for (const rawBinding of match[1].split(',')) {
            const binding = rawBinding.trim();
            if (binding.length === 0) {
                continue;
            }
            const aliasParts = binding.split(/\s+as\s+/u);
            names.push(aliasParts.at(-1).trim());
        }
    }
    const wildcardPaths = [...source.matchAll(wildcardPattern)]
        .map((match) => match[1]);
    paths.push(...wildcardPaths);
    return freezeJsonValue({
        paths: [...paths].sort(),
        names: [...names].sort(),
        wildcardPaths: [...wildcardPaths].sort(),
    });
}

function spectralSample(runtime, reference, location) {
    return Object.freeze({
        runtime: Object.freeze([...runtime]),
        reference: Object.freeze([...reference]),
        location,
    });
}

function packetValues(packet, label) {
    const values = Array.isArray(packet) ? packet : packet?.values;
    if (
        !Array.isArray(values)
        || values.length !== CANONICAL_CHANNEL_COUNT
        || !values.every(Number.isFinite)
    ) {
        throw new Error(`${label} requires ${CANONICAL_CHANNEL_COUNT} finite values.`);
    }
    return Object.freeze([...values]);
}

function validateRgb(value, label) {
    if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) {
        throw new Error(`${label} requires three finite display values.`);
    }
    return Object.freeze([...value]);
}

function criterion(scope, name, accepted, evidence) {
    return freezeJsonValue({
        scope,
        name,
        status: accepted ? 'accepted' : 'rejected',
        evidence,
    });
}

function fileDescriptor(path, bytes, sha256) {
    return freezeJsonValue({
        path: path.replaceAll('\\', '/'),
        byteLength: bytes.byteLength,
        sha256,
    });
}

function parseJson(bytes, label) {
    try {
        return JSON.parse(bytes.toString('utf8'));
    } catch (error) {
        throw new Error(`Could not parse ${label}: ${error.message}`);
    }
}

function hashBytes(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}

function serializeError(error) {
    return freezeJsonValue({
        name: error?.name ?? 'Error',
        message: error?.message ?? String(error),
        code: error?.code ?? null,
        stack: error?.stack ?? null,
    });
}
