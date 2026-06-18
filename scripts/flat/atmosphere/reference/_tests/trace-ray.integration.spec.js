import {
	canonicalStageIds,
	createModelBundle,
	createReferenceIntegrator,
} from './test-pipeline-stages.js';

describe('atmosphere reference traceRay integration', function() {
	function createTraceRequest({
		model = createControlledTraceModel(),
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

	function createControlledTraceModel({
		atmosphereEndKm = 2,
		coefficients = {
			extinctionByWavelength: [0],
			scatteringByWavelength: [0],
			absorptionByWavelength: [0],
		},
		species = [],
		sourceSamples = [],
		sourcePathSamples = [],
		surfaceHit = null,
		surfaceRadianceAt = () => [0],
	} = {}) {
		// Reason: integration fixtures should prove stage composition against model-owned behavior.
		// Source: Reference Code Design, Model Interface and Stage Boundary Ownership.
		const model = createModelBundle();

		model.atmosphere.intersect = () => ({
			tMinKm: 0,
			tMaxKm: atmosphereEndKm,
			boundaryReason: 'controlled-atmosphere-exit',
			boundaryId: 'controlled-atmosphere-top',
		});
		model.world.intersectSurface = () => surfaceHit;
		model.world.surfaceNormalAt = () => surfaceHit?.normal ?? [0, 1, 0];
		model.atmosphere.mediumAt = () => (
			species.length > 0
				? { species }
				: { coefficients }
		);
		model.solarSource.samplesAt = () => sourceSamples;
		model.solarSource.transmittanceSegment = () => ({
			visible: true,
			boundaryReason: 'controlled-visible-source-path',
			samples: sourcePathSamples,
		});
		model.surface.radianceAt = surfaceRadianceAt;

		return model;
	}

	function createSourceSample({
		id = 'controlled-source',
		direction = [0, -1, 0],
		valuesByWavelength = [1],
		kind = 'spectral-radiance',
		weight = 1,
	} = {}) {
		return {
			id,
			direction,
			weight,
			solidAngleSr: 1,
			sourceSpectrum: {
				kind,
				valuesByWavelength,
				units: 'controlled fixture spectral units',
				derivation: 'controlled traceRay integration fixture source spectrum',
			},
		};
	}

	it('returns a black zero-radiance path through vacuum with the canonical stage history', function() {
		const model = createControlledTraceModel({
			atmosphereEndKm: 5,
			coefficients: {
				extinctionByWavelength: [0],
				scatteringByWavelength: [0],
				absorptionByWavelength: [0],
			},
		});

		const result = createReferenceIntegrator().traceRay(createTraceRequest({ model }));

		// Reason: full traceRay orchestration should execute every canonical stage exactly once.
		// Source: Reference Code Design, Canonical Pipeline Stages.
		expect(result.stageHistory).toEqual(canonicalStageIds());
		// Reason: zero extinction over a finite path gives tau = 0 and Beer-Lambert T = 1.
		// Source: PBRT Transmittance; analytic-invariants empty/vacuum transport rows.
		expect(result.viewOpticalDepth.pathEnd).toEqual(jasmine.objectContaining({
			distanceFromObserverKm: 5,
			cumulativeOpticalDepthByWavelength: [0],
			viewTransmittanceByWavelength: [1],
		}));
		// Reason: no source samples and no surface hit leave both radiance components at zero.
		// Source: Stage Contracts, integrateSingleScattering and resolveSurfaceRadiance no-contribution shapes.
		expect(result.singleScattering.inScatteredRadianceByWavelength).toEqual([0]);
		expect(result.surfaceRadiance.viewAttenuatedRadianceByWavelength).toEqual([0]);
		// Reason: composeSpectralRadiance sums the two zero components without display conversion or clamping.
		// Source: Stage Contracts, composeSpectralRadiance ownership.
		expect(result.spectralRadiance).toEqual(jasmine.objectContaining({
			wavelengthsNm: [550],
			finalByWavelength: [0],
			metadata: { clamped: false, colorConverted: false },
		}));
	});

	it('matches a one-sample homogeneous isotropic sky-scattering known answer', function() {
		const sourceRadiance = 4;
		const extinctionPerKm = 0.1;
		const scatteringPerKm = 0.1;
		const pathLengthKm = 2;
		const model = createControlledTraceModel({
			atmosphereEndKm: pathLengthKm,
			species: [{
				name: 'rayleigh',
				extinctionByWavelength: [extinctionPerKm],
				scatteringByWavelength: [scatteringPerKm],
				absorptionByWavelength: [0],
				phase: { kind: 'isotropic' },
			}],
			sourceSamples: [
				createSourceSample({
					direction: [0, -1, 0],
					valuesByWavelength: [sourceRadiance],
				}),
			],
		});

		const result = createReferenceIntegrator().traceRay(createTraceRequest({ model }));
		const expectedViewTransmittance = Math.exp(-extinctionPerKm * pathLengthKm);
		const expectedSingleScattering =
			expectedViewTransmittance
			* scatteringPerKm
			* (1 / (4 * Math.PI))
			* sourceRadiance
			* pathLengthKm;

		// Reason: midpoint sampling with one 2 km homogeneous sample gives tau = sigma_t * ds.
		// Source: PBRT Transmittance and midpoint-rule analytic fixture policy.
		expect(result.viewOpticalDepth.pathEnd.cumulativeOpticalDepthByWavelength[0])
			.toBeCloseTo(0.2, 12);
		expect(result.viewOpticalDepth.pathEnd.viewTransmittanceByWavelength[0])
			.toBeCloseTo(expectedViewTransmittance, 12);
		// Reason: with a visible unattenuated source, one sample contributes T_view * sigma_s * phase * L_source * ds.
		// Source: PBRT Volume Scattering Processes; analytic-invariants single-scattering one-sample scalar product.
		expect(result.singleScattering.components.bySpecies.rayleigh.radianceByWavelength[0])
			.toBeCloseTo(expectedSingleScattering, 12);
		expect(result.singleScattering.inScatteredRadianceByWavelength[0])
			.toBeCloseTo(expectedSingleScattering, 12);
		// Reason: no selected surface leaves final radiance equal to the in-scattered component.
		// Source: Stage Contracts, resolveSurfaceRadiance no-hit output and composeSpectralRadiance component sum.
		expect(result.surfaceRadiance.viewAttenuatedRadianceByWavelength).toEqual([0]);
		expect(result.spectralRadiance.finalByWavelength[0])
			.toBeCloseTo(expectedSingleScattering, 12);
	});

	it('matches a Lambertian surface path attenuated by the view atmosphere', function() {
		const extinctionPerKm = 0.1;
		const surfaceDistanceKm = 2;
		const surfaceHit = {
			tKm: surfaceDistanceKm,
			positionKm: [0, surfaceDistanceKm, 0],
			normal: [0, 1, 0],
			boundaryReason: 'controlled-surface',
		};
		const model = createControlledTraceModel({
			atmosphereEndKm: 10,
			surfaceHit,
			species: [{
				name: 'rayleigh',
				extinctionByWavelength: [extinctionPerKm],
				scatteringByWavelength: [0],
				absorptionByWavelength: [extinctionPerKm],
			}],
			sourceSamples: [
				createSourceSample({
					direction: [0, 1, 0],
					kind: 'spectral-irradiance',
					valuesByWavelength: [Math.PI],
				}),
			],
			surfaceRadianceAt(hit, wavelengthNm, lighting) {
				return lighting.directIrradianceByWavelength.map((irradiance) => {
					return irradiance * lighting.directCosTheta / Math.PI;
				});
			},
		});

		const result = createReferenceIntegrator().traceRay(createTraceRequest({ model }));
		const expectedViewTransmittance = Math.exp(-extinctionPerKm * surfaceDistanceKm);

		// Reason: resolveRayPath clips the atmosphere segment to the nearer visible surface hit.
		// Source: Reference Code Design, resolveRayPath boundary precedence.
		expect(result.rayPath.viewSegment).toEqual({
			startKm: 0,
			endKm: surfaceDistanceKm,
			lengthKm: surfaceDistanceKm,
		});
		// Reason: the selected surface point receives the same source-sample handoff shape as medium samples.
		// Source: Stage Contracts, integrateSolarTransmittance surfacePoint ownership.
		expect(result.solarTransmittance.metadata).toEqual({
			sampleCount: 1,
			sourceSampleCount: 2,
			includesSurfacePoint: true,
		});
		// Reason: direct Lambertian reflection is L = E * max(n dot wi, 0) / pi; E = pi and cosTheta = 1.
		// Source: PBRT Diffuse Reflection; analytic-invariants Lambertian rows.
		expect(result.surfaceRadiance.surfaceLeavingRadianceByWavelength[0])
			.toBeCloseTo(1, 12);
		// Reason: the surface component is attenuated by Beer-Lambert view transmittance over the clipped 2 km path.
		// Source: PBRT Transmittance; Stage Contracts, resolveSurfaceRadiance view attenuation.
		expect(result.surfaceRadiance.viewAttenuatedRadianceByWavelength[0])
			.toBeCloseTo(expectedViewTransmittance, 12);
		// Reason: zero scattering coefficient leaves final radiance equal to the attenuated surface component.
		// Source: Stage Contracts, integrateSingleScattering and composeSpectralRadiance ownership.
		expect(result.singleScattering.inScatteredRadianceByWavelength).toEqual([0]);
		expect(result.spectralRadiance.finalByWavelength[0])
			.toBeCloseTo(expectedViewTransmittance, 12);
	});
});
