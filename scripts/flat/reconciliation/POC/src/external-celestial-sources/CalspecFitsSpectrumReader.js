// References:
// - https://www.stsci.edu/hst/instrumentation/reference-data-for-calibration-and-tools/astronomical-catalogs/calspec
// - agents/topics/apps/flat/reconciliation/extra-atmosphere-reset-plan.md, ER1 CALSPEC fixture contract.

import ReconciliationConfigurationError from '../errors/ReconciliationConfigurationError.js';

const FITS_BLOCK_BYTES = 2880;
const FITS_CARD_BYTES = 80;
const REQUIRED_COLUMNS = Object.freeze([
    'WAVELENGTH',
    'FLUX',
    'STATERROR',
    'SYSERROR',
    'FWHM',
    'DATAQUAL',
    'TOTEXP',
]);

export default class CalspecFitsSpectrumReader {
    /**
     * Read the CALSPEC SCI binary table from one retained FITS payload.
     *
     * @param {Buffer} bytes - Complete FITS bytes.
     * @returns {Readonly<Record<string, unknown>>} Parsed spectrum and provenance metadata.
     */
    read(bytes) {
        if (!Buffer.isBuffer(bytes) || bytes.length < FITS_BLOCK_BYTES) {
            throw configurationError('ER1_CALSPEC_FITS_BYTES_REQUIRED',
                'CALSPEC reader requires a complete FITS Buffer.');
        }

        const hdus = readHdus(bytes);
        const scienceHdu = hdus.find((hdu) =>
            hdu.header.XTENSION === 'BINTABLE' && hdu.header.EXTNAME === 'SCI');
        if (!scienceHdu) {
            throw configurationError('ER1_CALSPEC_SCI_HDU_REQUIRED',
                'CALSPEC FITS payload does not contain a SCI binary-table HDU.');
        }
        const columns = readColumns(scienceHdu.header);
        for (const columnName of REQUIRED_COLUMNS) {
            if (!columns.some((column) => column.name === columnName)) {
                throw configurationError('ER1_CALSPEC_COLUMN_REQUIRED',
                    `CALSPEC SCI table is missing ${columnName}.`);
            }
        }

        const rowByteLength = requirePositiveInteger(
            scienceHdu.header.NAXIS1,
            'ER1_CALSPEC_ROW_LENGTH_INVALID',
            'CALSPEC NAXIS1',
        );
        const rowCount = requirePositiveInteger(
            scienceHdu.header.NAXIS2,
            'ER1_CALSPEC_ROW_COUNT_INVALID',
            'CALSPEC NAXIS2',
        );
        if (scienceHdu.dataByteLength < rowByteLength * rowCount) {
            throw configurationError('ER1_CALSPEC_TABLE_TRUNCATED',
                'CALSPEC SCI table is truncated.');
        }

        const columnMap = Object.fromEntries(columns.map((column) => [column.name, column]));
        const samples = [];
        for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
            const rowOffset = scienceHdu.dataOffset + rowIndex * rowByteLength;
            const sample = Object.freeze({
                wavelengthAngstroms: readScalar(bytes, rowOffset, columnMap.WAVELENGTH),
                fluxFlam: readScalar(bytes, rowOffset, columnMap.FLUX),
                statisticalErrorFlam: readScalar(bytes, rowOffset, columnMap.STATERROR),
                systematicErrorFlam: readScalar(bytes, rowOffset, columnMap.SYSERROR),
                fwhmAngstroms: readScalar(bytes, rowOffset, columnMap.FWHM),
                dataQuality: readScalar(bytes, rowOffset, columnMap.DATAQUAL),
                totalExposureSeconds: readScalar(bytes, rowOffset, columnMap.TOTEXP),
            });
            validateSample(sample, rowIndex, samples.at(-1));
            samples.push(sample);
        }

        const wavelengthColumn = columnMap.WAVELENGTH;
        const fluxColumn = columnMap.FLUX;
        return Object.freeze({
            format: 'FITS-BINTABLE',
            hduName: scienceHdu.header.EXTNAME,
            rowCount,
            rowByteLength,
            columns: Object.freeze(columns.map((column) => Object.freeze({
                name: column.name,
                form: column.form,
                units: column.units,
                byteOffset: column.byteOffset,
                byteLength: column.byteLength,
            }))),
            wavelengthUnits: wavelengthColumn.units,
            fluxUnits: fluxColumn.units,
            wavelengthState: 'vacuum',
            header: Object.freeze({
                filename: scienceHdu.header.FILENAME ?? hdus[0].header.FILENAME ?? null,
                targetId: scienceHdu.header.TARGETID ?? hdus[0].header.TARGETID ?? null,
                pedigree: scienceHdu.header.PEDIGREE ?? hdus[0].header.PEDIGREE ?? null,
                useAfter: scienceHdu.header.USEAFTER ?? hdus[0].header.USEAFTER ?? null,
                checksum: scienceHdu.header.CHECKSUM ?? null,
                dataSum: scienceHdu.header.DATASUM ?? null,
                history: Object.freeze([
                    ...(hdus[0].history ?? []),
                    ...(scienceHdu.history ?? []),
                ]),
            }),
            samples: Object.freeze(samples),
        });
    }
}

function readHdus(bytes) {
    const hdus = [];
    let offset = 0;
    while (offset < bytes.length) {
        const parsedHeader = readHeader(bytes, offset);
        const dataOffset = parsedHeader.nextOffset;
        const dataByteLength = calculateDataByteLength(parsedHeader.header);
        if (dataOffset + dataByteLength > bytes.length) {
            throw configurationError('ER1_CALSPEC_HDU_TRUNCATED', 'FITS HDU data exceeds payload length.');
        }
        hdus.push(Object.freeze({
            header: parsedHeader.header,
            history: parsedHeader.history,
            dataOffset,
            dataByteLength,
        }));
        const nextOffset = alignBlock(dataOffset + dataByteLength);
        if (nextOffset <= offset) {
            throw configurationError('ER1_CALSPEC_HDU_OFFSET_INVALID', 'FITS HDU offset did not advance.');
        }
        offset = nextOffset;
        if (offset === bytes.length) {
            break;
        }
        if (offset > bytes.length || bytes.subarray(offset).every((value) => value === 0)) {
            break;
        }
    }
    return Object.freeze(hdus);
}

function readHeader(bytes, startOffset) {
    const header = {};
    const history = [];
    let cardOffset = startOffset;
    let foundEnd = false;
    while (cardOffset + FITS_CARD_BYTES <= bytes.length) {
        const card = bytes.toString('ascii', cardOffset, cardOffset + FITS_CARD_BYTES);
        const keyword = card.slice(0, 8).trim();
        cardOffset += FITS_CARD_BYTES;
        if (keyword === 'END') {
            foundEnd = true;
            break;
        }
        if (keyword === 'HISTORY') {
            history.push(card.slice(8).trimEnd());
            continue;
        }
        if (keyword && card[8] === '=') {
            header[keyword] = parseCardValue(card.slice(10));
        }
    }
    if (!foundEnd) {
        throw configurationError('ER1_CALSPEC_HEADER_END_MISSING', 'FITS header is missing END.');
    }
    return Object.freeze({
        header: Object.freeze(header),
        history: Object.freeze(history),
        nextOffset: alignBlock(cardOffset),
    });
}

function parseCardValue(field) {
    const trimmed = field.trimStart();
    if (trimmed.startsWith("'")) {
        let value = '';
        for (let index = 1; index < trimmed.length; index += 1) {
            if (trimmed[index] === "'") {
                if (trimmed[index + 1] === "'") {
                    value += "'";
                    index += 1;
                    continue;
                }
                break;
            }
            value += trimmed[index];
        }
        return value.trimEnd();
    }
    const token = trimmed.split('/')[0].trim();
    if (token === 'T') {
        return true;
    }
    if (token === 'F') {
        return false;
    }
    const numeric = Number(token.replace(/[dD]/, 'E'));
    return Number.isNaN(numeric) ? token : numeric;
}

function calculateDataByteLength(header) {
    if (header.XTENSION === 'BINTABLE' || header.XTENSION === 'TABLE') {
        return (header.NAXIS1 ?? 0) * (header.NAXIS2 ?? 0) + (header.PCOUNT ?? 0);
    }
    const axisCount = header.NAXIS ?? 0;
    if (axisCount === 0) {
        return 0;
    }
    let elementCount = 1;
    for (let axis = 1; axis <= axisCount; axis += 1) {
        elementCount *= header[`NAXIS${axis}`] ?? 0;
    }
    return Math.ceil(Math.abs(header.BITPIX ?? 0) / 8) * elementCount
        * (header.GCOUNT ?? 1) + (header.PCOUNT ?? 0);
}

function readColumns(header) {
    const fieldCount = requirePositiveInteger(
        header.TFIELDS,
        'ER1_CALSPEC_FIELD_COUNT_INVALID',
        'CALSPEC TFIELDS',
    );
    const columns = [];
    let byteOffset = 0;
    for (let fieldIndex = 1; fieldIndex <= fieldCount; fieldIndex += 1) {
        const name = header[`TTYPE${fieldIndex}`];
        const form = header[`TFORM${fieldIndex}`];
        if (typeof name !== 'string' || typeof form !== 'string') {
            throw configurationError('ER1_CALSPEC_COLUMN_DESCRIPTOR_INVALID',
                `CALSPEC column ${fieldIndex} is missing TTYPE/TFORM.`);
        }
        const parsedForm = parseBinaryTableForm(form);
        columns.push(Object.freeze({
            name,
            form,
            units: header[`TUNIT${fieldIndex}`] ?? null,
            byteOffset,
            byteLength: parsedForm.byteLength,
            repeat: parsedForm.repeat,
            code: parsedForm.code,
        }));
        byteOffset += parsedForm.byteLength;
    }
    if (byteOffset !== header.NAXIS1) {
        throw configurationError('ER1_CALSPEC_ROW_LAYOUT_MISMATCH',
            'CALSPEC column byte lengths do not reconstruct NAXIS1.', {
                reconstructed: byteOffset,
                naxis1: header.NAXIS1,
            });
    }
    return Object.freeze(columns);
}

function parseBinaryTableForm(form) {
    const match = /^(\d*)([A-Z])/.exec(form.trim().toUpperCase());
    if (!match) {
        throw configurationError('ER1_CALSPEC_TFORM_UNSUPPORTED', `Unsupported FITS TFORM ${form}.`);
    }
    const repeat = match[1] ? Number(match[1]) : 1;
    const code = match[2];
    const bytesPerValue = { A: 1, L: 1, B: 1, I: 2, J: 4, K: 8, E: 4, D: 8 }[code];
    if (!bytesPerValue || !Number.isInteger(repeat) || repeat < 1) {
        throw configurationError('ER1_CALSPEC_TFORM_UNSUPPORTED', `Unsupported FITS TFORM ${form}.`);
    }
    return Object.freeze({ repeat, code, byteLength: repeat * bytesPerValue });
}

function readScalar(bytes, rowOffset, column) {
    if (column.repeat !== 1) {
        throw configurationError('ER1_CALSPEC_VECTOR_COLUMN_UNSUPPORTED',
            `CALSPEC column ${column.name} must be scalar.`);
    }
    const offset = rowOffset + column.byteOffset;
    switch (column.code) {
        case 'B': return bytes.readUInt8(offset);
        case 'I': return bytes.readInt16BE(offset);
        case 'J': return bytes.readInt32BE(offset);
        case 'K': return Number(bytes.readBigInt64BE(offset));
        case 'E': return bytes.readFloatBE(offset);
        case 'D': return bytes.readDoubleBE(offset);
        case 'L': return bytes.toString('ascii', offset, offset + 1) === 'T';
        case 'A': return bytes.toString('ascii', offset, offset + 1);
        default:
            throw configurationError('ER1_CALSPEC_COLUMN_TYPE_UNSUPPORTED',
                `Unsupported CALSPEC column type ${column.code}.`);
    }
}

function validateSample(sample, rowIndex, previous) {
    for (const field of [
        'wavelengthAngstroms',
        'fluxFlam',
        'statisticalErrorFlam',
        'systematicErrorFlam',
        'fwhmAngstroms',
        'totalExposureSeconds',
    ]) {
        if (!Number.isFinite(sample[field])) {
            throw configurationError('ER1_CALSPEC_SAMPLE_NONFINITE',
                `CALSPEC row ${rowIndex} field ${field} must be finite.`);
        }
    }
    if (
        sample.wavelengthAngstroms <= 0
        || sample.fluxFlam < 0
        || sample.statisticalErrorFlam < 0
        || sample.systematicErrorFlam < 0
    ) {
        throw configurationError('ER1_CALSPEC_SAMPLE_VALUE_INVALID',
            `CALSPEC row ${rowIndex} contains an invalid negative/nonpositive value.`);
    }
    if (previous && sample.wavelengthAngstroms <= previous.wavelengthAngstroms) {
        throw configurationError('ER1_CALSPEC_WAVELENGTHS_NOT_INCREASING',
            'CALSPEC wavelengths must be strictly increasing.');
    }
}

function requirePositiveInteger(value, code, label) {
    if (!Number.isInteger(value) || value <= 0) {
        throw configurationError(code, `${label} must be a positive integer.`);
    }
    return value;
}

function alignBlock(offset) {
    return Math.ceil(offset / FITS_BLOCK_BYTES) * FITS_BLOCK_BYTES;
}

function configurationError(code, message, details = null) {
    return new ReconciliationConfigurationError(message, { code, details });
}

