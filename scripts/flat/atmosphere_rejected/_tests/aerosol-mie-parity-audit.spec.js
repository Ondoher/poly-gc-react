import {
	buildAerosolMieAuditMarkdown,
	parseAerosolMieAuditArgs,
	runAerosolMieParityAudit,
} from '../aerosol-mie-parity-audit.js';

describe('aerosol-mie-parity-audit diagnostics', function() {
	it('checks Bruneton/Kider coefficient parity through the live aerosol policy helpers', function() {
		const audit = runAerosolMieParityAudit();
		const coefficient550 = audit.coefficientParity.rows.find((row) => row.wavelengthNm === 550);

		// Reason: before changing the model, the audit must verify whether the Bruneton aerosol inputs are already entering the coefficient path correctly.
		// Source: Bruneton 2016 clear-sky comparison contract as recorded in aerosol-presets.json.
		expect(audit.kind).toBe('flat-atmosphere-aerosol-mie-parity-audit');
		expect(audit.coefficientParity.policy.id).toBe('bruneton-2016-kider-fit');
		expect(audit.coefficientParity.policy.defaultPhasePolicyId)
			.toBe('bruneton-2016-cornette-shanks-g070');
		expect(coefficient550.policyTau).toBeCloseTo(0.0645312146448, 12);
		expect(coefficient550.policyExtinctionPerKm).toBeCloseTo(0.0645312146448 / 1.2, 12);
		expect(coefficient550.policyScatteringPerKm)
			.toBeCloseTo(0.0645312146448 / 1.2 * 0.8, 12);
		expect(coefficient550.policyAbsorptionPerKm)
			.toBeCloseTo(0.0645312146448 / 1.2 * 0.2, 12);
		expect(audit.coefficientParity.maxRelativeError).toBeLessThan(1e-9);
		expect(audit.analysis.coefficientParityStatus).toBe('matches-bruneton-input-contract');
	});

	it('records aerosol dominance and forward-scattering convention diagnostics', function() {
		const audit = runAerosolMieParityAudit();
		const nearSun = audit.phaseConvention.rows.find((row) => row.id === 'near-sun-forward');
		const antiSun = audit.phaseConvention.rows.find((row) => row.id === 'anti-sun-backward');

		// Reason: a phase-sign mistake would be an algorithmic error; this audit pins the intended near-Sun forward-scatter behavior.
		// Source: Reference Stage Contracts, evaluateScatteringPhase convention and Cornette-Shanks phase policy.
		expect(audit.rayleighMieBalance.seaLevel550MieToRayleighScatteringRatio).toBeGreaterThan(1);
		expect(nearSun.cornetteShanks).toBeGreaterThan(antiSun.cornetteShanks);
		expect(audit.phaseConvention.forwardToSideRatio).toBeGreaterThan(100);
		expect(audit.analysis.phaseStatus).toBe('strong-forward-scattering-present');
	});

	it('builds Markdown and keeps image sweep optional', function() {
		const audit = runAerosolMieParityAudit();
		const markdown = buildAerosolMieAuditMarkdown(audit);

		// Reason: expensive image-level sweeps should be opt-in experiment artifacts, while coefficient diagnostics remain testable.
		// Source: atmosphere experiment artifact convention.
		expect(audit.imageSweep.status).toBe('not-run');
		expect(markdown).toContain('# Aerosol/Mie Parity Audit');
		expect(markdown).toContain('Bruneton Coefficient Parity');
		expect(markdown).toContain('Image sweep status: `not-run`');
	});

	it('parses file-directed audit options', function() {
		const options = parseAerosolMieAuditArgs([
			'--out-dir',
			'tmp/atmosphere/bruneton/008-aerosol-mie-parity-audit',
			'--include-image-sweep',
			'--dome-size',
			'18',
			'--sampling-profile',
			'paper-comparison',
			'--dome-sample-mask',
			'horizon-ring',
		]);

		// Reason: generated experiment output should be directed to a named artifact folder.
		// Source: local atmosphere artifact convention.
		expect(options).toEqual({
			outDir: 'tmp/atmosphere/bruneton/008-aerosol-mie-parity-audit',
			includeImageSweep: true,
			domeSize: 18,
			samplingProfile: 'paper-comparison',
			domeSampleMask: 'horizon-ring',
		});
		expect(() => parseAerosolMieAuditArgs(['--dome-size', '0']))
			.toThrowError(/positive integer/);
		expect(() => parseAerosolMieAuditArgs(['--dome-sample-mask', 'middle-only']))
			.toThrowError(/Unknown dome sample mask/);
	});
});
