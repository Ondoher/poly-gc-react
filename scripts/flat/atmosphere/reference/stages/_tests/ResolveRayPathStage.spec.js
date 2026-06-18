import {
	createReferenceIntegrator,
	expectStageDescriptor,
	expectStagePrerequisiteFailure,
} from '../../_tests/test-pipeline-stages.js';
import {
	getRayPathContractExpectation,
} from '../../_tests/test-expectations.js';

describe('atmosphere reference ResolveRayPathStage', function() {
	function runResolveRayPathForExpectation(expectation, {
		controlledModelReturns = expectation.inputs.controlledModelReturns,
		modelCalls,
	} = {}) {
		const packet = createRayPathPacket(expectation, controlledModelReturns, modelCalls);

		return createReferenceIntegrator().runStage('resolveRayPath', packet);
	}

	function createRayPathPacket(expectation, controlledModelReturns, modelCalls) {
		const validatedRequest = {
			...expectation.inputs.validatedRequest,
			model: createControlledRayPathModel(controlledModelReturns, modelCalls),
		};

		return {
			validatedRequest,
			stageHistory: [],
		};
	}

	function createControlledRayPathModel(controlledModelReturns, modelCalls = []) {
		const returns = materializeFixtureValue(controlledModelReturns);

		return {
			world: {
				altitudeAt() {
					return 0;
				},
				upAt() {
					return [0, 1, 0];
				},
				intersectSurface(ray) {
					modelCalls.push({
						method: 'world.intersectSurface',
						ray: cloneFixtureValue(ray),
					});
					return cloneFixtureValue(returns.surfaceHit);
				},
				surfaceNormalAt() {
					return [0, 1, 0];
				},
			},
			atmosphere: {
				intersect(ray) {
					modelCalls.push({
						method: 'atmosphere.intersect',
						ray: cloneFixtureValue(ray),
					});
					return cloneFixtureValue(returns.atmosphereIntersection);
				},
				contains() {
					return true;
				},
				densityAt() {
					return 1;
				},
				extinctionAt() {
					return [0];
				},
				scatteringAt() {
					return { rayleigh: [0], mie: [0] };
				},
			},
			solarSource: {
				samplesAt() {
					return [];
				},
				transmittanceSegment() {
					return { visible: true, samples: [] };
				},
			},
			surface: {
				radianceAt() {
					return [0];
				},
			},
		};
	}

	function expectRayPathFixture(expectationId) {
		const expectation = getRayPathContractExpectation(expectationId);

		if (expectation.expectedError) {
			expectRayPathFixtureError(expectation);
			return;
		}

		const result = runResolveRayPathForExpectation(expectation);

		// Reason: ray-path fixture rows are the oracle for selected segment and boundary diagnostics.
		// Source: ray-path-contracts fixture expected.rayPath derivation fields.
		expect(result.rayPath).toEqual(expectation.expected.rayPath.value);
		expect(result.stageHistory).toEqual(['resolveRayPath']);
	}

	function expectRayPathFixtureError(expectation) {
		const errorCaseGroups = [
			{
				cases: expectation.inputs.controlledModelReturns.invalidDistanceCases,
				createControlledModelReturns(invalidDistanceCase) {
					return {
						atmosphereIntersection: invalidDistanceCase.atmosphereIntersection,
						surfaceHit: expectation.inputs.controlledModelReturns.surfaceHit,
					};
				},
			},
			{
				cases: expectation.inputs.controlledModelReturns.invalidSurfaceHitCases,
				createControlledModelReturns(invalidSurfaceHitCase) {
					return {
						atmosphereIntersection: expectation.inputs.controlledModelReturns.atmosphereIntersection,
						surfaceHit: invalidSurfaceHitCase.surfaceHit,
					};
				},
			},
			{
				cases: expectation.inputs.controlledModelReturns.malformedIntersectionCases,
				createControlledModelReturns(malformedIntersectionCase) {
					return {
						atmosphereIntersection: malformedIntersectionCase.atmosphereIntersection,
						surfaceHit: expectation.inputs.controlledModelReturns.surfaceHit,
					};
				},
			},
		];

		for (const { cases, createControlledModelReturns } of errorCaseGroups) {
			if (!Array.isArray(cases)) {
				continue;
			}

			for (const errorCase of cases) {
				expectExpectedError(() => runResolveRayPathForExpectation(expectation, {
					controlledModelReturns: createControlledModelReturns(errorCase),
				}), expectation);
			}
			return;
		}

		expectExpectedError(() => runResolveRayPathForExpectation(expectation), expectation);
	}

	function expectModelCallsFixture(expectationId) {
		const expectation = getRayPathContractExpectation(expectationId);
		const modelCalls = [];

		runResolveRayPathForExpectation(expectation, { modelCalls });

		// Reason: the fixture pins the public model-call contract for adapters.
		// Source: ray-path-contracts fixture expected.modelCalls derivation fields.
		expect(modelCalls).toEqual(expectation.expected.modelCalls.value);
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
		// Source: ray-path-contracts expectedError type derivation fields.
		expect(caughtError).toEqual(jasmine.any(errorCtor));

		if (!caughtError) {
			return;
		}

		for (const messagePart of expectedError.messageIncludes) {
			// Reason: error-contract fixtures need enough message context to identify invalid model data.
			// Source: ray-path-contracts expectedError derivation fields.
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

	function cloneFixtureValue(value) {
		return materializeFixtureValue(value);
	}

	it('declares its stage contract', function() {
		// Reason: stage descriptor metadata is the public registry contract for this stage.
		// Source: Reference Code Design, Public API Shape; stage descriptors declare ids,
		// prerequisites, provided packet fields, and independently runnable stage semantics.
		expectStageDescriptor('resolveRayPath');
	});

	it('runs exactly one stage against a prepared packet', function() {
		const expectation = getRayPathContractExpectation(
			'ray-path.atmosphere.inside-exits-top',
		);
		const packet = createRayPathPacket(
			expectation,
			expectation.inputs.controlledModelReturns,
		);
		const result = createReferenceIntegrator().runStage('resolveRayPath', packet);

		// Reason: direct stage runs must append only their own stage id and avoid mutating input.
		// Source: Reference Code Design, Public API Shape; stages are independently runnable packet transforms.
		expect(result).not.toBe(packet);
		expect(result.stageHistory).toEqual(['resolveRayPath']);
		expect(packet.rayPath).toBeUndefined();
	});

	it('fails loudly when prerequisites are missing', function() {
		// Reason: direct stage execution should fail at the stage boundary when required packet data is absent.
		// Source: Reference Code Design, Public API Shape; stages declare prerequisites and reject missing ones.
		expectStagePrerequisiteFailure('resolveRayPath');
	});

	describe('planned fixture-backed behavior', function() {
		it('uses atmosphere intersection as the initial transport segment', function() {
			expectRayPathFixture('ray-path.atmosphere.inside-exits-top');
		});

		it('clips the transport segment to a nearer surface hit', function() {
			expectRayPathFixture('ray-path.surface-hit.clips-atmosphere-segment');
		});

		it('clips or suppresses atmosphere transport when a surface is before entry', function() {
			expectRayPathFixture('ray-path.surface-hit.before-atmosphere-entry-empty');
		});

		it('returns an explicit empty path when the atmosphere is not intersected', function() {
			expectRayPathFixture('ray-path.atmosphere.miss-empty-path');
		});

		it('starts at atmosphere entry for an outside observer', function() {
			expectRayPathFixture('ray-path.atmosphere.outside-entry-to-exit');
		});

		it('clips a behind-observer entry to the observer', function() {
			expectRayPathFixture('ray-path.atmosphere.forward-clips-negative-entry');
		});

		it('returns an explicit empty path for an interval entirely behind the observer', function() {
			expectRayPathFixture('ray-path.atmosphere.behind-observer-empty-path');
		});

		it('returns an explicit zero-length boundary path', function() {
			expectRayPathFixture('ray-path.atmosphere.zero-length-boundary-path');
		});

		it('rejects inverted atmosphere intersection distances', function() {
			expectRayPathFixture('ray-path.atmosphere.inverted-intersection-rejects');
		});

		it('rejects non-finite atmosphere intersection distances', function() {
			expectRayPathFixture('ray-path.atmosphere.nonfinite-intersection-rejects');
		});

		it('records a named flat lateral boundary', function() {
			expectRayPathFixture('ray-path.flat.named-lateral-boundary');
		});

		it('rejects an unbounded flat horizontal path', function() {
			expectRayPathFixture('ray-path.flat.unbounded-horizontal-rejects');
		});

		it('preserves model-owned boundary metadata', function() {
			expectRayPathFixture('ray-path.boundary-metadata.preserved');
		});
	});

	describe('hardening fixture-backed behavior', function() {
		it('ignores a surface hit after atmosphere exit', function() {
			expectRayPathFixture('ray-path.surface-hit.after-atmosphere-exit-ignored');
		});

		it('returns an explicit empty path for a surface exactly at atmosphere entry', function() {
			expectRayPathFixture('ray-path.surface-hit.at-atmosphere-entry-empty');
		});

		it('uses surface-hit boundary precedence at atmosphere exit while preserving atmosphere metadata', function() {
			expectRayPathFixture('ray-path.surface-hit.at-atmosphere-exit-surface-precedence');
		});

		it('rejects non-finite surface hit distances', function() {
			expectRayPathFixture('ray-path.surface-hit.nonfinite-distance-rejects');
		});

		it('ignores negative surface hit distances as behind the observer', function() {
			expectRayPathFixture('ray-path.surface-hit.negative-distance-ignored');
		});

		it('rejects malformed finite atmosphere interval returns', function() {
			expectRayPathFixture('ray-path.atmosphere.malformed-finite-interval-rejects');
		});

		it('passes the validated transport ray shape to model interfaces', function() {
			expectModelCallsFixture('ray-path.model-call.validated-transport-ray');
		});
	});
});
