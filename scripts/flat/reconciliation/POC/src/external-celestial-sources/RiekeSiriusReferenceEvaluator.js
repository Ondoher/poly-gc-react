// References:
// - https://doi.org/10.3847/1538-3881/ac9f1b, Rieke et al. (2023),
//   Absolute Calibration. III. Improved Absolute Calibration for the Visible
//   through the Mid-infrared.
// - STScI CALSPEC sirius_stis_005.fits retained by ER1.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER5.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { EXTERNAL_CELESTIAL_FIXTURE_MANIFEST } from './fixtureManifest.js';

const FIXTURE = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.rieke2023SiriusAbsoluteCalibration;
const PUBLICATION_FIXTURE_PATH =
    `scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures/${FIXTURE.fileName}`;
const PUBLICATION_DOI = FIXTURE.publicationDoi;

const ANGSTROMS_PER_NANOMETER = 10;
const ANGSTROMS_PER_MICROMETER = 10000;
const FLAM_TO_WATTS_PER_SQUARE_METER_PER_NANOMETER = 0.01;
const FLAM_TO_WATTS_PER_SQUARE_CENTIMETER_PER_MICROMETER = 0.001;

const VISIBLE_LOWER_NANOMETERS = FIXTURE.visibleReference.comparisonWindowNanometers[0];
const VISIBLE_UPPER_NANOMETERS = FIXTURE.visibleReference.comparisonWindowNanometers[1];
const VISIBLE_REFERENCE_VALUE_WATTS_PER_SQUARE_METER_PER_NANOMETER =
    FIXTURE.visibleReference.fluxWattsPerSquareMeterPerNanometer;
const VISIBLE_REFERENCE_UNCERTAINTY_WATTS_PER_SQUARE_METER_PER_NANOMETER =
    FIXTURE.visibleReference.standardUncertaintyWattsPerSquareMeterPerNanometer;
const EXPECTED_VISIBLE_CALSPEC_VALUE_WATTS_PER_SQUARE_METER_PER_NANOMETER =
    1.347313909464e-10;
const VISIBLE_ORACLE_RELATIVE_TOLERANCE = 1e-10;

const NIR_FIT_LOWER_MICROMETERS = FIXTURE.msxReference.fitWindowMicrometers[0];
const NIR_FIT_UPPER_MICROMETERS = FIXTURE.msxReference.fitWindowMicrometers[1];
const NIR_EXCLUSION_LOWER_MICROMETERS =
    FIXTURE.msxReference.excludedBrackettGammaMicrometers[0];
const NIR_EXCLUSION_UPPER_MICROMETERS =
    FIXTURE.msxReference.excludedBrackettGammaMicrometers[1];
const NIR_EVALUATION_MICROMETERS = FIXTURE.msxReference.pivotWavelengthMicrometers;
const NIR_REFERENCE_VALUE_WATTS_PER_SQUARE_CENTIMETER_PER_MICROMETER =
    FIXTURE.msxReference.fluxWattsPerSquareCentimeterPerMicrometer;
const NIR_REFERENCE_UNCERTAINTY_WATTS_PER_SQUARE_CENTIMETER_PER_MICROMETER =
    FIXTURE.msxReference.standardUncertaintyWattsPerSquareCentimeterPerMicrometer;
const EXPECTED_NIR_CALSPEC_VALUE_WATTS_PER_SQUARE_CENTIMETER_PER_MICROMETER =
    15.34741618e-14;
const NIR_ORACLE_RELATIVE_TOLERANCE = 1e-10;

export default class RiekeSiriusReferenceEvaluator {
    /**
     * Create one fail-loud evaluator error.
     *
     * @param {string} code - Stable reconciliation error code.
     * @param {string} message - Human-readable failure.
     * @param {unknown} details - Optional structured diagnostics.
     * @returns {ReconciliationConfigurationError} Configuration error.
     */
    _configurationError(code, message, details = null) {
        return new ReconciliationConfigurationError(message, { code, details });
    }

    /**
     * Hash complete retained bytes with SHA-256.
     *
     * @param {Buffer} bytes - Complete publication bytes.
     * @returns {string} Lowercase SHA-256 digest.
     */
    _hashBytes(bytes) {
        return createHash('sha256').update(bytes).digest('hex');
    }

    /**
     * Validate the supplied object as the exact parsed Sirius CALSPEC contract.
     *
     * @param {Readonly<Record<string, unknown>>} parsedCalspec - Reader output.
     * @returns {readonly Readonly<Record<string, number>>[]} Parsed samples.
     */
    _validateParsedCalspec(parsedCalspec) {
        if (!parsedCalspec || typeof parsedCalspec !== 'object') {
            throw this._configurationError(
                'ER5_RIEKE_CALSPEC_REQUIRED',
                'Rieke evaluation requires parsed CalspecFitsSpectrumReader output.',
            );
        }
        const identityChecks = Object.freeze([
            Object.freeze(['format', parsedCalspec.format, 'FITS-BINTABLE']),
            Object.freeze(['hduName', parsedCalspec.hduName, 'SCI']),
            Object.freeze(['rowCount', parsedCalspec.rowCount, 8970]),
            Object.freeze(['wavelengthUnits', parsedCalspec.wavelengthUnits, 'ANGSTROMS']),
            Object.freeze(['fluxUnits', parsedCalspec.fluxUnits, 'FLAM']),
            Object.freeze(['wavelengthState', parsedCalspec.wavelengthState, 'vacuum']),
            Object.freeze(['targetId', parsedCalspec.header?.targetId, 'SIRIUS']),
            Object.freeze(['filename', parsedCalspec.header?.filename, 'sirius_stis_005.fits']),
        ]);
        for (const [field, actual, expected] of identityChecks) {
            if (actual !== expected) {
                throw this._configurationError(
                    'ER5_RIEKE_CALSPEC_IDENTITY_MISMATCH',
                    `Rieke evaluation received an unexpected CALSPEC ${field}.`,
                    { field, expected, actual },
                );
            }
        }
        if (
            !Array.isArray(parsedCalspec.samples)
            || parsedCalspec.samples.length !== parsedCalspec.rowCount
        ) {
            throw this._configurationError(
                'ER5_RIEKE_CALSPEC_SAMPLES_INVALID',
                'Rieke evaluation requires the complete parsed CALSPEC sample array.',
            );
        }
        return parsedCalspec.samples;
    }

    /**
     * Convert one CALSPEC row to explicit visible and near-infrared units.
     *
     * @param {Readonly<Record<string, number>>} sample - Parsed CALSPEC sample.
     * @param {number} sourceSampleIndex - Zero-based FITS row index.
     * @returns {RiekeConvertedCalspecSample} Immutable converted row.
     */
    _convertSample(sample, sourceSampleIndex) {
        for (const field of [
            'wavelengthAngstroms',
            'fluxFlam',
            'statisticalErrorFlam',
            'systematicErrorFlam',
            'dataQuality',
        ]) {
            if (!Number.isFinite(sample[field])) {
                throw this._configurationError(
                    'ER5_RIEKE_CALSPEC_SAMPLE_NONFINITE',
                    `CALSPEC sample ${sourceSampleIndex} field ${field} must be finite.`,
                );
            }
        }
        if (
            sample.wavelengthAngstroms <= 0
            || sample.fluxFlam <= 0
            || sample.statisticalErrorFlam < 0
            || sample.systematicErrorFlam < 0
        ) {
            throw this._configurationError(
                'ER5_RIEKE_CALSPEC_SAMPLE_VALUE_INVALID',
                `CALSPEC sample ${sourceSampleIndex} cannot support a logarithmic flux operator.`,
            );
        }
        return Object.freeze({
            sourceSampleIndex,
            wavelengthAngstroms: sample.wavelengthAngstroms,
            wavelengthNanometers: sample.wavelengthAngstroms / ANGSTROMS_PER_NANOMETER,
            wavelengthMicrometers: sample.wavelengthAngstroms / ANGSTROMS_PER_MICROMETER,
            fluxFlam: sample.fluxFlam,
            fluxWattsPerSquareMeterPerNanometer:
                sample.fluxFlam * FLAM_TO_WATTS_PER_SQUARE_METER_PER_NANOMETER,
            fluxWattsPerSquareCentimeterPerMicrometer:
                sample.fluxFlam
                * FLAM_TO_WATTS_PER_SQUARE_CENTIMETER_PER_MICROMETER,
            statisticalErrorWattsPerSquareMeterPerNanometer:
                sample.statisticalErrorFlam
                * FLAM_TO_WATTS_PER_SQUARE_METER_PER_NANOMETER,
            systematicErrorWattsPerSquareMeterPerNanometer:
                sample.systematicErrorFlam
                * FLAM_TO_WATTS_PER_SQUARE_METER_PER_NANOMETER,
            statisticalErrorWattsPerSquareCentimeterPerMicrometer:
                sample.statisticalErrorFlam
                * FLAM_TO_WATTS_PER_SQUARE_CENTIMETER_PER_MICROMETER,
            systematicErrorWattsPerSquareCentimeterPerMicrometer:
                sample.systematicErrorFlam
                * FLAM_TO_WATTS_PER_SQUARE_CENTIMETER_PER_MICROMETER,
            dataQuality: sample.dataQuality,
        });
    }

    /**
     * Assert that every source row used by an operator has DATAQUAL=1.
     *
     * @param {readonly RiekeConvertedCalspecSample[]} samples - Selected rows.
     * @param {string} operatorId - Operator name used in errors.
     * @returns {void}
     */
    _requireGoodDataQuality(samples, operatorId) {
        const invalid = samples.filter((sample) => sample.dataQuality !== 1);
        if (invalid.length > 0) {
            throw this._configurationError(
                'ER5_RIEKE_CALSPEC_DATA_QUALITY_INVALID',
                `${operatorId} requires DATAQUAL=1 for every selected CALSPEC row.`,
                { invalidSourceSampleIndices: invalid.map((sample) => sample.sourceSampleIndex) },
            );
        }
    }

    /**
     * Linearly interpolate one converted sample property.
     *
     * @param {RiekeConvertedCalspecSample} sample0 - Lower source sample.
     * @param {RiekeConvertedCalspecSample} sample1 - Upper source sample.
     * @param {keyof RiekeConvertedCalspecSample} field - Numeric property.
     * @param {number} wavelengthNanometers - Interpolation wavelength.
     * @returns {number} Interpolated value.
     */
    _interpolateVisible(sample0, sample1, field, wavelengthNanometers) {
        const fraction = (wavelengthNanometers - sample0.wavelengthNanometers)
            / (sample1.wavelengthNanometers - sample0.wavelengthNanometers);
        return sample0[field] + (sample1[field] - sample0[field]) * fraction;
    }

    /**
     * Build one exact 25 Angstrom visible-band CALSPEC average.
     *
     * @param {readonly Readonly<Record<string, number>>[]} sourceSamples - Parsed rows.
     * @returns {RiekeSiriusVisibleEvaluation} Visible operator and reference inputs.
     */
    _evaluateVisible(sourceSamples) {
        const convertedSamples = sourceSamples.map((sample, index) =>
            this._convertSample(sample, index));
        const usedIndices = new Set();
        const segments = [];
        let fluxIntegral = 0;
        let statisticalErrorIntegral = 0;
        let systematicErrorIntegral = 0;
        for (let index = 0; index < convertedSamples.length - 1; index += 1) {
            const sample0 = convertedSamples[index];
            const sample1 = convertedSamples[index + 1];
            const segmentLower = Math.max(
                VISIBLE_LOWER_NANOMETERS,
                sample0.wavelengthNanometers,
            );
            const segmentUpper = Math.min(
                VISIBLE_UPPER_NANOMETERS,
                sample1.wavelengthNanometers,
            );
            if (segmentUpper <= segmentLower) {
                continue;
            }
            usedIndices.add(index);
            usedIndices.add(index + 1);
            const flux0 = this._interpolateVisible(
                sample0,
                sample1,
                'fluxWattsPerSquareMeterPerNanometer',
                segmentLower,
            );
            const flux1 = this._interpolateVisible(
                sample0,
                sample1,
                'fluxWattsPerSquareMeterPerNanometer',
                segmentUpper,
            );
            const statistical0 = this._interpolateVisible(
                sample0,
                sample1,
                'statisticalErrorWattsPerSquareMeterPerNanometer',
                segmentLower,
            );
            const statistical1 = this._interpolateVisible(
                sample0,
                sample1,
                'statisticalErrorWattsPerSquareMeterPerNanometer',
                segmentUpper,
            );
            const systematic0 = this._interpolateVisible(
                sample0,
                sample1,
                'systematicErrorWattsPerSquareMeterPerNanometer',
                segmentLower,
            );
            const systematic1 = this._interpolateVisible(
                sample0,
                sample1,
                'systematicErrorWattsPerSquareMeterPerNanometer',
                segmentUpper,
            );
            const width = segmentUpper - segmentLower;
            const fluxContribution = (flux0 + flux1) * width / 2;
            const statisticalContribution = (statistical0 + statistical1) * width / 2;
            const systematicContribution = (systematic0 + systematic1) * width / 2;
            fluxIntegral += fluxContribution;
            statisticalErrorIntegral += statisticalContribution;
            systematicErrorIntegral += systematicContribution;
            segments.push(Object.freeze({
                lowerSourceSampleIndex: index,
                upperSourceSampleIndex: index + 1,
                lowerNanometers: segmentLower,
                upperNanometers: segmentUpper,
                lowerFluxWattsPerSquareMeterPerNanometer: flux0,
                upperFluxWattsPerSquareMeterPerNanometer: flux1,
                fluxIntegralContributionWattsPerSquareMeter: fluxContribution,
                fullyCorrelatedStatisticalErrorIntegralContributionWattsPerSquareMeter:
                    statisticalContribution,
                fullyCorrelatedSystematicErrorIntegralContributionWattsPerSquareMeter:
                    systematicContribution,
            }));
        }
        const selectedSamples = Object.freeze([...usedIndices]
            .sort((left, right) => left - right)
            .map((index) => convertedSamples[index]));
        this._requireGoodDataQuality(selectedSamples, 'Rieke visible operator');
        if (segments.length === 0) {
            throw this._configurationError(
                'ER5_RIEKE_VISIBLE_SUPPORT_MISSING',
                'CALSPEC does not cover the Rieke visible averaging interval.',
            );
        }
        const widthNanometers = VISIBLE_UPPER_NANOMETERS - VISIBLE_LOWER_NANOMETERS;
        const value = fluxIntegral / widthNanometers;
        const expectedResidual = value
            - EXPECTED_VISIBLE_CALSPEC_VALUE_WATTS_PER_SQUARE_METER_PER_NANOMETER;
        if (
            Math.abs(expectedResidual)
            > EXPECTED_VISIBLE_CALSPEC_VALUE_WATTS_PER_SQUARE_METER_PER_NANOMETER
                * VISIBLE_ORACLE_RELATIVE_TOLERANCE
        ) {
            throw this._configurationError(
                'ER5_RIEKE_VISIBLE_CALSPEC_ORACLE_MISMATCH',
                'Rieke visible operator no longer reproduces the pinned CALSPEC oracle.',
                { expected: EXPECTED_VISIBLE_CALSPEC_VALUE_WATTS_PER_SQUARE_METER_PER_NANOMETER,
                    actual: value, residual: expectedResidual },
            );
        }
        const reference = Object.freeze({
            valueWattsPerSquareMeterPerNanometer:
                VISIBLE_REFERENCE_VALUE_WATTS_PER_SQUARE_METER_PER_NANOMETER,
            standardUncertaintyWattsPerSquareMeterPerNanometer:
                VISIBLE_REFERENCE_UNCERTAINTY_WATTS_PER_SQUARE_METER_PER_NANOMETER,
            units: 'W m^-2 nm^-1',
            originalValueWattsPerSquareCentimeterPerMicrometer: 13.436e-12,
            originalStandardUncertaintyWattsPerSquareCentimeterPerMicrometer: 0.081e-12,
            originalUnits: 'W cm^-2 um^-1',
            conversionFormula: 'W cm^-2 um^-1 * 10 = W m^-2 nm^-1',
            sourceLocation: 'Rieke et al. (2023), Table 1, equivalent for Sirius',
        });
        return Object.freeze({
            operator: Object.freeze({
                id: 'rieke-visible-25-angstrom-piecewise-linear-average-v1',
                quantity: 'spectral-irradiance-density',
                units: 'W m^-2 nm^-1',
                lowerNanometers: VISIBLE_LOWER_NANOMETERS,
                upperNanometers: VISIBLE_UPPER_NANOMETERS,
                widthNanometers,
                interpolation: 'piecewise-linear on native CALSPEC wavelength samples',
                formula:
                    'mean(F_lambda) = integral_554.5^557.0 F_lambda d(lambda) / 2.5 nm',
                sourceSampleIndices: Object.freeze(selectedSamples.map((sample) =>
                    sample.sourceSampleIndex)),
                selectedSampleCount: selectedSamples.length,
                nativeSamplesInsideIntervalCount: selectedSamples.filter((sample) =>
                    sample.wavelengthNanometers >= VISIBLE_LOWER_NANOMETERS
                    && sample.wavelengthNanometers <= VISIBLE_UPPER_NANOMETERS).length,
                contributingSegmentCount: segments.length,
                selectedSamples,
                segments: Object.freeze(segments),
                integratedFluxWattsPerSquareMeter: fluxIntegral,
                valueWattsPerSquareMeterPerNanometer: value,
                conservativeFullyCorrelatedStatisticalErrorWattsPerSquareMeterPerNanometer:
                    statisticalErrorIntegral / widthNanometers,
                fullyCorrelatedSystematicErrorWattsPerSquareMeterPerNanometer:
                    systematicErrorIntegral / widthNanometers,
                oracle: Object.freeze({
                    expectedValueWattsPerSquareMeterPerNanometer:
                        EXPECTED_VISIBLE_CALSPEC_VALUE_WATTS_PER_SQUARE_METER_PER_NANOMETER,
                    relativeTolerance: VISIBLE_ORACLE_RELATIVE_TOLERANCE,
                    residualWattsPerSquareMeterPerNanometer: expectedResidual,
                }),
            }),
            reference,
            comparisonInputs: Object.freeze({
                candidateValue: value,
                referenceValue: reference.valueWattsPerSquareMeterPerNanometer,
                referenceStandardUncertainty:
                    reference.standardUncertaintyWattsPerSquareMeterPerNanometer,
                candidateConservativeFullyCorrelatedStatisticalError:
                    statisticalErrorIntegral / widthNanometers,
                candidateFullyCorrelatedSystematicError:
                    systematicErrorIntegral / widthNanometers,
                absoluteDifference:
                    Math.abs(value - reference.valueWattsPerSquareMeterPerNanometer),
                signedRelativeDifference:
                    value / reference.valueWattsPerSquareMeterPerNanometer - 1,
                units: 'W m^-2 nm^-1',
            }),
            qualifications: Object.freeze({
                smoothing:
                    'The 25 Angstrom interval is the publication-described fiducial smoothing convention; the evaluator uses an exact piecewise-linear average rather than a point sample.',
                independence:
                    'The publication supplies external absolute visible anchors, but its combined Sirius result uses CALSPEC in some relative-transfer and continuum steps; treat it as an external reference that is not fully statistically independent of CALSPEC.',
            }),
        });
    }

    /**
     * Build the native-sample near-infrared continuum fit and MSX comparison.
     *
     * @param {readonly Readonly<Record<string, number>>[]} sourceSamples - Parsed rows.
     * @returns {RiekeSiriusNearInfraredEvaluation} Near-infrared operator and inputs.
     */
    _evaluateNearInfrared(sourceSamples) {
        const candidateSamples = Object.freeze(sourceSamples
            .map((sample, index) => this._convertSample(sample, index))
            .filter((sample) => sample.wavelengthMicrometers >= NIR_FIT_LOWER_MICROMETERS
                && sample.wavelengthMicrometers <= NIR_FIT_UPPER_MICROMETERS));
        this._requireGoodDataQuality(candidateSamples, 'Rieke near-infrared operator');
        const excludedSamples = Object.freeze(candidateSamples.filter((sample) =>
            sample.wavelengthMicrometers >= NIR_EXCLUSION_LOWER_MICROMETERS
            && sample.wavelengthMicrometers <= NIR_EXCLUSION_UPPER_MICROMETERS));
        const fitSamples = Object.freeze(candidateSamples.filter((sample) =>
            sample.wavelengthMicrometers < NIR_EXCLUSION_LOWER_MICROMETERS
            || sample.wavelengthMicrometers > NIR_EXCLUSION_UPPER_MICROMETERS));
        if (fitSamples.length < 3 || excludedSamples.length === 0) {
            throw this._configurationError(
                'ER5_RIEKE_NIR_SAMPLE_SELECTION_INVALID',
                'CALSPEC does not supply the required native near-infrared fit and exclusion samples.',
                { candidateCount: candidateSamples.length, fitCount: fitSamples.length,
                    excludedCount: excludedSamples.length },
            );
        }

        const transformed = fitSamples.map((sample) => Object.freeze({
            sourceSampleIndex: sample.sourceSampleIndex,
            logWavelengthMicrometers: Math.log(sample.wavelengthMicrometers),
            logFluxWattsPerSquareCentimeterPerMicrometer:
                Math.log(sample.fluxWattsPerSquareCentimeterPerMicrometer),
        }));
        const count = transformed.length;
        const sumX = transformed.reduce((sum, sample) =>
            sum + sample.logWavelengthMicrometers, 0);
        const sumY = transformed.reduce((sum, sample) =>
            sum + sample.logFluxWattsPerSquareCentimeterPerMicrometer, 0);
        const sumXX = transformed.reduce((sum, sample) =>
            sum + sample.logWavelengthMicrometers ** 2, 0);
        const sumXY = transformed.reduce((sum, sample) => sum
            + sample.logWavelengthMicrometers
                * sample.logFluxWattsPerSquareCentimeterPerMicrometer, 0);
        const denominator = count * sumXX - sumX ** 2;
        if (!Number.isFinite(denominator) || denominator <= 0) {
            throw this._configurationError(
                'ER5_RIEKE_NIR_FIT_SINGULAR',
                'Rieke near-infrared logarithmic fit is singular.',
            );
        }
        const slope = (count * sumXY - sumX * sumY) / denominator;
        const intercept = (sumY - slope * sumX) / count;
        const targetLogWavelength = Math.log(NIR_EVALUATION_MICROMETERS);
        const targetLogFlux = intercept + slope * targetLogWavelength;
        const value = Math.exp(targetLogFlux);
        if (!Number.isFinite(value) || value <= 0) {
            throw this._configurationError(
                'ER5_RIEKE_NIR_FIT_RESULT_INVALID',
                'Rieke near-infrared logarithmic fit produced an invalid flux.',
            );
        }

        const meanX = sumX / count;
        const meanY = sumY / count;
        const sumSquaredX = transformed.reduce((sum, sample) =>
            sum + (sample.logWavelengthMicrometers - meanX) ** 2, 0);
        const sumSquaredResidual = transformed.reduce((sum, sample) => {
            const predicted = intercept + slope * sample.logWavelengthMicrometers;
            return sum
                + (sample.logFluxWattsPerSquareCentimeterPerMicrometer - predicted) ** 2;
        }, 0);
        const totalSumSquaredY = transformed.reduce((sum, sample) => sum
            + (sample.logFluxWattsPerSquareCentimeterPerMicrometer - meanY) ** 2, 0);
        const degreesOfFreedom = count - 2;
        const residualStandardDeviationLogFlux =
            Math.sqrt(sumSquaredResidual / degreesOfFreedom);
        const targetMeanFitStandardErrorLogFlux = residualStandardDeviationLogFlux * Math.sqrt(
            1 / count + (targetLogWavelength - meanX) ** 2 / sumSquaredX,
        );
        const expectedResidual = value
            - EXPECTED_NIR_CALSPEC_VALUE_WATTS_PER_SQUARE_CENTIMETER_PER_MICROMETER;
        if (
            Math.abs(expectedResidual)
            > EXPECTED_NIR_CALSPEC_VALUE_WATTS_PER_SQUARE_CENTIMETER_PER_MICROMETER
                * NIR_ORACLE_RELATIVE_TOLERANCE
        ) {
            throw this._configurationError(
                'ER5_RIEKE_NIR_CALSPEC_ORACLE_MISMATCH',
                'Rieke near-infrared operator no longer reproduces the pinned CALSPEC oracle.',
                { expected:
                    EXPECTED_NIR_CALSPEC_VALUE_WATTS_PER_SQUARE_CENTIMETER_PER_MICROMETER,
                actual: value, residual: expectedResidual },
            );
        }
        const reference = Object.freeze({
            valueWattsPerSquareCentimeterPerMicrometer:
                NIR_REFERENCE_VALUE_WATTS_PER_SQUARE_CENTIMETER_PER_MICROMETER,
            standardUncertaintyWattsPerSquareCentimeterPerMicrometer:
                NIR_REFERENCE_UNCERTAINTY_WATTS_PER_SQUARE_CENTIMETER_PER_MICROMETER,
            units: 'W cm^-2 um^-1',
            sourceLocation: 'Rieke et al. (2023), Table 3, method 1, MSX',
            transferWavelengthsMicrometers: Object.freeze([8, 12, 15, 21]),
        });
        return Object.freeze({
            operator: Object.freeze({
                id: 'rieke-nir-native-log-log-power-law-v1',
                quantity: 'spectral-irradiance-density',
                units: 'W cm^-2 um^-1',
                fitDomainMicrometers: Object.freeze([
                    NIR_FIT_LOWER_MICROMETERS,
                    NIR_FIT_UPPER_MICROMETERS,
                ]),
                excludedDomainMicrometers: Object.freeze([
                    NIR_EXCLUSION_LOWER_MICROMETERS,
                    NIR_EXCLUSION_UPPER_MICROMETERS,
                ]),
                evaluationWavelengthMicrometers: NIR_EVALUATION_MICROMETERS,
                samplePolicy:
                    'inclusive native CALSPEC samples; exclude both endpoints of 2.14..2.18 um',
                fitMethod: 'unweighted ordinary least squares in natural-log space',
                formula:
                    'ln(F_i)=intercept+slope*ln(lambda_i); F(2.1603)=exp(intercept+slope*ln(2.1603))',
                candidateSampleCount: candidateSamples.length,
                selectedSampleCount: fitSamples.length,
                excludedSampleCount: excludedSamples.length,
                candidateSourceSampleIndices: Object.freeze(candidateSamples.map((sample) =>
                    sample.sourceSampleIndex)),
                selectedSourceSampleIndices: Object.freeze(fitSamples.map((sample) =>
                    sample.sourceSampleIndex)),
                excludedSourceSampleIndices: Object.freeze(excludedSamples.map((sample) =>
                    sample.sourceSampleIndex)),
                fitSamples,
                excludedSamples,
                transformedSamples: Object.freeze(transformed),
                normalEquationSums: Object.freeze({
                    count,
                    sumLogWavelength: sumX,
                    sumLogFlux: sumY,
                    sumSquaredLogWavelength: sumXX,
                    sumLogWavelengthLogFlux: sumXY,
                    denominator,
                }),
                fit: Object.freeze({
                    intercept,
                    slope,
                    evaluationLogWavelength: targetLogWavelength,
                    evaluationLogFlux: targetLogFlux,
                    valueWattsPerSquareCentimeterPerMicrometer: value,
                }),
                residualDiagnostics: Object.freeze({
                    degreesOfFreedom,
                    sumSquaredResidualLogFlux: sumSquaredResidual,
                    rootMeanSquaredResidualLogFlux:
                        Math.sqrt(sumSquaredResidual / count),
                    residualStandardDeviationLogFlux,
                    coefficientOfDetermination:
                        totalSumSquaredY === 0 ? 1 : 1 - sumSquaredResidual / totalSumSquaredY,
                    targetMeanFitStandardErrorLogFlux,
                }),
                oracle: Object.freeze({
                    expectedValueWattsPerSquareCentimeterPerMicrometer:
                        EXPECTED_NIR_CALSPEC_VALUE_WATTS_PER_SQUARE_CENTIMETER_PER_MICROMETER,
                    relativeTolerance: NIR_ORACLE_RELATIVE_TOLERANCE,
                    residualWattsPerSquareCentimeterPerMicrometer: expectedResidual,
                }),
            }),
            reference,
            comparisonInputs: Object.freeze({
                candidateValue: value,
                referenceValue: reference.valueWattsPerSquareCentimeterPerMicrometer,
                referenceStandardUncertainty:
                    reference.standardUncertaintyWattsPerSquareCentimeterPerMicrometer,
                fitResidualStandardDeviationLogFlux: residualStandardDeviationLogFlux,
                targetMeanFitStandardErrorLogFlux,
                maximumSelectedRelativeStatisticalError: Math.max(...fitSamples.map((sample) =>
                    sample.statisticalErrorWattsPerSquareCentimeterPerMicrometer
                    / sample.fluxWattsPerSquareCentimeterPerMicrometer)),
                maximumSelectedRelativeSystematicError: Math.max(...fitSamples.map((sample) =>
                    sample.systematicErrorWattsPerSquareCentimeterPerMicrometer
                    / sample.fluxWattsPerSquareCentimeterPerMicrometer)),
                absoluteDifference: Math.abs(
                    value - reference.valueWattsPerSquareCentimeterPerMicrometer,
                ),
                signedRelativeDifference:
                    value / reference.valueWattsPerSquareCentimeterPerMicrometer - 1,
                units: 'W cm^-2 um^-1',
            }),
            qualifications: Object.freeze({
                sourceSegment:
                    'The 2.00..2.31 um CALSPEC rows are the retained Kurucz special-model segment, not direct STIS measurements.',
                lineExclusion:
                    'The 2.14..2.18 um interval is excluded so the continuum fit does not use the Brackett-gamma absorption region containing the 2.1603 um evaluation point.',
                independence:
                    'The MSX reference-sphere experiment supplies an external absolute radiometric anchor, but transfer from its mid-infrared bands to 2.1603 um depends on a Sirius spectral template; the comparison is not two independent direct measurements at 2.1603 um.',
            }),
        });
    }

    /**
     * Evaluate pinned Sirius CALSPEC output against the retained Rieke references.
     *
     * @param {Readonly<Record<string, unknown>>} parsedCalspec - Output from
     * CalspecFitsSpectrumReader.read(...).
     * @returns {Promise<RiekeSiriusReferenceEvaluation>} Immutable operator results,
     * comparison inputs, and provenance without an acceptance decision.
     */
    async evaluate(parsedCalspec) {
        const publicationPath = resolve(PUBLICATION_FIXTURE_PATH);
        const publicationBytes = await readFile(publicationPath);
        const publicationHashSha256 = this._hashBytes(publicationBytes);
        if (publicationBytes.length !== FIXTURE.byteLength) {
            throw this._configurationError(
                'ER5_RIEKE_PUBLICATION_BYTE_LENGTH_MISMATCH',
                'Rieke publication byte length does not match the pinned manifest.',
                { expected: FIXTURE.byteLength, actual: publicationBytes.length },
            );
        }
        if (publicationHashSha256 !== FIXTURE.sourceHashSha256) {
            throw this._configurationError(
                'ER5_RIEKE_PUBLICATION_HASH_MISMATCH',
                'Rieke publication SHA-256 does not match the retained provenance input.',
                { expected: FIXTURE.sourceHashSha256, actual: publicationHashSha256 },
            );
        }
        const samples = this._validateParsedCalspec(parsedCalspec);
        const visible = this._evaluateVisible(samples);
        const nearInfrared = this._evaluateNearInfrared(samples);
        return Object.freeze({
            modelId: 'rieke-2023-sirius-reference-evaluation-v1',
            visible,
            nearInfrared,
            provenance: Object.freeze({
                publicationPath,
                publicationFileName: FIXTURE.fileName,
                publicationByteLength: publicationBytes.length,
                publicationHashSha256,
                sourceId: FIXTURE.sourceId,
                sourceVersion: FIXTURE.sourceVersion,
                publicationDoi: PUBLICATION_DOI,
                publicationUrl: `https://doi.org/${PUBLICATION_DOI}`,
                pinnedUrl: FIXTURE.pinnedUrl,
                publicationTitle:
                    'Absolute Calibration. III. Improved Absolute Calibration for the Visible through the Mid-infrared',
                calspec: Object.freeze({
                    filename: parsedCalspec.header.filename,
                    targetId: parsedCalspec.header.targetId,
                    pedigree: parsedCalspec.header.pedigree,
                    rowCount: parsedCalspec.rowCount,
                    hduName: parsedCalspec.hduName,
                    wavelengthUnits: parsedCalspec.wavelengthUnits,
                    fluxUnits: parsedCalspec.fluxUnits,
                    wavelengthState: parsedCalspec.wavelengthState,
                }),
                conversions: Object.freeze({
                    wavelengthNanometers: 'Angstrom / 10',
                    wavelengthMicrometers: 'Angstrom / 10000',
                    visibleFluxDensity: 'FLAM * 0.01 = W m^-2 nm^-1',
                    nearInfraredFluxDensity: 'FLAM * 0.001 = W cm^-2 um^-1',
                }),
            }),
            qualifications: Object.freeze({
                decisionBoundary:
                    'This evaluator supplies candidate/reference values and uncertainty inputs only; the numbered runner owns tolerance formulation and acceptance.',
                dataQuality:
                    'Every CALSPEC row used by either operator is required to have DATAQUAL=1.',
            }),
        });
    }
}
