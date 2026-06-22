import {
	createModelBundle,
	createReferenceIntegrator,
} from './test-pipeline-stages.js';

describe('atmosphere reference pipeline handoffs', function() {
	function createOneSampleRequest({
		model = createModelBundle(),
		wavelengthsNm = [550],
		rayDirection = [0, 1, 0],
	} = {}) {
		return {
			model,
			observer: { positionKm: [0, 0, 0] },
			ray: { direction: rayDirection },
			wavelengthsNm,
			numerical: { viewSteps: 1, sunTransmittanceSteps: 1 },
		};
	}

	function createFiniteAtmosphereModel({
		extinctionByWavelength = [0],
		scatteringByWavelength = [0],
		absorptionByWavelength = [0],
		phase = { kind: 'isotropic' },
		sourceSpectrumByWavelength = [1],
		sourceDirection = [0, -1, 0],
		sourceTransmittanceExtinctionByWavelength = [],
		sourcePathWeightKm = 0,
		surfaceHit = null,
		surfaceRadianceAt,
	} = {}) {
		const model = createModelBundle();

		model.atmosphere.intersect = () => ({
			tMinKm: 0,
			tMaxKm: 10,
			boundaryReason: 'atmosphere-exit',
			boundaryId: 'test-atmosphere-top',
		});
		model.world.intersectSurface = () => surfaceHit;
		model.world.surfaceNormalAt = () => surfaceHit?.normal ?? [0, 1, 0];
		model.atmosphere.mediumAt = () => ({
			species: [
				{
					name: 'rayleigh',
					extinctionByWavelength,
					scatteringByWavelength,
					absorptionByWavelength,
					phase,
				},
			],
		});
		model.solarSource.samplesAt = () => [{
			id: 'handoff-sun',
			direction: sourceDirection,
			weight: 1,
			solidAngleSr: 1,
			sourceSpectrum: {
				kind: 'spectral-irradiance',
				valuesByWavelength: sourceSpectrumByWavelength,
				units: 'test W m-2 nm-1',
				derivation: 'controlled handoff fixture source spectrum',
			},
		}];
		model.solarSource.transmittanceSegment = () => ({
			visible: true,
			boundaryReason: 'handoff-source-path',
			samples: sourcePathWeightKm > 0
				? [{
					weightKm: sourcePathWeightKm,
					extinctionByWavelength: sourceTransmittanceExtinctionByWavelength,
				}]
				: [],
		});
		model.surface.radianceAt = surfaceRadianceAt ?? (() => sourceSpectrumByWavelength.map(() => 0));

		return model;
	}

	it('keeps sampleViewPath, evaluateMedium, and integrateViewOpticalDepth aligned', function() {
		const model = createModelBundle();
		model.atmosphere.intersect = () => ({
			tMinKm: 0,
			tMaxKm: 10,
			boundaryReason: 'atmosphere-exit',
			boundaryId: 'test-atmosphere-top',
		});
		model.atmosphere.mediumAt = () => ({
			species: [
				{
					name: 'rayleigh',
					extinctionByWavelength: [0.1],
					scatteringByWavelength: [0.1],
					absorptionByWavelength: [0],
				},
				{
					name: 'mie',
					extinctionByWavelength: [0.2],
					scatteringByWavelength: [0.16],
					absorptionByWavelength: [0.04],
				},
			],
		});

		const result = createReferenceIntegrator().runUntil(
			'integrateViewOpticalDepth',
			createOneSampleRequest({ model }),
		);

		// Reason: sampleViewPath owns finite midpoint distance and interval fields consumed by evaluateMedium.
		// Source: Reference Test Plan integration-test contract; midpoint row expects a 10 km path center at 5 km.
		expect(result.viewSamples[0]).toEqual(jasmine.objectContaining({
			distanceFromObserverKm: 5,
			intervalStartKm: 0,
			intervalEndKm: 10,
			weightKm: 10,
		}));
		// Reason: evaluateMedium must preserve named species diagnostics for integrateViewOpticalDepth species totals.
		// Source: Stage Contracts, evaluateMedium -> integrateViewOpticalDepth handoff.
		expect(result.mediumSamples[0].species).toEqual([
			jasmine.objectContaining({ name: 'rayleigh' }),
			jasmine.objectContaining({ name: 'mie' }),
		]);
		// Reason: integrateViewOpticalDepth path-end diagnostics use the final interval endpoint from upstream samples.
		// Source: Stage Contracts, integrateViewOpticalDepth pathEnd shape.
		expect(result.viewOpticalDepth.pathEnd.distanceFromObserverKm).toBe(10);
		// Reason: species optical depth is tau = sigma_t * ds for each named species.
		// Source: PBRT Transmittance; rayleigh tau 0.1/km * 10 km = 1, mie tau 0.2/km * 10 km = 2.
		expect(result.viewOpticalDepth.pathEnd.speciesOpticalDepth.rayleigh)
			.toEqual({ cumulativeOpticalDepthByWavelength: [1] });
		expect(result.viewOpticalDepth.pathEnd.speciesOpticalDepth.mie)
			.toEqual({ cumulativeOpticalDepthByWavelength: [2] });
		// Reason: total optical depth is the wavelength-wise sum of named species extinction.
		// Source: PBRT Volume Scattering Processes and Transmittance; total tau = 3.
		expect(result.viewOpticalDepth.pathEnd.cumulativeOpticalDepthByWavelength[0])
			.toBeCloseTo(3, 12);
		// Reason: view transmittance is Beer-Lambert T = exp(-tau).
		// Source: PBRT Transmittance.
		expect(result.viewOpticalDepth.pathEnd.viewTransmittanceByWavelength[0])
			.toBeCloseTo(Math.exp(-3), 12);
	});

	it('keeps integrateSolarTransmittance and evaluateScatteringPhase source data aligned', function() {
		const model = createFiniteAtmosphereModel({
			extinctionByWavelength: [0],
			scatteringByWavelength: [0.25],
			absorptionByWavelength: [0],
			sourceSpectrumByWavelength: [4],
			sourceDirection: [0, -1, 0],
		});

		const result = createReferenceIntegrator().runUntil(
			'evaluateScatteringPhase',
			createOneSampleRequest({ model }),
		);
		const sourceSample = result.solarTransmittance.samples[0].sourceSamples[0];
		const phaseSample = result.scatteringPhase.samples[0].sourceSamples[0];

		// Reason: integrateSolarTransmittance preserves source id, direction, spectrum, and visibility for phase and scattering consumers.
		// Source: Stage Contracts, integrateSolarTransmittance downstream use.
		expect(sourceSample).toEqual(jasmine.objectContaining({
			sourceSampleId: 'handoff-sun',
			direction: [0, -1, 0],
			visible: true,
			sourceTransmittanceByWavelength: [1],
		}));
		expect(sourceSample.sourceSpectrum.valuesByWavelength).toEqual([4]);
		// Reason: evaluateScatteringPhase consumes the preserved source direction and the validated camera ray convention.
		// Source: Stage Contracts, evaluateScatteringPhase cosine convention.
		expect(phaseSample).toEqual(jasmine.objectContaining({
			sourceSampleId: 'handoff-sun',
			cosTheta: 1,
			scatteringAngleRad: 0,
		}));
		// Reason: isotropic phase is the normalized constant 1/(4*pi), independent of the source angle.
		// Source: analytic-invariants row phase.isotropic.constant-over-solid-angle.
		expect(phaseSample.species[0].phaseByWavelength[0])
			.toBeCloseTo(1 / (4 * Math.PI), 12);
	});

	it('keeps scattering, surface, and spectral composition components aligned', function() {
		const surfaceHit = {
			tKm: 2,
			positionKm: [0, 2, 0],
			normal: [0, 1, 0],
			boundaryReason: 'test-surface',
		};
		const model = createFiniteAtmosphereModel({
			extinctionByWavelength: [0.1],
			scatteringByWavelength: [0],
			absorptionByWavelength: [0.1],
			sourceSpectrumByWavelength: [Math.PI],
			sourceDirection: [0, 1, 0],
			surfaceHit,
			surfaceRadianceAt(hit, wavelengthNm, lighting) {
				return lighting.directIrradianceByWavelength.map((irradiance) => {
					return irradiance * lighting.directCosTheta / Math.PI;
				});
			},
		});

		const result = createReferenceIntegrator().traceRay(createOneSampleRequest({ model }));
		const expectedViewTransmittance = Math.exp(-0.2);

		// Reason: integrateSingleScattering should hand zero in-scattered component to composeSpectralRadiance when no phase species scatter.
		// Source: Stage Contracts, integrateSingleScattering empty/source-species contribution shape.
		expect(result.singleScattering.inScatteredRadianceByWavelength).toEqual([0]);
		// Reason: resolveSurfaceRadiance consumes surfacePoint source transmittance and Lambertian model radiance, then applies view attenuation.
		// Source: PBRT Diffuse Reflection; surface leaving L = pi * 1 / pi = 1 and view T = exp(-0.1/km * 2 km).
		expect(result.surfaceRadiance.surfaceLeavingRadianceByWavelength[0])
			.toBeCloseTo(1, 12);
		expect(result.surfaceRadiance.viewAttenuatedRadianceByWavelength[0])
			.toBeCloseTo(expectedViewTransmittance, 12);
		// Reason: composeSpectralRadiance sums in-scattered and view-attenuated surface components wavelength by wavelength.
		// Source: Stage Contracts, composeSpectralRadiance ownership.
		expect(result.spectralRadiance.components).toEqual(jasmine.objectContaining({
			inScatteredRadianceByWavelength: [0],
			surfaceViewAttenuatedRadianceByWavelength: [result.surfaceRadiance.viewAttenuatedRadianceByWavelength[0]],
		}));
		expect(result.spectralRadiance.finalByWavelength[0])
			.toBeCloseTo(expectedViewTransmittance, 12);
	});
});
