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
	});

	it('keeps rayleigh-only aerosol extinction at zero', function() {
		const result = aerosolCoefficientsForPolicy([440, 550, 660], {
			policyId: 'rayleigh-only',
		});

		expect(result.extinctionByWavelength).toEqual([0, 0, 0]);
		expect(result.scatteringByWavelength).toEqual([0, 0, 0]);
		expect(result.absorptionByWavelength).toEqual([0, 0, 0]);
	});

	it('rejects malformed preset data before policy use', function() {
		const data = structuredClone(loadAerosolPresetData());
		data.presets[0].singleScatteringAlbedo = 1.2;

		expect(() => validateAerosolPresetData(data)).toThrowError(/singleScatteringAlbedo/u);
	});
});
