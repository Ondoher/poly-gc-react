import {
	createReferenceIntegrator,
	expectStageDescriptor,
	expectStagePrerequisiteFailure,
} from '../../_tests/test-pipeline-stages.js';
import {
	getAnalyticInvariantExpectation,
	getExpectedDatum,
	getToleranceRule,
	getViewOpticalDepthHardeningExpectation,
	expectExpectationValue,
	expectValueToMatchTolerance,
} from '../../_tests/test-expectations.js';

describe('atmosphere reference pipeline stage integrateViewOpticalDepth', function() {
	function runIntegrateViewOpticalDepth(packet) {
		return createReferenceIntegrator().runStage('integrateViewOpticalDepth', {
			stageHistory: [],
			...packet,
		});
	}

	function createMediumPacket({
		wavelengthsNm,
		samples,
		stageHistory = [],
	}) {
		return {
			validatedRequest: { wavelengthsNm },
			mediumSamples: samples.map((sample, index) => {
				const coefficients = sample.coefficients
					?? (
						sample.extinctionByWavelength === undefined
							? undefined
							: { extinctionByWavelength: sample.extinctionByWavelength }
					);

				return {
					sampleIndex: sample.sampleIndex ?? index,
					distanceFromObserverKm: sample.distanceFromObserverKm,
					weightKm: sample.weightKm,
					intervalStartKm: sample.intervalStartKm,
					intervalEndKm: sample.intervalEndKm,
					coefficients,
					species: sample.species,
				};
			}),
			stageHistory,
		};
	}

	function createSingleSamplePacket(expectation, {
		extinctionByWavelength,
		species,
		weightKm = expectation.inputs.distanceKm,
		distanceFromObserverKm = weightKm,
	} = {}) {
		return createMediumPacket({
			wavelengthsNm: expectation.inputs.wavelengthsNm,
			samples: [{
				distanceFromObserverKm,
				weightKm,
				extinctionByWavelength: extinctionByWavelength
					?? expectation.inputs.sigmaTPerKmByWavelength,
				species,
			}],
		});
	}

	function pathEnd(result) {
		const pathEndResult = result.viewOpticalDepth?.pathEnd;

		// Reason: this stage owns explicit camera-to-end optical depth and transmittance diagnostics.
		// Source: Reference Code Design, integrateViewOpticalDepth output shape.
		expect(pathEndResult).toEqual(jasmine.any(Object));
		return pathEndResult ?? {};
	}

	function outputSamples(result) {
		const samples = result.viewOpticalDepth?.samples;

		// Reason: camera-to-sample diagnostics are aligned to the view/medium samples.
		// Source: Reference Test Design, integrateViewOpticalDepth output schema.
		expect(samples).toEqual(jasmine.any(Array));
		return samples ?? [];
	}

	function expectPathEndValue(result, expectation, outputKey, expectedKey) {
		const expectedDatum = getExpectedDatum(expectation, expectedKey);

		expectValueToMatchTolerance(
			pathEnd(result)[outputKey],
			expectedDatum.value,
			getToleranceRule(expectation, expectedKey),
			`${expectation.id}.pathEnd.${outputKey}`,
		);
	}

	function expectExpectedError(run, expectation) {
		const { expectedError } = expectation;
		const errorCtor = expectedError.type === 'RangeError' ? RangeError : Error;
		const caughtError = catchExpectedError(run);

		// Reason: expected-error fixtures pin both the error class and human-searchable context.
		// Source: Reference Test Design, Expected Value Policy; loud-failure rows are oracles too.
		expect(caughtError).toEqual(jasmine.any(errorCtor));

		if (!caughtError) {
			return;
		}

		for (const messagePart of expectedError.messageIncludes) {
			// Reason: error-contract fixtures require enough message context to find invalid model data.
			// Source: analytic-invariants expectedError derivation fields.
			expect(caughtError.message)
				.withContext(`${expectation.id} message includes ${messagePart}`)
				.toContain(messagePart);
		}
	}

	function catchExpectedError(run) {
		try {
			run();
		} catch (error) {
			return error;
		}

		return undefined;
	}

	function expectFixtureValue(actualValue, expectation, quantityKey) {
		const expectedDatum = getExpectedDatum(expectation, quantityKey);
		const tolerance = getToleranceRule(expectation, quantityKey);

		if (tolerance.mode === 'exact') {
			// Reason: exact fixture comparisons should use structural equality only when the row's tolerance says exact.
			// Source: Implemented Stage Spec Assertion Source Maps; fixture tolerance owns comparison mode.
			expect(actualValue)
				.withContext(`${expectation.id}.${quantityKey}`)
				.toEqual(expectedDatum.value);
			return;
		}

		expectValueToMatchTolerance(
			actualValue,
			expectedDatum.value,
			tolerance,
			`${expectation.id}.${quantityKey}`,
		);
	}

	function createHardeningPacket(expectation) {
		return createMediumPacket({
			wavelengthsNm: expectation.inputs.wavelengthsNm,
			samples: expectation.inputs.samples,
		});
	}

	function encodeNonFiniteSampleValues(sample) {
		if (sample.intervalEndKm?.encodedNonFinite === 'Infinity') {
			return { ...sample, intervalEndKm: Infinity };
		}

		return sample;
	}

	function createSpectralGrid({ startNm, endNm, stepNm }) {
		return Array.from(
			{ length: Math.round((endNm - startNm) / stepNm) + 1 },
			(_, index) => startNm + index * stepNm,
		);
	}

	function createAstmG173Grid() {
		const firstBand = Array.from({ length: 241 }, (_, index) => 280 + index * 0.5);
		const secondBand = Array.from({ length: 1300 }, (_, index) => 401 + index);
		const transition = [1702, 1705, 1710];
		const finalBand = Array.from({ length: 458 }, (_, index) => 1715 + index * 5);

		return [...firstBand, ...secondBand, ...transition, ...finalBand];
	}

	function expectFixtureExpectedErrorGate(expectation) {
		// Reason: some hardening rows are provenance gates, not runtime packet behavior.
		// Source: Reference Test Plan, integrateViewOpticalDepth Follow-Up Audit; unsourced
		// fixture candidates must stay blocked until source assumptions are pinned.
		expect(expectation.expectedError).toEqual(jasmine.any(Object));
		expect(expectation.expected).toBeUndefined();
		expect(expectation.expectedError.messageIncludes.length).toBeGreaterThan(0);
	}

	it('declares its stage contract', function() {
		expectStageDescriptor('integrateViewOpticalDepth');
	});

	it('runs exactly one stage against a prepared packet', function() {
		const packet = createMediumPacket({
			wavelengthsNm: [550],
			samples: [],
		});

		const result = runIntegrateViewOpticalDepth(packet);

		// Reason: direct stage runs must append only their own stage id and avoid mutating input.
		// Source: Reference Code Design, Public API Shape; stages are independently runnable packet transforms.
		expect(result).not.toBe(packet);
		expect(result.stageHistory).toEqual(['integrateViewOpticalDepth']);
		expect(packet.viewOpticalDepth).toBeUndefined();
	});

	it('uses validatedRequest.wavelengthsNm as the single wavelength-grid source', function() {
		const packet = createMediumPacket({
			wavelengthsNm: [550],
			samples: [{
				distanceFromObserverKm: 1,
				weightKm: 1,
				extinctionByWavelength: [0.2],
			}],
		});

		packet.wavelengthsNm = [450, 550];

		const result = runIntegrateViewOpticalDepth(packet);

		// Reason: validateRequest owns the canonical wavelength grid after request validation;
		// later stages must not read a stale top-level duplicate.
		// Source: Reference Code Design, Stage Boundary Ownership and integrateViewOpticalDepth input shape.
		expect(pathEnd(result).cumulativeOpticalDepthByWavelength).toEqual([0.2]);
	});

	it('fails loudly when prerequisites are missing', function() {
		expectStagePrerequisiteFailure('integrateViewOpticalDepth');
	});

	it('matches the vacuum finite-path analytic expectation fixture', function() {
		// Reason: vacuum extinction gives zero optical depth and unit transmittance over any finite path.
		// Source: analytic-invariants fixture `view-transmittance.vacuum.finite-path`, PBRT Transmittance.
		const expectation = getAnalyticInvariantExpectation(
			'view-transmittance.vacuum.finite-path',
		);
		const result = runIntegrateViewOpticalDepth(createSingleSamplePacket(expectation));

		expectExpectationValue(
			pathEnd(result).cumulativeOpticalDepthByWavelength?.[0],
			expectation,
			'tau',
		);
		expectExpectationValue(
			pathEnd(result).viewTransmittanceByWavelength?.[0],
			expectation,
			'transmittance',
		);
	});

	it('matches the non-vacuum zero-length analytic expectation fixture', function() {
		// Reason: a zero-length path has no measure, so optical depth is zero even with nonzero extinction.
		// Source: analytic-invariants fixture `view-transmittance.nonvacuum.zero-length-path`, PBRT Transmittance.
		const expectation = getAnalyticInvariantExpectation(
			'view-transmittance.nonvacuum.zero-length-path',
		);
		const result = runIntegrateViewOpticalDepth(createSingleSamplePacket(expectation));

		expectExpectationValue(
			pathEnd(result).cumulativeOpticalDepthByWavelength?.[0],
			expectation,
			'tau',
		);
		expectExpectationValue(
			pathEnd(result).viewTransmittanceByWavelength?.[0],
			expectation,
			'transmittance',
		);
	});

	it('matches the homogeneous Beer-Lambert analytic expectation fixture', function() {
		// Reason: constant extinction over distance d gives tau = sigma_t * d and T = exp(-tau).
		// Source: analytic-invariants fixture `view-transmittance.homogeneous.beer-lambert-0p6`, PBRT Transmittance.
		const expectation = getAnalyticInvariantExpectation(
			'view-transmittance.homogeneous.beer-lambert-0p6',
		);
		const result = runIntegrateViewOpticalDepth(createSingleSamplePacket(expectation));

		expectExpectationValue(
			pathEnd(result).cumulativeOpticalDepthByWavelength?.[0],
			expectation,
			'tau',
		);
		expectExpectationValue(
			pathEnd(result).viewTransmittanceByWavelength?.[0],
			expectation,
			'transmittance',
		);
	});

	it('matches the split-path multiplicativity analytic expectation fixture', function() {
		// Reason: adjacent optical depths add and transmittance multiplies along the same ray.
		// Source: analytic-invariants fixture `view-transmittance.split-path.multiplicative-0p2-plus-0p4`, PBRT Transmittance.
		const expectation = getAnalyticInvariantExpectation(
			'view-transmittance.split-path.multiplicative-0p2-plus-0p4',
		);
		const result = runIntegrateViewOpticalDepth(createMediumPacket({
			wavelengthsNm: expectation.inputs.wavelengthsNm,
			samples: [
				{
					distanceFromObserverKm: 1,
					weightKm: 1,
					extinctionByWavelength: [0.2],
				},
				{
					distanceFromObserverKm: 2,
					weightKm: 1,
					extinctionByWavelength: [0.4],
				},
			],
		}));
		const samples = outputSamples(result);

		expectExpectationValue(
			pathEnd(result).cumulativeOpticalDepthByWavelength?.[0],
			expectation,
			'tauAC',
		);
		expectExpectationValue(
			samples[0]?.viewTransmittanceByWavelength?.[0],
			expectation,
			'transmittanceAB',
		);
		expectExpectationValue(
			pathEnd(result).viewTransmittanceByWavelength?.[0],
			expectation,
			'transmittanceAC',
		);
	});

	it('returns explicit zero optical depth and unit transmittance for an empty transport path', function() {
		// Reason: no path samples means no extinction integral contribution.
		// Source: PBRT Transmittance path-integral definition; local packet schema defines empty transport output.
		const expectation = getAnalyticInvariantExpectation(
			'view-transmittance.empty-path.explicit-output',
		);
		const result = runIntegrateViewOpticalDepth(createMediumPacket({
			wavelengthsNm: expectation.inputs.wavelengthsNm,
			samples: [],
		}));

		expectExpectationValue(outputSamples(result).length, expectation, 'sampleCount');
		expectPathEndValue(
			result,
			expectation,
			'cumulativeOpticalDepthByWavelength',
			'pathEndTauByWavelength',
		);
		expectPathEndValue(
			result,
			expectation,
			'viewTransmittanceByWavelength',
			'pathEndTransmittanceByWavelength',
		);
	});

	it('keeps optical-depth and transmittance arrays aligned to samples and wavelengths', function() {
		// Reason: diagnostics and later scattering stages need wavelength-indexed values at each view sample.
		// Source: Reference Code Design, Pipeline Data Packet; wavelengthsNm owns spectral array order.
		const expectation = getAnalyticInvariantExpectation(
			'view-transmittance.homogeneous.multi-wavelength',
		);
		const wavelengthsNm = expectation.inputs.wavelengthsNm;
		const result = runIntegrateViewOpticalDepth(createMediumPacket({
			wavelengthsNm,
			samples: [
				{
					distanceFromObserverKm: 1,
					weightKm: 1,
					extinctionByWavelength: expectation.inputs.sigmaTPerKmByWavelength,
				},
				{
					distanceFromObserverKm: 3,
					weightKm: 2,
					extinctionByWavelength: expectation.inputs.sigmaTPerKmByWavelength,
				},
			],
		}));
		const samples = outputSamples(result);

		// Reason: two input medium samples should emit two aligned optical-depth diagnostics.
		// Source: Stage Contracts, integrateViewOpticalDepth sample output shape.
		expect(samples.length).toBe(2);
		for (const sample of samples) {
			expect(sample.cumulativeOpticalDepthByWavelength?.length)
				.withContext(`sample ${sample.sampleIndex} tau length`)
				.toBe(wavelengthsNm.length);
			expect(sample.viewTransmittanceByWavelength?.length)
				.withContext(`sample ${sample.sampleIndex} transmittance length`)
				.toBe(wavelengthsNm.length);
		}
		expect(pathEnd(result).cumulativeOpticalDepthByWavelength?.length)
			.withContext('pathEnd tau length')
			.toBe(wavelengthsNm.length);
		expect(pathEnd(result).viewTransmittanceByWavelength?.length)
			.withContext('pathEnd transmittance length')
			.toBe(wavelengthsNm.length);
	});

	it('reports the path end from the final sample interval endpoint when present', function() {
		// Reason: sampleViewPath emits midpoint distances for integrand evaluation, while the path end is
		// the interval endpoint consumed by downstream diagnostics.
		// Source: Reference Code Design, sampleViewPath Output Shape; integrateViewOpticalDepth path-end diagnostics.
		const expectation = getAnalyticInvariantExpectation(
			'view-transmittance.homogeneous.beer-lambert-0p6',
		);
		const result = runIntegrateViewOpticalDepth(createMediumPacket({
			wavelengthsNm: expectation.inputs.wavelengthsNm,
			samples: [
				{
					distanceFromObserverKm: 1.5,
					weightKm: 3,
					intervalStartKm: 0,
					intervalEndKm: 3,
					extinctionByWavelength: expectation.inputs.sigmaTPerKmByWavelength,
				},
			],
		}));

		expect(pathEnd(result).distanceFromObserverKm).toBe(3);
		expectExpectationValue(
			pathEnd(result).cumulativeOpticalDepthByWavelength?.[0],
			expectation,
			'tau',
		);
	});

	it('accumulates nonnegative homogeneous extinction monotonically along ordered samples', function() {
		// Reason: with nonnegative extinction, cumulative optical depth cannot decrease and transmittance cannot increase.
		// Source: PBRT Transmittance optical-depth integral and T = exp(-tau).
		const expectation = getAnalyticInvariantExpectation(
			'view-transmittance.homogeneous.two-sample-monotonic',
		);
		const result = runIntegrateViewOpticalDepth(createMediumPacket({
			wavelengthsNm: expectation.inputs.wavelengthsNm,
			samples: expectation.inputs.intervalLengthsKm.map((weightKm, index) => ({
				distanceFromObserverKm: expectation.expected.checkpointDistancesKm.value[index],
				weightKm,
				extinctionByWavelength: expectation.inputs.sigmaTPerKmByWavelength,
			})),
		}));
		const samples = outputSamples(result);

		expectValueToMatchTolerance(
			samples.map((sample) => sample.distanceFromObserverKm),
			getExpectedDatum(expectation, 'checkpointDistancesKm').value,
			getToleranceRule(expectation, 'checkpointDistancesKm'),
			`${expectation.id}.checkpointDistancesKm`,
		);
		expectValueToMatchTolerance(
			samples.map((sample) => sample.cumulativeOpticalDepthByWavelength?.[0]),
			getExpectedDatum(expectation, 'cumulativeTauByCheckpoint').value,
			getToleranceRule(expectation, 'cumulativeTauByCheckpoint'),
			`${expectation.id}.cumulativeTauByCheckpoint`,
		);
		expectValueToMatchTolerance(
			samples.map((sample) => sample.viewTransmittanceByWavelength?.[0]),
			getExpectedDatum(expectation, 'transmittanceByCheckpoint').value,
			getToleranceRule(expectation, 'transmittanceByCheckpoint'),
			`${expectation.id}.transmittanceByCheckpoint`,
		);
		// Reason: nonnegative extinction makes cumulative tau nondecreasing and Beer-Lambert T nonincreasing.
		// Source: PBRT Transmittance; monotonic fixture row.
		expect(samples[1]?.cumulativeOpticalDepthByWavelength?.[0])
			.toBeGreaterThan(samples[0]?.cumulativeOpticalDepthByWavelength?.[0]);
		expect(samples[1]?.viewTransmittanceByWavelength?.[0])
			.toBeLessThan(samples[0]?.viewTransmittanceByWavelength?.[0]);
	});

	it('keeps multi-wavelength extinction independent per wavelength', function() {
		// Reason: spectral transport must not collapse wavelength-dependent extinction into one scalar.
		// Source: PBRT Volume Scattering wavelength-varying properties; Reference Code Design spectral pipeline.
		const expectation = getAnalyticInvariantExpectation(
			'view-transmittance.homogeneous.multi-wavelength',
		);
		const result = runIntegrateViewOpticalDepth(createSingleSamplePacket(expectation));

		expectPathEndValue(
			result,
			expectation,
			'cumulativeOpticalDepthByWavelength',
			'tauByWavelength',
		);
		expectPathEndValue(
			result,
			expectation,
			'viewTransmittanceByWavelength',
			'transmittanceByWavelength',
		);
	});

	it('integrates nonuniform sample weights instead of inferring distance from sample count', function() {
		// Reason: optical depth is integrated over distance, and sample weights are the stage's distance measure.
		// Source: analytic-invariants fixture `view-transmittance.weighted-samples.piecewise-constant`, PBRT Transmittance.
		const expectation = getAnalyticInvariantExpectation(
			'view-transmittance.weighted-samples.piecewise-constant',
		);
		const result = runIntegrateViewOpticalDepth(createMediumPacket({
			wavelengthsNm: expectation.inputs.wavelengthsNm,
			samples: expectation.inputs.sampleWeightsKm.map((weightKm, index) => ({
				distanceFromObserverKm: expectation.inputs.sampleWeightsKm
					.slice(0, index + 1)
					.reduce((sum, value) => sum + value, 0),
				weightKm,
				extinctionByWavelength: expectation.inputs.sampleSigmaTPerKmByWavelength[index],
			})),
		}));

		expectPathEndValue(
			result,
			expectation,
			'cumulativeOpticalDepthByWavelength',
			'tauByWavelength',
		);
		expectPathEndValue(
			result,
			expectation,
			'viewTransmittanceByWavelength',
			'transmittanceByWavelength',
		);
	});

	it('sums separate species optical depths into total optical depth', function() {
		// Reason: extinction is the combined attenuation from absorption and out-scattering, and species contributions add.
		// Source: PBRT Volume Scattering Processes attenuation/extinction definition; local species schema owns names.
		const expectation = getAnalyticInvariantExpectation(
			'view-transmittance.homogeneous.multi-species-sum',
		);
		const species = Object.entries(expectation.inputs.speciesSigmaTPerKmByWavelength)
			.map(([speciesName, extinctionByWavelength]) => {
				return { name: speciesName, extinctionByWavelength };
			});
		const result = runIntegrateViewOpticalDepth(createSingleSamplePacket(expectation, {
			species,
			extinctionByWavelength: undefined,
		}));
		const resultPathEnd = pathEnd(result);

		expectValueToMatchTolerance(
			resultPathEnd.speciesOpticalDepth?.rayleigh?.cumulativeOpticalDepthByWavelength,
			getExpectedDatum(expectation, 'rayleighTauByWavelength').value,
			getToleranceRule(expectation, 'rayleighTauByWavelength'),
			`${expectation.id}.rayleighTauByWavelength`,
		);
		expectValueToMatchTolerance(
			resultPathEnd.speciesOpticalDepth?.mie?.cumulativeOpticalDepthByWavelength,
			getExpectedDatum(expectation, 'mieTauByWavelength').value,
			getToleranceRule(expectation, 'mieTauByWavelength'),
			`${expectation.id}.mieTauByWavelength`,
		);
		expectPathEndValue(
			result,
			expectation,
			'cumulativeOpticalDepthByWavelength',
			'totalTauByWavelength',
		);
		expectPathEndValue(
			result,
			expectation,
			'viewTransmittanceByWavelength',
			'transmittanceByWavelength',
		);
	});

	it('rejects negative extinction instead of clamping it', function() {
		// Reason: extinction coefficients are nonnegative physical rates; clamping would hide an invalid medium model.
		// Source: PBRT Volume Scattering Processes absorption/scattering coefficients; Reference Test Design hard invariants.
		const expectation = getAnalyticInvariantExpectation(
			'view-transmittance.negative-extinction-rejects',
		);
		const species = Object.entries(expectation.inputs.speciesSigmaTPerKmByWavelength)
			.map(([speciesName, extinctionByWavelength]) => {
				return { name: speciesName, extinctionByWavelength };
			});

		expectExpectedError(
			() => runIntegrateViewOpticalDepth(createSingleSamplePacket(expectation, {
				species,
				extinctionByWavelength: undefined,
			})),
			expectation,
		);
	});

	it('rejects extinction arrays that do not align to the wavelength grid', function() {
		// Reason: spectral coefficient arrays must match wavelengthsNm; implicit broadcast/truncate/pad would hide invalid model data.
		// Source: analytic-invariants fixture `view-transmittance.coefficient-wavelength-shape-rejects`, Reference Code Design spectral-array contract.
		const expectation = getAnalyticInvariantExpectation(
			'view-transmittance.coefficient-wavelength-shape-rejects',
		);
		const species = Object.entries(expectation.inputs.speciesSigmaTPerKmByWavelength)
			.map(([speciesName, extinctionByWavelength]) => {
				return { name: speciesName, extinctionByWavelength };
			});

		expectExpectedError(
			() => runIntegrateViewOpticalDepth(createSingleSamplePacket(expectation, {
				weightKm: 1,
				distanceFromObserverKm: 1,
				species,
				extinctionByWavelength: undefined,
			})),
			expectation,
		);
	});

	it('rejects invalid sample weights in a directly supplied stage packet', function() {
		// Reason: integration weights are path distances, so negative or non-finite weights cannot define optical depth.
		// Source: analytic-invariants fixture `view-transmittance.invalid-sample-weight-rejects`, PBRT Transmittance.
		const expectation = getAnalyticInvariantExpectation(
			'view-transmittance.invalid-sample-weight-rejects',
		);

		expectExpectedError(
			() => runIntegrateViewOpticalDepth(createMediumPacket({
				wavelengthsNm: expectation.inputs.wavelengthsNm,
				samples: expectation.inputs.sampleWeightsKm.map((weightKm, index) => ({
					distanceFromObserverKm: index + 1,
					weightKm,
					extinctionByWavelength: expectation.inputs.sampleSigmaTPerKmByWavelength[index],
				})),
			})),
			expectation,
		);
	});

	describe('hardening follow-up', function() {
		it('accepts a finite final interval endpoint as the canonical path-end distance', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.path-end.finite-interval-endpoint',
			);
			const result = runIntegrateViewOpticalDepth(createHardeningPacket(expectation));

			expectFixtureValue(
				pathEnd(result).distanceFromObserverKm,
				expectation,
				'pathEndDistanceKm',
			);
		});

		it('rejects a non-empty path whose final interval endpoint is non-finite', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.path-end.nonfinite-interval-endpoint-rejects',
			);
			const packet = createMediumPacket({
				wavelengthsNm: expectation.inputs.wavelengthsNm,
				samples: expectation.inputs.samples.map(encodeNonFiniteSampleValues),
			});

			expectExpectedError(
				() => runIntegrateViewOpticalDepth(packet),
				expectation,
			);
		});

		it('keeps sample weights and interval endpoints owned by mediumSamples', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.packet-ownership.medium-samples-own-geometry',
			);
			const result = runIntegrateViewOpticalDepth(createHardeningPacket(expectation));

			expectFixtureValue(
				'mediumSamples',
				expectation,
				'canonicalGeometryOwner',
			);
			const outputSample = outputSamples(result)[0] ?? {};

			for (const fieldName of getExpectedDatum(expectation, 'viewOpticalDepthRequiredFields').value) {
				// Reason: downstream optical-depth consumers need these positive diagnostics.
				// Source: view-optical-depth-hardening packet ownership fixture row.
				expect(Object.prototype.hasOwnProperty.call(outputSample, fieldName))
					.withContext(`${expectation.id} required field ${fieldName}`)
					.toBeTrue();
			}
		});

		it('reports species optical depth as cumulative through each sample', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.species-diagnostics.cumulative-through-sample',
			);
			const result = runIntegrateViewOpticalDepth(createHardeningPacket(expectation));

			expectValueToMatchTolerance(
				outputSamples(result).map((sample) => {
					return sample.speciesOpticalDepth?.rayleigh?.cumulativeOpticalDepthByWavelength;
				}),
				getExpectedDatum(expectation, 'rayleighCumulativeTauBySample').value,
				getToleranceRule(expectation, 'rayleighCumulativeTauBySample'),
				`${expectation.id}.rayleighCumulativeTauBySample`,
			);
		});

		it('accepts the sourced CIE 360-830 nm visible grid when coefficient arrays align', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.visible-grid.cie-full-range-aligns',
			);
			const grid = createSpectralGrid(expectation.inputs.wavelengthGrid);
			const result = runIntegrateViewOpticalDepth(createMediumPacket({
				wavelengthsNm: grid,
				samples: [{
					distanceFromObserverKm: 1,
					weightKm: 1,
					extinctionByWavelength: Array.from({ length: grid.length }, () => 0),
				}],
			}));

			expectFixtureValue(
				{
					firstNm: grid[0],
					lastNm: grid[grid.length - 1],
					stepNm: grid[1] - grid[0],
					count: grid.length,
				},
				expectation,
				'gridMetadata',
			);
			// Reason: accepting the sourced grid also means preserving one output value per active wavelength.
			// Source: Reference Code Design spectral-array contract; CIE grid count comes from the fixture row.
			expect(pathEnd(result).cumulativeOpticalDepthByWavelength.length)
				.withContext(`${expectation.id}.pathEnd wavelength count`)
				.toBe(grid.length);
		});

		it('rejects CIE visible-grid coefficient arrays with scalar, short, or long shapes', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.visible-grid.cie-shape-mismatch-rejects',
			);
			const grid = createSpectralGrid(expectation.inputs.wavelengthGrid);
			const invalidCases = [
				{ extinctionByWavelength: 0 },
				{ extinctionByWavelength: Array.from({ length: grid.length - 1 }, () => 0) },
				{ extinctionByWavelength: Array.from({ length: grid.length + 1 }, () => 0) },
			];

			for (const invalidCase of invalidCases) {
				expectExpectedError(
					() => runIntegrateViewOpticalDepth(createMediumPacket({
						wavelengthsNm: grid,
						samples: [{
							distanceFromObserverKm: 1,
							weightKm: 1,
							...invalidCase,
						}],
					})),
					expectation,
				);
			}
		});

		it('accepts the sourced ASTM G-173 wavelength grid when coefficient arrays align', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.solar-grid.astm-g173-range-aligns',
			);
			const grid = createAstmG173Grid();
			const result = runIntegrateViewOpticalDepth(createMediumPacket({
				wavelengthsNm: grid,
				samples: [{
					distanceFromObserverKm: 1,
					weightKm: 1,
					extinctionByWavelength: Array.from({ length: grid.length }, () => 0),
				}],
			}));

			expectFixtureValue(
				{
					firstNm: grid[0],
					lastNm: grid[grid.length - 1],
					count: grid.length,
				},
				expectation,
				'gridMetadata',
			);
			// Reason: accepting the sourced grid also means preserving one output value per active wavelength.
			// Source: Reference Code Design spectral-array contract; ASTM G-173 grid count comes from the fixture row.
			expect(pathEnd(result).cumulativeOpticalDepthByWavelength.length)
				.withContext(`${expectation.id}.pathEnd wavelength count`)
				.toBe(grid.length);
		});

		it('rejects ASTM G-173 grid coefficient arrays with scalar, short, or long shapes', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.solar-grid.astm-g173-shape-mismatch-rejects',
			);
			const grid = createAstmG173Grid();
			const invalidCases = [
				{ extinctionByWavelength: 0 },
				{ extinctionByWavelength: Array.from({ length: grid.length - 1 }, () => 0) },
				{ extinctionByWavelength: Array.from({ length: grid.length + 1 }, () => 0) },
			];

			for (const invalidCase of invalidCases) {
				expectExpectedError(
					() => runIntegrateViewOpticalDepth(createMediumPacket({
						wavelengthsNm: grid,
						samples: [{
							distanceFromObserverKm: 1,
							weightKm: 1,
							...invalidCase,
						}],
					})),
					expectation,
				);
			}
		});

		it('matches a sourced clear-air optically thin Rayleigh row after the coefficient model is pinned', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.clear-air.rayleigh-bucholtz-thin-row',
			);
			const result = runIntegrateViewOpticalDepth(createMediumPacket({
				wavelengthsNm: expectation.inputs.wavelengthsNm,
				samples: [{
					distanceFromObserverKm: 1,
					weightKm: 1,
					species: [{
						name: expectation.inputs.species[0].name,
						extinctionByWavelength: expectation.inputs.species[0].targetOpticalDepth,
					}],
				}],
			}));

			expectPathEndValue(
				result,
				expectation,
				'cumulativeOpticalDepthByWavelength',
				'rayleighTauByWavelength',
			);
		});

		it('rejects clear-air optical-depth extreme fixtures whose source/model assumptions are not pinned', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.clear-air.unpinned-assumptions-rejects',
			);

			expectFixtureExpectedErrorGate(expectation);
		});

		it('matches a sourced near-horizon or AM1.5 slant-path fixture after the path approximation is declared', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.slant-path.kasten-young-horizon-row',
			);

			expectFixtureValue(
				expectation.inputs,
				expectation,
				'airMassRow',
			);
		});

		it('rejects near-horizon slant-path fixtures with arbitrary unsourced path multipliers', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.slant-path.unsourced-multiplier-rejects',
			);

			expectFixtureExpectedErrorGate(expectation);
		});

		it('matches a finite named flat lateral-boundary homogeneous transport fixture', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.flat-large-lateral-boundary.finite-homogeneous',
			);
			const result = runIntegrateViewOpticalDepth(createHardeningPacket(expectation));

			expectPathEndValue(
				result,
				expectation,
				'cumulativeOpticalDepthByWavelength',
				'tauByWavelength',
			);
			expectPathEndValue(
				result,
				expectation,
				'viewTransmittanceByWavelength',
				'transmittanceByWavelength',
			);
		});

		it('rejects flat large-lateral-path fixtures that hide an unbounded path as an integration cap', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.flat-large-lateral-boundary.unbounded-cap-rejects',
			);

			expectFixtureExpectedErrorGate(expectation);
		});

		it('accepts the selected clear-air model species set and preserves per-species totals', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.species-count.selected-clear-air-model',
			);
			const result = runIntegrateViewOpticalDepth(createHardeningPacket(expectation));
			const speciesNames = Object.keys(pathEnd(result).speciesOpticalDepth ?? {});

			expectFixtureValue(speciesNames, expectation, 'speciesNames');
			expectPathEndValue(
				result,
				expectation,
				'cumulativeOpticalDepthByWavelength',
				'totalTauByWavelength',
			);
		});

		it('rejects selected-model species-extreme fixtures with mismatched arrays', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.species-count.invalid-selected-model-species-rejects',
			);
			const errors = [];

			for (const invalidSpecies of expectation.inputs.invalidSpeciesCases) {
				const error = catchExpectedError(() => {
					runIntegrateViewOpticalDepth(createMediumPacket({
						wavelengthsNm: expectation.inputs.wavelengthsNm,
						samples: [{
							distanceFromObserverKm: 1,
							weightKm: 1,
							species: [invalidSpecies],
						}],
					}));
				});

				// Reason: each invalid species row is a stage-boundary schema violation.
				// Source: view-optical-depth-hardening fixture `invalid-selected-model-species-rejects`.
				expect(error).toEqual(jasmine.any(RangeError));

				if (error) {
					errors.push(error);
				}
			}

			const combinedMessage = errors.map((error) => error.message).join(' ');

			for (const messagePart of expectation.expectedError.messageIncludes) {
				// Reason: the combined invalid-species row covers spectral shape errors for named species.
				// Source: view-optical-depth-hardening expectedError derivation for selected-model species.
				expect(combinedMessage)
					.withContext(`${expectation.id} combined message includes ${messagePart}`)
					.toContain(messagePart);
			}
		});

		it('matches the convergence-study sample-count fixture for the selected reference profile', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.convergence.sample-count-selected-profile',
			);

			expectFixtureExpectedErrorGate(expectation);
		});

		it('rejects max-sample-count fixtures that are chosen without convergence evidence', function() {
			const expectation = getViewOpticalDepthHardeningExpectation(
				'view-transmittance.convergence.unsourced-max-sample-count-rejects',
			);

			expectFixtureExpectedErrorGate(expectation);
		});

	});
});
