import {
	buildDisplayParityContactSheet,
	buildDisplayParityMarkdown,
	extractSpectralSamplesFromTask3Summary,
	parseDisplayParityAuditArgs,
	runDisplayParityAudit,
} from '../display-parity-audit.js';

describe('display-parity-audit diagnostics', function() {
	it('builds a display-only audit over normalized and raw CIE scale paths', function() {
		const audit = runDisplayParityAudit();
		const equalEnergy = audit.spectralSamples.find((sample) => sample.id === 'synthetic.equal-energy-low');
		const normalized = equalEnergy.colorTransforms.find((transform) => transform.id === 'normalized-xyz');
		const unnormalized = equalEnergy.colorTransforms.find((transform) => transform.id === 'unnormalized-xyz');
		const normalizedExposure1 = equalEnergy.displays.find((display) => display.id === 'normalized-xyz.exp1-srgb');
		const normalizedExposure8 = equalEnergy.displays.find((display) => display.id === 'normalized-xyz.exp8-srgb');

		// Reason: the audit must isolate display scale without invoking the atmosphere transport pipeline.
		// Source: Atmosphere Color Plan, display/tone-mapping follow-up.
		expect(audit.kind).toBe('flat-atmosphere-display-parity-audit');
		expect(audit.spectralSamples.length).toBe(3);
		expect(audit.linearRgbSamples.length).toBe(3);
		expect(audit.analysis.sampleCounts.sourceSummarySpectral).toBe(0);
		expect(audit.toneMap).toBe('exponential');
		expect(normalized.xyz.y).toBeCloseTo(0.01, 12);
		expect(unnormalized.xyz.y).toBeGreaterThan(1);
		expect(audit.analysis.xyzScale.meanRawToNormalizedYScale).toBeGreaterThan(100);
		expect(normalizedExposure8.displayLinearLuminance)
			.toBeGreaterThan(normalizedExposure1.displayLinearLuminance);
	});

	it('extracts Task 3 summary radiance samples through the explicit source-summary contract', function() {
		const values = Array.from({ length: 21 }, (_, index) => 0.001 * (index + 1));
		const summary = {
			fixedInputs: {
				wavelengthGrid: 'preview-20nm',
			},
			rows: [
				{
					id: '06h00.sunZenith87',
					label: '06h00 / 87 deg',
					control: {
						centerRadianceSelected: values,
						horizonRadianceSelected: values.map((value) => value * 2),
						centerDisplayHex: '#111111',
						horizonDisplayHex: '#222222',
					},
					noVisibleAbsorption: {
						centerRadianceSelected: values.map((value) => value * 3),
						horizonRadianceSelected: values.map((value) => value * 4),
						centerDisplayHex: '#333333',
						horizonDisplayHex: '#444444',
					},
				},
			],
		};
		const samples = extractSpectralSamplesFromTask3Summary(summary, 'tmp/example-summary.json');

		// Reason: saved radiance arrays should be interpreted through their recorded wavelength-grid contract, not guessed from image pixels.
		// Source: Task 3 summary fixedInputs.wavelengthGrid and Atmosphere Color Plan spectral-resolution controls.
		expect(samples.length).toBe(4);
		expect(samples[0].id).toBe('task3.control.06h00.sunZenith87.center');
		expect(samples[0].wavelengthsNm.length).toBe(21);
		expect(samples[0].wavelengthsNm[0]).toBe(380);
		expect(samples[0].wavelengthsNm[20]).toBe(780);
		expect(samples[3].source.sourceDisplayHex).toBe('#444444');
	});

	it('builds Markdown and a contact sheet from the audit packet', function() {
		const audit = runDisplayParityAudit();
		const markdown = buildDisplayParityMarkdown(audit);
		const contactSheet = buildDisplayParityContactSheet(audit);

		// Reason: the experiment should leave file-ready evidence rather than relying on stdout.
		// Source: local artifact convention for atmosphere diagnostics.
		expect(markdown).toContain('# Display Parity Audit');
		expect(markdown).toContain('normalized-xyz.exp8-srgb');
		expect(contactSheet.kind).toBe('atmosphere-color-pixel-image');
		expect(contactSheet.width).toBe(168);
		expect(contactSheet.height).toBe(96);
		expect(contactSheet.pixels.length).toBe(contactSheet.width * contactSheet.height);
	});

	it('parses explicit output and source-summary paths', function() {
		const options = parseDisplayParityAuditArgs([
			'--out-dir',
			'tmp/atmosphere/bruneton/007-display-parity-audit',
			'--source-summary',
			'tmp/atmosphere/bruneton/006-no-visible-absorption/summary.json',
		]);

		// Reason: display audit output should be file-directed and source-summary input should be explicit.
		// Source: project diagnostic artifact convention.
		expect(options).toEqual({
			outDir: 'tmp/atmosphere/bruneton/007-display-parity-audit',
			sourceSummaryPath: 'tmp/atmosphere/bruneton/006-no-visible-absorption/summary.json',
		});
		expect(() => parseDisplayParityAuditArgs(['--mystery']))
			.toThrowError(/Unknown display parity audit option/);
	});
});
