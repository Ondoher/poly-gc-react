import {
	aerosolCoefficientsForPolicy,
	aerosolPolicyIds,
	loadAerosolPresetData,
	resolveAerosolPolicy,
	validateAerosolPresetData,
} from '../aerosol-policy.js';

describe('Aerosol composition policies', function() {
	it('loads named aerosol presets with the preview behavior as the default control', function() {
		const data = loadAerosolPresetData();

		expect(data.defaultPolicy).toBe('preview-earthlike-aerosol');
		expect(aerosolPolicyIds()).toContain('rayleigh-only');
		expect(aerosolPolicyIds()).toContain('clear-maritime');
		expect(aerosolPolicyIds()).toContain('clear-maritime-low-aod');
		expect(aerosolPolicyIds()).toContain('clear-maritime-high-g');
		expect(aerosolPolicyIds()).toContain('clear-maritime-deep-aerosol');
		expect(aerosolPolicyIds()).toContain('clear-continental');
		expect(aerosolPolicyIds()).toContain('bruneton-2016-kider-fit');
		expect(aerosolPolicyIds()).toContain('hazy-continental');
	});

	it('converts AOD and Angstrom exponent into local extinction coefficients', function() {
		const result = aerosolCoefficientsForPolicy([440, 550, 660], {
			policyId: 'clear-continental',
			densityScale: 1,
		});

		const policy = resolveAerosolPolicy('clear-continental');
		const expected550 = policy.aod550 / policy.scaleHeightKm;

		// Reason: the first aerosol policy uses the Angstrom optical-depth law and an exponential vertical column.
		// Source: Atmosphere Composition Plan, Aerosol/Mie model implementation slice.
		expect(result.extinctionByWavelength[1]).toBeCloseTo(expected550, 15);
		expect(result.extinctionByWavelength[0]).toBeGreaterThan(result.extinctionByWavelength[1]);
		expect(result.extinctionByWavelength[1]).toBeGreaterThan(result.extinctionByWavelength[2]);
		expect(result.scatteringByWavelength[1])
			.toBeCloseTo(result.extinctionByWavelength[1] * policy.singleScatteringAlbedo, 15);
		expect(result.provenance.policyId).toBe('clear-continental');
		// Reason: aerosol scalar provenance should point to the separate phase policy without owning phase shape.
		// Source: Reference Plan, Output-Impact Task 1 scalar/phase ownership split.
		expect(result.provenance.defaultPhasePolicyId).toBe('continental-hg-g070');
	});

	it('keeps rayleigh-only aerosol extinction at zero', function() {
		const result = aerosolCoefficientsForPolicy([440, 550, 660], {
			policyId: 'rayleigh-only',
		});

		expect(result.extinctionByWavelength).toEqual([0, 0, 0]);
		expect(result.scatteringByWavelength).toEqual([0, 0, 0]);
		expect(result.absorptionByWavelength).toEqual([0, 0, 0]);
	});

	it('exposes the Bruneton 2016 Kider-fit aerosol comparison parameters', function() {
		const policy = resolveAerosolPolicy('bruneton-2016-kider-fit');
		const result = aerosolCoefficientsForPolicy([550], {
			policyId: policy.id,
		});

		// Reason: model-family image matching should use the comparison paper's shared aerosol parameters.
		// Source: Bruneton 2016 clear-sky-models paper, Section 3.4 model parameters.
		expect(policy.aod550).toBeCloseTo(0.0645312146448, 12);
		expect(policy.angstromExponent).toBe(0.8);
		expect(policy.singleScatteringAlbedo).toBe(0.8);
		expect(policy.scaleHeightKm).toBe(1.2);
		expect(policy.defaultPhasePolicyId).toBe('bruneton-2016-cornette-shanks-g070');
		expect(result.provenance.defaultPhasePolicyId).toBe('bruneton-2016-cornette-shanks-g070');
		expect(result.extinctionByWavelength[0]).toBeCloseTo(0.0645312146448 / 1.2, 12);
		expect(result.scatteringByWavelength[0])
			.toBeCloseTo(result.extinctionByWavelength[0] * 0.8, 12);
	});

	it('maps scalar aerosol presets to explicit default phase policies', function() {
		const data = loadAerosolPresetData();
		const defaultPhaseByPreset = new Map(data.presets.map((preset) => {
			return [preset.id, preset.defaultPhasePolicyId];
		}));

		// Reason: phase policy defaults are current scalar-preset contract fields, not inferred from duplicate g values.
		// Source: Reference Plan, Output-Impact Task 1 implementation sequence.
		expect(defaultPhaseByPreset.get('rayleigh-only')).toEqual(jasmine.any(String));
		expect(defaultPhaseByPreset.get('preview-earthlike-aerosol')).toBe('preview-hg-g080');
		expect(defaultPhaseByPreset.get('clear-maritime')).toBe('clear-maritime-hg-g076');
		expect(defaultPhaseByPreset.get('clear-maritime-low-aod')).toBe('clear-maritime-hg-g076');
		expect(defaultPhaseByPreset.get('clear-maritime-low-g')).toBe('clear-maritime-hg-g060');
		expect(defaultPhaseByPreset.get('clear-maritime-high-g')).toBe('clear-maritime-hg-g086');
		expect(defaultPhaseByPreset.get('clear-continental')).toBe('continental-hg-g070');
		expect(defaultPhaseByPreset.get('bruneton-2016-kider-fit'))
			.toBe('bruneton-2016-cornette-shanks-g070');
		expect(defaultPhaseByPreset.get('hazy-continental')).toBe('hazy-continental-hg-g068');
	});

	it('rejects malformed preset data before policy use', function() {
		const data = structuredClone(loadAerosolPresetData());
		data.presets[0].singleScatteringAlbedo = 1.2;

		expect(() => validateAerosolPresetData(data)).toThrowError(/singleScatteringAlbedo/u);
	});

	it('rejects scalar presets without a default phase policy id', function() {
		const data = structuredClone(loadAerosolPresetData());
		data.presets[0].defaultPhasePolicyId = '';

		// Reason: scalar presets must name their phase policy so the medium builder does not invent phase parameters.
		// Source: Stage Contracts, evaluateScatteringPhase phase-policy ownership split.
		expect(() => validateAerosolPresetData(data)).toThrowError(/defaultPhasePolicyId/u);
	});
});
