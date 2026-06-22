import {
	approximateCie1931ColorMatchingFunctions,
	loadOfficialCie1931Metadata,
	loadOfficialCie1931Table,
	officialCie1931ColorMatchingFunctions,
	spectralRadianceToLinearSrgb,
	spectralRadianceToUnnormalizedLinearSrgb,
	spectralRadianceToUnnormalizedXyz,
	spectralRadianceToXyz,
	spectralToApproximateSrgb,
	spectralToApproximateXyz,
	spectralToOfficialSrgb,
	spectralToOfficialXyz,
	xyzToLinearSrgb,
} from '../spectral-color.js';

describe('spectral-color preview consumers', function() {
	it('integrates a zero spectrum to zero XYZ and zero linear sRGB', function() {
		const wavelengthsNm = [440, 560, 660];
		const color = spectralToApproximateSrgb([0, 0, 0], wavelengthsNm);

		// Reason: post-pipeline color conversion must preserve black before any display output.
		// Source: Reference Plan, color conversion known answer.
		expect(color.xyz).toEqual({ x: 0, y: 0, z: 0 });
		expect(color.linearRgb).toEqual({ r: 0, g: 0, b: 0 });
	});

	it('produces finite positive XYZ for a flat equal-energy preview spectrum', function() {
		const xyz = spectralToApproximateXyz([1, 1, 1], [440, 560, 660]);

		// Reason: equal visible energy should produce nonzero tristimulus values before display encoding.
		// Source: Reference Plan, color conversion known answer.
		expect(xyz.x).toBeGreaterThan(0);
		expect(xyz.y).toBeGreaterThan(0);
		expect(xyz.z).toBeGreaterThan(0);
	});

	it('keeps the XYZ to linear-sRGB matrix available as a post-pipeline consumer', function() {
		const rgb = xyzToLinearSrgb({ x: 0.25, y: 0.5, z: 0.75 });

		// Reason: XYZ to linear sRGB belongs outside transport and before display/pixel clamping.
		// Source: Reference Code Design, Spectral To Color.
		expect(rgb.r).toBeCloseTo(-0.3324, 10);
		expect(rgb.g).toBeCloseTo(0.7268, 10);
		expect(rgb.b).toBeCloseTo(0.704675, 10);
	});

	it('uses nonnegative analytic CIE preview values', function() {
		const cmf = approximateCie1931ColorMatchingFunctions(560);

		// Reason: the analytic preview is not final CIE truth, but it should remain finite and nonnegative.
		// Source: Wyman, Sloan, and Shirley analytic approximation as recorded in the code design.
		expect(cmf.x).toBeGreaterThanOrEqual(0);
		expect(cmf.y).toBeGreaterThanOrEqual(0);
		expect(cmf.z).toBeGreaterThanOrEqual(0);
	});

	it('loads the official CIE 1931 2-degree table with pinned metadata', function() {
		const table = loadOfficialCie1931Table();
		const metadata = loadOfficialCie1931Metadata();

		// Reason: the official color table is now the canonical post-pipeline color data source.
		// Source: CIE dataset DOI 10.25039/CIE.DS.xvudnb9b and published artifact metadata.
		expect(table.kind).toBe('cie-1931-2deg-color-matching-functions');
		expect(table.rows.length).toBe(471);
		expect(table.wavelengthsNm[0]).toBe(360);
		expect(table.wavelengthsNm[470]).toBe(830);
		expect(table.provenance.publishedMd5).toBe('17cca777db64b17170f06f67ce9d3ab7');
		expect(table.provenance.wavelengthStepNm).toBe(1);
		expect(metadata.identifier.identifier).toBe('10.25039/CIE.DS.xvudnb9b');
	});

	it('pins representative official CIE table rows', function() {
		const table = loadOfficialCie1931Table();

		// Reason: known row literals catch accidental edits to the downloaded artifact.
		// Source: CIE_xyz_1931_2deg.csv rows for 360 nm, 555 nm, and 830 nm.
		expect(table.byWavelengthNm.get(360)).toEqual({
			wavelengthNm: 360,
			x: 0.0001299,
			y: 0.000003917,
			z: 0.0006061,
		});
		expect(table.byWavelengthNm.get(555)).toEqual({
			wavelengthNm: 555,
			x: 0.5120501,
			y: 1,
			z: 0.005749999,
		});
		expect(table.byWavelengthNm.get(830)).toEqual({
			wavelengthNm: 830,
			x: 0.000001251141,
			y: 0.00000045181,
			z: 0,
		});
	});

	it('interpolates within the official CIE table and returns zero outside its range', function() {
		const cmf = officialCie1931ColorMatchingFunctions(360.5);

		// Reason: benchmark wavelengths may not always land exactly on the 1 nm official table grid.
		// Source: Atmosphere Color Plan, official CIE ingestion interpolation policy.
		expect(cmf.x).toBeCloseTo((0.0001299 + 0.000145847) / 2, 15);
		expect(cmf.y).toBeCloseTo((0.000003917 + 0.000004393581) / 2, 15);
		expect(cmf.z).toBeCloseTo((0.0006061 + 0.0006808792) / 2, 15);
		expect(officialCie1931ColorMatchingFunctions(359)).toEqual({ x: 0, y: 0, z: 0 });
		expect(officialCie1931ColorMatchingFunctions(831)).toEqual({ x: 0, y: 0, z: 0 });
	});

	it('integrates zero and equal-energy spectra through the official table path', function() {
		const officialWavelengthsNm = loadOfficialCie1931Table().wavelengthsNm;
		const zero = spectralRadianceToLinearSrgb([0, 0, 0], [440, 560, 660]);
		const equalEnergy = spectralRadianceToXyz(
			officialWavelengthsNm.map(() => 1),
			officialWavelengthsNm,
		);

		// Reason: the official path replaces preview colorimetry for benchmark artifacts.
		// Source: Atmosphere Color Plan, official CIE spectral-to-XYZ ingestion target.
		expect(zero.xyz).toEqual({ x: 0, y: 0, z: 0 });
		expect(zero.linearRgb).toEqual({ r: 0, g: 0, b: 0 });
		expect(zero.provenance.cmf.sourceId).toBe('cie-1931-2deg');
		expect(equalEnergy.xyz.x).toBeCloseTo(1.0000794426571649, 12);
		expect(equalEnergy.xyz.y).toBeCloseTo(1, 12);
		expect(equalEnergy.xyz.z).toBeCloseTo(1.0003278525483947, 12);
		expect(equalEnergy.provenance.interpolation).toContain('linear');
	});

	it('exposes an unnormalized XYZ diagnostic path for display scale audits', function() {
		const officialWavelengthsNm = loadOfficialCie1931Table().wavelengthsNm;
		const values = officialWavelengthsNm.map(() => 1);
		const normalized = spectralRadianceToXyz(values, officialWavelengthsNm);
		const unnormalized = spectralRadianceToUnnormalizedXyz(values, officialWavelengthsNm);
		const unnormalizedRgb = spectralRadianceToUnnormalizedLinearSrgb(values, officialWavelengthsNm);

		// Reason: Bruneton-style exponential display comparison is scale-sensitive, so the audit needs raw CIE scale beside the preview-normalized path.
		// Source: Atmosphere Color Plan, display/tone-mapping follow-up and CIE official table metadata.
		expect(normalized.xyz.y).toBeCloseTo(1, 12);
		expect(unnormalized.xyz.y).toBeCloseTo(unnormalized.provenance.yEqualEnergyResponse, 12);
		expect(unnormalized.xyz.y).toBeGreaterThan(100);
		expect(normalized.provenance.normalizationScale)
			.toBeCloseTo(1 / unnormalized.provenance.yEqualEnergyResponse, 15);
		expect(unnormalized.provenance.normalization).toContain('none');
		expect(unnormalizedRgb.linearRgb.r).toBeGreaterThan(100);
		expect(unnormalizedRgb.provenance.clamping).toBe('none');
	});

	it('exposes implementation-named official helpers as aliases of the domain API', function() {
		const values = [0.1, 0.2, 0.3];
		const wavelengthsNm = [450, 550, 650];

		// Reason: callers should prefer the domain API, but existing official-helper calls remain equivalent.
		// Source: Atmosphere Color Plan, public color conversion boundary.
		expect(spectralToOfficialXyz(values, wavelengthsNm))
			.toEqual(spectralRadianceToXyz(values, wavelengthsNm));
		expect(spectralToOfficialSrgb(values, wavelengthsNm))
			.toEqual(spectralRadianceToLinearSrgb(values, wavelengthsNm));
	});

	it('keeps equal-energy visible radiance roughly neutral after XYZ to linear sRGB conversion', function() {
		const wavelengthsNm = loadOfficialCie1931Table().wavelengthsNm;
		const color = spectralRadianceToLinearSrgb(wavelengthsNm.map(() => 1), wavelengthsNm);

		// Reason: equal-energy white is not D65 white, but it should remain broadly neutral in linear sRGB.
		// Source: CIE official equal-energy XYZ integration plus the sRGB D65 matrix.
		expect(color.linearRgb.r).toBeCloseTo(1.2048939745941791, 12);
		expect(color.linearRgb.g).toBeCloseTo(0.948336633890231, 12);
		expect(color.linearRgb.b).toBeCloseTo(0.9090509650996574, 12);
		expect(color.linearRgb.r / color.linearRgb.b).toBeLessThan(1.4);
	});

	it('preserves narrow-band channel dominance and unclamped out-of-gamut channels', function() {
		const wavelengthsNm = [450, 550, 650];
		const blue = spectralRadianceToLinearSrgb([1, 0, 0], wavelengthsNm);
		const green = spectralRadianceToLinearSrgb([0, 1, 0], wavelengthsNm);
		const red = spectralRadianceToLinearSrgb([0, 0, 1], wavelengthsNm);

		// Reason: spectral-to-linear-sRGB must preserve physical color diagnostics before display clamping.
		// Source: CIE official table rows near blue/green/red plus the sRGB D65 matrix.
		expect(blue.linearRgb.b).toBeGreaterThan(blue.linearRgb.r);
		expect(blue.linearRgb.b).toBeGreaterThan(blue.linearRgb.g);
		expect(green.linearRgb.g).toBeGreaterThan(green.linearRgb.r);
		expect(green.linearRgb.g).toBeGreaterThan(green.linearRgb.b);
		expect(red.linearRgb.r).toBeGreaterThan(red.linearRgb.g);
		expect(red.linearRgb.r).toBeGreaterThan(red.linearRgb.b);
		expect(blue.linearRgb.g).toBeLessThan(0);
		expect(green.linearRgb.r).toBeLessThan(0);
		expect(red.linearRgb.g).toBeLessThan(0);
	});

	it('rejects non-finite spectral radiance samples before color conversion', function() {
		// Reason: non-finite radiance would poison display artifacts and should fail at the color boundary.
		// Source: Atmosphere Color Plan, post-pipeline consumer validation policy.
		expect(() => spectralRadianceToXyz([1, Number.NaN], [450, 550]))
			.toThrowError(/finite spectral radiance/u);
	});
});
