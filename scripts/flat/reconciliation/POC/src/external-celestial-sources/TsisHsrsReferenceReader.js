// References:
// - https://doi.org/10.1029/2022EA002637, TSIS-1 HSRS v2 reference spectrum.
// - https://doi.org/10.25980/ta3f-7h90, versioned TSIS-1 HSRS dataset.
// - https://lasp.colorado.edu/lisird/latis/dap/tsis1_hsrs, official LISIRD dataset.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER5.

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { EXTERNAL_CELESTIAL_FIXTURE_MANIFEST } from './fixtureManifest.js';

const FIXTURE = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.tsis1HsrsV2;
const FIXTURE_PATH =
    `scripts/flat/reconciliation/POC/src/external-celestial-sources/fixtures/${FIXTURE.fileName}`;
const EXPECTED_COLUMNS = Object.freeze([
    'wavelength (nm)',
    'irradiance (W/m^2/nm)',
    'uncertainty (W/m^2/nm)',
    'bandwidth (nm)',
]);
const EXPECTED_ROW_COUNT = FIXTURE.sampleCount;
const EXPECTED_MINIMUM_NANOMETERS = FIXTURE.wavelengthSupportNanometers[0];
const EXPECTED_MAXIMUM_NANOMETERS = FIXTURE.wavelengthSupportNanometers[1];
const EXPECTED_GRID_STEP_NANOMETERS = 0.1;
const EXPECTED_BANDWIDTH_NANOMETERS = 1;
const GRID_TOLERANCE_NANOMETERS = 1e-9;

const VISIBLE_LOWER_NANOMETERS = FIXTURE.commonSupportGateNanometers[0];
const VISIBLE_UPPER_NANOMETERS = FIXTURE.commonSupportGateNanometers[1];
const EXPECTED_VISIBLE_INTEGRAL_WATTS_PER_SQUARE_METER = 739.390623798623;
const EXPECTED_VISIBLE_UNCERTAINTY_WATTS_PER_SQUARE_METER = 2.876997770614;
const VISIBLE_INTEGRAL_TOLERANCE_WATTS_PER_SQUARE_METER = 1e-10;
const VISIBLE_UNCERTAINTY_TOLERANCE_WATTS_PER_SQUARE_METER = 1e-12;

export default class TsisHsrsReferenceReader {
    /**
     * Create one fail-loud fixture error.
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
     * @param {Buffer} bytes - Complete fixture bytes.
     * @returns {string} Lowercase SHA-256 digest.
     */
    _hashBytes(bytes) {
        return createHash('sha256').update(bytes).digest('hex');
    }

    /**
     * Parse and validate the exact official CSV schema and wavelength grid.
     *
     * @param {string} sourceText - Complete UTF-8 CSV text.
     * @returns {readonly TsisHsrsReferenceSample[]} Frozen spectral samples.
     */
    _parseSamples(sourceText) {
        if (sourceText.includes('\uFFFD')) {
            throw this._configurationError(
                'ER5_TSIS_HSRS_UTF8_INVALID',
                'TSIS-1 HSRS fixture is not valid UTF-8 text.',
            );
        }
        const lines = sourceText.split(/\r?\n/);
        if (lines.at(-1) === '') {
            lines.pop();
        }
        if (lines.length !== EXPECTED_ROW_COUNT + 1) {
            throw this._configurationError(
                'ER5_TSIS_HSRS_ROW_COUNT_MISMATCH',
                'TSIS-1 HSRS fixture does not contain the official row count.',
                { expected: EXPECTED_ROW_COUNT, actual: lines.length - 1 },
            );
        }

        const columns = lines[0].split(',');
        if (
            columns.length !== EXPECTED_COLUMNS.length
            || columns.some((column, index) => column !== EXPECTED_COLUMNS[index])
        ) {
            throw this._configurationError(
                'ER5_TSIS_HSRS_COLUMNS_MISMATCH',
                'TSIS-1 HSRS columns or encoded units do not match the official CSV schema.',
                { expected: EXPECTED_COLUMNS, actual: columns },
            );
        }

        const samples = lines.slice(1).map((line, index) => {
            const fields = line.split(',');
            if (
                fields.length !== EXPECTED_COLUMNS.length
                || fields.some((field) => field === '' || field !== field.trim())
            ) {
                throw this._configurationError(
                    'ER5_TSIS_HSRS_ROW_SCHEMA_INVALID',
                    `TSIS-1 HSRS row ${index} does not contain four plain numeric fields.`,
                );
            }
            const values = fields.map(Number);
            if (!values.every(Number.isFinite)) {
                throw this._configurationError(
                    'ER5_TSIS_HSRS_VALUE_NONFINITE',
                    `TSIS-1 HSRS row ${index} contains a nonfinite value.`,
                );
            }
            const [
                wavelengthNanometers,
                irradianceWattsPerSquareMeterPerNanometer,
                standardUncertaintyWattsPerSquareMeterPerNanometer,
                bandwidthNanometers,
            ] = values;
            const expectedWavelength =
                EXPECTED_MINIMUM_NANOMETERS + index * EXPECTED_GRID_STEP_NANOMETERS;
            if (Math.abs(wavelengthNanometers - expectedWavelength) > GRID_TOLERANCE_NANOMETERS) {
                throw this._configurationError(
                    'ER5_TSIS_HSRS_GRID_MISMATCH',
                    `TSIS-1 HSRS row ${index} is not on the official 0.1 nm grid.`,
                    { expected: expectedWavelength, actual: wavelengthNanometers },
                );
            }
            if (
                irradianceWattsPerSquareMeterPerNanometer < 0
                || standardUncertaintyWattsPerSquareMeterPerNanometer < 0
            ) {
                throw this._configurationError(
                    'ER5_TSIS_HSRS_NEGATIVE_SPECTRAL_VALUE',
                    `TSIS-1 HSRS row ${index} contains a negative irradiance or uncertainty.`,
                );
            }
            if (bandwidthNanometers !== EXPECTED_BANDWIDTH_NANOMETERS) {
                throw this._configurationError(
                    'ER5_TSIS_HSRS_BANDWIDTH_MISMATCH',
                    `TSIS-1 HSRS row ${index} does not retain the official 1 nm bandwidth.`,
                    { expected: EXPECTED_BANDWIDTH_NANOMETERS, actual: bandwidthNanometers },
                );
            }
            return Object.freeze({
                sourceRowIndex: index,
                wavelengthNanometers,
                irradianceWattsPerSquareMeterPerNanometer,
                standardUncertaintyWattsPerSquareMeterPerNanometer,
                bandwidthNanometers,
            });
        });
        if (
            samples[0].wavelengthNanometers !== EXPECTED_MINIMUM_NANOMETERS
            || samples.at(-1).wavelengthNanometers !== EXPECTED_MAXIMUM_NANOMETERS
        ) {
            throw this._configurationError(
                'ER5_TSIS_HSRS_SUPPORT_MISMATCH',
                'TSIS-1 HSRS wavelength support does not match the official retained dataset.',
            );
        }
        return Object.freeze(samples);
    }

    /**
     * Integrate one sample property exactly under piecewise-linear interpolation.
     *
     * @param {readonly TsisHsrsReferenceSample[]} samples - Validated ordered samples.
     * @param {keyof TsisHsrsReferenceSample} field - Numeric density property to integrate.
     * @param {number} lowerNanometers - Inclusive interval lower bound.
     * @param {number} upperNanometers - Inclusive interval upper bound.
     * @returns {Readonly<Record<string, number>>} Integral and segment count.
     */
    _integratePiecewiseLinear(samples, field, lowerNanometers, upperNanometers) {
        if (
            samples[0].wavelengthNanometers > lowerNanometers
            || samples.at(-1).wavelengthNanometers < upperNanometers
            || !(lowerNanometers < upperNanometers)
        ) {
            throw this._configurationError(
                'ER5_TSIS_HSRS_INTEGRATION_SUPPORT_INVALID',
                'TSIS-1 HSRS integration interval requires unsupported extrapolation.',
            );
        }
        let integratedValue = 0;
        let contributingSegmentCount = 0;
        for (let index = 0; index < samples.length - 1; index += 1) {
            const sample0 = samples[index];
            const sample1 = samples[index + 1];
            const segmentLower = Math.max(lowerNanometers, sample0.wavelengthNanometers);
            const segmentUpper = Math.min(upperNanometers, sample1.wavelengthNanometers);
            if (segmentUpper <= segmentLower) {
                continue;
            }
            const span = sample1.wavelengthNanometers - sample0.wavelengthNanometers;
            const value0 = sample0[field] + (sample1[field] - sample0[field])
                * (segmentLower - sample0.wavelengthNanometers) / span;
            const value1 = sample0[field] + (sample1[field] - sample0[field])
                * (segmentUpper - sample0.wavelengthNanometers) / span;
            integratedValue += (value0 + value1) * (segmentUpper - segmentLower) / 2;
            contributingSegmentCount += 1;
        }
        if (!Number.isFinite(integratedValue) || integratedValue < 0) {
            throw this._configurationError(
                'ER5_TSIS_HSRS_INTEGRAL_INVALID',
                'TSIS-1 HSRS piecewise-linear integration produced an invalid result.',
            );
        }
        return Object.freeze({ integratedValue, contributingSegmentCount });
    }

    /**
     * Build and verify the exact 360..830 nm solar reference operator.
     *
     * @param {readonly TsisHsrsReferenceSample[]} samples - Validated ordered samples.
     * @returns {TsisHsrsVisibleIntegral} Immutable visible-band operator result.
     */
    _buildVisibleIntegral(samples) {
        const irradiance = this._integratePiecewiseLinear(
            samples,
            'irradianceWattsPerSquareMeterPerNanometer',
            VISIBLE_LOWER_NANOMETERS,
            VISIBLE_UPPER_NANOMETERS,
        );
        const uncertainty = this._integratePiecewiseLinear(
            samples,
            'standardUncertaintyWattsPerSquareMeterPerNanometer',
            VISIBLE_LOWER_NANOMETERS,
            VISIBLE_UPPER_NANOMETERS,
        );
        const irradianceResidual = irradiance.integratedValue
            - EXPECTED_VISIBLE_INTEGRAL_WATTS_PER_SQUARE_METER;
        const uncertaintyResidual = uncertainty.integratedValue
            - EXPECTED_VISIBLE_UNCERTAINTY_WATTS_PER_SQUARE_METER;
        if (Math.abs(irradianceResidual) > VISIBLE_INTEGRAL_TOLERANCE_WATTS_PER_SQUARE_METER) {
            throw this._configurationError(
                'ER5_TSIS_HSRS_VISIBLE_INTEGRAL_MISMATCH',
                'TSIS-1 HSRS visible irradiance integral does not match the sealed oracle.',
                { expected: EXPECTED_VISIBLE_INTEGRAL_WATTS_PER_SQUARE_METER,
                    actual: irradiance.integratedValue, residual: irradianceResidual },
            );
        }
        if (
            Math.abs(uncertaintyResidual)
            > VISIBLE_UNCERTAINTY_TOLERANCE_WATTS_PER_SQUARE_METER
        ) {
            throw this._configurationError(
                'ER5_TSIS_HSRS_VISIBLE_UNCERTAINTY_MISMATCH',
                'TSIS-1 HSRS visible uncertainty integral does not match the sealed oracle.',
                { expected: EXPECTED_VISIBLE_UNCERTAINTY_WATTS_PER_SQUARE_METER,
                    actual: uncertainty.integratedValue, residual: uncertaintyResidual },
            );
        }
        const widthNanometers = VISIBLE_UPPER_NANOMETERS - VISIBLE_LOWER_NANOMETERS;
        const selectedSourceRowIndices = Object.freeze(samples
            .filter((sample) => sample.wavelengthNanometers >= VISIBLE_LOWER_NANOMETERS
                && sample.wavelengthNanometers <= VISIBLE_UPPER_NANOMETERS)
            .map((sample) => sample.sourceRowIndex));
        return Object.freeze({
            id: 'tsis1-hsrs-exact-visible-360-830-integral-v1',
            quantity: 'solar-spectral-irradiance-density-integrated-over-wavelength',
            units: 'W m^-2',
            lowerNanometers: VISIBLE_LOWER_NANOMETERS,
            upperNanometers: VISIBLE_UPPER_NANOMETERS,
            widthNanometers,
            interpolation: 'piecewise-linear on the native 0.1 nm sample grid',
            irradianceFormula:
                'I = integral_360^830 E_lambda d(lambda), evaluated by exact clipped trapezoids',
            uncertaintyFormula:
                'u(I) = integral_360^830 u(E_lambda) d(lambda) for corr(lambda_i,lambda_j)=+1',
            uncertaintyCorrelationModel: 'fully-correlated-across-wavelength-k1',
            selectedSourceRowIndices,
            selectedSampleCount: selectedSourceRowIndices.length,
            contributingSegmentCount: irradiance.contributingSegmentCount,
            integratedIrradianceWattsPerSquareMeter: irradiance.integratedValue,
            averageIrradianceWattsPerSquareMeterPerNanometer:
                irradiance.integratedValue / widthNanometers,
            fullyCorrelatedStandardUncertaintyWattsPerSquareMeter:
                uncertainty.integratedValue,
            fullyCorrelatedAverageStandardUncertaintyWattsPerSquareMeterPerNanometer:
                uncertainty.integratedValue / widthNanometers,
            oracle: Object.freeze({
                expectedIntegratedIrradianceWattsPerSquareMeter:
                    EXPECTED_VISIBLE_INTEGRAL_WATTS_PER_SQUARE_METER,
                irradianceToleranceWattsPerSquareMeter:
                    VISIBLE_INTEGRAL_TOLERANCE_WATTS_PER_SQUARE_METER,
                irradianceResidualWattsPerSquareMeter: irradianceResidual,
                expectedFullyCorrelatedStandardUncertaintyWattsPerSquareMeter:
                    EXPECTED_VISIBLE_UNCERTAINTY_WATTS_PER_SQUARE_METER,
                uncertaintyToleranceWattsPerSquareMeter:
                    VISIBLE_UNCERTAINTY_TOLERANCE_WATTS_PER_SQUARE_METER,
                uncertaintyResidualWattsPerSquareMeter: uncertaintyResidual,
            }),
        });
    }

    /**
     * Read and verify the retained TSIS-1 HSRS 1 nm reference fixture.
     *
     * @returns {Promise<TsisHsrsReferenceFixture>} Immutable samples, operator, and provenance.
     */
    async read() {
        const path = resolve(FIXTURE_PATH);
        const bytes = await readFile(path);
        const sourceHashSha256 = this._hashBytes(bytes);
        if (bytes.length !== FIXTURE.byteLength) {
            throw this._configurationError(
                'ER5_TSIS_HSRS_BYTE_LENGTH_MISMATCH',
                'TSIS-1 HSRS fixture byte length does not match the pinned manifest.',
                { expected: FIXTURE.byteLength, actual: bytes.length },
            );
        }
        if (sourceHashSha256 !== FIXTURE.sourceHashSha256) {
            throw this._configurationError(
                'ER5_TSIS_HSRS_HASH_MISMATCH',
                'TSIS-1 HSRS fixture SHA-256 does not match the pinned authoritative payload.',
                { expected: FIXTURE.sourceHashSha256, actual: sourceHashSha256 },
            );
        }
        const samples = this._parseSamples(bytes.toString('utf8'));
        const visibleIntegral = this._buildVisibleIntegral(samples);
        return Object.freeze({
            samples,
            visibleIntegral,
            schema: Object.freeze({
                format: 'CSV',
                columns: EXPECTED_COLUMNS,
                rowCount: EXPECTED_ROW_COUNT,
                wavelengthGrid: Object.freeze({
                    units: 'nm',
                    minimum: EXPECTED_MINIMUM_NANOMETERS,
                    maximum: EXPECTED_MAXIMUM_NANOMETERS,
                    step: EXPECTED_GRID_STEP_NANOMETERS,
                    bandwidthColumnValue: EXPECTED_BANDWIDTH_NANOMETERS,
                }),
                irradianceUnits: 'W m^-2 nm^-1',
                uncertaintyUnits: 'W m^-2 nm^-1',
            }),
            provenance: Object.freeze({
                path,
                fileName: FIXTURE.fileName,
                byteLength: bytes.length,
                sourceHashSha256,
                sourceId: FIXTURE.sourceId,
                sourceVersion: FIXTURE.sourceVersion,
                title: 'TSIS-1 Hybrid Solar Reference Spectrum v2',
                publicationDoi: FIXTURE.paperDoi,
                publicationUrl: `https://doi.org/${FIXTURE.paperDoi}`,
                datasetDoi: FIXTURE.datasetDoi,
                datasetDoiUrl: `https://doi.org/${FIXTURE.datasetDoi}`,
                datasetUrl: FIXTURE.pinnedUrl,
                datasetDocumentationUrl:
                    'https://lasp.colorado.edu/lisird/latis/dap/tsis1_hsrs',
                wavelengthState:
                    'Published LISIRD wavelength grid; no air/vacuum conversion applied.',
                referenceDistance:
                    'Published LISIRD solar-irradiance scale; no distance rescaling applied.',
            }),
            qualifications: Object.freeze({
                uncertainty:
                    'The reported integral is a conservative k=1 fully correlated wavelength integral of the published per-sample standard uncertainties.',
                ownership:
                    'This external solar reference is a comparison fixture; it does not replace the Algorithm32 canonical Sun as runtime owner.',
            }),
        });
    }
}
