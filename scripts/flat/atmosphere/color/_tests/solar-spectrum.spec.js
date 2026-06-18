import {
	blackbodySolarSpectrum,
	loadAstmg173SolarSpectrum,
	sampleSolarSpectrum,
} from '../solar-spectrum.js';

describe('solar-spectrum post-pipeline source data', function() {
	it('loads the ASTM G-173 compressed source artifact with pinned provenance', function() {
		const table = loadAstmg173SolarSpectrum();

		// Reason: ASTM G-173 is the sourced solar spectrum benchmark input.
		// Source: NLR/NREL Reference Air Mass 1.5 Spectra data file, ASTMG173.csv.
		expect(table.kind).toBe('astm-g173-reference-spectra');
		expect(table.rows.length).toBe(2002);
		expect(table.wavelengthsNm[0]).toBe(280);
		expect(table.wavelengthsNm[2001]).toBe(4000);
		expect(table.provenance.zipMd5).toBe('f643261ed8a6ca6b6b5af4dccadb16b4');
		expect(table.provenance.zipSha256)
			.toBe('de6ed831cd7426d9a7147d5c0a48b1e67a483cb7f8ecd6d3ae846848154a5657');
	});

	it('pins representative ASTM G-173 extraterrestrial rows', function() {
		const table = loadAstmg173SolarSpectrum();

		// Reason: known literals catch accidental changes to the downloaded ASTM zip.
		// Source: ASTMG173.csv rows for 280 nm, 550 nm, and 4000 nm.
		expect(table.rows[0]).toEqual({
			wavelengthNm: 280,
			extraterrestrialWm2Nm: 0.082,
			globalTiltWm2Nm: 4.7309e-23,
			directCircumsolarWm2Nm: 2.5361e-26,
		});
		expect(table.rows.find((row) => row.wavelengthNm === 550)).toEqual({
			wavelengthNm: 550,
			extraterrestrialWm2Nm: 1.863,
			globalTiltWm2Nm: 1.5399,
			directCircumsolarWm2Nm: 1.3648,
		});
		expect(table.rows[table.rows.length - 1]).toEqual({
			wavelengthNm: 4000,
			extraterrestrialWm2Nm: 0.00868,
			globalTiltWm2Nm: 0.0071043,
			directCircumsolarWm2Nm: 0.0071199,
		});
	});

	it('samples blackbody and ASTM solar policies onto caller wavelength grids', function() {
		const blackbody = sampleSolarSpectrum([550], {
			policy: 'blackbody-5778k',
			solarIrradiance550Wm2Nm: 1.87,
		});
		const astm = sampleSolarSpectrum([550, 550.5], { policy: 'astm-g173' });

		// Reason: the CLI solar policy should be a named source choice, not hidden in the world model.
		// Source: Atmosphere Color Plan, sourced solar spectrum option.
		expect(blackbody.valuesByWavelength).toEqual([1.87]);
		expect(blackbody.provenance.sourceId).toBe('blackbody-5778k');
		expect(astm.valuesByWavelength[0]).toBe(1.863);
		expect(astm.valuesByWavelength[1]).toBeCloseTo((1.863 + 1.859) / 2, 12);
		expect(astm.provenance.sourceId).toBe('astm-g173');
	});

	it('keeps blackbodySolarSpectrum available as an explicit preview control', function() {
		const spectrum = blackbodySolarSpectrum([450, 550, 650], {
			solarTemperatureK: 5778,
			solarIrradiance550Wm2Nm: 1.87,
		});

		// Reason: blackbody remains useful as a smooth source-control comparison.
		// Source: Atmosphere Color Plan, sourced solar spectrum option.
		expect(spectrum.valuesByWavelength[1]).toBe(1.87);
		expect(spectrum.valuesByWavelength[0]).toBeGreaterThan(0);
		expect(spectrum.valuesByWavelength[2]).toBeGreaterThan(0);
	});

	it('rejects unknown solar spectrum policies', function() {
		// Reason: a misspelled solar source should not silently fall back to blackbody.
		// Source: Atmosphere Color Plan, explicit solar source policy.
		expect(() => sampleSolarSpectrum([550], { policy: 'mystery-sun' }))
			.toThrowError(/Unknown solar spectrum policy/);
	});
});
