// References:
// - Gaia DR3 photometric calibration documentation, synthetic-photometry convention.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import SpectralDensityPacket from './SpectralDensityPacket.js';
import { SPECTRAL_IRRADIANCE_DENSITY } from './consts.js';

const SPEED_OF_LIGHT_NANOMETERS_PER_SECOND = 299792458 * 1e9;
const AB_MAGNITUDE_SI_CONSTANT = 56.10;

/**
 * Integrate a high-resolution irradiance density through one photon-counting passband.
 *
 * @param {PiecewiseLinearSpectralSampleSet} spectrum - Spectral irradiance density in W m^-2 nm^-1.
 * @param {Readonly<Record<string, unknown>>} passband - Parsed passband response.
 * @param {{ lowerNanometers?: number, upperNanometers?: number }} [support] - Shared support override.
 * @returns {Readonly<Record<string, number>>} Synthetic AB result.
 */
export function syntheticAbPhotometry(spectrum, passband, support = {}) {
    validateSpectrum(spectrum);
    validatePassband(passband);
    const bounds = resolveBounds(passband, support);
    requireSpectrumCoverage(spectrum.wavelengthsNanometers, bounds);
    const knots = mergeKnots(
        spectrum.wavelengthsNanometers,
        passband.wavelengthsNanometers,
        bounds,
    );
    return integrateSyntheticAb({
        knots,
        bounds,
        spectralDensityAt: (wavelength) => interpolate(
            spectrum.wavelengthsNanometers,
            spectrum.densityValues,
            wavelength,
        ),
        responseAt: (wavelength) => interpolate(
            passband.wavelengthsNanometers,
            passband.responseValues,
            wavelength,
        ),
    });
}

/**
 * Integrate one canonical bin-average irradiance packet through a clipped passband.
 *
 * @param {SpectralDensityPacket} packet - Irradiance-density packet.
 * @param {Readonly<Record<string, unknown>>} passband - Parsed passband response.
 * @param {{ lowerNanometers?: number, upperNanometers?: number }} [support] - Shared support override.
 * @returns {Readonly<Record<string, number>>} Synthetic AB approximation.
 */
export function syntheticAbPhotometryFromBinnedDensity(packet, passband, support = {}) {
    if (!(packet instanceof SpectralDensityPacket) || packet.quantity !== SPECTRAL_IRRADIANCE_DENSITY) {
        throw configurationError('ER1_SYNTHETIC_PHOTOMETRY_IRRADIANCE_PACKET_REQUIRED',
            'Binned synthetic photometry requires a spectral irradiance-density packet.');
    }
    validatePassband(passband);
    const bounds = resolveBounds(passband, support);
    const firstBin = packet.basis.channels[0];
    const lastBin = packet.basis.channels.at(-1);
    if (
        bounds.lowerNanometers < firstBin.lowerBoundNanometers
        || bounds.upperNanometers > lastBin.upperBoundNanometers
    ) {
        throw configurationError('ER1_SYNTHETIC_PHOTOMETRY_BIN_SUPPORT_INVALID',
            'Binned photometry support must stay within the packet basis.');
    }
    const binBounds = packet.basis.channels.flatMap((channel) => [
        channel.lowerBoundNanometers,
        channel.upperBoundNanometers,
    ]);
    const knots = mergeKnots(binBounds, passband.wavelengthsNanometers, bounds);
    return integrateSyntheticAb({
        knots,
        bounds,
        intervalSpectralDensity: (lower, upper) =>
            densityForBin(packet, (lower + upper) / 2),
        responseAt: (wavelength) => interpolate(
            passband.wavelengthsNanometers,
            passband.responseValues,
            wavelength,
        ),
    });
}

/**
 * Scale one high-resolution SED by a requested magnitude delta.
 *
 * @param {PiecewiseLinearSpectralSampleSet} spectrum - Original spectrum.
 * @param {number} magnitudeDelta - Requested scaled-minus-original magnitude.
 * @returns {PiecewiseLinearSpectralSampleSet} Scaled spectrum.
 */
export function scaleSpectrumByMagnitudeDelta(spectrum, magnitudeDelta) {
    validateSpectrum(spectrum);
    if (!Number.isFinite(magnitudeDelta)) {
        throw configurationError('ER1_SYNTHETIC_PHOTOMETRY_MAGNITUDE_DELTA_INVALID',
            'Magnitude delta must be finite.');
    }
    const scale = 10 ** (-0.4 * magnitudeDelta);
    return Object.freeze({
        wavelengthsNanometers: Object.freeze([...spectrum.wavelengthsNanometers]),
        densityValues: Object.freeze(spectrum.densityValues.map((value) => value * scale)),
    });
}

function integrateSyntheticAb({ knots, spectralDensityAt, intervalSpectralDensity, responseAt }) {
    let numerator = 0;
    let denominator = 0;
    for (let index = 0; index < knots.length - 1; index += 1) {
        const lower = knots[index];
        const upper = knots[index + 1];
        const midpoint = (lower + upper) / 2;
        const width = upper - lower;
        const intervalDensity = intervalSpectralDensity
            ? intervalSpectralDensity(lower, upper)
            : null;
        const numeratorValues = [lower, midpoint, upper].map((wavelength) =>
            (intervalDensity ?? spectralDensityAt(wavelength)) * responseAt(wavelength) * wavelength);
        const denominatorValues = [lower, midpoint, upper].map((wavelength) =>
            responseAt(wavelength) * SPEED_OF_LIGHT_NANOMETERS_PER_SECOND / wavelength);
        numerator += width * (numeratorValues[0] + 4 * numeratorValues[1] + numeratorValues[2]) / 6;
        denominator += width * (denominatorValues[0] + 4 * denominatorValues[1] + denominatorValues[2]) / 6;
    }
    if (!(numerator > 0) || !(denominator > 0)) {
        throw configurationError('ER1_SYNTHETIC_PHOTOMETRY_INTEGRAL_INVALID',
            'Synthetic photometry requires positive numerator and denominator integrals.');
    }
    const meanFluxDensityWattsPerSquareMeterPerHertz = numerator / denominator;
    return Object.freeze({
        numerator,
        denominator,
        meanFluxDensityWattsPerSquareMeterPerHertz,
        abMagnitude:
            -2.5 * Math.log10(meanFluxDensityWattsPerSquareMeterPerHertz)
            - AB_MAGNITUDE_SI_CONSTANT,
    });
}

function densityForBin(packet, wavelength) {
    const index = packet.basis.channels.findIndex((channel) =>
        wavelength >= channel.lowerBoundNanometers && wavelength < channel.upperBoundNanometers);
    if (index === -1) {
        throw configurationError('ER1_SYNTHETIC_PHOTOMETRY_BIN_LOOKUP_FAILED',
            `No packet bin owns wavelength ${wavelength}.`);
    }
    return packet.values[index];
}

function resolveBounds(passband, support) {
    const lowerNanometers = support.lowerNanometers ?? passband.minimumNanometers;
    const upperNanometers = support.upperNanometers ?? passband.maximumNanometers;
    if (
        !Number.isFinite(lowerNanometers)
        || !Number.isFinite(upperNanometers)
        || lowerNanometers >= upperNanometers
        || lowerNanometers < passband.minimumNanometers
        || upperNanometers > passband.maximumNanometers
    ) {
        throw configurationError('ER1_SYNTHETIC_PHOTOMETRY_SUPPORT_INVALID',
            'Synthetic-photometry support must be ordered and inside the passband grid.');
    }
    return Object.freeze({ lowerNanometers, upperNanometers });
}

function mergeKnots(first, second, bounds) {
    return Object.freeze([...new Set([
        bounds.lowerNanometers,
        bounds.upperNanometers,
        ...first.filter((value) => value > bounds.lowerNanometers && value < bounds.upperNanometers),
        ...second.filter((value) => value > bounds.lowerNanometers && value < bounds.upperNanometers),
    ])].sort((a, b) => a - b));
}

function interpolate(wavelengths, values, wavelength) {
    if (wavelength < wavelengths[0] || wavelength > wavelengths.at(-1)) {
        throw configurationError('ER1_SYNTHETIC_PHOTOMETRY_EXTRAPOLATION_PROHIBITED',
            `Cannot extrapolate at ${wavelength} nm.`);
    }
    if (wavelength === wavelengths.at(-1)) {
        return values.at(-1);
    }
    let lower = 0;
    let upper = wavelengths.length - 1;
    while (upper - lower > 1) {
        const middle = Math.floor((lower + upper) / 2);
        if (wavelengths[middle] <= wavelength) {
            lower = middle;
        } else {
            upper = middle;
        }
    }
    const fraction = (wavelength - wavelengths[lower])
        / (wavelengths[upper] - wavelengths[lower]);
    return values[lower] + (values[upper] - values[lower]) * fraction;
}

function validateSpectrum(spectrum) {
    if (
        !spectrum
        || !Array.isArray(spectrum.wavelengthsNanometers)
        || !Array.isArray(spectrum.densityValues)
        || spectrum.wavelengthsNanometers.length < 2
        || spectrum.wavelengthsNanometers.length !== spectrum.densityValues.length
    ) {
        throw configurationError('ER1_SYNTHETIC_PHOTOMETRY_SPECTRUM_INVALID',
            'Synthetic photometry requires aligned high-resolution spectrum arrays.');
    }
    for (let index = 0; index < spectrum.wavelengthsNanometers.length; index += 1) {
        if (
            !Number.isFinite(spectrum.wavelengthsNanometers[index])
            || !Number.isFinite(spectrum.densityValues[index])
            || spectrum.densityValues[index] < 0
            || (index > 0
                && spectrum.wavelengthsNanometers[index] <= spectrum.wavelengthsNanometers[index - 1])
        ) {
            throw configurationError('ER1_SYNTHETIC_PHOTOMETRY_SPECTRUM_INVALID',
                `Synthetic spectrum row ${index} is invalid.`);
        }
    }
}

function validatePassband(passband) {
    if (
        !passband
        || !Array.isArray(passband.wavelengthsNanometers)
        || !Array.isArray(passband.responseValues)
        || passband.wavelengthsNanometers.length < 2
        || passband.wavelengthsNanometers.length !== passband.responseValues.length
    ) {
        throw configurationError('ER1_SYNTHETIC_PHOTOMETRY_PASSBAND_INVALID',
            'Synthetic photometry requires aligned passband arrays.');
    }
}

function requireSpectrumCoverage(wavelengths, bounds) {
    if (wavelengths[0] > bounds.lowerNanometers || wavelengths.at(-1) < bounds.upperNanometers) {
        throw configurationError('ER1_SYNTHETIC_PHOTOMETRY_SPECTRUM_COVERAGE_INCOMPLETE',
            'Spectrum does not cover the requested passband support.');
    }
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}
