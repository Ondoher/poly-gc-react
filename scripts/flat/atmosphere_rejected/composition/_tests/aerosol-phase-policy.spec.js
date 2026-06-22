describe('Aerosol phase composition policies', function() {
	async function loadAerosolPhasePolicyModule() {
		return import('../aerosol-phase-policy.js');
	}

	it('loads named aerosol phase policies for preview controls and Bruneton comparison', async function() {
		const {
			aerosolPhasePolicyIds,
			loadAerosolPhasePolicyData,
		} = await loadAerosolPhasePolicyModule();
		const data = loadAerosolPhasePolicyData();
		const ids = aerosolPhasePolicyIds();

		// Reason: phase shape is now a named policy so scalar aerosol presets do not own g or phase-kind facts.
		// Source: Reference Test Plan, Task 1 Follow-Up: Bruneton Aerosol Phase Policy And Cornette-Shanks.
		expect(data.kind).toBe('flat-atmosphere-reference-aerosol-phase-policies');
		expect(data.defaultPolicy).toBe('preview-hg-g080');
		expect(ids).toContain('preview-hg-g080');
		expect(ids).toContain('clear-maritime-hg-g076');
		expect(ids).toContain('clear-maritime-hg-g060');
		expect(ids).toContain('clear-maritime-hg-g086');
		expect(ids).toContain('continental-hg-g070');
		expect(ids).toContain('hazy-continental-hg-g068');
		expect(ids).toContain('bruneton-2016-hg-g070-control');
		expect(ids).toContain('bruneton-2016-cornette-shanks-g070');
	});

	it('resolves the Bruneton Cornette-Shanks phase policy with source-backed parameters', async function() {
		const { resolveAerosolPhasePolicy } = await loadAerosolPhasePolicyModule();
		const policy = resolveAerosolPhasePolicy('bruneton-2016-cornette-shanks-g070');

		// Reason: Bruneton-method parity uses Cornette-Shanks for aerosol phase while keeping scalar aerosol inputs fixed.
		// Source: Reference Decision Log, Bruneton 2016 clear-sky-models source facts.
		expect(policy).toEqual(jasmine.objectContaining({
			id: 'bruneton-2016-cornette-shanks-g070',
			kind: 'cornette-shanks',
			parameters: { g: 0.7 },
			source: 'curated first-pass aerosol phase policy artifact',
		}));
		expect(policy.provenance.sourceIds).toContain('bruneton-2016-clear-sky-models');
	});

	it('keeps the same-scalar Henyey-Greenstein Bruneton control selectable', async function() {
		const { resolveAerosolPhasePolicy } = await loadAerosolPhasePolicyModule();
		const policy = resolveAerosolPhasePolicy('bruneton-2016-hg-g070-control');

		// Reason: the first output-impact artifact must isolate phase shape only by comparing HG and CS at the same g.
		// Source: Reference Plan, Output-Impact Task 1 artifact contract.
		expect(policy).toEqual(jasmine.objectContaining({
			id: 'bruneton-2016-hg-g070-control',
			kind: 'henyey-greenstein',
			parameters: { g: 0.7 },
		}));
	});

	it('rejects malformed aerosol phase policy data before policy use', async function() {
		const {
			loadAerosolPhasePolicyData,
			validateAerosolPhasePolicyData,
		} = await loadAerosolPhasePolicyModule();
		const invalidKind = structuredClone(loadAerosolPhasePolicyData());
		invalidKind.policies[0].kind = 'mystery-phase';
		const invalidG = structuredClone(loadAerosolPhasePolicyData());
		invalidG.policies[0].parameters.g = 1;

		// Reason: phase policy data owns phase kind and g, so bad values must fail at the data boundary.
		// Source: Stage Contracts, evaluateScatteringPhase planned Cornette-Shanks contract and phase-policy ownership split.
		expect(() => validateAerosolPhasePolicyData(invalidKind))
			.toThrowError(/phase kind/u);
		expect(() => validateAerosolPhasePolicyData(invalidG))
			.toThrowError(/g.*inside \(-1, 1\)/u);
	});

	it('rejects unknown aerosol phase policy ids loudly', async function() {
		const { resolveAerosolPhasePolicy } = await loadAerosolPhasePolicyModule();

		// Reason: output-impact comparisons must not silently fall back to a different aerosol phase.
		// Source: Reference Code Design, explicit CLI/config policy selection and loud error handling.
		expect(() => resolveAerosolPhasePolicy('missing-phase-policy'))
			.toThrowError(/Unknown aerosol phase policy: missing-phase-policy/u);
	});
});
