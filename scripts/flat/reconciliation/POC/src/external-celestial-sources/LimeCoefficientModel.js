// References:
// - LIME Model ATBD v3.3, sections 2.2, 2.6, 2.7, and 3.
// - LIME-TBX v1.4.1 elref.py, spectral_interpolation.py, and eli.py.
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER5.

import {
    LIME_ATBD_MODEL_ASSISTED_RANGES_NANOMETERS,
    LIME_ATBD_TABLE_COEFFICIENT_ROWS,
    LIME_PAYLOAD_ATBD_TABLE_ROW_MATCHES,
    LIME_REFERENCE_EARTH_MOON_DISTANCE_KILOMETERS,
    LIME_REFERENCE_MOON_SOLID_ANGLE_STERADIANS,
    LIME_RELEASE_EXECUTABLE_COEFFICIENT_ROW_NAMES,
} from './consts.js';

const EXECUTABLE_INTERPRETATION = 'lime-v1.4.1-positional';
const ATBD_INTERPRETATION = 'atbd-v3.3-named';
const LINEAR_INTERPOLATION = 'lime-v1.4.1-linear';
const CUBIC_INTERPOLATION = 'atbd-v3.3-natural-cubic-diagnostic';

export default class LimeCoefficientModel {
    /**
     * @param {LimeCoefficientModelConfiguration} configuration - Parsed LIME fixtures and canonical owners.
     */
    constructor(configuration) {
        this.fixtures = configuration.fixtures;
        this.basis = configuration.basis;
        this.canonicalSolar = configuration.canonicalSolar;
        this.coefficientWavelengths = this.fixtures.coefficients.wavelength.values;
        this.coefficientValues = this.fixtures.coefficients.coefficients.values;
        this.coefficientRelativeUncertaintyPercent =
            this.fixtures.coefficients.relativeUncertaintyPercent.values;
        this.coefficientErrorCorrelation =
            this.fixtures.coefficients.errorCorrelation.values;
        this.asdWavelengths = this.fixtures.asd.wavelength.values;
        this.asdPhaseAngles = this.fixtures.asd.phaseAngle.values;
        this.asdReflectance = this.fixtures.asd.reflectance.values;
        this.asdRelativeUncertaintyPercent =
            this.fixtures.asd.relativeUncertaintyPercent.values;
        this.cimelResponses = this._parseCimelResponses(
            this.fixtures.entries.cimelResponses.text,
        );
        this.tsisReference = this._parseThreeColumnSpectrum(
            this.fixtures.entries.defaultTsisSolarReference.text,
        );
        this.releaseChangelog = this.fixtures.entries.changelog.text;
        this._validateConfiguration();
        this.tsisCanonicalChannels = this._binSpectrum(
            this.tsisReference.wavelengthsNanometers,
            this.tsisReference.values,
        );
        this.tsisCanonicalUncertaintyChannels = this._binSpectrum(
            this.tsisReference.wavelengthsNanometers,
            this.tsisReference.uncertainties,
        );
    }

    /**
     * Assert one exact numeric shape.
     *
     * @param {readonly number[]} actual - Actual dataset shape.
     * @param {readonly number[]} expected - Required dataset shape.
     * @param {string} label - Dataset label used in an error.
     * @returns {void}
     */
    _assertShape(actual, expected, label) {
        if (
            actual.length !== expected.length
            || actual.some((value, index) => value !== expected[index])
        ) {
            throw new Error(
                label + ' shape must be [' + expected.join(', ') + '], received ['
                + actual.join(', ') + '].',
            );
        }
    }

    /**
     * Validate parsed LIME and canonical input contracts.
     *
     * @returns {void}
     */
    _validateConfiguration() {
        this._assertShape(
            this.fixtures.coefficients.coefficients.shape,
            [18, 6],
            'LIME coeff',
        );
        this._assertShape(
            this.fixtures.coefficients.relativeUncertaintyPercent.shape,
            [18, 6],
            'LIME u_coeff',
        );
        this._assertShape(
            this.fixtures.coefficients.errorCorrelation.shape,
            [108, 108],
            'LIME err_corr_coeff',
        );
        this._assertShape(
            this.fixtures.asd.reflectance.shape,
            [2151, 180],
            'LIME ASD reflectance',
        );
        this._assertShape(
            this.fixtures.asd.relativeUncertaintyPercent.shape,
            [2151, 180],
            'LIME ASD u_reflectance',
        );
        const expectedWavelengths = [440, 500, 675, 870, 1020, 1640];
        if (this.coefficientWavelengths.some(
            (value, index) => value !== expectedWavelengths[index],
        )) {
            throw new Error('LIME coefficient wavelengths do not match the six ATBD anchors.');
        }
        if (
            this.asdWavelengths[0] !== 350
            || this.asdWavelengths.at(-1) !== 2500
            || this.asdWavelengths.some(
                (value, index) => index > 0 && value !== this.asdWavelengths[index - 1] + 1,
            )
        ) {
            throw new Error('LIME ASD wavelength grid must be contiguous 350..2500 nm.');
        }
        if (
            this.asdPhaseAngles[0] !== -90
            || this.asdPhaseAngles.at(-1) !== 89
            || this.asdPhaseAngles.some(
                (value, index) => index > 0 && value !== this.asdPhaseAngles[index - 1] + 1,
            )
        ) {
            throw new Error('LIME ASD phase grid must be contiguous -90..89 degrees.');
        }
        if (
            !this.basis
            || !Array.isArray(this.basis.channels)
            || this.basis.channels.length !== 15
        ) {
            throw new Error('LIME calibration requires the canonical 15-channel basis.');
        }
        if (
            !this.canonicalSolar
            || !Array.isArray(this.canonicalSolar.values)
            || this.canonicalSolar.values.length !== this.basis.channels.length
        ) {
            throw new Error('LIME calibration requires the canonical solar packet.');
        }
        if (
            !this.releaseChangelog.includes('Corresponding coefficients were also swapped')
            || !this.releaseChangelog.includes('Outputs of the current toolbox version')
            || !this.releaseChangelog.includes('coefficient set `20251010_v1`')
        ) {
            throw new Error('LIME release changelog does not retain the coefficient-order authority statements.');
        }
    }

    /**
     * Read one coefficient at a row and wavelength index.
     *
     * @param {number} rowIndex - Coefficient row.
     * @param {number} wavelengthIndex - Anchor wavelength index.
     * @returns {number} Coefficient value.
     */
    _coefficient(rowIndex, wavelengthIndex) {
        return this.coefficientValues[rowIndex * this.coefficientWavelengths.length
            + wavelengthIndex];
    }

    /**
     * Resolve c-row indices for one authoritative interpretation.
     *
     * @param {string} interpretation - Executable-positional or ATBD-named interpretation.
     * @returns {readonly number[]} Row indices for c1, c2, c3, and c4.
     */
    _cRowIndices(interpretation) {
        if (interpretation === EXECUTABLE_INTERPRETATION) {
            return [7, 8, 9, 10];
        }
        if (interpretation === ATBD_INTERPRETATION) {
            return [8, 7, 10, 9];
        }
        throw new Error('Unknown LIME coefficient interpretation ' + interpretation + '.');
    }

    /**
     * Evaluate every additive log-reflectance term for one anchor.
     *
     * @param {LimeGeometryInput} geometry - Controlled lunar geometry.
     * @param {number} wavelengthIndex - Anchor wavelength index.
     * @param {string} interpretation - Coefficient interpretation.
     * @returns {LimeAnchorTermEvaluation} Additive terms and reflectance.
     */
    _evaluateAnchorTerms(geometry, wavelengthIndex, interpretation) {
        const phaseRadians = geometry.absolutePhaseDegrees * Math.PI / 180;
        const sunLongitude = geometry.sunSelenographicLongitudeRadians;
        const observerLatitude = geometry.observerSelenographicLatitudeDegrees;
        const observerLongitude = geometry.observerSelenographicLongitudeDegrees;
        const [c1Index, c2Index, c3Index, c4Index] = this._cRowIndices(interpretation);
        const aTerms = [0, 1, 2, 3].map((power) =>
            this._coefficient(power, wavelengthIndex) * phaseRadians ** power);
        const bTerms = [0, 1, 2].map((index) =>
            this._coefficient(4 + index, wavelengthIndex)
            * sunLongitude ** (2 * (index + 1) - 1));
        const cTerms = [
            this._coefficient(c1Index, wavelengthIndex) * observerLatitude,
            this._coefficient(c2Index, wavelengthIndex) * observerLongitude,
            this._coefficient(c3Index, wavelengthIndex)
                * sunLongitude * observerLatitude,
            this._coefficient(c4Index, wavelengthIndex)
                * sunLongitude * observerLongitude,
        ];
        const p1 = this._coefficient(14, wavelengthIndex);
        const p2 = this._coefficient(15, wavelengthIndex);
        const p3 = this._coefficient(16, wavelengthIndex);
        const p4 = this._coefficient(17, wavelengthIndex);
        const dTerms = [
            this._coefficient(11, wavelengthIndex)
                * Math.exp(-geometry.absolutePhaseDegrees / p1),
            this._coefficient(12, wavelengthIndex)
                * Math.exp(-geometry.absolutePhaseDegrees / p2),
            this._coefficient(13, wavelengthIndex)
                * Math.cos((geometry.absolutePhaseDegrees - p3) / p4),
        ];
        const logReflectance = [...aTerms, ...bTerms, ...cTerms, ...dTerms]
            .reduce((sum, value) => sum + value, 0);
        return Object.freeze({
            wavelengthNanometers: this.coefficientWavelengths[wavelengthIndex],
            interpretation,
            aTerms: Object.freeze(aTerms),
            bTerms: Object.freeze(bTerms),
            cTerms: Object.freeze(cTerms),
            dTerms: Object.freeze(dTerms),
            logReflectance,
            reflectance: Math.exp(logReflectance),
        });
    }

    /**
     * Build the reflectance gradient over all 108 coefficient variables.
     *
     * @param {LimeGeometryInput} geometry - Controlled lunar geometry.
     * @param {number} wavelengthIndex - Anchor wavelength index.
     * @param {string} interpretation - Coefficient interpretation.
     * @param {number} reflectance - Evaluated anchor reflectance.
     * @returns {readonly number[]} Reflectance gradient.
     */
    _anchorGradient(geometry, wavelengthIndex, interpretation, reflectance) {
        const phaseRadians = geometry.absolutePhaseDegrees * Math.PI / 180;
        const sunLongitude = geometry.sunSelenographicLongitudeRadians;
        const observerLatitude = geometry.observerSelenographicLatitudeDegrees;
        const observerLongitude = geometry.observerSelenographicLongitudeDegrees;
        const derivatives = new Array(108).fill(0);
        const setDerivative = (rowIndex, value) => {
            derivatives[rowIndex * 6 + wavelengthIndex] = reflectance * value;
        };
        [0, 1, 2, 3].forEach((rowIndex) =>
            setDerivative(rowIndex, phaseRadians ** rowIndex));
        [0, 1, 2].forEach((index) =>
            setDerivative(4 + index, sunLongitude ** (2 * (index + 1) - 1)));
        const [c1Index, c2Index, c3Index, c4Index] = this._cRowIndices(interpretation);
        setDerivative(c1Index, observerLatitude);
        setDerivative(c2Index, observerLongitude);
        setDerivative(c3Index, sunLongitude * observerLatitude);
        setDerivative(c4Index, sunLongitude * observerLongitude);
        const phaseDegrees = geometry.absolutePhaseDegrees;
        const d1 = this._coefficient(11, wavelengthIndex);
        const d2 = this._coefficient(12, wavelengthIndex);
        const d3 = this._coefficient(13, wavelengthIndex);
        const p1 = this._coefficient(14, wavelengthIndex);
        const p2 = this._coefficient(15, wavelengthIndex);
        const p3 = this._coefficient(16, wavelengthIndex);
        const p4 = this._coefficient(17, wavelengthIndex);
        const exp1 = Math.exp(-phaseDegrees / p1);
        const exp2 = Math.exp(-phaseDegrees / p2);
        const cosineArgument = (phaseDegrees - p3) / p4;
        setDerivative(11, exp1);
        setDerivative(12, exp2);
        setDerivative(13, Math.cos(cosineArgument));
        setDerivative(14, d1 * exp1 * phaseDegrees / (p1 ** 2));
        setDerivative(15, d2 * exp2 * phaseDegrees / (p2 ** 2));
        setDerivative(16, d3 * Math.sin(cosineArgument) / p4);
        setDerivative(
            17,
            d3 * Math.sin(cosineArgument) * (phaseDegrees - p3) / (p4 ** 2),
        );
        return Object.freeze(derivatives);
    }

    /**
     * Convert signed relative coefficient uncertainties to absolute standard uncertainties.
     *
     * @returns {readonly number[]} Positive absolute standard uncertainties.
     */
    _absoluteCoefficientUncertainties() {
        return Object.freeze(this.coefficientValues.map((coefficient, index) => {
            const uncertainty = coefficient
                * this.coefficientRelativeUncertaintyPercent[index] / 100;
            if (!Number.isFinite(uncertainty) || uncertainty < -1e-18) {
                throw new Error('LIME coefficient uncertainty conversion is invalid at ' + index + '.');
            }
            return Math.abs(uncertainty);
        }));
    }

    /**
     * Propagate retained coefficient covariance to six anchor reflectances.
     *
     * @param {LimeGeometryInput} geometry - Controlled lunar geometry.
     * @param {readonly LimeAnchorTermEvaluation[]} anchors - Evaluated anchors.
     * @param {string} interpretation - Coefficient interpretation.
     * @returns {LimeAnchorUncertainty} First-order covariance result.
     */
    _propagateAnchorCovariance(geometry, anchors, interpretation) {
        const standardUncertainties = this._absoluteCoefficientUncertainties();
        const gradients = anchors.map((anchor, index) =>
            this._anchorGradient(geometry, index, interpretation, anchor.reflectance));
        const covariance = gradients.map((left) => gradients.map((right) => {
            let sum = 0;
            for (let row = 0; row < 108; row += 1) {
                const leftTerm = left[row] * standardUncertainties[row];
                if (leftTerm === 0) {
                    continue;
                }
                for (let column = 0; column < 108; column += 1) {
                    sum += leftTerm
                        * this.coefficientErrorCorrelation[row * 108 + column]
                        * standardUncertainties[column]
                        * right[column];
                }
            }
            return sum;
        }));
        const uncertainties = covariance.map((row, index) =>
            Math.sqrt(Math.max(0, row[index])));
        const correlation = covariance.map((row, rowIndex) => row.map((value, columnIndex) => {
            const denominator = uncertainties[rowIndex] * uncertainties[columnIndex];
            return denominator === 0 ? 0 : value / denominator;
        }));
        return Object.freeze({
            method: 'first-order-jacobian-full-108x108-coefficient-covariance',
            standardUncertainties: Object.freeze(uncertainties),
            relativeStandardUncertaintyPercent: Object.freeze(uncertainties.map(
                (value, index) => value / anchors[index].reflectance * 100,
            )),
            covariance: Object.freeze(covariance.map((row) => Object.freeze(row))),
            correlation: Object.freeze(correlation.map((row) => Object.freeze(row))),
        });
    }

    /**
     * Parse the retained CIMEL 1088 spectral responses.
     *
     * @param {string} text - responses_1088.csv text.
     * @returns {Readonly<Record<string, readonly LimeResponseSample[]>>} Response samples by anchor.
     */
    _parseCimelResponses(text) {
        const lines = text.trim().split(/\r?\n/);
        const header = lines[0].split(',').map((value) => value.trim());
        const rows = lines.slice(1).map((line) => line.split(',').map((value) => {
            const trimmed = value.trim();
            return trimmed === '' ? Number.NaN : Number(trimmed);
        }));
        const responses = {};
        for (const wavelength of [440, 500, 675, 870, 1020, 1640]) {
            const wavelengthIndex = header.indexOf('w.' + wavelength);
            const responseIndex = header.indexOf('r.' + wavelength);
            if (wavelengthIndex === -1 || responseIndex === -1) {
                throw new Error('CIMEL response columns for ' + wavelength + ' nm are missing.');
            }
            responses[wavelength] = Object.freeze(rows
                .map((row) => Object.freeze({
                    wavelengthNanometers: row[wavelengthIndex],
                    response: row[responseIndex],
                }))
                .filter((sample) =>
                    Number.isFinite(sample.wavelengthNanometers)
                    && Number.isFinite(sample.response)
                    && sample.response !== 0)
                .sort((left, right) =>
                    left.wavelengthNanometers - right.wavelengthNanometers));
        }
        return Object.freeze(responses);
    }

    /**
     * Parse one wavelength, value, uncertainty CSV payload.
     *
     * @param {string} text - Three-column CSV text.
     * @returns {LimeReferenceSpectrum} Parsed spectrum.
     */
    _parseThreeColumnSpectrum(text) {
        const rows = text.trim().split(/\r?\n/).map((line) =>
            line.split(',').map((value) => Number(value.trim())));
        if (rows.some((row) => row.length < 3 || row.some((value) => !Number.isFinite(value)))) {
            throw new Error('LIME TSIS reference CSV contains a nonnumeric row.');
        }
        return Object.freeze({
            wavelengthsNanometers: Object.freeze(rows.map((row) => row[0])),
            values: Object.freeze(rows.map((row) => row[1])),
            uncertainties: Object.freeze(rows.map((row) => row[2])),
        });
    }

    /**
     * Interpolate one ordered sample set linearly.
     *
     * @param {readonly number[]} wavelengths - Ordered wavelengths.
     * @param {readonly number[]} values - Values aligned with wavelengths.
     * @param {number} wavelength - Requested wavelength.
     * @returns {number} Interpolated value.
     */
    _interpolateLinearSample(wavelengths, values, wavelength) {
        if (wavelength < wavelengths[0] || wavelength > wavelengths.at(-1)) {
            throw new Error('Spectral interpolation requested outside retained support.');
        }
        let low = 0;
        let high = wavelengths.length - 1;
        while (high - low > 1) {
            const middle = Math.floor((low + high) / 2);
            if (wavelengths[middle] <= wavelength) {
                low = middle;
            } else {
                high = middle;
            }
        }
        if (wavelength === wavelengths[low]) {
            return values[low];
        }
        if (wavelength === wavelengths[high]) {
            return values[high];
        }
        const fraction = (wavelength - wavelengths[low])
            / (wavelengths[high] - wavelengths[low]);
        return values[low] + fraction * (values[high] - values[low]);
    }

    /**
     * Integrate a spectrum through one retained response with trapezoidal quadrature.
     *
     * @param {readonly number[]} wavelengths - Spectrum wavelengths.
     * @param {readonly number[]} values - Spectrum values.
     * @param {readonly LimeResponseSample[]} response - Response samples.
     * @returns {number} Normalized band-average value.
     */
    _integrateResponse(wavelengths, values, response) {
        let numerator = 0;
        let denominator = 0;
        for (let index = 0; index < response.length - 1; index += 1) {
            const left = response[index];
            const right = response[index + 1];
            const width = right.wavelengthNanometers - left.wavelengthNanometers;
            const leftValue = this._interpolateLinearSample(
                wavelengths,
                values,
                left.wavelengthNanometers,
            );
            const rightValue = this._interpolateLinearSample(
                wavelengths,
                values,
                right.wavelengthNanometers,
            );
            numerator += (
                left.response * leftValue
                + right.response * rightValue
            ) * width / 2;
            denominator += (left.response + right.response) * width / 2;
        }
        if (!Number.isFinite(denominator) || Math.abs(denominator) <= 1e-15) {
            throw new Error('CIMEL response integral is zero or nonfinite.');
        }
        return numerator / denominator;
    }

    /**
     * Select the nearest signed ASD phase spectrum used by LIME-TBX v1.4.1.
     *
     * @param {number} signedPhaseDegrees - Requested signed phase in degrees.
     * @returns {LimeSelectedAsdSpectrum} Selected ASD spectrum.
     */
    _selectAsdSpectrum(signedPhaseDegrees) {
        if (!Number.isFinite(signedPhaseDegrees)) {
            throw new Error(
                'LIME ASD selection requires a finite signed phase angle.',
            );
        }
        let phaseIndex = 0;
        let minimumDistance = Infinity;
        this.asdPhaseAngles.forEach((phase, index) => {
            const distance = Math.abs(phase - signedPhaseDegrees);
            if (distance < minimumDistance) {
                minimumDistance = distance;
                phaseIndex = index;
            }
        });
        const phaseCount = this.asdPhaseAngles.length;
        const reflectance = this.asdWavelengths.map((_, wavelengthIndex) =>
            this.asdReflectance[wavelengthIndex * phaseCount + phaseIndex]);
        const relativeUncertaintyPercent = this.asdWavelengths.map((_, wavelengthIndex) =>
            this.asdRelativeUncertaintyPercent[wavelengthIndex * phaseCount + phaseIndex]);
        if (
            reflectance.some((value) => !Number.isFinite(value) || value <= 0)
            || relativeUncertaintyPercent.some((value) => !Number.isFinite(value) || value < 0)
        ) {
            throw new Error('Selected ASD phase spectrum contains invalid values.');
        }
        return Object.freeze({
            requestedSignedPhaseDegrees: signedPhaseDegrees,
            selectedSignedPhaseDegrees: this.asdPhaseAngles[phaseIndex],
            phaseSelectionOffsetDegrees:
                this.asdPhaseAngles[phaseIndex] - signedPhaseDegrees,
            phaseSelectionMethod:
                'lime-v1.4.1-nearest-signed-integer-phase-first-index-on-tie',
            phaseIndex,
            wavelengthsNanometers: Object.freeze([...this.asdWavelengths]),
            reflectance: Object.freeze(reflectance),
            relativeUncertaintyPercent: Object.freeze(relativeUncertaintyPercent),
        });
    }

    /**
     * Correct six LIME anchors for retained CIMEL response functions.
     *
     * @param {readonly LimeAnchorTermEvaluation[]} anchors - Raw coefficient-model anchors.
     * @param {LimeSelectedAsdSpectrum} asd - Selected signed-phase ASD spectrum.
     * @returns {LimeAnchorSpectralCorrection} Corrected anchors and residual ratios.
     */
    _correctAnchorResponses(anchors, asd) {
        const rows = anchors.map((anchor) => {
            const pointReference = this._interpolateLinearSample(
                asd.wavelengthsNanometers,
                asd.reflectance,
                anchor.wavelengthNanometers,
            );
            const responseReference = this._integrateResponse(
                asd.wavelengthsNanometers,
                asd.reflectance,
                this.cimelResponses[anchor.wavelengthNanometers],
            );
            const responseCorrection = responseReference - pointReference;
            const correctedReflectance = anchor.reflectance - responseCorrection;
            if (!Number.isFinite(correctedReflectance) || correctedReflectance <= 0) {
                throw new Error(
                    'CIMEL-corrected LIME anchor is invalid at '
                    + anchor.wavelengthNanometers + ' nm.',
                );
            }
            return Object.freeze({
                wavelengthNanometers: anchor.wavelengthNanometers,
                rawReflectance: anchor.reflectance,
                asdPointReflectance: pointReference,
                asdResponseIntegratedReflectance: responseReference,
                responseCorrection,
                correctedReflectance,
                residualRatio: correctedReflectance / pointReference,
            });
        });
        return Object.freeze({
            method:
                'LIME-v1.4.1 response correction: corrected=anchor-(integratedASD-pointASD)',
            rows: Object.freeze(rows),
        });
    }

    /**
     * Solve natural-cubic second derivatives for the ATBD diagnostic.
     *
     * @param {readonly number[]} x - Anchor wavelengths.
     * @param {readonly number[]} y - Anchor residual ratios.
     * @returns {readonly number[]} Natural-cubic second derivatives.
     */
    _naturalCubicSecondDerivatives(x, y) {
        const count = x.length;
        const lower = new Array(count).fill(0);
        const diagonal = new Array(count).fill(0);
        const upper = new Array(count).fill(0);
        const right = new Array(count).fill(0);
        diagonal[0] = 1;
        diagonal[count - 1] = 1;
        for (let index = 1; index < count - 1; index += 1) {
            const leftWidth = x[index] - x[index - 1];
            const rightWidth = x[index + 1] - x[index];
            lower[index] = leftWidth;
            diagonal[index] = 2 * (leftWidth + rightWidth);
            upper[index] = rightWidth;
            right[index] = 6 * (
                (y[index + 1] - y[index]) / rightWidth
                - (y[index] - y[index - 1]) / leftWidth
            );
        }
        for (let index = 1; index < count; index += 1) {
            const factor = lower[index] / diagonal[index - 1];
            diagonal[index] -= factor * upper[index - 1];
            right[index] -= factor * right[index - 1];
        }
        const result = new Array(count).fill(0);
        result[count - 1] = right[count - 1] / diagonal[count - 1];
        for (let index = count - 2; index >= 0; index -= 1) {
            result[index] = (
                right[index] - upper[index] * result[index + 1]
            ) / diagonal[index];
        }
        return Object.freeze(result);
    }

    /**
     * Evaluate a residual interpolation with constant out-of-anchor behavior.
     *
     * @param {number} wavelength - Requested wavelength.
     * @param {readonly number[]} anchors - Anchor wavelengths.
     * @param {readonly number[]} residuals - Anchor residual ratios.
     * @param {string} method - Linear executable or cubic ATBD diagnostic.
     * @param {readonly number[] | null} cubicSecondDerivatives - Cubic coefficients.
     * @returns {number} Interpolated residual ratio.
     */
    _interpolateResidual(
        wavelength,
        anchors,
        residuals,
        method,
        cubicSecondDerivatives,
    ) {
        if (wavelength <= anchors[0]) {
            return residuals[0];
        }
        if (wavelength >= anchors.at(-1)) {
            return residuals.at(-1);
        }
        let index = 0;
        while (wavelength > anchors[index + 1]) {
            index += 1;
        }
        const left = anchors[index];
        const right = anchors[index + 1];
        const width = right - left;
        const fraction = (wavelength - left) / width;
        if (method === LINEAR_INTERPOLATION) {
            return residuals[index]
                + fraction * (residuals[index + 1] - residuals[index]);
        }
        if (method !== CUBIC_INTERPOLATION || !cubicSecondDerivatives) {
            throw new Error('Unknown LIME residual interpolation method ' + method + '.');
        }
        const a = (right - wavelength) / width;
        const b = (wavelength - left) / width;
        return (
            a * residuals[index]
            + b * residuals[index + 1]
            + (
                (a ** 3 - a) * cubicSecondDerivatives[index]
                + (b ** 3 - b) * cubicSecondDerivatives[index + 1]
            ) * width ** 2 / 6
        );
    }

    /**
     * Build one hyperspectral reflectance from ASD shape and anchor residuals.
     *
     * @param {LimeSelectedAsdSpectrum} asd - Selected ASD spectrum.
     * @param {LimeAnchorSpectralCorrection} correction - Corrected anchors.
     * @param {string} method - Linear executable or cubic ATBD diagnostic.
     * @returns {LimeHyperspectralReflectance} Hyperspectral central prediction.
     */
    _buildHyperspectralReflectance(asd, correction, method) {
        const anchorWavelengths = correction.rows.map((row) => row.wavelengthNanometers);
        const residuals = correction.rows.map((row) => row.residualRatio);
        const cubicSecondDerivatives = method === CUBIC_INTERPOLATION
            ? this._naturalCubicSecondDerivatives(anchorWavelengths, residuals)
            : null;
        const residualRatios = asd.wavelengthsNanometers.map((wavelength) =>
            this._interpolateResidual(
                wavelength,
                anchorWavelengths,
                residuals,
                method,
                cubicSecondDerivatives,
            ));
        const reflectance = asd.reflectance.map((value, index) =>
            value * residualRatios[index]);
        if (reflectance.some((value) => !Number.isFinite(value) || value <= 0)) {
            throw new Error('LIME hyperspectral interpolation produced invalid reflectance.');
        }
        return Object.freeze({
            method,
            residualExtrapolation:
                'constant 440-nm residual below 440 nm and 1640-nm residual above 1640 nm',
            wavelengthsNanometers: asd.wavelengthsNanometers,
            residualRatios: Object.freeze(residualRatios),
            reflectance: Object.freeze(reflectance),
            cubicSecondDerivatives,
        });
    }

    /**
     * Integrate a piecewise-linear sample set over one exact interval.
     *
     * @param {readonly number[]} wavelengths - Ordered sample wavelengths.
     * @param {readonly number[]} values - Sample values.
     * @param {number} lower - Inclusive lower bound.
     * @param {number} upper - Inclusive upper bound.
     * @returns {number} Interval-average value.
     */
    _averagePiecewiseLinear(wavelengths, values, lower, upper) {
        if (lower < wavelengths[0] || upper > wavelengths.at(-1) || !(lower < upper)) {
            throw new Error('Spectral bin is outside sample support or has invalid bounds.');
        }
        let integral = 0;
        for (let index = 0; index < wavelengths.length - 1; index += 1) {
            const segmentLower = Math.max(lower, wavelengths[index]);
            const segmentUpper = Math.min(upper, wavelengths[index + 1]);
            if (segmentUpper <= segmentLower) {
                continue;
            }
            const leftValue = this._interpolateLinearSample(
                wavelengths,
                values,
                segmentLower,
            );
            const rightValue = this._interpolateLinearSample(
                wavelengths,
                values,
                segmentUpper,
            );
            integral += (leftValue + rightValue) * (segmentUpper - segmentLower) / 2;
        }
        return integral / (upper - lower);
    }

    /**
     * Calculate model-assisted overlap for one canonical bin.
     *
     * @param {number} lower - Canonical lower bound.
     * @param {number} upper - Canonical upper bound.
     * @returns {Readonly<Record<string, unknown>>} Overlap ranges and fraction.
     */
    _modelAssistedQualification(lower, upper) {
        const overlaps = LIME_ATBD_MODEL_ASSISTED_RANGES_NANOMETERS
            .map(([rangeLower, rangeUpper]) => [
                Math.max(lower, rangeLower),
                Math.min(upper, rangeUpper),
            ])
            .filter(([overlapLower, overlapUpper]) => overlapUpper > overlapLower)
            .map(([overlapLower, overlapUpper]) => Object.freeze({
                lowerNanometers: overlapLower,
                upperNanometers: overlapUpper,
                widthNanometers: overlapUpper - overlapLower,
            }));
        const assistedWidth = overlaps.reduce(
            (sum, overlap) => sum + overlap.widthNanometers,
            0,
        );
        return Object.freeze({
            ranges: Object.freeze(overlaps),
            widthNanometers: assistedWidth,
            fraction: assistedWidth / (upper - lower),
            phaseSpecificOutlierMaskQualification:
                'The final ASD v2.0.0 payload exposes no per-sample mask for Apollo-replaced phase-specific outliers.',
        });
    }

    /**
     * Describe residual-anchor segments contributing to one canonical bin.
     *
     * @param {number} lower - Canonical lower bound.
     * @param {number} upper - Canonical upper bound.
     * @returns {readonly string[]} Contributing scaling segments.
     */
    _residualScalingSegments(lower, upper) {
        const segments = [
            [-Infinity, 440, 'constant-440-anchor-residual-extrapolation'],
            [440, 500, '440-to-500-anchor-residual-interpolation'],
            [500, 675, '500-to-675-anchor-residual-interpolation'],
            [675, 870, '675-to-870-anchor-residual-interpolation'],
            [870, 1020, '870-to-1020-anchor-residual-interpolation'],
            [1020, 1640, '1020-to-1640-anchor-residual-interpolation'],
            [1640, Infinity, 'constant-1640-anchor-residual-extrapolation'],
        ];
        return Object.freeze(segments
            .filter(([segmentLower, segmentUpper]) =>
                Math.min(upper, segmentUpper) > Math.max(lower, segmentLower))
            .map(([, , label]) => label));
    }

    /**
     * Average one spectrum into the canonical 15 bins.
     *
     * @param {readonly number[]} wavelengths - Ordered source wavelengths.
     * @param {readonly number[]} values - Source values.
     * @returns {readonly LimeCanonicalChannel[]} Canonical channel averages.
     */
    _binSpectrum(wavelengths, values) {
        return Object.freeze(this.basis.channels.map((channel) => Object.freeze({
            id: channel.id,
            centerNanometers: channel.centerNanometers,
            lowerBoundNanometers: channel.lowerBoundNanometers,
            upperBoundNanometers: channel.upperBoundNanometers,
            widthNanometers: channel.widthNanometers,
            value: this._averagePiecewiseLinear(
                wavelengths,
                values,
                channel.lowerBoundNanometers,
                channel.upperBoundNanometers,
            ),
            modelAssisted: this._modelAssistedQualification(
                channel.lowerBoundNanometers,
                channel.upperBoundNanometers,
            ),
            residualScalingSegments: this._residualScalingSegments(
                channel.lowerBoundNanometers,
                channel.upperBoundNanometers,
            ),
        })));
    }

    /**
     * Convert canonical reflectance to disk-integrated lunar irradiance.
     *
     * @param {readonly LimeCanonicalChannel[]} reflectanceChannels - Canonical reflectance.
     * @param {readonly number[]} solarValues - Solar irradiance density values.
     * @param {LimeDistanceInput} distances - Sun-Moon and observer-Moon distances.
     * @returns {Readonly<Record<string, unknown>>} Disk-integrated irradiance density.
     */
    _diskIrradiance(reflectanceChannels, solarValues, distances) {
        const distanceFactor = (1 / distances.sunMoonDistanceAstronomicalUnits) ** 2
            * (
                LIME_REFERENCE_EARTH_MOON_DISTANCE_KILOMETERS
                / distances.observerMoonDistanceKilometers
            ) ** 2;
        const geometricFactor = LIME_REFERENCE_MOON_SOLID_ANGLE_STERADIANS
            / Math.PI * distanceFactor;
        return Object.freeze({
            units: 'W m^-2 nm^-1',
            distances,
            distanceFactor,
            referenceMoonSolidAngleSteradians:
                LIME_REFERENCE_MOON_SOLID_ANGLE_STERADIANS,
            referenceEarthMoonDistanceKilometers:
                LIME_REFERENCE_EARTH_MOON_DISTANCE_KILOMETERS,
            values: Object.freeze(reflectanceChannels.map((channel, index) =>
                channel.value * solarValues[index] * geometricFactor)),
        });
    }

    /**
     * Transfer the TSIS-calibrated LIME spectrum into canonical-Sun effective reflectance.
     *
     * @param {LimeHyperspectralReflectance} spectrum - Central hyperspectral reflectance.
     * @returns {Readonly<Record<string, unknown>>} Exact canonical calibration transfer.
     */
    _canonicalSolarCalibrationTransfer(spectrum) {
        const referenceGeometricFactor = LIME_REFERENCE_MOON_SOLID_ANGLE_STERADIANS
            / Math.PI;
        const tsisSolarValues = spectrum.wavelengthsNanometers.map((wavelength) =>
            this._interpolateLinearSample(
                this.tsisReference.wavelengthsNanometers,
                this.tsisReference.values,
                wavelength,
            ));
        const tsisLunarIrradianceDensity = spectrum.reflectance.map(
            (reflectance, index) =>
                reflectance * tsisSolarValues[index] * referenceGeometricFactor,
        );
        const tsisCanonicalChannels = this._binSpectrum(
            spectrum.wavelengthsNanometers,
            tsisLunarIrradianceDensity,
        );
        const effectiveCanonicalReflectance = Object.freeze(
            tsisCanonicalChannels.map((channel, index) => Object.freeze({
                ...channel,
                value: channel.value / (
                    this.canonicalSolar.values[index] * referenceGeometricFactor
                ),
            })),
        );
        const reconstructed = this._diskIrradiance(
            effectiveCanonicalReflectance,
            this.canonicalSolar.values,
            Object.freeze({
                id: 'reference-distances',
                sunMoonDistanceAstronomicalUnits: 1,
                observerMoonDistanceKilometers:
                    LIME_REFERENCE_EARTH_MOON_DISTANCE_KILOMETERS,
            }),
        );
        const reconstructionRelativeResiduals = reconstructed.values.map(
            (value, index) =>
                Math.abs(value - tsisCanonicalChannels[index].value)
                / tsisCanonicalChannels[index].value,
        );
        return Object.freeze({
            method:
                'bin-average(A_LIME(lambda)*E_TSIS(lambda))*pi/(Omega_ref*E_canonical_channel)',
            qualification:
                'TSIS calibrates the lunar reflectance scale; the derived effective reflectance lets the canonical Sun remain the sole runtime irradiance owner without changing the intended LIME irradiance.',
            referenceGeometricFactor,
            tsisLunarIrradianceAtReferenceDistances: Object.freeze(
                tsisCanonicalChannels.map((channel) => channel.value),
            ),
            effectiveCanonicalReflectance,
            canonicalRuntimeReconstructionAtReferenceDistances: reconstructed.values,
            maximumReconstructionRelativeResidual:
                Math.max(...reconstructionRelativeResiduals),
        });
    }

    /**
     * Evaluate one six-anchor interpretation and coefficient covariance.
     *
     * @param {LimeGeometryInput} geometry - Controlled lunar geometry.
     * @param {string} interpretation - Coefficient interpretation.
     * @returns {Readonly<Record<string, unknown>>} Anchor central values and covariance.
     */
    _evaluateAnchors(geometry, interpretation) {
        const anchors = Object.freeze(this.coefficientWavelengths.map((_, index) =>
            this._evaluateAnchorTerms(geometry, index, interpretation)));
        return Object.freeze({
            interpretation,
            anchors,
            uncertainty: this._propagateAnchorCovariance(
                geometry,
                anchors,
                interpretation,
            ),
        });
    }

    /**
     * Inspect payload metadata, ATBD row matches, and coefficient correlation.
     *
     * @returns {Readonly<Record<string, unknown>>} Mechanical payload diagnostics.
     */
    inspectPayload() {
        const rowComparisons = LIME_PAYLOAD_ATBD_TABLE_ROW_MATCHES.map(
            (tableName, rowIndex) => {
                const tableValues = LIME_ATBD_TABLE_COEFFICIENT_ROWS[tableName];
                const payloadValues = this.coefficientWavelengths.map(
                    (_, wavelengthIndex) => this._coefficient(rowIndex, wavelengthIndex),
                );
                const maxAbsoluteDifference = Math.max(...payloadValues.map(
                    (value, index) => Math.abs(value - tableValues[index]),
                ));
                return Object.freeze({
                    payloadRowIndex: rowIndex,
                    executableName: LIME_RELEASE_EXECUTABLE_COEFFICIENT_ROW_NAMES[rowIndex],
                    matchingAtbdTableName: tableName,
                    payloadValues: Object.freeze(payloadValues),
                    atbdRoundedValues: tableValues,
                    maxAbsoluteDifference,
                    displayedPrecisionTolerance: tableName.startsWith('c') ? 5.1e-8 : 5.1e-7,
                });
            },
        );
        let maximumSymmetryResidual = 0;
        let maximumDiagonalResidual = 0;
        let minimumOffDiagonal = Infinity;
        let maximumOffDiagonal = -Infinity;
        for (let row = 0; row < 108; row += 1) {
            for (let column = 0; column < 108; column += 1) {
                const value = this.coefficientErrorCorrelation[row * 108 + column];
                const transposed = this.coefficientErrorCorrelation[column * 108 + row];
                if (!Number.isFinite(value)) {
                    throw new Error('LIME coefficient correlation contains a nonfinite value.');
                }
                maximumSymmetryResidual = Math.max(
                    maximumSymmetryResidual,
                    Math.abs(value - transposed),
                );
                if (row === column) {
                    maximumDiagonalResidual = Math.max(
                        maximumDiagonalResidual,
                        Math.abs(value - 1),
                    );
                } else {
                    minimumOffDiagonal = Math.min(minimumOffDiagonal, value);
                    maximumOffDiagonal = Math.max(maximumOffDiagonal, value);
                }
            }
        }
        const attributes = this.fixtures.coefficients.attributes;
        return Object.freeze({
            derivedModelId: String(attributes.release_date)
                + '_v' + String(attributes.file_version),
            attributes,
            datasetShapes: Object.freeze({
                wavelength: this.fixtures.coefficients.wavelength.shape,
                coeff: this.fixtures.coefficients.coefficients.shape,
                u_coeff: this.fixtures.coefficients.relativeUncertaintyPercent.shape,
                err_corr_coeff: this.fixtures.coefficients.errorCorrelation.shape,
            }),
            rowComparisons: Object.freeze(rowComparisons),
            cRowConflict: Object.freeze({
                executableNamesByPayloadRow: Object.freeze(
                    LIME_RELEASE_EXECUTABLE_COEFFICIENT_ROW_NAMES.slice(7, 11),
                ),
                atbdTableMatchesByPayloadRow: Object.freeze(
                    LIME_PAYLOAD_ATBD_TABLE_ROW_MATCHES.slice(7, 11),
                ),
                centralInterpretation: EXECUTABLE_INTERPRETATION,
                resolution:
                    'The v1.1.0 changelog states that equation fields and corresponding coefficient rows were swapped together while outputs remained unchanged; v1.4.0 then introduced 20251010_v1. Keep native payload and covariance order.',
                status: 'release-authority-resolved-atbd-table-label-inconsistency',
            }),
            coefficientCorrelation: Object.freeze({
                shape: Object.freeze([108, 108]),
                finiteEntryCount: this.coefficientErrorCorrelation.length,
                maximumSymmetryResidual,
                maximumDiagonalResidual,
                minimumOffDiagonal,
                maximumOffDiagonal,
            }),
        });
    }

    /**
     * Describe the versioned executable policy selected for the central model.
     *
     * @returns {Readonly<Record<string, unknown>>} Central and uncertainty-branch policy.
     */
    describeExecutablePolicy() {
        return Object.freeze({
            modelIdentity: 'LIME-TBX-v1.4.1-coefficients-20251010_v1-ASD-v2.0.0',
            coefficientOrder: EXECUTABLE_INTERPRETATION,
            coefficientCovarianceOrder: 'native-payload-order-no-permutation',
            centralSpectralInterpolation: LINEAR_INTERPOLATION,
            asdPhaseSelection:
                'nearest signed integer phase, first retained index on an exact tie',
            centralCimelResponseCorrection:
                'release-v1.4.1 corrected=anchor-(response-integrated-ASD-point-ASD)',
            modelFormAlternatives:
                'quadratic/cubic residual interpolation and ATBD response-correction sign contribute uncertainty diagnostics rather than replacing the release central estimate',
            releaseAuthority: Object.freeze({
                changelogIncludesCoordinateAndCoefficientSwap:
                    this.releaseChangelog.includes('Corresponding coefficients were also swapped'),
                changelogIncludesOutputPreservation:
                    this.releaseChangelog.includes('Outputs of the current toolbox version'),
                changelogIncludesSelectedCoefficientSet:
                    this.releaseChangelog.includes('coefficient set `20251010_v1`'),
            }),
        });
    }

    /**
     * Evaluate one bounded signed-phase central prediction.
     *
     * @param {LimeCalibrationRequest} request - Controlled phase, geometry, and distances.
     * @returns {Readonly<Record<string, unknown>>} Central LIME and canonical-Sun prediction.
     */
    evaluate(request) {
        if (
            request.geometry.absolutePhaseDegrees < 0
            || request.geometry.absolutePhaseDegrees > 90
            || Math.abs(request.signedPhaseDegrees) !== request.geometry.absolutePhaseDegrees
        ) {
            throw new Error('LIME request phase is outside the supported absolute/signed domain.');
        }
        const anchorEvaluation = this._evaluateAnchors(
            request.geometry,
            EXECUTABLE_INTERPRETATION,
        );
        const asd = this._selectAsdSpectrum(request.signedPhaseDegrees);
        const correction = this._correctAnchorResponses(anchorEvaluation.anchors, asd);
        const linearSpectrum = this._buildHyperspectralReflectance(
            asd,
            correction,
            LINEAR_INTERPOLATION,
        );
        const cubicSpectrum = this._buildHyperspectralReflectance(
            asd,
            correction,
            CUBIC_INTERPOLATION,
        );
        const linearChannels = this._binSpectrum(
            linearSpectrum.wavelengthsNanometers,
            linearSpectrum.reflectance,
        );
        const cubicChannels = this._binSpectrum(
            cubicSpectrum.wavelengthsNanometers,
            cubicSpectrum.reflectance,
        );
        const canonicalSolarCalibration = this._canonicalSolarCalibrationTransfer(
            linearSpectrum,
        );
        const distanceCases = Object.freeze(request.distanceCases.map((distances) =>
            Object.freeze({
                id: distances.id,
                canonicalSun: this._diskIrradiance(
                    linearChannels,
                    this.canonicalSolar.values,
                    distances,
                ),
                tsisReference: this._diskIrradiance(
                    linearChannels,
                    this.tsisCanonicalChannels.map((channel) => channel.value),
                    distances,
                ),
                calibratedRuntime: this._diskIrradiance(
                    canonicalSolarCalibration.effectiveCanonicalReflectance,
                    this.canonicalSolar.values,
                    distances,
                ),
                calibratedTsisReference: Object.freeze({
                    units: 'W m^-2 nm^-1',
                    distances,
                    distanceFactor: (1 / distances.sunMoonDistanceAstronomicalUnits) ** 2
                        * (
                            LIME_REFERENCE_EARTH_MOON_DISTANCE_KILOMETERS
                            / distances.observerMoonDistanceKilometers
                        ) ** 2,
                    values: Object.freeze(
                        canonicalSolarCalibration
                            .tsisLunarIrradianceAtReferenceDistances
                            .map((value) => value * (
                                (1 / distances.sunMoonDistanceAstronomicalUnits) ** 2
                                * (
                                    LIME_REFERENCE_EARTH_MOON_DISTANCE_KILOMETERS
                                    / distances.observerMoonDistanceKilometers
                                ) ** 2
                            )),
                    ),
                }),
            })));
        return Object.freeze({
            request,
            anchorEvaluation,
            asd,
            correction,
            interpolation: Object.freeze({
                executableLinear: Object.freeze({
                    spectrum: linearSpectrum,
                    canonicalChannels: linearChannels,
                }),
                atbdCubicDiagnostic: Object.freeze({
                    spectrum: cubicSpectrum,
                    canonicalChannels: cubicChannels,
                }),
                canonicalChannelComparison: Object.freeze(linearChannels.map(
                    (channel, index) => Object.freeze({
                        id: channel.id,
                        linearReflectance: channel.value,
                        cubicReflectance: cubicChannels[index].value,
                        relativeDifference:
                            (cubicChannels[index].value - channel.value) / channel.value,
                    }),
                )),
            }),
            canonicalSolarCalibration,
            distanceCases,
        });
    }

    /**
     * Evaluate the released-code versus ATBD c-row ambiguity at nonzero libration.
     *
     * @param {LimeGeometryInput} geometry - Nonzero-libration controlled geometry.
     * @returns {Readonly<Record<string, unknown>>} Competing anchor predictions.
     */
    evaluateLibrationConflict(geometry) {
        const executable = this._evaluateAnchors(geometry, EXECUTABLE_INTERPRETATION);
        const atbd = this._evaluateAnchors(geometry, ATBD_INTERPRETATION);
        return Object.freeze({
            geometry,
            executableInterpretation: executable,
            atbdInterpretation: atbd,
            relativeDifferences: Object.freeze(executable.anchors.map((anchor, index) =>
                Object.freeze({
                    wavelengthNanometers: anchor.wavelengthNanometers,
                    executableReflectance: anchor.reflectance,
                    atbdReflectance: atbd.anchors[index].reflectance,
                    relativeDifference:
                        (anchor.reflectance - atbd.anchors[index].reflectance)
                        / atbd.anchors[index].reflectance,
                }))),
        });
    }

    /**
     * Describe the deterministic TSIS-to-canonical solar transfer.
     *
     * @returns {Readonly<Record<string, unknown>>} Per-channel source-standard difference.
     */
    describeSolarTransfer() {
        return Object.freeze({
            runtimeOwner: this.canonicalSolar.describe(),
            referenceOnly: Object.freeze({
                source:
                    'LIME-TBX v1.4.1 default TSIS-1 Gaussian 1-nm sampling, 3-nm width',
                values: Object.freeze(this.tsisCanonicalChannels.map((channel) => channel.value)),
                standardUncertaintyValues: Object.freeze(
                    this.tsisCanonicalUncertaintyChannels.map((channel) => channel.value),
                ),
            }),
            channels: Object.freeze(this.basis.channels.map((channel, index) => {
                const canonical = this.canonicalSolar.values[index];
                const reference = this.tsisCanonicalChannels[index].value;
                return Object.freeze({
                    id: channel.id,
                    centerNanometers: channel.centerNanometers,
                    canonicalSolarIrradianceDensity: canonical,
                    tsisReferenceIrradianceDensity: reference,
                    canonicalOverTsisRatio: canonical / reference,
                    relativeDifference: (canonical - reference) / reference,
                });
            })),
            qualification:
                'The ratio is a deterministic solar-standard substitution, not a random uncertainty.',
        });
    }
}
