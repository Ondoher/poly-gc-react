import {
	canonicalStageIds,
	createReferenceIntegrator,
} from './test-pipeline-stages.js';

describe('atmosphere reference pipeline stages', function() {
	describe('Stage registry', function() {
		it('exposes the canonical stage ids in order', function() {
			const integrator = createReferenceIntegrator();

			// Reason: stage order is the public flow contract for tests, CLI diagnostics, and shader parity.
			// Source: Reference Code Design, Canonical Pipeline Stages.
			expect(integrator.listStages()).toEqual([
				'validateRequest',
				'resolveRayPath',
				'sampleViewPath',
				'evaluateMedium',
				'integrateViewOpticalDepth',
				'integrateSolarTransmittance',
				'evaluateScatteringPhase',
				'integrateSingleScattering',
				'resolveSurfaceRadiance',
				'composeSpectralRadiance',
			]);
			// Reason: the helper-owned canonical id list must stay aligned with the public integrator registry.
			// Source: local test fixture policy; one canonical stage ordering for stage specs.
			expect(integrator.listStages()).toEqual(canonicalStageIds());
		});

		it('exposes a helper constructor for every canonical stage', function() {
			const integrator = createReferenceIntegrator();

			for (const stageId of canonicalStageIds()) {
				const descriptor = integrator.getStage(stageId);

				// Reason: each canonical stage is implemented behind a focused helper class.
				// Source: Reference Code Design, helper-class stage policy.
				expect(typeof descriptor.StageClass)
					.withContext(stageId)
					.toBe('function');
			}
		});

		it('fails loudly for unknown stage ids', function() {
			const integrator = createReferenceIntegrator();

			// Reason: unknown stages are caller/configuration errors and must not silently fall through.
			// Source: Reference Code Design, Error Handling.
			expect(() => integrator.getStage('missingStage')).toThrowError(
				/Unknown atmosphere reference stage: missingStage/,
			);
		});
	});

});
