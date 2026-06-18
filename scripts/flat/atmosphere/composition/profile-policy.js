import { readFileSync } from 'node:fs';

const US_STANDARD_DENSITY_URL = new URL(
	'../data/composition/profile/us-standard-atmosphere-1976-density.json',
	import.meta.url,
);

export const MOLECULAR_PROFILE_POLICY_IDS = Object.freeze([
	'preview-exponential-8km',
	'us-standard-atmosphere-1976-density',
]);

let usStandardDensityCache = null;

export function loadUsStandardAtmosphereDensityData() {
	if (usStandardDensityCache) {
		return usStandardDensityCache;
	}

	const data = JSON.parse(readFileSync(US_STANDARD_DENSITY_URL, 'utf8'));
	validateUsStandardAtmosphereDensityData(data);
	usStandardDensityCache = data;

	return data;
}

export function validateUsStandardAtmosphereDensityData(data) {
	if (!data || data.kind !== 'flat-atmosphere-reference-profile-source-data') {
		throw new Error('U.S. Standard Atmosphere density data must have the expected source-data kind');
	}

	if (data.source?.nasaNtrsRecord !== '19770009539') {
		throw new Error('U.S. Standard Atmosphere density data must record NASA NTRS 19770009539');
	}

	if (!Array.isArray(data.rows) || data.rows.length < 3) {
		throw new Error('U.S. Standard Atmosphere density data must include rows');
	}

	for (let index = 0; index < data.rows.length; index += 1) {
		const row = data.rows[index];

		for (const field of ['altitudeKm', 'densityKgM3', 'densityRatio']) {
			if (!Number.isFinite(row[field]) || row[field] < 0) {
				throw new Error(`U.S. Standard Atmosphere density row must have nonnegative finite ${field}`);
			}
		}

		if (index > 0) {
			const previous = data.rows[index - 1];

			if (row.altitudeKm <= previous.altitudeKm) {
				throw new Error('U.S. Standard Atmosphere density rows must increase by altitude');
			}

			if (row.densityRatio > previous.densityRatio) {
				throw new Error('U.S. Standard Atmosphere density ratios must not increase in the lower sky shell');
			}
		}
	}

	if (data.rows[0].altitudeKm !== 0 || data.rows[0].densityRatio !== 1) {
		throw new Error('U.S. Standard Atmosphere density data must start at sea-level density ratio 1');
	}
}

export function resolveMolecularProfilePolicy(policyId = 'preview-exponential-8km') {
	if (policyId === 'preview-exponential-8km') {
		return {
			id: policyId,
			label: 'Preview exponential 8 km molecular profile',
			source: 'local preview model',
			densityScaleAt(altitudeKm, { scaleHeightKm = 8 } = {}) {
				return Math.exp(-Math.max(0, altitudeKm) / scaleHeightKm);
			},
			provenanceAt(altitudeKm, { scaleHeightKm = 8 } = {}) {
				return {
					policyId,
					source: 'local preview model',
					model: 'exp(-altitudeKm / scaleHeightKm)',
					scaleHeightKm,
					altitudeKm,
				};
			},
		};
	}

	if (policyId === 'us-standard-atmosphere-1976-density') {
		const sourceData = loadUsStandardAtmosphereDensityData();

		return {
			id: policyId,
			label: 'U.S. Standard Atmosphere 1976 density table',
			source: sourceData.source.primaryStandard,
			nasaNtrsRecord: sourceData.source.nasaNtrsRecord,
			densityScaleAt(altitudeKm) {
				return interpolateDensityRatio(sourceData.rows, altitudeKm);
			},
			provenanceAt(altitudeKm) {
				return {
					policyId,
					sourceId: sourceData.id,
					source: sourceData.source.primaryStandard,
					nasaNtrsRecord: sourceData.source.nasaNtrsRecord,
					tableUrl: sourceData.source.tableUrl,
					interpolation: sourceData.policyUse.interpolation,
					altitudeKm,
					units: sourceData.units.densityRatio,
				};
			},
		};
	}

	throw new Error(`Unknown molecular profile policy: ${policyId}`);
}

export function molecularDensityScaleForPolicy(altitudeKm, {
	policyId = 'preview-exponential-8km',
	scaleHeightKm = 8,
} = {}) {
	const policy = resolveMolecularProfilePolicy(policyId);

	return {
		densityScale: policy.densityScaleAt(altitudeKm, { scaleHeightKm }),
		provenance: policy.provenanceAt(altitudeKm, { scaleHeightKm }),
	};
}

function interpolateDensityRatio(rows, altitudeKm) {
	if (!Number.isFinite(altitudeKm)) {
		throw new Error('Molecular profile altitudeKm must be finite');
	}

	if (altitudeKm <= rows[0].altitudeKm) {
		return rows[0].densityRatio;
	}

	const last = rows[rows.length - 1];
	if (altitudeKm >= last.altitudeKm) {
		return last.densityRatio;
	}

	for (let index = 0; index < rows.length - 1; index += 1) {
		const lower = rows[index];
		const upper = rows[index + 1];

		if (altitudeKm >= lower.altitudeKm && altitudeKm <= upper.altitudeKm) {
			const fraction = (altitudeKm - lower.altitudeKm)
				/ (upper.altitudeKm - lower.altitudeKm);

			return lower.densityRatio + (upper.densityRatio - lower.densityRatio) * fraction;
		}
	}

	return last.densityRatio;
}
