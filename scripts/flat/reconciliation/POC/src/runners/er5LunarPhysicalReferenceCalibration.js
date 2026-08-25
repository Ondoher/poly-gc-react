// References:
// - NIST AIR-LUSI 2022 campaign dataset, doi:10.18434/mds2-3397.
// - Kieffer & Stone (2005), ROLO model 311g, doi:10.1086/430185.
// - LIME-TBX v1.4.1, coefficient set 20251010_v1, ASD v2.0.0.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER5.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import AirLusiCalibrationFixtureReader from '../external-celestial-sources/AirLusiCalibrationFixtureReader.js';
import { LIME_SCIPY_INTERPOLATION_WEIGHT_ORACLE } from '../external-celestial-sources/consts.js';
import { createCanonicalSolarIrradianceDensity } from '../external-celestial-sources/createCanonicalSolarIrradianceDensity.js';
import { createCanonicalSpectralDensityBasis } from '../external-celestial-sources/createCanonicalSpectralDensityBasis.js';
import { EXTERNAL_CELESTIAL_FIXTURE_MANIFEST } from '../external-celestial-sources/fixtureManifest.js';
import LimeCalibrationFixtureReader from '../external-celestial-sources/LimeCalibrationFixtureReader.js';
import LimeCoefficientModel from '../external-celestial-sources/LimeCoefficientModel.js';
import LimeSpectralUncertaintyPropagator from '../external-celestial-sources/LimeSpectralUncertaintyPropagator.js';
import Rolo311gReferenceModel from '../external-celestial-sources/Rolo311gReferenceModel.js';
import {
    appendRunLog,
    createFreshRecordDirectory,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const RUNNER_PATH =
    'scripts/flat/reconciliation/POC/src/runners/er5LunarPhysicalReferenceCalibration.js';
const EXPECTED_RECORD =
    'tmp/atmosphere/reconciliation/049-er5-lunar-physical-reference-calibration';
const RUN_COMMAND = 'node ' + RUNNER_PATH + ' --record ' + EXPECTED_RECORD;
const RELEASE_BRANCH_ID = 'release-positional-native-linear';
const REFERENCE_DISTANCE_CASE = Object.freeze({
    id: 'air-lusi-standardized-reference-distances',
    sunMoonDistanceAstronomicalUnits: 1,
    observerMoonDistanceKilometers: 384400,
});
const TOLERANCES = Object.freeze({
    airLusiDirectRelativeFloor: 0.05,
    airLusiCombinedStandardUncertaintyMultiplier: 2,
    airLusiOmittedUniformityRelativeStandardUncertainty: 0.003,
    limeMinimumRelativeStandardUncertainty: 0.01,
    airLusiNumericalIntegrationRelative: 0.0025,
    roloBlueRelative: 0.15,
    centralReconstructionRelative: 1e-12,
    tsisEffectiveConversionRelative: 1e-12,
    jacobianScaledError: 1e-6,
    scipyInterpolationWeightAbsolute: 1e-11,
    covarianceSymmetryAbsolute: 1e-10,
    covarianceComponentSumAbsolute: 1e-12,
    covariancePsdRelativeToMaximumDiagonal: 1e-10,
    covariancePsdScaleFloor: 1e-300,
    jacobiRelativeConvergence: 1e-14,
    jacobiMaximumSweeps: 100,
});
const INHERITED_RECORDS = Object.freeze({
    extendedSourceConservation:
        'tmp/atmosphere/reconciliation/040-er3-extended-source-conservation/result.json',
    frozenAtmosphereCpu:
        'tmp/atmosphere/reconciliation/042-er4-frozen-atmosphere-cpu-integration/result.json',
    stellarAndSolarPhysicalSource:
        'tmp/atmosphere/reconciliation/044-er5-physical-source-calibration/result.json',
    stellarAndSolarCriteria:
        'tmp/atmosphere/reconciliation/044-er5-physical-source-calibration/criteria-results.json',
});
const SOURCE_PATHS = Object.freeze([
    RUNNER_PATH,
    'scripts/flat/reconciliation/POC/src/runners/recordWriter.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/AirLusiCalibrationFixtureReader.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/LimeCalibrationFixtureReader.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/LimeCoefficientModel.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/LimeSpectralUncertaintyPropagator.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/Rolo311gReferenceModel.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/ZipArchiveReader.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/binPiecewiseLinearSpectralDensity.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/createCanonicalSolarIrradianceDensity.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/createCanonicalSpectralDensityBasis.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtureManifest.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/consts.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/SpectralDensityBasis.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/SpectralDensityPacket.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures/air_lusi_spectra.nc',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures/kieffer-stone-2005-rolo-311g.pdf',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures/comet_maths-1.0.8.tar.gz',
    'scripts/flat/reconciliation/POC/src/constants/consts.js',
    'scripts/flat/reconciliation/POC/src/provenance/stableHash.js',
    INHERITED_RECORDS.extendedSourceConservation,
    INHERITED_RECORDS.frozenAtmosphereCpu,
    INHERITED_RECORDS.stellarAndSolarPhysicalSource,
    INHERITED_RECORDS.stellarAndSolarCriteria,
    'package.json',
    'package-lock.json',
    'node_modules/h5wasm/package.json',
    'node_modules/h5wasm/dist/node/hdf5_hl.js',
    'node_modules/h5wasm/dist/node/hdf5_util.js',
]);

function sha256(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}

async function describeFiles(paths) {
    return Promise.all(paths.map(async (path) => {
        const bytes = await readFile(resolve(path));
        return Object.freeze({
            path,
            byteLength: bytes.length,
            sourceHashSha256: sha256(bytes),
        });
    }));
}

async function readJson(path) {
    return JSON.parse(await readFile(resolve(path), 'utf8'));
}

async function readGitContext() {
    try {
        const head = (await readFile(resolve('.git/HEAD'), 'utf8')).trim();
        if (!head.startsWith('ref: ')) {
            return Object.freeze({
                head,
                revision: head,
                workingTreeStatus:
                    'not invoked; exact source-file hashes govern this immutable record',
            });
        }
        const reference = head.slice('ref: '.length);
        let revision = null;
        try {
            revision = (await readFile(resolve('.git', reference), 'utf8')).trim();
        } catch {
            revision = null;
        }
        return Object.freeze({
            head,
            reference,
            revision,
            workingTreeStatus:
                'not invoked; exact source-file hashes govern this immutable record',
        });
    } catch (error) {
        return Object.freeze({
            head: null,
            revision: null,
            error: error.message,
            workingTreeStatus:
                'not invoked; exact source-file hashes govern this immutable record',
        });
    }
}

function criterion(layer, name, status, evidence) {
    return Object.freeze({ layer, name, status, evidence });
}

function statusForLayer(criteria, layer) {
    const selected = criteria.filter((entry) => entry.layer === layer);
    return selected.length > 0 && selected.every((entry) => entry.status === 'accepted')
        ? 'accepted'
        : 'rejected';
}

function maximumRelativeDifference(left, right) {
    if (left.length !== right.length || left.length === 0) {
        throw new Error('Relative comparison requires aligned nonempty vectors.');
    }
    return Math.max(...left.map((value, index) =>
        Math.abs(value - right[index])
        / Math.max(Math.abs(right[index]), Number.MIN_VALUE)));
}

function integratePiecewiseLinearAverage(wavelengths, values, lower, upper) {
    if (
        wavelengths.length !== values.length
        || wavelengths.length < 2
        || wavelengths[0] > lower
        || wavelengths.at(-1) < upper
    ) {
        throw new Error('Piecewise-linear integration lacks aligned interval coverage.');
    }
    let integral = 0;
    let contributingSegmentCount = 0;
    for (let index = 0; index < wavelengths.length - 1; index += 1) {
        const x0 = wavelengths[index];
        const x1 = wavelengths[index + 1];
        const segmentLower = Math.max(lower, x0);
        const segmentUpper = Math.min(upper, x1);
        if (segmentUpper <= segmentLower) {
            continue;
        }
        const interpolate = (x) => values[index]
            + (values[index + 1] - values[index]) * (x - x0) / (x1 - x0);
        integral += (interpolate(segmentLower) + interpolate(segmentUpper))
            * (segmentUpper - segmentLower) / 2;
        contributingSegmentCount += 1;
    }
    return Object.freeze({
        average: integral / (upper - lower),
        integral,
        contributingSegmentCount,
        method: 'piecewise-linear-exact-bin-integral-v1',
    });
}

function maximumOverContributingSegments(wavelengths, values, lower, upper) {
    let maximum = -Infinity;
    for (let index = 0; index < wavelengths.length - 1; index += 1) {
        if (Math.min(upper, wavelengths[index + 1]) <= Math.max(lower, wavelengths[index])) {
            continue;
        }
        maximum = Math.max(maximum, values[index], values[index + 1]);
    }
    if (!Number.isFinite(maximum)) {
        throw new Error('Uncertainty interval has no contributing samples.');
    }
    return maximum;
}

function everyOtherSample(values) {
    return values.filter((_value, index) => index % 2 === 0);
}

function buildAirLusiMeasurements(airLusi, basis) {
    const halfWavelengths = everyOtherSample(airLusi.wavelength);
    return Object.freeze(airLusi.flightIds.flatMap((flightId, flightIndex) =>
        basis.channels.slice(1).map((channel) => {
            const channelIndex = basis.channels.indexOf(channel);
            const irradianceMicrowatts = airLusi.irradiance[flightIndex];
            const full = integratePiecewiseLinearAverage(
                airLusi.wavelength,
                irradianceMicrowatts,
                channel.lowerBoundNanometers,
                channel.upperBoundNanometers,
            );
            const half = integratePiecewiseLinearAverage(
                halfWavelengths,
                everyOtherSample(irradianceMicrowatts),
                channel.lowerBoundNanometers,
                channel.upperBoundNanometers,
            );
            const numericalRelativeResidual = Math.abs(full.average / half.average - 1);
            const publishedRelativeStandardUncertainty = maximumOverContributingSegments(
                airLusi.wavelength,
                airLusi.totalRelativeError[flightIndex],
                channel.lowerBoundNanometers,
                channel.upperBoundNanometers,
            );
            return Object.freeze({
                flightIndex,
                flightId,
                timestampUtc: airLusi.timestamps[flightIndex],
                channelIndex,
                channelId: channel.id,
                lowerBoundNanometers: channel.lowerBoundNanometers,
                upperBoundNanometers: channel.upperBoundNanometers,
                airLusiIrradianceWattsPerSquareMeterPerNanometer:
                    full.average * 1e-6,
                fullGrid: full,
                everyOtherGrid: half,
                numericalRelativeResidual,
                publishedRelativeStandardUncertainty,
                airLusiRelativeStandardUncertainty: Math.hypot(
                    publishedRelativeStandardUncertainty,
                    TOLERANCES.airLusiOmittedUniformityRelativeStandardUncertainty,
                ),
            });
        })));
}

function compareAirLusiBranch(
    id,
    values,
    relativeStandardUncertainties,
    measurements,
    channelsPerEvaluation,
) {
    const rows = Object.freeze(measurements.map((measurement) => {
        const outputIndex = measurement.flightIndex * channelsPerEvaluation
            + measurement.channelIndex;
        const limeIrradiance = values[outputIndex];
        const limeRelativeStandardUncertainty = Math.max(
            relativeStandardUncertainties[outputIndex],
            TOLERANCES.limeMinimumRelativeStandardUncertainty,
        );
        const residual = Math.abs(
            limeIrradiance
            / measurement.airLusiIrradianceWattsPerSquareMeterPerNanometer - 1,
        );
        const acceptanceThreshold = Math.max(
            TOLERANCES.airLusiDirectRelativeFloor,
            TOLERANCES.airLusiCombinedStandardUncertaintyMultiplier * Math.hypot(
                measurement.airLusiRelativeStandardUncertainty,
                limeRelativeStandardUncertainty,
                measurement.numericalRelativeResidual,
            ),
        );
        const numericalPass = measurement.numericalRelativeResidual
            <= TOLERANCES.airLusiNumericalIntegrationRelative;
        return Object.freeze({
            ...measurement,
            outputIndex,
            limeIrradianceWattsPerSquareMeterPerNanometer: limeIrradiance,
            limeRelativeStandardUncertainty,
            absoluteRelativeResidual: residual,
            acceptanceThreshold,
            numericalPass,
            physicalPass: residual <= acceptanceThreshold,
            status: numericalPass && residual <= acceptanceThreshold
                ? 'accepted'
                : 'rejected',
        });
    }));
    return Object.freeze({
        id,
        comparisonCount: rows.length,
        acceptedComparisonCount: rows.filter((row) => row.status === 'accepted').length,
        maximumNumericalRelativeResidual: Math.max(...rows.map(
            (row) => row.numericalRelativeResidual,
        )),
        maximumAbsoluteRelativeResidual: Math.max(...rows.map(
            (row) => row.absoluteRelativeResidual,
        )),
        status: rows.length === 56 && rows.every((row) => row.status === 'accepted')
            ? 'accepted'
            : 'rejected',
        rows,
    });
}

function selectAuthorityBranch(assessments) {
    const passing = assessments.filter((assessment) => assessment.status === 'accepted');
    let selectedBranchId = null;
    let rule = null;
    if (passing.length > 1) {
        selectedBranchId = RELEASE_BRANCH_ID;
        rule = 'multiple-pass-release-executable-authority-wins';
    } else if (passing.length === 1) {
        selectedBranchId = passing[0].id;
        rule = selectedBranchId === RELEASE_BRANCH_ID
            ? 'exactly-one-release-branch-passes'
            : 'exactly-one-alternate-branch-requires-fresh-central-propagation';
    } else {
        rule = 'no-branch-passed-reject';
    }
    return Object.freeze({
        rule,
        passingBranchIds: Object.freeze(passing.map((entry) => entry.id)),
        selectedBranchId,
        selectedBranchPasses: selectedBranchId !== null
            && passing.some((entry) => entry.id === selectedBranchId),
        requiresFreshCentralPropagation:
            selectedBranchId !== null && selectedBranchId !== RELEASE_BRANCH_ID,
        status: selectedBranchId === RELEASE_BRANCH_ID
            && passing.some((entry) => entry.id === selectedBranchId)
            ? 'accepted'
            : 'rejected',
    });
}

function checkInterpolationOracle(propagator) {
    const rows = [];
    let maximumAbsoluteResidual = 0;
    for (const sample of LIME_SCIPY_INTERPOLATION_WEIGHT_ORACLE.samples) {
        const wavelengthIndex = propagator.asdWavelengths.indexOf(
            sample.wavelengthNanometers,
        );
        if (wavelengthIndex === -1) {
            throw new Error('Interpolation oracle wavelength is absent from the ASD grid.');
        }
        for (const [oracleKey, operatorKey] of [
            ['quadratic', 'quadraticNotAKnot'],
            ['cubic', 'cubicNotAKnot'],
        ]) {
            const offset = wavelengthIndex * propagator.anchorCount;
            const actual = Array.from(
                propagator.interpolationOperators[operatorKey].values.slice(
                    offset,
                    offset + propagator.anchorCount,
                ),
            );
            const residuals = actual.map((value, index) =>
                Math.abs(value - sample[oracleKey][index]));
            maximumAbsoluteResidual = Math.max(maximumAbsoluteResidual, ...residuals);
            rows.push(Object.freeze({
                wavelengthNanometers: sample.wavelengthNanometers,
                interpolation: oracleKey,
                expected: sample[oracleKey],
                actual: Object.freeze(actual),
                maximumAbsoluteResidual: Math.max(...residuals),
            }));
        }
    }
    return Object.freeze({
        numpyVersion: LIME_SCIPY_INTERPOLATION_WEIGHT_ORACLE.numpyVersion,
        scipyVersion: LIME_SCIPY_INTERPOLATION_WEIGHT_ORACLE.scipyVersion,
        anchorsNanometers: LIME_SCIPY_INTERPOLATION_WEIGHT_ORACLE.anchorsNanometers,
        rows: Object.freeze(rows),
        maximumAbsoluteResidual,
        tolerance: TOLERANCES.scipyInterpolationWeightAbsolute,
        status: maximumAbsoluteResidual <= TOLERANCES.scipyInterpolationWeightAbsolute
            ? 'accepted'
            : 'rejected',
    });
}

function jacobiPsdDiagnostic(matrix, id) {
    const size = matrix.length;
    if (
        size === 0
        || matrix.some((row) => !Array.isArray(row) || row.length !== size)
    ) {
        throw new Error('PSD diagnostic requires a nonempty square matrix.');
    }
    const work = Array.from({ length: size }, (_entry, row) =>
        Array.from({ length: size }, (_unused, column) =>
            (matrix[row][column] + matrix[column][row]) / 2));
    const maximumDiagonal = Math.max(...work.map((row, index) => row[index]));
    const maximumAbsoluteEntry = Math.max(...work.flat().map(Math.abs));
    const convergenceThreshold = TOLERANCES.jacobiRelativeConvergence
        * Math.max(maximumAbsoluteEntry, TOLERANCES.covariancePsdScaleFloor);
    let maximumOffDiagonal = Infinity;
    let completedSweeps = 0;
    for (
        let sweep = 0;
        sweep < TOLERANCES.jacobiMaximumSweeps;
        sweep += 1
    ) {
        maximumOffDiagonal = 0;
        for (let p = 0; p < size - 1; p += 1) {
            for (let q = p + 1; q < size; q += 1) {
                const apq = work[p][q];
                maximumOffDiagonal = Math.max(maximumOffDiagonal, Math.abs(apq));
                if (Math.abs(apq) <= convergenceThreshold) {
                    continue;
                }
                const tau = (work[q][q] - work[p][p]) / (2 * apq);
                const tangent = tau === 0
                    ? 1
                    : Math.sign(tau) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
                const cosine = 1 / Math.sqrt(1 + tangent * tangent);
                const sine = tangent * cosine;
                for (let k = 0; k < size; k += 1) {
                    if (k === p || k === q) {
                        continue;
                    }
                    const akp = work[k][p];
                    const akq = work[k][q];
                    work[k][p] = cosine * akp - sine * akq;
                    work[p][k] = work[k][p];
                    work[k][q] = sine * akp + cosine * akq;
                    work[q][k] = work[k][q];
                }
                work[p][p] -= tangent * apq;
                work[q][q] += tangent * apq;
                work[p][q] = 0;
                work[q][p] = 0;
            }
        }
        completedSweeps = sweep + 1;
        if (maximumOffDiagonal <= convergenceThreshold) {
            break;
        }
    }
    maximumOffDiagonal = 0;
    for (let row = 0; row < size - 1; row += 1) {
        for (let column = row + 1; column < size; column += 1) {
            maximumOffDiagonal = Math.max(
                maximumOffDiagonal,
                Math.abs(work[row][column]),
            );
        }
    }
    const eigenvalues = work.map((row, index) => row[index]);
    const minimumEigenvalue = Math.min(...eigenvalues);
    const maximumEigenvalue = Math.max(...eigenvalues);
    const negativeTolerance = TOLERANCES.covariancePsdRelativeToMaximumDiagonal
        * Math.max(maximumDiagonal, TOLERANCES.covariancePsdScaleFloor);
    const converged = maximumOffDiagonal <= convergenceThreshold;
    return Object.freeze({
        id,
        method: 'cyclic-symmetric-jacobi-eigenvalue-v1',
        shape: Object.freeze([size, size]),
        completedSweeps,
        maximumSweeps: TOLERANCES.jacobiMaximumSweeps,
        maximumOffDiagonal,
        convergenceThreshold,
        converged,
        minimumEigenvalue,
        maximumEigenvalue,
        maximumDiagonal,
        allowedNegativeEigenvalue: negativeTolerance,
        status: converged && minimumEigenvalue >= -negativeTolerance
            ? 'accepted'
            : 'rejected',
    });
}

function covariancePsdDiagnostics(propagations) {
    return Object.freeze(Object.fromEntries(Object.entries(propagations).map(
        ([outputId, propagation]) => [
            outputId,
            Object.freeze(Object.fromEntries(Object.entries(propagation.covariance).map(
                ([componentId, matrix]) => [
                    componentId,
                    jacobiPsdDiagnostic(matrix, outputId + ':' + componentId),
                ],
            ))),
        ],
    )));
}

function covarianceDiagnosticsPass(propagations, psdDiagnostics) {
    return Object.entries(propagations).every(([outputId, propagation]) =>
        propagation.dimensions.covarianceShape[0] === 60
        && propagation.dimensions.covarianceShape[1] === 60
        && Object.values(propagation.diagnostics.covariance).every((diagnostic) => {
            if (typeof diagnostic !== 'object') {
                return diagnostic <= TOLERANCES.covarianceComponentSumAbsolute;
            }
            return diagnostic.maximumSymmetryResidual
                <= TOLERANCES.covarianceSymmetryAbsolute
                && diagnostic.minimumDiagonal >= -TOLERANCES.covarianceSymmetryAbsolute;
        })
        && Object.values(psdDiagnostics[outputId]).every(
            (diagnostic) => diagnostic.status === 'accepted',
        ));
}

function buildUncertaintyBudget(propagation) {
    return Object.freeze(propagation.outputs.map((output, outputIndex) => {
        const centralValue = propagation.centralValues[outputIndex];
        const components = Object.freeze(Object.fromEntries(
            Object.entries(propagation.covariance).map(([id, covariance]) => {
                const variance = Math.max(covariance[outputIndex][outputIndex], 0);
                const standardUncertainty = Math.sqrt(variance);
                return [id, Object.freeze({
                    variance,
                    standardUncertainty,
                    relativeStandardUncertainty: standardUncertainty
                        / Math.max(Math.abs(centralValue), Number.MIN_VALUE),
                })];
            }),
        ));
        return Object.freeze({
            ...output,
            centralValue,
            components,
        });
    }));
}

function selectedPhaseCorrelationArtifact(propagator, evaluations) {
    const phaseIndices = evaluations.map((evaluation) => evaluation.asd.phaseIndex);
    return Object.freeze({
        selectedPhaseIndices: Object.freeze(phaseIndices),
        selectedSignedPhaseDegrees: Object.freeze(evaluations.map(
            (evaluation) => evaluation.asd.selectedSignedPhaseDegrees,
        )),
        correlation: Object.freeze(phaseIndices.map((row) => Object.freeze(
            phaseIndices.map((column) =>
                propagator.phaseCorrelation[row * propagator.phaseCount + column]),
        ))),
    });
}

const recordDirectory = parseRecordDirectory(process.argv);
if (recordDirectory.replaceAll('\\', '/') !== EXPECTED_RECORD) {
    throw new Error('Record 049 must use the predeclared directory ' + EXPECTED_RECORD + '.');
}
await createFreshRecordDirectory(recordDirectory);
const startedAtUtc = nowIso();

try {
    const basis = createCanonicalSpectralDensityBasis();
    const canonicalSolar = createCanonicalSolarIrradianceDensity(basis);
    const inputs = Object.freeze({
        stage: 'ER5-lunar-physical-reference-calibration',
        record: '049',
        goal:
            'Close the ER5 lunar source-reference slice with release-authoritative LIME central semantics, joint correlated uncertainty, direct AIR-LUSI measurements, and a qualified ROLO blue-bin complement.',
        retainedSources: Object.freeze({
            lime: EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.limeLunarCandidate,
            airLusi: EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.airLusi2022,
            rolo311g: EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.rolo311g,
            interpolationOracle:
                EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.cometMathsInterpolation,
        }),
        basis: basis.describe(),
        referenceDistances: REFERENCE_DISTANCE_CASE,
        geometryPolicy: Object.freeze({
            absolutePhaseDegrees: 'abs(AIR-LUSI signed_phase)',
            signedPhaseDegrees: 'AIR-LUSI signed_phase',
            sunSelenographicLongitudeRadians:
                'AIR-LUSI subsolar_lon degrees multiplied by pi/180',
            observerSelenographicLatitudeDegrees: 'AIR-LUSI subobserver_lat',
            observerSelenographicLongitudeDegrees: 'AIR-LUSI subobserver_lon',
            retainedButNotConsumed: 'AIR-LUSI subsolar_lat and measured distances',
        }),
        directMeasurementPolicy: Object.freeze({
            comparisonCount: '4 flights x canonical channel indices 1..14 = 56',
            integration: 'exact piecewise-linear bin average',
            numericalCheck: 'full grid versus every-other-sample grid',
            measurementUnitsConversion: 'microW m^-2 nm^-1 multiplied by 1e-6',
            residual: 'abs(LIME/AIR-LUSI - 1)',
            airUncertainty:
                'hypot(max published Total_rel_err over contributing samples, 0.003)',
            limeUncertainty: 'max(joint relative standard uncertainty, 0.01)',
            acceptance:
                'residual <= max(0.05, 2*hypot(uAir,uLime,uNumerical))',
        }),
        blueComplementPolicy: Object.freeze({
            channelIndex: 0,
            reference: 'ROLO model 311g qualified model reference',
            comparison:
                'canonical-Sun-equivalent TSIS-weighted LIME reflectance versus ROLO',
            qualification: 'not an SI-traceable direct measurement',
        }),
        authoritySelectionPolicy: Object.freeze({
            branches:
                'release/ATBD coefficient order crossed with release-linear/ATBD-cubic interpolation; release SRF sign held fixed',
            multiplePass: 'select release-positional-native-linear by executable authority',
            exactlyOnePass:
                'accept only a sole release branch; a sole alternate branch is designated but requires a fresh record with matching central covariance',
            noPass: 'reject the lunar source-reference slice',
        }),
        tolerances: TOLERANCES,
        stopConditions: Object.freeze([
            'Seal invalid on any exception, hash/schema failure, nonfinite result, or failed invariant.',
            'Reject this lunar slice if release-authoritative central propagation is not the passing selected branch.',
            'Reject this lunar slice if any of 56 direct AIR-LUSI comparisons or four qualified ROLO blue comparisons fails.',
            'Reject correlated uncertainty on correlation, Jacobian, reconstruction, covariance, component-sum, or scale-aware PSD failure.',
            'Do not claim resolved lunar radiance, observer visibility, GPU parity, or production promotion.',
        ]),
        inheritedEvidencePolicy: Object.freeze({
            record040:
                'Read and hash only as analytic extended-integration evidence; do not claim a distinct collapsed path or camera-matrix convergence.',
            record042:
                'Read and hash, but do not inherit acceptance; later evidence review found its point-irradiance plus radiance composition physically invalid.',
            record044:
                'Read and hash only as CALSPEC Sirius and canonical-Sun source-ownership evidence, not physical-reference closure.',
            execution: 'Never rerun records 040, 042, or 044 from record 049.',
        }),
    });
    const command = Object.freeze({
        startedAtUtc,
        commands: Object.freeze([Object.freeze({
            command: RUN_COMMAND,
            role: 'single immutable record-049 execution',
        })]),
        predeclaredPostRunVerificationCommands: Object.freeze([
            'node --check ' + RUNNER_PATH,
            'npm run build',
            'git diff --check',
        ]),
    });
    await writeJson(recordDirectory, 'inputs.json', inputs);
    await writeJson(recordDirectory, 'command.json', command);

    const inherited = Object.freeze({
        extendedSourceConservation: await readJson(
            INHERITED_RECORDS.extendedSourceConservation,
        ),
        frozenAtmosphereCpu: await readJson(INHERITED_RECORDS.frozenAtmosphereCpu),
        stellarAndSolarPhysicalSource: await readJson(
            INHERITED_RECORDS.stellarAndSolarPhysicalSource,
        ),
        stellarAndSolarCriteria: await readJson(
            INHERITED_RECORDS.stellarAndSolarCriteria,
        ),
    });
    const sourceFiles = await describeFiles(SOURCE_PATHS);
    const retainedReferenceHashChecks = Object.freeze([
        Object.freeze({
            id: 'air-lusi-2022',
            path:
                'scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures/air_lusi_spectra.nc',
            expected: EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.airLusi2022
                .sourceHashSha256,
        }),
        Object.freeze({
            id: 'rolo-311g-publication',
            path:
                'scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures/kieffer-stone-2005-rolo-311g.pdf',
            expected: EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.rolo311g
                .sourceHashSha256,
        }),
        Object.freeze({
            id: 'comet-maths-interpolation-source',
            path:
                'scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures/comet_maths-1.0.8.tar.gz',
            expected: EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.cometMathsInterpolation
                .sourceHashSha256,
        }),
    ].map((check) => {
        const actual = sourceFiles.find((entry) => entry.path === check.path)
            ?.sourceHashSha256 ?? null;
        return Object.freeze({
            ...check,
            actual,
            status: actual === check.expected ? 'accepted' : 'rejected',
        });
    }));
    const limeFixtures = await new LimeCalibrationFixtureReader().read();
    const airLusi = await new AirLusiCalibrationFixtureReader().read();
    const model = new LimeCoefficientModel({
        fixtures: limeFixtures,
        basis,
        canonicalSolar,
    });
    const propagator = new LimeSpectralUncertaintyPropagator({
        model,
        fixtures: limeFixtures,
        basis,
    });
    const roloModel = new Rolo311gReferenceModel({ basis });
    const requests = Object.freeze(airLusi.flightIds.map((flightId, flightIndex) =>
        Object.freeze({
            id: 'air-lusi-flight-' + flightId,
            signedPhaseDegrees: airLusi.signedPhase[flightIndex],
            geometry: Object.freeze({
                absolutePhaseDegrees: Math.abs(airLusi.signedPhase[flightIndex]),
                sunSelenographicLongitudeRadians:
                    airLusi.subsolarLongitude[flightIndex] * Math.PI / 180,
                observerSelenographicLatitudeDegrees:
                    airLusi.subobserverLatitude[flightIndex],
                observerSelenographicLongitudeDegrees:
                    airLusi.subobserverLongitude[flightIndex],
            }),
            distanceCases: Object.freeze([REFERENCE_DISTANCE_CASE]),
            airLusiGeometryProvenance: Object.freeze({
                timestampUtc: airLusi.timestamps[flightIndex],
                subsolarLatitudeDegrees: airLusi.subsolarLatitude[flightIndex],
                measuredObserverMoonDistanceKilometers:
                    airLusi.observerMoonDistance[flightIndex],
                measuredSunMoonDistanceKilometers:
                    airLusi.sunMoonDistance[flightIndex],
                comparisonDistanceState:
                    'AIR-LUSI irradiance already standardized to 1 AU and 384400 km',
            }),
        })));
    const evaluations = Object.freeze(requests.map((request) => model.evaluate(request)));
    const propagations = Object.freeze({
        reflectance: propagator.propagate(evaluations, 'reflectance'),
        tsisReferenceIrradiance: propagator.propagate(
            evaluations,
            'tsis-reference-irradiance',
        ),
        canonicalSunEquivalentReflectance: propagator.propagate(
            evaluations,
            'canonical-sun-equivalent-reflectance',
        ),
    });
    const authorityVariants = propagator.evaluateAuthorityVariants(
        evaluations,
        'tsis-reference-irradiance',
    );
    const oracleCheck = checkInterpolationOracle(propagator);
    const measurements = buildAirLusiMeasurements(airLusi, basis);
    const centralAirLusiComparison = compareAirLusiBranch(
        RELEASE_BRANCH_ID,
        propagations.tsisReferenceIrradiance.centralValues,
        propagations.tsisReferenceIrradiance.standardUncertainty.relativeValues,
        measurements,
        basis.channels.length,
    );
    const authorityAssessments = Object.freeze(authorityVariants.branches.map((branch) =>
        compareAirLusiBranch(
            branch.id,
            branch.values,
            propagations.tsisReferenceIrradiance.standardUncertainty.relativeValues,
            measurements,
            basis.channels.length,
        )));
    const authoritySelection = selectAuthorityBranch(authorityAssessments);
    const roloEvaluations = Object.freeze(requests.map((request) =>
        roloModel.evaluate(request.geometry)));
    const roloBlueRows = Object.freeze(roloEvaluations.map((rolo, flightIndex) => {
        const outputIndex = flightIndex * basis.channels.length;
        const limeReflectance = propagations.canonicalSunEquivalentReflectance
            .centralValues[outputIndex];
        const roloReflectance = rolo.binnedReflectance.values[0];
        const residual = Math.abs(limeReflectance / roloReflectance - 1);
        return Object.freeze({
            flightIndex,
            flightId: airLusi.flightIds[flightIndex],
            timestampUtc: airLusi.timestamps[flightIndex],
            geometry: requests[flightIndex].geometry,
            channelIndex: 0,
            channel: basis.channels[0],
            limeCanonicalSunEquivalentReflectance: limeReflectance,
            limeRelativeStandardUncertainty:
                propagations.canonicalSunEquivalentReflectance
                    .standardUncertainty.relativeValues[outputIndex],
            rolo311gDiskEquivalentReflectance: roloReflectance,
            absoluteRelativeResidual: residual,
            tolerance: TOLERANCES.roloBlueRelative,
            status: residual <= TOLERANCES.roloBlueRelative ? 'accepted' : 'rejected',
            qualification:
                'Qualified independent model-reference comparison, not an SI-traceable measurement.',
            roloGeometryQualification: rolo.geometryQualification,
        });
    }));
    const roloBlueStatus = roloBlueRows.length === 4
        && roloBlueRows.every((row) => row.status === 'accepted')
        ? 'accepted'
        : 'rejected';

    const expectedReflectance = evaluations.flatMap((evaluation) =>
        evaluation.interpolation.executableLinear.canonicalChannels.map(
            (channel) => channel.value,
        ));
    const expectedTsisIrradiance = evaluations.flatMap((evaluation) =>
        evaluation.canonicalSolarCalibration
            .tsisLunarIrradianceAtReferenceDistances);
    const expectedEffectiveReflectance = evaluations.flatMap((evaluation) =>
        evaluation.canonicalSolarCalibration.effectiveCanonicalReflectance.map(
            (channel) => channel.value,
        ));
    const centralReconstruction = Object.freeze({
        reflectanceMaximumRelativeResidual: maximumRelativeDifference(
            propagations.reflectance.centralValues,
            expectedReflectance,
        ),
        tsisIrradianceMaximumRelativeResidual: maximumRelativeDifference(
            propagations.tsisReferenceIrradiance.centralValues,
            expectedTsisIrradiance,
        ),
        canonicalSunEquivalentReflectanceMaximumRelativeResidual:
            maximumRelativeDifference(
                propagations.canonicalSunEquivalentReflectance.centralValues,
                expectedEffectiveReflectance,
            ),
        tolerance: TOLERANCES.centralReconstructionRelative,
    });
    const tsisOutputOperators = propagator.createTsisReferenceOutputOperators();
    const conversionResiduals = propagations.tsisReferenceIrradiance.centralValues.map(
        (irradiance, outputIndex) => {
            const channelIndex = outputIndex % basis.channels.length;
            const reconstructed = propagations.canonicalSunEquivalentReflectance
                .centralValues[outputIndex] * canonicalSolar.values[channelIndex]
                * tsisOutputOperators.referenceSolidAngleOverPi;
            return Math.abs(irradiance - reconstructed)
                / Math.max(Math.abs(irradiance), Number.MIN_VALUE);
        },
    );
    const tsisEffectiveConversion = Object.freeze({
        equation:
            'I_TSIS = A_effective * E_canonical * Omega_reference / pi',
        maximumRelativeResidual: Math.max(...conversionResiduals),
        tolerance: TOLERANCES.tsisEffectiveConversionRelative,
    });
    const maximumJacobianScaledError = Math.max(...Object.values(propagations).map(
        (propagation) => propagation.diagnostics.maximumJacobianScaledError,
    ));
    const psdDiagnostics = covariancePsdDiagnostics(propagations);
    const covariancePass = covarianceDiagnosticsPass(propagations, psdDiagnostics);
    const correlationDiagnostics = propagations.reflectance.diagnostics
        .inputCorrelations;
    const correlationsPass = [
        correlationDiagnostics.coefficient,
        correlationDiagnostics.asdWavelength,
        correlationDiagnostics.asdPhase,
    ].every((diagnostic) =>
        diagnostic.maximumSymmetryResidual <= diagnostic.symmetryTolerance
        && diagnostic.maximumDiagonalResidual <= 1e-12);
    const reconstructionPass = Object.entries(centralReconstruction)
        .filter(([key]) => key.endsWith('Residual'))
        .every(([_key, value]) => value <= TOLERANCES.centralReconstructionRelative);
    const policy = model.describeExecutablePolicy();
    const payloadInspection = model.inspectPayload();
    const inheritedClassification = Object.freeze({
        record040: Object.freeze({
            sealedStatus: inherited.extendedSourceConservation.status,
            currentUse: 'inherited-analytic-extended-integration-evidence-only',
            distinctCollapsedPathClaimed: false,
            cameraMatrixConvergenceClaimed: false,
        }),
        record042: Object.freeze({
            sealedStatus: inherited.frozenAtmosphereCpu.status,
            currentUse: 'not-inherited-physically-rejected-on-later-evidence-review',
            reason:
                'The sealed runner directly adds point spectral irradiance to radiance-density terms without a normalized angular response conversion.',
        }),
        record044: Object.freeze({
            sealedStatus: inherited.stellarAndSolarPhysicalSource.status,
            currentUse: 'inherited-source-ownership-only',
            physicalReferenceClosureClaimed: false,
        }),
    });

    const criteria = [
        criterion(
            'mechanical',
            'retained-source-hashes-and-schemas-validate',
            retainedReferenceHashChecks.every((entry) => entry.status === 'accepted')
                ? 'accepted'
                : 'rejected',
            {
                lime: limeFixtures.provenance,
                airLusi: airLusi.provenance,
                rolo: roloModel.describe().provenance,
                retainedReferenceHashChecks,
            },
        ),
        criterion(
            'mechanical',
            'air-lusi-direct-grid-has-four-flights-and-fifty-six-comparisons',
            airLusi.flightIds.length === 4 && measurements.length === 56
                ? 'accepted'
                : 'rejected',
            {
                flightIds: airLusi.flightIds,
                comparisonCount: measurements.length,
                fullyCoveredChannelIndices: Object.freeze(
                    basis.channels.slice(1).map((_channel, index) => index + 1),
                ),
            },
        ),
        criterion(
            'mechanical',
            'air-lusi-full-versus-half-grid-numerical-residual-is-bounded',
            measurements.every((row) => row.numericalRelativeResidual
                <= TOLERANCES.airLusiNumericalIntegrationRelative)
                ? 'accepted'
                : 'rejected',
            {
                maximumRelativeResidual: Math.max(...measurements.map(
                    (row) => row.numericalRelativeResidual,
                )),
                tolerance: TOLERANCES.airLusiNumericalIntegrationRelative,
            },
        ),
        criterion(
            'modelAuthority',
            'release-changelog-and-native-payload-order-govern-central-model',
            policy.releaseAuthority.changelogIncludesCoordinateAndCoefficientSwap
                && policy.releaseAuthority.changelogIncludesOutputPreservation
                && policy.releaseAuthority.changelogIncludesSelectedCoefficientSet
                && payloadInspection.cRowConflict.status
                    === 'release-authority-resolved-atbd-table-label-inconsistency'
                ? 'accepted'
                : 'rejected',
            { policy, cRowResolution: payloadInspection.cRowConflict },
        ),
        criterion(
            'modelAuthority',
            'quadratic-and-cubic-weights-match-scipy-oracle',
            oracleCheck.status,
            oracleCheck,
        ),
        criterion(
            'modelAuthority',
            'four-authority-branches-follow-predeclared-selection-rule',
            authorityVariants.branches.length === 4
                && authoritySelection.status === 'accepted'
                ? 'accepted'
                : 'rejected',
            { authoritySelection, branchCount: authorityVariants.branches.length },
        ),
        criterion(
            'modelAuthority',
            'release-central-authority-branch-passes-direct-reference',
            centralAirLusiComparison.status,
            {
                status: centralAirLusiComparison.status,
                comparisonCount: centralAirLusiComparison.comparisonCount,
                maximumAbsoluteRelativeResidual:
                    centralAirLusiComparison.maximumAbsoluteRelativeResidual,
            },
        ),
        criterion(
            'correlatedUncertainty',
            'coefficient-and-asd-correlation-diagnostics-pass',
            correlationsPass ? 'accepted' : 'rejected',
            correlationDiagnostics,
        ),
        criterion(
            'correlatedUncertainty',
            'three-joint-sixty-by-sixty-covariances-are-symmetric-nonnegative-and-psd',
            covariancePass ? 'accepted' : 'rejected',
            {
                covarianceShape: Object.fromEntries(Object.entries(propagations).map(
                    ([id, propagation]) => [id, propagation.dimensions.covarianceShape],
                )),
                psdMethod: 'cyclic-symmetric-jacobi-eigenvalue-v1',
                psdTolerance:
                    'minimum eigenvalue >= -1e-10 * max(maximum diagonal, 1e-300)',
            },
        ),
        criterion(
            'correlatedUncertainty',
            'analytic-jacobians-match-finite-difference-checks',
            maximumJacobianScaledError <= TOLERANCES.jacobianScaledError
                ? 'accepted'
                : 'rejected',
            {
                maximumScaledError: maximumJacobianScaledError,
                tolerance: TOLERANCES.jacobianScaledError,
            },
        ),
        criterion(
            'correlatedUncertainty',
            'central-values-reconstruct-model-and-exact-tsis-transfer',
            reconstructionPass
                && tsisEffectiveConversion.maximumRelativeResidual
                    <= TOLERANCES.tsisEffectiveConversionRelative
                ? 'accepted'
                : 'rejected',
            { centralReconstruction, tsisEffectiveConversion },
        ),
        criterion(
            'independentReference',
            'fifty-six-air-lusi-si-traceable-channel-comparisons-pass',
            centralAirLusiComparison.status,
            {
                acceptedComparisonCount:
                    centralAirLusiComparison.acceptedComparisonCount,
                comparisonCount: centralAirLusiComparison.comparisonCount,
                maximumAbsoluteRelativeResidual:
                    centralAirLusiComparison.maximumAbsoluteRelativeResidual,
            },
        ),
        criterion(
            'independentReference',
            'four-rolo-blue-qualified-model-reference-comparisons-pass',
            roloBlueStatus,
            {
                acceptedComparisonCount: roloBlueRows.filter(
                    (row) => row.status === 'accepted',
                ).length,
                comparisonCount: roloBlueRows.length,
                tolerance: TOLERANCES.roloBlueRelative,
                qualification: 'not an SI-traceable measurement',
            },
        ),
        criterion(
            'physical',
            'prior-records-are-classified-without-overclaim-or-rerun',
            'accepted',
            inheritedClassification,
        ),
        criterion(
            'physical',
            'disk-integrated-lunar-physical-reference-is-accepted-without-overclaim',
            centralAirLusiComparison.status === 'accepted'
                && roloBlueStatus === 'accepted'
                ? 'accepted'
                : 'rejected',
            {
                claimedQuantity: 'disk-integrated spectral irradiance density',
                resolvedRadianceClaimed: false,
                observerVisibilityClaimed: false,
                gpuClaimed: false,
                productionClaimed: false,
            },
        ),
    ];
    const layerNames = Object.freeze([
        'mechanical',
        'modelAuthority',
        'correlatedUncertainty',
        'independentReference',
        'physical',
    ]);
    const layers = Object.freeze(Object.fromEntries(layerNames.map((layer) => [
        layer,
        statusForLayer(criteria, layer),
    ])));
    const lunarSliceStatus = Object.values(layers).every(
        (status) => status === 'accepted',
    )
        ? 'accepted'
        : 'rejected';
    const criteriaFrozen = Object.freeze(criteria);
    const gateDisposition = Object.freeze([
        Object.freeze({
            gate: 'XA-G01',
            status: [
                layers.mechanical,
                layers.modelAuthority,
                layers.correlatedUncertainty,
            ].every((status) => status === 'accepted')
                ? 'accepted'
                : 'rejected',
            claim:
                'LIME source identity, release semantics, exact geometry, distances, and correlated uncertainty are explicit.',
        }),
        Object.freeze({
            gate: 'XA-G02',
            status: 'not-claimed',
            claim:
                'AIR-LUSI geometry drives disk-integrated calibration; globe ephemeris integration is not rerun.',
        }),
        Object.freeze({
            gate: 'XA-G03..XA-G08',
            status: 'not-claimed-for-lunar-slice',
            claim:
                'Record 040 is analytic extended-integration evidence only; record 042 is physically rejected on later review; record 044 establishes source ownership only. No transport closure is inherited.',
        }),
        Object.freeze({
            gate: 'XA-G09',
            status: layers.independentReference,
            claim:
                'AIR-LUSI is the decisive SI-traceable reference for bins 2..15; ROLO is a qualified model complement for bin 1.',
        }),
        Object.freeze({
            gate: 'XA-G10',
            status: 'accepted',
            claim:
                'Mechanical, authority, uncertainty, independent-reference, physical, and overall statuses are separated.',
        }),
        Object.freeze({
            gate: 'XA-G11..XA-G12',
            status: 'not-applicable-later-phase',
            claim:
                'CPU convergence, GPU parity, observer scope, and production remain later phases after ER4C and ER5 closure.',
        }),
    ]);
    const result = Object.freeze({
        status: lunarSliceStatus,
        lunarPhysicalReferenceStatus: lunarSliceStatus,
        lunarSliceStatus,
        er5Status: 'still-open',
        er5ExitStatus: 'still-open-sun-sirius-and-er4c',
        layers,
        acceptedCriterionCount: criteriaFrozen.filter(
            (entry) => entry.status === 'accepted',
        ).length,
        criterionCount: criteriaFrozen.length,
        airLusiAcceptedComparisonCount:
            centralAirLusiComparison.acceptedComparisonCount,
        airLusiComparisonCount: centralAirLusiComparison.comparisonCount,
        roloBlueAcceptedComparisonCount: roloBlueRows.filter(
            (row) => row.status === 'accepted',
        ).length,
        roloBlueComparisonCount: roloBlueRows.length,
        authoritySelection,
        imageCount: 0,
        resolvedRadianceClaimed: false,
        observerVisibilityClaimed: false,
        gpuClaimed: false,
        productionClaimed: false,
        gateDisposition,
        nextPhase: lunarSliceStatus === 'accepted'
            ? 'Focused combined ER4C transport correction plus Sun/Sirius physical-reference closure.'
            : 'Preserve record 049 and diagnose one fresh lunar-slice correction record.',
    });
    const h5wasmPackage = JSON.parse(await readFile(
        resolve('node_modules/h5wasm/package.json'),
        'utf8',
    ));
    const provenance = Object.freeze({
        capturedAtUtc: nowIso(),
        git: await readGitContext(),
        runtime: Object.freeze({
            node: process.version,
            platform: process.platform,
            architecture: process.arch,
        }),
        sourceFiles,
        dependencies: Object.freeze({
            h5wasm: Object.freeze({
                name: h5wasmPackage.name,
                version: h5wasmPackage.version,
                repository: h5wasmPackage.repository,
                role: 'read retained NetCDF-4/HDF5 fixtures',
            }),
            interpolationOracle: Object.freeze({
                runtimeDependency: false,
                numpyVersion:
                    LIME_SCIPY_INTERPOLATION_WEIGHT_ORACLE.numpyVersion,
                scipyVersion:
                    LIME_SCIPY_INTERPOLATION_WEIGHT_ORACLE.scipyVersion,
                retainedSource:
                    EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.cometMathsInterpolation,
            }),
        }),
        retainedFixtures: Object.freeze({
            lime: limeFixtures.provenance,
            airLusi: airLusi.provenance,
            rolo: roloModel.describe().provenance,
        }),
        basis: basis.describe(),
        canonicalSolar: canonicalSolar.describe(),
        inheritedRecords: Object.freeze({
            sealedArtifacts: inherited,
            currentClassification: inheritedClassification,
        }),
    });
    const modelAuthorityArtifact = Object.freeze({
        policy,
        payloadInspection,
        interpolationOracle: oracleCheck,
        authorityVariants,
        airLusiAssessments: authorityAssessments,
        selection: authoritySelection,
        qualification:
            'AIR-LUSI tests branches but does not establish authorial intent; executable release authority resolves multiple passing branches.',
    });
    const asdCorrelationArtifact = Object.freeze({
        diagnostics: correlationDiagnostics,
        selectedPhases: selectedPhaseCorrelationArtifact(propagator, evaluations),
        coefficientAsdCrossCovariance: Object.freeze({
            availableInRelease: false,
            appliedCrossTerm: 0,
            qualification:
                'The retained official release publishes no coefficient-ASD cross-covariance.',
        }),
        modelAssistedRangeQualification:
            'Retained ASD uncertainty/correlation applies, but no per-sample Apollo replacement mask is published.',
    });
    const jointCovarianceArtifact = Object.freeze({
        dimensions: Object.freeze(Object.fromEntries(Object.entries(propagations).map(
            ([id, propagation]) => [id, propagation.dimensions],
        ))),
        reflectance: Object.freeze({
            centralBranch: propagations.reflectance.centralBranch,
            outputs: propagations.reflectance.outputs,
            centralValues: propagations.reflectance.centralValues,
            covariance: propagations.reflectance.covariance,
            correlation: propagations.reflectance.correlation,
        }),
        tsisReferenceIrradiance: Object.freeze({
            centralBranch: propagations.tsisReferenceIrradiance.centralBranch,
            outputs: propagations.tsisReferenceIrradiance.outputs,
            centralValues: propagations.tsisReferenceIrradiance.centralValues,
            covariance: propagations.tsisReferenceIrradiance.covariance,
            correlation: propagations.tsisReferenceIrradiance.correlation,
        }),
        canonicalSunEquivalentReflectance: Object.freeze({
            centralBranch: propagations.canonicalSunEquivalentReflectance.centralBranch,
            outputs: propagations.canonicalSunEquivalentReflectance.outputs,
            centralValues:
                propagations.canonicalSunEquivalentReflectance.centralValues,
            covariance: propagations.canonicalSunEquivalentReflectance.covariance,
            correlation: propagations.canonicalSunEquivalentReflectance.correlation,
        }),
        psdDiagnostics,
    });
    const uncertaintyBudgetArtifact = Object.freeze({
        componentConvention:
            'Total covariance is coefficient + ASD wavelength/phase + interpolation population ensemble + SRF-sign population covariance.',
        coefficientAsdCrossTerm: 0,
        reflectance: buildUncertaintyBudget(propagations.reflectance),
        tsisReferenceIrradiance:
            buildUncertaintyBudget(propagations.tsisReferenceIrradiance),
        canonicalSunEquivalentReflectance:
            buildUncertaintyBudget(propagations.canonicalSunEquivalentReflectance),
        diagnostics: Object.freeze({
            maximumJacobianScaledError,
            centralReconstruction,
            tsisEffectiveConversion,
            covariance: Object.freeze(Object.fromEntries(
                Object.entries(propagations).map(([id, propagation]) => [
                    id,
                    propagation.diagnostics.covariance,
                ]),
            )),
            psd: psdDiagnostics,
        }),
    });
    const interpolationArtifact = Object.freeze({
        scipyOracle: oracleCheck,
        covarianceConvention:
            'Globally coherent population ensemble over linear, quadratic-not-a-knot, and cubic-not-a-knot branches.',
        reflectance: propagations.reflectance.branchPredictions.interpolation,
        tsisReferenceIrradiance:
            propagations.tsisReferenceIrradiance.branchPredictions.interpolation,
        canonicalSunEquivalentReflectance:
            propagations.canonicalSunEquivalentReflectance
                .branchPredictions.interpolation,
        srfSignAlternatives: Object.freeze({
            reflectance: propagations.reflectance.branchPredictions.srfSign,
            tsisReferenceIrradiance:
                propagations.tsisReferenceIrradiance.branchPredictions.srfSign,
            canonicalSunEquivalentReflectance:
                propagations.canonicalSunEquivalentReflectance
                    .branchPredictions.srfSign,
        }),
    });
    const airLusiArtifact = Object.freeze({
        provenance: airLusi.provenance,
        schema: airLusi.schema,
        standardization: Object.freeze({
            sunMoonDistanceAstronomicalUnits: 1,
            observerMoonDistanceKilometers: 384400,
            inputUnits: 'microW m^-2 nm^-1',
            comparisonUnits: 'W m^-2 nm^-1',
        }),
        requests,
        centralReleaseComparison: centralAirLusiComparison,
        authorityBranchSummaries: Object.freeze(authorityAssessments.map((assessment) =>
            Object.freeze({
                id: assessment.id,
                status: assessment.status,
                acceptedComparisonCount: assessment.acceptedComparisonCount,
                comparisonCount: assessment.comparisonCount,
                maximumNumericalRelativeResidual:
                    assessment.maximumNumericalRelativeResidual,
                maximumAbsoluteRelativeResidual:
                    assessment.maximumAbsoluteRelativeResidual,
            }))),
        qualification:
            'Canonical bin 1 is excluded because AIR-LUSI covers only part of 360..391.333 nm.',
    });
    const roloArtifact = Object.freeze({
        descriptor: roloModel.describe(),
        channelIndex: 0,
        channel: basis.channels[0],
        rows: roloBlueRows,
        status: roloBlueStatus,
        tolerance: TOLERANCES.roloBlueRelative,
        qualification:
            'ROLO 311g complements AIR-LUSI in the blue bin as a qualified independent model reference, not an SI measurement.',
    });
    const report = [
        '# ER5 Lunar Physical Reference Calibration',
        '',
        'Lunar physical-reference slice status: **' + lunarSliceStatus + '**.',
        '',
        'ER5 exit status: **still-open-sun-sirius-and-er4c**.',
        '',
        '- Mechanical: **' + layers.mechanical + '**.',
        '- Model authority: **' + layers.modelAuthority + '**.',
        '- Correlated uncertainty: **' + layers.correlatedUncertainty + '**.',
        '- Independent reference: **' + layers.independentReference + '**.',
        '- Physical source-reference slice: **' + layers.physical + '**.',
        '- AIR-LUSI: ' + centralAirLusiComparison.acceptedComparisonCount + '/'
            + centralAirLusiComparison.comparisonCount + ' direct comparisons accepted.',
        '- ROLO blue complement: ' + roloBlueRows.filter(
            (row) => row.status === 'accepted',
        ).length + '/' + roloBlueRows.length + ' qualified comparisons accepted.',
        '- Authority branch selected: '
            + (authoritySelection.selectedBranchId ?? 'none') + ' via '
            + authoritySelection.rule + '.',
        '',
        'The central model is the versioned LIME v1.4.1 executable contract with native coefficient/covariance order, release-linear interpolation, release SRF sign, and nearest signed ASD phase. Quadratic/cubic interpolation and the ATBD SRF sign remain explicit model-form uncertainty branches.',
        '',
        'AIR-LUSI is the decisive SI-traceable disk-integrated irradiance reference for canonical bins 2..15. ROLO 311g is only a qualified model-reference complement for bin 1.',
        '',
        'Record 040 is retained only as analytic extended-integration evidence. Record 042 is not inherited because later review found its dimensional composition physically invalid. Record 044 establishes Sirius and Sun source ownership only. ER5 therefore remains open for focused ER4C transport correction and Sun/Sirius closure. No resolved-radiance, observer-visibility, GPU, or production claim is made.',
        '',
    ].join('\n');

    await writeJson(recordDirectory, 'provenance.json', provenance);
    await writeJson(recordDirectory, 'model-authority.json', modelAuthorityArtifact);
    await writeJson(
        recordDirectory,
        'asd-correlation-diagnostics.json',
        asdCorrelationArtifact,
    );
    await writeJson(
        recordDirectory,
        'joint-phase-channel-covariance.json',
        jointCovarianceArtifact,
    );
    await writeJson(
        recordDirectory,
        'canonical-uncertainty-budget.json',
        uncertaintyBudgetArtifact,
    );
    await writeJson(
        recordDirectory,
        'interpolation-method-ensemble.json',
        interpolationArtifact,
    );
    await writeJson(recordDirectory, 'air-lusi-comparison.json', airLusiArtifact);
    await writeJson(recordDirectory, 'rolo-blue-reference.json', roloArtifact);
    await writeJson(recordDirectory, 'criteria-results.json', {
        status: lunarSliceStatus,
        lunarSliceStatus,
        er5ExitStatus: 'still-open-sun-sirius-and-er4c',
        layers,
        criteria: criteriaFrozen,
    });
    await writeJson(recordDirectory, 'result.json', result);
    await writeText(
        recordDirectory,
        'state-goal.md',
        '# State Goal\n\n'
            + 'Accept the ER5 lunar source-reference slice only if release-authoritative '
            + 'LIME semantics, full correlated '
            + 'canonical uncertainty, direct AIR-LUSI measurements, and the qualified '
            + 'ROLO blue complement all pass their predeclared gates.\n',
    );
    await writeText(recordDirectory, 'report.md', report);
    await appendRunLog(
        recordDirectory,
        'er5LunarPhysicalReferenceCalibration lunar-slice-' + lunarSliceStatus
            + '; ' + centralAirLusiComparison.acceptedComparisonCount + '/'
            + centralAirLusiComparison.comparisonCount
            + ' AIR-LUSI and '
            + roloBlueRows.filter((row) => row.status === 'accepted').length + '/'
            + roloBlueRows.length + ' ROLO-blue comparisons accepted.',
    );
    console.log(JSON.stringify({
        status: lunarSliceStatus,
        lunarPhysicalReferenceStatus: lunarSliceStatus,
        lunarSliceStatus,
        er5Status: 'still-open',
        er5ExitStatus: 'still-open-sun-sirius-and-er4c',
        layers,
        recordDirectory,
        nextPhase: result.nextPhase,
    }));
} catch (error) {
    await writeJson(recordDirectory, 'failure.json', {
        status: 'invalid',
        capturedAtUtc: nowIso(),
        error: {
            name: error.name,
            message: error.message,
            code: error.code ?? null,
            stack: error.stack ?? null,
        },
    });
    await writeJson(recordDirectory, 'result.json', {
        status: 'invalid',
        lunarPhysicalReferenceStatus: 'invalid',
        lunarSliceStatus: 'invalid',
        er5Status: 'still-open',
        er5ExitStatus: 'still-open-sun-sirius-and-er4c',
        layers: {
            mechanical: 'invalid',
            modelAuthority: 'not-evaluated',
            correlatedUncertainty: 'not-evaluated',
            independentReference: 'not-evaluated',
            physical: 'not-evaluated',
        },
        imageCount: 0,
        resolvedRadianceClaimed: false,
        observerVisibilityClaimed: false,
        gpuClaimed: false,
        productionClaimed: false,
        nextPhase:
            'Preserve invalid record 049 and route any correction to fresh record 050.',
    });
    await appendRunLog(
        recordDirectory,
        'er5LunarPhysicalReferenceCalibration invalid; preserve record 049.',
    );
    throw error;
}
