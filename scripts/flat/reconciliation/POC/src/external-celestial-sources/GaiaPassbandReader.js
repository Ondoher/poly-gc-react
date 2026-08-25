// References:
// - https://www.cosmos.esa.int/web/gaia/edr3-passbands, Gaia EDR3 passbands version 2.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';
import ZipArchiveReader from './ZipArchiveReader.js';

const PASSBAND_ENTRY = 'GaiaEDR3_passbands_zeropoints_version2/passband.dat';
const ZERO_POINT_ENTRY = 'GaiaEDR3_passbands_zeropoints_version2/zeropt.dat';
const README_ENTRY = 'GaiaEDR3_passbands_zeropoints_version2/ReadMe';
const MISSING_SENTINEL = 99.99;

export default class GaiaPassbandReader {
    /**
     * Read the Gaia EDR3/DR3 version-2 G passband from its retained ZIP.
     *
     * @param {Buffer} bytes - Complete version-2 ZIP bytes.
     * @returns {Readonly<Record<string, unknown>>} Parsed G response and packaged metadata.
     */
    read(bytes) {
        const archive = new ZipArchiveReader(bytes);
        const passbandText = archive.readEntry(PASSBAND_ENTRY).toString('utf8');
        const zeroPointText = archive.readEntry(ZERO_POINT_ENTRY).toString('utf8');
        const readmeText = archive.readEntry(README_ENTRY).toString('utf8');
        const samples = parsePassband(passbandText);
        const zeroPoints = parseZeroPoints(zeroPointText);
        return Object.freeze({
            release: 'Gaia EDR3/DR3 passbands version 2',
            band: 'G',
            responseUnits: 'dimensionless',
            sourceUnitsLabel: 'mag',
            sourceUnitsQualification:
                'The packaged ReadMe labels transmissivity as mag; ER1 treats the response as dimensionless.',
            missingSentinel: MISSING_SENTINEL,
            missingPolicy: 'undefined response becomes zero and remains flagged as sourceDefined=false',
            wavelengthsNanometers: Object.freeze(samples.map((sample) => sample.wavelengthNanometers)),
            responseValues: Object.freeze(samples.map((sample) => sample.response)),
            uncertaintyValues: Object.freeze(samples.map((sample) => sample.uncertainty)),
            sourceDefined: Object.freeze(samples.map((sample) => sample.sourceDefined)),
            minimumNanometers: samples[0].wavelengthNanometers,
            maximumNanometers: samples.at(-1).wavelengthNanometers,
            sampleCount: samples.length,
            zeroPoints,
            readmeText,
        });
    }
}

function parsePassband(text) {
    const samples = text.split(/\r?\n/).filter((line) => line.trim() !== '').map((line, index) => {
        const fields = line.trim().split(/\s+/).map(Number);
        if (fields.length !== 7 || !fields.every(Number.isFinite)) {
            throw configurationError('ER1_GAIA_PASSBAND_ROW_INVALID',
                `Gaia passband row ${index} must contain seven finite fields.`);
        }
        const [wavelengthNanometers, gResponse, gUncertainty] = fields;
        const sourceDefined = gResponse !== MISSING_SENTINEL && gUncertainty !== MISSING_SENTINEL;
        const response = sourceDefined ? gResponse : 0;
        const uncertainty = sourceDefined ? gUncertainty : 0;
        if (response < 0 || uncertainty < 0) {
            throw configurationError('ER1_GAIA_PASSBAND_VALUE_NEGATIVE',
                `Gaia passband row ${index} contains a negative response/uncertainty.`);
        }
        return Object.freeze({ wavelengthNanometers, response, uncertainty, sourceDefined });
    });
    if (samples.length === 0) {
        throw configurationError('ER1_GAIA_PASSBAND_EMPTY', 'Gaia passband contains no rows.');
    }
    for (let index = 1; index < samples.length; index += 1) {
        if (samples[index].wavelengthNanometers <= samples[index - 1].wavelengthNanometers) {
            throw configurationError('ER1_GAIA_PASSBAND_WAVELENGTHS_INVALID',
                'Gaia passband wavelengths must be strictly increasing.');
        }
    }
    return Object.freeze(samples);
}

function parseZeroPoints(text) {
    const rows = text.split(/\r?\n/).filter((line) => line.trim() !== '').map((line, index) => {
        const fields = line.trim().split(/\s+/);
        if (fields.length !== 7) {
            throw configurationError('ER1_GAIA_ZERO_POINT_ROW_INVALID',
                `Gaia zero-point row ${index} must contain six values and one system.`);
        }
        const values = fields.slice(0, 6).map(Number);
        if (!values.every(Number.isFinite)) {
            throw configurationError('ER1_GAIA_ZERO_POINT_VALUE_INVALID',
                `Gaia zero-point row ${index} contains a nonfinite value.`);
        }
        return Object.freeze({
            system: fields[6],
            g: values[0],
            gUncertainty: values[1],
            bp: values[2],
            bpUncertainty: values[3],
            rp: values[4],
            rpUncertainty: values[5],
        });
    });
    return Object.freeze(rows);
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}

