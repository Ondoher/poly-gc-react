import {
	loadUsStandardAtmosphereDensityData,
	molecularDensityScaleForPolicy,
	resolveMolecularProfilePolicy,
	validateUsStandardAtmosphereDensityData,
} from '../profile-policy.js';

describe('Atmosphere molecular profile policies', function() {
	it('keeps the preview exponential profile as an explicit control path', function() {
		const result = molecularDensityScaleForPolicy(8, {
			policyId: 'preview-exponential-8km',
			scaleHeightKm: 8,
		});

		expect(result.densityScale).toBeCloseTo(Math.exp(-1), 15);
		expect(result.provenance.policyId).toBe('preview-exponential-8km');
	});

	it('interpolates the U.S. Standard Atmosphere density-ratio table', function() {
		const seaLevel = molecularDensityScaleForPolicy(0, {
			policyId: 'us-standard-atmosphere-1976-density',
		});
		const between = molecularDensityScaleForPolicy(2.5, {
			policyId: 'us-standard-atmosphere-1976-density',
		});
		const atTen = molecularDensityScaleForPolicy(10, {
			policyId: 'us-standard-atmosphere-1976-density',
		});

		// Reason: the first sourced molecular profile is table-backed and uses linear interpolation.
		// Source: PDAS U.S. Standard Atmosphere 1976 Table 1 SI rows.
		expect(seaLevel.densityScale).toBe(1);
		expect(between.densityScale).toBeCloseTo((1 + 0.60117) / 2, 12);
		expect(atTen.densityScale).toBeCloseTo(0.33756, 12);
		expect(atTen.provenance.nasaNtrsRecord).toBe('19770009539');
	});

	it('rejects unknown profile policies loudly', function() {
		expect(() => resolveMolecularProfilePolicy('unknown-profile'))
			.toThrowError(/Unknown molecular profile policy/u);
	});

	it('rejects malformed density data before policy use', function() {
		const data = structuredClone(loadUsStandardAtmosphereDensityData());
		data.rows[1].densityRatio = 2;

		expect(() => validateUsStandardAtmosphereDensityData(data)).toThrowError(/must not increase/u);
	});
});
