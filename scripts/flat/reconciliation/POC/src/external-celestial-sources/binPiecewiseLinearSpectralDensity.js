// References:
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-design.md, conservative source binning.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import SpectralDensityBasis from './SpectralDensityBasis.js';

/**
 * Integrate a piecewise-linear spectral density into exact basis-bin averages.
 *
 * @param {PiecewiseLinearSpectralSampleSet} sampleSet - Ordered density samples.
 * @param {SpectralDensityBasis} basis - Destination density basis.
 * @returns {BinnedSpectralDensityResult} Conservative bin-average result.
 */
export function binPiecewiseLinearSpectralDensity(sampleSet, basis) {
    if (!(basis instanceof SpectralDensityBasis)) {
        throw configurationError('ER1_BINNING_BASIS_REQUIRED',
            'Piecewise-linear binning requires a SpectralDensityBasis.');
    }
    const { wavelengthsNanometers, densityValues } = validateSampleSet(sampleSet);
    const firstBound = basis.channels[0].lowerBoundNanometers;
    const lastBound = basis.channels.at(-1).upperBoundNanometers;
    if (
        wavelengthsNanometers[0] > firstBound
        || wavelengthsNanometers.at(-1) < lastBound
    ) {
        throw configurationError('ER1_BINNING_SOURCE_COVERAGE_INCOMPLETE',
            'Source samples do not cover every destination bin without extrapolation.', {
                sourceMinimumNanometers: wavelengthsNanometers[0],
                sourceMaximumNanometers: wavelengthsNanometers.at(-1),
                requiredMinimumNanometers: firstBound,
                requiredMaximumNanometers: lastBound,
            });
    }

    const channels = basis.channels.map((channel) => {
        const integration = integrateInterval(
            wavelengthsNanometers,
            densityValues,
            channel.lowerBoundNanometers,
            channel.upperBoundNanometers,
        );
        return Object.freeze({
            ...channel,
            integratedValue: integration.integratedValue,
            densityValue: integration.integratedValue / channel.widthNanometers,
            contributingSegmentCount: integration.contributingSegmentCount,
        });
    });
    const values = Object.freeze(channels.map((channel) => channel.densityValue));
    return Object.freeze({
        method: 'piecewise-linear-exact-bin-integral-v1',
        sourceMinimumNanometers: wavelengthsNanometers[0],
        sourceMaximumNanometers: wavelengthsNanometers.at(-1),
        channels: Object.freeze(channels),
        values,
        representedIntegral: channels.reduce((sum, channel) => sum + channel.integratedValue, 0),
    });
}

function validateSampleSet(sampleSet) {
    if (!sampleSet || typeof sampleSet !== 'object') {
        throw configurationError('ER1_BINNING_SAMPLES_REQUIRED',
            'Piecewise-linear binning requires a sample set.');
    }
    const wavelengths = sampleSet.wavelengthsNanometers;
    const values = sampleSet.densityValues;
    if (!Array.isArray(wavelengths) || !Array.isArray(values) || wavelengths.length < 2) {
        throw configurationError('ER1_BINNING_SAMPLE_ARRAYS_REQUIRED',
            'Piecewise-linear binning requires at least two wavelength and density samples.');
    }
    if (wavelengths.length !== values.length) {
        throw configurationError('ER1_BINNING_SAMPLE_LENGTH_MISMATCH',
            'Wavelength and density sample arrays must have equal length.');
    }
    for (let index = 0; index < wavelengths.length; index += 1) {
        if (!Number.isFinite(wavelengths[index]) || !Number.isFinite(values[index])) {
            throw configurationError('ER1_BINNING_SAMPLE_NONFINITE',
                `Source sample ${index} must be finite.`);
        }
        if (values[index] < 0) {
            throw configurationError('ER1_BINNING_SAMPLE_NEGATIVE',
                `Source density sample ${index} must be nonnegative.`);
        }
        if (index > 0 && wavelengths[index] <= wavelengths[index - 1]) {
            throw configurationError('ER1_BINNING_WAVELENGTHS_NOT_STRICTLY_INCREASING',
                'Source wavelengths must be strictly increasing without duplicates.');
        }
    }
    return Object.freeze({
        wavelengthsNanometers: Object.freeze([...wavelengths]),
        densityValues: Object.freeze([...values]),
    });
}

function integrateInterval(wavelengths, values, lower, upper) {
    let integratedValue = 0;
    let contributingSegmentCount = 0;
    for (let index = 0; index < wavelengths.length - 1; index += 1) {
        const segmentLower = Math.max(lower, wavelengths[index]);
        const segmentUpper = Math.min(upper, wavelengths[index + 1]);
        if (segmentUpper <= segmentLower) {
            continue;
        }
        const wavelength0 = wavelengths[index];
        const wavelength1 = wavelengths[index + 1];
        const value0 = interpolateLinear(
            wavelength0,
            values[index],
            wavelength1,
            values[index + 1],
            segmentLower,
        );
        const value1 = interpolateLinear(
            wavelength0,
            values[index],
            wavelength1,
            values[index + 1],
            segmentUpper,
        );
        integratedValue += (value0 + value1) * (segmentUpper - segmentLower) / 2;
        contributingSegmentCount += 1;
    }
    return Object.freeze({ integratedValue, contributingSegmentCount });
}

function interpolateLinear(x0, y0, x1, y1, x) {
    return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}

