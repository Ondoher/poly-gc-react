import {
	createReferenceIntegrator,
	expectStageDescriptor,
	expectStagePrerequisiteFailure,
} from '../../_tests/test-pipeline-stages.js';
import {
	getMediumContractExpectation,
} from '../../_tests/test-expectations.js';

// Numerical policy source: mirror EvaluateMediumStage's 15-significant-digit
// review key so the controlled test adapter indexes positions the same way the
// production code presents derived coefficient sums.
// See Reference Decision Log, evaluateMedium Numerical Policy Source Map.
const EVALUATE_MEDIUM_TEST_POSITION_KEY_SIGNIFICANT_DIGITS = 15;

describe('atmosphere reference EvaluateMediumStage', function() {
	function runEvaluateMediumForExpectation(expectation, {
		modelResponses = expectation.inputs.modelResponses,
	} = {}) {
		const wavelengthsNm = materializeWavelengths(expectation.inputs);
		const observer = materializeFixtureValue(expectation.inputs.observer);
		const ray = materializeFixtureValue(expectation.inputs.ray);
		const viewSamples = materializeFixtureValue(expectation.inputs.viewSamples);
		const model = createControlledMediumModel(modelResponses, wavelengthsNm, {
			observer,
			ray,
			viewSamples,
		});
		const packet = {
			validatedRequest: {
				model,
				observer,
				ray,
				wavelengthsNm,
				numerical: {},
			},
			viewSamples,
			stageHistory: [],
		};
		const result = createReferenceIntegrator().runStage('evaluateMedium', packet);

		return { result, model, packet };
	}

	function expectMediumFixture(expectationId) {
		const expectation = getMediumContractExpectation(expectationId);

		if (expectation.expectedError) {
			expectMediumFixtureError(expectation);
			return;
		}

		const { result, model } = runEvaluateMediumForExpectation(expectation);

		if (expectation.expected.mediumSamples) {
			// Reason: medium-contract fixture rows are the oracle for this stage's packet output.
			// Source: medium-contracts expected.mediumSamples derivation fields.
			expect(result.mediumSamples).toEqual(expectation.expected.mediumSamples.value);
		}

		if (expectation.expected.modelCalls) {
			// Reason: coefficient/profile lookups must receive the active sample position and grid.
			// Source: medium-contracts expected.modelCalls derivation fields.
			expect(model.calls).toEqual(expectation.expected.modelCalls.value);
		}

		if (expectation.expected.mediumSampleOrder) {
			const samples = expectArrayMediumSamples(result, expectation);
			// Reason: order-sensitive fixture rows pin sample order as part of the output contract.
			// Source: medium-contracts expected.mediumSampleOrder derivation fields.
			expect(samples.map((sample) => sample.sampleIndex))
				.toEqual(expectation.expected.mediumSampleOrder.value);
		}

		if (expectation.expected.sampleFields) {
			const samples = expectArrayMediumSamples(result, expectation);
			// Reason: sample fields are propagated from sampleViewPath for downstream integration.
			// Source: medium-contracts expected.sampleFields derivation fields.
			expect(samples.map((sample) => pickSampleFields(sample)))
				.toEqual(expectation.expected.sampleFields.value);
		}

		if (expectation.expected.coefficients) {
			const samples = expectArrayMediumSamples(result, expectation);
			// Reason: fixture rows pin coefficient totals and derivation labels emitted by evaluateMedium.
			// Source: medium-contracts expected.coefficients derivation fields.
			expect(samples.map((sample) => sample.coefficients))
				.toEqual(expectation.expected.coefficients.value);
		}

		if (expectation.expected.species) {
			const samples = expectArrayMediumSamples(result, expectation);
			// Reason: species diagnostics are model-owned handoff data preserved for downstream scattering.
			// Source: medium-contracts expected.species derivation fields.
			expect(samples.map((sample) => sample.species))
				.toEqual(expectation.expected.species.value);
		}

		if (expectation.expected.altitudeKm) {
			const samples = expectArrayMediumSamples(result, expectation);
			// Reason: altitude is world-owned geometry carried by evaluateMedium.
			// Source: medium-contracts expected.altitudeKm derivation fields.
			expect(samples.map((sample) => sample.altitudeKm))
				.toEqual(expectation.expected.altitudeKm.value);
		}

		if (expectation.expected.profile) {
			const samples = expectArrayMediumSamples(result, expectation);
			// Reason: profile diagnostics are model-owned values preserved after validation.
			// Source: medium-contracts expected.profile derivation fields.
			expect(samples.map((sample) => sample.profile))
				.toEqual(expectation.expected.profile.value);
		}

		if (expectation.expected.composition) {
			const samples = expectArrayMediumSamples(result, expectation);
			// Reason: composition diagnostics are profile-owned values preserved without normalization.
			// Source: medium-contracts expected.composition derivation fields.
			expect(samples.map((sample) => sample.profile?.composition))
				.toEqual(expectation.expected.composition.value);
		}

		if (expectation.expected.compositionModelIds) {
			const samples = expectArrayMediumSamples(result, expectation);
			// Reason: composition model ids prove repeated composition diagnostics stay attributable.
			// Source: medium-contracts expected.compositionModelIds derivation fields.
			expect(samples.map((sample) => sample.profile?.composition?.modelId))
				.toEqual(expectation.expected.compositionModelIds.value);
		}

		if (expectation.expected.wavelengthGrid) {
			const wavelengthsNm = result.validatedRequest?.wavelengthsNm ?? [];
			const gridSummary = {
				firstNm: wavelengthsNm[0],
				lastNm: wavelengthsNm[wavelengthsNm.length - 1],
				count: wavelengthsNm.length,
			};
			// Reason: grid fixture rows pin the active wavelength-grid shape consumed by coefficient arrays.
			// Source: medium-contracts expected.wavelengthGrid derivation fields.
			expect(gridSummary).toEqual(expectation.expected.wavelengthGrid.value);
		}

		if (expectation.expected.coefficientArrayLengths) {
			const samples = expectArrayMediumSamples(result, expectation);
			// Reason: coefficient-array length diagnostics prove wavelength-indexed arrays stay aligned.
			// Source: medium-contracts expected.coefficientArrayLengths derivation fields.
			expect(samples.map((sample) => ({
				extinction: sample.coefficients?.extinctionByWavelength?.length,
				scattering: sample.coefficients?.scatteringByWavelength?.length,
				absorption: sample.coefficients?.absorptionByWavelength?.length,
			}))).toEqual(expectation.expected.coefficientArrayLengths.value);
		}

		// Reason: direct fixture runs execute exactly evaluateMedium and append only that stage id.
		// Source: Reference Code Design, Public API Shape; stages are independently runnable packet transforms.
		expect(result.stageHistory).toEqual(['evaluateMedium']);
	}

	function expectArrayMediumSamples(result, expectation) {
		const samples = result.mediumSamples;

		expect(Array.isArray(samples))
			.withContext(`${expectation.id} mediumSamples is an array`)
			.toBeTrue();

		return Array.isArray(samples) ? samples : [];
	}

	function expectMediumFixtureError(expectation) {
		if (Array.isArray(expectation.inputs.invalidCoefficientCases)) {
			for (const invalidCoefficientCase of expectation.inputs.invalidCoefficientCases) {
				const coefficients = {
					extinctionByWavelength: [0],
					scatteringByWavelength: [0],
					absorptionByWavelength: [0],
					[invalidCoefficientCase.field]: [invalidCoefficientCase.encodedValue],
				};
				expectExpectedError(
					() => runEvaluateMediumForExpectation(expectation, {
						modelResponses: [{ sampleIndex: 0, coefficients }],
					}),
					expectation,
				);
			}
			return;
		}

		if (Array.isArray(expectation.inputs.invalidShapeCases)) {
			for (const invalidShapeCase of expectation.inputs.invalidShapeCases) {
				expectExpectedError(
					() => runEvaluateMediumForExpectation(expectation, {
						modelResponses: [
							{ sampleIndex: 0, coefficients: invalidShapeCase.coefficients },
						],
					}),
					expectation,
				);
			}
			return;
		}

		if (Array.isArray(expectation.inputs.invalidDensityCases)) {
			for (const invalidDensityCase of expectation.inputs.invalidDensityCases) {
				expectExpectedError(
					() => runEvaluateMediumForExpectation(expectation, {
						modelResponses: [
							{
								sampleIndex: 0,
								profile: invalidDensityCase,
								coefficients: {
									extinctionByWavelength: [0],
									scatteringByWavelength: [0],
									absorptionByWavelength: [0],
								},
							},
						],
					}),
					expectation,
				);
			}
			return;
		}

		if (Array.isArray(expectation.inputs.invalidCompositionCases)) {
			for (const invalidCompositionCase of expectation.inputs.invalidCompositionCases) {
				expectExpectedError(
					() => runEvaluateMediumForExpectation(expectation, {
						modelResponses: [
							{
								sampleIndex: 0,
								profile: { composition: invalidCompositionCase.composition },
								coefficients: {
									extinctionByWavelength: [0],
									scatteringByWavelength: [0],
									absorptionByWavelength: [0],
								},
							},
						],
					}),
					expectation,
				);
			}
			return;
		}

		expectExpectedError(
			() => runEvaluateMediumForExpectation(expectation),
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

		// Reason: expected-error fixture rows pin the error class as part of the oracle.
		// Source: medium-contracts expectedError derivation fields.
		expect(caughtError).toEqual(jasmine.any(errorCtor));

		if (!caughtError) {
			return;
		}

		for (const messagePart of expectedError.messageIncludes) {
			// Reason: error fixtures need enough message context to locate invalid medium data.
			// Source: medium-contracts expectedError derivation fields.
			expect(caughtError.message)
				.withContext(`${expectation.id} message includes ${messagePart}`)
				.toContain(messagePart);
		}
	}

	function createControlledMediumModel(modelResponses = [], wavelengthsNm = [], {
		observer,
		ray,
		viewSamples = [],
	} = {}) {
		const responsesBySampleIndex = new Map(
			materializeFixtureValue(modelResponses).map((response) => [
				response.sampleIndex,
				response,
			]),
		);
		const responsesByPosition = createResponsesByPosition(
			responsesBySampleIndex,
			observer,
			ray,
			viewSamples,
		);
		const calls = { mediumAt: [] };

		return {
			calls,
			world: {
				altitudeAt(positionKm) {
					const response = responsesByPosition.get(createPositionKey(positionKm))
						?? responsesBySampleIndex.get(0);
					return response?.altitudeKm ?? 0;
				},
			},
			atmosphere: {
				contains(positionKm, sample) {
					const response = findResponseBySample(responsesBySampleIndex, sample);
					return response?.contains !== false;
				},
				mediumAt(positionKm, { wavelengthsNm: activeWavelengthsNm, sample } = {}) {
					const response = findResponseBySample(responsesBySampleIndex, sample);
					calls.mediumAt.push({
						positionKm: [...positionKm],
						wavelengthsNm: [...(activeWavelengthsNm ?? [])],
						sampleIndex: sample?.sampleIndex,
					});

					if (response?.coefficientPattern) {
						return {
							...omitWorldOnlyFields(response),
							coefficients: createPatternCoefficients(
								response.coefficientPattern,
								activeWavelengthsNm ?? wavelengthsNm,
							),
						};
					}

					return omitWorldOnlyFields(response) ?? {};
				},
			},
		};
	}

	function findResponseBySample(responsesBySampleIndex, sample) {
		return responsesBySampleIndex.get(sample?.sampleIndex)
			?? responsesBySampleIndex.get(0);
	}

	function createResponsesByPosition(responsesBySampleIndex, observer, ray, viewSamples) {
		const responsesByPosition = new Map();

		for (const sample of viewSamples) {
			const response = findResponseBySample(responsesBySampleIndex, sample);

			if (response) {
				responsesByPosition.set(
					createPositionKey(evaluateFixturePositionKm(observer, ray, sample)),
					response,
				);
			}
		}

		return responsesByPosition;
	}

	function evaluateFixturePositionKm(observer, ray, sample) {
		return observer.positionKm.map((component, axisIndex) => {
			return component + ray.direction[axisIndex] * sample.distanceFromObserverKm;
		});
	}

	function createPositionKey(positionKm) {
		return JSON.stringify(positionKm.map((component) => {
			return Number(
				component.toPrecision(EVALUATE_MEDIUM_TEST_POSITION_KEY_SIGNIFICANT_DIGITS),
			);
		}));
	}

	function omitWorldOnlyFields(response) {
		if (!response) {
			return response;
		}

		const { altitudeKm, ...mediumState } = response;
		return mediumState;
	}

	function createPatternCoefficients(pattern, wavelengthsNm) {
		const zeroes = Array.from({ length: wavelengthsNm.length }, () => 0);

		return {
			extinctionByWavelength: pattern.extinction === 'zero' ? [...zeroes] : [],
			scatteringByWavelength: pattern.scattering === 'zero' ? [...zeroes] : [],
			absorptionByWavelength: pattern.absorption === 'zero' ? [...zeroes] : [],
		};
	}

	function pickSampleFields(sample) {
		return {
			sampleIndex: sample.sampleIndex,
			distanceFromObserverKm: sample.distanceFromObserverKm,
			weightKm: sample.weightKm,
			intervalStartKm: sample.intervalStartKm,
			intervalEndKm: sample.intervalEndKm,
			integrationMethod: sample.integrationMethod,
		};
	}

	function materializeWavelengths(inputs) {
		if (Array.isArray(inputs.wavelengthsNm)) {
			return [...inputs.wavelengthsNm];
		}

		const grid = inputs.wavelengthGrid;
		if (!grid) {
			return [];
		}

		return Array.from(
			{ length: grid.count },
			(_, index) => grid.startNm + index * grid.stepNm,
		);
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

		if (value?.encodedPattern === 'zeros') {
			return Array.from({ length: value.count }, () => 0);
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
		expectStageDescriptor('evaluateMedium');
	});

	it('runs exactly one stage against a prepared packet', function() {
		const expectation = getMediumContractExpectation(
			'medium.empty-view-samples.no-medium-samples',
		);
		const { result, packet } = runEvaluateMediumForExpectation(expectation);

		// Reason: direct stage runs should add only evaluateMedium output and not mutate inputs.
		// Source: Reference Code Design, Public API Shape; stages are independently runnable packet transforms.
		expect(result).not.toBe(packet);
		expect(result.stageHistory).toEqual(['evaluateMedium']);
		expect(result.mediumSamples).toEqual([]);
		expect(packet.mediumSamples).toBeUndefined();
	});

	it('fails loudly when prerequisites are missing', function() {
		expectStagePrerequisiteFailure('evaluateMedium');
	});

	it('rejects non-finite altitude from the world model', function() {
		const packet = {
			validatedRequest: {
				model: {
					world: {
						altitudeAt() {
							return Infinity;
						},
					},
					atmosphere: {
						contains() {
							return true;
						},
						mediumAt() {
							return {
								coefficients: {
									extinctionByWavelength: [0],
									scatteringByWavelength: [0],
									absorptionByWavelength: [0],
								},
							};
						},
					},
				},
				observer: { positionKm: [0, 0, 0] },
				ray: { direction: [0, 1, 0] },
				wavelengthsNm: [550],
				numerical: {},
			},
			viewSamples: [
				{
					sampleIndex: 0,
					distanceFromObserverKm: 1,
					weightKm: 1,
					intervalStartKm: 0.5,
					intervalEndKm: 1.5,
					integrationMethod: 'midpoint',
				},
			],
			stageHistory: [],
		};

		// Reason: geometric altitude is consumed from world.altitudeAt and carried downstream
		// as a finite kilometer value; non-finite model data must fail at this stage boundary.
		// Source: Reference Code Design, Stage Boundary Ownership and Model Interface.
		expect(() => createReferenceIntegrator().runStage('evaluateMedium', packet))
			.toThrowError(RangeError, /evaluateMedium sample 0 altitudeKm must be finite/);
	});

	describe('fixture-backed behavior', function() {
		it('returns no medium samples for an empty view-sample list', function() {
			expectMediumFixture('medium.empty-view-samples.no-medium-samples');
		});

		it('evaluates one sample position from observer, ray direction, and sample distance', function() {
			expectMediumFixture('medium.position.single-sample-from-observer-ray');
		});

		it('evaluates multiple sample positions in view-sample order', function() {
			expectMediumFixture('medium.position.multiple-samples-ordered');
		});

		it('passes the active wavelength grid to model-owned coefficient lookups', function() {
			expectMediumFixture('medium.model-call.wavelength-grid');
		});

		it('preserves view-sample fields on each medium sample', function() {
			expectMediumFixture('medium.sample-fields.preserved');
		});

		it('returns explicit zero coefficients for vacuum samples', function() {
			expectMediumFixture('medium.vacuum.zero-coefficients');
		});

		it('returns homogeneous coefficients for a single wavelength', function() {
			expectMediumFixture('medium.homogeneous.single-wavelength');
		});

		it('keeps multi-wavelength coefficient arrays aligned to wavelengthsNm', function() {
			expectMediumFixture('medium.homogeneous.multi-wavelength');
		});

		it('preserves model-owned species diagnostics and names', function() {
			expectMediumFixture('medium.species.diagnostics-preserved');
		});

		it('sums per-species extinction into total extinction by wavelength', function() {
			expectMediumFixture('medium.species.total-extinction-sum');
		});

		it('keeps absorption plus scattering consistent with extinction', function() {
			expectMediumFixture(
				'medium.coefficients.absorption-scattering-extinction-consistency',
			);
		});

		it('derives altitude diagnostics from the world model', function() {
			expectMediumFixture('medium.diagnostics.altitude-from-world');
		});

		it('copies density diagnostics from the atmosphere model', function() {
			expectMediumFixture('medium.diagnostics.density-from-atmosphere');
		});

		it('returns vacuum coefficients outside the atmosphere volume', function() {
			expectMediumFixture('medium.outside-atmosphere.vacuum');
		});

		it('rejects negative extinction coefficients', function() {
			expectMediumFixture('medium.invalid.negative-extinction-rejects');
		});

		it('rejects negative scattering coefficients', function() {
			expectMediumFixture('medium.invalid.negative-scattering-rejects');
		});

		it('rejects negative absorption coefficients', function() {
			expectMediumFixture('medium.invalid.negative-absorption-rejects');
		});

		it('rejects non-finite coefficients', function() {
			expectMediumFixture('medium.invalid.nonfinite-coefficients-reject');
		});

		it('rejects coefficient arrays that do not align to wavelengthsNm', function() {
			expectMediumFixture('medium.invalid.wavelength-shape-rejects');
		});

		it('rejects invalid density diagnostics', function() {
			expectMediumFixture('medium.invalid.density-rejects');
		});
	});

	describe('expected-range behavior', function() {
		it('preserves dense near-surface profile diagnostics supplied by the model', function() {
			expectMediumFixture('medium.earth-profile.sea-level-density-checkpoint');
		});

		it('preserves low-density high-altitude profile diagnostics supplied by the model', function() {
			expectMediumFixture('medium.earth-profile.high-altitude-density-checkpoint');
		});

		it('preserves near-boundary profile diagnostics supplied by the model', function() {
			expectMediumFixture('medium.earth-profile.upper-supported-density-checkpoint');
		});

		it('preserves model-supplied standard dry-air composition fractions', function() {
			expectMediumFixture('medium.earth-composition.standard-dry-air-major-fractions');
		});

		it('preserves repeated model-supplied composition diagnostics across profile checkpoints', function() {
			expectMediumFixture('medium.earth-composition.homosphere-consistency');
		});

		it('keeps coefficients aligned across the selected visible wavelength-grid shape', function() {
			expectMediumFixture('medium.earth-profile.visible-wavelength-grid-alignment');
		});
	});

	describe('planned follow-up extremes', function() {
		it('preserves the selected dense near-surface profile extreme without rescaling or clamping', function() {
			expectMediumFixture('medium.extreme.profile.dense-near-surface');
		});

		it('preserves the selected low-density upper-supported profile extreme', function() {
			expectMediumFixture('medium.extreme.profile.low-density-upper-supported');
		});

		it('rejects invalid density diagnostics at the profile boundary extremes', function() {
			expectMediumFixture('medium.extreme.profile.invalid-density-boundaries');
		});

		it('emits wavelength-aligned zero coefficients for the vacuum density extreme', function() {
			expectMediumFixture('medium.extreme.profile.zero-density-vacuum');
		});

		it('rejects contradictory vacuum samples that also report nonzero coefficients', function() {
			expectMediumFixture(
				'medium.extreme.profile.vacuum-contradictory-coefficients-rejects',
			);
		});

		it('keeps coefficient arrays aligned across the full selected visible wavelength grid', function() {
			expectMediumFixture('medium.extreme.wavelength-grid.visible-full-range');
		});

		it('rejects coefficient arrays that miss the full selected visible wavelength-grid shape', function() {
			expectMediumFixture(
				'medium.extreme.wavelength-grid.visible-full-range-mismatch-rejects',
			);
		});

		it('preserves the standard dry-air listed-fraction residual without renormalizing', function() {
			expectMediumFixture('medium.extreme.composition.listed-standard-residual');
		});

		it('rejects invalid composition diagnostics at the standard dry-air boundary', function() {
			expectMediumFixture('medium.extreme.composition.invalid-fraction-boundaries');
		});

		it('accepts zero and small positive finite coefficient values at the selected valid boundary', function() {
			expectMediumFixture('medium.extreme.coefficient.zero-and-positive-finite');
		});

		it('rejects invalid coefficient boundary values without clamping or padding', function() {
			expectMediumFixture('medium.extreme.coefficient.invalid-boundaries');
		});
	});
});
