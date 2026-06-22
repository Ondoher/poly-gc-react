import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const ASTM_G173_ZIP_URL = new URL('../data/color/astm-g173/astmg173.zip', import.meta.url);
const ASTM_G173_ENTRY_NAME = 'ASTMG173.csv';
const BRUNETON_2016_ASTMG173_POLICY_ID = 'bruneton-2016-astm-40';
const BRUNETON_2016_ASTMG173_MIN_NM = 360;
const BRUNETON_2016_ASTMG173_MAX_NM = 830;
const BRUNETON_2016_ASTMG173_SAMPLES = Object.freeze([
	1.13419, 1.09801, 1.03541, 1.45086, 1.72453, 1.654, 1.70536, 1.97393,
	2.03543, 2.00643, 1.95531, 1.95426, 1.92438, 1.82092, 1.88517, 1.85545,
	1.85083, 1.82758, 1.84475, 1.78771, 1.76683, 1.70858, 1.68278, 1.63849,
	1.59608, 1.52211, 1.52468, 1.47836, 1.4485, 1.40522, 1.35526, 1.32788,
	1.28834, 1.26938, 1.23241, 1.20345, 1.17087, 1.1344, 1.11012, 1.07147,
]);

export const SOLAR_SPECTRUM_POLICY_IDS = Object.freeze([
	'blackbody-5778k',
	'astm-g173',
	BRUNETON_2016_ASTMG173_POLICY_ID,
]);

let astmG173TableCache = null;

/**
 * Load the ASTM G-173 table from the downloaded compressed source artifact.
 *
 * @returns {{ kind: string, rows: Array<object>, wavelengthsNm: number[], provenance: object }}
 */
export function loadAstmg173SolarSpectrum() {
	if (astmG173TableCache) {
		return astmG173TableCache;
	}

	const csv = readZipTextEntry(readFileSync(ASTM_G173_ZIP_URL), ASTM_G173_ENTRY_NAME);
	const lines = csv.trim().split(/\r?\n/u);
	const rows = lines.slice(2).map(parseAstmg173Row);
	validateAstmg173Rows(rows);

	astmG173TableCache = {
		kind: 'astm-g173-reference-spectra',
		wavelengthsNm: rows.map((row) => row.wavelengthNm),
		rows,
		provenance: {
			sourceId: 'astm-g173',
			title: 'ASTM G-173-03 Reference Spectra Derived from SMARTS v. 2.9.2',
			sourceUrl: 'https://www.nlr.gov/grid/solar-resource/spectra-am1.5',
			downloadUrl: 'https://www.nlr.gov/media/docs/libraries/grid/zip/astmg173.zip?sfvrsn=1ef05e45_5',
			zipEntry: ASTM_G173_ENTRY_NAME,
			zipMd5: 'f643261ed8a6ca6b6b5af4dccadb16b4',
			zipSha256: 'de6ed831cd7426d9a7147d5c0a48b1e67a483cb7f8ecd6d3ae846848154a5657',
			column: 'extraterrestrialWm2Nm',
			units: 'W m-2 nm-1',
			wavelengthRangeNm: [280, 4000],
			rowCount: rows.length,
			grid: 'nonuniform ASTM G-173 wavelength grid',
		},
	};

	return astmG173TableCache;
}

/**
 * Sample a named solar spectrum onto the caller's wavelength grid.
 *
 * @param {number[]} wavelengthsNm - Wavelength grid in nanometers.
 * @param {{ policy?: 'blackbody-5778k' | 'astm-g173' | 'bruneton-2016-astm-40', solarTemperatureK?: number, solarIrradiance550Wm2Nm?: number }} options - Solar source policy.
 * @returns {{ valuesByWavelength: number[], provenance: object }}
 */
export function sampleSolarSpectrum(wavelengthsNm, options = {}) {
	const policy = options.policy ?? 'blackbody-5778k';

	if (policy === 'blackbody-5778k') {
		return blackbodySolarSpectrum(wavelengthsNm, options);
	}

	if (policy === 'astm-g173') {
		return astmG173ExtraterrestrialSpectrum(wavelengthsNm);
	}

	if (policy === BRUNETON_2016_ASTMG173_POLICY_ID) {
		return bruneton2016AstmG173BinnedSpectrum(wavelengthsNm);
	}

	throw new Error(`Unknown solar spectrum policy: ${policy}`);
}

/**
 * Sample the current blackbody preview/control solar spectrum.
 *
 * @param {number[]} wavelengthsNm - Wavelength grid in nanometers.
 * @param {{ solarTemperatureK?: number, solarIrradiance550Wm2Nm?: number }} options - Blackbody controls.
 * @returns {{ valuesByWavelength: number[], provenance: object }}
 */
export function blackbodySolarSpectrum(wavelengthsNm, options = {}) {
	validateWavelengths(wavelengthsNm);
	const solarTemperatureK = options.solarTemperatureK ?? 5778;
	const solarIrradiance550Wm2Nm = options.solarIrradiance550Wm2Nm ?? 1.87;

	return {
		valuesByWavelength: wavelengthsNm.map((wavelengthNm) => {
			return solarIrradiance550Wm2Nm
				* planckRelativeWavelength(wavelengthNm, 550, solarTemperatureK);
		}),
		provenance: {
			sourceId: 'blackbody-5778k',
			title: 'Blackbody-shaped preview solar spectrum',
			policy: 'blackbody-5778k',
			solarTemperatureK,
			normalization: {
				wavelengthNm: 550,
				irradianceWm2Nm: solarIrradiance550Wm2Nm,
			},
			units: 'W m-2 nm-1',
			resamplingPolicy: 'analytic Planck-relative function evaluated at caller wavelengths',
		},
	};
}

/**
 * Sample ASTM G-173 extraterrestrial irradiance onto the caller's wavelength grid.
 *
 * @param {number[]} wavelengthsNm - Wavelength grid in nanometers.
 * @returns {{ valuesByWavelength: number[], provenance: object }}
 */
export function astmG173ExtraterrestrialSpectrum(wavelengthsNm) {
	validateWavelengths(wavelengthsNm);
	const table = loadAstmg173SolarSpectrum();

	return {
		valuesByWavelength: wavelengthsNm.map((wavelengthNm) => {
			return interpolateAstmg173Extraterrestrial(table.rows, wavelengthNm);
		}),
		provenance: {
			...table.provenance,
			policy: 'astm-g173',
			resamplingPolicy: 'linear interpolation on the nonuniform ASTM G-173 wavelength grid; zero outside 280-4000 nm',
		},
	};
}

/**
 * Sample Bruneton's 40-bin ASTM G-173 ETR spectrum from the clear-sky-models source.
 *
 * @param {number[]} wavelengthsNm - Wavelength grid in nanometers.
 * @returns {{ valuesByWavelength: number[], provenance: object }}
 */
export function bruneton2016AstmG173BinnedSpectrum(wavelengthsNm) {
	validateWavelengths(wavelengthsNm);
	const sourceWavelengthsNm = bruneton2016AstmG173Wavelengths();

	return {
		valuesByWavelength: wavelengthsNm.map((wavelengthNm) => {
			return interpolateSamples(sourceWavelengthsNm, BRUNETON_2016_ASTMG173_SAMPLES, wavelengthNm);
		}),
		provenance: {
			sourceId: BRUNETON_2016_ASTMG173_POLICY_ID,
			title: 'Bruneton 2016 clear-sky-models 40-bin ASTM G-173 ETR solar spectrum',
			sourceUrl: 'https://github.com/ebruneton/clear-sky-models/blob/master/atmosphere/atmosphere.cc',
			policy: BRUNETON_2016_ASTMG173_POLICY_ID,
			column: 'ASTM G-173 ETR',
			units: 'W m-2 nm-1',
			wavelengthRangeNm: [BRUNETON_2016_ASTMG173_MIN_NM, BRUNETON_2016_ASTMG173_MAX_NM],
			rowCount: BRUNETON_2016_ASTMG173_SAMPLES.length,
			grid: '40 equally spaced Bruneton comparison samples',
			resamplingPolicy: 'linear interpolation from the 40 source samples; exact when caller uses the Bruneton 2016 40-wavelength grid',
			sourceComment: 'Bruneton source says each value is summed and averaged in its ASTM G-173 wavelength bin',
		},
	};
}

function interpolateAstmg173Extraterrestrial(rows, wavelengthNm) {
	if (wavelengthNm < rows[0].wavelengthNm || wavelengthNm > rows[rows.length - 1].wavelengthNm) {
		return 0;
	}

	let low = 0;
	let high = rows.length - 1;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const row = rows[mid];

		if (row.wavelengthNm === wavelengthNm) {
			return row.extraterrestrialWm2Nm;
		}

		if (row.wavelengthNm < wavelengthNm) {
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}

	const lower = rows[high];
	const upper = rows[low];
	const t = (wavelengthNm - lower.wavelengthNm) / (upper.wavelengthNm - lower.wavelengthNm);

	return lower.extraterrestrialWm2Nm
		+ (upper.extraterrestrialWm2Nm - lower.extraterrestrialWm2Nm) * t;
}

function bruneton2016AstmG173Wavelengths() {
	const stepNm = (
		BRUNETON_2016_ASTMG173_MAX_NM - BRUNETON_2016_ASTMG173_MIN_NM
	) / (BRUNETON_2016_ASTMG173_SAMPLES.length - 1);

	return BRUNETON_2016_ASTMG173_SAMPLES.map((_value, index) => {
		return BRUNETON_2016_ASTMG173_MIN_NM + stepNm * index;
	});
}

function interpolateSamples(wavelengthsNm, values, wavelengthNm) {
	if (wavelengthNm < wavelengthsNm[0] || wavelengthNm > wavelengthsNm[wavelengthsNm.length - 1]) {
		return 0;
	}

	for (let index = 0; index < wavelengthsNm.length; index += 1) {
		if (wavelengthsNm[index] === wavelengthNm) {
			return values[index];
		}
	}

	let low = 0;
	let high = wavelengthsNm.length - 1;

	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		const sampleWavelengthNm = wavelengthsNm[mid];

		if (sampleWavelengthNm < wavelengthNm) {
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}

	const lowerIndex = high;
	const upperIndex = low;
	const t = (wavelengthNm - wavelengthsNm[lowerIndex])
		/ (wavelengthsNm[upperIndex] - wavelengthsNm[lowerIndex]);

	return values[lowerIndex] + (values[upperIndex] - values[lowerIndex]) * t;
}

function parseAstmg173Row(line, index) {
	const columns = line.split(',');
	if (columns.length !== 4) {
		throw new Error(`Invalid ASTM G-173 row ${index + 1}: expected 4 columns`);
	}

	const [
		wavelengthNm,
		extraterrestrialWm2Nm,
		globalTiltWm2Nm,
		directCircumsolarWm2Nm,
	] = columns.map(Number);

	if (![wavelengthNm, extraterrestrialWm2Nm, globalTiltWm2Nm, directCircumsolarWm2Nm].every(Number.isFinite)) {
		throw new Error(`Invalid ASTM G-173 row ${index + 1}: expected finite numeric values`);
	}

	return {
		wavelengthNm,
		extraterrestrialWm2Nm,
		globalTiltWm2Nm,
		directCircumsolarWm2Nm,
	};
}

function validateAstmg173Rows(rows) {
	if (rows.length !== 2002) {
		throw new Error(`Expected 2002 ASTM G-173 rows, received ${rows.length}`);
	}

	if (rows[0].wavelengthNm !== 280 || rows[rows.length - 1].wavelengthNm !== 4000) {
		throw new Error('Expected ASTM G-173 wavelength range 280-4000 nm');
	}

	for (let index = 1; index < rows.length; index += 1) {
		if (rows[index].wavelengthNm <= rows[index - 1].wavelengthNm) {
			throw new Error(`Expected increasing ASTM G-173 wavelengths at row ${index + 1}`);
		}
	}
}

function validateWavelengths(wavelengthsNm) {
	if (!Array.isArray(wavelengthsNm)) {
		throw new Error('wavelengthsNm must be an array');
	}

	for (const wavelengthNm of wavelengthsNm) {
		if (!Number.isFinite(wavelengthNm)) {
			throw new Error('wavelengthsNm must contain only finite wavelengths');
		}
	}
}

function planckRelativeWavelength(wavelengthNm, referenceWavelengthNm, temperatureK) {
	const c2NmK = 1.438777e7;
	const referenceExponent = Math.exp(c2NmK / (referenceWavelengthNm * temperatureK)) - 1;
	const wavelengthExponent = Math.exp(c2NmK / (wavelengthNm * temperatureK)) - 1;

	return (referenceWavelengthNm / wavelengthNm) ** 5
		* referenceExponent
		/ wavelengthExponent;
}

function readZipTextEntry(zipBuffer, entryName) {
	const centralDirectory = findCentralDirectoryEntry(zipBuffer, entryName);
	const localHeaderOffset = centralDirectory.localHeaderOffset;

	if (zipBuffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
		throw new Error(`Invalid zip local header for ${entryName}`);
	}

	const fileNameLength = zipBuffer.readUInt16LE(localHeaderOffset + 26);
	const extraLength = zipBuffer.readUInt16LE(localHeaderOffset + 28);
	const dataOffset = localHeaderOffset + 30 + fileNameLength + extraLength;
	const compressed = zipBuffer.slice(dataOffset, dataOffset + centralDirectory.compressedSize);

	if (centralDirectory.compressionMethod === 0) {
		return compressed.toString('utf8');
	}

	if (centralDirectory.compressionMethod === 8) {
		return inflateRawSync(compressed).toString('utf8');
	}

	throw new Error(`Unsupported zip compression method ${centralDirectory.compressionMethod}`);
}

function findCentralDirectoryEntry(zipBuffer, entryName) {
	const eocdOffset = findEndOfCentralDirectory(zipBuffer);
	const centralDirectoryOffset = zipBuffer.readUInt32LE(eocdOffset + 16);
	const centralDirectorySize = zipBuffer.readUInt32LE(eocdOffset + 12);
	let offset = centralDirectoryOffset;
	const end = centralDirectoryOffset + centralDirectorySize;

	while (offset < end) {
		if (zipBuffer.readUInt32LE(offset) !== 0x02014b50) {
			throw new Error('Invalid zip central directory');
		}

		const compressionMethod = zipBuffer.readUInt16LE(offset + 10);
		const compressedSize = zipBuffer.readUInt32LE(offset + 20);
		const fileNameLength = zipBuffer.readUInt16LE(offset + 28);
		const extraLength = zipBuffer.readUInt16LE(offset + 30);
		const commentLength = zipBuffer.readUInt16LE(offset + 32);
		const localHeaderOffset = zipBuffer.readUInt32LE(offset + 42);
		const fileName = zipBuffer.slice(offset + 46, offset + 46 + fileNameLength).toString('utf8');

		if (fileName === entryName) {
			return {
				compressionMethod,
				compressedSize,
				localHeaderOffset,
			};
		}

		offset += 46 + fileNameLength + extraLength + commentLength;
	}

	throw new Error(`Zip entry not found: ${entryName}`);
}

function findEndOfCentralDirectory(zipBuffer) {
	for (let offset = zipBuffer.length - 22; offset >= 0; offset -= 1) {
		if (zipBuffer.readUInt32LE(offset) === 0x06054b50) {
			return offset;
		}
	}

	throw new Error('Zip end-of-central-directory record not found');
}
