import {
	loadBucholtzRayleighData,
	rayleighCoefficientsForPolicy,
	resolveRayleighPolicy,
	validateBucholtzRayleighData,
} from '../rayleigh-policy.js';

describe('Rayleigh composition policies', function() {
	it('keeps the preview lambda^-4 policy as the explicit control path', function() {
		const result = rayleighCoefficientsForPolicy([450, 550, 650], {
			policyId: 'rayleigh-lambda4-preview',
			beta550PerKm: 0.013558,
		});

		// Reason: the existing sky-patch behavior remains the default/control policy until comparison review.
		// Source: Atmosphere Composition Plan, Rayleigh implementation substep 5.
		expect(result.valuesByWavelength[1]).toBeCloseTo(0.013558, 15);
		expect(result.valuesByWavelength[0]).toBeGreaterThan(result.valuesByWavelength[1]);
		expect(result.valuesByWavelength[1]).toBeGreaterThan(result.valuesByWavelength[2]);
		expect(result.provenance.policyId).toBe('rayleigh-lambda4-preview');
	});

	it('evaluates the Bucholtz standard-air policy from the sourced formula', function() {
		const result = rayleighCoefficientsForPolicy([450, 550, 650], {
			policyId: 'bucholtz-standard-air',
		});

		// Reason: Bucholtz Table 3 formula constants should reproduce Table 2 visible rows to table precision.
		// Source: Bucholtz 1995 Tables 2 and 3.
		expect(result.valuesByWavelength[0]).toBeCloseTo(2.616e-2, 4);
		expect(result.valuesByWavelength[1]).toBeCloseTo(1.149e-2, 4);
		expect(result.valuesByWavelength[2]).toBeCloseTo(5.819e-3, 4);
		expect(result.provenance.policyId).toBe('bucholtz-standard-air');
		expect(result.provenance.doi).toBe('10.1364/AO.34.002765');
	});

	it('scales either policy by local density without changing source provenance', function() {
		const seaLevel = rayleighCoefficientsForPolicy([550], {
			policyId: 'bucholtz-standard-air',
			densityScale: 1,
		});
		const halfDensity = rayleighCoefficientsForPolicy([550], {
			policyId: 'bucholtz-standard-air',
			densityScale: 0.5,
		});

		// Reason: the atmosphere profile supplies local density scaling; the policy supplies sea-level spectral shape.
		// Source: Atmosphere Composition Plan, policy/data separation.
		expect(halfDensity.valuesByWavelength[0]).toBeCloseTo(seaLevel.valuesByWavelength[0] * 0.5, 15);
		expect(halfDensity.provenance.policyId).toBe('bucholtz-standard-air');
	});

	it('rejects unknown policy ids loudly', function() {
		// Reason: policy selection should not silently fall back to a different atmosphere model.
		// Source: Atmosphere Composition Plan, named policy requirement.
		expect(() => resolveRayleighPolicy('unknown-rayleigh-policy')).toThrowError(/Unknown Rayleigh policy/u);
	});

	it('rejects malformed Bucholtz data before policy use', function() {
		const data = structuredClone(loadBucholtzRayleighData());
		data.table2PinnedRows = data.table2PinnedRows.filter((row) => row.wavelengthNm !== 550);

		// Reason: sourced rows are an oracle artifact and should fail loudly if required visible anchors disappear.
		// Source: Atmosphere Composition Plan, Rayleigh implementation substep 6.
		expect(() => validateBucholtzRayleighData(data)).toThrowError(/550 nm/u);
	});
});
