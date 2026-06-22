import fs from 'fs';

const BUCHOLTZ_DATA_PATH =
	'scripts/flat/atmosphere_rejected/data/composition/rayleigh/bucholtz-1995-standard-air.json';

function loadBucholtzData() {
	return JSON.parse(fs.readFileSync(BUCHOLTZ_DATA_PATH, 'utf8'));
}

function evaluateFormula(coefficientSet, wavelengthUm) {
	const { A, B, C, D } = coefficientSet;
	return A * Math.pow(wavelengthUm, -(B + C * wavelengthUm + D / wavelengthUm));
}

describe('Bucholtz Rayleigh source data', function() {
	it('records the selected source and pinned primary quantity', function() {
		const data = loadBucholtzData();

		// Reason: the atmosphere-composition package owns sourced physical coefficients, not display conversion.
		// Source: Atmosphere Composition Plan, Rayleigh implementation substeps 1-4.
		expect(data.kind).toBe('flat-atmosphere-reference-rayleigh-source-data');
		expect(data.id).toBe('bucholtz-1995-standard-air-rayleigh');
		expect(data.source.doi).toBe('10.1364/AO.34.002765');
		expect(data.standardAir).toEqual({ pressureMbar: 1013.25, temperatureK: 288.15 });
		expect(data.pinnedQuantityDecision.selectedPrimaryQuantity)
			.toBe('standard-air volume scattering coefficient');
		expect(data.pinnedQuantityDecision.selectedPrimaryUnits).toBe('1/km');
	});

	it('pins visible standard-air volume-scattering coefficient rows', function() {
		const data = loadBucholtzData();
		const rowsByNm = new Map(data.table2PinnedRows.map((row) => [row.wavelengthNm, row]));

		// Reason: visible blue/green/red rows are the first directly useful local medium coefficients.
		// Source: Bucholtz 1995 Table 2, standard air at 1013.25 mbar and 288.15 K.
		expect(rowsByNm.get(450).volumeScatteringCoefficientPerKm).toBe(2.616e-2);
		expect(rowsByNm.get(550).volumeScatteringCoefficientPerKm).toBe(1.149e-2);
		expect(rowsByNm.get(650).volumeScatteringCoefficientPerKm).toBe(5.819e-3);
		expect(rowsByNm.get(450).crossSectionCm2).toBe(1.027e-26);
		expect(rowsByNm.get(550).crossSectionCm2).toBe(4.509e-27);
		expect(rowsByNm.get(650).crossSectionCm2).toBe(2.284e-27);
	});

	it('keeps visible Rayleigh coefficients decreasing from blue to red', function() {
		const data = loadBucholtzData();
		const visibleRows = data.table2PinnedRows.filter(
			(row) => row.wavelengthNm >= 450 && row.wavelengthNm <= 650,
		);

		// Reason: sourced Rayleigh coefficients should preserve the expected stronger blue scattering.
		// Source: Bucholtz Table 2 visible coefficient rows.
		expect(visibleRows.map((row) => row.wavelengthNm)).toEqual([450, 550, 650]);
		expect(visibleRows[0].volumeScatteringCoefficientPerKm)
			.toBeGreaterThan(visibleRows[1].volumeScatteringCoefficientPerKm);
		expect(visibleRows[1].volumeScatteringCoefficientPerKm)
			.toBeGreaterThan(visibleRows[2].volumeScatteringCoefficientPerKm);
	});

	it('stores analytic constants that reproduce pinned coefficient rows within table precision', function() {
		const data = loadBucholtzData();

		for (const row of data.table2PinnedRows) {
			const formulaSet = data.analyticFormula.coefficientSets[
				row.wavelengthUm <= 0.5 ? 0 : 1
			].volumeScatteringCoefficientPerKm;
			const computed = evaluateFormula(formulaSet, row.wavelengthUm);
			const relativeError = Math.abs(computed - row.volumeScatteringCoefficientPerKm) /
				row.volumeScatteringCoefficientPerKm;

			// Reason: Table 3 formula constants should agree with Table 2 rows to rounded table precision.
			// Source: Bucholtz 1995 Tables 2 and 3.
			expect(relativeError).withContext(`relative error at ${row.wavelengthUm} um`)
				.toBeLessThan(0.005);
		}
	});

	it('keeps optical-depth rows secondary to the selected local coefficient artifact', function() {
		const data = loadBucholtzData();
		const rowsByNm = new Map(data.table4ValidationRows.map((row) => [row.wavelengthNm, row]));

		// Reason: optical depth is useful validation data, but it depends on the named atmosphere column.
		// Source: Bucholtz 1995 Table 4, 1962 U.S. Standard atmosphere column.
		expect(data.pinnedQuantityDecision.secondaryValidationQuantity)
			.toBe('vertical Rayleigh optical depth for named atmospheres');
		expect(rowsByNm.get(450).rayleighOpticalDepth).toBe(2.214e-1);
		expect(rowsByNm.get(550).rayleighOpticalDepth).toBe(9.721e-2);
		expect(rowsByNm.get(650).rayleighOpticalDepth).toBe(4.924e-2);
		expect(rowsByNm.get(1000).rayleighOpticalDepth).toBe(8.645e-3);
	});
});
