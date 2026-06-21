/**
 * Spectral-to-color helpers for atmosphere reference artifacts.
 *
 * These functions are post-pipeline consumers. They do not participate in
 * atmosphere transport.
 */

import { readFileSync } from 'node:fs';

const OFFICIAL_CIE_TABLE_URL = new URL('../data/color/cie-1931-2deg.csv', import.meta.url);
const OFFICIAL_CIE_METADATA_URL = new URL('../data/color/cie-1931-2deg-metadata.json', import.meta.url);

let officialCieTableCache = null;
let officialCieMetadataCache = null;

/**
 * Convert spectral radiance samples to CIE XYZ and unclamped linear sRGB.
 *
 * @param {number[]} spectralRadiance - Spectral radiance values aligned to wavelengths.
 * @param {number[]} wavelengthsNm - Wavelength grid in nanometers.
 * @returns {{ xyz: { x: number, y: number, z: number }, linearRgb: { r: number, g: number, b: number }, provenance: object }}
 */
export function spectralRadianceToLinearSrgb(spectralRadiance, wavelengthsNm) {
	const xyzResult = spectralRadianceToXyz(spectralRadiance, wavelengthsNm);
	const linearRgb = xyzToLinearSrgb(xyzResult.xyz);

	return {
		xyz: xyzResult.xyz,
		linearRgb,
		provenance: {
			...xyzResult.provenance,
			rgbMatrix: 'sRGB D65 XYZ-to-linear-RGB matrix',
			outputColorSpace: 'linear-srgb',
			clamping: 'none',
		},
	};
}

/**
 * Convert spectral radiance samples to unnormalized CIE XYZ and unclamped linear sRGB.
 *
 * This diagnostic path preserves the raw wavelength integral scale so display
 * audits can compare it against the default equal-energy normalized preview path.
 *
 * @param {number[]} spectralRadiance - Spectral radiance values aligned to wavelengths.
 * @param {number[]} wavelengthsNm - Wavelength grid in nanometers.
 * @returns {{ xyz: { x: number, y: number, z: number }, linearRgb: { r: number, g: number, b: number }, provenance: object }}
 */
export function spectralRadianceToUnnormalizedLinearSrgb(spectralRadiance, wavelengthsNm) {
	const xyzResult = spectralRadianceToUnnormalizedXyz(spectralRadiance, wavelengthsNm);
	const linearRgb = xyzToLinearSrgb(xyzResult.xyz);

	return {
		xyz: xyzResult.xyz,
		linearRgb,
		provenance: {
			...xyzResult.provenance,
			rgbMatrix: 'sRGB D65 XYZ-to-linear-RGB matrix',
			outputColorSpace: 'linear-srgb',
			clamping: 'none',
		},
	};
}

/**
 * Integrate spectral radiance samples against the official CIE 1931 2-degree table.
 *
 * Wavelengths between table rows use linear interpolation. Wavelengths outside
 * the published 360-830 nm table range contribute zero.
 *
 * @param {number[]} spectralRadiance - Spectral radiance values aligned to wavelengths.
 * @param {number[]} wavelengthsNm - Wavelength grid in nanometers.
 * @returns {{ xyz: { x: number, y: number, z: number }, provenance: object }}
 */
export function spectralRadianceToXyz(spectralRadiance, wavelengthsNm) {
	const integrated = integrateSpectralRadianceToXyz(spectralRadiance, wavelengthsNm);
	const scale = integrated.yEqualEnergyResponse > 0 ? 1 / integrated.yEqualEnergyResponse : 1;

	return {
		xyz: {
			x: integrated.xyz.x * scale,
			y: integrated.xyz.y * scale,
			z: integrated.xyz.z * scale,
		},
		provenance: {
			...integrated.provenance,
			normalization: 'Y normalized by equal-energy response over caller wavelengths',
			normalizationScale: scale,
			yEqualEnergyResponse: integrated.yEqualEnergyResponse,
		},
	};
}

/**
 * Integrate spectral radiance samples against the official CIE table without
 * equal-energy normalization.
 *
 * This is a display-audit diagnostic. It is not the default preview color path.
 *
 * @param {number[]} spectralRadiance - Spectral radiance values aligned to wavelengths.
 * @param {number[]} wavelengthsNm - Wavelength grid in nanometers.
 * @returns {{ xyz: { x: number, y: number, z: number }, provenance: object }}
 */
export function spectralRadianceToUnnormalizedXyz(spectralRadiance, wavelengthsNm) {
	const integrated = integrateSpectralRadianceToXyz(spectralRadiance, wavelengthsNm);

	return {
		xyz: integrated.xyz,
		provenance: {
			...integrated.provenance,
			normalization: 'none; raw CIE integral keeps caller radiance scale and wavelength weights',
			normalizationScale: 1,
			yEqualEnergyResponse: integrated.yEqualEnergyResponse,
		},
	};
}

function integrateSpectralRadianceToXyz(spectralRadiance, wavelengthsNm) {
	validateAlignedSpectralSamples(spectralRadiance, wavelengthsNm);

	const table = loadOfficialCie1931Table();
	let x = 0;
	let y = 0;
	let z = 0;
	let yEqualEnergyResponse = 0;

	for (let index = 0; index < wavelengthsNm.length; index += 1) {
		const wavelengthNm = wavelengthsNm[index];
		const integrationWeightNm = wavelengthIntegrationWeightNm(wavelengthsNm, index);
		const cmf = officialCie1931ColorMatchingFunctions(wavelengthNm);
		const radiance = spectralRadiance[index] ?? 0;

		x += radiance * cmf.x * integrationWeightNm;
		y += radiance * cmf.y * integrationWeightNm;
		z += radiance * cmf.z * integrationWeightNm;
		yEqualEnergyResponse += cmf.y * integrationWeightNm;
	}

	return {
		xyz: {
			x,
			y,
			z,
		},
		yEqualEnergyResponse,
		provenance: {
			cmf: table.provenance,
			interpolation: 'linear within 1 nm table rows; zero outside 360-830 nm',
			integration: 'trapezoidal wavelength weights over caller-provided samples',
		},
	};
}

/**
 * Convert spectral samples to CIE XYZ and linear sRGB using the official table.
 *
 * @param {number[]} values - Spectral radiance values aligned to wavelengths.
 * @param {number[]} wavelengthsNm - Wavelength grid in nanometers.
 * @returns {{ xyz: { x: number, y: number, z: number }, linearRgb: { r: number, g: number, b: number }, provenance: object }}
 */
export function spectralToOfficialSrgb(values, wavelengthsNm) {
	return spectralRadianceToLinearSrgb(values, wavelengthsNm);
}

/**
 * Integrate spectral samples against the official CIE 1931 2-degree table.
 *
 * @param {number[]} values - Spectral radiance values aligned to wavelengths.
 * @param {number[]} wavelengthsNm - Wavelength grid in nanometers.
 * @returns {{ xyz: { x: number, y: number, z: number }, provenance: object }}
 */
export function spectralToOfficialXyz(values, wavelengthsNm) {
	return spectralRadianceToXyz(values, wavelengthsNm);
}

/**
 * Load and validate the official CIE 1931 2-degree table artifact.
 *
 * @returns {{ kind: string, wavelengthsNm: number[], rows: Array<{ wavelengthNm: number, x: number, y: number, z: number }>, byWavelengthNm: Map<number, { wavelengthNm: number, x: number, y: number, z: number }>, provenance: object }}
 */
export function loadOfficialCie1931Table() {
	if (officialCieTableCache) {
		return officialCieTableCache;
	}

	const csv = readFileSync(OFFICIAL_CIE_TABLE_URL, 'utf8');
	const rows = csv.trim().split(/\r?\n/u).map(parseOfficialCieRow);
	validateOfficialCieRows(rows);

	officialCieTableCache = {
		kind: 'cie-1931-2deg-color-matching-functions',
		wavelengthsNm: rows.map((row) => row.wavelengthNm),
		rows,
		byWavelengthNm: new Map(rows.map((row) => [row.wavelengthNm, row])),
		provenance: {
			sourceId: 'cie-1931-2deg',
			title: 'CIE 1931 colour-matching functions, 2 degree observer',
			sourceUrl: 'https://files.cie.co.at/CIE_xyz_1931_2deg.csv',
			publisherPage: 'https://cie.co.at/datatable/cie-1931-colour-matching-functions-2-degree-observer',
			doi: '10.25039/CIE.DS.xvudnb9b',
			publishedMd5: '17cca777db64b17170f06f67ce9d3ab7',
			wavelengthRangeNm: [360, 830],
			wavelengthStepNm: 1,
			rowCount: rows.length,
		},
	};

	return officialCieTableCache;
}

/**
 * Load the publisher metadata JSON for the official CIE 1931 table.
 *
 * @returns {object}
 */
export function loadOfficialCie1931Metadata() {
	if (officialCieMetadataCache) {
		return officialCieMetadataCache;
	}

	officialCieMetadataCache = JSON.parse(readFileSync(OFFICIAL_CIE_METADATA_URL, 'utf8'));

	return officialCieMetadataCache;
}

/**
 * Interpolate official CIE 1931 2-degree color matching functions.
 *
 * @param {number} wavelengthNm - Wavelength in nanometers.
 * @returns {{ x: number, y: number, z: number }}
 */
export function officialCie1931ColorMatchingFunctions(wavelengthNm) {
	if (!Number.isFinite(wavelengthNm)) {
		throw new Error('wavelengthNm must be finite');
	}

	const table = loadOfficialCie1931Table();
	const [minWavelengthNm, maxWavelengthNm] = table.provenance.wavelengthRangeNm;

	if (wavelengthNm < minWavelengthNm || wavelengthNm > maxWavelengthNm) {
		return { x: 0, y: 0, z: 0 };
	}

	const exact = table.byWavelengthNm.get(wavelengthNm);
	if (exact) {
		return { x: exact.x, y: exact.y, z: exact.z };
	}

	const lowerWavelengthNm = Math.floor(wavelengthNm);
	const upperWavelengthNm = Math.ceil(wavelengthNm);
	const lower = table.byWavelengthNm.get(lowerWavelengthNm);
	const upper = table.byWavelengthNm.get(upperWavelengthNm);

	if (!lower || !upper) {
		throw new Error(`Missing CIE table bracket for wavelength ${wavelengthNm} nm`);
	}

	const t = (wavelengthNm - lowerWavelengthNm) / (upperWavelengthNm - lowerWavelengthNm);

	return {
		x: lerp(lower.x, upper.x, t),
		y: lerp(lower.y, upper.y, t),
		z: lerp(lower.z, upper.z, t),
	};
}

/**
 * Convert spectral samples to approximate CIE XYZ and linear sRGB.
 *
 * @param {number[]} values - Spectral radiance values aligned to wavelengths.
 * @param {number[]} wavelengthsNm - Wavelength grid in nanometers.
 * @returns {{ xyz: { x: number, y: number, z: number }, linearRgb: { r: number, g: number, b: number } }}
 */
export function spectralToApproximateSrgb(values, wavelengthsNm) {
	const xyz = spectralToApproximateXyz(values, wavelengthsNm);
	const linearRgb = xyzToLinearSrgb(xyz);

	return {
		xyz,
		linearRgb: {
			r: Math.max(0, linearRgb.r),
			g: Math.max(0, linearRgb.g),
			b: Math.max(0, linearRgb.b),
		},
	};
}

/**
 * Integrate spectral samples against an analytic approximation to CIE 1931 XYZ.
 *
 * @param {number[]} values - Spectral radiance values aligned to wavelengths.
 * @param {number[]} wavelengthsNm - Wavelength grid in nanometers.
 * @returns {{ x: number, y: number, z: number }}
 */
export function spectralToApproximateXyz(values, wavelengthsNm) {
	validateAlignedSpectralSamples(values, wavelengthsNm);

	let x = 0;
	let y = 0;
	let z = 0;
	let yNormalizer = 0;

	for (let index = 0; index < wavelengthsNm.length; index += 1) {
		const wavelengthNm = wavelengthsNm[index];
		const integrationWeightNm = wavelengthIntegrationWeightNm(wavelengthsNm, index);
		const cmf = approximateCie1931ColorMatchingFunctions(wavelengthNm);
		const radiance = values[index] ?? 0;

		x += radiance * cmf.x * integrationWeightNm;
		y += radiance * cmf.y * integrationWeightNm;
		z += radiance * cmf.z * integrationWeightNm;
		yNormalizer += cmf.y * integrationWeightNm;
	}

	const scale = yNormalizer > 0 ? 1 / yNormalizer : 1;

	return {
		x: x * scale,
		y: y * scale,
		z: z * scale,
	};
}

/**
 * Approximate CIE 1931 2-degree color matching functions at one wavelength.
 *
 * Source: Wyman, Sloan, and Shirley analytic approximation to CIE 1931 XYZ.
 * This remains a named preview/fallback path beside the official CIE table.
 *
 * @param {number} wavelengthNm - Wavelength in nanometers.
 * @returns {{ x: number, y: number, z: number }}
 */
export function approximateCie1931ColorMatchingFunctions(wavelengthNm) {
	const x = 1.056 * asymmetricGaussian(wavelengthNm, 599.8, 0.0264, 0.0323)
		+ 0.362 * asymmetricGaussian(wavelengthNm, 442, 0.0624, 0.0374)
		- 0.065 * asymmetricGaussian(wavelengthNm, 501.1, 0.049, 0.0382);
	const y = 0.821 * asymmetricGaussian(wavelengthNm, 568.8, 0.0213, 0.0247)
		+ 0.286 * asymmetricGaussian(wavelengthNm, 530.9, 0.0613, 0.0322);
	const z = 1.217 * asymmetricGaussian(wavelengthNm, 437, 0.0845, 0.0278)
		+ 0.681 * asymmetricGaussian(wavelengthNm, 459, 0.0385, 0.0725);

	return {
		x: Math.max(0, x),
		y: Math.max(0, y),
		z: Math.max(0, z),
	};
}

/**
 * Convert CIE XYZ to linear sRGB.
 *
 * @param {{ x: number, y: number, z: number }} xyz - CIE XYZ values.
 * @returns {{ r: number, g: number, b: number }}
 */
export function xyzToLinearSrgb(xyz) {
	return {
		r: 3.2406 * xyz.x - 1.5372 * xyz.y - 0.4986 * xyz.z,
		g: -0.9689 * xyz.x + 1.8758 * xyz.y + 0.0415 * xyz.z,
		b: 0.0557 * xyz.x - 0.204 * xyz.y + 1.057 * xyz.z,
	};
}

function wavelengthIntegrationWeightNm(wavelengthsNm, index) {
	if (wavelengthsNm.length <= 1) {
		return 1;
	}

	if (index === 0) {
		return (wavelengthsNm[1] - wavelengthsNm[0]) / 2;
	}

	if (index === wavelengthsNm.length - 1) {
		return (wavelengthsNm[index] - wavelengthsNm[index - 1]) / 2;
	}

	return (wavelengthsNm[index + 1] - wavelengthsNm[index - 1]) / 2;
}

function validateAlignedSpectralSamples(values, wavelengthsNm) {
	if (!Array.isArray(values) || !Array.isArray(wavelengthsNm)) {
		throw new Error('values and wavelengthsNm must be arrays');
	}

	if (values.length !== wavelengthsNm.length) {
		throw new Error('values and wavelengthsNm must have matching lengths');
	}

	for (const wavelengthNm of wavelengthsNm) {
		if (!Number.isFinite(wavelengthNm)) {
			throw new Error('wavelengthsNm must contain only finite wavelengths');
		}
	}

	for (const value of values) {
		if (!Number.isFinite(value)) {
			throw new Error('values must contain only finite spectral radiance samples');
		}
	}
}

function parseOfficialCieRow(line, index) {
	const columns = line.split(',');
	if (columns.length !== 4) {
		throw new Error(`Invalid CIE row ${index + 1}: expected 4 columns`);
	}

	const [wavelengthNm, x, y, z] = columns.map(Number);
	if (![wavelengthNm, x, y, z].every(Number.isFinite)) {
		throw new Error(`Invalid CIE row ${index + 1}: expected finite numeric values`);
	}

	return { wavelengthNm, x, y, z };
}

function validateOfficialCieRows(rows) {
	if (rows.length !== 471) {
		throw new Error(`Expected 471 official CIE rows, received ${rows.length}`);
	}

	for (let index = 0; index < rows.length; index += 1) {
		const expectedWavelengthNm = 360 + index;
		const row = rows[index];
		if (row.wavelengthNm !== expectedWavelengthNm) {
			throw new Error(
				`Expected CIE wavelength ${expectedWavelengthNm} nm at row ${index + 1}, received ${row.wavelengthNm}`,
			);
		}
	}
}

function lerp(a, b, t) {
	return a + (b - a) * t;
}

function asymmetricGaussian(x, center, leftScale, rightScale) {
	const scale = x < center ? leftScale : rightScale;
	const t = scale * (x - center);

	return Math.exp(-0.5 * t * t);
}
