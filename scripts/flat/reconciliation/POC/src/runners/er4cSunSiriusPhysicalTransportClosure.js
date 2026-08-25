// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER4C/ER5.
// - tmp/atmosphere/reconciliation/049-er5-lunar-physical-reference-calibration.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import BrunetonColorDisplayModel from '../color/BrunetonColorDisplayModel.js';
import CanonicalAtmosphere from '../atmosphere/CanonicalAtmosphere.js';
import SpectralCalculator from '../calculator/SpectralCalculator.js';
import {
    CANONICAL_ATMOSPHERE_CONSTANTS,
    CANONICAL_SPECTRAL_BASIS,
    CANONICAL_SPECTRAL_CHANNELS,
    DISTANT_SUN_CONSTANTS,
    FIGURE1_RENDER_CONSTANTS,
} from '../constants/consts.js';
import ExactDirectionalVisibilityResolver from
    '../directional-visibility/ExactDirectionalVisibilityResolver.js';
import SpectralReferenceEvaluator from '../evaluation/SpectralReferenceEvaluator.js';
import { createCalspecSiriusIrradianceDensity } from
    '../external-celestial-sources/createCalspecSiriusIrradianceDensity.js';
import { createCanonicalSolarIrradianceDensity } from
    '../external-celestial-sources/createCanonicalSolarIrradianceDensity.js';
import { createCanonicalSpectralDensityBasis } from
    '../external-celestial-sources/createCanonicalSpectralDensityBasis.js';
import ExternalCelestialSource from
    '../external-celestial-sources/ExternalCelestialSource.js';
import { EXTERNAL_CELESTIAL_FIXTURE_MANIFEST } from
    '../external-celestial-sources/fixtureManifest.js';
import RiekeSiriusReferenceEvaluator from
    '../external-celestial-sources/RiekeSiriusReferenceEvaluator.js';
import TsisHsrsReferenceReader from
    '../external-celestial-sources/TsisHsrsReferenceReader.js';
import CanonicalUniformSunDiskSource from
    '../extended-source-integration/CanonicalUniformSunDiskSource.js';
import TransportedExtendedSourceIntegrator from
    '../extended-source-integration/TransportedExtendedSourceIntegrator.js';
import SphericalEarthGeometry from '../geometry/SphericalEarthGeometry.js';
import CanonicalSolarIlluminationSource from
    '../light/CanonicalSolarIlluminationSource.js';
import FrozenAtmosphereSpectralFrameEvaluator from
    '../physical-frame/FrozenAtmosphereSpectralFrameEvaluator.js';
import Er4cPhysicalFullFrameClosureEvaluator from
    '../physical-frame/Er4cPhysicalFullFrameClosureEvaluator.js';
import BilinearPointResponse from '../point-source-raster/BilinearPointResponse.js';
import TransportedPointSourceAccumulator from
    '../point-source-raster/TransportedPointSourceAccumulator.js';
import LocalModuleGraphHasher from '../provenance/LocalModuleGraphHasher.js';
import { stableHash } from '../provenance/stableHash.js';
import PerspectiveCameraRaster from '../camera/PerspectiveCameraRaster.js';
import {
    appendRunLog,
    createFreshRecordDirectory,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const RUNNER = 'er4cSunSiriusPhysicalTransportClosure';
const RUNNER_PATH = `scripts/flat/reconciliation/POC/src/runners/${RUNNER}.js`;
const EXPECTED_RECORD_ID = '050-er4c-sun-sirius-physical-transport-closure';
const EXPECTED_RECORD_DIRECTORY =
    `tmp/atmosphere/reconciliation/${EXPECTED_RECORD_ID}`;
const FIXTURE_ROOT =
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures';
const LUNAR_RECORD_ROOT =
    'tmp/atmosphere/reconciliation/049-er5-lunar-physical-reference-calibration';
const LUNAR_RESULT_PATH = `${LUNAR_RECORD_ROOT}/result.json`;
const LUNAR_CRITERIA_PATH = `${LUNAR_RECORD_ROOT}/criteria-results.json`;
const EXPECTED_LUNAR_RESULT_HASH_SHA256 =
    'bce00d297c44e943fc47677fb8e829de450e58f5f3fbb30f3201926bdf9453f5';
const EXPECTED_LUNAR_CRITERIA_HASH_SHA256 =
    '38f3c23037792051607a0b24b6694638a373d2ac52e0e71cfb7f3480263d3386';

const TOLERANCES = Object.freeze({
    spectralRelative: 1e-12,
    spectralScaleFloor: 1e-30,
    solarReferenceMinimumRelative: 0.02,
    solarReferenceUncertaintyMultiplier: 2,
    solarReferenceAbsoluteFloorRelative: 0.0005,
    solarDiskReconstructionRelative: 1e-10,
    siriusVisibleRelative: 0.03,
    siriusNearInfraredRelative: 0.04,
    quadratureHighOrderRelative: 0.005,
    wrongRouteMinimumRelative: 1e-4,
    displayCallCount: 'exact',
});

const ATMOSPHERE_CONTROLS = Object.freeze({
    pathIntervalCount: 6,
    sourceTransmittanceIntervalCount: 4,
    incidentDirectionCount: 4,
    incidentAltitudeBinCount: 4,
});

const CAMERA_TO_ATMOSPHERE_MATRIX = Object.freeze([
    Object.freeze([0, 0, -1]),
    Object.freeze([-1, 0, 0]),
    Object.freeze([0, 1, 0]),
]);

const POINT_VACUUM_MATRIX = Object.freeze([
    Object.freeze({
        id: 'between-pixels-near-center-8x6-vfov10',
        widthPixels: 8,
        heightPixels: 6,
        verticalFovDegrees: 10,
        rasterX: 3.5,
        rasterY: 2.35,
        purpose: Object.freeze(['between-pixels', 'subpixel', 'base-resolution']),
    }),
    Object.freeze({
        id: 'between-pixels-resolution-16x12-vfov10',
        widthPixels: 16,
        heightPixels: 12,
        verticalFovDegrees: 10,
        rasterX: 7.5,
        rasterY: 5.2,
        purpose: Object.freeze(['resolution', 'between-pixels']),
    }),
    Object.freeze({
        id: 'between-pixels-fov-8x6-vfov30',
        widthPixels: 8,
        heightPixels: 6,
        verticalFovDegrees: 30,
        rasterX: 3.5,
        rasterY: 2.45,
        purpose: Object.freeze(['fov', 'between-pixels']),
    }),
    Object.freeze({
        id: 'off-axis-subpixel-10x6-vfov15',
        widthPixels: 10,
        heightPixels: 6,
        verticalFovDegrees: 15,
        rasterX: 1.25,
        rasterY: 2.4,
        purpose: Object.freeze(['field-position', 'subpixel']),
    }),
    Object.freeze({
        id: 'left-edge-loss-8x6-vfov10',
        widthPixels: 8,
        heightPixels: 6,
        verticalFovDegrees: 10,
        rasterX: -0.25,
        rasterY: 2.4,
        purpose: Object.freeze(['edge', 'explicit-off-raster']),
    }),
]);

const POINT_ACTUAL_CASE = Object.freeze({
    id: 'actual-near-horizon-between-pixels',
    widthPixels: 8,
    heightPixels: 6,
    verticalFovDegrees: 10,
    rasterX: 3.5,
    rasterY: 2.35,
});

const ATMOSPHERE_SUN_ALTITUDE_RADIANS = Math.PI / 180;
const ATMOSPHERE_SUN_DIRECTION = Object.freeze([
    Math.cos(ATMOSPHERE_SUN_ALTITUDE_RADIANS),
    0,
    Math.sin(ATMOSPHERE_SUN_ALTITUDE_RADIANS),
]);

const ATMOSPHERE_SUN_DIRECTION_CAMERA = Object.freeze([
    -ATMOSPHERE_SUN_DIRECTION[1],
    ATMOSPHERE_SUN_DIRECTION[2],
    -ATMOSPHERE_SUN_DIRECTION[0],
]);

const SUN_VACUUM_MATRIX = Object.freeze([
    Object.freeze({
        id: 'sun-center-subpixel-8x6-vfov10',
        widthPixels: 8,
        heightPixels: 6,
        verticalFovDegrees: 10,
        rasterX: 3.2,
        rasterY: 2.3,
        purpose: Object.freeze(['base-resolution', 'subpixel']),
    }),
    Object.freeze({
        id: 'sun-resolution-16x12-vfov10',
        widthPixels: 16,
        heightPixels: 12,
        verticalFovDegrees: 10,
        rasterX: 7.2,
        rasterY: 5.3,
        purpose: Object.freeze(['resolution', 'subpixel']),
    }),
    Object.freeze({
        id: 'sun-fov-8x6-vfov30',
        widthPixels: 8,
        heightPixels: 6,
        verticalFovDegrees: 30,
        rasterX: 3.2,
        rasterY: 2.3,
        purpose: Object.freeze(['fov']),
    }),
    Object.freeze({
        id: 'sun-off-axis-10x6-vfov15',
        widthPixels: 10,
        heightPixels: 6,
        verticalFovDegrees: 15,
        rasterX: 1.2,
        rasterY: 2.25,
        purpose: Object.freeze(['field-position']),
    }),
    Object.freeze({
        id: 'sun-left-edge-half-disk-8x6-vfov10',
        widthPixels: 8,
        heightPixels: 6,
        verticalFovDegrees: 10,
        rasterX: -0.5,
        rasterY: 2.3,
        purpose: Object.freeze(['edge', 'off-raster']),
    }),
]);

const SUN_RUNTIME_QUADRATURE = Object.freeze({ radialCount: 6, azimuthCount: 24 });
const SUN_HIGH_QUADRATURE = Object.freeze({ radialCount: 12, azimuthCount: 48 });

const DEPENDENCY_LOCK_PATHS = Object.freeze(['package.json', 'package-lock.json']);

const mode = parseMode(process.argv);
const startedAt = performance.now();
let recordCreated = false;

if (mode.kind === 'record') {
    await createFreshRecordDirectory(mode.recordDirectory);
    recordCreated = true;
}

try {
    const artifacts = await execute(mode, startedAt);
    if (mode.kind === 'record') {
        await writeArtifacts(mode.recordDirectory, artifacts);
    }
    console.log(JSON.stringify({
        mode: mode.kind,
        status: artifacts.result.status,
        er4TransportStatus: artifacts.result.er4TransportStatus,
        er5ExitStatus: artifacts.result.er5ExitStatus,
        acceptedCriterionCount: artifacts.result.acceptedCriterionCount,
        criterionCount: artifacts.result.criterionCount,
        pointTransportStatus: artifacts.result.pointTransportStatus,
        extendedTransportStatus: artifacts.result.extendedTransportStatus,
        fullFrameTransportStatus: artifacts.result.fullFrameTransportStatus,
        mechanicalStatus: artifacts.result.mechanicalStatus,
        physicalRadiometryStatus: artifacts.result.physicalRadiometryStatus,
        observationalStatus: artifacts.result.observationalStatus,
        extendedMetrics: summarizeExtendedMetrics(artifacts.extendedTransportResults),
        rejectedCriteria: artifacts.criteriaResults.criteria
            .filter((entry) => entry.status !== 'accepted')
            .map((entry) => entry.name),
        elapsedMilliseconds: artifacts.result.elapsedMilliseconds,
        recordDirectory: mode.recordDirectory,
    }));
} catch (error) {
    if (recordCreated) {
        await writeJson(mode.recordDirectory, 'failure.json', {
            status: 'invalid',
            runner: RUNNER,
            error: serializeError(error),
        });
        await writeJson(mode.recordDirectory, 'result.json', {
            status: 'invalid',
            er4TransportStatus: 'invalid-attempt',
            pointTransportStatus: 'invalid-attempt',
            extendedTransportStatus: 'invalid-attempt',
            fullFrameTransportStatus: 'invalid-attempt',
            er5ExitStatus: 'invalid-attempt',
            mechanicalStatus: 'invalid-attempt',
            physicalRadiometryStatus: 'invalid-attempt',
            automatedReviewabilityStatus: 'not-claimed',
            humanReviewStatus: 'not-claimed',
            observationalStatus: 'not-claimed',
        });
    }
    throw error;
}

async function execute(modeConfiguration, startTime) {
    const reference = await evaluateSourceReferences();
    const transport = await evaluateTransportClosure(reference);
    const criteria = buildCriteria(reference, transport);
    const statuses = deriveStatuses(criteria);
    const provenance = await buildProvenance(reference, transport);
    const elapsedMilliseconds = performance.now() - startTime;
    const acceptedCriterionCount = criteria.filter((entry) =>
        entry.status === 'accepted').length;
    const result = Object.freeze({
        status: statuses.overallStatus,
        er4TransportStatus: statuses.er4TransportStatus,
        pointTransportStatus: transport.point.status,
        extendedTransportStatus: transport.extended.status,
        fullFrameTransportStatus: transport.fullFrame.status,
        lunarDependencyStatus: statuses.lunarDependencyStatus,
        siriusReferenceStatus: statuses.siriusReferenceStatus,
        solarReferenceStatus: statuses.solarReferenceStatus,
        er5ExitStatus: statuses.er5ExitStatus,
        mechanicalStatus: statuses.er4TransportStatus,
        physicalRadiometryStatus: statuses.overallStatus,
        automatedReviewabilityStatus: 'not-claimed',
        humanReviewStatus: 'not-claimed',
        observationalStatus: 'not-claimed',
        acceptedCriterionCount,
        criterionCount: criteria.length,
        elapsedMilliseconds,
        imageCount: 0,
        gpuClaimed: false,
        productionClaimed: false,
        nextPhase: statuses.overallStatus === 'accepted'
            ? 'ER6 real Flat32 globe validation'
            : 'ER4C/ER5 correction in a fresh implementation attempt',
    });
    const criteriaResults = Object.freeze({
        status: statuses.overallStatus,
        ...statuses,
        pointTransportStatus: transport.point.status,
        extendedTransportStatus: transport.extended.status,
        fullFrameTransportStatus: transport.fullFrame.status,
        mechanicalStatus: statuses.er4TransportStatus,
        physicalRadiometryStatus: statuses.overallStatus,
        automatedReviewabilityStatus: 'not-claimed',
        humanReviewStatus: 'not-claimed',
        observationalStatus: 'not-claimed',
        criteria: Object.freeze(criteria),
    });
    return Object.freeze({
        stateGoal: stateGoalText(),
        inputs: buildInputs(),
        provenance,
        equationsAndTolerances: buildEquationsAndTolerances(),
        sourceReferenceResults: reference.artifact,
        pointTransportResults: transport.point,
        extendedTransportResults: transport.extended,
        fullFrameResults: transport.fullFrame,
        criteriaResults,
        command: Object.freeze({
            commands: Object.freeze([Object.freeze({
                command: modeConfiguration.command,
                timestamp: nowIso(),
                writesRecord: modeConfiguration.kind === 'record',
            })]),
        }),
        result,
        report: reportText(result, criteria),
    });
}

async function evaluateSourceReferences() {
    const basis = createCanonicalSpectralDensityBasis();
    const canonicalSolar = createCanonicalSolarIrradianceDensity(basis);
    const manifest = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST;
    const canonicalSolarFixturePath =
        `${FIXTURE_ROOT}/${manifest.canonicalSolar.fileName}`;
    const calspecPath = `${FIXTURE_ROOT}/${manifest.siriusCalspec.fileName}`;
    const [canonicalSolarFixtureBytes, calspecBytes] = await Promise.all([
        readFile(canonicalSolarFixturePath),
        readFile(calspecPath),
    ]);
    const canonicalSolarFixtureIdentity = Object.freeze({
        path: canonicalSolarFixturePath,
        byteLength: canonicalSolarFixtureBytes.byteLength,
        sourceHashSha256: hashBytes(canonicalSolarFixtureBytes),
        role: 'provenance-only; runtime values remain owned by the canonical packet',
    });
    if (
        canonicalSolarFixtureIdentity.byteLength !== manifest.canonicalSolar.byteLength
        || canonicalSolarFixtureIdentity.sourceHashSha256
            !== manifest.canonicalSolar.sourceHashSha256
    ) {
        throw new Error('Pinned canonical-solar provenance bytes do not match the fixture manifest.');
    }
    const calspecIdentity = Object.freeze({
        path: calspecPath,
        byteLength: calspecBytes.byteLength,
        sourceHashSha256: hashBytes(calspecBytes),
    });
    if (
        calspecIdentity.byteLength !== manifest.siriusCalspec.byteLength
        || calspecIdentity.sourceHashSha256
            !== manifest.siriusCalspec.sourceHashSha256
    ) {
        throw new Error('Pinned CALSPEC Sirius bytes do not match the fixture manifest.');
    }
    const sirius = createCalspecSiriusIrradianceDensity(calspecBytes, basis);
    const tsis = await new TsisHsrsReferenceReader().read();
    const rieke = await new RiekeSiriusReferenceEvaluator().evaluate(sirius.parsed);
    const lunarDependency = await readLunarDependency();
    const canonicalSolarIntegral = canonicalSolar.values.reduce((sum, value, index) =>
        sum + value * basis.channels[index].widthNanometers, 0);
    const referenceSolarIntegral =
        tsis.visibleIntegral.integratedIrradianceWattsPerSquareMeter;
    const referenceSolarUncertainty =
        tsis.visibleIntegral.fullyCorrelatedStandardUncertaintyWattsPerSquareMeter;
    const solarThreshold = Math.max(
        TOLERANCES.solarReferenceMinimumRelative,
        TOLERANCES.solarReferenceUncertaintyMultiplier
            * referenceSolarUncertainty / referenceSolarIntegral,
        TOLERANCES.solarReferenceAbsoluteFloorRelative,
    );
    const solarRelativeDifference = canonicalSolarIntegral / referenceSolarIntegral - 1;
    const siriusVisibleRelativeDifference =
        rieke.visible.comparisonInputs.signedRelativeDifference;
    const siriusNearInfraredRelativeDifference =
        rieke.nearInfrared.comparisonInputs.signedRelativeDifference;

    return Object.freeze({
        basis,
        canonicalSolar,
        canonicalSolarFixtureIdentity,
        sirius,
        calspecIdentity,
        tsis,
        rieke,
        lunarDependency,
        metrics: Object.freeze({
            canonicalSolarIntegralWattsPerSquareMeter: canonicalSolarIntegral,
            tsisSolarIntegralWattsPerSquareMeter: referenceSolarIntegral,
            tsisFullyCorrelatedStandardUncertaintyWattsPerSquareMeter:
                referenceSolarUncertainty,
            solarRelativeDifference,
            solarThreshold,
            siriusVisibleRelativeDifference,
            siriusNearInfraredRelativeDifference,
        }),
        artifact: Object.freeze({
            canonicalBasis: basis.describe(),
            canonicalSolar: Object.freeze({
                packet: canonicalSolar.describe(),
                retainedProvenanceFixtureIdentity: canonicalSolarFixtureIdentity,
            }),
            solarComparison: Object.freeze({
                canonicalIntegralWattsPerSquareMeter: canonicalSolarIntegral,
                referenceIntegralWattsPerSquareMeter: referenceSolarIntegral,
                referenceFullyCorrelatedStandardUncertaintyWattsPerSquareMeter:
                    referenceSolarUncertainty,
                signedRelativeDifference: solarRelativeDifference,
                threshold: solarThreshold,
                referenceOperator: tsis.visibleIntegral,
                referenceSchema: tsis.schema,
                referenceProvenance: tsis.provenance,
                qualifications: tsis.qualifications,
            }),
            sirius: Object.freeze({
                packet: sirius.packet.describe(),
                retainedFixtureIdentity: calspecIdentity,
                visible: rieke.visible,
                nearInfrared: rieke.nearInfrared,
                provenance: rieke.provenance,
                qualifications: rieke.qualifications,
            }),
            lunarDependency,
        }),
    });
}

async function readLunarDependency() {
    const [resultBytes, criteriaBytes] = await Promise.all([
        readFile(LUNAR_RESULT_PATH),
        readFile(LUNAR_CRITERIA_PATH),
    ]);
    const result = JSON.parse(resultBytes.toString('utf8'));
    const criteria = JSON.parse(criteriaBytes.toString('utf8'));
    const resultHashSha256 = hashBytes(resultBytes);
    const criteriaHashSha256 = hashBytes(criteriaBytes);
    const accepted = result.status === 'accepted'
        && result.lunarPhysicalReferenceStatus === 'accepted'
        && criteria.status === 'accepted'
        && Array.isArray(criteria.criteria)
        && criteria.criteria.length > 0
        && Number.isSafeInteger(result.acceptedCriterionCount)
        && Number.isSafeInteger(result.criterionCount)
        && result.criterionCount === criteria.criteria.length
        && result.acceptedCriterionCount === result.criterionCount
        && resultHashSha256 === EXPECTED_LUNAR_RESULT_HASH_SHA256
        && criteriaHashSha256 === EXPECTED_LUNAR_CRITERIA_HASH_SHA256
        && criteria.criteria.every((entry) => entry.status === 'accepted');
    return Object.freeze({
        recordId: '049-er5-lunar-physical-reference-calibration',
        claim: 'sealed disk-integrated lunar XA-G09 dependency only',
        result: Object.freeze({
            path: LUNAR_RESULT_PATH,
            sourceHashSha256: resultHashSha256,
            expectedSourceHashSha256: EXPECTED_LUNAR_RESULT_HASH_SHA256,
            status: result.status,
            lunarPhysicalReferenceStatus: result.lunarPhysicalReferenceStatus,
            acceptedCriterionCount: result.acceptedCriterionCount,
            criterionCount: result.criterionCount,
        }),
        criteria: Object.freeze({
            path: LUNAR_CRITERIA_PATH,
            sourceHashSha256: criteriaHashSha256,
            expectedSourceHashSha256: EXPECTED_LUNAR_CRITERIA_HASH_SHA256,
            status: criteria.status,
            acceptedCriterionCount: criteria.criteria.filter((entry) =>
                entry.status === 'accepted').length,
            criterionCount: criteria.criteria.length,
        }),
        accepted,
        runnerImported: false,
        runnerExecuted: false,
    });
}

async function evaluateTransportClosure(reference) {
    const point = evaluatePointTransport(reference);
    const extended = evaluateExtendedTransport(reference);
    const fullFrame = evaluateFullFrameTransport(reference);
    const implemented = point.status === 'accepted'
        && extended.status === 'accepted'
        && fullFrame.status === 'accepted';
    return Object.freeze({
        implemented,
        point,
        extended,
        fullFrame,
        reference,
    });
}

function evaluatePointTransport(reference) {
    const siriusSource = createSiriusSource(
        reference.sirius.packet,
        'calspec-sirius-point',
        'physical CALSPEC Sirius point-source fixture',
    );
    const clearVisibility = new ExactDirectionalVisibilityResolver({
        blockers: [],
        depthTieToleranceMeters: 0,
    });
    const response = new BilinearPointResponse();
    const vacuumMatrix = POINT_VACUUM_MATRIX.map((configuration) =>
        evaluateVacuumPointCase({
            configuration,
            source: siriusSource,
            response,
            visibilityResolver: clearVisibility,
            basisFingerprint: reference.basis.fingerprint,
        }));

    const atmosphereModel = createResetAtmosphereModel(reference.canonicalSolar);
    const actualCamera = new PerspectiveCameraRaster(POINT_ACTUAL_CASE);
    const actualFrameEvaluator = createFrozenFrameEvaluator(
        actualCamera,
        reference.basis.fingerprint,
        atmosphereModel,
    );
    const actualDirection = actualCamera.rasterCenterToDirection(
        POINT_ACTUAL_CASE.rasterX,
        POINT_ACTUAL_CASE.rasterY,
    );
    const actualTransportAudit = createExactPointTransportAudit(
        clearVisibility,
        actualFrameEvaluator,
    );
    const actualAccumulator = new TransportedPointSourceAccumulator({
        camera: actualCamera,
        response,
        visibilityResolver: actualTransportAudit.visibilityProvider,
        transmittanceSampler: actualTransportAudit.transmittanceProvider,
    });
    const actual = actualAccumulator.accumulate({
        source: siriusSource,
        sourceDirectionCamera: actualDirection,
        sourceDepth: { kind: 'infinite' },
    });
    const actualExpectedTransmitted = multiplySpectra(
        reference.sirius.packet.values,
        actual.transmittance.values,
    );
    const actualTransportRelativeResidual = spectralRelativeResidual(
        actual.transmittedSpectralIrradiance.values,
        actualExpectedTransmitted,
    );
    const actualPixelFormulaRelativeResidual = maximumPointPixelFormulaResidual(
        actual,
        actualExpectedTransmitted,
    );
    const actualConservationRelativeResidual = spectralRelativeResidual(
        actual.accountedSpectralIrradiance.values,
        actual.transmittedSpectralIrradiance.values,
    );
    const actualCallbackEvidence = actualTransportAudit.evidence(actual.exactSourceRay);
    const wrongRoutes = evaluatePointWrongRoutes({
        frameEvaluator: actualFrameEvaluator,
        camera: actualCamera,
        sourcePacket: reference.sirius.packet,
        proper: actual,
    });
    const blocker = evaluateBlockedPointCase({
        camera: actualCamera,
        source: siriusSource,
        directionCamera: actualDirection,
        response,
        frameEvaluator: actualFrameEvaluator,
    });
    const additivity = evaluatePointAdditivity({
        camera: actualCamera,
        source: siriusSource,
        sourcePacket: reference.sirius.packet,
        directionCamera: actualDirection,
        response,
        visibilityResolver: clearVisibility,
        frameEvaluator: actualFrameEvaluator,
        individual: actual,
    });
    const actualAtmosphereDirection = mapCameraDirection(actualDirection);
    const actualAltitudeDegrees = Math.asin(actualAtmosphereDirection[2]) * 180 / Math.PI;
    const edgeCase = vacuumMatrix.find((entry) => entry.result.response.offRasterWeight > 0);
    const matrixCoverage = describeCameraMatrixCoverage(
        POINT_VACUUM_MATRIX,
        vacuumMatrix,
        (entry) => entry.result.response.offRasterWeight > 0,
    );
    const criteria = Object.freeze([
        criterion(
            'er4-transport',
            'point-vacuum-matrix-spans-resolution-fov-field-subpixel-and-edge',
            matrixCoverage.hasMultipleResolutions
                && matrixCoverage.hasMultipleVerticalFovs
                && matrixCoverage.hasOffAxisFieldCase
                && matrixCoverage.hasSubpixelCase
                && matrixCoverage.hasMeasuredOffRasterCase,
            matrixCoverage,
        ),
        criterion(
            'er4-transport',
            'point-vacuum-matrix-uses-exact-f-times-p-over-omega',
            vacuumMatrix.every((entry) =>
                entry.metrics.maximumPixelFormulaRelativeResidual
                    <= TOLERANCES.spectralRelative),
            Object.freeze({
                maximumRelativeResidual: Math.max(...vacuumMatrix.map((entry) =>
                    entry.metrics.maximumPixelFormulaRelativeResidual)),
                tolerance: TOLERANCES.spectralRelative,
            }),
        ),
        criterion(
            'er4-transport',
            'point-vacuum-on-frame-plus-off-raster-reconstructs-input',
            vacuumMatrix.every((entry) =>
                entry.metrics.conservationRelativeResidual
                    <= TOLERANCES.spectralRelative),
            Object.freeze({
                maximumRelativeResidual: Math.max(...vacuumMatrix.map((entry) =>
                    entry.metrics.conservationRelativeResidual)),
                tolerance: TOLERANCES.spectralRelative,
            }),
        ),
        criterion(
            'er4-transport',
            'point-edge-loss-is-explicit-and-not-renormalized',
            edgeCase.result.response.offRasterWeight > 0
                && edgeCase.result.response.onFrameWeight > 0
                && edgeCase.result.response.fullWeight === 1,
            Object.freeze({
                onFrameWeight: edgeCase.result.response.onFrameWeight,
                offRasterWeight: edgeCase.result.response.offRasterWeight,
                fullWeight: edgeCase.result.response.fullWeight,
            }),
        ),
        criterion(
            'er4-transport',
            'point-actual-near-horizon-exact-source-transmittance-precedes-response',
            actualCallbackEvidence.visibilityCallCount === 1
                && actualCallbackEvidence.transmittanceCallCount === 1
                && actualCallbackEvidence.visibilityUsedExpectedRayObject === true
                && actualCallbackEvidence.transmittanceUsedExpectedRayObject === true
                && actualCallbackEvidence.callbacksUsedSameRayObject === true
                && actualTransportRelativeResidual <= TOLERANCES.spectralRelative
                && actualPixelFormulaRelativeResidual <= TOLERANCES.spectralRelative,
            Object.freeze({
                sourceAltitudeDegrees: actualAltitudeDegrees,
                rasterCenter: actual.rasterCenter,
                callbackEvidence: actualCallbackEvidence,
                accumulatorTransportCalls: actual.transportCalls,
                transportRelativeResidual: actualTransportRelativeResidual,
                pixelFormulaRelativeResidual: actualPixelFormulaRelativeResidual,
                tolerance: TOLERANCES.spectralRelative,
            }),
        ),
        criterion(
            'er4-transport',
            'point-actual-atmosphere-on-plus-off-conservation-passes',
            actualConservationRelativeResidual <= TOLERANCES.spectralRelative,
            Object.freeze({
                relativeResidual: actualConservationRelativeResidual,
                tolerance: TOLERANCES.spectralRelative,
            }),
        ),
        criterion(
            'er4-transport',
            'point-destination-transmittance-wrong-route-is-discriminated',
            wrongRoutes.destinationTransmittance.relativeDifference
                >= TOLERANCES.wrongRouteMinimumRelative,
            Object.freeze({
                relativeDifference:
                    wrongRoutes.destinationTransmittance.relativeDifference,
                minimum: TOLERANCES.wrongRouteMinimumRelative,
            }),
        ),
        criterion(
            'er4-transport',
            'point-double-transmittance-wrong-route-is-discriminated',
            wrongRoutes.doubleTransmittance.relativeDifference
                >= TOLERANCES.wrongRouteMinimumRelative,
            Object.freeze({
                relativeDifference: wrongRoutes.doubleTransmittance.relativeDifference,
                minimum: TOLERANCES.wrongRouteMinimumRelative,
            }),
        ),
        criterion(
            'er4-transport',
            'point-exact-blocker-skips-transmittance-and-retains-occluder',
            blocker.result.visibility.visible === false
                && blocker.result.visibility.occluder?.id === blocker.blocker.id
                && blocker.blockerIntersectionCallCount === 1
                && blocker.samplerCallCount === 0
                && blocker.result.pixels.length === 0,
            Object.freeze({
                visibility: blocker.result.visibility,
                blockerIntersectionCallCount: blocker.blockerIntersectionCallCount,
                accumulatorTransportCalls: blocker.result.transportCalls,
                samplerCallCount: blocker.samplerCallCount,
            }),
        ),
        criterion(
            'er4-transport',
            'point-overlapping-sources-add-linearly',
            additivity.maximumRelativeResidual <= TOLERANCES.spectralRelative,
            Object.freeze({
                maximumRelativeResidual: additivity.maximumRelativeResidual,
                transportCalls: additivity.result.transportCalls,
                tolerance: TOLERANCES.spectralRelative,
            }),
        ),
    ]);
    const status = criteria.length > 0
        && criteria.every((entry) => entry.status === 'accepted')
        ? 'accepted'
        : 'rejected';
    return Object.freeze({
        status,
        source: siriusSource.describe(),
        response: response.describe(),
        visibilityResolver: clearVisibility.describe(),
        vacuumMatrix: Object.freeze(vacuumMatrix),
        actualAtmosphere: Object.freeze({
            configuration: POINT_ACTUAL_CASE,
            camera: actualCamera.describe(),
            cameraFingerprint: actualCamera.fingerprint,
            sourceDirectionCamera: actualDirection,
            sourceDirectionAtmosphere: actualAtmosphereDirection,
            sourceAltitudeDegrees: actualAltitudeDegrees,
            frameEvaluator: actualFrameEvaluator.describe(),
            result: actual,
            metrics: Object.freeze({
                callbackEvidence: actualCallbackEvidence,
                transportRelativeResidual: actualTransportRelativeResidual,
                pixelFormulaRelativeResidual: actualPixelFormulaRelativeResidual,
                conservationRelativeResidual: actualConservationRelativeResidual,
            }),
        }),
        wrongRoutes,
        blocker,
        additivity,
        atmosphereModel: atmosphereModel.descriptor,
        criteria,
    });
}

function evaluateVacuumPointCase({
    configuration,
    source,
    response,
    visibilityResolver,
    basisFingerprint,
}) {
    const camera = new PerspectiveCameraRaster(configuration);
    const frameEvaluator = createVacuumFrameEvaluator(camera, basisFingerprint);
    const directionCamera = camera.rasterCenterToDirection(
        configuration.rasterX,
        configuration.rasterY,
    );
    const result = new TransportedPointSourceAccumulator({
        camera,
        response,
        visibilityResolver,
        transmittanceSampler: frameEvaluator,
    }).accumulate({
        source,
        sourceDirectionCamera: directionCamera,
        sourceDepth: { kind: 'infinite' },
    });
    const maximumPixelFormulaRelativeResidual = maximumPointPixelFormulaResidual(
        result,
        source.spectralMeasure.values,
    );
    const conservationRelativeResidual = spectralRelativeResidual(
        result.accountedSpectralIrradiance.values,
        source.spectralMeasure.values,
    );
    const directionAtmosphere = mapCameraDirection(directionCamera);
    return Object.freeze({
        configuration,
        camera: camera.describe(),
        cameraFingerprint: camera.fingerprint,
        directionCamera,
        directionAtmosphere,
        altitudeDegrees: Math.asin(directionAtmosphere[2]) * 180 / Math.PI,
        result,
        metrics: Object.freeze({
            maximumPixelFormulaRelativeResidual,
            conservationRelativeResidual,
        }),
    });
}

function evaluatePointWrongRoutes({ frameEvaluator, camera, sourcePacket, proper }) {
    const destinationRows = proper.response.onFrameDestinations.map((destination) => {
        const directionCamera = camera.rasterCenterToDirection(
            destination.pixelX,
            destination.pixelY,
        );
        const evaluation = frameEvaluator.evaluateCameraDirection(directionCamera);
        return Object.freeze({
            pixelX: destination.pixelX,
            pixelY: destination.pixelY,
            responseWeight: destination.weight,
            directionCamera,
            directionAtmosphere: evaluation.directionAtmosphere,
            transmittance: evaluation.viewSpectralTransmittance,
        });
    });
    const destinationTransmittanceValues = Array(15).fill(0);
    for (const row of destinationRows) {
        for (let channel = 0; channel < destinationTransmittanceValues.length; channel += 1) {
            destinationTransmittanceValues[channel] += sourcePacket.values[channel]
                * row.transmittance.values[channel]
                * row.responseWeight;
        }
    }
    const properOnFrame = proper.reconstructedOnFrameSpectralIrradiance.values;
    const doubleTransmittanceValues = proper.transmittedSpectralIrradiance.values.map(
        (value, channel) => value
            * proper.transmittance.values[channel]
            * proper.response.onFrameWeight,
    );
    return Object.freeze({
        qualification: 'diagnostic wrong routes only; neither enters frame composition',
        destinationTransmittance: Object.freeze({
            formula: 'sum_i F_lambda * p_i * T_lambda(destinationPixelCenter_i)',
            rows: Object.freeze(destinationRows),
            wrongOnFrameSpectralIrradiance: Object.freeze(destinationTransmittanceValues),
            properOnFrameSpectralIrradiance: properOnFrame,
            relativeDifference: spectralRelativeResidual(
                destinationTransmittanceValues,
                properOnFrame,
            ),
        }),
        doubleTransmittance: Object.freeze({
            formula: 'F_lambda * T_lambda(source)^2 * onFrameWeight',
            wrongOnFrameSpectralIrradiance: Object.freeze(doubleTransmittanceValues),
            properOnFrameSpectralIrradiance: properOnFrame,
            relativeDifference: spectralRelativeResidual(
                doubleTransmittanceValues,
                properOnFrame,
            ),
        }),
    });
}

function evaluateBlockedPointCase({
    camera,
    source,
    directionCamera,
    response,
    frameEvaluator,
}) {
    let blockerIntersectionCallCount = 0;
    const blocker = Object.freeze({
        id: 'nearer-scene-blocker',
        kind: 'scene',
        fingerprint: stableHash({ kind: 'nearer-scene-blocker-v1', distanceMeters: 1 }),
        intersectExactRay: () => {
            blockerIntersectionCallCount += 1;
            return Object.freeze({
                distanceMeters: 1,
                featureId: 'analytic-blocking-plane',
            });
        },
    });
    const visibilityResolver = new ExactDirectionalVisibilityResolver({
        blockers: [blocker],
        depthTieToleranceMeters: 0,
    });
    const countingSampler = createCountingPointSampler(frameEvaluator);
    const result = new TransportedPointSourceAccumulator({
        camera,
        response,
        visibilityResolver,
        transmittanceSampler: countingSampler.provider,
    }).accumulate({
        source,
        sourceDirectionCamera: directionCamera,
        sourceDepth: { kind: 'infinite' },
    });
    return Object.freeze({
        blocker: Object.freeze({
            id: blocker.id,
            kind: blocker.kind,
            fingerprint: blocker.fingerprint,
        }),
        visibilityResolver: visibilityResolver.describe(),
        samplerFingerprint: countingSampler.provider.fingerprint,
        samplerCallCount: countingSampler.callCount(),
        blockerIntersectionCallCount,
        result,
    });
}

function evaluatePointAdditivity({
    camera,
    source,
    sourcePacket,
    directionCamera,
    response,
    visibilityResolver,
    frameEvaluator,
    individual,
}) {
    const secondSource = createSiriusSource(
        sourcePacket,
        'calspec-sirius-additivity-copy',
        'explicit duplicate-flux additivity diagnostic; not a second physical Sirius claim',
    );
    const result = new TransportedPointSourceAccumulator({
        camera,
        response,
        visibilityResolver,
        transmittanceSampler: frameEvaluator,
    }).accumulateMany({
        points: [
            Object.freeze({
                source,
                sourceDirectionCamera: directionCamera,
                sourceDepth: { kind: 'infinite' },
            }),
            Object.freeze({
                source: secondSource,
                sourceDirectionCamera: directionCamera,
                sourceDepth: { kind: 'infinite' },
            }),
        ],
    });
    const residuals = [
        spectralRelativeResidual(
            result.sourceSpectralIrradiance.values,
            scaleSpectrum(individual.sourceSpectralIrradiance.values, 2),
        ),
        spectralRelativeResidual(
            result.transmittedSpectralIrradiance.values,
            scaleSpectrum(individual.transmittedSpectralIrradiance.values, 2),
        ),
        spectralRelativeResidual(
            result.reconstructedOnFrameSpectralIrradiance.values,
            scaleSpectrum(individual.reconstructedOnFrameSpectralIrradiance.values, 2),
        ),
        spectralRelativeResidual(
            result.offRasterSpectralIrradiance.values,
            scaleSpectrum(individual.offRasterSpectralIrradiance.values, 2),
        ),
    ];
    const individualPixels = new Map(individual.pixels.map((pixel) => [
        `${pixel.pixelX},${pixel.pixelY}`,
        pixel,
    ]));
    for (const pixel of result.pixels) {
        const expected = individualPixels.get(`${pixel.pixelX},${pixel.pixelY}`);
        residuals.push(spectralRelativeResidual(
            pixel.pointSpectralRadianceDensity,
            scaleSpectrum(expected.pointSpectralRadianceDensity, 2),
        ));
    }
    return Object.freeze({
        qualification:
            'Two source identities deliberately share one CALSPEC packet only to test linear overlap.',
        secondSource: secondSource.describe(),
        maximumRelativeResidual: Math.max(...residuals),
        result,
    });
}

function createSiriusSource(packet, id, qualification) {
    return new ExternalCelestialSource({
        id,
        kind: 'point',
        geometry: Object.freeze({
            kind: 'calspec-directional-point-source',
            owner: 'ER4C/ER5 exact point-source fixture',
            qualification,
        }),
        spectralMeasure: packet,
    });
}

function createResetAtmosphereModel(canonicalSolar) {
    const geometry = new SphericalEarthGeometry({
        bottomRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
        topRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters,
        observerHeightMeters: FIGURE1_RENDER_CONSTANTS.observerHeightMeters,
        sourceDirection: ATMOSPHERE_SUN_DIRECTION,
        cacheAltitudeBinCount: ATMOSPHERE_CONTROLS.incidentAltitudeBinCount,
        sourceTransmittanceIntervalCount:
            ATMOSPHERE_CONTROLS.sourceTransmittanceIntervalCount,
    });
    const atmosphere = new CanonicalAtmosphere({
        constants: CANONICAL_ATMOSPHERE_CONSTANTS,
        spectralChannels: CANONICAL_SPECTRAL_CHANNELS,
    });
    const lightSource = new CanonicalSolarIlluminationSource({
        irradiancePacket: canonicalSolar,
        directionToLight: ATMOSPHERE_SUN_DIRECTION,
        angularRadiusRadians: DISTANT_SUN_CONSTANTS.angularRadiusRadians,
        cacheAltitudeBinCount: ATMOSPHERE_CONTROLS.incidentAltitudeBinCount,
        cacheDirectionCount: ATMOSPHERE_CONTROLS.incidentDirectionCount,
        cacheBoundaryAltitudeMeters: FIGURE1_RENDER_CONSTANTS.observerHeightMeters,
    });
    const calculator = new SpectralCalculator({
        geometry,
        atmosphere,
        lightSource,
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
        executionControls: ATMOSPHERE_CONTROLS,
    });
    const evaluator = new SpectralReferenceEvaluator({
        geometry,
        atmosphere,
        lightSource,
        calculator,
        spectralBasis: CANONICAL_SPECTRAL_BASIS,
        executionControls: ATMOSPHERE_CONTROLS,
    });
    const descriptor = Object.freeze({
        kind: 'reset-canonical-solar-spherical-atmosphere-v1',
        geometry: Object.freeze({
            kind: 'spherical-earth',
            bottomRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.bottomRadiusMeters,
            topRadiusMeters: CANONICAL_ATMOSPHERE_CONSTANTS.topRadiusMeters,
            observerHeightMeters: FIGURE1_RENDER_CONSTANTS.observerHeightMeters,
        }),
        atmosphereConstantsHash: stableHash(CANONICAL_ATMOSPHERE_CONSTANTS),
        spectralBasisHash: stableHash(CANONICAL_SPECTRAL_BASIS),
        controls: ATMOSPHERE_CONTROLS,
        illumination: lightSource.describe(),
        rejectedExternalCandidateSeamImported: false,
    });
    return Object.freeze({ geometry, atmosphere, lightSource, calculator, evaluator, descriptor });
}

function createFrozenFrameEvaluator(camera, basisFingerprint, model) {
    return new FrozenAtmosphereSpectralFrameEvaluator({
        camera,
        evaluator: model.evaluator,
        basisFingerprint,
        cameraToAtmosphereMatrix: CAMERA_TO_ATMOSPHERE_MATRIX,
        evaluatorDescriptor: model.descriptor,
    });
}

function createVacuumFrameEvaluator(camera, basisFingerprint) {
    const evaluatorDescriptor = Object.freeze({
        kind: 'er4c-vacuum-spectral-control-v1',
        pathSpectralRadianceDensity: 0,
        spectralTransmittance: 1,
        channelCount: 15,
    });
    const evaluator = Object.freeze({
        evaluate({ viewRayRequest }) {
            return Object.freeze({
                outputKind: 'spectral',
                pathRadiance: Object.freeze({
                    inScattered: Object.freeze(Array(15).fill(0)),
                    transmittance: Object.freeze(Array(15).fill(1)),
                }),
                viewRaySegment: Object.freeze({
                    ray: Object.freeze({
                        origin: Object.freeze([0, 0, 0]),
                        direction: viewRayRequest.direction,
                    }),
                    startDistanceMeters: 0,
                    endDistanceMeters: viewRayRequest.endDistanceMeters ?? 1,
                }),
            });
        },
    });
    return new FrozenAtmosphereSpectralFrameEvaluator({
        camera,
        evaluator,
        basisFingerprint,
        cameraToAtmosphereMatrix: CAMERA_TO_ATMOSPHERE_MATRIX,
        evaluatorDescriptor,
    });
}

function createCountingSpectralEvaluator(evaluator) {
    let calls = 0;
    const provider = Object.freeze({
        fingerprint: stableHash({
            kind: 'record-050-counting-spectral-evaluator-v1',
            delegate: 'frozen-spectral-reference-evaluator',
        }),
        evaluate(request) {
            calls += 1;
            return evaluator.evaluate(request);
        },
    });
    return Object.freeze({ provider, callCount: () => calls });
}

function createCountingPointSampler(frameEvaluator) {
    let calls = 0;
    const provider = Object.freeze({
        fingerprint: stableHash({
            kind: 'counting-point-transmittance-wrapper-v1',
            frameEvaluatorFingerprint: frameEvaluator.fingerprint,
        }),
        sampleExactSourceTransmittance(ray) {
            calls += 1;
            return frameEvaluator.sampleExactSourceTransmittance(ray);
        },
    });
    return Object.freeze({ provider, callCount: () => calls });
}

function createExactPointTransportAudit(visibilityResolver, frameEvaluator) {
    const visibilityRays = [];
    const transmittanceRays = [];
    const visibilityProvider = Object.freeze({
        fingerprint: stableHash({
            kind: 'record-050-capturing-point-visibility-provider-v1',
            delegateFingerprint: visibilityResolver.fingerprint,
        }),
        resolveExactSourceVisibility(ray) {
            visibilityRays.push(ray);
            return visibilityResolver.resolveExactSourceVisibility(ray);
        },
    });
    const transmittanceProvider = Object.freeze({
        fingerprint: stableHash({
            kind: 'record-050-capturing-point-transmittance-provider-v1',
            delegateFingerprint: frameEvaluator.fingerprint,
        }),
        sampleExactSourceTransmittance(ray) {
            transmittanceRays.push(ray);
            return frameEvaluator.sampleExactSourceTransmittance(ray);
        },
    });
    return Object.freeze({
        visibilityProvider,
        transmittanceProvider,
        evidence(expectedRay) {
            return Object.freeze({
                visibilityCallCount: visibilityRays.length,
                transmittanceCallCount: transmittanceRays.length,
                visibilityUsedExpectedRayObject:
                    visibilityRays.length === 1 && visibilityRays[0] === expectedRay,
                transmittanceUsedExpectedRayObject:
                    transmittanceRays.length === 1 && transmittanceRays[0] === expectedRay,
                callbacksUsedSameRayObject:
                    visibilityRays.length === 1
                    && transmittanceRays.length === 1
                    && visibilityRays[0] === transmittanceRays[0],
                exactRay: expectedRay,
                visibilityProviderFingerprint: visibilityProvider.fingerprint,
                transmittanceProviderFingerprint: transmittanceProvider.fingerprint,
            });
        },
    });
}

function maximumPointPixelFormulaResidual(result, transmittedValues) {
    return Math.max(0, ...result.pixels.map((pixel) => {
        const expected = transmittedValues.map((value) =>
            value * pixel.responseWeight / pixel.pixelSolidAngleSteradians);
        return spectralRelativeResidual(pixel.pointSpectralRadianceDensity, expected);
    }));
}

function mapCameraDirection(directionCamera) {
    return Object.freeze(CAMERA_TO_ATMOSPHERE_MATRIX.map((row) =>
        row.reduce((sum, value, index) => sum + value * directionCamera[index], 0)));
}

function multiplySpectra(left, right) {
    return Object.freeze(left.map((value, index) => value * right[index]));
}

function scaleSpectrum(values, scale) {
    return Object.freeze(values.map((value) => value * scale));
}

function spectralRelativeResidual(actual, expected) {
    return Math.max(...actual.map((value, index) =>
        Math.abs(value - expected[index])
            / Math.max(Math.abs(expected[index]), TOLERANCES.spectralScaleFloor)));
}

function evaluateExtendedTransport(reference) {
    const clearVisibility = new ExactDirectionalVisibilityResolver({
        blockers: [],
        depthTieToleranceMeters: 0,
    });
    const vacuumMatrix = SUN_VACUUM_MATRIX.map((configuration) =>
        evaluateVacuumSunCase({
            configuration,
            canonicalSolar: reference.canonicalSolar,
            basisFingerprint: reference.basis.fingerprint,
            visibilityResolver: clearVisibility,
        }));
    const directSource = vacuumMatrix[0].source;
    const atmosphereModel = createResetAtmosphereModel(reference.canonicalSolar);
    const actualCamera = new PerspectiveCameraRaster(POINT_ACTUAL_CASE);
    const actualFrameEvaluator = createFrozenFrameEvaluator(
        actualCamera,
        reference.basis.fingerprint,
        atmosphereModel,
    );
    const actualSun = createSunDisk(
        reference.canonicalSolar,
        'canonical-sun-disk',
        ATMOSPHERE_SUN_DIRECTION_CAMERA,
    );
    const actualLowTransportAudit = createExtendedTransportAudit(
        clearVisibility,
        actualFrameEvaluator,
        'runtime',
    );
    const actualLowIntegrator = new TransportedExtendedSourceIntegrator({
        camera: actualCamera,
        visibilityResolver: actualLowTransportAudit.visibilityProvider,
        transmittanceSampler: actualLowTransportAudit.transmittanceProvider,
    });
    const actualLow = actualLowIntegrator.integrate({
        source: actualSun,
        sourceDepth: { kind: 'infinite' },
        ...SUN_RUNTIME_QUADRATURE,
    });
    const actualHighTransportAudit = createExtendedTransportAudit(
        clearVisibility,
        actualFrameEvaluator,
        'high-order',
    );
    const actualHighIntegrator = new TransportedExtendedSourceIntegrator({
        camera: actualCamera,
        visibilityResolver: actualHighTransportAudit.visibilityProvider,
        transmittanceSampler: actualHighTransportAudit.transmittanceProvider,
    });
    const actualHigh = actualHighIntegrator.integrate({
        source: actualSun,
        sourceDepth: { kind: 'infinite' },
        ...SUN_HIGH_QUADRATURE,
    });
    const actualLowCallbackEvidence = actualLowTransportAudit.evidence();
    const actualHighCallbackEvidence = actualHighTransportAudit.evidence();
    const centerEvaluation = actualFrameEvaluator.evaluateCameraDirection(
        ATMOSPHERE_SUN_DIRECTION_CAMERA,
    );
    const actualMetrics = Object.freeze({
        directionMappingResidual: maximumAbsoluteDifference(
            centerEvaluation.directionAtmosphere,
            ATMOSPHERE_SUN_DIRECTION,
        ),
        transmittedIntegralLowHighRelative: spectralRelativeResidual(
            actualLow.integrals.total.transmitted
                .spectralRadianceSolidAngleIntegral.values,
            actualHigh.integrals.total.transmitted
                .spectralRadianceSolidAngleIntegral.values,
        ),
        transmittedProjectedLowHighRelative: spectralRelativeResidual(
            actualLow.integrals.total.transmitted.projectedSpectralIrradiance.values,
            actualHigh.integrals.total.transmitted.projectedSpectralIrradiance.values,
        ),
        componentConservationRelative: scaleAwareAbsoluteResidual(
            actualLow.componentConservation.maximumAbsoluteSpectralResidual,
            actualLow.integrals.total.input.spectralRadianceSolidAngleIntegral.values,
        ),
    });
    const wrongRoutes = evaluateExtendedWrongRoutes(actualLow, centerEvaluation);
    const partialBlocker = evaluatePartiallyBlockedSun({
        camera: actualCamera,
        source: actualSun,
        frameEvaluator: actualFrameEvaluator,
        clearResult: actualLow,
    });
    const edgeCase = vacuumMatrix.find((entry) =>
        entry.result.derivedCoverage.solidAnglesSteradians.offRaster > 0);
    const matrixCoverage = describeCameraMatrixCoverage(
        SUN_VACUUM_MATRIX,
        vacuumMatrix,
        (entry) => entry.result.derivedCoverage.solidAnglesSteradians.offRaster > 0,
    );
    const vacuumMaximumReconstruction = Math.max(...vacuumMatrix.map((entry) =>
        entry.metrics.integratedCanonicalIrradianceRelativeResidual));
    const vacuumPathMaximum = Math.max(...vacuumMatrix.map((entry) =>
        entry.metrics.maximumAbsolutePathRadiance));
    const criteria = Object.freeze([
        criterion(
            'solar-reference',
            'canonical-sun-disk-direct-irradiance-reconstruction-passes',
            directSource.reconstruction.maxRelativeResidual
                <= TOLERANCES.solarDiskReconstructionRelative,
            Object.freeze({
                maximumRelativeResidual: directSource.reconstruction.maxRelativeResidual,
                tolerance: TOLERANCES.solarDiskReconstructionRelative,
                formula: directSource.reconstruction.formula,
            }),
        ),
        criterion(
            'er4-transport',
            'sun-vacuum-matrix-spans-resolution-fov-field-subpixel-edge-and-off-raster',
            matrixCoverage.hasMultipleResolutions
                && matrixCoverage.hasMultipleVerticalFovs
                && matrixCoverage.hasOffAxisFieldCase
                && matrixCoverage.hasSubpixelCase
                && matrixCoverage.hasMeasuredOffRasterCase,
            matrixCoverage,
        ),
        criterion(
            'er4-transport',
            'sun-vacuum-path-zero-transmittance-one-and-per-direction-calls-pass',
            vacuumPathMaximum === 0
                && vacuumMatrix.every((entry) =>
                    entry.metrics.allSampleTransmittanceOne
                    && entry.result.transportCalls.visibilityCallCount
                        === entry.result.quadrature.sampleCount
                    && entry.result.transportCalls.transmittanceCallCount
                        === entry.result.quadrature.sampleCount),
            Object.freeze({
                maximumAbsolutePathRadiance: vacuumPathMaximum,
                rows: Object.freeze(vacuumMatrix.map((entry) => Object.freeze({
                    id: entry.configuration.id,
                    sampleCount: entry.result.quadrature.sampleCount,
                    visibilityCallCount: entry.result.transportCalls.visibilityCallCount,
                    transmittanceCallCount: entry.result.transportCalls.transmittanceCallCount,
                    allSampleTransmittanceOne:
                        entry.metrics.allSampleTransmittanceOne,
                }))),
            }),
        ),
        criterion(
            'solar-reference',
            'sun-vacuum-integrated-disk-reconstructs-canonical-irradiance',
            vacuumMaximumReconstruction
                <= TOLERANCES.solarDiskReconstructionRelative,
            Object.freeze({
                maximumRelativeResidual: vacuumMaximumReconstruction,
                tolerance: TOLERANCES.solarDiskReconstructionRelative,
            }),
        ),
        criterion(
            'er4-transport',
            'sun-vacuum-component-conservation-passes-across-camera-matrix',
            vacuumMatrix.every((entry) =>
                entry.metrics.componentConservationRelativeResidual
                    <= TOLERANCES.spectralRelative),
            Object.freeze({
                maximumRelativeResidual: Math.max(...vacuumMatrix.map((entry) =>
                    entry.metrics.componentConservationRelativeResidual)),
                tolerance: TOLERANCES.spectralRelative,
            }),
        ),
        criterion(
            'er4-transport',
            'sun-edge-case-retains-on-frame-and-off-raster-integrals',
            edgeCase.result.derivedCoverage.solidAnglesSteradians.onFrame > 0
                && edgeCase.result.derivedCoverage.solidAnglesSteradians.offRaster > 0
                && edgeCase.result.integrals.onFrame.transmitted
                    .spectralRadianceSolidAngleIntegral.values.some((value) => value > 0)
                && edgeCase.result.integrals.offRaster.transmitted
                    .spectralRadianceSolidAngleIntegral.values.some((value) => value > 0),
            edgeCase.result.derivedCoverage,
        ),
        criterion(
            'er4-transport',
            'sun-actual-atmosphere-directional-low-high-integral-converges',
            actualMetrics.transmittedIntegralLowHighRelative
                <= TOLERANCES.quadratureHighOrderRelative,
            Object.freeze({
                relativeResidual: actualMetrics.transmittedIntegralLowHighRelative,
                tolerance: TOLERANCES.quadratureHighOrderRelative,
                runtimeQuadrature: SUN_RUNTIME_QUADRATURE,
                highQuadrature: SUN_HIGH_QUADRATURE,
            }),
        ),
        criterion(
            'er4-transport',
            'sun-actual-atmosphere-directional-low-high-projected-converges',
            actualMetrics.transmittedProjectedLowHighRelative
                <= TOLERANCES.quadratureHighOrderRelative,
            Object.freeze({
                relativeResidual: actualMetrics.transmittedProjectedLowHighRelative,
                tolerance: TOLERANCES.quadratureHighOrderRelative,
            }),
        ),
        criterion(
            'er4-transport',
            'sun-actual-direction-map-and-per-quadrature-transport-pass',
            actualMetrics.directionMappingResidual <= TOLERANCES.spectralRelative
                && actualLowCallbackEvidence.visibilityCallCount
                    === actualLow.quadrature.sampleCount
                && actualLowCallbackEvidence.transmittanceCallCount
                    === actualLow.quadrature.sampleCount
                && actualLowCallbackEvidence.sameRayObjectCount
                    === actualLow.quadrature.sampleCount
                && actualLowCallbackEvidence.distinctVisibilityRayObjectCount
                    === actualLow.quadrature.sampleCount
                && actualHighCallbackEvidence.visibilityCallCount
                    === actualHigh.quadrature.sampleCount
                && actualHighCallbackEvidence.transmittanceCallCount
                    === actualHigh.quadrature.sampleCount
                && actualHighCallbackEvidence.sameRayObjectCount
                    === actualHigh.quadrature.sampleCount
                && actualHighCallbackEvidence.distinctVisibilityRayObjectCount
                    === actualHigh.quadrature.sampleCount,
            Object.freeze({
                directionMappingResidual: actualMetrics.directionMappingResidual,
                tolerance: TOLERANCES.spectralRelative,
                runtimeCallbackEvidence: actualLowCallbackEvidence,
                runtimeAccumulatorTransportCalls: actualLow.transportCalls,
                runtimeSampleCount: actualLow.quadrature.sampleCount,
                highOrderCallbackEvidence: actualHighCallbackEvidence,
                highOrderAccumulatorTransportCalls: actualHigh.transportCalls,
                highOrderSampleCount: actualHigh.quadrature.sampleCount,
            }),
        ),
        criterion(
            'er4-transport',
            'sun-actual-atmosphere-component-conservation-passes',
            actualMetrics.componentConservationRelative
                <= TOLERANCES.spectralRelative,
            Object.freeze({
                relativeResidual: actualMetrics.componentConservationRelative,
                tolerance: TOLERANCES.spectralRelative,
            }),
        ),
        criterion(
            'er4-transport',
            'canonical-solar-packet-is-one-illumination-and-visible-disk-owner',
            atmosphereModel.lightSource.irradiancePacket === reference.canonicalSolar
                && actualSun.irradiancePacket === reference.canonicalSolar
                && actualSun.canonicalIrradiancePacketFingerprint
                    === reference.canonicalSolar.fingerprint,
            Object.freeze({
                canonicalSolarPacketFingerprint: reference.canonicalSolar.fingerprint,
                illuminationPacketRetainedByIdentity:
                    atmosphereModel.lightSource.irradiancePacket
                        === reference.canonicalSolar,
                visibleDiskPacketRetainedByIdentity:
                    actualSun.irradiancePacket === reference.canonicalSolar,
                duplicateSolarSpectrum: 'none',
            }),
        ),
        criterion(
            'er4-transport',
            'sun-center-transmittance-wrong-route-is-discriminated',
            wrongRoutes.centerTransmittance.relativeDifference
                >= TOLERANCES.wrongRouteMinimumRelative,
            Object.freeze({
                relativeDifference: wrongRoutes.centerTransmittance.relativeDifference,
                minimum: TOLERANCES.wrongRouteMinimumRelative,
            }),
        ),
        criterion(
            'er4-transport',
            'sun-double-transmittance-wrong-route-is-discriminated',
            wrongRoutes.doubleTransmittance.relativeDifference
                >= TOLERANCES.wrongRouteMinimumRelative,
            Object.freeze({
                relativeDifference: wrongRoutes.doubleTransmittance.relativeDifference,
                minimum: TOLERANCES.wrongRouteMinimumRelative,
            }),
        ),
        criterion(
            'er4-transport',
            'sun-partial-opaque-blocker-resolves-every-direction-and-skips-blocked-t',
            partialBlocker.metrics.visibleSampleCount > 0
                && partialBlocker.metrics.blockedSampleCount > 0
                && partialBlocker.blockerIntersectionCallCount
                    === partialBlocker.result.quadrature.sampleCount
                && partialBlocker.samplerCallCount
                    === partialBlocker.metrics.visibleSampleCount
                && partialBlocker.metrics.everyBlockedSampleNamesOccluder
                && partialBlocker.metrics.everyBlockedSampleHasNullTransmittance
                && partialBlocker.metrics.everyBlockedSampleHasZeroTransport
                && partialBlocker.metrics.componentConservationRelativeResidual
                    <= TOLERANCES.spectralRelative
                && partialBlocker.metrics.nonzeroButReducedRelativeToClear,
            Object.freeze({
                sampleCount: partialBlocker.result.quadrature.sampleCount,
                visibleSampleCount: partialBlocker.metrics.visibleSampleCount,
                blockedSampleCount: partialBlocker.metrics.blockedSampleCount,
                blockerIntersectionCallCount:
                    partialBlocker.blockerIntersectionCallCount,
                accumulatorTransportCalls: partialBlocker.result.transportCalls,
                samplerCallCount: partialBlocker.samplerCallCount,
                everyBlockedSampleNamesOccluder:
                    partialBlocker.metrics.everyBlockedSampleNamesOccluder,
                everyBlockedSampleHasNullTransmittance:
                    partialBlocker.metrics.everyBlockedSampleHasNullTransmittance,
                everyBlockedSampleHasZeroTransport:
                    partialBlocker.metrics.everyBlockedSampleHasZeroTransport,
                componentConservationRelativeResidual:
                    partialBlocker.metrics.componentConservationRelativeResidual,
                nonzeroButReducedRelativeToClear:
                    partialBlocker.metrics.nonzeroButReducedRelativeToClear,
            }),
        ),
        criterion(
            'er4-transport',
            'sun-partial-blocker-does-not-alter-atmosphere-path-radiance',
            partialBlocker.metrics.pathRadianceRelativeResidual
                <= TOLERANCES.spectralRelative,
            Object.freeze({
                relativeResidual: partialBlocker.metrics.pathRadianceRelativeResidual,
                tolerance: TOLERANCES.spectralRelative,
            }),
        ),
        criterion(
            'er4-transport',
            'sun-uses-one-conservative-path-without-collapsed-optimization',
            actualLow.quadrature.method === 'spherical-cap-midpoint-equal-solid-angle-v1'
                && actualHigh.quadrature.method
                    === 'spherical-cap-midpoint-equal-solid-angle-v1'
                && [actualLowIntegrator, actualHighIntegrator].every((integrator) =>
                    integrator.describe().executionPath
                        === 'directional-spherical-cap-quadrature-only'
                    && integrator.describe().collapsedOptimization === 'absent'),
            Object.freeze({
                acceptedPath: 'directional-spherical-cap-quadrature-only',
                collapsedOptimization: 'absent',
                runtimeMethod: actualLow.quadrature.method,
                highMethod: actualHigh.quadrature.method,
                runtimeIntegrator: actualLowIntegrator.describe(),
                highOrderIntegrator: actualHighIntegrator.describe(),
            }),
        ),
    ]);
    return Object.freeze({
        status: criteria.length > 0
            && criteria.every((entry) => entry.status === 'accepted')
            ? 'accepted'
            : 'rejected',
        ownership: Object.freeze({
            canonicalSolarPacketFingerprint: reference.canonicalSolar.fingerprint,
            illuminationPacketRetainedByIdentity:
                atmosphereModel.lightSource.irradiancePacket === reference.canonicalSolar,
            visibleDiskPacketRetainedByIdentity:
                actualSun.irradiancePacket === reference.canonicalSolar,
            duplicateSolarSpectrum: 'none',
            sourceSpecificGain: 'none',
        }),
        vacuumMatrix: Object.freeze(vacuumMatrix),
        actualAtmosphere: Object.freeze({
            camera: actualCamera.describe(),
            cameraFingerprint: actualCamera.fingerprint,
            sourceDirectionCamera: ATMOSPHERE_SUN_DIRECTION_CAMERA,
            sourceDirectionAtmosphere: ATMOSPHERE_SUN_DIRECTION,
            sourceAltitudeDegrees: ATMOSPHERE_SUN_ALTITUDE_RADIANS * 180 / Math.PI,
            centerEvaluation,
            runtime: actualLow,
            highOrder: actualHigh,
            metrics: actualMetrics,
            runtimeCallbackEvidence: actualLowCallbackEvidence,
            highOrderCallbackEvidence: actualHighCallbackEvidence,
        }),
        wrongRoutes,
        partialBlocker,
        pathPolicy: Object.freeze({
            acceptedPath: 'directional-spherical-cap-quadrature-only',
            collapsedOptimization: 'absent',
            distinctCollapsedPathCompared: false,
        }),
        atmosphereModel: atmosphereModel.descriptor,
        criteria,
    });
}

function evaluateVacuumSunCase({
    configuration,
    canonicalSolar,
    basisFingerprint,
    visibilityResolver,
}) {
    const camera = new PerspectiveCameraRaster(configuration);
    const centerDirectionCamera = camera.rasterCenterToDirection(
        configuration.rasterX,
        configuration.rasterY,
    );
    const source = createSunDisk(
        canonicalSolar,
        `canonical-sun-vacuum-${configuration.id}`,
        centerDirectionCamera,
    );
    const frameEvaluator = createVacuumFrameEvaluator(camera, basisFingerprint);
    const centerEvaluation = frameEvaluator.evaluateCameraDirection(centerDirectionCamera);
    const result = new TransportedExtendedSourceIntegrator({
        camera,
        visibilityResolver,
        transmittanceSampler: frameEvaluator,
    }).integrate({
        source,
        sourceDepth: { kind: 'infinite' },
        ...SUN_RUNTIME_QUADRATURE,
    });
    const integratedCanonicalIrradianceRelativeResidual = spectralRelativeResidual(
        result.integrals.total.transmitted.projectedSpectralIrradiance.values,
        canonicalSolar.values,
    );
    const componentConservationRelativeResidual = scaleAwareAbsoluteResidual(
        result.componentConservation.maximumAbsoluteSpectralResidual,
        result.integrals.total.input.spectralRadianceSolidAngleIntegral.values,
    );
    const allSampleTransmittanceOne = result.samples.every((sample) =>
        sample.visibility.visible
        && sample.transmittance !== null
        && sample.transmittance.values.every((value) => value === 1));
    return Object.freeze({
        configuration,
        camera: camera.describe(),
        cameraFingerprint: camera.fingerprint,
        source,
        sourceDescriptor: source.source.describe(),
        centerDirectionCamera,
        centerEvaluation,
        result,
        metrics: Object.freeze({
            directCanonicalIrradianceRelativeResidual:
                source.reconstruction.maxRelativeResidual,
            integratedCanonicalIrradianceRelativeResidual,
            componentConservationRelativeResidual,
            maximumAbsolutePathRadiance: Math.max(
                ...centerEvaluation.pathSpectralRadianceDensity.values.map(Math.abs),
            ),
            allSampleTransmittanceOne,
        }),
    });
}

function evaluateExtendedWrongRoutes(proper, centerEvaluation) {
    const centerTransmittanceValues = Array(15).fill(0);
    const doubleTransmittanceValues = Array(15).fill(0);
    for (const sample of proper.samples) {
        if (!sample.visibility.visible) {
            continue;
        }
        for (let channel = 0; channel < centerTransmittanceValues.length; channel += 1) {
            const radiance = sample.topOfAtmosphereSpectralRadiance.values[channel];
            const weight = sample.solidAngleWeightSteradians;
            const directionalTransmittance = sample.transmittance.values[channel];
            centerTransmittanceValues[channel] += radiance
                * centerEvaluation.viewSpectralTransmittance.values[channel]
                * weight;
            doubleTransmittanceValues[channel] += radiance
                * directionalTransmittance
                * directionalTransmittance
                * weight;
        }
    }
    const properValues = proper.integrals.total.transmitted
        .spectralRadianceSolidAngleIntegral.values;
    return Object.freeze({
        qualification: 'diagnostic wrong routes only; neither enters frame composition',
        centerTransmittance: Object.freeze({
            formula: 'sum_q L_q*w_q*T(center)',
            wrongSpectralIntegral: Object.freeze(centerTransmittanceValues),
            properDirectionalSpectralIntegral: properValues,
            centerTransmittance: centerEvaluation.viewSpectralTransmittance,
            relativeDifference: spectralRelativeResidual(
                centerTransmittanceValues,
                properValues,
            ),
        }),
        doubleTransmittance: Object.freeze({
            formula: 'sum_q L_q*w_q*T(q)^2',
            wrongSpectralIntegral: Object.freeze(doubleTransmittanceValues),
            properDirectionalSpectralIntegral: properValues,
            relativeDifference: spectralRelativeResidual(
                doubleTransmittanceValues,
                properValues,
            ),
        }),
    });
}

function evaluatePartiallyBlockedSun({ camera, source, frameEvaluator, clearResult }) {
    let blockerIntersectionCallCount = 0;
    const blocker = Object.freeze({
        id: 'partial-sun-opaque-half-plane',
        kind: 'opaque-finite-body',
        fingerprint: stableHash({
            kind: 'partial-sun-opaque-half-plane-v1',
            centerDirectionCamera: source.centerDirectionCamera,
        }),
        intersectExactRay(ray) {
            blockerIntersectionCallCount += 1;
            return ray.directionCamera[0] < source.centerDirectionCamera[0]
                ? Object.freeze({
                    distanceMeters: 1,
                    featureId: 'camera-negative-x-half',
                })
                : null;
        },
    });
    const visibilityResolver = new ExactDirectionalVisibilityResolver({
        blockers: [blocker],
        depthTieToleranceMeters: 0,
    });
    const countingSampler = createCountingExtendedSampler(frameEvaluator);
    const pathBefore = frameEvaluator.evaluateCameraDirection(source.centerDirectionCamera)
        .pathSpectralRadianceDensity.values;
    const result = new TransportedExtendedSourceIntegrator({
        camera,
        visibilityResolver,
        transmittanceSampler: countingSampler.provider,
    }).integrate({
        source,
        sourceDepth: { kind: 'infinite' },
        ...SUN_RUNTIME_QUADRATURE,
    });
    const pathAfter = frameEvaluator.evaluateCameraDirection(source.centerDirectionCamera)
        .pathSpectralRadianceDensity.values;
    const visibleSampleCount = result.samples.filter((sample) =>
        sample.visibility.visible).length;
    const blockedSampleCount = result.samples.length - visibleSampleCount;
    const blockedSamples = result.samples.filter((sample) => !sample.visibility.visible);
    const partialTransmitted = result.integrals.total.transmitted
        .spectralRadianceSolidAngleIntegral.values;
    const clearTransmitted = clearResult.integrals.total.transmitted
        .spectralRadianceSolidAngleIntegral.values;
    const componentConservationRelativeResidual = scaleAwareAbsoluteResidual(
        result.componentConservation.maximumAbsoluteSpectralResidual,
        result.integrals.total.input.spectralRadianceSolidAngleIntegral.values,
    );
    return Object.freeze({
        blocker: Object.freeze({
            id: blocker.id,
            kind: blocker.kind,
            fingerprint: blocker.fingerprint,
        }),
        visibilityResolver: visibilityResolver.describe(),
        samplerFingerprint: countingSampler.provider.fingerprint,
        samplerCallCount: countingSampler.callCount(),
        blockerIntersectionCallCount,
        pathBefore: Object.freeze([...pathBefore]),
        pathAfter: Object.freeze([...pathAfter]),
        result,
        metrics: Object.freeze({
            visibleSampleCount,
            blockedSampleCount,
            everyBlockedSampleNamesOccluder: blockedSamples.every((sample) =>
                sample.visibility.occluder?.id === blocker.id),
            everyBlockedSampleHasNullTransmittance: blockedSamples.every((sample) =>
                sample.transmittance === null),
            everyBlockedSampleHasZeroTransport: blockedSamples.every((sample) =>
                sample.transmittedSpectralRadiance.values.every((value) => value === 0)),
            componentConservationRelativeResidual,
            partialTransmittedSpectralIntegral: partialTransmitted,
            clearTransmittedSpectralIntegral: clearTransmitted,
            nonzeroButReducedRelativeToClear: partialTransmitted.every((value, index) =>
                value > 0 && value < clearTransmitted[index]),
            pathRadianceRelativeResidual: spectralRelativeResidual(pathAfter, pathBefore),
        }),
    });
}

function createSunDisk(canonicalSolar, id, centerDirectionCamera) {
    return new CanonicalUniformSunDiskSource({
        id,
        irradiancePacket: canonicalSolar,
        angularRadiusRadians: DISTANT_SUN_CONSTANTS.angularRadiusRadians,
        centerDirectionCamera,
    });
}

function createCountingExtendedSampler(frameEvaluator) {
    let calls = 0;
    const provider = Object.freeze({
        fingerprint: stableHash({
            kind: 'counting-extended-transmittance-wrapper-v1',
            frameEvaluatorFingerprint: frameEvaluator.fingerprint,
        }),
        sampleExtendedSampleTransmittance(ray) {
            calls += 1;
            return frameEvaluator.sampleExtendedSampleTransmittance(ray);
        },
    });
    return Object.freeze({ provider, callCount: () => calls });
}

function createExtendedTransportAudit(visibilityResolver, frameEvaluator, id) {
    const visibleRayObjects = new Set();
    let visibilityCallCount = 0;
    let transmittanceCallCount = 0;
    let sameRayObjectCount = 0;
    const visibilityProvider = Object.freeze({
        fingerprint: stableHash({
            kind: 'record-050-capturing-extended-visibility-provider-v1',
            id,
            delegateFingerprint: visibilityResolver.fingerprint,
        }),
        resolveExtendedSampleVisibility(ray) {
            visibilityCallCount += 1;
            visibleRayObjects.add(ray);
            return visibilityResolver.resolveExtendedSampleVisibility(ray);
        },
    });
    const transmittanceProvider = Object.freeze({
        fingerprint: stableHash({
            kind: 'record-050-capturing-extended-transmittance-provider-v1',
            id,
            delegateFingerprint: frameEvaluator.fingerprint,
        }),
        sampleExtendedSampleTransmittance(ray) {
            transmittanceCallCount += 1;
            if (visibleRayObjects.has(ray)) {
                sameRayObjectCount += 1;
            }
            return frameEvaluator.sampleExtendedSampleTransmittance(ray);
        },
    });
    return Object.freeze({
        visibilityProvider,
        transmittanceProvider,
        evidence() {
            return Object.freeze({
                id,
                visibilityCallCount,
                transmittanceCallCount,
                sameRayObjectCount,
                distinctVisibilityRayObjectCount: visibleRayObjects.size,
                visibilityProviderFingerprint: visibilityProvider.fingerprint,
                transmittanceProviderFingerprint: transmittanceProvider.fingerprint,
            });
        },
    });
}

function describeCameraMatrixCoverage(configurations, results, offRasterPredicate) {
    const resolutions = Object.freeze([...new Set(configurations.map((entry) =>
        `${entry.widthPixels}x${entry.heightPixels}`))].sort());
    const verticalFovsDegrees = Object.freeze([...new Set(configurations.map((entry) =>
        entry.verticalFovDegrees))].sort((left, right) => left - right));
    const offAxisCaseIds = Object.freeze(configurations.filter((entry) =>
        entry.rasterX >= 0
        && entry.rasterX <= entry.widthPixels - 1
        && entry.rasterY >= 0
        && entry.rasterY <= entry.heightPixels - 1
        && (
            Math.abs(entry.rasterX - (entry.widthPixels - 1) / 2)
                >= entry.widthPixels / 4
            || Math.abs(entry.rasterY - (entry.heightPixels - 1) / 2)
                >= entry.heightPixels / 4
        )).map((entry) => entry.id));
    const subpixelCaseIds = Object.freeze(configurations.filter((entry) =>
        !Number.isInteger(entry.rasterX) || !Number.isInteger(entry.rasterY))
        .map((entry) => entry.id));
    const measuredOffRasterCaseIds = Object.freeze(results.filter(offRasterPredicate)
        .map((entry) => entry.configuration.id));
    return Object.freeze({
        resolutions,
        verticalFovsDegrees,
        offAxisCaseIds,
        subpixelCaseIds,
        measuredOffRasterCaseIds,
        hasMultipleResolutions: resolutions.length > 1,
        hasMultipleVerticalFovs: verticalFovsDegrees.length > 1,
        hasOffAxisFieldCase: offAxisCaseIds.length > 0,
        hasSubpixelCase: subpixelCaseIds.length > 0,
        hasMeasuredOffRasterCase: measuredOffRasterCaseIds.length > 0,
    });
}

function maximumAbsoluteDifference(left, right) {
    return Math.max(...left.map((value, index) => Math.abs(value - right[index])));
}

function scaleAwareAbsoluteResidual(residual, scaleValues) {
    return Math.abs(residual) / Math.max(
        ...scaleValues.map(Math.abs),
        TOLERANCES.spectralScaleFloor,
    );
}

function evaluateFullFrameTransport(reference) {
    const camera = new PerspectiveCameraRaster(POINT_ACTUAL_CASE);
    const atmosphereModel = createResetAtmosphereModel(reference.canonicalSolar);
    const atmosphereEvaluationAudit = createCountingSpectralEvaluator(
        atmosphereModel.evaluator,
    );
    const frameEvaluator = new FrozenAtmosphereSpectralFrameEvaluator({
        camera,
        evaluator: atmosphereEvaluationAudit.provider,
        basisFingerprint: reference.basis.fingerprint,
        cameraToAtmosphereMatrix: CAMERA_TO_ATMOSPHERE_MATRIX,
        evaluatorDescriptor: Object.freeze({
            ...atmosphereModel.descriptor,
            kind: 'record-050-counted-reset-canonical-solar-atmosphere-v1',
            delegateKind: atmosphereModel.descriptor.kind,
        }),
    });
    const visibilityResolver = new ExactDirectionalVisibilityResolver({
        blockers: [],
        depthTieToleranceMeters: 0,
    });
    const siriusSource = createSiriusSource(
        reference.sirius.packet,
        'calspec-sirius-full-frame-point',
        'physical CALSPEC Sirius full-frame closure fixture',
    );
    const siriusDirectionCamera = camera.rasterCenterToDirection(
        POINT_ACTUAL_CASE.rasterX,
        POINT_ACTUAL_CASE.rasterY,
    );
    const pointAccumulation = new TransportedPointSourceAccumulator({
        camera,
        response: new BilinearPointResponse(),
        visibilityResolver,
        transmittanceSampler: frameEvaluator,
    }).accumulate({
        source: siriusSource,
        sourceDirectionCamera: siriusDirectionCamera,
        sourceDepth: { kind: 'infinite' },
    });
    const sun = createSunDisk(
        reference.canonicalSolar,
        'canonical-sun-full-frame-disk',
        ATMOSPHERE_SUN_DIRECTION_CAMERA,
    );
    const extendedIntegration = new TransportedExtendedSourceIntegrator({
        camera,
        visibilityResolver,
        transmittanceSampler: frameEvaluator,
    }).integrate({
        source: sun,
        sourceDepth: { kind: 'infinite' },
        ...SUN_RUNTIME_QUADRATURE,
    });
    const closureEvaluator = new Er4cPhysicalFullFrameClosureEvaluator({
        camera,
        frameEvaluator,
        basisFingerprint: reference.basis.fingerprint,
        pointAccumulation,
        extendedIntegration,
        displayModel: new BrunetonColorDisplayModel(),
    });
    const atmosphereCallsBeforeClosure = atmosphereEvaluationAudit.callCount();
    const result = closureEvaluator.evaluate();
    const atmosphereCallsAfterClosure = atmosphereEvaluationAudit.callCount();
    const baseFrameAtmosphereCallDelta =
        atmosphereCallsAfterClosure - atmosphereCallsBeforeClosure;
    const evidence = result.evidence;
    const expectedPixelCount = camera.widthPixels * camera.heightPixels;
    const criteria = Object.freeze([
        criterion(
            'er4-transport',
            'full-frame-base-is-complete-and-evaluated-once',
            evidence.baseFrame.evaluateBaseFrameCallCount === 1
                && evidence.baseFrame.completeAndUnique === true
                && evidence.baseFrame.actualPixelCount === expectedPixelCount
                && evidence.baseFrame.uniquePixelCount === expectedPixelCount
                && baseFrameAtmosphereCallDelta === expectedPixelCount
                && evidence.baseFrame.nonzeroPathPixelCount > 0,
            Object.freeze({
                ...evidence.baseFrame,
                atmosphereCallsBeforeClosure,
                atmosphereCallsAfterClosure,
                baseFrameAtmosphereCallDelta,
            }),
        ),
        criterion(
            'er4-transport',
            'full-frame-endpoint-is-typed-and-transported-once',
            evidence.endpointTransport.typedNonzeroFixtureInjected === true
                && evidence.endpointTransport.maximumAbsoluteResidual === 0
                && evidence.endpointTransport.hasStrictNonzeroAttenuation === true
                && evidence.endpointTransport.transportedDiffersFromUntransported
                    === true,
            evidence.endpointTransport,
        ),
        criterion(
            'er4-transport',
            'full-frame-retains-nonzero-path-endpoint-extended-point-and-final-spectra',
            evidence.componentRetention.accepted === true
                && evidence.componentRetention.maximumAbsoluteResidual === 0
                && Object.values(evidence.componentRetention.nonzeroPixelCounts)
                    .every((count) => count > 0),
            evidence.componentRetention,
        ),
        criterion(
            'er4-transport',
            'full-frame-physical-algebra-and-component-totals-pass',
            evidence.algebra.exactPrescribedAlgebra === true
                && evidence.algebra.prescribedOperationMaximumAbsoluteResidual === 0
                && evidence.algebra.composerAssociativeMaximumAbsoluteResidual
                    <= evidence.algebra.composerAssociativeRoundoffTolerance
                && evidence.algebra.maximumAbsoluteTotalAlgebraResidual
                    <= evidence.algebra.totalAlgebraRoundoffTolerance
                && evidence.componentTotals.maximumAbsoluteRetentionResidual === 0,
            Object.freeze({
                algebra: evidence.algebra,
                componentTotals: evidence.componentTotals,
            }),
        ),
        criterion(
            'er4-transport',
            'full-frame-runs-one-global-display-pass-after-composition-without-source-gain',
            evidence.display.callCountBeforeComposition === 0
                && evidence.display.callCountAfterComposition === expectedPixelCount
                && evidence.display.pixelsWithExactlyOneCall === expectedPixelCount
                && evidence.display.oneCallPerCompletedPixel === true
                && evidence.display.sourceSpecificGain === 'none'
                && evidence.preCompositionPolicy.noDisplayBeforeComposition === true
                && evidence.preCompositionPolicy.noSourceSpecificGain === true,
            Object.freeze({
                display: evidence.display,
                preCompositionPolicy: evidence.preCompositionPolicy,
            }),
        ),
        criterion(
            'er4-transport',
            'full-frame-retains-exact-source-camera-basis-and-display-identities',
            evidence.sourceIdentities.exactIdentityRetention === true
                && result.fingerprints.camera === camera.fingerprint
                && result.fingerprints.basis === reference.basis.fingerprint
                && result.fingerprints.frameEvaluator === frameEvaluator.fingerprint,
            Object.freeze({
                sourceIdentities: evidence.sourceIdentities,
                fingerprints: result.fingerprints,
            }),
        ),
    ]);
    return Object.freeze({
        status: criteria.length > 0
            && criteria.every((entry) => entry.status === 'accepted')
            ? 'accepted'
            : 'rejected',
        camera: camera.describe(),
        cameraFingerprint: camera.fingerprint,
        frameEvaluator: frameEvaluator.describe(),
        atmosphereEvaluationAudit: Object.freeze({
            callsBeforeClosure: atmosphereCallsBeforeClosure,
            callsAfterClosure: atmosphereCallsAfterClosure,
            baseFrameCallDelta: baseFrameAtmosphereCallDelta,
            expectedBaseFrameCallDelta: expectedPixelCount,
            providerFingerprint: atmosphereEvaluationAudit.provider.fingerprint,
        }),
        atmosphereModel: atmosphereModel.descriptor,
        visibilityResolver: visibilityResolver.describe(),
        pointSource: siriusSource.describe(),
        pointDirectionCamera: siriusDirectionCamera,
        pointAccumulation,
        extendedSource: sun.source.describe(),
        extendedIntegration,
        closureEvaluator: closureEvaluator.describe(),
        result,
        criteria,
    });
}

function buildCriteria(reference, transport) {
    return [
        criterion(
            'lunar-dependency',
            'sealed-record-049-lunar-xa-g09-dependency-is-accepted',
            reference.lunarDependency.accepted,
            reference.lunarDependency,
        ),
        criterion(
            'solar-reference',
            'canonical-solar-provenance-bytes-match-pinned-manifest',
            reference.canonicalSolarFixtureIdentity.byteLength
                === EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.canonicalSolar.byteLength
                && reference.canonicalSolarFixtureIdentity.sourceHashSha256
                    === EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.canonicalSolar
                        .sourceHashSha256,
            Object.freeze({
                actual: reference.canonicalSolarFixtureIdentity,
                expected: Object.freeze({
                    byteLength:
                        EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.canonicalSolar.byteLength,
                    sourceHashSha256:
                        EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.canonicalSolar
                            .sourceHashSha256,
                }),
                runtimeOwnerUnchanged: true,
            }),
        ),
        criterion(
            'solar-reference',
            'canonical-solar-360-830-midpoint-integral-passes-tsis',
            Math.abs(reference.metrics.solarRelativeDifference)
                <= reference.metrics.solarThreshold,
            reference.metrics,
        ),
        criterion(
            'sirius-reference',
            'calspec-sirius-retained-bytes-match-pinned-manifest',
            reference.calspecIdentity.byteLength
                === EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.siriusCalspec.byteLength
                && reference.calspecIdentity.sourceHashSha256
                    === EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.siriusCalspec
                        .sourceHashSha256,
            Object.freeze({
                actual: reference.calspecIdentity,
                expected: Object.freeze({
                    byteLength:
                        EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.siriusCalspec.byteLength,
                    sourceHashSha256:
                        EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.siriusCalspec
                            .sourceHashSha256,
                }),
            }),
        ),
        criterion(
            'sirius-reference',
            'calspec-sirius-visible-reference-passes',
            Math.abs(reference.metrics.siriusVisibleRelativeDifference)
                <= TOLERANCES.siriusVisibleRelative,
            Object.freeze({
                signedRelativeDifference: reference.metrics.siriusVisibleRelativeDifference,
                tolerance: TOLERANCES.siriusVisibleRelative,
            }),
        ),
        criterion(
            'sirius-reference',
            'calspec-sirius-nir-msx-reference-passes',
            Math.abs(reference.metrics.siriusNearInfraredRelativeDifference)
                <= TOLERANCES.siriusNearInfraredRelative,
            Object.freeze({
                signedRelativeDifference:
                    reference.metrics.siriusNearInfraredRelativeDifference,
                tolerance: TOLERANCES.siriusNearInfraredRelative,
            }),
        ),
        criterion(
            'er4-transport',
            'er4c-full-frame-transport-is-implemented',
            transport.implemented,
            Object.freeze({ status: transport.implemented ? 'implemented' : 'pending' }),
        ),
        ...transport.point.criteria,
        ...transport.extended.criteria,
        ...transport.fullFrame.criteria,
    ];
}

function deriveStatuses(criteria) {
    const statusFor = (scope) => {
        const scoped = criteria.filter((entry) => entry.scope === scope);
        return scoped.length > 0
            && scoped.every((entry) => entry.status === 'accepted')
            ? 'accepted'
            : 'rejected';
    };
    const er4Criteria = criteria.filter((entry) => entry.scope === 'er4-transport');
    const er4TransportStatus = er4Criteria.length > 0
        && er4Criteria.every((entry) => entry.status === 'accepted')
        ? 'accepted'
        : 'rejected';
    const lunarDependencyStatus = statusFor('lunar-dependency');
    const siriusReferenceStatus = statusFor('sirius-reference');
    const solarReferenceStatus = statusFor('solar-reference');
    const er5ExitStatus = [
        lunarDependencyStatus,
        siriusReferenceStatus,
        solarReferenceStatus,
    ].every((status) => status === 'accepted') ? 'accepted' : 'rejected';
    const allCriteriaAccepted = criteria.length > 0
        && criteria.every((entry) => entry.status === 'accepted');
    const overallStatus = er4TransportStatus === 'accepted'
        && er5ExitStatus === 'accepted'
        && allCriteriaAccepted ? 'accepted' : 'rejected';
    return Object.freeze({
        er4TransportStatus,
        lunarDependencyStatus,
        siriusReferenceStatus,
        solarReferenceStatus,
        er5ExitStatus,
        allCriteriaAccepted,
        overallStatus,
    });
}

async function buildProvenance(reference, transport) {
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
            `Record 050 runtime graph contains prohibited modules: ${prohibitedRuntimeModules.join(', ')}.`,
        );
    }
    const dependencyLocks = Object.freeze(Object.fromEntries(await Promise.all(
        DEPENDENCY_LOCK_PATHS.map(async (path) => [path, await hashFile(path)]),
    )));
    const manifest = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST;
    return Object.freeze({
        runner: RUNNER,
        recordId: EXPECTED_RECORD_ID,
        expectedRecordDirectory: EXPECTED_RECORD_DIRECTORY,
        runtime: Object.freeze({
            node: process.version,
            v8: process.versions.v8,
            platform: process.platform,
            architecture: process.arch,
        }),
        sourceOwnership: Object.freeze({
            canonicalSolarPacketFingerprint: reference.canonicalSolar.fingerprint,
            canonicalSolarRetainedProvenanceFixtureIdentity:
                reference.canonicalSolarFixtureIdentity,
            siriusPacketFingerprint: reference.sirius.packet.fingerprint,
            basisFingerprint: reference.basis.fingerprint,
            duplicateSolarRuntimeOwner: false,
            calspecRetainedFixtureIdentity: reference.calspecIdentity,
        }),
        fixtureManifest: Object.freeze({
            manifestVersion: manifest.manifestVersion,
            canonicalSolar: manifest.canonicalSolar,
            siriusCalspec: manifest.siriusCalspec,
            tsis1HsrsV2: manifest.tsis1HsrsV2,
            rieke2023SiriusAbsoluteCalibration:
                manifest.rieke2023SiriusAbsoluteCalibration,
        }),
        lunarDependency: reference.lunarDependency,
        localModuleGraph,
        moduleBoundaryAudit: Object.freeze({
            prohibitedModuleFragments,
            prohibitedRuntimeModules,
            accepted: true,
        }),
        dependencyLocks,
        atmosphereControls: ATMOSPHERE_CONTROLS,
        cameraToAtmosphereMatrix: CAMERA_TO_ATMOSPHERE_MATRIX,
        transportImplemented: transport.implemented,
        externalRuntimeLinks: false,
        productionImports: false,
    });
}

function buildInputs() {
    return Object.freeze({
        recordId: EXPECTED_RECORD_ID,
        recordDirectory: EXPECTED_RECORD_DIRECTORY,
        stage: 'combined-ER4C-ER5-sun-sirius-physical-transport-closure',
        modes: Object.freeze({
            record:
                'the only result-bearing mode; one fresh immutable numbered record',
            preflight:
                'disabled because every result-bearing execution must use a numbered record',
        }),
        atmosphereControls: ATMOSPHERE_CONTROLS,
        cameraToAtmosphereMatrix: CAMERA_TO_ATMOSPHERE_MATRIX,
        tolerances: TOLERANCES,
        claimLayers: Object.freeze({
            er4c: 'physical source-to-pixel atmosphere transport and frame composition',
            er5: 'independent Sun/Sirius source-reference closure with inherited lunar XA-G09',
        }),
        applicableXaGates: Object.freeze({
            er4c: Object.freeze([
                'XA-G01',
                'XA-G02',
                'XA-G03',
                'XA-G04',
                'XA-G05',
                'XA-G06',
                'XA-G07',
                'XA-G08',
                'XA-G10',
            ]),
            er5: Object.freeze([
                'XA-G01',
                'XA-G03',
                'XA-G04',
                'XA-G06',
                'XA-G08',
                'XA-G09',
                'XA-G10',
            ]),
        }),
        xaGateQualifications: Object.freeze({
            xaG02:
                'ER4C uses exact analytic proof directions/depths; astronomical returned-epoch geometry remains ER6.',
            xaG07:
                'Exact deterministic analytic blockers and partial occlusion are claimed; real-scene depth remains ER6.',
            xaG10:
                'Mechanical and physical statuses are separated; automated/human review and observational visibility are not claimed.',
        }),
        deferredXaGates: Object.freeze(['XA-G11', 'XA-G12']),
        observationalClaim: 'none',
        gpuClaim: 'none',
        productionClaim: 'none',
    });
}

function buildEquationsAndTolerances() {
    return Object.freeze({
        equations: Object.freeze({
            point:
                'L_point(lambda,i)=F(lambda)*T(lambda,omega_s)*p_i/Omega_i',
            extended:
                'L_extended(lambda,i)=sum_q[V_q*T(lambda,omega_q)*L(lambda,omega_q)*w_q]/Omega_i',
            frame:
                'L_final=L_path+T_view*L_endpoint+L_extended_transport+L_point_transport',
            sunDisk: 'E_lambda=L_lambda*pi*sin(alpha)^2',
            solarReference:
                'threshold=max(0.02,2*u_TSIS/I_TSIS,0.0005)',
        }),
        tolerances: TOLERANCES,
        wrongRoutes: Object.freeze([
            'destination-pixel transmittance after point spreading',
            'second transmittance multiplication',
            'Sun center transmittance substituted for directional samples',
        ]),
    });
}

async function writeArtifacts(recordDirectory, artifacts) {
    await writeText(recordDirectory, 'state-goal.md', artifacts.stateGoal);
    await writeJson(recordDirectory, 'inputs.json', artifacts.inputs);
    await writeJson(recordDirectory, 'provenance.json', artifacts.provenance);
    await writeJson(
        recordDirectory,
        'equations-and-tolerances.json',
        artifacts.equationsAndTolerances,
    );
    await writeJson(
        recordDirectory,
        'source-reference-results.json',
        artifacts.sourceReferenceResults,
    );
    await writeJson(
        recordDirectory,
        'point-transport-results.json',
        artifacts.pointTransportResults,
    );
    await writeJson(
        recordDirectory,
        'extended-transport-results.json',
        artifacts.extendedTransportResults,
    );
    await writeJson(
        recordDirectory,
        'full-frame-results.json',
        artifacts.fullFrameResults,
    );
    await writeJson(recordDirectory, 'criteria-results.json', artifacts.criteriaResults);
    await writeJson(recordDirectory, 'command.json', artifacts.command);
    await writeJson(recordDirectory, 'result.json', artifacts.result);
    await writeText(recordDirectory, 'report.md', artifacts.report);
    await appendRunLog(
        recordDirectory,
        `${RUNNER} ${artifacts.result.status}; ER4C ${artifacts.result.er4TransportStatus};`
            + ` ER5 ${artifacts.result.er5ExitStatus}; observational status not-claimed.`,
    );
}

function parseMode(argv) {
    if (argv.includes('--preflight')) {
        throw new Error(
            'Result-bearing preflight is disabled; execute only the predeclared numbered record.',
        );
    }
    const hasRecord = argv.includes('--record');
    if (!hasRecord) {
        throw new Error('Runner requires --record <predeclared-numbered-directory>.');
    }
    const recordDirectory = parseRecordDirectory(argv);
    if (recordDirectory.replaceAll('\\', '/') !== EXPECTED_RECORD_DIRECTORY) {
        throw new Error(
            `This predeclared runner may write only ${EXPECTED_RECORD_DIRECTORY}.`,
        );
    }
    const recordIndex = argv.indexOf('--record');
    const unknown = argv.slice(2).filter((_, index) =>
        index !== recordIndex - 2 && index !== recordIndex - 1);
    if (unknown.length > 0) {
        throw new Error(`Unsupported record arguments: ${unknown.join(', ')}`);
    }
    return Object.freeze({
        kind: 'record',
        recordDirectory,
        command: `node ${RUNNER_PATH} --record ${recordDirectory}`,
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

function stateGoalText() {
    return `# State Goal

Execute ${EXPECTED_RECORD_ID} once to close ER4C with physically typed
exact-direction point and extended transport,
then close the remaining ER5 canonical-Sun and CALSPEC-Sirius independent
references while inheriting sealed record 049 only as the lunar XA-G09 slice.

ER4C claims the physical source-to-pixel transport/composition layer through
XA-G01..XA-G08 and the mechanical/physical separation in XA-G10. ER5 claims
Sun/Sirius source and independent-reference closure through XA-G01, XA-G03,
XA-G04, XA-G06, XA-G08, XA-G09, and XA-G10. Analytic proof geometry satisfies
only this isolated record; returned-epoch real-scene geometry remains ER6.
Observer visibility, automated/human review, XA-G11 convergence, XA-G12 parity,
GPU, production, and source-specific display claims are excluded.
`;
}

function reportText(result, criteria) {
    return `# ER4C Sun/Sirius Physical Transport Closure

Overall status: **${result.status}**

- ER4 transport: ${result.er4TransportStatus}
- Point transport: ${result.pointTransportStatus}
- Extended transport: ${result.extendedTransportStatus}
- Full-frame transport: ${result.fullFrameTransportStatus}
- Lunar dependency: ${result.lunarDependencyStatus}
- Sirius reference: ${result.siriusReferenceStatus}
- Solar reference: ${result.solarReferenceStatus}
- ER5 exit: ${result.er5ExitStatus}
- Mechanical status: ${result.mechanicalStatus}
- Physical-radiometry status: ${result.physicalRadiometryStatus}
- Automated reviewability: ${result.automatedReviewabilityStatus}
- Human review: ${result.humanReviewStatus}
- Observational status: not-claimed
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

function summarizeExtendedMetrics(extended) {
    return Object.freeze({
        vacuumMaximumIntegratedCanonicalRelativeResidual: Math.max(
            ...extended.vacuumMatrix.map((entry) =>
                entry.metrics.integratedCanonicalIrradianceRelativeResidual),
        ),
        vacuumMaximumComponentConservationRelativeResidual: Math.max(
            ...extended.vacuumMatrix.map((entry) =>
                entry.metrics.componentConservationRelativeResidual),
        ),
        actualLowHighIntegralRelativeResidual:
            extended.actualAtmosphere.metrics.transmittedIntegralLowHighRelative,
        actualLowHighProjectedRelativeResidual:
            extended.actualAtmosphere.metrics.transmittedProjectedLowHighRelative,
        centerTransmittanceWrongRouteRelativeDifference:
            extended.wrongRoutes.centerTransmittance.relativeDifference,
        doubleTransmittanceWrongRouteRelativeDifference:
            extended.wrongRoutes.doubleTransmittance.relativeDifference,
        partialVisibleSampleCount:
            extended.partialBlocker.metrics.visibleSampleCount,
        partialBlockedSampleCount:
            extended.partialBlocker.metrics.blockedSampleCount,
        partialPathRelativeResidual:
            extended.partialBlocker.metrics.pathRadianceRelativeResidual,
    });
}
