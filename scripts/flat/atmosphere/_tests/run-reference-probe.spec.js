import fs from 'node:fs';
import {
	buildImageArtifact,
	buildMarkdownReport,
	buildPng,
	buildPpm,
	buildSvg,
	formatSummary,
	parseArgs,
	resolveSkyPatchWavelengthGrid,
	runCli,
	runReferenceProbe,
} from '../run-reference-probe.js';

describe('run-reference-probe CLI helpers', function() {
	const cliPixelOutputPath = 'tmp/atmosphere-reference-cli-pixel-test/sky.ppm';

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

	it('parses flat light extent scenario flags', function() {
		const options = parseArgs([
			'--light-set',
			'flat.closeSun.horizontalDenseAir,flat.closeSun.shallowUpward',
			'--light-config',
			'scripts/flat/atmosphere/data/reference/light-extent-scenarios.json',
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
			lightConfigPath: 'scripts/flat/atmosphere/data/reference/light-extent-scenarios.json',
			lightExtent: true,
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
			'integrateDiffuseSkyAirlight',
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
	});

	it('can run sky patches through the analytic preview color fallback', function() {
		const result = runReferenceProbe({
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
		expect(markdown).toContain('Center-column row');
	});

	it('can run sky patches through the Bucholtz Rayleigh policy and report it', function() {
		const result = runReferenceProbe({
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

	it('can run sky patches through named aerosol and molecular-profile policies', function() {
		const result = runReferenceProbe({
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

	it('can render a named diagnostic haze-lift scattering comparison mode', function() {
		const result = runReferenceProbe({
			skyPatches: true,
			patchIds: ['midday.zenith', 'midday.horizon'],
			patchSize: { width: 8, height: 6 },
			wavelengthGrid: 'benchmark-5nm',
			solarSpectrum: 'astm-g173',
			rayleighPolicy: 'bucholtz-standard-air',
			aerosolPolicy: 'clear-maritime',
			ozonePolicy: 'brion-1998-ozone-295k',
			molecularProfile: 'us-standard-atmosphere-1976-density',
			toneMap: 'preserve-hue',
			scatteringMode: 'single-plus-haze-lift',
			hazeLiftStrength: 0.02,
		});
		const zenithCenter = result.skyPatches[0].diagnosticSamples.find((sample) => {
			return sample.x === 4 && sample.y === 3;
		});
		const horizonCenter = result.skyPatches[1].diagnosticSamples.find((sample) => {
			return sample.x === 4 && sample.y === 3;
		});
		const markdown = buildMarkdownReport(result);

		// Reason: this mode is a named diagnostic for high-tau transport-completeness experiments.
		// Source: Sun Visual Plan, Midday Horizon Roadmap, single-plus-haze-lift comparison path.
		expect(result.visual.scatteringMode.id).toBe('single-plus-haze-lift');
		expect(result.visual.scatteringMode.hazeLiftStrength).toBe(0.02);
		expect(result.skyPatches[1].scatteringMode.id).toBe('single-plus-haze-lift');
		expect(zenithCenter.hazeLiftDiagnostic.activation).toBe(0);
		expect(horizonCenter.hazeLiftDiagnostic.activation).toBeGreaterThan(0);
		expect(horizonCenter.renderedByWavelength[40]).toBeGreaterThan(horizonCenter.finalByWavelength[40]);
		expect(markdown).toContain('Scattering mode: `single-plus-haze-lift`');
		expect(markdown).toContain('Center canonical radiance');
		expect(markdown).toContain('Center rendered radiance');
		expect(markdown).toContain('Center haze lift');
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
		expect(() => parseArgs(['--sky-patches', '--ozone-policy', 'mystery-ozone']))
			.toThrowError(/Unknown ozone policy/);
		expect(() => parseArgs(['--sky-patches', '--molecular-profile', 'mystery-profile']))
			.toThrowError(/Unknown molecular profile policy/);
		expect(() => parseArgs(['--sky-patches', '--sun-visual', 'pretty']))
			.toThrowError(/Unknown sun visual mode/);
		expect(() => parseArgs(['--sky-patches', '--scattering-mode', 'magic']))
			.toThrowError(/Unknown scattering mode/);
		expect(() => parseArgs(['--sky-patches', '--haze-lift-strength', '-0.1']))
			.toThrowError(/nonnegative/);
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
