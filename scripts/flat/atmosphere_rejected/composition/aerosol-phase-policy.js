import { readFileSync } from 'node:fs';

const AEROSOL_PHASE_POLICIES_URL = new URL(
	'../data/composition/aerosol/aerosol-phase-policies.json',
	import.meta.url,
);

const SUPPORTED_AEROSOL_PHASE_KINDS = Object.freeze([
	'henyey-greenstein',
	'cornette-shanks',
]);

let aerosolPhasePolicyDataCache = null;

export function loadAerosolPhasePolicyData() {
	if (aerosolPhasePolicyDataCache) {
		return aerosolPhasePolicyDataCache;
	}

	const data = JSON.parse(readFileSync(AEROSOL_PHASE_POLICIES_URL, 'utf8'));
	validateAerosolPhasePolicyData(data);
	aerosolPhasePolicyDataCache = data;

	return data;
}

export function validateAerosolPhasePolicyData(data) {
	if (!data || data.kind !== 'flat-atmosphere-reference-aerosol-phase-policies') {
		throw new Error('Aerosol phase policy data must have the expected source-data kind');
	}

	if (!Array.isArray(data.sources) || data.sources.length === 0) {
		throw new Error('Aerosol phase policy data must include sources');
	}

	const sourceIds = new Set(data.sources.map((source) => source.id));
	if (sourceIds.size !== data.sources.length || sourceIds.has(undefined)) {
		throw new Error('Aerosol phase policy sources must have unique ids');
	}

	if (!Array.isArray(data.policies) || data.policies.length === 0) {
		throw new Error('Aerosol phase policy data must include policies');
	}

	const ids = new Set();
	for (const policy of data.policies) {
		if (!policy.id || ids.has(policy.id)) {
			throw new Error('Aerosol phase policies must have unique ids');
		}
		ids.add(policy.id);

		if (!SUPPORTED_AEROSOL_PHASE_KINDS.includes(policy.kind)) {
			throw new Error(`Aerosol phase policy ${policy.id} has unsupported phase kind`);
		}

		const g = policy.parameters?.g;
		if (!Number.isFinite(g) || g <= -1 || g >= 1) {
			throw new Error(`Aerosol phase policy ${policy.id} must have finite g inside (-1, 1)`);
		}

		if (!Array.isArray(policy.provenance?.sourceIds) || policy.provenance.sourceIds.length === 0) {
			throw new Error(`Aerosol phase policy ${policy.id} must include provenance sourceIds`);
		}

		for (const sourceId of policy.provenance.sourceIds) {
			if (!sourceIds.has(sourceId)) {
				throw new Error(`Aerosol phase policy ${policy.id} references unknown source ${sourceId}`);
			}
		}
	}

	if (!ids.has(data.defaultPolicy)) {
		throw new Error('Aerosol phase default policy must be one of the policies');
	}
}

export function aerosolPhasePolicyIds() {
	return loadAerosolPhasePolicyData().policies.map((policy) => policy.id);
}

export function resolveAerosolPhasePolicy(policyId = null) {
	const data = loadAerosolPhasePolicyData();
	const id = policyId ?? data.defaultPolicy;
	const policy = data.policies.find((candidate) => candidate.id === id);

	if (!policy) {
		throw new Error(`Unknown aerosol phase policy: ${id}`);
	}

	return {
		...policy,
		parameters: { ...policy.parameters },
		provenance: { ...policy.provenance },
		source: 'curated first-pass aerosol phase policy artifact',
		sources: data.sources,
		phaseModel: data.model,
		defaultPolicy: data.defaultPolicy,
	};
}
