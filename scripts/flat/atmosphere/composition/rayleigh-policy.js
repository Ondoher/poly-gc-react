import { readFileSync } from 'node:fs';

const BUCHOLTZ_DATA_URL = new URL(
	'../data/composition/rayleigh/bucholtz-1995-standard-air.json',
	import.meta.url,
);

export const RAYLEIGH_POLICY_IDS = Object.freeze([
	'rayleigh-lambda4-preview',
	'bucholtz-standard-air',
]);

let bucholtzDataCache = null;

export function loadBucholtzRayleighData() {
	if (bucholtzDataCache) {
		return bucholtzDataCache;
	}

	const data = JSON.parse(readFileSync(BUCHOLTZ_DATA_URL, 'utf8'));
	validateBucholtzRayleighData(data);
	bucholtzDataCache = data;

	return data;
}

export function validateBucholtzRayleighData(data) {
	if (!data || data.kind !== 'flat-atmosphere-reference-rayleigh-source-data') {
		throw new Error('Bucholtz Rayleigh data must have the expected source-data kind');
	}

	if (data.source?.doi !== '10.1364/AO.34.002765') {
		throw new Error('Bucholtz Rayleigh data must record DOI 10.1364/AO.34.002765');
	}

	if (!Array.isArray(data.table2PinnedRows) || data.table2PinnedRows.length === 0) {
		throw new Error('Bucholtz Rayleigh data must include Table 2 pinned rows');
	}

	const rowsByNm = new Map();
	for (const row of data.table2PinnedRows) {
		if (!Number.isFinite(row.wavelengthNm) || row.wavelengthNm <= 0) {
			throw new Error('Bucholtz Table 2 rows must have positive finite wavelengthNm');
		}

		if (
			!Number.isFinite(row.volumeScatteringCoefficientPerKm)
			|| row.volumeScatteringCoefficientPerKm < 0
		) {
			throw new Error('Bucholtz Table 2 rows must have nonnegative finite volume scattering coefficients');
		}

		rowsByNm.set(row.wavelengthNm, row);
	}

	for (const wavelengthNm of [450, 550, 650]) {
		if (!rowsByNm.has(wavelengthNm)) {
			throw new Error(`Bucholtz Table 2 rows must include ${wavelengthNm} nm`);
		}
	}

	if (
		!(
			rowsByNm.get(450).volumeScatteringCoefficientPerKm
			> rowsByNm.get(550).volumeScatteringCoefficientPerKm
			&& rowsByNm.get(550).volumeScatteringCoefficientPerKm
			> rowsByNm.get(650).volumeScatteringCoefficientPerKm
		)
	) {
		throw new Error('Bucholtz visible Rayleigh coefficients must decrease from 450 to 650 nm');
	}

	if (!Array.isArray(data.analyticFormula?.coefficientSets) || data.analyticFormula.coefficientSets.length < 2) {
		throw new Error('Bucholtz Rayleigh data must include analytic formula coefficient sets');
	}

	for (const coefficientSet of data.analyticFormula.coefficientSets) {
		validateFormulaCoefficients(coefficientSet.volumeScatteringCoefficientPerKm);
	}
}

export function resolveRayleighPolicy(policyId = 'rayleigh-lambda4-preview') {
	if (policyId === 'rayleigh-lambda4-preview') {
		return {
			id: policyId,
			label: 'Preview lambda^-4 Rayleigh',
			source: 'local preview model',
			coefficientModel: 'beta(lambda) = beta550 * (550 / lambda_nm)^4',
			requiresBeta550: true,
			coefficientsForWavelengths,
		};
	}

	if (policyId === 'bucholtz-standard-air') {
		const sourceData = loadBucholtzRayleighData();

		return {
			id: policyId,
			label: 'Bucholtz 1995 standard air Rayleigh',
			source: sourceData.source.citation,
			doi: sourceData.source.doi,
			coefficientModel: sourceData.analyticFormula.equation,
			standardAir: sourceData.standardAir,
			requiresBeta550: false,
			coefficientsForWavelengths(wavelengthsNm, options = {}) {
				return bucholtzCoefficientsForWavelengths(sourceData, wavelengthsNm, options);
			},
		};
	}

	throw new Error(`Unknown Rayleigh policy: ${policyId}`);
}

export function rayleighCoefficientsForPolicy(wavelengthsNm, {
	policyId = 'rayleigh-lambda4-preview',
	beta550PerKm,
	densityScale = 1,
} = {}) {
	const policy = resolveRayleighPolicy(policyId);

	return policy.coefficientsForWavelengths(wavelengthsNm, {
		beta550PerKm,
		densityScale,
	});
}

function coefficientsForWavelengths(wavelengthsNm, {
	beta550PerKm,
	densityScale = 1,
} = {}) {
	if (!Number.isFinite(beta550PerKm) || beta550PerKm < 0) {
		throw new Error('rayleigh-lambda4-preview requires a nonnegative finite beta550PerKm');
	}

	validateWavelengths(wavelengthsNm);

	return {
		valuesByWavelength: wavelengthsNm.map((wavelengthNm) => {
			return beta550PerKm * (550 / wavelengthNm) ** 4 * densityScale;
		}),
		provenance: {
			policyId: 'rayleigh-lambda4-preview',
			source: 'local preview model',
			coefficientModel: 'beta(lambda) = beta550 * (550 / lambda_nm)^4',
			beta550PerKm,
			densityScale,
			units: '1/km',
		},
	};
}

function bucholtzCoefficientsForWavelengths(sourceData, wavelengthsNm, {
	densityScale = 1,
} = {}) {
	validateWavelengths(wavelengthsNm);

	if (!Number.isFinite(densityScale) || densityScale < 0) {
		throw new Error('Bucholtz Rayleigh densityScale must be nonnegative and finite');
	}

	return {
		valuesByWavelength: wavelengthsNm.map((wavelengthNm) => {
			const wavelengthUm = wavelengthNm / 1000;
			const coefficients = coefficientSetForWavelength(sourceData, wavelengthUm)
				.volumeScatteringCoefficientPerKm;

			return evaluateFormula(coefficients, wavelengthUm) * densityScale;
		}),
		provenance: {
			policyId: 'bucholtz-standard-air',
			sourceId: sourceData.id,
			doi: sourceData.source.doi,
			source: sourceData.source.citation,
			standardAir: sourceData.standardAir,
			coefficientModel: 'Bucholtz 1995 Table 3 analytic formula for standard-air volume scattering coefficient',
			sourceTables: ['Table 2', 'Table 3'],
			densityScale,
			units: '1/km',
		},
	};
}

function coefficientSetForWavelength(sourceData, wavelengthUm) {
	if (wavelengthUm < 0.2) {
		throw new Error('Bucholtz Rayleigh policy supports wavelengths >= 200 nm');
	}

	return sourceData.analyticFormula.coefficientSets[wavelengthUm <= 0.5 ? 0 : 1];
}

function validateWavelengths(wavelengthsNm) {
	if (!Array.isArray(wavelengthsNm) || wavelengthsNm.length === 0) {
		throw new Error('Rayleigh policy requires a non-empty wavelength grid');
	}

	for (const wavelengthNm of wavelengthsNm) {
		if (!Number.isFinite(wavelengthNm) || wavelengthNm <= 0) {
			throw new Error('Rayleigh policy wavelengths must be positive finite numbers');
		}
	}
}

function validateFormulaCoefficients(coefficients) {
	for (const field of ['A', 'B', 'C', 'D']) {
		if (!Number.isFinite(coefficients?.[field])) {
			throw new Error(`Bucholtz formula coefficient ${field} must be finite`);
		}
	}
}

function evaluateFormula(coefficients, wavelengthUm) {
	const { A, B, C, D } = coefficients;

	return A * Math.pow(wavelengthUm, -(B + C * wavelengthUm + D / wavelengthUm));
}
