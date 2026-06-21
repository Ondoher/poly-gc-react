import {
	buildWeaknessFactorAuditMarkdown,
	createSourceQuadratureDiagnostic,
	parseWeaknessFactorAuditArgs,
	runWeaknessFactorAudit,
} from '../weakness-factor-audit.js';

describe('weakness-factor-audit diagnostics', function() {
	it('detects that source quadrature weights are applied in single-scattering accumulation', function() {
		const diagnostic = createSourceQuadratureDiagnostic();

		// Reason: finite-Sun/aureole work depends on source quadrature weights; this diagnostic must confirm extra samples do not over-contribute.
		// Source: Reference Stage Contracts, solar source sample weight and solidAngleSr handoff.
		expect(diagnostic.status).toBe('source-sample-weight-applied');
		expect(diagnostic.expectedWeightedRatio).toBe(1);
		expect(diagnostic.splitWeightRatio).toBeCloseTo(1, 12);
		expect(diagnostic.zeroWeightExtraRatio).toBeCloseTo(1, 12);
	});

	it('builds a non-transport audit and recommendation from the quadrature diagnostic', function() {
		const audit = runWeaknessFactorAudit({ includeTransport: false });
		const markdown = buildWeaknessFactorAuditMarkdown(audit);

		// Reason: the audit should be usable as a cheap contract check even when image transport is skipped.
		// Source: atmosphere experiment artifact convention.
		expect(audit.kind).toBe('flat-atmosphere-weakness-factor-audit');
		expect(audit.transport.status).toBe('not-run');
		expect(audit.analysis.recommendation[0]).toContain('Run the transport diagnostics');
		expect(markdown).toContain('# Weakness Factor Audit');
		expect(markdown).toContain('source-sample-weight-applied');
	});

	it('parses file-directed weakness audit options', function() {
		const options = parseWeaknessFactorAuditArgs([
			'--out-dir',
			'tmp/atmosphere/bruneton/009-weakness-factor-audit',
			'--dome-size',
			'18',
			'--sampling-profile',
			'paper-comparison',
			'--dome-sample-mask',
			'horizon-ring',
			'--skip-transport',
		]);

		// Reason: generated experiment output should be directed to a named artifact folder and support cheap test-only runs.
		// Source: local atmosphere artifact convention.
		expect(options).toEqual({
			outDir: 'tmp/atmosphere/bruneton/009-weakness-factor-audit',
			includeTransport: false,
			domeSize: 18,
			samplingProfile: 'paper-comparison',
			domeSampleMask: 'horizon-ring',
		});
		expect(() => parseWeaknessFactorAuditArgs(['--dome-size', '0']))
			.toThrowError(/positive integer/);
		expect(() => parseWeaknessFactorAuditArgs(['--dome-sample-mask', 'middle-only']))
			.toThrowError(/Unknown dome sample mask/);
	});
});
