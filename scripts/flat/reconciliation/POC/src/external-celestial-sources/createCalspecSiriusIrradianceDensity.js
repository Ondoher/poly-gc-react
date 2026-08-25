// References:
// - STScI CALSPEC sirius_stis_005.fits retained by ER1.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import { binPiecewiseLinearSpectralDensity } from './binPiecewiseLinearSpectralDensity.js';
import CalspecFitsSpectrumReader from './CalspecFitsSpectrumReader.js';
import SpectralDensityPacket from './SpectralDensityPacket.js';
import { SPECTRAL_DENSITY_UNITS, SPECTRAL_IRRADIANCE_DENSITY } from './consts.js';
import { EXTERNAL_CELESTIAL_FIXTURE_MANIFEST } from './fixtureManifest.js';

const ANGSTROMS_PER_NANOMETER = 10;
const FLAM_TO_WATTS_PER_SQUARE_METER_PER_NANOMETER = 0.01;

/**
 * Parse and bin the pinned absolute Sirius CALSPEC fixture.
 *
 * @param {Buffer} fitsBytes - Byte-identical sirius_stis_005.fits payload.
 * @param {import('./SpectralDensityBasis.js').default} basis - Canonical density basis.
 * @returns {Readonly<Record<string, unknown>>} Parsed source, binned diagnostics, and typed packet.
 */
export function createCalspecSiriusIrradianceDensity(fitsBytes, basis) {
    const fixture = EXTERNAL_CELESTIAL_FIXTURE_MANIFEST.siriusCalspec;
    const parsed = new CalspecFitsSpectrumReader().read(fitsBytes);
    validateFixtureIdentity(parsed, fixture);

    const lower = basis.channels[0].lowerBoundNanometers;
    const upper = basis.channels.at(-1).upperBoundNanometers;
    const badRequiredSamples = parsed.samples.filter((sample) => {
        const wavelengthNanometers = sample.wavelengthAngstroms / ANGSTROMS_PER_NANOMETER;
        return wavelengthNanometers >= lower
            && wavelengthNanometers <= upper
            && sample.dataQuality !== 1;
    });
    if (badRequiredSamples.length > 0) {
        throw new ReconciliationConfigurationError(
            'CALSPEC canonical-bin support contains non-good DATAQUAL rows.',
            {
                code: 'ER1_CALSPEC_REQUIRED_SAMPLE_QUALITY_INVALID',
                details: { badRequiredSampleCount: badRequiredSamples.length },
            },
        );
    }

    const goodSamples = parsed.samples.filter((sample) => sample.dataQuality === 1);
    const wavelengthsNanometers = Object.freeze(goodSamples.map((sample) =>
        sample.wavelengthAngstroms / ANGSTROMS_PER_NANOMETER));
    const densityValues = Object.freeze(goodSamples.map((sample) =>
        sample.fluxFlam * FLAM_TO_WATTS_PER_SQUARE_METER_PER_NANOMETER));
    const statisticalDensityValues = Object.freeze(goodSamples.map((sample) =>
        sample.statisticalErrorFlam * FLAM_TO_WATTS_PER_SQUARE_METER_PER_NANOMETER));
    const systematicDensityValues = Object.freeze(goodSamples.map((sample) =>
        sample.systematicErrorFlam * FLAM_TO_WATTS_PER_SQUARE_METER_PER_NANOMETER));
    const spectrum = Object.freeze({ wavelengthsNanometers, densityValues });
    const binned = binPiecewiseLinearSpectralDensity(spectrum, basis);
    const statisticalBinned = binPiecewiseLinearSpectralDensity({
        wavelengthsNanometers,
        densityValues: statisticalDensityValues,
    }, basis);
    const systematicBinned = binPiecewiseLinearSpectralDensity({
        wavelengthsNanometers,
        densityValues: systematicDensityValues,
    }, basis);

    const packet = new SpectralDensityPacket({
        quantity: SPECTRAL_IRRADIANCE_DENSITY,
        units: SPECTRAL_DENSITY_UNITS[SPECTRAL_IRRADIANCE_DENSITY],
        basis,
        values: binned.values,
        provenance: {
            ...fixture,
            sourceHashSha256: fixture.sourceHashSha256,
            fitsHeader: parsed.header,
            hduName: parsed.hduName,
            sourceRowCount: parsed.rowCount,
            retainedGoodRowCount: goodSamples.length,
            conversion: {
                wavelength: 'Angstrom / 10 = nm',
                density: 'FLAM * 0.01 = W m^-2 nm^-1',
            },
            binningMethod: binned.method,
        },
        uncertainty: {
            status: 'partial',
            model: 'CALSPEC-STATERROR-and-SYSERROR-separate-conservative-bin-average-absolute-density',
            values: statisticalBinned.values,
            systematicValues: systematicBinned.values,
            notes: [fixture.uncertaintyQualification],
        },
    });

    return Object.freeze({
        parsed,
        spectrum,
        statisticalDensityValues,
        systematicDensityValues,
        binned,
        statisticalBinned,
        systematicBinned,
        packet,
    });
}

function validateFixtureIdentity(parsed, fixture) {
    const checks = [
        ['rowCount', parsed.rowCount, fixture.expectedRowCount],
        ['targetId', parsed.header.targetId, fixture.expectedTargetId],
        ['pedigree', parsed.header.pedigree, fixture.expectedPedigree],
    ];
    for (const [field, actual, expected] of checks) {
        if (actual !== expected) {
            throw new ReconciliationConfigurationError(
                `CALSPEC fixture ${field} does not match the sealed manifest.`,
                {
                    code: 'ER1_CALSPEC_FIXTURE_IDENTITY_MISMATCH',
                    details: { field, actual, expected },
                },
            );
        }
    }
    const first = parsed.samples[0].wavelengthAngstroms;
    const last = parsed.samples.at(-1).wavelengthAngstroms;
    if (
        Math.abs(first - fixture.expectedMinimumAngstroms) > 1e-6
        || Math.abs(last - fixture.expectedMaximumAngstroms) > 1e-6
    ) {
        throw new ReconciliationConfigurationError(
            'CALSPEC fixture wavelength bounds do not match the sealed manifest.',
            {
                code: 'ER1_CALSPEC_FIXTURE_WAVELENGTH_MISMATCH',
                details: { first, last },
            },
        );
    }
}

