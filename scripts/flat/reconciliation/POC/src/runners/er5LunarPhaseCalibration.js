import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createCanonicalSpectralDensityBasis } from '../external-celestial-sources/createCanonicalSpectralDensityBasis.js';
import { createCanonicalSolarIrradianceDensity } from '../external-celestial-sources/createCanonicalSolarIrradianceDensity.js';
import { EXTERNAL_CELESTIAL_FIXTURE_MANIFEST } from '../external-celestial-sources/fixtureManifest.js';
import LimeCalibrationFixtureReader from '../external-celestial-sources/LimeCalibrationFixtureReader.js';
import LimeCoefficientModel from '../external-celestial-sources/LimeCoefficientModel.js';
import {
    appendRunLog,
    createFreshRecordDirectory,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const RUNNER_PATH =
    'scripts/flat/reconciliation/POC/src/runners/er5LunarPhaseCalibration.js';
const EXPECTED_RECORD =
    'tmp/atmosphere/reconciliation/048-er5-lunar-coefficient-calibration';
const RUN_COMMAND =
    'node ' + RUNNER_PATH + ' --record ' + EXPECTED_RECORD;
const PHASES_DEGREES = Object.freeze([0, 30, 60, 85]);
const ZERO_LIBRATION = Object.freeze({
    sunSelenographicLongitudeRadians: 0,
    observerSelenographicLatitudeDegrees: 0,
    observerSelenographicLongitudeDegrees: 0,
});
const NONZERO_LIBRATION_DIAGNOSTIC = Object.freeze({
    absolutePhaseDegrees: 50,
    sunSelenographicLongitudeRadians: 1,
    observerSelenographicLatitudeDegrees: 40,
    observerSelenographicLongitudeDegrees: 30,
});
const DISTANCE_CASES = Object.freeze([
    Object.freeze({
        id: 'lime-reference-distances',
        sunMoonDistanceAstronomicalUnits: 1,
        observerMoonDistanceKilometers: 384400,
    }),
    Object.freeze({
        id: 'sun-moon-distance-control-0p99-au',
        sunMoonDistanceAstronomicalUnits: 0.99,
        observerMoonDistanceKilometers: 384400,
    }),
    Object.freeze({
        id: 'observer-moon-distance-control-360000-km',
        sunMoonDistanceAstronomicalUnits: 1,
        observerMoonDistanceKilometers: 360000,
    }),
]);
const TOLERANCES = Object.freeze({
    coefficientTableDisplayedPrecision: Object.freeze({
        ordinaryAbsolute: 5.1e-7,
        cRowAbsolute: 5.1e-8,
    }),
    coefficientCorrelationSymmetryAbsolute: 1e-12,
    coefficientCorrelationDiagonalAbsolute: 1e-12,
    zeroLibrationInterpretationRelative: 1e-14,
    correctedAnchorReconstructionRelative: 1e-12,
    distanceLawRelative: 1e-12,
});
const SOURCE_PATHS = Object.freeze([
    RUNNER_PATH,
    'scripts/flat/reconciliation/POC/src/runners/recordWriter.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/LimeCalibrationFixtureReader.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/LimeCoefficientModel.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/ZipArchiveReader.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtureManifest.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/consts.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/createCanonicalSpectralDensityBasis.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/SpectralDensityBasis.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/createCanonicalSolarIrradianceDensity.js',
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/SpectralDensityPacket.js',
    'scripts/flat/reconciliation/POC/src/constants/consts.js',
    'scripts/flat/reconciliation/POC/src/provenance/stableHash.js',
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

async function readGitContext() {
    try {
        const head = (await readFile(resolve('.git/HEAD'), 'utf8')).trim();
        if (!head.startsWith('ref: ')) {
            return Object.freeze({
                head,
                revision: head,
                workingTreeStatus:
                    'not invoked in managed runner; exact source-file hashes govern identity',
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
                'not invoked in managed runner; exact source-file hashes govern identity',
        });
    } catch (error) {
        return Object.freeze({
            head: null,
            revision: null,
            error: error.message,
            workingTreeStatus:
                'not invoked in managed runner; exact source-file hashes govern identity',
        });
    }
}

function maximumAbsolute(values) {
    return Math.max(...values.map(Math.abs));
}

function maximumRelativePairDifference(left, right) {
    return Math.max(...left.map((value, index) =>
        Math.abs(value - right[index]) / Math.max(Math.abs(right[index]), Number.MIN_VALUE)));
}

function criterion(name, status, evidence) {
    return Object.freeze({ name, status, evidence });
}

function lambertPhaseFactor(degrees) {
    const radians = degrees * Math.PI / 180;
    return (Math.sin(radians) + (Math.PI - radians) * Math.cos(radians)) / Math.PI;
}

function selectedAsdArtifact(evaluation) {
    return Object.freeze({
        requestId: evaluation.request.id,
        requestedSignedPhaseDegrees: evaluation.asd.requestedSignedPhaseDegrees,
        selectedSignedPhaseDegrees: evaluation.asd.selectedSignedPhaseDegrees,
        phaseIndex: evaluation.asd.phaseIndex,
        wavelengthsNanometers: evaluation.asd.wavelengthsNanometers,
        reflectance: evaluation.asd.reflectance,
        relativeUncertaintyPercent: evaluation.asd.relativeUncertaintyPercent,
    });
}

function spectralPredictionArtifact(evaluation) {
    return Object.freeze({
        request: evaluation.request,
        anchorEvaluation: evaluation.anchorEvaluation,
        responseCorrection: evaluation.correction,
        interpolation: evaluation.interpolation,
    });
}

function interpolationConflictSummary(evaluations) {
    return Object.freeze(evaluations.map((evaluation) => {
        const differences = evaluation.interpolation.canonicalChannelComparison
            .map((channel) => channel.relativeDifference);
        return Object.freeze({
            requestId: evaluation.request.id,
            signedPhaseDegrees: evaluation.request.signedPhaseDegrees,
            maximumAbsoluteCanonicalRelativeDifference: maximumAbsolute(differences),
            channels: evaluation.interpolation.canonicalChannelComparison,
        });
    }));
}

function anchorReconstructionResidual(evaluation) {
    const spectrum = evaluation.interpolation.executableLinear.spectrum;
    return Math.max(...evaluation.correction.rows.map((anchor) => {
        const index = spectrum.wavelengthsNanometers.indexOf(anchor.wavelengthNanometers);
        const reconstructed = spectrum.reflectance[index];
        return Math.abs(reconstructed - anchor.correctedReflectance)
            / anchor.correctedReflectance;
    }));
}

function distanceLawResidual(evaluation) {
    const reference = evaluation.distanceCases[0];
    const residuals = evaluation.distanceCases.slice(1).flatMap((distanceCase) => {
        const expectedRatio = distanceCase.canonicalSun.distanceFactor
            / reference.canonicalSun.distanceFactor;
        return distanceCase.canonicalSun.values.map((value, index) => {
            const actualRatio = value / reference.canonicalSun.values[index];
            return Math.abs(actualRatio - expectedRatio) / expectedRatio;
        });
    });
    return Math.max(...residuals);
}

function buildLambertComparison(evaluations) {
    const baseline = evaluations[0]
        .interpolation.executableLinear.canonicalChannels.map((channel) => channel.value);
    return Object.freeze(evaluations.map((evaluation) => {
        const reflectance = evaluation.interpolation.executableLinear.canonicalChannels
            .map((channel) => channel.value);
        const limeFactors = reflectance.map((value, index) => value / baseline[index]);
        const lambert = lambertPhaseFactor(evaluation.request.geometry.absolutePhaseDegrees);
        return Object.freeze({
            requestId: evaluation.request.id,
            absolutePhaseDegrees: evaluation.request.geometry.absolutePhaseDegrees,
            lambertPhaseFactor: lambert,
            limeCanonicalPhaseFactors: Object.freeze(limeFactors),
            limeMinusLambert: Object.freeze(limeFactors.map((value) => value - lambert)),
            qualification:
                'Lambert is an analytic conservation scaffold, not an acceptance target for LIME.',
        });
    }));
}

const recordDirectory = parseRecordDirectory(process.argv);
if (recordDirectory.replaceAll('\\', '/') !== EXPECTED_RECORD) {
    throw new Error('Record 048 must use the predeclared directory ' + EXPECTED_RECORD + '.');
}
await createFreshRecordDirectory(recordDirectory);
const startedAtUtc = nowIso();

try {
    const basis = createCanonicalSpectralDensityBasis();
    const canonicalSolar = createCanonicalSolarIrradianceDensity(basis);
    const fixtureReader = new LimeCalibrationFixtureReader();
    const fixtures = await fixtureReader.read();
    const model = new LimeCoefficientModel({ fixtures, basis, canonicalSolar });
    const payloadInspection = model.inspectPayload();
    const requests = PHASES_DEGREES.map((phase) => Object.freeze({
        id: 'zero-libration-phase-' + String(phase).padStart(2, '0') + '-degrees',
        signedPhaseDegrees: phase,
        geometry: Object.freeze({
            absolutePhaseDegrees: phase,
            ...ZERO_LIBRATION,
        }),
        distanceCases: DISTANCE_CASES,
    }));
    const evaluations = requests.map((request) => model.evaluate(request));
    const zeroLibrationOrderChecks = requests.map((request) =>
        model.evaluateLibrationConflict(request.geometry));
    const librationConflict = model.evaluateLibrationConflict(
        NONZERO_LIBRATION_DIAGNOSTIC,
    );
    const solarTransfer = model.describeSolarTransfer();
    const lambertComparison = buildLambertComparison(evaluations);
    const interpolationConflict = interpolationConflictSummary(evaluations);
    const maximumCOrderConflict = maximumAbsolute(
        librationConflict.relativeDifferences.map((row) => row.relativeDifference),
    );
    const maximumInterpolationConflict = Math.max(...interpolationConflict.map(
        (row) => row.maximumAbsoluteCanonicalRelativeDifference,
    ));
    const maximumZeroLibrationOrderResidual = Math.max(...zeroLibrationOrderChecks.map(
        (check) => maximumRelativePairDifference(
            check.executableInterpretation.anchors.map((anchor) => anchor.reflectance),
            check.atbdInterpretation.anchors.map((anchor) => anchor.reflectance),
        ),
    ));
    const maximumAnchorResidual = Math.max(...evaluations.map(anchorReconstructionResidual));
    const maximumDistanceResidual = Math.max(...evaluations.map(distanceLawResidual));
    const maximumSolarTransfer = maximumAbsolute(
        solarTransfer.channels.map((channel) => channel.relativeDifference),
    );
    const rowTableChecksPass = payloadInspection.rowComparisons.every(
        (row) => row.maxAbsoluteDifference <= row.displayedPrecisionTolerance,
    );
    const allPredictionsPositive = evaluations.every((evaluation) =>
        evaluation.interpolation.executableLinear.canonicalChannels.every(
            (channel) => Number.isFinite(channel.value) && channel.value > 0,
        )
        && evaluation.distanceCases.every((distanceCase) =>
            distanceCase.canonicalSun.values.every(
                (value) => Number.isFinite(value) && value > 0,
            )));

    const criteria = Object.freeze([
        criterion(
            'retained-lime-payload-hashes-match-manifest',
            'accepted',
            fixtures.provenance,
        ),
        criterion(
            'coefficient-version-is-explicit-20251010-v1',
            payloadInspection.derivedModelId === '20251010_v1' ? 'accepted' : 'rejected',
            {
                derivedModelId: payloadInspection.derivedModelId,
                referenceModelExportValue:
                    'LIME coefficients version: ' + payloadInspection.derivedModelId,
                qualification:
                    'reference_model is an exported result attribute, not a coefficient-file attribute.',
            },
        ),
        criterion(
            'coefficient-and-asd-netcdf-schemas-are-parsed',
            (
                fixtures.coefficients.coefficients.values.length === 108
                && fixtures.coefficients.errorCorrelation.values.length === 11664
                && fixtures.asd.reflectance.values.length === 2151 * 180
                && fixtures.asd.relativeUncertaintyPercent.values.length === 2151 * 180
            ) ? 'accepted' : 'rejected',
            {
                coefficientShapes: payloadInspection.datasetShapes,
                asdShapes: {
                    reflectance: fixtures.asd.reflectance.shape,
                    relativeUncertaintyPercent:
                        fixtures.asd.relativeUncertaintyPercent.shape,
                    wavelengthCorrelation: fixtures.asd.wavelengthCorrelation.shape,
                    phaseCorrelation: fixtures.asd.phaseCorrelation.shape,
                },
            },
        ),
        criterion(
            'payload-rows-match-atbd-table-values-at-displayed-precision',
            rowTableChecksPass ? 'accepted' : 'rejected',
            payloadInspection.rowComparisons,
        ),
        criterion(
            'coefficient-correlation-is-finite-symmetric-and-unit-diagonal',
            (
                payloadInspection.coefficientCorrelation.finiteEntryCount === 11664
                && payloadInspection.coefficientCorrelation.maximumSymmetryResidual
                    <= TOLERANCES.coefficientCorrelationSymmetryAbsolute
                && payloadInspection.coefficientCorrelation.maximumDiagonalResidual
                    <= TOLERANCES.coefficientCorrelationDiagonalAbsolute
            ) ? 'accepted' : 'rejected',
            payloadInspection.coefficientCorrelation,
        ),
        criterion(
            'zero-libration-central-phase-prediction-is-order-independent',
            maximumZeroLibrationOrderResidual
                <= TOLERANCES.zeroLibrationInterpretationRelative
                ? 'accepted'
                : 'rejected',
            {
                maximumRelativeResidual: maximumZeroLibrationOrderResidual,
                tolerance: TOLERANCES.zeroLibrationInterpretationRelative,
            },
        ),
        criterion(
            'linear-spectral-route-reconstructs-corrected-anchors',
            maximumAnchorResidual <= TOLERANCES.correctedAnchorReconstructionRelative
                ? 'accepted'
                : 'rejected',
            {
                maximumRelativeResidual: maximumAnchorResidual,
                tolerance: TOLERANCES.correctedAnchorReconstructionRelative,
            },
        ),
        criterion(
            'canonical-15-channel-predictions-are-finite-positive',
            allPredictionsPositive ? 'accepted' : 'rejected',
            {
                phaseCount: evaluations.length,
                channelCount: basis.channels.length,
            },
        ),
        criterion(
            'sun-moon-and-observer-moon-distance-law-is-explicit-inverse-square',
            maximumDistanceResidual <= TOLERANCES.distanceLawRelative
                ? 'accepted'
                : 'rejected',
            {
                maximumRelativeResidual: maximumDistanceResidual,
                tolerance: TOLERANCES.distanceLawRelative,
                cases: DISTANCE_CASES,
            },
        ),
        criterion(
            'canonical-sun-remains-the-sole-runtime-owner',
            canonicalSolar.provenance.runtimeOwner
                === EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.canonicalSolar.runtimeOwner
                ? 'accepted'
                : 'rejected',
            {
                canonicalFingerprint: canonicalSolar.fingerprint,
                maximumAbsoluteTsisTransferDifference: maximumSolarTransfer,
                qualification: solarTransfer.qualification,
            },
        ),
        criterion(
            'lambert-reference-remains-comparison-only',
            'accepted',
            {
                phaseFactors: lambertComparison,
                sourceSpecificExposureApplied: false,
            },
        ),
        criterion(
            'resolved-radiance-is-not-claimed-from-disk-integrated-lime',
            'accepted',
            {
                claimedQuantity: 'disk-integrated spectral irradiance density',
                resolvedDiskProfile: 'not supplied by LIME and not claimed by record 048',
            },
        ),
        criterion(
            'general-libration-coefficient-order-is-authoritatively-unambiguous',
            'explicitly-deferred',
            {
                conflict: payloadInspection.cRowConflict,
                maximumRelativePredictionDifference: maximumCOrderConflict,
            },
        ),
        criterion(
            'hyperspectral-interpolation-convention-is-authoritatively-unambiguous',
            'explicitly-deferred',
            {
                releasedExecutable: 'linear ASD and residual interpolation',
                atbdText: 'cubic-spline ASD and residual interpolation',
                maximumAbsoluteCanonicalRelativeDifference:
                    maximumInterpolationConflict,
            },
        ),
        criterion(
            'canonical-channel-uncertainty-propagates-coefficient-and-asd-correlation',
            'explicitly-deferred',
            {
                acceptedNow:
                    'full coefficient covariance propagated to six anchors; ASD uncertainties and both source correlation matrices retained',
                missing:
                    'deterministic joint coefficient/ASD/interpolation propagation into canonical channels',
            },
        ),
        criterion(
            'xa-g09-independent-general-lunar-physical-reference',
            'explicitly-deferred',
            {
                reason:
                    'LIME is the selected external model, but no independent lunar benchmark distinct from LIME resolves the model-definition conflicts.',
            },
        ),
    ]);
    const mechanicalCriteria = criteria.slice(0, 12);
    const mechanicalStatus = mechanicalCriteria.every(
        (entry) => entry.status === 'accepted',
    ) ? 'accepted' : 'rejected';
    const physicalReferenceStatus = 'explicitly-deferred';
    const overallLunarCalibrationStatus = mechanicalStatus === 'accepted'
        ? 'explicitly-deferred'
        : 'rejected';
    const status = overallLunarCalibrationStatus;
    const gateDisposition = Object.freeze([
        Object.freeze({
            gate: 'XA-G01',
            status: mechanicalStatus,
            claim:
                'Parsed dimensionless disk-equivalent reflectance and derived W m^-2 nm^-1 disk irradiance with exact retained provenance.',
        }),
        Object.freeze({
            gate: 'XA-G02',
            status: 'not-claimed',
            claim:
                'Controlled geometry only; accepted globe ephemeris is unchanged and not rerun.',
        }),
        Object.freeze({
            gate: 'XA-G03..XA-G08',
            status: 'inherited-not-rerun',
            claim:
                'Records 040, 042, and 044 own raster, conservation, transport, depth, and display evidence.',
        }),
        Object.freeze({
            gate: 'XA-G09',
            status: physicalReferenceStatus,
            claim: 'General lunar physical-reference acceptance remains open.',
        }),
        Object.freeze({
            gate: 'XA-G10',
            status: 'accepted',
            claim:
                'Mechanical, bounded central prediction, physical-reference, review, and overall statuses are separated.',
        }),
        Object.freeze({
            gate: 'XA-G11..XA-G12',
            status: 'not-applicable-blocked',
            claim: 'CPU convergence and GPU parity remain later reset phases.',
        }),
    ]);
    const boundedCentralPredictionStatus = mechanicalStatus;
    const result = Object.freeze({
        status,
        er5Status: status,
        mechanicalStatus,
        boundedCentralPredictionStatus,
        physicalReferenceStatus,
        overallLunarCalibrationStatus,
        acceptedCriterionCount: criteria.filter(
            (entry) => entry.status === 'accepted',
        ).length,
        explicitlyDeferredCriterionCount: criteria.filter(
            (entry) => entry.status === 'explicitly-deferred',
        ).length,
        criterionCount: criteria.length,
        imageCount: 0,
        claimedPhase: 'ER5 physical lunar source calibration',
        gateDisposition,
        nextPhase:
            'ER5 remains active; resolve LIME model-definition authority or select an independent lunar reference before fresh record 049.',
    });
    const h5wasmPackage = JSON.parse(await readFile(
        resolve('node_modules/h5wasm/package.json'),
        'utf8',
    ));
    const provenance = Object.freeze({
        capturedAtUtc: nowIso(),
        git: await readGitContext(),
        sourceFiles: await describeFiles(SOURCE_PATHS),
        dependency: Object.freeze({
            name: h5wasmPackage.name,
            version: h5wasmPackage.version,
            repository: h5wasmPackage.repository,
            role: 'read retained NetCDF-4/HDF5 bytes through the HDF5 C API',
        }),
        retainedFixtures: fixtures.provenance,
        releaseEntries: Object.freeze(Object.fromEntries(
            Object.entries(fixtures.entries).map(([id, entry]) => [
                id,
                {
                    name: entry.name,
                    byteLength: entry.byteLength,
                    sourceHashSha256: entry.sourceHashSha256,
                },
            ]),
        )),
        basis: basis.describe(),
        canonicalSolar: canonicalSolar.describe(),
    });
    const inputs = Object.freeze({
        stage: 'ER5-lunar-coefficient-calibration',
        record: '048',
        goal:
            'Parse retained LIME coefficients into a documented canonical spectral/phase prediction and decide the lunar physical-reference gate.',
        candidate: EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.limeLunarCandidate,
        requests,
        nonzeroLibrationDiagnostic: NONZERO_LIBRATION_DIAGNOSTIC,
        interpolationComparison: Object.freeze({
            primary:
                'Retained LIME-TBX v1.4.1 linear ASD/residual interpolation with constant residual extrapolation.',
            diagnostic:
                'Natural cubic residual interpolation as a bounded implementation of ATBD v3.3 cubic-spline wording.',
            acceptanceRule:
                'Report the difference; do not silently choose either as the unique general model.',
        }),
        tolerances: TOLERANCES,
        stopConditions: Object.freeze([
            'Reject mechanical status on any hash, schema, table-value, covariance, positivity, anchor, or distance-law failure.',
            'Explicitly defer general calibration if coefficient naming or interpolation authority remains ambiguous.',
            'Explicitly defer XA-G09 without a distinct independent lunar physical benchmark.',
            'Do not claim resolved lunar radiance, observer visibility, ER6, GPU, or production.',
        ]),
        claimedGates: Object.freeze(['XA-G01', 'XA-G09', 'XA-G10']),
    });
    const coefficientPayload = Object.freeze({
        inspection: payloadInspection,
        wavelengthsNanometers: fixtures.coefficients.wavelength.values,
        coefficients: fixtures.coefficients.coefficients,
        relativeUncertaintyPercent:
            fixtures.coefficients.relativeUncertaintyPercent,
        errorCorrelation: fixtures.coefficients.errorCorrelation,
    });
    const selectedAsd = Object.freeze({
        source: {
            provenance: fixtures.provenance.asd,
            attributes: fixtures.asd.attributes,
            wavelengthDataset: {
                shape: fixtures.asd.wavelength.shape,
                dtype: fixtures.asd.wavelength.dtype,
            },
            phaseDataset: {
                shape: fixtures.asd.phaseAngle.shape,
                dtype: fixtures.asd.phaseAngle.dtype,
                values: fixtures.asd.phaseAngle.values,
            },
            reflectanceDataset: {
                shape: fixtures.asd.reflectance.shape,
                dtype: fixtures.asd.reflectance.dtype,
                attributes: fixtures.asd.reflectance.attributes,
            },
            relativeUncertaintyDataset: {
                shape: fixtures.asd.relativeUncertaintyPercent.shape,
                dtype: fixtures.asd.relativeUncertaintyPercent.dtype,
                attributes: fixtures.asd.relativeUncertaintyPercent.attributes,
            },
            wavelengthCorrelation: fixtures.asd.wavelengthCorrelation,
            phaseCorrelation: fixtures.asd.phaseCorrelation,
        },
        selectedSpectra: Object.freeze(evaluations.map(selectedAsdArtifact)),
    });
    const lunarIrradiance = Object.freeze({
        quantity: 'disk-integrated spectral irradiance density',
        units: 'W m^-2 nm^-1',
        equation:
            'I_lambda = A_lambda * Omega_ref * E_lambda / pi * d_sun_moon^-2 * (384400 km / d_observer_moon)^2',
        solarTransfer,
        phaseDistancePredictions: Object.freeze(evaluations.map((evaluation) =>
            Object.freeze({
                requestId: evaluation.request.id,
                signedPhaseDegrees: evaluation.request.signedPhaseDegrees,
                distanceCases: evaluation.distanceCases,
            }))),
        resolvedRadianceQualification:
            'LIME is disk-integrated; no resolved disk radiance profile or BRDF map is inferred.',
    });
    const uncertaintyQualifications = Object.freeze({
        coefficient: Object.freeze({
            sourceMeaning:
                'u_coeff is signed relative standard uncertainty percent; absolute sigma equals u_coeff*coeff/100.',
            fullErrorCorrelationRetained: true,
            anchorResults: Object.freeze(evaluations.map((evaluation) =>
                Object.freeze({
                    requestId: evaluation.request.id,
                    uncertainty: evaluation.anchorEvaluation.uncertainty,
                }))),
        }),
        asd: Object.freeze({
            relativeUncertaintyRowsRetainedForSelectedPhases: true,
            wavelengthCorrelationRetainedByHashedSourceAndSchema: true,
            phaseCorrelationRetainedByHashedSourceAndSchema: true,
            modelAssistedRangesNanometers:
                '300..400, 680..690, 713..740, 757..769, 809..840, 890..1000, 1080..1230, 1295..1540, 1700..2080, 2345..2500',
            qualification:
                'Final ASD payload has no mask variable for phase-specific outliers replaced by Apollo-scaled reference data.',
        }),
        solarTransfer: Object.freeze({
            kind: 'deterministic-reference-standard-substitution',
            maximumAbsoluteRelativeDifference: maximumSolarTransfer,
        }),
        canonicalChannelStatus: 'explicitly-deferred',
        missing:
            'Joint deterministic propagation of coefficient covariance, ASD wavelength/phase correlation, and interpolation-method uncertainty.',
    });
    const ambiguityDiagnostics = Object.freeze({
        cRowOrder: Object.freeze({
            payloadInspection: payloadInspection.cRowConflict,
            nonzeroLibration: librationConflict,
            zeroLibrationChecks: zeroLibrationOrderChecks,
            maximumNonzeroRelativeDifference: maximumCOrderConflict,
        }),
        interpolation: Object.freeze({
            comparisons: interpolationConflict,
            maximumAbsoluteCanonicalRelativeDifference:
                maximumInterpolationConflict,
        }),
        lambertComparison,
    });
    const report = [
        '# ER5 Lunar Coefficient Calibration',
        '',
        'Overall lunar calibration status: **' + overallLunarCalibrationStatus + '**',
        '',
        '- Mechanical coefficient parsing: **' + mechanicalStatus + '**.',
        '- Bounded zero-libration central prediction: **'
            + boundedCentralPredictionStatus + '** with named qualifications.',
        '- Physical-reference/XA-G09 status: **' + physicalReferenceStatus + '**.',
        '- Criteria: ' + result.acceptedCriterionCount + ' accepted, '
            + result.explicitlyDeferredCriterionCount + ' explicitly deferred, '
            + result.criterionCount + ' total.',
        '',
        'The retained 20251010_v1 coefficient and ASD v2.0.0 payloads were parsed and mapped to all 15 canonical bins. The canonical Sun remains the only runtime irradiance owner; the TSIS-1 difference is retained as a deterministic reference-standard transfer.',
        '',
        'General calibration remains deferred because the payload c rows match ATBD Table 2 in a different order than the released positional evaluator, the ATBD describes cubic spectral interpolation while v1.4.1 executes linear interpolation, joint canonical-channel uncertainty is incomplete, and no independent lunar benchmark distinct from LIME resolves those conflicts.',
        '',
        'Lambert results remain a conservation scaffold only. No resolved-radiance, observer-visibility, ER6, GPU, or production claim is made.',
        '',
    ].join('\n');
    const command = Object.freeze({
        startedAtUtc,
        commands: Object.freeze([
            Object.freeze({
                command: RUN_COMMAND,
                role: 'single immutable record-048 execution',
            }),
        ]),
        predeclaredPostRunVerificationCommands: Object.freeze([
            'node --check ' + RUNNER_PATH,
            'npm run build',
            'git diff --check',
        ]),
    });

    await writeJson(recordDirectory, 'inputs.json', inputs);
    await writeJson(recordDirectory, 'command.json', command);
    await writeJson(recordDirectory, 'provenance.json', provenance);
    await writeJson(recordDirectory, 'coefficient-payload.json', coefficientPayload);
    await writeJson(recordDirectory, 'selected-asd-spectra.json', selectedAsd);
    await writeJson(
        recordDirectory,
        'lunar-spectral-predictions.json',
        Object.freeze(evaluations.map(spectralPredictionArtifact)),
    );
    await writeJson(recordDirectory, 'lunar-irradiance.json', lunarIrradiance);
    await writeJson(recordDirectory, 'ambiguity-diagnostics.json', ambiguityDiagnostics);
    await writeJson(
        recordDirectory,
        'uncertainty-qualifications.json',
        uncertaintyQualifications,
    );
    await writeJson(recordDirectory, 'criteria-results.json', { status, criteria });
    await writeJson(recordDirectory, 'result.json', result);
    await writeText(
        recordDirectory,
        'state-goal.md',
        '# State Goal\n\n'
            + 'Evaluate the retained LIME coefficient model independently in the canonical '
            + '15-channel basis, retain every material qualification, and decide whether '
            + 'ER5 lunar physical-reference calibration can exit.\n',
    );
    await writeText(recordDirectory, 'report.md', report);
    await appendRunLog(
        recordDirectory,
        'er5LunarPhaseCalibration ' + status
            + '; mechanical coefficient parsing accepted, general XA-G09 lunar calibration deferred.',
    );
    console.log(JSON.stringify({
        status,
        er5Status: status,
        mechanicalStatus,
        physicalReferenceStatus,
        recordDirectory,
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
        er5Status: 'invalid',
        mechanicalStatus: 'invalid',
        physicalReferenceStatus: 'not-evaluated',
        overallLunarCalibrationStatus: 'invalid',
        nextPhase:
            'Preserve record 048 and diagnose the correction in fresh record 049.',
    });
    await appendRunLog(
        recordDirectory,
        'er5LunarPhaseCalibration invalid; preserve record and route correction to record 049.',
    );
    throw error;
}
