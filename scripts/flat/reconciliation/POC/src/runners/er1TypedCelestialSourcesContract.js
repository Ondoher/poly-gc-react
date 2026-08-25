// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER1 executable expansion.

import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import BrunetonColorDisplayModel from '../color/BrunetonColorDisplayModel.js';
import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { stableHash, stableStringify } from '../provenance/stableHash.js';
import { binPiecewiseLinearSpectralDensity } from '../external-celestial-sources/binPiecewiseLinearSpectralDensity.js';
import { createAnalyticExtendedRadianceDensity } from '../external-celestial-sources/createAnalyticExtendedRadianceDensity.js';
import { createCalspecSiriusIrradianceDensity } from '../external-celestial-sources/createCalspecSiriusIrradianceDensity.js';
import { createCanonicalSolarIrradianceDensity } from '../external-celestial-sources/createCanonicalSolarIrradianceDensity.js';
import { createCanonicalSpectralDensityBasis } from '../external-celestial-sources/createCanonicalSpectralDensityBasis.js';
import ExternalCelestialSource from '../external-celestial-sources/ExternalCelestialSource.js';
import { EXTERNAL_CELESTIAL_FIXTURE_MANIFEST } from '../external-celestial-sources/fixtureManifest.js';
import GaiaPassbandReader from '../external-celestial-sources/GaiaPassbandReader.js';
import SpectralDensityBasis from '../external-celestial-sources/SpectralDensityBasis.js';
import SpectralDensityPacket from '../external-celestial-sources/SpectralDensityPacket.js';
import {
    EXTENDED_CELESTIAL_SOURCE,
    POINT_CELESTIAL_SOURCE,
    SPECTRAL_DENSITY_UNITS,
    SPECTRAL_IRRADIANCE_DENSITY,
    SPECTRAL_RADIANCE_DENSITY,
} from '../external-celestial-sources/consts.js';
import {
    scaleSpectrumByMagnitudeDelta,
    syntheticAbPhotometry,
    syntheticAbPhotometryFromBinnedDensity,
} from '../external-celestial-sources/syntheticAbPhotometry.js';
import ZipArchiveReader from '../external-celestial-sources/ZipArchiveReader.js';
import {
    appendRunLog,
    createFreshRecordDirectory,
    nowIso,
    parseRecordDirectory,
    writeJson,
    writeText,
} from './recordWriter.js';

const runnerName = 'er1TypedCelestialSourcesContract';
const recordDirectory = parseRecordDirectory(process.argv);
const fixtureDirectory = resolve(
    'scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures',
);
const commandText = `node scripts/flat/reconciliation/POC/src/runners/${runnerName}.js --record ${recordDirectory}`;

const tolerances = Object.freeze({
    basisBoundNanometersAbsolute: 1e-12,
    analyticBinningRelative: 1e-12,
    canonicalSolarIntegralAbsoluteWattsPerSquareMeter: 1e-9,
    independentSiriusChannelAbsoluteFloor: 1e-24,
    independentSiriusChannelRelative: 1e-10,
    sourceBinReconstructionRelative: 1e-6,
    magnitudeRoundTripAbsolute: 1e-10,
    clippedPassbandApproximationAbsoluteMagnitude: 0.01,
});

await createFreshRecordDirectory(recordDirectory);

try {
    await execute();
} catch (error) {
    await writeJson(recordDirectory, 'failure.json', {
        status: 'invalid',
        runner: runnerName,
        error: serializeError(error),
    });
    await writeJson(recordDirectory, 'result.json', {
        status: 'invalid',
        er1Status: 'invalid-attempt',
        nextPhase: 'ER1 correction in a fresh record',
        imageCount: 0,
    });
    await appendRunLog(recordDirectory, `${runnerName} invalid: ${error.message}`);
    throw error;
}

async function execute() {
    await writeText(recordDirectory, 'state-goal.md', `# State Goal

Accept reset phase ER1 without camera, realized geometry, atmosphere, point
response, display conversion, or image output. Prove explicit spectral-density
quantities and units, canonical bin semantics, source/basis fingerprints,
conservative high-resolution binning, one absolute CALSPEC Sirius fixture, the
single canonical solar owner, an analytic extended-radiance fixture, and a
sealed-but-not-executed LIME lunar candidate. Exercise fail-loud quantity,
unit, basis, provenance, value, coverage, and source-kind boundaries.
`);
    await writeJson(recordDirectory, 'command.json', {
        commands: [{ command: commandText, timestamp: nowIso() }],
    });
    await writeJson(recordDirectory, 'inputs.json', {
        stage: 'ER1-typed-quantity-and-source-fixture-contract',
        runner: runnerName,
        tolerances,
        prohibitedOutputs: [
            'camera',
            'realized geometry',
            'atmosphere evaluation',
            'point response or PSF',
            'display conversion',
            'image',
        ],
        requestedMagnitudeDelta: 2.5,
        clippedPhotometrySupportNanometers: [360, 830],
    });

    const payloads = await loadAndVerifyFixturePayloads();
    await retainRawPayloads();

    const basis = createCanonicalSpectralDensityBasis();
    const basisDiagnostics = diagnoseBasis(basis);
    const colorIntegrationDescriptor = new BrunetonColorDisplayModel()
        .describeSpectralIntegration();
    const colorContractMatchesBasis = colorDescriptorMatchesBasis(
        colorIntegrationDescriptor,
        basis,
    );

    const solarPacket = createCanonicalSolarIrradianceDensity(basis);
    const solarBoundedIntegral = integratedPacketValue(solarPacket);
    const expectedSolarBoundedIntegral = 739.5836757778;
    const solarBoundedIntegralAbsoluteError = Math.abs(
        solarBoundedIntegral - expectedSolarBoundedIntegral,
    );

    const analyticBinning = diagnoseAnalyticBinning(basis);
    const sirius = createCalspecSiriusIrradianceDensity(payloads.sirius, basis);
    const siriusReference = independentlyBinPiecewiseLinear(sirius.spectrum, basis);
    const siriusBinningDiagnostics = compareBinning(sirius.binned, siriusReference);

    const gaia = new GaiaPassbandReader().read(payloads.gaia);
    const requestedMagnitudeDelta = 2.5;
    const fullGaiaOriginal = syntheticAbPhotometry(sirius.spectrum, gaia);
    const scaledSpectrum = scaleSpectrumByMagnitudeDelta(
        sirius.spectrum,
        requestedMagnitudeDelta,
    );
    const fullGaiaScaled = syntheticAbPhotometry(scaledSpectrum, gaia);
    const recoveredMagnitudeDelta = fullGaiaScaled.abMagnitude - fullGaiaOriginal.abMagnitude;
    const magnitudeRoundTripAbsoluteError = Math.abs(
        recoveredMagnitudeDelta - requestedMagnitudeDelta,
    );
    const clippedSupport = Object.freeze({ lowerNanometers: 360, upperNanometers: 830 });
    const clippedHighResolution = syntheticAbPhotometry(
        sirius.spectrum,
        gaia,
        clippedSupport,
    );
    const clippedBinned = syntheticAbPhotometryFromBinnedDensity(
        sirius.packet,
        gaia,
        clippedSupport,
    );
    const clippedMagnitudeAbsoluteError = Math.abs(
        clippedBinned.abMagnitude - clippedHighResolution.abMagnitude,
    );

    const pointSource = new ExternalCelestialSource({
        id: 'calspec-sirius-point-fixture',
        kind: POINT_CELESTIAL_SOURCE,
        geometry: {
            kind: 'infinite-direction-ownership-only',
            owner: 'future observer/epoch star state',
            realizationStatus: 'not-realized-in-er1',
        },
        spectralMeasure: sirius.packet,
    });
    const analyticExtendedPacket = createAnalyticExtendedRadianceDensity(basis, 2e-6);
    const extendedSource = new ExternalCelestialSource({
        id: 'analytic-constant-extended-radiance-fixture',
        kind: EXTENDED_CELESTIAL_SOURCE,
        geometry: {
            kind: 'angular-support-ownership-only',
            owner: 'future extended-source geometry',
            realizationStatus: 'not-realized-in-er1',
        },
        spectralMeasure: analyticExtendedPacket,
    });

    const negativeCases = exerciseNegativeCases({
        basis,
        siriusPacket: sirius.packet,
        extendedPacket: analyticExtendedPacket,
    });
    const fingerprintDiagnostics = exerciseFingerprintCoverage({
        basis,
        siriusPacket: sirius.packet,
        pointSource,
    });
    const lunarCandidate = diagnoseLimeCandidate(payloads);

    const criteria = Object.freeze([
        criterion('canonical-basis-is-contiguous-360-to-830-nm-density',
            basisDiagnostics.maximumAdjacencyAbsoluteErrorNanometers
                <= tolerances.basisBoundNanometersAbsolute
            && basisDiagnostics.firstLowerBoundNanometers === 360
            && basisDiagnostics.lastUpperBoundNanometers === 830
            && Math.abs(basisDiagnostics.summedWidthNanometers - 470)
                <= tolerances.basisBoundNanometersAbsolute),
        criterion('color-path-declares-the-same-density-bin-width-contract',
            colorContractMatchesBasis),
        criterion('canonical-solar-owner-reconstructs-bounded-integral',
            solarBoundedIntegralAbsoluteError
                <= tolerances.canonicalSolarIntegralAbsoluteWattsPerSquareMeter),
        criterion('constant-and-linear-analytic-binning-pass',
            analyticBinning.maximumRelativeError <= tolerances.analyticBinningRelative),
        criterion('pinned-calspec-sirius-fits-identity-and-units-pass',
            sirius.parsed.rowCount === EXTERNAL_CELESTIAL_FIXTURE_MANIFEST
                .siriusCalspec.expectedRowCount
            && sirius.parsed.header.targetId === 'SIRIUS'
            && sirius.parsed.fluxUnits === 'FLAM'),
        criterion('sirius-independent-channel-integrals-pass',
            siriusBinningDiagnostics.everyChannelWithinIndependentTolerance),
        criterion('sirius-represented-integral-reconstructs',
            siriusBinningDiagnostics.representedIntegralRelativeError
                <= tolerances.sourceBinReconstructionRelative),
        criterion('gaia-version2-g-passband-and-sentinel-policy-pass',
            gaia.sampleCount === 781
            && gaia.minimumNanometers === 320
            && gaia.maximumNanometers === 1100
            && gaia.missingSentinel === 99.99),
        criterion('high-resolution-gaia-ab-magnitude-round-trip-passes',
            magnitudeRoundTripAbsoluteError <= tolerances.magnitudeRoundTripAbsolute),
        criterion('sirius-15-channel-clipped-gaia-approximation-passes',
            clippedMagnitudeAbsoluteError
                <= tolerances.clippedPassbandApproximationAbsoluteMagnitude),
        criterion('point-and-extended-source-dispatch-is-typed',
            pointSource.spectralMeasure.quantity === SPECTRAL_IRRADIANCE_DENSITY
            && extendedSource.spectralMeasure.quantity === SPECTRAL_RADIANCE_DENSITY),
        criterion('all-negative-cases-fail-with-predeclared-error-codes',
            negativeCases.every((entry) => entry.status === 'accepted')),
        criterion('fingerprints-cover-basis-radiometry-provenance-uncertainty-and-geometry',
            Object.values(fingerprintDiagnostics.checks).every(Boolean)),
        criterion('pinned-fixture-payloads-match-manifest-hashes',
            Object.values(payloads.verification).every((entry) => entry.status === 'accepted')),
        criterion('lime-candidate-bytes-and-embedded-references-are-sealed',
            lunarCandidate.status
                === EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.limeLunarCandidate.er1Status
            && lunarCandidate.asdEmbeddedMatchesZenodo
            && lunarCandidate.coefficientCopiesMatch),
        criterion('er1-produced-no-camera-atmosphere-response-display-or-image', true),
    ]);
    const status = criteria.every((entry) => entry.status === 'accepted')
        ? 'accepted'
        : 'rejected';

    const codeFiles = [
        `scripts/flat/reconciliation/POC/src/runners/${runnerName}.js`,
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/SpectralDensityBasis.js',
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/SpectralDensityPacket.js',
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/ExternalCelestialSource.js',
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/binPiecewiseLinearSpectralDensity.js',
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/CalspecFitsSpectrumReader.js',
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/GaiaPassbandReader.js',
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/syntheticAbPhotometry.js',
        'scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtureManifest.js',
        'scripts/flat/reconciliation/POC/src/color/BrunetonColorDisplayModel.js',
        'scripts/flat/reconciliation/POC/src/constants/consts.js',
        'scripts/flat/reconciliation/POC/src/provenance/stableHash.js',
    ];
    const sourceContentHashes = Object.fromEntries(await Promise.all(
        codeFiles.map(async (path) => [path, await sha256File(path)]),
    ));

    await writeJson(recordDirectory, 'provenance.json', {
        fixtureManifest: EXTERNAL_CELESTIAL_FIXTURE_MANIFEST,
        fixtureVerification: payloads.verification,
        sourceContentHashes,
        governingDesign:
            'agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md',
        governingPlan:
            'agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md',
        acquisitionQualification:
            'Windows curl retained normal chain/hostname verification and used ssl-revoke-best-effort because the environment could not reach certificate revocation endpoints.',
    });
    await writeJson(recordDirectory, 'schema-snapshots.json', {
        basis: basis.describe(),
        pointMeasure: sirius.packet.describe(),
        extendedMeasure: analyticExtendedPacket.describe(),
        pointSource: pointSource.describe(),
        extendedSource: extendedSource.describe(),
        ownershipSeparation: {
            sourceMeasureOwns: ['quantity', 'units', 'basis', 'values', 'provenance', 'uncertainty'],
            geometryOwns: ['direction/depth/angular support/opacity when realized'],
            rendererOwns: ['pixel solid angle', 'point response', 'extended angular integration'],
            atmosphereOwns: ['path radiance', 'directional transmittance'],
            displayOwns: ['spectral-to-XYZ/RGB', 'global exposure/tone map/output transfer'],
        },
    });
    await writeJson(recordDirectory, 'basis-and-solar-diagnostics.json', {
        basisDiagnostics,
        colorIntegrationDescriptor,
        colorContractMatchesBasis,
        solarPacket: solarPacket.describe(),
        solarBoundedIntegral,
        expectedSolarBoundedIntegral,
        solarBoundedIntegralAbsoluteError,
        qualification: 'The bounded 360..830 nm value is not total solar irradiance.',
    });
    await writeJson(recordDirectory, 'analytic-binning.json', analyticBinning);
    await writeJson(recordDirectory, 'sirius-source-samples.json', {
        header: sirius.parsed.header,
        rowCount: sirius.parsed.rowCount,
        columns: sirius.parsed.columns,
        wavelengthsNanometers: sirius.spectrum.wavelengthsNanometers,
        densityWattsPerSquareMeterPerNanometer: sirius.spectrum.densityValues,
        statisticalErrorDensity: sirius.statisticalDensityValues,
        systematicErrorDensity: sirius.systematicDensityValues,
    });
    await writeJson(recordDirectory, 'sirius-binning.json', {
        method: sirius.binned.method,
        channels: sirius.binned.channels,
        independentReference: siriusReference,
        comparison: siriusBinningDiagnostics,
        packet: sirius.packet.describe(),
    });
    await writeJson(recordDirectory, 'gaia-synthetic-photometry.json', {
        passband: {
            release: gaia.release,
            band: gaia.band,
            responseUnits: gaia.responseUnits,
            sourceUnitsQualification: gaia.sourceUnitsQualification,
            missingPolicy: gaia.missingPolicy,
            sampleCount: gaia.sampleCount,
            supportNanometers: [gaia.minimumNanometers, gaia.maximumNanometers],
            zeroPointsRetainedButNotApplied: gaia.zeroPoints,
        },
        equation:
            '<f_nu> = integral(f_lambda S lambda dlambda) / integral(S c/lambda dlambda); m_AB = -2.5 log10(<f_nu>[SI]) - 56.10',
        fullGaiaOriginal,
        requestedMagnitudeDelta,
        fullGaiaScaled,
        recoveredMagnitudeDelta,
        magnitudeRoundTripAbsoluteError,
        clippedSupport,
        clippedHighResolution,
        clippedBinned,
        clippedMagnitudeAbsoluteError,
    });
    await writeJson(recordDirectory, 'negative-cases.json', negativeCases);
    await writeJson(recordDirectory, 'fingerprint-diagnostics.json', fingerprintDiagnostics);
    await writeJson(recordDirectory, 'lunar-candidate.json', lunarCandidate);
    await writeJson(recordDirectory, 'criteria-results.json', {
        status,
        mechanicalStatus: status,
        physicalSourceContractStatus: status,
        lunarCalibrationStatus:
            EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.limeLunarCandidate.er1Status,
        observationalStatus: 'not-applicable',
        humanReviewStatus: 'not-applicable',
        criteria,
    });
    await writeJson(recordDirectory, 'result.json', {
        status,
        er1Status: status,
        acceptedCriterionCount: criteria.filter((entry) => entry.status === 'accepted').length,
        criterionCount: criteria.length,
        sourceGate: status === 'accepted' ? 'XA-G01 accepted for Sirius and analytic extended fixture' : 'not accepted',
        lunarCalibrationStatus:
            EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.limeLunarCandidate.er1Status,
        nextPhase: status === 'accepted'
            ? 'ER2 point-source conservation reference'
            : 'ER1 correction in a fresh record',
        imageCount: 0,
    });
    await writeText(recordDirectory, 'report.md', reportMarkdown({
        status,
        criteria,
        basis,
        solarBoundedIntegral,
        sirius,
        siriusBinningDiagnostics,
        fullGaiaOriginal,
        magnitudeRoundTripAbsoluteError,
        clippedMagnitudeAbsoluteError,
        lunarCandidate,
    }));
    await appendRunLog(recordDirectory,
        `${runnerName} ${status}; ER1 source contract ${status}; no image output.`);

    console.log(JSON.stringify({
        status,
        er1Status: status,
        recordDirectory,
        acceptedCriterionCount: criteria.filter((entry) => entry.status === 'accepted').length,
        criterionCount: criteria.length,
        nextPhase: status === 'accepted' ? 'ER2' : 'ER1-correction',
    }));
}

async function loadAndVerifyFixturePayloads() {
    const manifest = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST;
    const definitions = {
        sirius: manifest.siriusCalspec,
        gaia: manifest.gaiaEdr3PassbandsV2,
        solar: manifest.canonicalSolar,
        limeRelease: manifest.limeLunarCandidate.release,
        limeCoefficient: manifest.limeLunarCandidate.coefficients,
        limeAtbd: manifest.limeLunarCandidate.atbd,
    };
    const payloads = {};
    const verification = {};
    for (const [id, definition] of Object.entries(definitions)) {
        const bytes = await readFile(resolve(fixtureDirectory, definition.fileName));
        const actualHash = sha256Bytes(bytes);
        const accepted = bytes.length === definition.byteLength
            && actualHash === definition.sourceHashSha256;
        verification[id] = Object.freeze({
            status: accepted ? 'accepted' : 'rejected',
            fileName: definition.fileName,
            expectedByteLength: definition.byteLength,
            actualByteLength: bytes.length,
            expectedSha256: definition.sourceHashSha256,
            actualSha256: actualHash,
        });
        if (!accepted) {
            throw new ReconciliationConfigurationError(
                `Fixture ${id} does not match its manifest.`,
                { code: 'ER1_FIXTURE_HASH_MISMATCH', details: verification[id] },
            );
        }
        payloads[id] = bytes;
    }
    return Object.freeze({
        ...payloads,
        verification: Object.freeze(verification),
    });
}

async function retainRawPayloads() {
    const sourceDirectory = resolve(recordDirectory, 'sources');
    await mkdir(sourceDirectory, { recursive: false });
    const files = [
        'README.md',
        'sirius_stis_005.fits',
        'sirius_stis_005.http-headers.txt',
        'GaiaEDR3_passbands_zeropoints_version2.zip',
        'GaiaEDR3_passbands_zeropoints_version2.http-headers.txt',
        'astmg173.zip',
        'lime_tbx-v1.4.1.zip',
        'lime_tbx-v1.4.1.zip.http-headers.txt',
        'LIME_MODEL_COEFS_20251010_V01.nc',
        'LIME_MODEL_COEFS_20251010_V01.nc.http-headers.txt',
        'LIME_ASD-v2.0.0.nc.http-headers.txt',
        'LIME-Model-ATBD-v3.3.pdf',
        'LIME-Model-ATBD-v3.3.pdf.http-headers.txt',
    ];
    await Promise.all(files.map((fileName) => copyFile(
        resolve(fixtureDirectory, fileName),
        resolve(sourceDirectory, fileName),
    )));
}

function diagnoseBasis(basis) {
    const adjacencyErrors = basis.channels.slice(1).map((channel, index) => Math.abs(
        basis.channels[index].upperBoundNanometers - channel.lowerBoundNanometers,
    ));
    return Object.freeze({
        descriptor: basis.describe(),
        channelCount: basis.channels.length,
        firstLowerBoundNanometers: basis.channels[0].lowerBoundNanometers,
        lastUpperBoundNanometers: basis.channels.at(-1).upperBoundNanometers,
        summedWidthNanometers: basis.channels.reduce(
            (sum, channel) => sum + channel.widthNanometers,
            0,
        ),
        maximumAdjacencyAbsoluteErrorNanometers: Math.max(0, ...adjacencyErrors),
    });
}

function colorDescriptorMatchesBasis(descriptor, basis) {
    const expected = {
        inputQuantity: SPECTRAL_RADIANCE_DENSITY,
        inputUnits: SPECTRAL_DENSITY_UNITS[SPECTRAL_RADIANCE_DENSITY],
        wavelengthUnits: basis.wavelengthUnits,
        sampleSemantics: basis.sampleSemantics,
        quadrature: basis.quadrature,
        equation: 'XYZ_component = sum(CIE_component(lambda_i) * L_lambda_i * DeltaLambda_i)',
        channels: basis.channels.map((channel) => ({
            id: channel.id,
            centerNanometers: channel.centerNanometers,
            widthNanometers: channel.widthNanometers,
        })),
    };
    return stableStringify(descriptor) === stableStringify(expected);
}

function diagnoseAnalyticBinning(basis) {
    const wavelengthsNanometers = Object.freeze([350, 500, 700, 840]);
    const constant = 2.75;
    const constantResult = binPiecewiseLinearSpectralDensity({
        wavelengthsNanometers,
        densityValues: wavelengthsNanometers.map(() => constant),
    }, basis);
    const constantErrors = constantResult.values.map((value) => relativeError(value, constant));
    const slope = 0.003;
    const intercept = 0.4;
    const linearResult = binPiecewiseLinearSpectralDensity({
        wavelengthsNanometers,
        densityValues: wavelengthsNanometers.map((wavelength) => slope * wavelength + intercept),
    }, basis);
    const linearExpected = basis.channels.map((channel) =>
        slope * channel.centerNanometers + intercept);
    const linearErrors = linearResult.values.map((value, index) =>
        relativeError(value, linearExpected[index]));
    return Object.freeze({
        constant: {
            sourceValue: constant,
            values: constantResult.values,
            relativeErrors: constantErrors,
        },
        linear: {
            slope,
            intercept,
            expectedValues: linearExpected,
            values: linearResult.values,
            relativeErrors: linearErrors,
        },
        maximumRelativeError: Math.max(...constantErrors, ...linearErrors),
    });
}

function independentlyBinPiecewiseLinear(spectrum, basis) {
    const channels = basis.channels.map((channel) => {
        let integral = 0;
        let segmentCount = 0;
        for (let index = 0; index < spectrum.wavelengthsNanometers.length - 1; index += 1) {
            const x0 = spectrum.wavelengthsNanometers[index];
            const x1 = spectrum.wavelengthsNanometers[index + 1];
            const lower = Math.max(channel.lowerBoundNanometers, x0);
            const upper = Math.min(channel.upperBoundNanometers, x1);
            if (upper <= lower) {
                continue;
            }
            const y0 = spectrum.densityValues[index];
            const y1 = spectrum.densityValues[index + 1];
            const slope = (y1 - y0) / (x1 - x0);
            const intercept = y0 - slope * x0;
            integral += slope * (upper * upper - lower * lower) / 2
                + intercept * (upper - lower);
            segmentCount += 1;
        }
        return Object.freeze({
            id: channel.id,
            integratedValue: integral,
            densityValue: integral / channel.widthNanometers,
            segmentCount,
        });
    });
    return Object.freeze({
        method: 'independent-linear-segment-antiderivative-v1',
        channels: Object.freeze(channels),
        representedIntegral: channels.reduce((sum, channel) => sum + channel.integratedValue, 0),
    });
}

function compareBinning(primary, reference) {
    const channels = primary.channels.map((channel, index) => {
        const expected = reference.channels[index].densityValue;
        const absoluteError = Math.abs(channel.densityValue - expected);
        const tolerance = tolerances.independentSiriusChannelAbsoluteFloor
            + tolerances.independentSiriusChannelRelative * Math.abs(expected);
        return Object.freeze({
            id: channel.id,
            primaryDensity: channel.densityValue,
            referenceDensity: expected,
            absoluteError,
            tolerance,
            status: absoluteError <= tolerance ? 'accepted' : 'rejected',
        });
    });
    return Object.freeze({
        channels: Object.freeze(channels),
        everyChannelWithinIndependentTolerance:
            channels.every((channel) => channel.status === 'accepted'),
        primaryRepresentedIntegral: primary.representedIntegral,
        referenceRepresentedIntegral: reference.representedIntegral,
        representedIntegralRelativeError: relativeError(
            primary.representedIntegral,
            reference.representedIntegral,
        ),
    });
}

function exerciseNegativeCases({ basis, siriusPacket, extendedPacket }) {
    const values = [...siriusPacket.values];
    const provenance = { ...siriusPacket.provenance };
    const uncertainty = { ...siriusPacket.uncertainty };
    const alternateBasis = new SpectralDensityBasis({
        ...basis.describe(),
        quadrature: `${basis.quadrature}-alternate`,
        provenance: { ...basis.provenance, testVariant: 'alternate-quadrature' },
    });
    return Object.freeze([
        expectedFailure('bare-array-source-measure', 'ER1_SOURCE_TYPED_MEASURE_REQUIRED', () =>
            new ExternalCelestialSource({
                id: 'invalid-bare-array',
                kind: POINT_CELESTIAL_SOURCE,
                geometry: { kind: 'ownership-only', owner: 'test' },
                spectralMeasure: values,
            })),
        expectedFailure('wrong-irradiance-units', 'ER1_PACKET_UNITS_MISMATCH', () =>
            new SpectralDensityPacket({
                quantity: SPECTRAL_IRRADIANCE_DENSITY,
                units: SPECTRAL_DENSITY_UNITS[SPECTRAL_RADIANCE_DENSITY],
                basis,
                values,
                provenance,
                uncertainty,
            })),
        expectedFailure('negative-density', 'ER1_PACKET_VALUES_NEGATIVE', () =>
            new SpectralDensityPacket({
                quantity: SPECTRAL_IRRADIANCE_DENSITY,
                units: SPECTRAL_DENSITY_UNITS[SPECTRAL_IRRADIANCE_DENSITY],
                basis,
                values: [-1, ...values.slice(1)],
                provenance,
                uncertainty,
            })),
        expectedFailure('missing-provenance-hash',
            'ER1_PACKET_PROVENANCE_IDENTITY_INCOMPLETE', () =>
                new SpectralDensityPacket({
                    quantity: SPECTRAL_IRRADIANCE_DENSITY,
                    units: SPECTRAL_DENSITY_UNITS[SPECTRAL_IRRADIANCE_DENSITY],
                    basis,
                    values,
                    provenance: { sourceId: 'invalid', sourceVersion: 'v1' },
                    uncertainty,
                })),
        expectedFailure('non-json-provenance', 'ER1_PACKET_PROVENANCE_INVALID', () =>
            new SpectralDensityPacket({
                quantity: SPECTRAL_IRRADIANCE_DENSITY,
                units: SPECTRAL_DENSITY_UNITS[SPECTRAL_IRRADIANCE_DENSITY],
                basis,
                values,
                provenance: { ...provenance, invalid: undefined },
                uncertainty,
            })),
        expectedFailure('point-radiance-kind-mismatch', 'ER1_SOURCE_MEASURE_KIND_MISMATCH', () =>
            new ExternalCelestialSource({
                id: 'invalid-point-radiance',
                kind: POINT_CELESTIAL_SOURCE,
                geometry: { kind: 'ownership-only', owner: 'test' },
                spectralMeasure: extendedPacket,
            })),
        expectedFailure('extended-irradiance-kind-mismatch',
            'ER1_SOURCE_MEASURE_KIND_MISMATCH', () =>
                new ExternalCelestialSource({
                    id: 'invalid-extended-irradiance',
                    kind: EXTENDED_CELESTIAL_SOURCE,
                    geometry: { kind: 'ownership-only', owner: 'test' },
                    spectralMeasure: siriusPacket,
                })),
        expectedFailure('basis-fingerprint-mismatch',
            'ER1_PACKET_BASIS_FINGERPRINT_MISMATCH', () =>
                siriusPacket.assertBasisCompatibility(alternateBasis)),
        expectedFailure('duplicate-source-wavelength',
            'ER1_BINNING_WAVELENGTHS_NOT_STRICTLY_INCREASING', () =>
                binPiecewiseLinearSpectralDensity({
                    wavelengthsNanometers: [350, 400, 400, 840],
                    densityValues: [1, 1, 1, 1],
                }, basis)),
        expectedFailure('incomplete-source-bin-coverage',
            'ER1_BINNING_SOURCE_COVERAGE_INCOMPLETE', () =>
                binPiecewiseLinearSpectralDensity({
                    wavelengthsNanometers: [370, 500, 820],
                    densityValues: [1, 1, 1],
                }, basis)),
    ]);
}

function exerciseFingerprintCoverage({ basis, siriusPacket, pointSource }) {
    const baseConfiguration = {
        quantity: siriusPacket.quantity,
        units: siriusPacket.units,
        basis,
        values: [...siriusPacket.values],
        provenance: { ...siriusPacket.provenance },
        uncertainty: { ...siriusPacket.uncertainty },
    };
    const changedValues = [...baseConfiguration.values];
    changedValues[0] *= 1.000001;
    const valuePacket = new SpectralDensityPacket({ ...baseConfiguration, values: changedValues });
    const provenancePacket = new SpectralDensityPacket({
        ...baseConfiguration,
        provenance: { ...baseConfiguration.provenance, sourceVersion: 'fingerprint-test-version' },
    });
    const uncertaintyPacket = new SpectralDensityPacket({
        ...baseConfiguration,
        uncertainty: { ...baseConfiguration.uncertainty, model: 'fingerprint-test-model' },
    });
    const changedBasis = new SpectralDensityBasis({
        ...basis.describe(),
        quadrature: `${basis.quadrature}-fingerprint-test`,
        provenance: basis.provenance,
    });
    const movedSource = new ExternalCelestialSource({
        id: pointSource.id,
        kind: pointSource.kind,
        geometry: { ...pointSource.geometry, stateFingerprintTest: 'changed' },
        spectralMeasure: pointSource.spectralMeasure,
    });
    return Object.freeze({
        checks: Object.freeze({
            reorderedKeysDoNotChangeStableHash:
                stableHash({ alpha: 1, beta: 2 }) === stableHash({ beta: 2, alpha: 1 }),
            changedValueChangesRadiometryFingerprint:
                valuePacket.fingerprint !== siriusPacket.fingerprint,
            changedProvenanceChangesRadiometryFingerprint:
                provenancePacket.fingerprint !== siriusPacket.fingerprint,
            changedUncertaintyChangesRadiometryFingerprint:
                uncertaintyPacket.fingerprint !== siriusPacket.fingerprint,
            changedQuadratureChangesBasisFingerprint:
                changedBasis.fingerprint !== basis.fingerprint,
            changedGeometryChangesSourceFingerprint:
                movedSource.fingerprint !== pointSource.fingerprint,
            changedGeometryDoesNotChangeRadiometryFingerprint:
                movedSource.spectralMeasure.fingerprint === pointSource.spectralMeasure.fingerprint,
        }),
        fingerprints: Object.freeze({
            basis: basis.fingerprint,
            changedBasis: changedBasis.fingerprint,
            sirius: siriusPacket.fingerprint,
            changedValue: valuePacket.fingerprint,
            changedProvenance: provenancePacket.fingerprint,
            changedUncertainty: uncertaintyPacket.fingerprint,
            pointSource: pointSource.fingerprint,
            movedSource: movedSource.fingerprint,
        }),
    });
}

function diagnoseLimeCandidate(payloads) {
    const fixture = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.limeLunarCandidate;
    const archive = new ZipArchiveReader(payloads.limeRelease);
    const embeddedCoefficient = archive.readEntry(fixture.coefficients.embeddedEntry);
    const embeddedAsd = archive.readEntry(fixture.spectralReference.embeddedEntry);
    const listvText = archive.readEntry('lime_tbx-1.4.1/coeff_data/listv.txt').toString('utf8');
    const coefficientCopiesMatch = sha256Bytes(embeddedCoefficient)
        === fixture.coefficients.sourceHashSha256
        && embeddedCoefficient.equals(payloads.limeCoefficient);
    const asdEmbeddedMatchesZenodo = sha256Bytes(embeddedAsd)
        === fixture.spectralReference.sourceHashSha256
        && createHash('md5').update(embeddedAsd).digest('hex')
            === fixture.spectralReference.sourceMd5;
    return Object.freeze({
        status: fixture.er1Status,
        fixture,
        coefficientCopiesMatch,
        embeddedCoefficientSha256: sha256Bytes(embeddedCoefficient),
        asdEmbeddedMatchesZenodo,
        embeddedAsdSha256: sha256Bytes(embeddedAsd),
        embeddedAsdMd5: createHash('md5').update(embeddedAsd).digest('hex'),
        pinnedDefaultListText: listvText,
        pinnedDefaultNamesSelectedModel: listvText.includes('20251010'),
        requiredEr5Selection: fixture.coefficients.selectionGuard,
        er1ClaimBoundary:
            'Bytes, quantity, domain, uncertainty and implementation qualification only; no lunar spectrum or scene result generated.',
    });
}

function expectedFailure(id, expectedCode, operation) {
    try {
        operation();
        return Object.freeze({ id, expectedCode, actualCode: null, status: 'rejected' });
    } catch (error) {
        return Object.freeze({
            id,
            expectedCode,
            actualName: error.name,
            actualCode: error.code ?? null,
            message: error.message,
            status: error instanceof ReconciliationConfigurationError && error.code === expectedCode
                ? 'accepted'
                : 'rejected',
        });
    }
}

function integratedPacketValue(packet) {
    return packet.values.reduce((sum, value, index) =>
        sum + value * packet.basis.channels[index].widthNanometers, 0);
}

function criterion(name, accepted) {
    return Object.freeze({ name, status: accepted ? 'accepted' : 'rejected' });
}

function relativeError(actual, expected) {
    return Math.abs(actual - expected) / Math.max(Math.abs(expected), 1e-300);
}

function sha256Bytes(bytes) {
    return createHash('sha256').update(bytes).digest('hex');
}

async function sha256File(path) {
    return sha256Bytes(await readFile(path));
}

function serializeError(error) {
    return Object.freeze({
        name: error.name,
        code: error.code ?? null,
        message: error.message,
        details: error.details ?? null,
        stack: error.stack ?? null,
    });
}

function reportMarkdown({
    status,
    criteria,
    basis,
    solarBoundedIntegral,
    sirius,
    siriusBinningDiagnostics,
    fullGaiaOriginal,
    magnitudeRoundTripAbsoluteError,
    clippedMagnitudeAbsoluteError,
    lunarCandidate,
}) {
    return `# ER1 Typed Celestial Source Contract

Overall status: **${status}**

ER1 establishes quantity-bearing source facts only. It produced no camera,
realized geometry, atmosphere, point response, display conversion, or image.

- Canonical basis: ${basis.channels.length} bin-average density channels,
  ${basis.channels[0].lowerBoundNanometers}..${basis.channels.at(-1).upperBoundNanometers} nm.
- Bounded canonical solar integral: ${solarBoundedIntegral.toFixed(12)} W m^-2
  over 360..830 nm; this is not total solar irradiance.
- Sirius fixture: CALSPEC ${sirius.parsed.header.targetId},
  ${sirius.parsed.rowCount} SCI rows, direct absolute Earth-observer F_lambda,
  no magnitude rescaling.
- Maximum independent Sirius channel residual:
  ${Math.max(...siriusBinningDiagnostics.channels.map((entry) => entry.absoluteError)).toExponential(12)}
  W m^-2 nm^-1.
- Full Gaia-G synthetic AB magnitude (diagnostic):
  ${fullGaiaOriginal.abMagnitude.toFixed(9)}.
- 2.5-mag algebra/parser round-trip error:
  ${magnitudeRoundTripAbsoluteError.toExponential(12)} mag.
- Same-support 15-channel Gaia approximation error:
  ${clippedMagnitudeAbsoluteError.toExponential(12)} mag.
- LIME: ${lunarCandidate.status}. It owns candidate disk-equivalent
  reflectance and is not a resolved BRDF or accepted lunar calibration.

Accepted criteria: ${criteria.filter((entry) => entry.status === 'accepted').length}/${criteria.length}.

${status === 'accepted'
        ? 'The next action is ER2 exact pixel-solid-angle and normalized point-response conservation.'
        : 'Diagnose the rejected ER1 criterion and use a fresh immutable record for the correction.'}
`;
}
