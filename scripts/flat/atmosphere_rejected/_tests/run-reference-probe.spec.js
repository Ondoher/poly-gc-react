import fs from 'node:fs';
import {
	buildImageArtifact,
	buildMarkdownReport,
	buildMultipleScatteringImageArtifacts,
	buildPng,
	buildPpm,
	buildSvg,
	formatSummary,
	parseArgs,
	resolveSkyRenderSamplingProfile,
	resolveSkyPatchWavelengthGrid,
	runCli,
	runReferenceProbe,
	skyRenderSamplingProfileIds,
} from '../run-reference-probe.js';

describe('run-reference-probe CLI helpers', function() {
	const cliPixelOutputPath = 'tmp/atmosphere-reference-cli-pixel-test/sky.ppm';
	const FAST_SKY_PATCH_NUMERICAL = Object.freeze({
		viewSteps: 12,
		sunTransmittanceSteps: 2,
	});

	it('parses probe, output, report, image, stage, and format flags', function() {
		const options = parseArgs([
			'--probe',
			'globe.zenith,globe.redMarker',
			'--out',
			'tmp/result.json',
			'--report',
			'tmp/report.md',
			'--image',
			'tmp/report.svg',
			'--stage',
			'composeSpectralRadiance',
			'--format',
			'summary',
			'--progress',
			'--progress-log',
			'tmp/progress.log',
			'--color',
			'preview-cie',
			'--encoding',
			'linear',
			'--tone-map',
			'preserve-hue',
			'--exposure',
			'2.5',
			'--wavelength-grid',
			'benchmark-5nm',
			'--solar-spectrum',
			'astm-g173',
			'--rayleigh-policy',
			'bucholtz-standard-air',
			'--aerosol-policy',
			'clear-continental',
			'--ozone-policy',
			'brion-1998-ozone-295k',
			'--molecular-profile',
			'us-standard-atmosphere-1976-density',
			'--patch-size',
			'88x56',
			'--fov-y-deg',
			'72',
			'--sun-visual',
			'diagnostic',
			'--view-steps',
			'128',
			'--sun-transmittance-steps',
			'32',
			'--external-radiance',
			'tmp/external-radiance.json',
			'--multiple-scattering-reference',
			'sidecar-contract',
		]);

		// Reason: the CLI contract accepts comma-separated probe selections and the initial documented output flags.
		// Source: Reference Code Design, CLI Shape.
		expect(options).toEqual({
			probeIds: ['globe.zenith', 'globe.redMarker'],
			outPath: 'tmp/result.json',
			reportPath: 'tmp/report.md',
			imagePath: 'tmp/report.svg',
			stage: 'composeSpectralRadiance',
			format: 'summary',
			progress: true,
			progressLogPath: 'tmp/progress.log',
			color: 'preview-cie',
			encoding: 'linear',
			toneMap: 'preserve-hue',
			exposure: 2.5,
			wavelengthGrid: 'benchmark-5nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'clear-continental',
			ozonePolicy: 'brion-1998-ozone-295k',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			patchSize: { width: 88, height: 56 },
			fovYDeg: 72,
			sunVisual: 'diagnostic',
			viewSteps: 128,
			sunTransmittanceSteps: 32,
			externalRadiancePath: 'tmp/external-radiance.json',
			multipleScatteringReference: 'sidecar-contract',
			skyPatches: true,
		});
	});

	it('resolves named sky-patch wavelength grids', function() {
		const preview = resolveSkyPatchWavelengthGrid();
		const benchmark = resolveSkyPatchWavelengthGrid('benchmark-5nm');
		const cie = resolveSkyPatchWavelengthGrid('cie-1nm');

		// Reason: named grids make visual comparisons reproducible without raw ad hoc step sizes.
		// Source: Atmosphere Color Plan, spectral-resolution controls.
		expect(preview.metadata).toEqual(jasmine.objectContaining({
			id: 'preview-20nm',
			startNm: 380,
			endNm: 780,
			stepNm: 20,
			count: 21,
		}));
		expect(benchmark.metadata).toEqual(jasmine.objectContaining({
			id: 'benchmark-5nm',
			startNm: 380,
			endNm: 780,
			stepNm: 5,
			count: 81,
		}));
		expect(cie.metadata).toEqual(jasmine.objectContaining({
			id: 'cie-1nm',
			startNm: 360,
			endNm: 830,
			stepNm: 1,
			count: 471,
		}));
		expect(cie.metadata.relationToCieTable).toContain('full official CIE');
	});

	it('resolves named sky-render sampling profiles', function() {
		const profileIds = skyRenderSamplingProfileIds();
		const fastPreview = resolveSkyRenderSamplingProfile('fast-preview');
		const paperComparison = resolveSkyRenderSamplingProfile('paper-comparison');
		const horizonSafe = resolveSkyRenderSamplingProfile('horizon-safe');

		// Reason: Task 2 concluded visible model-comparison movement was sampling-dominated, so sampling must be named evidence metadata.
		// Source: Reference Plan, Output-Impact Task 2 closeout.
		expect(profileIds).toEqual(['fast-preview', 'paper-comparison', 'horizon-safe']);
		expect(fastPreview).toEqual(jasmine.objectContaining({
			id: 'fast-preview',
			viewSteps: 12,
			sunTransmittanceSteps: 2,
			integrationMethod: 'midpoint',
		}));
		expect(fastPreview.evidenceUse).toContain('not sufficient');
		expect(paperComparison).toEqual(jasmine.objectContaining({
			id: 'paper-comparison',
			viewSteps: 96,
			sunTransmittanceSteps: 16,
			integrationMethod: 'midpoint',
		}));
		expect(paperComparison.evidenceUse).toContain('model-output comparison');
		expect(horizonSafe).toEqual(jasmine.objectContaining({
			id: 'horizon-safe',
			viewSteps: 128,
			sunTransmittanceSteps: 32,
			integrationMethod: 'midpoint',
		}));
		expect(() => resolveSkyRenderSamplingProfile('mystery-profile'))
			.toThrowError(/Unknown sampling profile/);
	});

	it('parses explicit solar-source mode controls', function() {
		const finiteDisc = parseArgs([
			'--sky-dome-grid',
			'--solar-source',
			'finite-sun-disc',
			'--finite-sun-samples',
			'5',
		]);
		const directional = parseArgs([
			'--sky-patches',
			'--solar-source',
			'directional-sun',
		]);

		// Reason: finite-source/aureole comparisons must be explicit artifact controls, not hidden adapter choices.
		// Source: Reference Plan, output-impact Task 6 source-mode CLI contract.
		expect(finiteDisc).toEqual(jasmine.objectContaining({
			skyDomeGrid: true,
			solarSource: 'finite-sun-disc',
			finiteSunSamples: 5,
		}));
		expect(directional).toEqual(jasmine.objectContaining({
			skyPatches: true,
			solarSource: 'directional-sun',
		}));
		expect(() => parseArgs(['--sky-dome-grid', '--solar-source', 'mystery-source']))
			.toThrowError(/Unknown solar source mode/);
		expect(() => parseArgs(['--sky-dome-grid', '--finite-sun-samples', '5']))
			.toThrowError(/requires --solar-source finite-sun-disc/);
		expect(() => parseArgs([
			'--sky-dome-grid',
			'--solar-source',
			'directional-sun',
			'--finite-sun-samples',
			'5',
		])).toThrowError(/requires --solar-source finite-sun-disc/);
	});

	it('parses flat light extent scenario flags', function() {
		const options = parseArgs([
			'--light-set',
			'flat.closeSun.horizontalDenseAir,flat.closeSun.shallowUpward',
			'--light-config',
			'scripts/flat/atmosphere_rejected/data/reference/light-extent-scenarios.json',
			'--format',
			'summary',
		]);

		// Reason: the flat/local-Sun diagnostic needs named scenario selection independent from sky-patch rendering.
		// Source: Reference Test Design, flat large-lateral-path checks and post-pipeline diagnostic guidance.
		expect(options).toEqual({
			probeIds: [],
			stage: 'full',
			format: 'summary',
			lightSetIds: ['flat.closeSun.horizontalDenseAir', 'flat.closeSun.shallowUpward'],
			lightConfigPath: 'scripts/flat/atmosphere_rejected/data/reference/light-extent-scenarios.json',
			lightExtent: true,
		});
	});

	it('parses Bruneton-style sky-dome grid flags without selecting sky patches', function() {
		const options = parseArgs([
			'--sky-dome-grid',
			'--dome-size',
			'16',
			'--dome-sample-mask',
			'horizon-ring',
			'--view-steps',
			'4',
			'--sun-transmittance-steps',
			'2',
			'--aerosol-policy',
			'bruneton-2016-kider-fit',
			'--tone-map',
			'exponential',
			'--format',
			'summary',
		]);

		// Reason: model-family comparison renders use fisheye skydome panels, not camera sky patches.
		// Source: Bruneton 2016 Figure 1 comparison artifact workflow.
		expect(options).toEqual({
			probeIds: [],
			stage: 'full',
			format: 'summary',
			skyDomeGrid: true,
			domeSize: 16,
			domeSampleMask: 'horizon-ring',
			viewSteps: 4,
			sunTransmittanceSteps: 2,
			aerosolPolicy: 'bruneton-2016-kider-fit',
			toneMap: 'exponential',
		});
	});

	it('rejects unknown sky-dome sample masks', function() {
		// Reason: perimeter-only diagnostics are a current contract, so mistyped mask ids should fail loudly.
		// Source: Reference Plan, aerosol/Mie perimeter audit follow-up.
		expect(() => parseArgs([
			'--sky-dome-grid',
			'--dome-sample-mask',
			'center-ish',
		])).toThrowError(/Unknown dome sample mask/);
	});

	it('parses named sky-render sampling profile flags', function() {
		const options = parseArgs([
			'--sky-dome-grid',
			'--sampling-profile',
			'paper-comparison',
			'--dome-size',
			'16',
		]);

		// Reason: model-family comparison artifacts should name their sampling profile instead of hiding raw step defaults.
		// Source: Reference Plan, Output-Impact Task 2 closeout.
		expect(options).toEqual({
			probeIds: [],
			stage: 'full',
			format: 'json',
			skyDomeGrid: true,
			samplingProfile: 'paper-comparison',
			domeSize: 16,
		});
	});

	it('parses an explicit aerosol phase policy flag', function() {
		const options = parseArgs([
			'--sky-dome-grid',
			'--aerosol-policy',
			'bruneton-2016-kider-fit',
			'--aerosol-phase-policy',
			'bruneton-2016-cornette-shanks-g070',
		]);

		// Reason: Task 1 comparisons must hold aerosol scalar policy fixed while selecting aerosol phase shape.
		// Source: Reference Plan, Output-Impact Task 1 CLI and metadata contract.
		expect(options).toEqual({
			probeIds: [],
			stage: 'full',
			format: 'json',
			skyDomeGrid: true,
			aerosolPolicy: 'bruneton-2016-kider-fit',
			aerosolPhasePolicy: 'bruneton-2016-cornette-shanks-g070',
		});
	});

	it('parses multiple-scattering target and angular-sampling flags', function() {
		const options = parseArgs([
			'--sky-dome-grid',
			'--multiple-scattering-reference',
			'order-by-order-grid',
			'--multiple-scattering-targets',
			'dome-rings',
			'--multiple-scattering-angular-samples',
			'32',
			'--multiple-scattering-max-order',
			'3',
		]);

		// Reason: dense sidecar evidence should be opt-in CLI state, independent from skydome image resolution.
		// Source: Multiple-Scattering Plan, phase 5 target-grid diagnostics.
		expect(options).toEqual({
			probeIds: [],
			stage: 'full',
			format: 'json',
			skyDomeGrid: true,
			multipleScatteringReference: 'order-by-order-grid',
			multipleScatteringTargets: 'dome-rings',
			multipleScatteringAngularSamples: 32,
			multipleScatteringMaxOrder: 3,
		});
	});

	it('parses an explicit multiple-scattering no-op mode', function() {
		const options = parseArgs([
			'--sky-dome-grid',
			'--multiple-scattering-reference',
			'none',
		]);

		// Reason: model-ingredient ablations need an explicit zero-contribution multiple-scattering lane.
		// Source: Phase 10 model-family audit, no-op isolation requirement.
		expect(options).toEqual({
			probeIds: [],
			stage: 'full',
			format: 'json',
			skyDomeGrid: true,
			multipleScatteringReference: 'none',
		});
	});

	it('parses iterative-field sidecar image directory output', function() {
		const options = parseArgs([
			'--sky-dome-grid',
			'--multiple-scattering-reference',
			'iterative-field-grid',
			'--multiple-scattering-field-interpolation',
			'weighted',
			'--multiple-scattering-image-dir',
			'tmp/sidecar-images',
		]);

		// Reason: image-level sidecar evidence should be exportable without writing huge per-pixel JSON.
		// Source: Multiple-Scattering Plan, phase 6 image-level cached-field comparison.
		expect(options).toEqual({
			probeIds: [],
			stage: 'full',
			format: 'json',
			skyDomeGrid: true,
			multipleScatteringReference: 'iterative-field-grid',
			multipleScatteringFieldInterpolation: 'weighted',
			multipleScatteringImageDir: 'tmp/sidecar-images',
		});
	});

	it('parses iterative-field phase 7 grid controls', function() {
		const options = parseArgs([
			'--sky-dome-grid',
			'--multiple-scattering-reference',
			'iterative-field-grid',
			'--multiple-scattering-field-direction-basis',
			'horizon-sun',
			'--multiple-scattering-field-altitude-grid',
			'lower-atmosphere',
		]);

		// Reason: Phase 7 grid experiments should be explicit CLI state rather than hidden code edits.
		// Source: Multiple-Scattering Plan, recommended Phase 7 horizon-resolved field grid.
		expect(options).toEqual({
			probeIds: [],
			stage: 'full',
			format: 'json',
			skyDomeGrid: true,
			multipleScatteringReference: 'iterative-field-grid',
			multipleScatteringFieldDirectionBasis: 'horizon-sun',
			multipleScatteringFieldAltitudeGrid: 'lower-atmosphere',
		});
	});

	it('runs a built-in controlled probe through the full canonical pipeline', function() {
		const result = runReferenceProbe({
			probeIds: ['globe.zenith'],
			stage: 'full',
		});
		const probe = result.probes[0];

		// Reason: built-in probes are controlled smoke evidence for the public traceRay pipeline.
		// Source: Reference Plan, CLI Contract; canonical stages should run before report generation.
		expect(result.kind).toBe('flat-atmosphere-reference-result');
		expect(result.probeCount).toBe(1);
		expect(probe.summary.stageHistory).toEqual([
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
		expect(probe.summary.finalByWavelength.length).toBe(3);
		expect(probe.summary.finalByWavelength[0]).toBeGreaterThan(probe.summary.finalByWavelength[2]);
		expect(probe.visual.hex).toMatch(/^#[0-9a-f]{6}$/);
	});

	it('writes report-friendly Markdown and SVG strings from a run result', function() {
		const result = runReferenceProbe({
			probeIds: ['globe.zenith', 'globe.redMarker'],
			stage: 'full',
		});
		const markdown = buildMarkdownReport(result, {
			imagePath: 'tmp/reference.svg',
			outPath: 'tmp/reference.json',
			reportPath: 'tmp/report.md',
		});
		const svg = buildSvg(result);

		// Reason: the first visual-evidence script should produce IDE-readable Markdown and a linked SVG artifact.
		// Source: Reference Code Design, Human-Facing Reports.
		expect(markdown).toContain('# Atmosphere Reference Visual Evidence');
		expect(markdown).toContain('![Visual probe summary](reference.svg)');
		expect(markdown).toContain('globe.redMarker');
		expect(svg).toContain('<svg');
		expect(svg).toContain('globe.zenith');
	});

	it('builds a sky-patch PPM artifact through the post-pipeline pixel bridge', function() {
		const result = runReferenceProbe({
			...FAST_SKY_PATCH_NUMERICAL,
			skyPatches: true,
			patchIds: ['midday.zenith'],
			stage: 'full',
			encoding: 'linear',
			exposure: 2,
			wavelengthGrid: 'benchmark-5nm',
		});
		const patch = result.skyPatches[0];
		const ppm = buildPpm(result);
		const png = buildPng(result);

		// Reason: --image .ppm should exercise the pixel bridge, not the legacy SVG cell path.
		// Source: Atmosphere Reset Design, pixel artifact generation post-pipeline consumer.
		expect(result.visual.colorPolicy).toBe('official-cie');
		expect(result.visual.encoding).toBe('linear');
		expect(result.visual.toneMap).toBe('clip');
		expect(result.visual.exposure).toBe(2);
		expect(result.visual.solarSpectrum.policy).toBe('blackbody-5778k');
		expect(result.visual.rayleighPolicy.id).toBe('rayleigh-lambda4-preview');
		expect(result.visual.aerosolPolicy.id).toBe('preview-earthlike-aerosol');
		expect(result.visual.ozonePolicy.id).toBe('preview-chappuis');
		expect(result.visual.molecularProfile.id).toBe('preview-exponential-8km');
		expect(result.visual.wavelengthGrid.id).toBe('benchmark-5nm');
		expect(result.visual.wavelengthGrid.count).toBe(81);
		expect(patch.colorPolicy).toBe('official-cie');
		expect(patch.solarSpectrum.policy).toBe('blackbody-5778k');
		expect(patch.rayleighPolicy.id).toBe('rayleigh-lambda4-preview');
		expect(patch.aerosolPolicy.id).toBe('preview-earthlike-aerosol');
		expect(patch.ozonePolicy.id).toBe('preview-chappuis');
		expect(patch.molecularProfile.id).toBe('preview-exponential-8km');
		expect(patch.displayEncoding).toBe('linear');
		expect(patch.toneMap).toBe('clip');
		expect(patch.wavelengthsNm.length).toBe(81);
		expect(patch.wavelengthGrid.id).toBe('benchmark-5nm');
		expect(patch.numerical).toEqual(jasmine.objectContaining({
			viewSteps: 12,
			sunTransmittanceSteps: 2,
			integrationMethod: 'midpoint',
			samplingProfile: jasmine.objectContaining({
				id: 'custom-explicit',
				viewSteps: 12,
				sunTransmittanceSteps: 2,
			}),
		}));
		expect(patch.pixelImage.kind).toBe('atmosphere-color-pixel-image');
		expect(patch.pixelImage.width).toBe(patch.size.width);
		expect(patch.pixelImage.height).toBe(patch.size.height);
		expect(patch.pixelImage.pixels[0].kind).toBe('atmosphere-color-pixel');
		expect(patch.pixelImage.metadata.colorProvenance.colorPolicy).toBe('official-cie');
		expect(patch.diagnosticSamples[0].speciesOpticalDepth.rayleigh).toBeDefined();
		expect(patch.diagnosticSamples[0].speciesOpticalDepth.mie).toBeDefined();
		expect(patch.diagnosticSamples[0].speciesOpticalDepth.ozone).toBeDefined();
		expect(ppm).toContain('P3');
		expect(ppm).toContain(`${patch.size.width} ${patch.size.height}`);
		expect(ppm).toContain('# atmosphere-color pixels encoding=linear exposure=per-patch toneMap=clip');
		expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
		expect(buildImageArtifact(result, 'tmp/sky.ppm')).toBe(ppm);
		expect(Buffer.isBuffer(buildImageArtifact(result, 'tmp/sky.png'))).toBeTrue();
		expect(buildImageArtifact(result, 'tmp/sky.svg')).toContain('<svg');
	});

	it('records named sampling profile metadata on sky-patch artifacts', function() {
		const result = runReferenceProbe({
			skyPatches: true,
			samplingProfile: 'fast-preview',
			patchIds: ['midday.zenith'],
			patchSize: { width: 1, height: 1 },
			wavelengthGrid: 'preview-20nm',
		});
		const patch = result.skyPatches[0];
		const markdown = buildMarkdownReport(result);
		const summary = formatSummary(result);

		// Reason: fast previews are still useful, but the artifact must say they are preview sampling rather than model-comparison evidence.
		// Source: Reference Plan, Output-Impact Task 2 closeout.
		expect(result.visual.numerical.samplingProfile).toEqual(jasmine.objectContaining({
			id: 'fast-preview',
			viewSteps: 12,
			sunTransmittanceSteps: 2,
		}));
		expect(result.visual.numerical.viewSteps).toBe(12);
		expect(result.visual.numerical.sunTransmittanceSteps).toBe(2);
		expect(patch.numerical.samplingProfile).toEqual(jasmine.objectContaining({
			id: 'fast-preview',
			viewSteps: 12,
			sunTransmittanceSteps: 2,
		}));
		expect(patch.numerical.viewSteps).toBe(12);
		expect(patch.numerical.sunTransmittanceSteps).toBe(2);
		expect(markdown).toContain('Sampling profile: `fast-preview`');
		expect(markdown).toContain('not sufficient');
		expect(summary).toContain('sampling=fast-preview');
	});

	it('can render a Bruneton-style fisheye sky-dome comparison grid', function() {
		const result = runReferenceProbe({
			skyDomeGrid: true,
			domeSize: 8,
			viewSteps: 1,
			sunTransmittanceSteps: 1,
			wavelengthGrid: 'preview-20nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'bruneton-2016-kider-fit',
			ozonePolicy: 'brion-1998-ozone-295k',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'exponential',
		});
		const firstPanel = result.skyDomePanels[0];
		const markdown = buildMarkdownReport(result, {
			imagePath: 'tmp/skydome.png',
			outPath: 'tmp/skydome.json',
			reportPath: 'tmp/skydome.md',
		});
		const svg = buildSvg(result);
		const ppm = buildPpm(result);
		const png = buildPng(result);

		// Reason: our comparison column should match the paper's four listed time rows with explicit provenance.
		// Source: Bruneton 2016 Figure 1 rows: 06h00/87 deg, 10h15/41 deg, 11h15/31 deg, 13h15/21 deg.
		expect(result.kind).toBe('flat-atmosphere-reference-sky-dome-grid');
		expect(result.sourceComparison.id).toBe('bruneton-2016-clear-sky-models-figure-1');
		expect(result.visual.projection.id).toBe('azimuthal-equidistant-upper-hemisphere');
		expect(result.visual.projection.orientation).toContain('paper-clockwise');
		expect(result.visual.aerosolPolicy.id).toBe('bruneton-2016-kider-fit');
		expect(result.visual.aerosolPhasePolicy).toEqual(jasmine.objectContaining({
			id: 'bruneton-2016-cornette-shanks-g070',
			kind: 'cornette-shanks',
			parameters: { g: 0.7 },
		}));
		expect(result.visual.toneMap).toBe('exponential');
		expect(result.baselineFreeze).toEqual(jasmine.objectContaining({
			id: 'single-scattering-baseline-2026-06',
			mode: 'sky-dome-grid',
			status: 'frozen-current-single-scattering-baseline',
		}));
		expect(result.skyDomePanels.map((panel) => panel.label)).toEqual([
			'06h00 / 87 deg',
			'10h15 / 41 deg',
			'11h15 / 31 deg',
			'13h15 / 21 deg',
		]);
		expect(firstPanel.size).toEqual({ width: 8, height: 8 });
		expect(firstPanel.sunZenithDeg).toBe(87);
		expect(firstPanel.aerosolPhasePolicy).toEqual(jasmine.objectContaining({
			id: 'bruneton-2016-cornette-shanks-g070',
			kind: 'cornette-shanks',
		}));
		expect(firstPanel.numerical).toEqual(jasmine.objectContaining({
			viewSteps: 1,
			sunTransmittanceSteps: 1,
			integrationMethod: 'midpoint',
			samplingProfile: jasmine.objectContaining({
				id: 'custom-explicit',
				viewSteps: 1,
				sunTransmittanceSteps: 1,
			}),
		}));
		expect(firstPanel.pixelImage.kind).toBe('atmosphere-color-pixel-image');
		expect(firstPanel.modelComparisonMetrics.kind).toBe('display-encoded-fisheye-model-comparison-metrics');
		expect(firstPanel.modelComparisonMetrics.domePixelCount).toBeGreaterThan(0);
		expect(firstPanel.modelComparisonMetrics.warmAffectedFraction).toBeGreaterThanOrEqual(0);
		expect(firstPanel.modelComparisonMetrics.warmAffectedFraction).toBeLessThanOrEqual(1);
		expect(firstPanel.modelComparisonMetrics.horizonRing.pixelCount).toBeGreaterThan(0);
		expect(firstPanel.diagnosticSamples.length).toBe(2);
		expect(firstPanel.projection.sunMarker).toEqual(jasmine.objectContaining({
			x: jasmine.any(Number),
			y: jasmine.any(Number),
		}));
		expect(firstPanel.projection.sunMarker.x).toBeGreaterThan(firstPanel.size.width / 2);
		expect(firstPanel.projection.sunMarker.y).toBeGreaterThan(firstPanel.size.height / 2);
		expect(markdown).toContain('# Atmosphere Reference Sky-Dome Grid');
		expect(markdown).toContain('06h00 / 87 deg');
		expect(markdown).toContain('bruneton-2016-kider-fit');
		expect(markdown).toContain('bruneton-2016-cornette-shanks-g070');
		expect(markdown).toContain('## Model-Output Metrics');
		expect(markdown).toContain('Baseline freeze');
		expect(svg).toContain('Sky-Dome Model Comparison Column');
		expect(ppm).toContain('P3');
		expect(ppm).toContain('8 32');
		expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
	});

	it('records finite solar-disc source quadrature in sky-dome metadata and diagnostics', function() {
		const result = runReferenceProbe({
			skyDomeGrid: true,
			domeSize: 4,
			solarSource: 'finite-sun-disc',
			finiteSunSamples: 5,
			viewSteps: 1,
			sunTransmittanceSteps: 1,
			wavelengthGrid: 'preview-20nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'bruneton-2016-kider-fit',
			ozonePolicy: 'bruneton-2016-no-visible-absorption',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'exponential',
		});
		const firstPanel = result.skyDomePanels[0];
		const diagnostic = firstPanel.diagnosticSamples[0];
		const markdown = buildMarkdownReport(result);

		// Reason: Task 6 exists so Task 7 can compare directional and finite-source aureole renders from recorded source quadrature, not an implicit adapter.
		// Source: Reference Plan, output-impact Task 6 finite solar-source adapter mode.
		expect(result.visual.solarSource).toEqual(jasmine.objectContaining({
			mode: 'finite-sun-disc',
			sampleCount: 5,
			weightSum: 1,
			weightPolicy: 'equal source-integral weights; source energy convention preserved',
		}));
		expect(result.visual.solarSource.solarAngularRadiusDeg).toBeCloseTo(0.2665, 6);
		expect(result.visual.solarSource.maxAngularOffsetDeg)
			.toBeLessThanOrEqual(result.visual.solarSource.solarAngularRadiusDeg);
		expect(firstPanel.solarSource).toEqual(result.visual.solarSource);
		expect(diagnostic.sourceQuadrature).toEqual(jasmine.objectContaining({
			sourceSampleCount: 5,
			weightSum: 1,
			minWeight: 0.2,
			maxWeight: 0.2,
		}));
		expect(diagnostic.sourceQuadrature.maxAngularOffsetDeg)
			.toBeLessThanOrEqual(result.visual.solarSource.solarAngularRadiusDeg);
		expect(diagnostic.sourceQuadrature.sourceSampleIds.length).toBe(5);
		expect(markdown).toContain('Solar source: `finite-sun-disc`');
		expect(markdown).toContain('source samples `5`');
	});

	it('can render only the sky-dome horizon ring for perimeter diagnostics', function() {
		const result = runReferenceProbe({
			skyDomeGrid: true,
			domeSize: 8,
			domeSampleMask: 'horizon-ring',
			viewSteps: 1,
			sunTransmittanceSteps: 1,
			wavelengthGrid: 'preview-20nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'bruneton-2016-kider-fit',
			ozonePolicy: 'bruneton-2016-no-visible-absorption',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'exponential',
		});
		const firstPanel = result.skyDomePanels[0];
		const centerIndex = Math.floor(firstPanel.size.height / 2) * firstPanel.size.width
			+ Math.floor(firstPanel.size.width / 2);
		const markdown = buildMarkdownReport(result);

		// Reason: current brown-ring work needs a faster artifact that spends transport samples on the perimeter without corrupting metrics with masked black center pixels.
		// Source: Reference Plan, aerosol/Mie perimeter audit follow-up.
		expect(result.visual.domeSampleMask).toEqual(jasmine.objectContaining({
			id: 'horizon-ring',
			minRadius: 0.88,
		}));
		expect(result.baselineFreeze.domeSampleMask.id).toBe('horizon-ring');
		expect(firstPanel.domeSampleMask.id).toBe('horizon-ring');
		expect(firstPanel.sampledInsideDomePixelCount).toBeGreaterThan(0);
		expect(firstPanel.skippedInsideDomePixelCount).toBeGreaterThan(0);
		expect(firstPanel.pixelImage.pixels[centerIndex].source.colorProvenance).toEqual(jasmine.objectContaining({
			mask: 'dome-sample-mask-skipped',
			domeSampleMask: jasmine.objectContaining({ id: 'horizon-ring' }),
		}));
		expect(firstPanel.modelComparisonMetrics.sampledDomePixelCount).toBe(firstPanel.sampledInsideDomePixelCount);
		expect(firstPanel.modelComparisonMetrics.skippedDomePixelCount).toBe(firstPanel.skippedInsideDomePixelCount);
		expect(firstPanel.modelComparisonMetrics.zenithDisk.pixelCount).toBe(0);
		expect(firstPanel.modelComparisonMetrics.horizonRing.pixelCount).toBe(firstPanel.sampledInsideDomePixelCount);
		expect(firstPanel.modelComparisonMetrics.zenithToHorizon.luminanceRatio).toBeNull();
		expect(markdown).toContain('Dome sample mask: `horizon-ring`');
		expect(markdown).toContain('Sampled / skipped pixels');
	});

	it('defaults sky-dome comparison renders to the paper-comparison sampling profile', function() {
		const result = runReferenceProbe({
			skyDomeGrid: true,
			domeSize: 1,
			wavelengthGrid: 'preview-20nm',
		});
		const firstPanel = result.skyDomePanels[0];
		const markdown = buildMarkdownReport(result);
		const summary = formatSummary(result);

		// Reason: Task 2 found low sampling changed the visible sunset spot and edge colors, so default dome evidence must name a comparison-grade profile.
		// Source: Reference Plan, Output-Impact Task 2 closeout.
		expect(result.visual.numerical).toEqual(jasmine.objectContaining({
			viewSteps: 96,
			sunTransmittanceSteps: 16,
			integrationMethod: 'midpoint',
			samplingProfile: jasmine.objectContaining({
				id: 'paper-comparison',
				viewSteps: 96,
				sunTransmittanceSteps: 16,
			}),
		}));
		expect(firstPanel.numerical.samplingProfile).toEqual(jasmine.objectContaining({
			id: 'paper-comparison',
			viewSteps: 96,
			sunTransmittanceSteps: 16,
		}));
		expect(firstPanel.numerical.viewSteps).toBe(96);
		expect(firstPanel.numerical.sunTransmittanceSteps).toBe(16);
		expect(markdown).toContain('Sampling profile: `paper-comparison`');
		expect(summary).toContain('sampling=paper-comparison');
	});

	it('selects HG and Cornette-Shanks aerosol phases while holding Bruneton scalar aerosol fixed', function() {
		const baseOptions = {
			skyDomeGrid: true,
			domeSize: 4,
			viewSteps: 1,
			sunTransmittanceSteps: 1,
			wavelengthGrid: 'preview-20nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'bruneton-2016-kider-fit',
			ozonePolicy: 'brion-1998-ozone-295k',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'exponential',
			multipleScatteringReference: 'none',
		};
		const hgControl = runReferenceProbe({
			...baseOptions,
			aerosolPhasePolicy: 'bruneton-2016-hg-g070-control',
		});
		const cornetteShanks = runReferenceProbe({
			...baseOptions,
			aerosolPhasePolicy: 'bruneton-2016-cornette-shanks-g070',
		});

		// Reason: the first artifact must isolate phase shape, not AOD/SSA/scale-height or multiple scattering.
		// Source: Reference Plan, Output-Impact Task 1 artifact contract.
		expect(hgControl.visual.aerosolPolicy).toEqual(cornetteShanks.visual.aerosolPolicy);
		expect(hgControl.visual.aerosolPhasePolicy).toEqual(jasmine.objectContaining({
			id: 'bruneton-2016-hg-g070-control',
			kind: 'henyey-greenstein',
			parameters: { g: 0.7 },
		}));
		expect(cornetteShanks.visual.aerosolPhasePolicy).toEqual(jasmine.objectContaining({
			id: 'bruneton-2016-cornette-shanks-g070',
			kind: 'cornette-shanks',
			parameters: { g: 0.7 },
		}));
		expect(hgControl.multipleScatteringReference.status).toBe('disabled-no-op');
		expect(cornetteShanks.multipleScatteringReference.status).toBe('disabled-no-op');
		expect(hgControl.skyDomePanels[0].aerosolPolicy)
			.toEqual(cornetteShanks.skyDomePanels[0].aerosolPolicy);
		expect(hgControl.skyDomePanels[0].aerosolPhasePolicy).toEqual(jasmine.objectContaining({
			id: 'bruneton-2016-hg-g070-control',
		}));
		expect(cornetteShanks.skyDomePanels[0].aerosolPhasePolicy).toEqual(jasmine.objectContaining({
			id: 'bruneton-2016-cornette-shanks-g070',
		}));
	});

	it('compares imported external radiance samples and exposes the sidecar reference contract', function() {
		const wavelengthsNm = resolveSkyPatchWavelengthGrid('preview-20nm').wavelengthsNm;
		const externalRadiancePath = 'tmp/atmosphere-reference-cli-pixel-test/external-radiance.json';
		fs.mkdirSync('tmp/atmosphere-reference-cli-pixel-test', { recursive: true });
		fs.writeFileSync(externalRadiancePath, `${JSON.stringify({
			source: {
				model: 'fixture-DISORT-like',
				version: 'test',
				configuration: {
					purpose: 'exercise import contract',
				},
			},
			wavelengthsNm,
			samples: [
				{
					scenarioId: '06h00.sunZenith87',
					sampleRole: 'zenith',
					spectralRadiance: wavelengthsNm.map(() => 0),
				},
			],
		}, null, 2)}\n`);

		const result = runReferenceProbe({
			skyDomeGrid: true,
			domeSize: 6,
			viewSteps: 1,
			sunTransmittanceSteps: 1,
			wavelengthGrid: 'preview-20nm',
			externalRadiancePath,
			multipleScatteringReference: 'sidecar-contract',
		});
		const markdown = buildMarkdownReport(result);

		// Reason: multiple-scattering phases 3 and 4 add file-based calibration comparison and explicit sidecar metadata without changing final radiance.
		// Source: Multiple-Scattering Plan, phases 3 and 4.
		expect(result.externalRadianceComparison.kind).toBe('flat-atmosphere-external-radiance-comparison');
		expect(result.externalRadianceComparison.matchedSampleCount).toBe(1);
		expect(result.externalRadianceComparison.samples[0]).toEqual(jasmine.objectContaining({
			status: 'matched',
			scenarioId: '06h00.sunZenith87',
			sampleRole: 'zenith',
			generatedKind: 'sky-dome-panel',
		}));
		expect(result.externalRadianceComparison.samples[0].actualRadianceByWavelength.length).toBe(wavelengthsNm.length);
		expect(result.multipleScatteringReference).toEqual(jasmine.objectContaining({
			kind: 'flat-atmosphere-multiple-scattering-reference',
			mode: 'sidecar-contract',
			status: 'not-computed',
			outputPolicy: 'sidecar only; spectralRadiance.finalByWavelength is unchanged',
		}));
		expect(result.multipleScatteringReference.orders).toEqual([]);
		expect(markdown).toContain('## External Radiance Comparison');
		expect(markdown).toContain('## Multiple-Scattering Reference Sidecar');
	});

	it('attaches a zero-radiance multiple-scattering no-op sidecar without changing rendered radiance', function() {
		const baseOptions = {
			skyDomeGrid: true,
			domeSize: 6,
			viewSteps: 1,
			sunTransmittanceSteps: 1,
			wavelengthGrid: 'preview-20nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'bruneton-2016-kider-fit',
			ozonePolicy: 'brion-1998-ozone-295k',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'exponential',
		};
		const baseline = runReferenceProbe(baseOptions);
		const result = runReferenceProbe({
			...baseOptions,
			multipleScatteringReference: 'none',
		});
		const sidecar = result.multipleScatteringReference;
		const markdown = buildMarkdownReport(result);

		// Reason: no-op mode should be a visible isolation switch, not a hidden fallback or a computed approximation.
		// Source: Phase 10 model-family audit, no-op isolation requirement.
		expect(sidecar).toEqual(jasmine.objectContaining({
			kind: 'flat-atmosphere-multiple-scattering-reference',
			mode: 'none',
			status: 'disabled-no-op',
			plannedSolver: 'none',
			contributionPolicy: 'zero-radiance-no-op',
		}));
		expect(sidecar.wavelengthsNm).toEqual(resolveSkyPatchWavelengthGrid('preview-20nm').wavelengthsNm);
		expect(sidecar.radianceByWavelength).toEqual(sidecar.wavelengthsNm.map(() => 0));
		expect(sidecar.orders).toEqual([]);
		expect(sidecar.convergence).toEqual(jasmine.objectContaining({
			maxOrder: 0,
			lastOrderFraction: 0,
			converged: true,
		}));
		expect(result.skyDomePanels[0].diagnosticSamples[0].renderedByWavelength)
			.toEqual(baseline.skyDomePanels[0].diagnosticSamples[0].renderedByWavelength);
		expect(markdown).toContain('Mode: `none`');
		expect(markdown).toContain('Status: `disabled-no-op`');
	});

	it('computes a prototype order-by-order multiple-scattering sidecar without replacing rendered radiance', function() {
		const result = runReferenceProbe({
			skyDomeGrid: true,
			domeSize: 6,
			viewSteps: 1,
			sunTransmittanceSteps: 1,
			wavelengthGrid: 'preview-20nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'bruneton-2016-kider-fit',
			ozonePolicy: 'brion-1998-ozone-295k',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'exponential',
			multipleScatteringReference: 'order-by-order-grid',
		});
		const sidecar = result.multipleScatteringReference;
		const firstSample = sidecar.samples[0];
		const sourceSample = result.skyDomePanels[0].diagnosticSamples.find((sample) => {
			return sample.x === firstSample.x && sample.y === firstSample.y;
		}) ?? result.skyDomePanels[0].diagnosticSamples[0];
		const spectralEnergy = (values) => values.reduce((sum, value) => sum + value, 0);
		const markdown = buildMarkdownReport(result);

		// Reason: phase 5 should compute a diagnostic higher-order sidecar while keeping the single-scattering image contract frozen.
		// Source: Multiple-Scattering Plan, phase 5 order-by-order grid prototype.
		expect(sidecar).toEqual(jasmine.objectContaining({
			kind: 'flat-atmosphere-multiple-scattering-reference',
			mode: 'order-by-order-grid',
			status: 'computed-prototype',
			outputPolicy: 'sidecar only; spectralRadiance.finalByWavelength is unchanged',
		}));
		expect(sidecar.wavelengthsNm).toEqual(resolveSkyPatchWavelengthGrid('preview-20nm').wavelengthsNm);
		expect(sidecar.orders.map((order) => order.order)).toEqual([1, 2]);
		expect(sidecar.orders[0].radianceByWavelength.length).toBe(sidecar.wavelengthsNm.length);
		expect(sidecar.orders[1].radianceByWavelength.length).toBe(sidecar.wavelengthsNm.length);
		expect(spectralEnergy(sidecar.orders[0].radianceByWavelength)).toBeGreaterThan(0);
		expect(spectralEnergy(sidecar.orders[1].radianceByWavelength)).toBeGreaterThan(0);
		expect(sidecar.samples.length).toBe(8);
		expect(firstSample.orders.map((order) => order.order)).toEqual([1, 2]);
		expect(firstSample.orders[1].radianceByWavelength.length).toBe(sidecar.wavelengthsNm.length);
		expect(firstSample.baselineRadianceByWavelength).toEqual(sourceSample.renderedByWavelength);
		expect(firstSample.displayComparison).toEqual(jasmine.objectContaining({
			kind: 'flat-atmosphere-multiple-scattering-display-comparison',
			order1: jasmine.objectContaining({
				displayHex: jasmine.stringMatching(/^#[0-9a-f]{6}$/),
			}),
			order1PlusOrder2: jasmine.objectContaining({
				displayHex: jasmine.stringMatching(/^#[0-9a-f]{6}$/),
			}),
		}));
		expect(firstSample.displayComparison.delta.linearLuminanceRatio).toBeGreaterThan(1);
		expect(sidecar.diagnostics.angularSampleCount).toBe(8);
		expect(sidecar.diagnostics.altitudeLayerCount).toBe(3);
		expect(sidecar.convergence.lastOrderFraction).toEqual(jasmine.any(Number));
		expect(markdown).toContain('Status: `computed-prototype`');
		expect(markdown).toContain('| Order | Average selected radiance |');
		expect(markdown).toContain('Order 2 fraction');
		expect(markdown).toContain('L1+L2 display');
	});

	it('computes dome-ring multiple-scattering targets with custom angular sampling', function() {
		const result = runReferenceProbe({
			skyDomeGrid: true,
			domeSize: 4,
			viewSteps: 1,
			sunTransmittanceSteps: 1,
			wavelengthGrid: 'preview-20nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'bruneton-2016-kider-fit',
			ozonePolicy: 'brion-1998-ozone-295k',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'exponential',
			multipleScatteringReference: 'order-by-order-grid',
			multipleScatteringTargets: 'dome-rings',
			multipleScatteringAngularSamples: 4,
		});
		const sidecar = result.multipleScatteringReference;
		const firstRingTarget = sidecar.samples.find((sample) => {
			return sample.sampleRole === 'ring-vza-030-raz-000';
		});
		const spectralEnergy = (values) => values.reduce((sum, value) => sum + value, 0);
		const markdown = buildMarkdownReport(result);

		// Reason: denser multiscatter evidence should add target rays without requiring a larger rendered image.
		// Source: Multiple-Scattering Plan, dome-rings target mode.
		expect(sidecar.diagnostics.targetMode).toBe('dome-rings');
		expect(sidecar.diagnostics.angularSampleCount).toBe(4);
		expect(sidecar.diagnostics.targetCount).toBe(132);
		expect(sidecar.samples.length).toBe(132);
		expect(firstRingTarget).toEqual(jasmine.objectContaining({
			targetMode: 'dome-rings',
			viewZenithDeg: 30,
			relativeAzimuthDeg: 0,
			displayHex: null,
			baselineRadianceByWavelength: null,
		}));
		expect(firstRingTarget.displayComparison.order1.displayHex).toMatch(/^#[0-9a-f]{6}$/);
		expect(firstRingTarget.displayComparison.order1PlusOrder2.displayHex).toMatch(/^#[0-9a-f]{6}$/);
		expect(firstRingTarget.displayComparison.delta.linearLuminanceRatio).toBeGreaterThan(1);
		expect(spectralEnergy(sidecar.orders[1].radianceByWavelength)).toBeGreaterThan(0);
		expect(markdown).toContain('target mode `dome-rings`');
		expect(markdown).toContain('ring-vza-030-raz-000');
		expect(markdown).toContain('View zenith deg');
	});

	it('computes an order-3 convergence sidecar when max order is requested', function() {
		const result = runReferenceProbe({
			skyDomeGrid: true,
			domeSize: 4,
			viewSteps: 1,
			sunTransmittanceSteps: 1,
			wavelengthGrid: 'preview-20nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'bruneton-2016-kider-fit',
			ozonePolicy: 'brion-1998-ozone-295k',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'exponential',
			multipleScatteringReference: 'order-by-order-grid',
			multipleScatteringAngularSamples: 4,
			multipleScatteringMaxOrder: 3,
		});
		const sidecar = result.multipleScatteringReference;
		const firstSample = sidecar.samples[0];
		const spectralEnergy = (values) => values.reduce((sum, value) => sum + value, 0);
		const markdown = buildMarkdownReport(result);

		// Reason: phase 6 needs explicit convergence diagnostics before any higher-order term is promoted.
		// Source: Multiple-Scattering Plan, Phase 6 Evaluate Before Promotion.
		expect(sidecar.convergence.maxOrder).toBe(3);
		expect(sidecar.orders.map((order) => order.order)).toEqual([1, 2, 3]);
		expect(firstSample.orders.map((order) => order.order)).toEqual([1, 2, 3]);
		expect(spectralEnergy(sidecar.orders[2].radianceByWavelength)).toBeGreaterThan(0);
		expect(sidecar.convergence.lastOrderFraction).toEqual(jasmine.any(Number));
		expect(firstSample.convergence.lastOrderFraction).toEqual(jasmine.any(Number));
		expect(firstSample.displayComparison.accumulated.displayHex).toMatch(/^#[0-9a-f]{6}$/);
		expect(markdown).toContain('| 3 |');
		expect(markdown).toContain('Accumulated display');
		expect(markdown).toContain('Last order fraction');
	});

	it('computes a bounded order-4 diagnostic convergence sidecar', function() {
		const result = runReferenceProbe({
			skyDomeGrid: true,
			domeSize: 4,
			viewSteps: 1,
			sunTransmittanceSteps: 1,
			wavelengthGrid: 'preview-20nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'bruneton-2016-kider-fit',
			ozonePolicy: 'brion-1998-ozone-295k',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'exponential',
			multipleScatteringReference: 'order-by-order-grid',
			multipleScatteringTargets: 'diagnostic',
			multipleScatteringAngularSamples: 2,
			multipleScatteringMaxOrder: 4,
		});
		const sidecar = result.multipleScatteringReference;
		const spectralEnergy = (values) => values.reduce((sum, value) => sum + value, 0);

		// Reason: phase 6 can test one bounded extra order, but only on diagnostic targets.
		// Source: Multiple-Scattering Plan, Phase 6 convergence sweep.
		expect(sidecar.convergence.maxOrder).toBe(4);
		expect(sidecar.diagnostics.targetMode).toBe('diagnostic');
		expect(sidecar.orders.map((order) => order.order)).toEqual([1, 2, 3, 4]);
		expect(spectralEnergy(sidecar.orders[3].radianceByWavelength)).toBeGreaterThan(0);
		expect(sidecar.samples[0].orders.map((order) => order.order)).toEqual([1, 2, 3, 4]);
	});

	it('computes a cached iterative field sidecar with low-resolution comparison panels', function() {
		const result = runReferenceProbe({
			skyDomeGrid: true,
			domeSize: 4,
			viewSteps: 1,
			sunTransmittanceSteps: 1,
			wavelengthGrid: 'preview-20nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'bruneton-2016-kider-fit',
			ozonePolicy: 'brion-1998-ozone-295k',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'exponential',
			multipleScatteringReference: 'iterative-field-grid',
			multipleScatteringAngularSamples: 4,
			multipleScatteringMaxOrder: 3,
		});
		const sidecar = result.multipleScatteringReference;
		const firstScene = sidecar.fieldScenes[0];
		const markdown = buildMarkdownReport(result);

		// Reason: Phase 6 should move from recursive sampled rays to a cached field that can drive image-level comparison artifacts.
		// Source: Multiple-Scattering Plan, cached/iterative field next step.
		expect(sidecar.mode).toBe('iterative-field-grid');
		expect(sidecar.plannedSolver).toBe('cached-iterative-field-grid');
		expect(sidecar.orders.map((order) => order.order)).toEqual([1, 2, 3]);
		expect(sidecar.fieldScenes.length).toBe(4);
		expect(sidecar.reconstruction.interpolationMode).toBe('nearest');
		expect(sidecar.reconstruction.targetCount).toBe(132);
		expect(sidecar.reconstruction.aggregate.meanRelativeSpectralEnergyError).toEqual(jasmine.any(Number));
		expect(firstScene.grid.altitudeLayersKm.length).toBeGreaterThan(1);
		expect(firstScene.grid.directionCount).toBe(4);
		expect(firstScene.comparisonPanels.length).toBe(5);
		expect(firstScene.reconstruction.aggregate.meanRelativeSpectralEnergyError).toEqual(jasmine.any(Number));
		expect(firstScene.imageReconstruction.aggregate.meanRelativeSpectralEnergyError).toEqual(jasmine.any(Number));
		expect(firstScene.comparisonPanels[0].rows.length).toBe(4);
		expect(firstScene.comparisonPanels[0].rows[0].length).toBe(4);
		expect(firstScene.comparisonPanels[0].pixelImage.kind).toBe('atmosphere-color-pixel-image');
		expect(firstScene.comparisonPanels[0].modelComparisonMetrics.kind)
			.toBe('display-encoded-fisheye-model-comparison-metrics');
		expect(firstScene.comparisonPanels[0].modelComparisonMetrics.domePixelCount)
			.toBeGreaterThan(0);
		expect(markdown).toContain('Field Comparison Panels');
		expect(markdown).toContain('Field L1..L3');
		expect(markdown).toContain('Direct L1 + Field L2..L3');
		expect(markdown).toContain('Horizon/zenith luminance');
		expect(markdown).toContain('Cached Field L1 Reconstruction');
	});

	it('computes iterative field reconstruction metrics with weighted interpolation', function() {
		const result = runReferenceProbe({
			skyDomeGrid: true,
			domeSize: 4,
			viewSteps: 1,
			sunTransmittanceSteps: 1,
			wavelengthGrid: 'preview-20nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'bruneton-2016-kider-fit',
			ozonePolicy: 'brion-1998-ozone-295k',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'exponential',
			multipleScatteringReference: 'iterative-field-grid',
			multipleScatteringAngularSamples: 4,
			multipleScatteringMaxOrder: 3,
			multipleScatteringFieldInterpolation: 'weighted',
		});
		const sidecar = result.multipleScatteringReference;

		// Reason: Phase 6 must separate field lookup error from true higher-order transport before promotion.
		// Source: Multiple-Scattering Plan, evaluate-before-promotion criteria.
		expect(sidecar.diagnostics.fieldInterpolation).toBe('weighted');
		expect(sidecar.reconstruction.interpolationMode).toBe('weighted');
		expect(sidecar.reconstruction.byViewZenithDeg.length).toBeGreaterThan(1);
		expect(sidecar.fieldScenes[0].grid.lookupPolicy).toContain('linear altitude');
	});

	it('computes iterative field diagnostics for a horizon-resolved phase 7 grid', function() {
		const result = runReferenceProbe({
			skyDomeGrid: true,
			domeSize: 4,
			viewSteps: 1,
			sunTransmittanceSteps: 1,
			wavelengthGrid: 'preview-20nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'bruneton-2016-kider-fit',
			ozonePolicy: 'brion-1998-ozone-295k',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'exponential',
			multipleScatteringReference: 'iterative-field-grid',
			multipleScatteringAngularSamples: 8,
			multipleScatteringMaxOrder: 2,
			multipleScatteringFieldInterpolation: 'weighted',
			multipleScatteringFieldDirectionBasis: 'horizon-sun',
			multipleScatteringFieldAltitudeGrid: 'lower-atmosphere',
		});
		const sidecar = result.multipleScatteringReference;
		const firstScene = sidecar.fieldScenes[0];

		// Reason: Phase 7 biased angular grids must carry solid-angle weights and lower-atmosphere layer provenance.
		// Source: Multiple-Scattering Plan, recommended Phase 7 horizon-resolved field grid.
		expect(sidecar.diagnostics.fieldDirectionBasis).toBe('horizon-sun');
		expect(sidecar.diagnostics.fieldAltitudeGrid).toBe('lower-atmosphere');
		expect(sidecar.diagnostics.requestedAngularSampleCount).toBe(8);
		expect(sidecar.diagnostics.angularSampleCount).toBeGreaterThan(8);
		expect(sidecar.diagnostics.fieldDirectionWeightRelativeError).toBeLessThan(1e-12);
		expect(firstScene.grid.directionBasis).toBe('horizon-sun');
		expect(firstScene.grid.directionWeightSumSr).toBeCloseTo(4 * Math.PI, 10);
		expect(firstScene.grid.altitudeLayersKm).toContain(0.05);
		expect(sidecar.reconstruction.directionBasis).toBe('horizon-sun');
	});

	it('builds PNG-only sidecar skydome image artifacts from cached iterative field panels', function() {
		const result = runReferenceProbe({
			skyDomeGrid: true,
			domeSize: 4,
			viewSteps: 1,
			sunTransmittanceSteps: 1,
			wavelengthGrid: 'preview-20nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'bruneton-2016-kider-fit',
			ozonePolicy: 'brion-1998-ozone-295k',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'exponential',
			multipleScatteringReference: 'iterative-field-grid',
			multipleScatteringAngularSamples: 4,
			multipleScatteringMaxOrder: 3,
		});
		const artifactSet = buildMultipleScatteringImageArtifacts(result);
		const paths = artifactSet.files.map((file) => file.relativePath);
		const contactSheet = artifactSet.files.find((file) => file.relativePath === 'sidecar-skydome-set.png');

		// Reason: sidecar images are review artifacts, not canonical JSON or transport-stage output.
		// Source: Multiple-Scattering Plan, phase 6 evaluate-before-promotion guardrail.
		expect(artifactSet.mode).toBe('iterative-field-grid');
		expect(paths).toContain('baseline-canonical.png');
		expect(paths).toContain('field-l1-through-l3.png');
		expect(paths).toContain('direct-l1-plus-field-l2-through-l3.png');
		expect(paths).toContain('sidecar-skydome-set.png');
		expect(paths).toContain('README.md');
		expect(contactSheet.contents.slice(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
		const readme = String(artifactSet.files.find((file) => file.relativePath === 'README.md').contents);
		expect(readme).toContain('diagnostic sidecar output');
		expect(readme).toContain('## Image Metrics');
		expect(readme).toContain('## Dense Cached L1 Image Reconstruction');
		expect(readme).toContain('Canonical L1');
		expect(readme).toContain('Horizon/zenith lum');
	});

	it('defaults sky-patch experiments to the current daylight and sunset benchmark trio', function() {
		const result = runReferenceProbe({
			skyPatches: true,
			stage: 'full',
			patchSize: { width: 2, height: 2 },
		});

		// Reason: midnight stays available as an explicit no-celestial control, but routine experiments should not spend pixels on it.
		// Source: Sun Visual Plan, Active Focus benchmark order and current no-celestial scope.
		expect(result.skyPatches.map((patch) => patch.id)).toEqual([
			'midday.zenith',
			'midday.horizon',
			'sunset.horizon',
		]);
		expect(result.skyPatches.map((patch) => patch.numerical.viewSteps)).toEqual([64, 64, 64]);
		expect(result.skyPatches.map((patch) => patch.numerical.sunTransmittanceSteps)).toEqual([16, 16, 32]);
	});

	it('can run sky patches through the analytic preview color fallback', function() {
		const result = runReferenceProbe({
			...FAST_SKY_PATCH_NUMERICAL,
			skyPatches: true,
			patchIds: ['midday.zenith'],
			color: 'preview-cie',
		});
		const patch = result.skyPatches[0];

		// Reason: the analytic approximation remains available as an explicitly named fallback.
		// Source: Atmosphere Color Plan, CLI color option.
		expect(result.visual.colorPolicy).toBe('preview-cie');
		expect(result.visual.colorSpace).toBe('preview-cie-1931-xyz-to-linear-srgb');
		expect(patch.pixelImage.metadata.colorProvenance.colorPolicy).toBe('preview-cie');
	});

	it('can run sky patches through the ASTM G-173 solar spectrum policy', function() {
		const result = runReferenceProbe({
			...FAST_SKY_PATCH_NUMERICAL,
			skyPatches: true,
			patchIds: ['midday.zenith'],
			solarSpectrum: 'astm-g173',
		});
		const patch = result.skyPatches[0];

		// Reason: ASTM G-173 is the first sourced solar-spectrum benchmark path.
		// Source: Atmosphere Color Plan, sourced solar spectrum option.
		expect(result.visual.solarSpectrum.policy).toBe('astm-g173');
		expect(patch.solarSpectrum.policy).toBe('astm-g173');
		expect(patch.solarSpectrum.provenance.sourceId).toBe('astm-g173');
		expect(patch.diagnosticSamples[0].displayHex).toMatch(/^#[0-9a-f]{6}$/);
	});

	it('can render the midday horizon sky patch', function() {
		const result = runReferenceProbe({
			...FAST_SKY_PATCH_NUMERICAL,
			skyPatches: true,
			patchIds: ['midday.horizon'],
			wavelengthGrid: 'benchmark-5nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'clear-maritime',
			ozonePolicy: 'brion-1998-ozone-295k',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'preserve-hue',
		});
		const patch = result.skyPatches[0];
		const markdown = buildMarkdownReport(result);
		const center = patch.diagnosticSamples.find((sample) => {
			return sample.x === Math.floor(patch.size.width / 2)
				&& sample.y === Math.floor(patch.size.height / 2);
		});

		// Reason: midday horizon is the missing low-elevation clear-day baseline view.
		// Source: Sun Visual Plan, baseline comparison views.
		expect(patch.id).toBe('midday.horizon');
		expect(patch.label).toBe('Midday Horizon');
		expect(patch.sun.elevationDeg).toBe(74);
		expect(patch.camera.forward[1]).toBeGreaterThan(0);
		expect(patch.camera.forward[1]).toBeLessThan(0.1);
		expect(patch.rayleighPolicy.id).toBe('bucholtz-standard-air');
		expect(patch.aerosolPolicy.id).toBe('clear-maritime');
		expect(result.visual.numerical.viewSteps).toBe(12);
		expect(result.visual.numerical.sunTransmittanceSteps).toBe(2);
		expect(patch.numerical.viewSteps).toBe(12);
		expect(patch.numerical.sunTransmittanceSteps).toBe(2);
		expect(patch.horizonProfile).toEqual(jasmine.objectContaining({
			profileKind: 'center-column-horizon-profile',
			skySampleCount: jasmine.any(Number),
			surfaceHitSampleCount: jasmine.any(Number),
			skyTrend: jasmine.any(Object),
		}));
		expect(patch.horizonProfile.samples.length).toBe(patch.size.height);
		expect(patch.horizonProfile.firstSurfaceByRow.rayClass).toBe('surface-hit');
		expect(patch.horizonProfile.horizonSkySample.rayClass).toBe('sky');
		expect(center.skyCompletenessDiagnostics.phase.avgScatteringAngleDeg).toEqual(jasmine.any(Number));
		expect(center.skyCompletenessDiagnostics.altitude.fractionBelow10Km).toEqual(jasmine.any(Number));
		expect(center.skyCompletenessDiagnostics.singleScatteringBudget.peakContributionSample)
			.toEqual(jasmine.objectContaining({
				viewTransmittanceAt560: jasmine.any(Number),
				sourceTransmittanceAt560: jasmine.any(Number),
				species: jasmine.any(Object),
			}));
		expect(center.skyCompletenessDiagnostics.missingLightEstimate.assessment)
			.toBe('multiple-scattering-likely');
		expect(markdown).toContain('midday.horizon');
		expect(markdown).toContain('Midday Horizon');
		expect(markdown).toContain('Center scattering geometry');
		expect(markdown).toContain('Center altitude distribution');
		expect(markdown).toContain('Center single-scattering budget');
		expect(markdown).toContain('Missing-light estimate');
		expect(markdown).toContain('Horizon profile');
		expect(markdown).toContain('Numerical sampling');
		expect(markdown).toContain('12 view steps, 2 source-path steps');
		expect(markdown).toContain('Center-column row');
	});

	it('can render an upward-panned midday horizon sky-gradient frame', function() {
		const result = runReferenceProbe({
			...FAST_SKY_PATCH_NUMERICAL,
			skyPatches: true,
			patchIds: ['midday.horizonSky'],
			wavelengthGrid: 'benchmark-5nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'clear-maritime',
			ozonePolicy: 'brion-1998-ozone-295k',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'preserve-hue',
		});
		const patch = result.skyPatches[0];
		const markdown = buildMarkdownReport(result);

		// Reason: the photo-comparison frame should spend most pixels above the horizon while preserving the original low-horizon diagnostic.
		// Source: Sun Visual Plan, midday horizon visual comparison follow-up.
		expect(patch.id).toBe('midday.horizonSky');
		expect(patch.label).toBe('Midday Horizon Sky Frame');
		expect(patch.sun.elevationDeg).toBe(74);
		expect(patch.camera.forward[1]).toBeGreaterThan(0.2);
		expect(patch.camera.forward[1]).toBeLessThan(0.25);
		expect(patch.horizonProfile.samples.length).toBe(patch.size.height);
		expect(patch.horizonProfile.skySampleCount)
			.toBeGreaterThan(patch.horizonProfile.surfaceHitSampleCount);
		expect(markdown).toContain('midday.horizonSky');
		expect(markdown).toContain('Midday Horizon Sky Frame');
	});

	it('can render a tall midday horizon sky-gradient comparison frame', function() {
		const result = runReferenceProbe({
			...FAST_SKY_PATCH_NUMERICAL,
			skyPatches: true,
			patchIds: ['midday.horizonTallSky'],
			patchSize: { width: 6, height: 8 },
			wavelengthGrid: 'benchmark-5nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'clear-maritime',
			ozonePolicy: 'brion-1998-ozone-295k',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'preserve-hue',
		});
		const patch = result.skyPatches[0];
		const markdown = buildMarkdownReport(result);

		// Reason: the photographic horizon reference includes much more sky above the horizon than the narrow diagnostic frame.
		// Source: Sun Visual Plan, midday horizon visual comparison follow-up.
		expect(patch.id).toBe('midday.horizonTallSky');
		expect(patch.label).toBe('Midday Horizon Tall Sky Frame');
		expect(patch.camera.fovYDeg).toBe(54);
		expect(patch.camera.forward[1]).toBeGreaterThan(0.4);
		expect(patch.camera.forward[1]).toBeLessThan(0.45);
		expect(patch.horizonProfile.samples.length).toBe(8);
		expect(patch.horizonProfile.skySampleCount)
			.toBeGreaterThan(patch.horizonProfile.surfaceHitSampleCount);
		expect(markdown).toContain('midday.horizonTallSky');
		expect(markdown).toContain('Midday Horizon Tall Sky Frame');
	});

	it('can run sky patches through the Bucholtz Rayleigh policy and report it', function() {
		const result = runReferenceProbe({
			...FAST_SKY_PATCH_NUMERICAL,
			skyPatches: true,
			patchIds: ['sunset.horizon'],
			wavelengthGrid: 'benchmark-5nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
		});
		const patch = result.skyPatches[0];
		const markdown = buildMarkdownReport(result);

		// Reason: Rayleigh policy selection is part of the review artifact provenance.
		// Source: Atmosphere Composition Plan, Rayleigh implementation substeps 5-7.
		expect(result.visual.rayleighPolicy.id).toBe('bucholtz-standard-air');
		expect(result.visual.ozonePolicy.id).toBe('preview-chappuis');
		expect(result.model.rayleighPolicy.id).toBe('bucholtz-standard-air');
		expect(patch.rayleighPolicy.id).toBe('bucholtz-standard-air');
		expect(patch.rayleighPolicy.doi).toBe('10.1364/AO.34.002765');
		expect(patch.diagnosticSamples[0].displayHex).toMatch(/^#[0-9a-f]{6}$/);
		expect(markdown).toContain('Rayleigh `bucholtz-standard-air`');
		expect(markdown).toContain('- Rayleigh policy: `bucholtz-standard-air`');
		expect(markdown).toContain('ozone `preview-chappuis`');
	});

	it('can run sky patches through the Brion ozone policy and report it', function() {
		const result = runReferenceProbe({
			...FAST_SKY_PATCH_NUMERICAL,
			skyPatches: true,
			patchIds: ['sunset.horizon'],
			wavelengthGrid: 'benchmark-5nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			ozonePolicy: 'brion-1998-ozone-295k',
		});
		const patch = result.skyPatches[0];
		const markdown = buildMarkdownReport(result);

		// Reason: ozone policy selection is the next composition comparison after Rayleigh.
		// Source: Atmosphere Composition Plan, Ozone absorption.
		expect(result.visual.ozonePolicy.id).toBe('brion-1998-ozone-295k');
		expect(result.model.ozonePolicy.id).toBe('brion-1998-ozone-295k');
		expect(result.model.ozonePolicy.atlasDoi).toBe('10.5194/essd-5-365-2013');
		expect(patch.ozonePolicy.id).toBe('brion-1998-ozone-295k');
		expect(patch.ozonePolicy.atlasDoi).toBe('10.5194/essd-5-365-2013');
		expect(patch.diagnosticSamples[0].displayHex).toMatch(/^#[0-9a-f]{6}$/);
		expect(markdown).toContain('ozone `brion-1998-ozone-295k`');
		expect(markdown).toContain('- Ozone policy: `brion-1998-ozone-295k`');
	});

	it('can run sky patches through the Bruneton no-visible-absorption policy and report it', function() {
		const result = runReferenceProbe({
			...FAST_SKY_PATCH_NUMERICAL,
			skyPatches: true,
			patchIds: ['midday.zenith'],
			patchSize: { width: 1, height: 1 },
			wavelengthGrid: 'benchmark-5nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			ozonePolicy: 'bruneton-2016-no-visible-absorption',
		});
		const patch = result.skyPatches[0];
		const markdown = buildMarkdownReport(result);
		const center = patch.diagnosticSamples[0];

		// Reason: Task 3 should pass the paper no-visible-absorption contract through normal medium composition, not a transport special case.
		// Source: Reference Plan, Output-Impact Task 3.
		expect(result.visual.ozonePolicy.id).toBe('bruneton-2016-no-visible-absorption');
		expect(result.model.ozonePolicy.id).toBe('bruneton-2016-no-visible-absorption');
		expect(result.model.ozonePolicy.crossSectionModel).toContain('zero visible-band');
		expect(patch.ozonePolicy.id).toBe('bruneton-2016-no-visible-absorption');
		expect(patch.ozonePolicy.crossSectionModel).toContain('zero visible-band');
		expect(center.speciesOpticalDepth.ozone.cumulativeOpticalDepthByWavelength.every((value) => value === 0))
			.toBeTrue();
		expect(markdown).toContain('ozone `bruneton-2016-no-visible-absorption`');
		expect(markdown).toContain('- Ozone policy: `bruneton-2016-no-visible-absorption`');
	});

	it('can run sky patches through named aerosol and molecular-profile policies', function() {
		const result = runReferenceProbe({
			...FAST_SKY_PATCH_NUMERICAL,
			skyPatches: true,
			patchIds: ['sunset.horizon'],
			wavelengthGrid: 'benchmark-5nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'hazy-continental',
			ozonePolicy: 'brion-1998-ozone-295k',
			molecularProfile: 'us-standard-atmosphere-1976-density',
		});
		const patch = result.skyPatches[0];
		const markdown = buildMarkdownReport(result);

		// Reason: composition comparison artifacts must report all selected atmosphere policy inputs.
		// Source: Atmosphere Composition Plan, aerosol/model/profile and species diagnostics.
		expect(result.visual.aerosolPolicy.id).toBe('hazy-continental');
		expect(result.visual.molecularProfile.id).toBe('us-standard-atmosphere-1976-density');
		expect(result.model.aerosolPolicy.id).toBe('hazy-continental');
		expect(result.model.molecularProfile.id).toBe('us-standard-atmosphere-1976-density');
		expect(result.model.molecularProfile.nasaNtrsRecord).toBe('19770009539');
		expect(patch.aerosolPolicy.aod550).toBe(0.25);
		expect(patch.molecularProfile.id).toBe('us-standard-atmosphere-1976-density');
		expect(patch.diagnosticSamples[0].speciesOpticalDepth.mie)
			.toEqual(jasmine.objectContaining({
				cumulativeOpticalDepthByWavelength: jasmine.any(Array),
			}));
		expect(markdown).toContain('aerosol `hazy-continental`');
		expect(markdown).toContain('molecular profile `us-standard-atmosphere-1976-density`');
		expect(markdown).toContain('- Aerosol policy: `hazy-continental`');
		expect(markdown).toContain('- Molecular profile: `us-standard-atmosphere-1976-density`');
	});

	it('can render sky patches at a caller-selected pixel size', function() {
		const result = runReferenceProbe({
			...FAST_SKY_PATCH_NUMERICAL,
			skyPatches: true,
			patchIds: ['sunset.horizon'],
			patchSize: { width: 66, height: 42 },
			fovYDeg: 72,
		});
		const patch = result.skyPatches[0];
		const center = patch.diagnosticSamples.find((sample) => {
			return sample.x === 33 && sample.y === 21;
		});

		// Reason: visual review artifacts need more than the default smoke-test swatch resolution.
		// Source: Atmosphere Composition Plan, comparison artifacts.
		expect(result.visual.patchSize).toEqual({ width: 66, height: 42 });
		expect(patch.size).toEqual({ width: 66, height: 42 });
		expect(patch.camera.fovYDeg).toBe(72);
		expect(patch.pixelImage.width).toBe(66);
		expect(patch.pixelImage.height).toBe(42);
		expect(patch.rows.length).toBe(42);
		expect(patch.rows[0].length).toBe(66);
		expect(center.displayHex).toMatch(/^#[0-9a-f]{6}$/);
	});

	it('can render sky patches with preserve-hue tone mapping', function() {
		const result = runReferenceProbe({
			...FAST_SKY_PATCH_NUMERICAL,
			skyPatches: true,
			patchIds: ['sunset.horizon'],
			wavelengthGrid: 'benchmark-5nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			toneMap: 'preserve-hue',
		});
		const patch = result.skyPatches[0];
		const center = patch.diagnosticSamples.find((sample) => {
			return sample.x === Math.floor(patch.size.width / 2)
				&& sample.y === Math.floor(patch.size.height / 2);
		});
		const markdown = buildMarkdownReport(result);

		// Reason: tone mapping belongs to the output consumer and should prevent display-only red-channel clipping.
		// Source: Atmosphere Color Plan, display/tone-mapping policies.
		expect(result.visual.toneMap).toBe('preserve-hue');
		expect(patch.toneMap).toBe('preserve-hue');
		expect(center.pixel.toneMap).toBe('preserve-hue');
		expect(center.pixel.preventedClipChannels).toContain('r');
		expect(patch.pixelImage.metadata.displayPolicy.toneMap).toBe('preserve-hue');
		expect(patch.pixelImage.metadata.displayPolicy.preventedClipChannels).toContain('r');
		expect(markdown).toContain('tone map `preserve-hue`');
		expect(markdown).toContain('- Tone map: `preserve-hue`');
	});

	it('can render diagnostic finite-sun visual panels without changing transport output', function() {
		const result = runReferenceProbe({
			...FAST_SKY_PATCH_NUMERICAL,
			skyPatches: true,
			patchIds: ['sunset.sun'],
			patchSize: { width: 44, height: 28 },
			wavelengthGrid: 'benchmark-5nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'clear-maritime',
			ozonePolicy: 'brion-1998-ozone-295k',
			toneMap: 'preserve-hue',
			sunVisual: 'diagnostic',
		});
		const patch = result.skyPatches[0];
		const markdown = buildMarkdownReport(result);
		const png = buildPng(result);

		// Reason: the first sun/aureole slice is a CLI diagnostic component, not a canonical transport stage.
		// Source: Sun Visual Plan, Recommended First Step.
		expect(result.visual.sunVisual.mode).toBe('diagnostic');
		expect(patch.sunVisual.mode).toBe('diagnostic');
		expect(patch.sunDiagnostic.pixelSummary.diskHitCount).toBeGreaterThan(0);
		expect(patch.sunDiagnostic.pixelSummary.closestSunPixel.intersectsSolarDisk).toBeTrue();
		expect(patch.sunDiagnostic.panelImages.angularDistance.height).toBe(28);
		expect(patch.sunDiagnostic.panelImages.diskMask.width).toBe(44);
		expect(patch.sunDiagnostic.panelImages.directDisk.kind).toBe('atmosphere-color-pixel-image');
		expect(patch.sunDiagnostic.panelImages.skyPlusDisk.kind).toBe('atmosphere-color-pixel-image');
		expect(patch.sunDiagnostic.angleBuckets.length).toBe(6);
		expect(patch.sunDiagnostic.angleBuckets[0]).toEqual(jasmine.objectContaining({
			id: '0-0.25',
			count: jasmine.any(Number),
			avgSkyRadianceByWavelength: jasmine.any(Array),
			avgDirectDiskByWavelength: jasmine.any(Array),
			avgTotalOpticalDepthByWavelength: jasmine.any(Array),
			opticalDepthValidity: jasmine.objectContaining({
				classification: jasmine.objectContaining({ id: jasmine.any(String) }),
			}),
			avgSpeciesOpticalDepth: jasmine.any(Object),
			avgSpeciesRadianceContribution: jasmine.any(Object),
		}));
		expect(patch.sunDiagnostic.angleBuckets[0].avgSpeciesRadianceContribution.mie)
			.toEqual(jasmine.objectContaining({
				radianceByWavelength: jasmine.any(Array),
			}));
		expect(patch.sunDiagnostic.pixelSummary.closestSunPixel.opticalDepthValidity.highTau)
			.toEqual(jasmine.any(Boolean));
		expect(patch.diagnosticSamples[0].sun.solarAngularDiameterDeg).toBeCloseTo(0.533, 12);
		expect(markdown).toContain('Diagnostic panel order');
		expect(markdown).toContain('Closest sun pixel');
		expect(markdown).toContain('| Angle bucket | Pixels | Avg sky radiance | Avg direct disk | Avg sky+disk | Avg transmittance | Avg total tau | Tau class | Avg species tau | Avg species radiance |');
		expect(markdown).toContain('Center optical-depth validity');
		expect(markdown).toContain('`0-0.25 deg`');
		expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
	});

	it('writes a sky-patch PPM artifact through the CLI --image path', function() {
		const stdout = { write: jasmine.createSpy('stdout.write') };
		const stderr = { write: jasmine.createSpy('stderr.write') };
		const exitCode = runCli([
			'--sky-patches',
			'--patch',
			'midday.zenith',
			'--image',
			cliPixelOutputPath,
			'--format',
			'summary',
			'--view-steps',
			'12',
			'--sun-transmittance-steps',
			'2',
		], {
			stdout,
			stderr,
		});
		const ppm = fs.readFileSync(cliPixelOutputPath, 'utf8');

		// Reason: the CLI image flag is the user-facing way to inspect the new post-pipeline pixel bridge.
		// Source: Reference Code Design, CLI Shape --image.
		expect(exitCode).toBe(0);
		expect(stderr.write).not.toHaveBeenCalled();
		expect(stdout.write).toHaveBeenCalledWith(jasmine.stringMatching(/Atmosphere reference sky patches/));
		expect(ppm).toContain('P3');
		expect(ppm).toContain('44 28');
		expect(ppm).toContain('encoding=srgb exposure=per-patch');
	});

	it('writes sky-patch render progress to stderr when requested', function() {
		const stdout = { write: jasmine.createSpy('stdout.write') };
		const stderr = { write: jasmine.createSpy('stderr.write') };
		const exitCode = runCli([
			'--sky-patches',
			'--patch',
			'midday.zenith',
			'--patch-size',
			'2x1',
			'--view-steps',
			'1',
			'--sun-transmittance-steps',
			'1',
			'--format',
			'summary',
			'--progress',
		], {
			stdout,
			stderr,
		});
		const progressText = stderr.write.calls.allArgs()
			.map(([message]) => message)
			.join('');

		// Reason: full-size sky-patch renders can take long enough that redirected CLI logs need a heartbeat.
		// Source: Atmosphere Reset Design, visual evidence artifact workflow.
		expect(exitCode).toBe(0);
		expect(progressText).toContain('sky-patches start');
		expect(progressText).toContain('patch 1/1 midday.zenith start');
		expect(progressText).toContain('patch 1/1 midday.zenith row 1/1');
		expect(progressText).toContain('done');
		expect(stdout.write).toHaveBeenCalledWith(jasmine.stringMatching(/Atmosphere reference sky patches/));
	});

	it('writes sky-patch render progress to a requested log file', function() {
		const stdout = { write: jasmine.createSpy('stdout.write') };
		const stderr = { write: jasmine.createSpy('stderr.write') };
		const progressLogPath = 'tmp/atmosphere-reference-cli-pixel-test/progress.log';
		const outPath = 'tmp/atmosphere-reference-cli-pixel-test/progress-result.json';
		const exitCode = runCli([
			'--sky-patches',
			'--patch',
			'midday.zenith',
			'--patch-size',
			'2x1',
			'--view-steps',
			'1',
			'--sun-transmittance-steps',
			'1',
			'--out',
			outPath,
			'--progress-log',
			progressLogPath,
		], {
			stdout,
			stderr,
		});
		const progressText = fs.readFileSync(progressLogPath, 'utf8');

		// Reason: background render commands should not need shell stdout/stderr redirection to expose progress.
		// Source: Atmosphere Reset Design, long-running visual evidence artifacts.
		expect(exitCode).toBe(0);
		expect(stdout.write).not.toHaveBeenCalled();
		expect(stderr.write).not.toHaveBeenCalled();
		expect(progressText).toContain('sky-patches start');
		expect(progressText).toContain('patch 1/1 midday.zenith row 1/1');
		expect(progressText).toContain('write tmp/atmosphere-reference-cli-pixel-test/progress-result.json');
		expect(progressText).toContain('done');
	});

	it('rejects unknown sky-patch color and encoding options', function() {
		// Reason: CLI policy options should fail loudly rather than silently changing artifact semantics.
		// Source: Atmosphere Color Plan, explicit CLI color options.
		expect(() => parseArgs(['--sky-patches', '--color', 'mystery']))
			.toThrowError(/Unknown color policy/);
		expect(() => parseArgs(['--sky-patches', '--encoding', 'aces']))
			.toThrowError(/Unknown output encoding/);
		expect(() => parseArgs(['--sky-patches', '--tone-map', 'filmic']))
			.toThrowError(/Unknown tone map/);
		expect(() => parseArgs(['--sky-patches', '--exposure', '-1']))
			.toThrowError(/nonnegative/);
		expect(() => parseArgs(['--sky-patches', '--wavelength-grid', 'rainbow']))
			.toThrowError(/Unknown wavelength grid/);
		expect(() => parseArgs(['--sky-patches', '--solar-spectrum', 'mystery-sun']))
			.toThrowError(/Unknown solar spectrum policy/);
		expect(() => parseArgs(['--sky-patches', '--rayleigh-policy', 'mystery-rayleigh']))
			.toThrowError(/Unknown Rayleigh policy/);
		expect(() => parseArgs(['--sky-patches', '--aerosol-policy', 'mystery-aerosol']))
			.toThrowError(/Unknown aerosol policy/);
		expect(() => parseArgs(['--sky-patches', '--aerosol-phase-policy', 'mystery-aerosol-phase']))
			.toThrowError(/Unknown aerosol phase policy/);
		expect(() => parseArgs(['--sky-patches', '--ozone-policy', 'mystery-ozone']))
			.toThrowError(/Unknown ozone policy/);
		expect(() => parseArgs(['--sky-patches', '--molecular-profile', 'mystery-profile']))
			.toThrowError(/Unknown molecular profile policy/);
		expect(() => parseArgs(['--sky-patches', '--sun-visual', 'pretty']))
			.toThrowError(/Unknown sun visual mode/);
		expect(() => parseArgs(['--sky-dome-grid', '--sampling-profile', 'mystery-profile']))
			.toThrowError(/Unknown sampling profile/);
		expect(() => parseArgs(['--sky-dome-grid', '--sampling-profile', 'paper-comparison', '--view-steps', '12']))
			.toThrowError(/cannot be combined/);
		expect(() => parseArgs(['--sky-dome-grid', '--sampling-profile', 'paper-comparison', '--sun-transmittance-steps', '2']))
			.toThrowError(/cannot be combined/);
		expect(() => parseArgs(['--sky-dome-grid', '--multiple-scattering-reference', 'order-by-order-grid', '--multiple-scattering-targets', 'mystery']))
			.toThrowError(/Unknown multiple-scattering target mode/);
		expect(() => parseArgs(['--sky-dome-grid', '--multiple-scattering-targets', 'dome-rings']))
			.toThrowError(/requires --multiple-scattering-reference/);
		expect(() => parseArgs(['--sky-patches', '--multiple-scattering-reference', 'order-by-order-grid', '--multiple-scattering-targets', 'dome-rings']))
			.toThrowError(/requires --sky-dome-grid/);
		expect(() => parseArgs(['--sky-dome-grid', '--multiple-scattering-reference', 'order-by-order-grid', '--multiple-scattering-angular-samples', '0']))
			.toThrowError(/positive integer/);
		expect(() => parseArgs(['--sky-dome-grid', '--multiple-scattering-max-order', '3']))
			.toThrowError(/requires --multiple-scattering-reference/);
		expect(() => parseArgs(['--sky-dome-grid', '--multiple-scattering-reference', 'order-by-order-grid', '--multiple-scattering-max-order', '5']))
			.toThrowError(/supports orders 2-4/);
		expect(() => parseArgs(['--sky-dome-grid', '--multiple-scattering-reference', 'order-by-order-grid', '--multiple-scattering-targets', 'dome-rings', '--multiple-scattering-max-order', '4']))
			.toThrowError(/diagnostic-target only/);
		expect(() => parseArgs(['--sky-dome-grid', '--multiple-scattering-reference', 'none', '--multiple-scattering-angular-samples', '4']))
			.toThrowError(/none does not accept solver, field, or image sidecar options/);
		expect(() => parseArgs(['--sky-patches', '--multiple-scattering-reference', 'iterative-field-grid']))
			.toThrowError(/requires --sky-dome-grid/);
		expect(() => parseArgs(['--sky-dome-grid', '--multiple-scattering-reference', 'iterative-field-grid', '--multiple-scattering-field-interpolation', 'spline']))
			.toThrowError(/Unknown multiple-scattering field interpolation mode/);
		expect(() => parseArgs(['--sky-dome-grid', '--multiple-scattering-reference', 'iterative-field-grid', '--multiple-scattering-field-direction-basis', 'random']))
			.toThrowError(/Unknown multiple-scattering field direction basis/);
		expect(() => parseArgs(['--sky-dome-grid', '--multiple-scattering-reference', 'iterative-field-grid', '--multiple-scattering-field-altitude-grid', 'stratosphere-only']))
			.toThrowError(/Unknown multiple-scattering field altitude grid/);
		expect(() => parseArgs(['--sky-dome-grid', '--multiple-scattering-reference', 'order-by-order-grid', '--multiple-scattering-field-interpolation', 'weighted']))
			.toThrowError(/requires --multiple-scattering-reference iterative-field-grid/);
		expect(() => parseArgs(['--sky-dome-grid', '--multiple-scattering-reference', 'order-by-order-grid', '--multiple-scattering-field-direction-basis', 'horizon-sun']))
			.toThrowError(/requires --multiple-scattering-reference iterative-field-grid/);
		expect(() => parseArgs(['--sky-dome-grid', '--multiple-scattering-reference', 'order-by-order-grid', '--multiple-scattering-field-altitude-grid', 'lower-atmosphere']))
			.toThrowError(/requires --multiple-scattering-reference iterative-field-grid/);
		expect(() => parseArgs(['--sky-dome-grid', '--multiple-scattering-reference', 'order-by-order-grid', '--multiple-scattering-image-dir', 'tmp/sidecar-images']))
			.toThrowError(/requires --multiple-scattering-reference iterative-field-grid/);
		expect(() => parseArgs(['--sky-patches', '--view-steps', '0']))
			.toThrowError(/positive integer/);
		expect(() => parseArgs(['--sky-patches', '--sun-transmittance-steps', '1.5']))
			.toThrowError(/positive integer/);
		expect(() => parseArgs(['--sky-patches', '--patch-size', '44']))
			.toThrowError(/WIDTHxHEIGHT/);
		expect(() => parseArgs(['--sky-patches', '--patch-size', '1024x1024']))
			.toThrowError(/at most/);
		expect(() => parseArgs(['--sky-patches', '--fov-y-deg', '0']))
			.toThrowError(/greater than 0/);
		expect(() => parseArgs(['--sky-patches', '--fov-y-deg', '180']))
			.toThrowError(/less than 180/);
	});

	it('formats a concise summary for terminal inspection', function() {
		const result = runReferenceProbe({
			probeIds: ['globe.zenith'],
			stage: 'full',
		});
		const summary = formatSummary(result);

		// Reason: summary mode gives quick evidence without forcing a caller to inspect JSON.
		// Source: Reference Code Design, CLI Shape --format summary.
		expect(summary).toContain('Atmosphere reference probes (full)');
		expect(summary).toContain('globe.zenith');
		expect(summary).toContain('#');
	});

	it('runs a named flat light extent scenario with opacity and useful-light thresholds', function() {
		const result = runReferenceProbe({
			lightExtent: true,
			lightSetIds: ['flat.closeSun.horizontalDenseAir'],
		});
		const probe = result.lightExtents[0];
		const firstSample = probe.samples[0];
		const lastSample = probe.samples[probe.samples.length - 1];

		// Reason: the diagnostic classifies a finite-Sun flat source path before we fake distant detail in the renderer.
		// Source: Reference Test Design, flat large-lateral-path checks; probe report threshold semantics.
		expect(result.kind).toBe('flat-atmosphere-reference-light-extent');
		expect(result.lightExtentCount).toBe(1);
		expect(probe.id).toBe('flat.closeSun.horizontalDenseAir');
		expect(probe.parameters.sun).toEqual({
			brightnessScale: 1,
			elevationDeg: 0,
			directLightAvailable: true,
		});
		expect(probe.parameters.source.radiusKm).toBe(50);
		expect(firstSample.transmittance).toBe(1);
		expect(firstSample.relativeEffectiveIrradiance).toBe(1);
		expect(firstSample.transmissionLossFraction).toBe(0);
		expect(lastSample.transmittance).toBeLessThan(firstSample.transmittance);
		expect(lastSample.relativeEffectiveIrradiance).toBeLessThan(firstSample.relativeEffectiveIrradiance);
		expect(probe.thresholdCrossings.opacity.status).toBe('crossed');
		expect(probe.thresholdCrossings.usefulLight.status).toBe('crossed');
		expect(probe.thresholdCrossings.usefulLight.pathDistanceKm)
			.toBeLessThan(probe.thresholdCrossings.opacity.pathDistanceKm);
		expect(probe.functionalExtent.status).toBe('bounded');
		expect(probe.functionalExtent.limitingThreshold).toBe('usefulLight');
	});

	it('runs app-linked light extent floors against the named flat defaults', function() {
		const result = runReferenceProbe({
			lightExtent: true,
			lightSetIds: ['app.flatDefaults.midday', 'app.flatDefaults.midnight'],
		});
		const midday = result.lightExtents[0];
		const midnight = result.lightExtents[1];

		// Reason: app-linked floors are configuration-regression evidence, not broad physical truth claims.
		// Source: Reference Test Plan, Post-Pipeline Diagnostic: Flat Light Extent.
		expect(midday.parameters.sun.elevationDeg).toBeCloseTo(72.9232574407232, 10);
		expect(midnight.parameters.sun.elevationDeg).toBeCloseTo(20.0979340875104, 10);
		expect(midday.floorCrossings.effectiveIrradiance[0].floor.id)
			.toBe('app.flatDefaults.onePermilleMiddayEffective');
		expect(midday.floorCrossings.effectiveIrradiance[0].status).toBe('crossed');
		expect(midnight.floorCrossings.effectiveIrradiance[0].status).toBe('crossed');
		expect(midnight.baseline.effectiveIrradiance).toBeGreaterThan(
			midday.floorCrossings.effectiveIrradiance[0].floor.value,
		);
	});

	it('runs real-Sun light extent floors against the named San Jose defaults', function() {
		const result = runReferenceProbe({
			lightExtent: true,
			lightSetIds: ['realSun.sanJose.midday', 'realSun.sanJose.midnight'],
		});
		const midday = result.lightExtents[0];
		const midnight = result.lightExtents[1];

		// Reason: real-Sun floors anchor the diagnostic to app globe defaults without making a flat-world claim.
		// Source: Reference Test Plan, Post-Pipeline Diagnostic: Flat Light Extent; globe simulation solar defaults.
		expect(midday.parameters.sun.elevationDeg).toBeCloseTo(75.90639477250807, 10);
		expect(midday.floorCrossings.effectiveIrradiance[0].floor.units).toBe('W/m2');
		expect(midday.floorCrossings.effectiveIrradiance[0].status).toBe('not-crossed');
		expect(midnight.parameters.sun.elevationDeg).toBeCloseTo(-29.393749946395037, 10);
		expect(midnight.parameters.sun.directLightAvailable).toBe(false);
		expect(midnight.floorCrossings.effectiveIrradiance[0].status).toBe('already-crossed');
		expect(midnight.floorCrossings.effectiveIrradiance[0].pathDistanceKm).toBe(0);
	});

	it('writes report-friendly Markdown, SVG, and summary strings from a light extent run', function() {
		const result = runReferenceProbe({
			lightExtent: true,
			lightSetIds: ['flat.closeSun.horizontalDenseAir'],
		});
		const markdown = buildMarkdownReport(result, {
			imagePath: 'tmp/light-extent.svg',
			outPath: 'tmp/light-extent.json',
			reportPath: 'tmp/report.md',
		});
		const svg = buildSvg(result);
		const summary = formatSummary(result);

		// Reason: the probe is meant to produce inspectable evidence, not just raw numeric JSON.
		// Source: Reference Code Design, human-facing reports; flat light extent report contract.
		expect(markdown).toContain('# Flat Light Extent Probe');
		expect(markdown).toContain('flat.closeSun.horizontalDenseAir');
		expect(markdown).toContain('![Flat light extent probe](light-extent.svg)');
		expect(svg).toContain('<svg');
		expect(svg).toContain('Close Sun, Horizontal Dense Air');
		expect(summary).toContain('Flat light extent probes');
		expect(summary).toContain('limiter=usefulLight');
	});

	it('fails loudly for unknown probes', function() {
		// Reason: probe ids are explicit run selections; unknown names should not silently fall back.
		// Source: Reference Code Design, CLI failure behavior.
		expect(() => runReferenceProbe({ probeIds: ['missing.probe'] }))
			.toThrowError(/Unknown reference probe: missing\.probe/);
	});
});
