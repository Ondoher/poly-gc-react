import {
	createReferenceIntegrator,
	expectStageDescriptor,
	expectStagePrerequisiteFailure,
} from '../../_tests/test-pipeline-stages.js';
import {
	getViewSamplesContractExpectation,
} from '../../_tests/test-expectations.js';

describe('atmosphere reference SampleViewPathStage', function() {
	function runSampleViewPathForExpectation(expectation, {
		rayPath = expectation.inputs.rayPath,
		numerical = expectation.inputs.numerical,
	} = {}) {
		return createReferenceIntegrator().runStage('sampleViewPath', {
			validatedRequest: {
				numerical: materializeFixtureValue(numerical ?? {}),
			},
			rayPath: materializeFixtureValue(rayPath),
			stageHistory: [],
		});
	}

	function expectViewSamplesFixture(expectationId) {
		const expectation = getViewSamplesContractExpectation(expectationId);

		if (expectation.expectedError) {
			expectViewSamplesFixtureError(expectation);
			return;
		}

		const result = runSampleViewPathForExpectation(expectation);

		if (expectation.expected.viewSamples) {
			// Reason: view-samples fixture rows are the oracle for midpoint sample positions and weights.
			// Source: view-samples-contracts expected.viewSamples derivation fields.
			expect(result.viewSamples).toEqual(expectation.expected.viewSamples.value);
		}

		if (expectation.expected.viewSampleMetadata) {
			// Reason: sampleViewPath owns diagnostic metadata about the numerical rule it applied.
			// Source: view-samples-contracts expected.viewSampleMetadata derivation fields.
			expect(result.viewSampleMetadata)
				.toEqual(expectation.expected.viewSampleMetadata.value);
		}

		if (expectation.expected.weightSumKm) {
			const samples = expectArraySamples(result, expectation);
			const weightSumKm = samples.reduce((sum, sample) => sum + sample.weightKm, 0);

			// Reason: midpoint weights are the subinterval widths that partition the selected ray segment.
			// Source: view-samples-contracts expected.weightSumKm derivation field.
			expect(weightSumKm).toBe(expectation.expected.weightSumKm.value);
		}

		if (expectation.expected.distanceFromObserverKm) {
			const samples = expectArraySamples(result, expectation);

			// Reason: forward ray samples must stay ordered by increasing observer distance.
			// Source: view-samples-contracts expected.distanceFromObserverKm derivation field.
			expect(samples.map((sample) => sample.distanceFromObserverKm))
				.toEqual(expectation.expected.distanceFromObserverKm.value);
		}

		if (expectation.expected.rayPath) {
			// Reason: this stage appends samples and must not reinterpret ray-path diagnostics.
			// Source: view-samples-contracts expected.rayPath derivation field.
			expect(result.rayPath).toEqual(expectation.expected.rayPath.value);
		}

		// Reason: a fixture-backed stage run must still prove only sampleViewPath executed.
		// Source: Reference Code Design, Public API Shape; direct stage runs append only their own stage id.
		expect(result.stageHistory).toEqual(['sampleViewPath']);
	}

	function expectArraySamples(result, expectation) {
		const samples = result.viewSamples;

		// Reason: derived helper checks only make sense against the stage's array-shaped sample output.
		// Source: Stage Contracts, sampleViewPath; successful packets provide a viewSamples array.
		expect(Array.isArray(samples))
			.withContext(`${expectation.id} viewSamples is an array`)
			.toBeTrue();

		return Array.isArray(samples) ? samples : [];
	}

	function expectViewSamplesFixtureError(expectation) {
		if (Array.isArray(expectation.inputs.invalidSegmentCases)) {
			for (const invalidSegmentCase of expectation.inputs.invalidSegmentCases) {
				expectExpectedError(
					() => runSampleViewPathForExpectation(expectation, {
						rayPath: invalidSegmentCase.rayPath,
						numerical: expectation.inputs.numerical,
					}),
					expectation,
				);
			}
			return;
		}

		if (Array.isArray(expectation.inputs.invalidViewStepsCases)) {
			for (const invalidNumericalControls of expectation.inputs.invalidViewStepsCases) {
				expectExpectedError(
					() => runSampleViewPathForExpectation(expectation, {
						numerical: invalidNumericalControls,
					}),
					expectation,
				);
			}
			return;
		}

		expectExpectedError(
			() => runSampleViewPathForExpectation(expectation),
			expectation,
		);
	}

	function expectExpectedError(run, expectation) {
		const { expectedError } = expectation;
		const errorCtor = expectedError.type === 'RangeError' ? RangeError : Error;
		let caughtError;

		try {
			run();
		} catch (error) {
			caughtError = error;
		}

		// Reason: error-contract fixture rows specify the thrown error category.
		// Source: view-samples-contracts expectedError type derivation fields.
		expect(caughtError).toEqual(jasmine.any(errorCtor));

		if (!caughtError) {
			return;
		}

		for (const messagePart of expectedError.messageIncludes) {
			// Reason: error fixtures need enough message context to locate the invalid stage input.
			// Source: view-samples-contracts expectedError derivation fields.
			expect(caughtError.message)
				.withContext(`${expectation.id} message includes ${messagePart}`)
				.toContain(messagePart);
		}
	}

	function materializeFixtureValue(value) {
		if (value === 'Infinity') {
			return Infinity;
		}

		if (value === '-Infinity') {
			return -Infinity;
		}

		if (value === 'NaN') {
			return NaN;
		}

		if (Array.isArray(value)) {
			return value.map((entry) => materializeFixtureValue(entry));
		}

		if (value && typeof value === 'object') {
			return Object.fromEntries(
				Object.entries(value).map(([key, entry]) => [
					key,
					materializeFixtureValue(entry),
				]),
			);
		}

		return value;
	}

	it('declares its stage contract', function() {
		// Reason: stage descriptor metadata is the public registry contract for this stage.
		// Source: Reference Code Design, Public API Shape; stage descriptors declare ids,
		// prerequisites, provided packet fields, and independently runnable stage semantics.
		expectStageDescriptor('sampleViewPath');
	});

	it('runs exactly one stage against a prepared packet', function() {
		const expectation = getViewSamplesContractExpectation(
			'view-samples.midpoint.one-step-0-to-10',
		);
		const packet = {
			validatedRequest: {
				numerical: materializeFixtureValue(expectation.inputs.numerical),
			},
			rayPath: materializeFixtureValue(expectation.inputs.rayPath),
			stageHistory: [],
		};
		const result = createReferenceIntegrator().runStage('sampleViewPath', packet);

		// Reason: direct stage runs must append only their own stage id and avoid mutating input.
		// Source: Reference Code Design, Public API Shape; stages are independently runnable packet transforms.
		expect(result).not.toBe(packet);
		expect(result.stageHistory).toEqual(['sampleViewPath']);
		expect(packet.viewSamples).toBeUndefined();
		expect(packet.viewSampleMetadata).toBeUndefined();
	});

	it('fails loudly when prerequisites are missing', function() {
		// Reason: direct stage execution should fail at the stage boundary when required packet data is absent.
		// Source: Reference Code Design, Public API Shape; stages declare prerequisites and reject missing ones.
		expectStagePrerequisiteFailure('sampleViewPath');
	});

	describe('fixture-backed behavior', function() {
		it('returns no samples for an explicit empty path', function() {
			expectViewSamplesFixture('view-samples.empty-path.no-samples');
		});

		it('returns no samples for a zero-length boundary path', function() {
			expectViewSamplesFixture('view-samples.zero-length.no-samples');
		});

		it('creates one midpoint sample for a 0..10 km segment', function() {
			expectViewSamplesFixture('view-samples.midpoint.one-step-0-to-10');
		});

		it('creates two midpoint samples for a 0..10 km segment', function() {
			expectViewSamplesFixture('view-samples.midpoint.two-steps-0-to-10');
		});

		it('creates midpoint samples for a nonzero-start segment', function() {
			expectViewSamplesFixture('view-samples.midpoint.two-steps-2-to-12');
		});

		it('keeps sample weights summed to the path length', function() {
			expectViewSamplesFixture('view-samples.midpoint.weights-sum-to-length');
		});

		it('keeps sample distances monotonically increasing', function() {
			expectViewSamplesFixture('view-samples.midpoint.monotonic-sample-order');
		});

		it('leaves ray-path boundary diagnostics unchanged on the packet', function() {
			expectViewSamplesFixture('view-samples.ray-path-diagnostics.preserved');
		});

		it('rejects negative path length', function() {
			expectViewSamplesFixture('view-samples.invalid.negative-length-rejects');
		});

		it('rejects inconsistent segment length', function() {
			expectViewSamplesFixture('view-samples.invalid.inconsistent-length-rejects');
		});

		it('rejects non-finite segment distances', function() {
			expectViewSamplesFixture('view-samples.invalid.nonfinite-distance-rejects');
		});

		it('rejects invalid view-step counts', function() {
			expectViewSamplesFixture('view-samples.invalid.view-steps-rejects');
		});

		it('records midpoint integration metadata', function() {
			expectViewSamplesFixture('view-samples.midpoint.integration-metadata');
		});
	});
});
