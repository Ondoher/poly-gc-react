import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const BRION_METADATA_URL = new URL(
	'../data/composition/ozone/O3_Brion-1998_295K_345-829nm_1nm-metadata.json',
	import.meta.url,
);
const BRION_DATA_URL = new URL(
	'../data/composition/ozone/O3_Brion-1998_295K_345-829nm_1nm.txt',
	import.meta.url,
);

export const OZONE_POLICY_IDS = Object.freeze([
	'preview-chappuis',
	'brion-1998-ozone-295k',
]);

let brionDataCache = null;

export function loadBrionOzoneData() {
	if (brionDataCache) {
		return brionDataCache;
	}

	const metadata = JSON.parse(readFileSync(BRION_METADATA_URL, 'utf8'));
	const tableText = readFileSync(BRION_DATA_URL, 'utf8');
	const rows = parseOzoneCrossSectionTable(tableText);
	const data = { metadata, rows };
	validateBrionOzoneData(data, tableText);
	brionDataCache = data;

	return data;
}

export function validateBrionOzoneData(data, tableText = null) {
	if (!data || data.metadata?.kind !== 'flat-atmosphere-reference-ozone-source-data') {
		throw new Error('Brion ozone data must have the expected source-data kind');
	}

	if (data.metadata.source?.atlasDoi !== '10.5194/essd-5-365-2013') {
		throw new Error('Brion ozone metadata must record MPI-Mainz atlas DOI 10.5194/essd-5-365-2013');
	}

	if (!Array.isArray(data.rows) || data.rows.length !== data.metadata.table?.rowCount) {
		throw new Error('Brion ozone table must match the metadata row count');
	}

	const [firstWavelengthNm, lastWavelengthNm] = data.metadata.table.wavelengthRangeNm;
	if (
		data.rows[0]?.wavelengthNm !== firstWavelengthNm
		|| data.rows[data.rows.length - 1]?.wavelengthNm !== lastWavelengthNm
	) {
		throw new Error('Brion ozone table wavelength range must match metadata');
	}

	for (let index = 0; index < data.rows.length; index += 1) {
		const row = data.rows[index];

		if (!Number.isFinite(row.wavelengthNm) || !Number.isFinite(row.crossSectionCm2)) {
			throw new Error('Brion ozone rows must contain finite numbers');
		}

		if (row.crossSectionCm2 < 0) {
			throw new Error('Brion ozone cross sections must be nonnegative');
		}

		if (index > 0 && row.wavelengthNm !== data.rows[index - 1].wavelengthNm + 1) {
			throw new Error('Brion ozone wavelengths must increase in 1 nm steps');
		}
	}

	const rowsByNm = new Map(data.rows.map((row) => [row.wavelengthNm, row]));
	for (const pinned of data.metadata.pinnedRows ?? []) {
		const row = rowsByNm.get(pinned.wavelengthNm);

		if (!row || row.crossSectionCm2 !== pinned.crossSectionCm2) {
			throw new Error(`Brion ozone pinned row mismatch at ${pinned.wavelengthNm} nm`);
		}
	}

	if (!(rowsByNm.get(603).crossSectionCm2 > rowsByNm.get(575).crossSectionCm2)) {
		throw new Error('Brion ozone Chappuis rows should peak higher near 603 nm than 575 nm');
	}

	if (tableText !== null) {
		const sha256 = createHash('sha256').update(tableText).digest('hex');

		if (sha256 !== data.metadata.download.sha256) {
			throw new Error('Brion ozone raw table SHA256 must match metadata');
		}
	}
}

export function resolveOzonePolicy(policyId = 'preview-chappuis') {
	if (policyId === 'preview-chappuis') {
		return {
			id: policyId,
			label: 'Preview Chappuis ozone',
			source: 'local preview model',
			crossSectionModel: 'two broad Gaussian Chappuis lobes near 575 nm and 603 nm',
			crossSectionsForWavelengths(wavelengthsNm) {
				validateWavelengths(wavelengthsNm);

				return {
					valuesByWavelength: wavelengthsNm.map(previewChappuisCrossSectionCm2),
					provenance: {
						policyId,
						source: 'local preview model',
						crossSectionModel: 'two broad Gaussian Chappuis lobes near 575 nm and 603 nm',
						units: 'cm^2 molecule^-1',
					},
				};
			},
		};
	}

	if (policyId === 'brion-1998-ozone-295k') {
		const sourceData = loadBrionOzoneData();

		return {
			id: policyId,
			label: 'Brion 1998 ozone 295 K',
			source: sourceData.metadata.source.measurementCitation,
			atlasDoi: sourceData.metadata.source.atlasDoi,
			temperatureK: sourceData.metadata.table.temperatureK,
			crossSectionModel: 'linear interpolation of MPI-Mainz Brion 1998 295 K 1 nm table',
			crossSectionsForWavelengths(wavelengthsNm) {
				return brionCrossSectionsForWavelengths(sourceData, wavelengthsNm);
			},
		};
	}

	throw new Error(`Unknown ozone policy: ${policyId}`);
}

export function ozoneCrossSectionsForPolicy(wavelengthsNm, {
	policyId = 'preview-chappuis',
} = {}) {
	const policy = resolveOzonePolicy(policyId);
	return policy.crossSectionsForWavelengths(wavelengthsNm);
}

function parseOzoneCrossSectionTable(text) {
	const values = text.trim().split(/\s+/u).map(Number);

	if (values.length % 2 !== 0) {
		throw new Error('Brion ozone table must contain wavelength/cross-section pairs');
	}

	const rows = [];
	for (let index = 0; index < values.length; index += 2) {
		rows.push({
			wavelengthNm: values[index],
			crossSectionCm2: values[index + 1],
		});
	}

	return rows;
}

function brionCrossSectionsForWavelengths(sourceData, wavelengthsNm) {
	validateWavelengths(wavelengthsNm);

	const rows = sourceData.rows;
	const first = rows[0];
	const last = rows[rows.length - 1];

	return {
		valuesByWavelength: wavelengthsNm.map((wavelengthNm) => {
			if (wavelengthNm < first.wavelengthNm || wavelengthNm > last.wavelengthNm) {
				return 0;
			}

			const lowerIndex = Math.floor(wavelengthNm - first.wavelengthNm);
			const lower = rows[lowerIndex];

			if (lower.wavelengthNm === wavelengthNm || lowerIndex === rows.length - 1) {
				return lower.crossSectionCm2;
			}

			const upper = rows[lowerIndex + 1];
			const fraction = (wavelengthNm - lower.wavelengthNm)
				/ (upper.wavelengthNm - lower.wavelengthNm);

			return lower.crossSectionCm2
				+ (upper.crossSectionCm2 - lower.crossSectionCm2) * fraction;
		}),
		provenance: {
			policyId: 'brion-1998-ozone-295k',
			sourceId: sourceData.metadata.id,
			source: sourceData.metadata.source.measurementCitation,
			atlasDoi: sourceData.metadata.source.atlasDoi,
			datasetUrl: sourceData.metadata.source.datasetUrl,
			temperatureK: sourceData.metadata.table.temperatureK,
			interpolation: sourceData.metadata.policyUse.interpolation,
			units: sourceData.metadata.table.crossSectionUnits,
		},
	};
}

function previewChappuisCrossSectionCm2(wavelengthNm) {
	const firstBand = 4.8e-21 * Math.exp(-0.5 * ((wavelengthNm - 575) / 45) ** 2);
	const secondBand = 5.23e-21 * Math.exp(-0.5 * ((wavelengthNm - 603) / 45) ** 2);

	return 0.5 * (firstBand + secondBand);
}

function validateWavelengths(wavelengthsNm) {
	if (!Array.isArray(wavelengthsNm) || wavelengthsNm.length === 0) {
		throw new Error('Ozone policy requires a non-empty wavelength grid');
	}

	for (const wavelengthNm of wavelengthsNm) {
		if (!Number.isFinite(wavelengthNm) || wavelengthNm <= 0) {
			throw new Error('Ozone policy wavelengths must be positive finite numbers');
		}
	}
}
