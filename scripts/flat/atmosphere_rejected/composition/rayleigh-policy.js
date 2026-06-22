import { readFileSync } from 'node:fs';

const BUCHOLTZ_DATA_URL = new URL(
	'../data/composition/rayleigh/bucholtz-1995-standard-air.json',
	import.meta.url,
);
const BRUNETON_2016_PENNDORF_POLICY_ID = 'bruneton-2016-penndorf-standard-air';
const BRUNETON_PENNDORF_MIN_NM = 360;
const BRUNETON_PENNDORF_MAX_NM = 830;
const BRUNETON_PENNDORF_TEMPERATURE_CORRECTION = 273.16 / (273.16 + 15);
const BRUNETON_PENNDORF_SAMPLES_PER_KM = Object.freeze([
	70.45, 62.82, 56.20, 50.43, 45.40, 40.98, 37.08, 33.65,
	30.60, 27.89, 25.48, 23.33, 21.40, 19.66, 18.10, 16.69,
	15.42, 14.26, 13.21, 12.26, 11.39, 10.60, 9.876, 9.212,
	8.604, 8.045, 7.531, 7.057, 6.620, 6.217, 5.844, 5.498,
	5.178, 4.881, 4.605, 4.348, 4.109, 3.886, 3.678, 3.484,
	3.302, 3.132, 2.973, 2.824, 2.684, 2.583, 2.481, 2.380,
].map((value) => {
	return value * 1e-3 * BRUNETON_PENNDORF_TEMPERATURE_CORRECTION;
}));

export const RAYLEIGH_POLICY_IDS = Object.freeze([
	'rayleigh-lambda4-preview',
	'bucholtz-standard-air',
	BRUNETON_2016_PENNDORF_POLICY_ID,
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

	if (policyId === BRUNETON_2016_PENNDORF_POLICY_ID) {
		return {
			id: policyId,
			label: 'Bruneton 2016 Penndorf standard-air Rayleigh',
			source: 'Bruneton clear-sky-models NewRayleighScattering, based on Penndorf 1957 Table III with 0C-to-15C correction',
			coefficientModel: 'linear interpolation of 48 Penndorf samples from 360 nm to 830 nm, converted to 1/km',
			requiresBeta550: false,
			coefficientsForWavelengths(wavelengthsNm, options = {}) {
				return brunetonPenndorfCoefficientsForWavelengths(wavelengthsNm, options);
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

function brunetonPenndorfCoefficientsForWavelengths(wavelengthsNm, {
	densityScale = 1,
} = {}) {
	validateWavelengths(wavelengthsNm);

	if (!Number.isFinite(densityScale) || densityScale < 0) {
		throw new Error('Bruneton Penndorf Rayleigh densityScale must be nonnegative and finite');
	}

	const sourceWavelengthsNm = brunetonPenndorfWavelengths();

	return {
		valuesByWavelength: wavelengthsNm.map((wavelengthNm) => {
			return interpolateSamples(sourceWavelengthsNm, BRUNETON_PENNDORF_SAMPLES_PER_KM, wavelengthNm)
				* densityScale;
		}),
		provenance: {
			policyId: BRUNETON_2016_PENNDORF_POLICY_ID,
			sourceId: 'bruneton-2016-clear-sky-models-new-rayleigh-scattering',
			source: 'https://github.com/ebruneton/clear-sky-models/blob/master/atmosphere/atmosphere.cc',
			literatureSource: 'Penndorf 1957, Table III, standard-air Rayleigh scattering coefficients',
			temperatureCorrection: 'T0 / (T0 + 15C), matching Bruneton source code',
			coefficientModel: 'linear interpolation of 48 source samples from 360 nm to 830 nm',
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

function brunetonPenndorfWavelengths() {
	const stepNm = (BRUNETON_PENNDORF_MAX_NM - BRUNETON_PENNDORF_MIN_NM)
		/ (BRUNETON_PENNDORF_SAMPLES_PER_KM.length - 1);

	return BRUNETON_PENNDORF_SAMPLES_PER_KM.map((_value, index) => {
		return BRUNETON_PENNDORF_MIN_NM + stepNm * index;
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
