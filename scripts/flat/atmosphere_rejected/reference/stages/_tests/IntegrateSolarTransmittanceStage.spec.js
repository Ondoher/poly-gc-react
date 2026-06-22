import {
	createModelBundle,
	createReferenceIntegrator,
	expectStageDescriptor,
	expectStagePrerequisiteFailure,
} from '../../_tests/test-pipeline-stages.js';
import {
	getExpectedDatum,
	getSolarTransmittanceContractExpectation,
	getToleranceRule,
	expectValueToMatchTolerance,
} from '../../_tests/test-expectations.js';

describe('atmosphere reference pipeline stage integrateSolarTransmittance', function() {
	function runIntegrateSolarTransmittance(packet) {
		return createReferenceIntegrator().runStage('integrateSolarTransmittance', {
			stageHistory: [],
			...packet,
		});
	}

	function createSolarPacket(expectation) {
		const wavelengthsNm = resolveFixtureWavelengths(expectation.inputs);
		const model = createSolarFixtureModel(expectation, wavelengthsNm);

		return {
			validatedRequest: {
				model,
				observer: { positionKm: [0, 0, 0] },
				ray: { direction: [0, 1, 0] },
				wavelengthsNm,
				numerical: { sunTransmittanceSteps: 1 },
			},
			mediumSamples: expectation.inputs.mediumSamples.map((sample) => ({
				...sample,
				coefficients: {
					extinctionByWavelength: wavelengthsNm.map(() => 0),
					scatteringByWavelength: wavelengthsNm.map(() => 0),
					absorptionByWavelength: wavelengthsNm.map(() => 0),
					derivation: 'test-fixture',
				},
			})),
			rayPath: materializeFixtureValue(
				expectation.inputs.rayPath ?? {
					isEmpty: true,
					viewSegment: { startKm: 0, endKm: 0, lengthKm: 0 },
					surfaceHit: null,
				},
			),
		};
	}

	function createSolarFixtureModel(expectation, wavelengthsNm) {
		const model = createModelBundle();
		let sampleCallIndex = 0;
		const mediumSampleCount = expectation.inputs.mediumSamples.length;

		model.solarSource.samplesAt = (positionKm, wavelengthNm, numerical) => {
			const sourceSamples = sampleCallIndex < mediumSampleCount
				? expectation.inputs.sourceSamplesByMediumSample[sampleCallIndex] ?? []
				: expectation.inputs.sourceSamplesBySurfacePoint ?? [];
			sampleCallIndex += 1;

			// Reason: solarSource.samplesAt is model-owned; this adapter exposes fixture rows
			// without computing geometry inside the stage test.
			// Source: Reference Code Design, Model Interface.
			expect(positionKm).toEqual(jasmine.any(Array));
			expect(wavelengthNm).toBeUndefined();
			expect(numerical).toEqual(jasmine.objectContaining({ sunTransmittanceSteps: 1 }));

			return sourceSamples.map((sourceSample) => materializeSourceSample(sourceSample, wavelengthsNm));
		};

		model.solarSource.transmittanceSegment = (positionKm, sourceSample, query) => {
			// Reason: the first solar-transmittance batch consumes model-owned source-path
			// segments rather than testing source ray geometry here.
			// Source: Reference Code Design, solarSource.transmittanceSegment.
			expect(positionKm).toEqual(jasmine.any(Array));
			expect(query.wavelengthsNm).toEqual(wavelengthsNm);
			expect(Boolean(query.mediumSample || query.surfacePoint)).toBeTrue();

			return sourceSample.segment;
		};

		return model;
	}

	function materializeSourceSample(sourceSample, wavelengthsNm) {
		return {
			...sourceSample,
			sourceSpectrum: materializeSourceSpectrum(sourceSample.sourceSpectrum, wavelengthsNm),
			segment: {
				...sourceSample.segment,
				samples: (sourceSample.segment?.samples ?? []).map((segmentSample) => {
					return {
						...segmentSample,
						weightKm: materializeNumber(segmentSample.weightKm),
						extinctionByWavelength: materializeExtinctionArray(
							segmentSample.extinctionByWavelength,
							wavelengthsNm,
						),
					};
				}),
			},
		};
	}

	function materializeSourceSpectrum(sourceSpectrum, wavelengthsNm) {
		return {
			...sourceSpectrum,
			valuesByWavelength: materializeSpectrumValues(
				sourceSpectrum?.valuesByWavelength,
				wavelengthsNm,
			),
		};
	}

	function materializeSpectrumValues(value, wavelengthsNm) {
		if (value?.fixtureArray === 'ones') {
			return Array.from({ length: value.count }, () => 1);
		}

		return value ?? wavelengthsNm.map(() => 1);
	}

	function materializeExtinctionArray(value, wavelengthsNm) {
		if (value?.fixtureArray === 'zeros') {
			return Array.from({ length: value.count }, () => 0);
		}

		return value ?? wavelengthsNm.map(() => 0);
	}

	function materializeNumber(value) {
		if (value?.encodedNonFinite === 'Infinity') {
			return Infinity;
		}

		return value;
	}

	function materializeFixtureValue(value) {
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

	function resolveFixtureWavelengths(inputs) {
		if (inputs.wavelengthsNm) {
			return inputs.wavelengthsNm;
		}

		const { startNm, endNm, stepNm } = inputs.wavelengthGrid;
		return Array.from(
			{ length: Math.round((endNm - startNm) / stepNm) + 1 },
			(_, index) => startNm + index * stepNm,
		);
	}

	function firstSourceResult(result) {
		const sourceResult = result.solarTransmittance?.samples?.[0]?.sourceSamples?.[0];

		// Reason: source-path diagnostics are emitted per medium sample and source sample.
		// Source: Reference Code Design, integrateSolarTransmittance output contract.
		expect(sourceResult).toEqual(jasmine.any(Object));
		return sourceResult ?? {};
	}

	function expectFixtureValue(actualValue, expectation, quantityKey) {
		const expectedDatum = getExpectedDatum(expectation, quantityKey);
		const tolerance = getToleranceRule(expectation, quantityKey);

		if (tolerance.mode === 'exact') {
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

	function expectExpectedError(run, expectation) {
		const errorCtor = expectation.expectedError.type === 'RangeError' ? RangeError : Error;
		let caughtError;

		try {
			run();
		} catch (error) {
			caughtError = error;
		}

		// Reason: expected-error fixtures pin both error class and searchable context.
		// Source: Reference Test Design, Expected Value Policy.
		expect(caughtError).toEqual(jasmine.any(errorCtor));

		if (!caughtError) {
			return;
		}

		for (const messagePart of expectation.expectedError.messageIncludes) {
			// Reason: error-contract rows require searchable message context for invalid source-path data.
			// Source: solar-transmittance-contracts expectedError derivation fields.
			expect(caughtError.message)
				.withContext(`${expectation.id} message includes ${messagePart}`)
				.toContain(messagePart);
		}
	}

	it('declares its stage contract', function() {
		expectStageDescriptor('integrateSolarTransmittance');
	});

	it('runs exactly one stage against a prepared packet', function() {
		const expectation = getSolarTransmittanceContractExpectation(
			'solar-transmittance.empty-medium-samples.no-output',
		);
		const packet = createSolarPacket(expectation);

		const result = runIntegrateSolarTransmittance(packet);

		// Reason: direct stage runs must append only their own stage id and avoid mutating input.
		// Source: Reference Code Design, Public API Shape; stages are independently runnable packet transforms.
		expect(result).not.toBe(packet);
		expect(result.stageHistory).toEqual(['integrateSolarTransmittance']);
		expect(packet.solarTransmittance).toBeUndefined();
	});

	it('fails loudly when prerequisites are missing', function() {
		expectStagePrerequisiteFailure('integrateSolarTransmittance');
	});

	it('returns no source-transmittance samples for empty medium samples', function() {
		const expectation = getSolarTransmittanceContractExpectation(
			'solar-transmittance.empty-medium-samples.no-output',
		);
		const result = runIntegrateSolarTransmittance(createSolarPacket(expectation));

		expectFixtureValue(
			result.solarTransmittance.samples.length,
			expectation,
			'sampleCount',
		);
		expectFixtureValue(
			result.solarTransmittance.metadata.includesSurfacePoint,
			expectation,
			'includesSurfacePoint',
		);
	});

	it('returns unit source transmittance for a visible vacuum source segment', function() {
		const expectation = getSolarTransmittanceContractExpectation(
			'solar-transmittance.vacuum.directional-unity',
		);
		const result = runIntegrateSolarTransmittance(createSolarPacket(expectation));
		const sourceResult = firstSourceResult(result);

		expectFixtureValue(sourceResult.visible, expectation, 'visible');
		expectFixtureValue(
			sourceResult.opticalDepthByWavelength,
			expectation,
			'opticalDepthByWavelength',
		);
		expectFixtureValue(
			sourceResult.sourceTransmittanceByWavelength,
			expectation,
			'sourceTransmittanceByWavelength',
		);
	});

	it('matches homogeneous Beer-Lambert source transmittance', function() {
		const expectation = getSolarTransmittanceContractExpectation(
			'solar-transmittance.homogeneous.beer-lambert',
		);
		const result = runIntegrateSolarTransmittance(createSolarPacket(expectation));
		const sourceResult = firstSourceResult(result);

		expectFixtureValue(
			sourceResult.opticalDepthByWavelength,
			expectation,
			'opticalDepthByWavelength',
		);
		expectFixtureValue(
			sourceResult.sourceTransmittanceByWavelength,
			expectation,
			'sourceTransmittanceByWavelength',
		);
	});

	it('keeps multi-wavelength source extinction independent per wavelength', function() {
		const expectation = getSolarTransmittanceContractExpectation(
			'solar-transmittance.homogeneous.multi-wavelength',
		);
		const result = runIntegrateSolarTransmittance(createSolarPacket(expectation));
		const sourceResult = firstSourceResult(result);

		expectFixtureValue(
			sourceResult.opticalDepthByWavelength,
			expectation,
			'opticalDepthByWavelength',
		);
		expectFixtureValue(
			sourceResult.sourceTransmittanceByWavelength,
			expectation,
			'sourceTransmittanceByWavelength',
		);
	});

	it('preserves source sample identity, weights, and solid angles', function() {
		const expectation = getSolarTransmittanceContractExpectation(
			'solar-transmittance.source-samples.preserve-metadata',
		);
		const result = runIntegrateSolarTransmittance(createSolarPacket(expectation));
		const sourceSamples = result.solarTransmittance.samples[0].sourceSamples;

		expectFixtureValue(
			sourceSamples.map((sourceSample) => sourceSample.sourceSampleId),
			expectation,
			'sourceSampleIds',
		);
		expectFixtureValue(
			sourceSamples.map((sourceSample) => sourceSample.weight),
			expectation,
			'sourceSampleWeights',
		);
		expectFixtureValue(
			sourceSamples.map((sourceSample) => sourceSample.solidAngleSr),
			expectation,
			'sourceSampleSolidAnglesSr',
		);
		expectFixtureValue(
			sourceSamples.map((sourceSample) => sourceSample.direction),
			expectation,
			'sourceSampleDirections',
		);
		// Reason: source spectra are model-owned source-energy handoff data preserved for radiance stages.
		// Source: solar-transmittance-contracts expected.sourceSpectra derivation fields.
		expect(sourceSamples.map((sourceSample) => sourceSample.sourceSpectrum))
			.toEqual(getExpectedDatum(expectation, 'sourceSpectra').value);
		expectFixtureValue(
			result.solarTransmittance.metadata.sourceSampleCount,
			expectation,
			'sourceSampleCount',
		);
		expectFixtureValue(
			result.solarTransmittance.metadata.includesSurfacePoint,
			expectation,
			'includesSurfacePoint',
		);
	});

	it('sets source transmittance to zero for an occluded source segment', function() {
		const expectation = getSolarTransmittanceContractExpectation(
			'solar-transmittance.visibility.occluded-zero',
		);
		const result = runIntegrateSolarTransmittance(createSolarPacket(expectation));
		const sourceResult = firstSourceResult(result);

		expectFixtureValue(sourceResult.visible, expectation, 'visible');
		expectFixtureValue(
			sourceResult.sourceTransmittanceByWavelength,
			expectation,
			'sourceTransmittanceByWavelength',
		);
		expectFixtureValue(sourceResult.pathLengthKm, expectation, 'pathLengthKm');
		expectFixtureValue(sourceResult.boundaryReason, expectation, 'boundaryReason');
	});

	it('emits source transmittance for the selected surface point', function() {
		const expectation = getSolarTransmittanceContractExpectation(
			'solar-transmittance.surface-point.visible-surface',
		);
		const result = runIntegrateSolarTransmittance(createSolarPacket(expectation));
		const surfacePoint = result.solarTransmittance.surfacePoint;

		// Reason: a selected visible surface hit must produce the optional surfacePoint handoff.
		// Source: Stage Contracts, integrateSolarTransmittance surfacePoint output.
		expect(surfacePoint).toEqual(jasmine.any(Object));
		expectFixtureValue(
			surfacePoint.distanceFromObserverKm,
			expectation,
			'surfacePointDistanceKm',
		);
		expectFixtureValue(
			surfacePoint.positionKm,
			expectation,
			'surfacePointPositionKm',
		);
		expectFixtureValue(
			surfacePoint.sourceSamples.map((sourceSample) => sourceSample.sourceSampleId),
			expectation,
			'surfacePointSourceSampleIds',
		);
		expectFixtureValue(
			surfacePoint.sourceSamples[0].sourceTransmittanceByWavelength,
			expectation,
			'surfacePointSourceTransmittanceByWavelength',
		);
		// Reason: surface-point source spectrum is the same model-owned energy handoff as medium samples.
		// Source: solar-transmittance-contracts expected.surfacePointSourceSpectrum derivation fields.
		expect(surfacePoint.sourceSamples[0].sourceSpectrum)
			.toEqual(getExpectedDatum(expectation, 'surfacePointSourceSpectrum').value);
		expectFixtureValue(
			result.solarTransmittance.metadata.sourceSampleCount,
			expectation,
			'sourceSampleCount',
		);
		expectFixtureValue(
			result.solarTransmittance.metadata.includesSurfacePoint,
			expectation,
			'includesSurfacePoint',
		);
	});

	it('rejects negative source-segment extinction', function() {
		const expectation = getSolarTransmittanceContractExpectation(
			'solar-transmittance.invalid.negative-extinction-rejects',
		);

		expectExpectedError(
			() => runIntegrateSolarTransmittance(createSolarPacket(expectation)),
			expectation,
		);
	});

	it('rejects source-segment extinction arrays that do not align to wavelengthsNm', function() {
		const expectation = getSolarTransmittanceContractExpectation(
			'solar-transmittance.invalid.wavelength-shape-rejects',
		);

		expectExpectedError(
			() => runIntegrateSolarTransmittance(createSolarPacket(expectation)),
			expectation,
		);
	});

	it('rejects non-finite source-segment sample weights', function() {
		const expectation = getSolarTransmittanceContractExpectation(
			'solar-transmittance.invalid.nonfinite-weight-rejects',
		);

		expectExpectedError(
			() => runIntegrateSolarTransmittance(createSolarPacket(expectation)),
			expectation,
		);
	});

	it('accepts the sourced CIE visible grid when source-segment arrays align', function() {
		const expectation = getSolarTransmittanceContractExpectation(
			'solar-transmittance.visible-grid.cie-full-range-aligns',
		);
		const result = runIntegrateSolarTransmittance(createSolarPacket(expectation));
		const wavelengthsNm = resolveFixtureWavelengths(expectation.inputs);
		const sourceResult = firstSourceResult(result);

		expectFixtureValue(
			{
				firstNm: wavelengthsNm[0],
				lastNm: wavelengthsNm[wavelengthsNm.length - 1],
				stepNm: wavelengthsNm[1] - wavelengthsNm[0],
				count: wavelengthsNm.length,
			},
			expectation,
			'gridMetadata',
		);
		expectFixtureValue(
			sourceResult.sourceTransmittanceByWavelength.length,
			expectation,
			'outputWavelengthCount',
		);
	});
});
