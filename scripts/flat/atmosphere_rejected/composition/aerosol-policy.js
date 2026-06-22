import { readFileSync } from 'node:fs';
import { aerosolPhasePolicyIds } from './aerosol-phase-policy.js';

const AEROSOL_PRESETS_URL = new URL(
	'../data/composition/aerosol/aerosol-presets.json',
	import.meta.url,
);

let aerosolPresetDataCache = null;

export function loadAerosolPresetData() {
	if (aerosolPresetDataCache) {
		return aerosolPresetDataCache;
	}

	const data = JSON.parse(readFileSync(AEROSOL_PRESETS_URL, 'utf8'));
	validateAerosolPresetData(data);
	aerosolPresetDataCache = data;

	return data;
}

export function validateAerosolPresetData(data) {
	if (!data || data.kind !== 'flat-atmosphere-reference-aerosol-presets') {
		throw new Error('Aerosol preset data must have the expected source-data kind');
	}

	if (!Array.isArray(data.presets) || data.presets.length === 0) {
		throw new Error('Aerosol preset data must include presets');
	}

	const ids = new Set();
	for (const preset of data.presets) {
		if (!preset.id || ids.has(preset.id)) {
			throw new Error('Aerosol presets must have unique ids');
		}
		ids.add(preset.id);

		for (const field of ['aod550', 'angstromExponent', 'singleScatteringAlbedo', 'scaleHeightKm']) {
			if (!Number.isFinite(preset[field])) {
				throw new Error(`Aerosol preset ${preset.id} must have finite ${field}`);
			}
		}

		if (!preset.defaultPhasePolicyId || typeof preset.defaultPhasePolicyId !== 'string') {
			throw new Error(`Aerosol preset ${preset.id} must have defaultPhasePolicyId`);
		}

		if (preset.aod550 < 0) {
			throw new Error(`Aerosol preset ${preset.id} must have nonnegative aod550`);
		}

		if (preset.scaleHeightKm <= 0) {
			throw new Error(`Aerosol preset ${preset.id} must have positive scaleHeightKm`);
		}

		if (preset.singleScatteringAlbedo < 0 || preset.singleScatteringAlbedo > 1) {
			throw new Error(`Aerosol preset ${preset.id} must have singleScatteringAlbedo in [0, 1]`);
		}

	}

	if (!ids.has(data.defaultPolicy)) {
		throw new Error('Aerosol default policy must be one of the presets');
	}

	const phasePolicyIds = new Set(aerosolPhasePolicyIds());
	for (const preset of data.presets) {
		if (!phasePolicyIds.has(preset.defaultPhasePolicyId)) {
			throw new Error(`Aerosol preset ${preset.id} references unknown defaultPhasePolicyId ${preset.defaultPhasePolicyId}`);
		}
	}
}

export function aerosolPolicyIds() {
	return loadAerosolPresetData().presets.map((preset) => preset.id);
}

export function resolveAerosolPolicy(policyId = null) {
	const data = loadAerosolPresetData();
	const id = policyId ?? data.defaultPolicy;
	const preset = data.presets.find((candidate) => candidate.id === id);

	if (!preset) {
		throw new Error(`Unknown aerosol policy: ${id}`);
	}

	return {
		...preset,
		source: 'curated first-pass aerosol preset artifact',
		sources: data.sources,
		coefficientModel: data.model,
		defaultPolicy: data.defaultPolicy,
	};
}

export function aerosolCoefficientsForPolicy(wavelengthsNm, {
	policyId = null,
	densityScale = 1,
} = {}) {
	const policy = resolveAerosolPolicy(policyId);
	validateWavelengths(wavelengthsNm);

	if (!Number.isFinite(densityScale) || densityScale < 0) {
		throw new Error('Aerosol densityScale must be nonnegative and finite');
	}

	const beta550PerKm = policy.aod550 / policy.scaleHeightKm;
	const extinctionByWavelength = wavelengthsNm.map((wavelengthNm) => {
		return beta550PerKm
			* (wavelengthNm / 550) ** (-policy.angstromExponent)
			* densityScale;
	});
	const scatteringByWavelength = extinctionByWavelength.map((value) => {
		return value * policy.singleScatteringAlbedo;
	});
	const absorptionByWavelength = extinctionByWavelength.map((value, index) => {
		return value - scatteringByWavelength[index];
	});

	return {
		extinctionByWavelength,
		scatteringByWavelength,
		absorptionByWavelength,
		provenance: {
			policyId: policy.id,
			label: policy.label,
			aod550: policy.aod550,
			angstromExponent: policy.angstromExponent,
			singleScatteringAlbedo: policy.singleScatteringAlbedo,
			scaleHeightKm: policy.scaleHeightKm,
			defaultPhasePolicyId: policy.defaultPhasePolicyId,
			densityScale,
			coefficientModel: policy.coefficientModel,
			units: '1/km',
		},
	};
}

function validateWavelengths(wavelengthsNm) {
	if (!Array.isArray(wavelengthsNm) || wavelengthsNm.length === 0) {
		throw new Error('Aerosol policy requires a non-empty wavelength grid');
	}

	for (const wavelengthNm of wavelengthsNm) {
		if (!Number.isFinite(wavelengthNm) || wavelengthNm <= 0) {
			throw new Error('Aerosol policy wavelengths must be positive finite numbers');
		}
	}
}
