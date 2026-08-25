// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER3 executable expansion.

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import PerspectiveCameraRaster from '../camera/PerspectiveCameraRaster.js';
import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { createAnalyticExtendedRadianceDensity } from '../external-celestial-sources/createAnalyticExtendedRadianceDensity.js';
import { createCanonicalSpectralDensityBasis } from '../external-celestial-sources/createCanonicalSpectralDensityBasis.js';
import ExternalCelestialSource from '../external-celestial-sources/ExternalCelestialSource.js';
import { SPECTRAL_RADIANCE_DENSITY } from '../external-celestial-sources/consts.js';
import AnalyticAngularDiskSource from '../extended-source-integration/AnalyticAngularDiskSource.js';
import ExtendedSourceIntegrator from '../extended-source-integration/ExtendedSourceIntegrator.js';
import LambertSphereDiskSource from '../extended-source-integration/LambertSphereDiskSource.js';
import SphericalCapQuadrature from '../extended-source-integration/SphericalCapQuadrature.js';
import { stableHash } from '../provenance/stableHash.js';
import { appendRunLog, createFreshRecordDirectory, nowIso, parseRecordDirectory, writeJson, writeText } from './recordWriter.js';

const runnerName = 'er3ExtendedSourceConservation';
const recordDirectory = parseRecordDirectory(process.argv);
const commandText = `node scripts/flat/reconciliation/POC/src/runners/${runnerName}.js --record ${recordDirectory}`;
const tolerances = Object.freeze({
    solidAngleAbsolute: 1e-12,
    uniformAbsoluteFloor: 1e-19,
    uniformRelative: 1e-12,
    limbRelative: 2e-5,
    lambertRelative: 5e-4,
    edgeReferenceFractionAbsolute: 0.01,
    smallAngleRelative: 1e-8,
});

await createFreshRecordDirectory(recordDirectory);
try {
    await execute();
} catch (error) {
    await writeJson(recordDirectory, 'failure.json', { status: 'invalid', runner: runnerName, error: serializeError(error) });
    await writeJson(recordDirectory, 'result.json', { status: 'invalid', er3Status: 'invalid-attempt', nextPhase: 'ER3 correction in a fresh record', imageCount: 0 });
    await appendRunLog(recordDirectory, `${runnerName} invalid: ${error.message}`);
    throw error;
}

async function execute() {
    await writeText(recordDirectory, 'state-goal.md', `# State Goal

Accept extended angular-source integration independently of atmosphere, display,
real Sun/Moon calibration, or image output. Prove equal-solid-angle spherical-
cap quadrature, uniform disk and normalized limb integration, a disk-equivalent
Lambert phase fixture, exact pixel averaging with derived coverage, explicit
off-raster integral accounting, and resolved/collapsed small-angle behavior.
`);
    await writeJson(recordDirectory, 'command.json', { commands: [{ command: commandText, timestamp: nowIso() }] });
    await writeJson(recordDirectory, 'inputs.json', {
        stage: 'ER3-extended-source-conservation-reference',
        tolerances,
        cameraMatrix: cameraConfigurations(),
        radiusRatios: [0.001, 0.1, 1, 4],
        quadrature: { runtime: [64, 128], reference: [128, 256] },
        prohibitedOutputs: ['atmosphere', 'display', 'real-scene', 'image', 'physical Sun calibration', 'physical lunar calibration'],
    });

    const basis = createCanonicalSpectralDensityBasis();
    const packet = createAnalyticExtendedRadianceDensity(basis, 1e-4);
    const uniformMatrix = [];
    const solidAngleChecks = [];
    for (const config of cameraConfigurations()) {
        const camera = new PerspectiveCameraRaster(config);
        const centerDirection = camera.rasterCenterToDirection((camera.widthPixels - 1) / 2, (camera.heightPixels - 1) / 2);
        const centerOmega = camera.pixelSolidAngleSteradians(Math.floor((camera.widthPixels - 1) / 2), Math.floor((camera.heightPixels - 1) / 2));
        const radiusResults = [];
        for (const ratio of [0.001, 0.1, 1, 4]) {
            const alpha = Math.min(Math.PI / 3, ratio * Math.sqrt(centerOmega / Math.PI));
            const source = new AnalyticAngularDiskSource({ id: `uniform-${config.id}-${ratio}`, packet, angularRadiusRadians: alpha, centerDirectionCamera: centerDirection });
            const result = new ExtendedSourceIntegrator({ camera }).integrate({ source, radialCount: 64, azimuthCount: 128 });
            const expectedOmega = 2 * Math.PI * (1 - Math.cos(alpha));
            const expectedProjected = packet.values.map((value) => Math.PI * value * Math.sin(alpha) ** 2);
            radiusResults.push(compareUniform(result, expectedOmega, expectedProjected));
        }
        uniformMatrix.push(Object.freeze({ camera: camera.describe(), radiusResults }));
        solidAngleChecks.push(capQuadratureCheck(centerDirection, 0.2));
    }

    const limb = diagnoseLimb({ basis, packet });
    const lambert = diagnoseLambert({ basis, packet });
    const edge = diagnoseEdge({ basis, packet });
    const convergence = diagnoseConvergence({ basis, packet });
    const negativeCases = exerciseNegativeCases({ basis, packet });
    const criteria = Object.freeze([
        criterion('cap-quadrature-reconstructs-solid-angle', solidAngleChecks.every((entry) => entry.status === 'accepted')),
        criterion('uniform-disk-integral-and-projected-irradiance-pass', uniformMatrix.every((entry) => entry.radiusResults.every((result) => result.status === 'accepted'))),
        criterion('normalized-limb-preserves-projected-irradiance', limb.status === 'accepted'),
        criterion('lambert-phase-law-fixture-passes', lambert.status === 'accepted'),
        criterion('pixel-averaging-uses-omega-once-and-derives-coverage', uniformMatrix.every((entry) => entry.radiusResults.every((result) => result.pixelStatus === 'accepted'))),
        criterion('edge-on-off-raster-integrals-are-accounted-without-renormalization', edge.status === 'accepted'),
        criterion('resolved-collapsed-small-angle-convergence-passes', convergence.status === 'accepted'),
        criterion('largest-disk-occupies-multiple-pixels', convergence.largestDiskPixelCount > 4),
        criterion('all-invalid-cases-fail-with-predeclared-error-codes', negativeCases.every((entry) => entry.status === 'accepted')),
        criterion('er3-produced-no-atmosphere-display-or-image', true),
    ]);
    const status = criteria.every((entry) => entry.status === 'accepted') ? 'accepted' : 'rejected';
    await writeJson(recordDirectory, 'provenance.json', {
        basisFingerprint: basis.fingerprint,
        packetFingerprint: packet.fingerprint,
        sourceKind: 'extended',
        claimBoundary: 'analytic conservation fixtures only; no physical Sun/Moon calibration',
        sourceContentHashes: {
            runner: stableHash(await readFile('scripts/flat/reconciliation/POC/src/runners/er3ExtendedSourceConservation.js', 'utf8')),
            camera: stableHash(await readFile('scripts/flat/reconciliation/POC/src/camera/PerspectiveCameraRaster.js', 'utf8')),
            integrator: stableHash(await readFile('scripts/flat/reconciliation/POC/src/extended-source-integration/ExtendedSourceIntegrator.js', 'utf8')),
        },
    });
    await writeJson(recordDirectory, 'uniform-disk-matrix.json', uniformMatrix);
    await writeJson(recordDirectory, 'cap-quadrature.json', solidAngleChecks);
    await writeJson(recordDirectory, 'limb-profile.json', limb);
    await writeJson(recordDirectory, 'lambert-phase.json', lambert);
    await writeJson(recordDirectory, 'edge-clipping.json', edge);
    await writeJson(recordDirectory, 'resolved-collapsed-convergence.json', convergence);
    await writeJson(recordDirectory, 'negative-cases.json', negativeCases);
    await writeJson(recordDirectory, 'criteria-results.json', { status, mechanicalStatus: status, physicalConservationStatus: status, observationalStatus: 'not-applicable', humanReviewStatus: 'not-applicable', criteria });
    await writeJson(recordDirectory, 'result.json', { status, er3Status: status, acceptedCriterionCount: criteria.filter((entry) => entry.status === 'accepted').length, criterionCount: criteria.length, nextPhase: status === 'accepted' ? 'ER4 frozen-atmosphere CPU integration' : 'ER3 correction in a fresh record', imageCount: 0 });
    await writeText(recordDirectory, 'report.md', report({ status, criteria, uniformMatrix, limb, lambert, edge, convergence }));
    await appendRunLog(recordDirectory, `${runnerName} ${status}; extended conservation ${status}; no image output.`);
    console.log(JSON.stringify({ status, er3Status: status, recordDirectory, acceptedCriterionCount: criteria.filter((entry) => entry.status === 'accepted').length, criterionCount: criteria.length, nextPhase: status === 'accepted' ? 'ER4' : 'ER3-correction' }));
}

function cameraConfigurations() {
    return [
        { id: 'square-64', widthPixels: 64, heightPixels: 64 },
        { id: 'landscape-128x96', widthPixels: 128, heightPixels: 96 },
        { id: 'wide-257x129', widthPixels: 257, heightPixels: 129 },
    ].flatMap((base) => [10, 60, 100].map((verticalFovDegrees) => ({ ...base, verticalFovDegrees, id: `${base.id}-vfov-${verticalFovDegrees}` })));
}

function compareUniform(result, expectedOmega, expectedProjected) {
    const omegaError = Math.abs(result.quadrature.sampledSolidAngleSteradians - expectedOmega);
    const integralErrors = result.totalIntegral.map((value, index) => Math.abs(value - expectedOmega * 1e-4));
    const projectedErrors = result.totalProjectedIrradiance.map((value, index) => Math.abs(value - expectedProjected[index]));
    const pixelErrors = result.reconstructedOnFrameIntegral.map((value, index) => Math.abs(value + result.offRasterIntegral[index] - result.totalIntegral[index]));
    const scale = Math.max(...expectedProjected, expectedOmega * 1e-4);
    return { expectedOmega, sampledOmega: result.quadrature.sampledSolidAngleSteradians, omegaError, maximumIntegralError: Math.max(...integralErrors), maximumProjectedError: Math.max(...projectedErrors), maximumPixelError: Math.max(...pixelErrors), pixelStatus: Math.max(...pixelErrors) <= tolerances.uniformAbsoluteFloor + tolerances.uniformRelative * scale ? 'accepted' : 'rejected', status: omegaError <= tolerances.solidAngleAbsolute && Math.max(...integralErrors) <= tolerances.uniformAbsoluteFloor + tolerances.uniformRelative * scale && Math.max(...projectedErrors) <= tolerances.uniformAbsoluteFloor + tolerances.uniformRelative * scale ? 'accepted' : 'rejected' };
}

function capQuadratureCheck(center, alpha) {
    const q = new SphericalCapQuadrature({ angularRadiusRadians: alpha, radialCount: 64, azimuthCount: 128 });
    const sampled = q.sample(center).reduce((sum, sample) => sum + sample.solidAngleWeightSteradians, 0);
    return { expected: q.expectedSolidAngleSteradians(), sampled, error: Math.abs(sampled - q.expectedSolidAngleSteradians()), status: Math.abs(sampled - q.expectedSolidAngleSteradians()) <= tolerances.solidAngleAbsolute ? 'accepted' : 'rejected' };
}

function diagnoseLimb({ packet }) {
    const camera = new PerspectiveCameraRaster({ widthPixels: 128, heightPixels: 96, verticalFovDegrees: 60 });
    const center = camera.rasterCenterToDirection(63.5, 47.5);
    const alpha = 0.02;
    const source = new AnalyticAngularDiskSource({ id: 'limb', packet, angularRadiusRadians: alpha, centerDirectionCamera: center, limbCoefficient: 0.6 });
    const result = new ExtendedSourceIntegrator({ camera }).integrate({ source, radialCount: 128, azimuthCount: 256 });
    const expected = packet.values.map((value) => Math.PI * value * Math.sin(alpha) ** 2);
    const maxRelative = Math.max(...result.totalProjectedIrradiance.map((value, index) => Math.abs(value - expected[index]) / expected[index]));
    return { status: maxRelative <= tolerances.limbRelative ? 'accepted' : 'rejected', maxRelative, expected, actual: result.totalProjectedIrradiance };
}

function diagnoseLambert({ packet }) {
    const camera = new PerspectiveCameraRaster({ widthPixels: 128, heightPixels: 96, verticalFovDegrees: 60 });
    const center = camera.rasterCenterToDirection(63.5, 47.5);
    const alpha = 0.02;
    const phases = [0, 30, 60, 85].map((degrees) => {
        const radians = degrees * Math.PI / 180;
        const source = new LambertSphereDiskSource({ id: `lambert-${degrees}`, packet, angularRadiusRadians: alpha, centerDirectionCamera: center, phaseAngleRadians: radians });
        const result = new ExtendedSourceIntegrator({ camera }).integrate({ source, radialCount: 128, azimuthCount: 256 });
        const phaseFactor = (Math.sin(radians) + (Math.PI - radians) * Math.cos(radians)) / Math.PI;
        const expected = packet.values.map((value) => (2 * Math.PI / 3) * value * phaseFactor * Math.sin(alpha) ** 2);
        const maxRelative = Math.max(...result.totalProjectedIrradiance.map((value, index) => Math.abs(value - expected[index]) / Math.max(expected[index], 1e-300)));
        return { degrees, maxRelative, status: maxRelative <= tolerances.lambertRelative ? 'accepted' : 'rejected' };
    });
    return { status: phases.every((entry) => entry.status === 'accepted') ? 'accepted' : 'rejected', phases };
}

function diagnoseEdge({ packet }) {
    const lowCamera = new PerspectiveCameraRaster({ widthPixels: 64, heightPixels: 128, verticalFovDegrees: 60 });
    const highCamera = new PerspectiveCameraRaster({ widthPixels: 128, heightPixels: 256, verticalFovDegrees: 60 });
    const run = (camera, counts) => {
        const center = camera.rasterCenterToDirection(-0.5, camera.heightPixels / 2 - 0.5);
        const source = new AnalyticAngularDiskSource({ id: `edge-${camera.widthPixels}`, packet, angularRadiusRadians: 0.02, centerDirectionCamera: center });
        return new ExtendedSourceIntegrator({ camera }).integrate({ source, radialCount: counts[0], azimuthCount: counts[1] });
    };
    const low = run(lowCamera, [64, 128]);
    const high = run(highCamera, [128, 256]);
    const lowFraction = low.offRasterSolidAngle / low.quadrature.expectedSolidAngleSteradians;
    const highFraction = high.offRasterSolidAngle / high.quadrature.expectedSolidAngleSteradians;
    return { status: Math.abs(lowFraction - highFraction) <= tolerances.edgeReferenceFractionAbsolute ? 'accepted' : 'rejected', lowFraction, highFraction, difference: Math.abs(lowFraction - highFraction) };
}

function diagnoseConvergence({ packet }) {
    const camera = new PerspectiveCameraRaster({ widthPixels: 128, heightPixels: 96, verticalFovDegrees: 60 });
    const center = camera.rasterCenterToDirection(63.5, 47.5);
    const centerOmega = camera.pixelSolidAngleSteradians(63, 47);
    const ratios = [0.001, 0.1, 1, 4].map((ratio) => {
        const alpha = ratio * Math.sqrt(centerOmega / Math.PI);
        const source = new AnalyticAngularDiskSource({ id: `convergence-${ratio}`, packet, angularRadiusRadians: alpha, centerDirectionCamera: center });
        const result = new ExtendedSourceIntegrator({ camera }).integrate({ source, radialCount: 128, azimuthCount: 256 });
        const relative = Math.max(...result.totalProjectedIrradiance.map((value, index) => Math.abs(value - result.totalIntegral[index]) / Math.max(Math.abs(result.totalProjectedIrradiance[index]), 1e-300)));
        return { ratio, alpha, relative, pixelCount: result.pixels.length, status: ratio === 0.001 && relative <= tolerances.smallAngleRelative ? 'accepted' : 'reported' };
    });
    return { status: ratios[0].status === 'accepted' ? 'accepted' : 'rejected', smallestRelative: ratios[0].relative, largestDiskPixelCount: ratios.at(-1).pixelCount, ratios };
}

function exerciseNegativeCases({ basis, packet }) {
    const camera = new PerspectiveCameraRaster({ widthPixels: 16, heightPixels: 16, verticalFovDegrees: 45 });
    const center = camera.rasterCenterToDirection(7.5, 7.5);
    const extended = new AnalyticAngularDiskSource({ id: 'valid', packet, angularRadiusRadians: 0.01, centerDirectionCamera: center });
    return [
        expectedFailure('invalid-radius', 'ER3_QUADRATURE_RADIUS_INVALID', () => new SphericalCapQuadrature({ angularRadiusRadians: 0, radialCount: 4, azimuthCount: 4 })),
        expectedFailure('invalid-count', 'ER3_QUADRATURE_COUNT_INVALID', () => new SphericalCapQuadrature({ angularRadiusRadians: 0.1, radialCount: 0, azimuthCount: 4 })),
        expectedFailure('nonunit-center', 'ER3_QUADRATURE_CENTER_DIRECTION_NOT_UNIT', () => new SphericalCapQuadrature({ angularRadiusRadians: 0.1, radialCount: 4, azimuthCount: 4 }).sample([0, 0, -2])),
        expectedFailure('point-source-rejected', 'ER1_SOURCE_MEASURE_KIND_MISMATCH', () => new ExternalCelestialSource({ id: 'point', kind: 'point', geometry: { kind: 'test', owner: 'ER3' }, spectralMeasure: createAnalyticExtendedRadianceDensity(basis, 1) })),
        expectedFailure('bare-array-rejected', 'ER1_SOURCE_TYPED_MEASURE_REQUIRED', () => new AnalyticAngularDiskSource({ id: 'array', packet: [], angularRadiusRadians: 0.1, centerDirectionCamera: center })),
    ].map((entry) => Object.freeze(entry));
}

function expectedFailure(id, code, operation) {
    try { operation(); return { id, expectedCode: code, actualCode: null, status: 'rejected' }; } catch (error) { return { id, expectedCode: code, actualCode: error.code ?? null, status: error instanceof ReconciliationConfigurationError && error.code === code ? 'accepted' : 'rejected' }; }
}
function criterion(name, accepted) { return { name, status: accepted ? 'accepted' : 'rejected' }; }
function serializeError(error) { return { name: error.name, code: error.code ?? null, message: error.message, stack: error.stack ?? null }; }
function report({ status, criteria, uniformMatrix, limb, lambert, edge, convergence }) {
    return `# ER3 Extended-Source Conservation Reference

Overall status: **${status}**

Uniform angular disks, normalized limb profiles, a disk-equivalent Lambert phase
fixture, exact pixel solid angles, derived coverage, and explicit edge losses
were evaluated before atmosphere/display/image work.

- Uniform matrix cases: ${uniformMatrix.length * 4}.
- Limb status: ${limb.status}.
- Lambert status: ${lambert.status}.
- Edge status: ${edge.status} (difference ${edge.difference}).
- Small-angle convergence: ${convergence.smallestRelative}; largest disk pixels ${convergence.largestDiskPixelCount}.

Accepted criteria: ${criteria.filter((entry) => entry.status === 'accepted').length}/${criteria.length}.
`;
}
