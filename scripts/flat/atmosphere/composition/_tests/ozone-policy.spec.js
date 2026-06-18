import {
	loadBrionOzoneData,
	ozoneCrossSectionsForPolicy,
	resolveOzonePolicy,
	validateBrionOzoneData,
} from '../ozone-policy.js';

describe('Ozone composition policies', function() {
	it('keeps the preview Chappuis policy as the explicit control path', function() {
		const result = ozoneCrossSectionsForPolicy([550, 575, 603, 650], {
			policyId: 'preview-chappuis',
		});

		// Reason: existing sky-patch ozone behavior remains available as the comparison control.
		// Source: Reference Decision Log, preview Chappuis ozone absorber note.
		expect(result.provenance.policyId).toBe('preview-chappuis');
		expect(result.valuesByWavelength[2]).toBeGreaterThan(result.valuesByWavelength[0]);
		expect(result.valuesByWavelength[1]).toBeGreaterThan(result.valuesByWavelength[3]);
	});

	it('reads Brion 1998 295 K ozone cross sections from the sourced table', function() {
		const result = ozoneCrossSectionsForPolicy([450, 550, 575, 603, 650], {
			policyId: 'brion-1998-ozone-295k',
		});

		// Reason: the first sourced ozone policy should reproduce exact table rows at 1 nm anchors.
		// Source: MPI-Mainz Brion(1998) 295K 345-829nm(1nm) O3 data.
		expect(result.valuesByWavelength).toEqual([
			1.899e-22,
			3.356e-21,
			4.798e-21,
			5.19e-21,
			2.494e-21,
		]);
		expect(result.provenance.policyId).toBe('brion-1998-ozone-295k');
		expect(result.provenance.atlasDoi).toBe('10.5194/essd-5-365-2013');
	});

	it('linearly interpolates between Brion 1 nm table rows', function() {
		const result = ozoneCrossSectionsForPolicy([550.5], {
			policyId: 'brion-1998-ozone-295k',
		});

		// Reason: benchmark grids may later ask for non-integer wavelengths.
		// Source: MPI-Mainz raw data are 1 nm rows; policy declares linear interpolation.
		expect(result.valuesByWavelength[0]).toBeCloseTo((3.356e-21 + 3.388e-21) / 2, 34);
	});

	it('returns zero outside the Brion table range', function() {
		const result = ozoneCrossSectionsForPolicy([344, 830], {
			policyId: 'brion-1998-ozone-295k',
		});

		// Reason: source table support should be explicit instead of extrapolating invisible assumptions.
		// Source: Brion ozone metadata interpolation policy.
		expect(result.valuesByWavelength).toEqual([0, 0]);
	});

	it('rejects unknown policy ids loudly', function() {
		// Reason: policy selection should not silently fall back to a different absorber model.
		// Source: Atmosphere Composition Plan, named absorber policy requirement.
		expect(() => resolveOzonePolicy('unknown-ozone-policy')).toThrowError(/Unknown ozone policy/u);
	});

	it('rejects malformed Brion source data before policy use', function() {
		const data = structuredClone(loadBrionOzoneData());
		data.rows = data.rows.filter((row) => row.wavelengthNm !== 603);

		// Reason: sourced rows are the oracle artifact and should fail loudly if required anchors disappear.
		// Source: Atmosphere Composition Plan, ozone source-data requirements.
		expect(() => validateBrionOzoneData(data)).toThrowError(/row count/u);
	});
});
