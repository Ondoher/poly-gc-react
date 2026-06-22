import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { linearRgbToPixel, pixelImageToPng } from './color/pixel-output.js';
import { CpuSpectralReferenceIntegrator } from './reference/index.js';
import {
	buildPng,
	runReferenceProbe,
	skyDomeSampleMaskIds,
} from './run-reference-probe.js';

const BRUNETON_AEROSOL_POLICY_ID = 'bruneton-2016-kider-fit';
const DEFAULT_DOME_SIZE = 18;
const DEFAULT_SAMPLING_PROFILE = 'paper-comparison';
const DEFAULT_DOME_SAMPLE_MASK = 'horizon-ring';
const IMAGE_SWEEP_POLICIES = Object.freeze([
	'rayleigh-only',
	'clear-maritime',
	BRUNETON_AEROSOL_POLICY_ID,
	'clear-continental',
	'hazy-continental',
]);
const SKY_DOME_PANEL_SCENES = Object.freeze([
	Object.freeze({ id: '06h00.sunZenith87', label: '06h00 / 87 deg' }),
	Object.freeze({ id: '10h15.sunZenith41', label: '10h15 / 41 deg' }),
	Object.freeze({ id: '11h15.sunZenith31', label: '11h15 / 31 deg' }),
	Object.freeze({ id: '13h15.sunZenith21', label: '13h15 / 21 deg' }),
]);
const DISPLAY_PROXY_VARIANTS = Object.freeze([
	Object.freeze({ id: 'display-exp4', label: 'Display exposure 4', exposure: 4 }),
	Object.freeze({ id: 'display-exp12', label: 'Display exposure 12', exposure: 12 }),
]);
const SURFACE_PROXY_VARIANTS = Object.freeze([
	Object.freeze({
		id: 'surface-neutral-lift25',
		label: 'Neutral surface proxy, 25% horizon lift',
		kind: 'surface-bounce-proxy',
		relativeLift: 0.25,
		linearRgb: { r: 1, g: 1, b: 1 },
	}),
	Object.freeze({
		id: 'surface-blue-lift25',
		label: 'Blue/cyan surface proxy, 25% horizon lift',
		kind: 'surface-bounce-proxy',
		relativeLift: 0.25,
		linearRgb: { r: 0.45, g: 0.72, b: 1.35 },
	}),
	Object.freeze({
		id: 'surface-warm-lift25',
		label: 'Warm ground proxy, 25% horizon lift',
		kind: 'surface-bounce-proxy',
		relativeLift: 0.25,
		linearRgb: { r: 1.3, g: 1.05, b: 0.72 },
	}),
]);
const AUREOLE_PROXY_VARIANTS = Object.freeze([
	Object.freeze({
		id: 'wide-aureole-10deg-lift35',
		label: 'Wide warm aureole proxy, 10 deg, 35% horizon lift',
		kind: 'aureole-proxy',
		relativeLift: 0.35,
		angularSigmaDeg: 10,
		linearRgb: { r: 1.45, g: 1.06, b: 0.62 },
	}),
	Object.freeze({
		id: 'wide-aureole-18deg-lift25',
		label: 'Wide soft aureole proxy, 18 deg, 25% horizon lift',
		kind: 'aureole-proxy',
		relativeLift: 0.25,
		angularSigmaDeg: 18,
		linearRgb: { r: 1.35, g: 1.08, b: 0.78 },
	}),
]);

export function parseWeaknessFactorAuditArgs(argv) {
	const options = {
		includeTransport: true,
		domeSize: DEFAULT_DOME_SIZE,
		samplingProfile: DEFAULT_SAMPLING_PROFILE,
		domeSampleMask: DEFAULT_DOME_SAMPLE_MASK,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--help' || arg === '-h') {
			options.help = true;
			continue;
		}

		if (arg === '--out-dir') {
			options.outDir = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--dome-size') {
			options.domeSize = readPositiveIntegerOption(argv, ++index, arg);
			continue;
		}

		if (arg === '--sampling-profile') {
			options.samplingProfile = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--dome-sample-mask') {
			options.domeSampleMask = readOptionValue(argv, ++index, arg);
			continue;
		}

		if (arg === '--skip-transport') {
			options.includeTransport = false;
			continue;
		}

		throw new Error(`Unknown weakness factor audit option: ${arg}`);
	}

	if (!skyDomeSampleMaskIds().includes(options.domeSampleMask)) {
		throw new Error(`Unknown dome sample mask: ${options.domeSampleMask}`);
	}

	return options;
}

export function runWeaknessFactorAudit({
	includeTransport = false,
	domeSize = DEFAULT_DOME_SIZE,
	samplingProfile = DEFAULT_SAMPLING_PROFILE,
	domeSampleMask = DEFAULT_DOME_SAMPLE_MASK,
	outDir,
	progressReporter,
} = {}) {
	const sourceQuadrature = createSourceQuadratureDiagnostic();
	const transport = includeTransport
		? runTransportDiagnostics({
			domeSize,
			samplingProfile,
			domeSampleMask,
			outDir,
			progressReporter,
		})
		: {
			status: 'not-run',
			reason: 'Run without --skip-transport to generate real skydome and proxy factor artifacts.',
		};
	const audit = {
		kind: 'flat-atmosphere-weakness-factor-audit',
		generatedAt: null,
		generatedAtPolicy: 'omitted-for-deterministic-output',
		objective: 'Rank the current atmosphere model weaknesses behind the brown daylight perimeter and too-small sunset/aureole area.',
		sourceQuadrature,
		transport,
	};

	return {
		...audit,
		analysis: analyzeWeaknessFactors(audit),
	};
}

export function writeWeaknessFactorAuditArtifacts(audit, outDir) {
	if (!outDir) {
		throw new Error('writeWeaknessFactorAuditArtifacts requires outDir');
	}

	fs.mkdirSync(outDir, { recursive: true });
	const jsonPath = path.join(outDir, 'audit.json');
	const markdownPath = path.join(outDir, 'audit.md');
	const manifestPath = path.join(outDir, 'manifest.json');

	fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
	fs.writeFileSync(markdownPath, buildWeaknessFactorAuditMarkdown(audit));
	fs.writeFileSync(manifestPath, `${JSON.stringify({
		kind: 'flat-atmosphere-weakness-factor-audit-manifest',
		generatedAt: null,
		generatedAtPolicy: 'omitted-for-deterministic-output',
		artifacts: {
			json: path.basename(jsonPath),
			markdown: path.basename(markdownPath),
			imagesDir: audit.transport.status === 'complete' ? 'images' : null,
			progressLog: audit.transport.status === 'complete' ? 'progress.log' : null,
		},
		objective: audit.objective,
		recommendation: audit.analysis.recommendation,
	}, null, 2)}\n`);

	return {
		jsonPath,
		markdownPath,
		manifestPath,
	};
}

export function buildWeaknessFactorAuditMarkdown(audit) {
	return [
		'# Weakness Factor Audit',
		'',
		audit.objective,
		'',
		'## Recommendation',
		'',
		...audit.analysis.recommendation.map((line) => `- ${line}`),
		'',
		'## Source Quadrature',
		'',
		`Status: \`${audit.sourceQuadrature.status}\``,
		`One source radiance: \`${formatNumber(audit.sourceQuadrature.oneSourceRadiance)}\``,
		`Split-weight radiance: \`${formatNumber(audit.sourceQuadrature.splitWeightRadiance)}\`, ratio \`${formatNumber(audit.sourceQuadrature.splitWeightRatio)}\``,
		`Zero-weight-extra radiance: \`${formatNumber(audit.sourceQuadrature.zeroWeightExtraRadiance)}\`, ratio \`${formatNumber(audit.sourceQuadrature.zeroWeightExtraRatio)}\``,
		`Expected weighted ratio: \`${formatNumber(audit.sourceQuadrature.expectedWeightedRatio)}\``,
		'',
		formatTransportSection(audit.transport),
	].join('\n');
}

export function createSourceQuadratureDiagnostic() {
	const oneSourceRadiance = traceControlledSourceRadiance([
		createControlledSourceSample({ id: 'one', weight: 1 }),
	]);
	const splitWeightRadiance = traceControlledSourceRadiance([
		createControlledSourceSample({ id: 'split-a', weight: 0.5 }),
		createControlledSourceSample({ id: 'split-b', weight: 0.5 }),
	]);
	const zeroWeightExtraRadiance = traceControlledSourceRadiance([
		createControlledSourceSample({ id: 'one', weight: 1 }),
		createControlledSourceSample({ id: 'zero-extra', weight: 0 }),
	]);
	const splitWeightRatio = splitWeightRadiance / oneSourceRadiance;
	const zeroWeightExtraRatio = zeroWeightExtraRadiance / oneSourceRadiance;
	const status = splitWeightRatio > 1.9 && zeroWeightExtraRatio > 1.9
		? 'source-sample-weight-not-applied'
		: 'source-sample-weight-applied';

	return {
		status,
		expectedWeightedRatio: 1,
		oneSourceRadiance,
		splitWeightRadiance,
		splitWeightRatio,
		zeroWeightExtraRadiance,
		zeroWeightExtraRatio,
		interpretation: status === 'source-sample-weight-not-applied'
			? 'Finite solar-disk and multi-source quadrature cannot be trusted yet because extra source samples add energy even when their weight is zero.'
			: 'Source quadrature weights appear to be applied in single-scattering accumulation.',
	};
}

function runTransportDiagnostics({
	domeSize,
	samplingProfile,
	domeSampleMask,
	outDir,
	progressReporter,
}) {
	const imageDir = outDir ? path.join(outDir, 'images') : null;
	if (imageDir) {
		fs.mkdirSync(imageDir, { recursive: true });
	}

	progressReporter?.({
		phase: 'baseline-full-start',
		domeSize,
		samplingProfile,
	});
	const baselineFull = runReferenceProbe({
		...paperComparisonInputs(),
		skyDomeGrid: true,
		domeSize,
		domeSampleMask: 'full',
		samplingProfile,
		aerosolPolicy: BRUNETON_AEROSOL_POLICY_ID,
		progressReporter: (event) => progressReporter?.({
			...event,
			diagnostic: 'baseline-full',
		}),
	});
	if (imageDir) {
		fs.writeFileSync(path.join(imageDir, 'baseline-full.png'), buildPng(baselineFull));
	}
	progressReporter?.({ phase: 'baseline-full-complete' });

	const aerosolSweep = runAerosolPolicySweep({
		domeSize,
		samplingProfile,
		domeSampleMask,
		imageDir,
		progressReporter,
	});
	const proxySweep = runProxySweep({
		baselineFull,
		imageDir,
	});

	return {
		status: 'complete',
		domeSize,
		samplingProfile,
		domeSampleMask,
		fixedInputs: paperComparisonInputs(),
		baselineFull: summarizeResultPanels('baseline-full', baselineFull),
		aerosolSweep,
		proxySweep,
	};
}

function runAerosolPolicySweep({
	domeSize,
	samplingProfile,
	domeSampleMask,
	imageDir,
	progressReporter,
}) {
	const variants = [];

	for (const policyId of IMAGE_SWEEP_POLICIES) {
		progressReporter?.({
			phase: 'aerosol-sweep-variant-start',
			aerosolPolicy: policyId,
			domeSize,
			samplingProfile,
			domeSampleMask,
		});
		const result = runReferenceProbe({
			...paperComparisonInputs(),
			skyDomeGrid: true,
			domeSize,
			domeSampleMask,
			samplingProfile,
			aerosolPolicy: policyId,
			progressReporter: (event) => progressReporter?.({
				...event,
				diagnostic: 'aerosol-sweep',
				aerosolPolicy: policyId,
			}),
		});
		const imageName = `aerosol-${policyId}-${domeSampleMask}-d${domeSize}.png`;
		if (imageDir) {
			fs.writeFileSync(path.join(imageDir, imageName), buildPng(result));
		}
		variants.push({
			id: policyId,
			label: policyId,
			image: imageDir ? `images/${imageName}` : null,
			panels: summarizeResultPanels(policyId, result).panels,
		});
		progressReporter?.({
			phase: 'aerosol-sweep-variant-complete',
			aerosolPolicy: policyId,
		});
	}

	return {
		status: 'complete',
		domeSampleMask,
		variants,
		deltaFromBruneton: compareVariantPanels(variants, BRUNETON_AEROSOL_POLICY_ID),
	};
}

function runProxySweep({
	baselineFull,
	imageDir,
}) {
	const baselinePanels = summarizeResultPanels('baseline-full', baselineFull).panels;
	const variants = [
		...DISPLAY_PROXY_VARIANTS.map((variant) => createDisplayProxyVariant(baselineFull, variant)),
		...SURFACE_PROXY_VARIANTS.map((variant) => createAdditiveProxyVariant(baselineFull, variant)),
		...AUREOLE_PROXY_VARIANTS.map((variant) => createAdditiveProxyVariant(baselineFull, variant)),
	];

	for (const variant of variants) {
		if (!imageDir) {
			continue;
		}

		fs.writeFileSync(
			path.join(imageDir, `${variant.id}.png`),
			pixelImageToPng(stackPixelImagesVertically(
				variant.pixelImages,
				`${variant.id} proxy image`,
			)),
		);
	}

	return {
		status: 'complete',
		note: 'These proxy variants are display-side sensitivity rulers, not canonical transport or proposed physical implementations.',
		baselinePanels,
		variants: variants.map((variant) => ({
			id: variant.id,
			label: variant.label,
			kind: variant.kind,
			image: imageDir ? `images/${variant.id}.png` : null,
			panels: variant.panels,
			deltaFromBaseline: variant.panels.map((panel) => {
				const baseline = baselinePanels.find((candidate) => candidate.id === panel.id);
				return createPanelDelta(panel, baseline);
			}),
		})),
	};
}

function createDisplayProxyVariant(result, variant) {
	const pixelImages = result.skyDomePanels.map((panel) => {
		return remapPixelImage(panel.pixelImage, (pixel) => pixel.linearRgb, {
			encoding: panel.displayEncoding,
			toneMap: panel.toneMap,
			exposure: variant.exposure,
		});
	});

	return {
		id: variant.id,
		label: variant.label,
		kind: 'display-remap-proxy',
		pixelImages,
		panels: result.skyDomePanels.map((panel, index) => {
			return summarizePanelPixelImage(panel, pixelImages[index]);
		}),
	};
}

function createAdditiveProxyVariant(result, variant) {
	const pixelImages = result.skyDomePanels.map((panel) => {
		const baseHorizonLuminance = estimatePanelHorizonLinearLuminance(panel.pixelImage);
		const normalizedColor = normalizeLinearRgbToLuminance(variant.linearRgb);

		return remapPixelImage(panel.pixelImage, (pixel, geometry) => {
			const proxyWeight = proxyWeightForGeometry(geometry, panel, variant);
			const lift = baseHorizonLuminance * variant.relativeLift * proxyWeight;

			return {
				r: pixel.linearRgb.r + normalizedColor.r * lift,
				g: pixel.linearRgb.g + normalizedColor.g * lift,
				b: pixel.linearRgb.b + normalizedColor.b * lift,
			};
		}, {
			encoding: panel.displayEncoding,
			toneMap: panel.toneMap,
			exposure: panel.displayExposure,
		});
	});

	return {
		id: variant.id,
		label: variant.label,
		kind: variant.kind,
		pixelImages,
		panels: result.skyDomePanels.map((panel, index) => {
			return summarizePanelPixelImage(panel, pixelImages[index]);
		}),
	};
}

function analyzeWeaknessFactors(audit) {
	const recommendation = [];
	const transport = audit.transport;

	if (audit.sourceQuadrature.status === 'source-sample-weight-not-applied') {
		recommendation.push(
			'Weakest contract found: source-sample quadrature weights are ignored by single-scattering accumulation; finite-Sun/aureole sampling cannot be made trustworthy until this is fixed.',
		);
	}

	if (transport.status !== 'complete') {
		recommendation.push(
			'Run the transport diagnostics before ranking aerosol, surface-coupling, and aureole/image-shape effects.',
		);

		return {
			recommendation,
		};
	}

	const aerosolAssessment = assessAerosolSweep(transport.aerosolSweep);
	const proxyAssessment = assessProxySweep(transport.proxySweep);

	recommendation.push(aerosolAssessment.summary);
	recommendation.push(proxyAssessment.surfaceSummary);
	recommendation.push(proxyAssessment.aureoleSummary);
	recommendation.push(
		'Recommended next implementation: fix source quadrature/finite solar source handling first, then rerun the sunset/aureole comparison with real weighted source samples; after that, implement a physical surface/ground secondary-source experiment. Keep aerosol parameters named and paper-aligned rather than tuning them as the main fix.',
	);

	return {
		recommendation,
		aerosolAssessment,
		proxyAssessment,
	};
}

function assessAerosolSweep(aerosolSweep) {
	const lowSunRows = aerosolSweep.variants.map((variant) => {
		const lowSun = variant.panels.find((panel) => panel.id === '06h00.sunZenith87');
		const daylight = daylightAggregate(variant.panels);

		return {
			id: variant.id,
			lowSunWarmPercent: lowSun?.warmAffectedPercent ?? null,
			lowSunBlueDominance: lowSun?.horizonBlueDominance ?? null,
			daylightBlueDominance: daylight.horizonBlueDominance,
			daylightBrownishPercent: daylight.brownishPercent,
			daylightSaturation: daylight.horizonSaturation,
		};
	});
	const bruneton = lowSunRows.find((row) => row.id === BRUNETON_AEROSOL_POLICY_ID);
	const bestDaylightBlue = [...lowSunRows].sort((a, b) => {
		return (b.daylightBlueDominance ?? -Infinity) - (a.daylightBlueDominance ?? -Infinity);
	})[0];
	const strongestWarm = [...lowSunRows].sort((a, b) => {
		return (b.lowSunWarmPercent ?? -Infinity) - (a.lowSunWarmPercent ?? -Infinity);
	})[0];

	return {
		rows: lowSunRows,
		bestDaylightBlue,
		strongestWarm,
		summary: `Aerosol policy is responsive but not decisive: best daylight blue dominance is ${formatNumber(bestDaylightBlue.daylightBlueDominance)} from ${bestDaylightBlue.id}, while Bruneton/Kider is ${formatNumber(bruneton.daylightBlueDominance)}; low-Sun warm coverage is already saturated or near-saturated in the horizon ring, so aerosol changes do not isolate the too-small full-dome sunset spot.`,
	};
}

function assessProxySweep(proxySweep) {
	const surfaceRows = proxySweep.variants
		.filter((variant) => variant.kind === 'surface-bounce-proxy')
		.map((variant) => summarizeProxyVariant(variant));
	const aureoleRows = proxySweep.variants
		.filter((variant) => variant.kind === 'aureole-proxy')
		.map((variant) => summarizeProxyVariant(variant));
	const bestSurfaceBlue = [...surfaceRows].sort((a, b) => {
		return b.daylightBlueDominanceDelta - a.daylightBlueDominanceDelta;
	})[0];
	const bestAureoleWarm = [...aureoleRows].sort((a, b) => {
		return b.lowSunWarmAreaDelta - a.lowSunWarmAreaDelta;
	})[0];
	const aureoleSummary = bestAureoleWarm.lowSunWarmAreaDelta > 0
		? `Wide aureole proxies move the full-dome low-Sun warm area; the strongest proxy (${bestAureoleWarm.id}) changes low-Sun warm area by ${formatNumber(bestAureoleWarm.lowSunWarmAreaDelta)} percentage points.`
		: `Display-side aureole proxies did not increase the full-dome low-Sun warm area; the best proxy (${bestAureoleWarm.id}) changed it by ${formatNumber(bestAureoleWarm.lowSunWarmAreaDelta)} percentage points, so this proxy is not a credible substitute for fixing weighted finite-source transport.`;

	return {
		surfaceRows,
		aureoleRows,
		bestSurfaceBlue,
		bestAureoleWarm,
		surfaceSummary: `Surface-coupling proxies move the daylight perimeter only when the added secondary light is strongly blue-biased; the best proxy (${bestSurfaceBlue.id}) changes daylight blue dominance by ${formatNumber(bestSurfaceBlue.daylightBlueDominanceDelta)}, so generic neutral/warm ground bounce is not a credible primary fix for brown edges.`,
		aureoleSummary,
	};
}

function summarizeProxyVariant(variant) {
	const lowSunDelta = variant.deltaFromBaseline.find((panel) => panel.id === '06h00.sunZenith87');
	const daylightDelta = daylightDeltaAggregate(variant.deltaFromBaseline);

	return {
		id: variant.id,
		lowSunWarmAreaDelta: lowSunDelta?.warmAffectedPercent ?? 0,
		lowSunSunNeighborhoodWarmDelta: lowSunDelta?.sunNeighborhoodWarmPercent ?? 0,
		daylightBlueDominanceDelta: daylightDelta.horizonBlueDominance,
		daylightBrownishPercentDelta: daylightDelta.brownishPercent,
		daylightSaturationDelta: daylightDelta.horizonSaturation,
	};
}

function formatTransportSection(transport) {
	if (transport.status !== 'complete') {
		return `## Transport Diagnostics\n\nTransport status: \`${transport.status}\` - ${transport.reason}`;
	}

	return [
		'## Transport Diagnostics',
		'',
		`Transport status: \`${transport.status}\`, dome size \`${transport.domeSize}\`, sampling profile \`${transport.samplingProfile}\`, perimeter mask \`${transport.domeSampleMask}\`.`,
		'',
		'### Aerosol Policy Sweep',
		'',
		'| Policy | Low-Sun warm % | Daylight blue dominance | Daylight brownish % | Daylight horizon saturation | Image |',
		'| --- | ---: | ---: | ---: | ---: | --- |',
		...transport.aerosolSweep.variants.map((variant) => {
			const lowSun = variant.panels.find((panel) => panel.id === '06h00.sunZenith87');
			const daylight = daylightAggregate(variant.panels);
			return `| ${variant.id} | ${formatNumber(lowSun?.warmAffectedPercent)} | ${formatNumber(daylight.horizonBlueDominance)} | ${formatNumber(daylight.brownishPercent)} | ${formatNumber(daylight.horizonSaturation)} | ${variant.image ? `\`${variant.image}\`` : ''} |`;
		}),
		'',
		'### Proxy Sweep',
		'',
		transport.proxySweep.note,
		'',
		'| Proxy | Kind | Low-Sun warm delta | Daylight blue-dominance delta | Daylight brownish delta | Daylight saturation delta | Image |',
		'| --- | --- | ---: | ---: | ---: | ---: | --- |',
		...transport.proxySweep.variants.map((variant) => {
			const row = summarizeProxyVariant(variant);
			return `| ${variant.id} | ${variant.kind} | ${formatNumber(row.lowSunWarmAreaDelta)} | ${formatNumber(row.daylightBlueDominanceDelta)} | ${formatNumber(row.daylightBrownishPercentDelta)} | ${formatNumber(row.daylightSaturationDelta)} | ${variant.image ? `\`${variant.image}\`` : ''} |`;
		}),
		'',
	].join('\n');
}

function traceControlledSourceRadiance(sourceSamples) {
	const integrator = new CpuSpectralReferenceIntegrator();
	const packet = integrator.traceRay({
		model: createControlledQuadratureModel(sourceSamples),
		observer: { positionKm: [0, 0, 0] },
		ray: { direction: [0, 1, 0] },
		wavelengthsNm: [550],
		numerical: { viewSteps: 1, sunTransmittanceSteps: 1 },
	});

	return packet.singleScattering.inScatteredRadianceByWavelength[0];
}

function createControlledQuadratureModel(sourceSamples) {
	return {
		id: 'source-quadrature-diagnostic',
		world: {
			altitudeAt() {
				return 0;
			},
			upAt() {
				return [0, 1, 0];
			},
			intersectSurface() {
				return null;
			},
			surfaceNormalAt() {
				return [0, 1, 0];
			},
		},
		atmosphere: {
			intersect() {
				return {
					tMinKm: 0,
					tMaxKm: 1,
					boundaryReason: 'controlled-atmosphere-exit',
					boundaryId: 'source-quadrature.atmosphere',
				};
			},
			contains() {
				return true;
			},
			mediumAt() {
				return {
					species: [{
						name: 'rayleigh',
						extinctionByWavelength: [0],
						scatteringByWavelength: [1],
						absorptionByWavelength: [0],
						phase: { kind: 'isotropic' },
					}],
				};
			},
			densityAt() {
				return 1;
			},
			extinctionAt() {
				return [0];
			},
			scatteringAt() {
				return { rayleigh: [1] };
			},
		},
		solarSource: {
			samplesAt() {
				return sourceSamples;
			},
			transmittanceSegment() {
				return {
					visible: true,
					boundaryReason: 'controlled-visible-source-path',
					samples: [],
				};
			},
		},
		surface: {
			radianceAt() {
				return [0];
			},
		},
	};
}

function createControlledSourceSample({ id, weight }) {
	return {
		id,
		direction: [0, -1, 0],
		weight,
		solidAngleSr: weight,
		sourceSpectrum: {
			kind: 'spectral-radiance',
			valuesByWavelength: [4],
			units: 'controlled spectral radiance',
			derivation: 'weakness-factor source quadrature diagnostic',
		},
	};
}

function paperComparisonInputs() {
	return {
		wavelengthGrid: 'preview-20nm',
		solarSpectrum: 'astm-g173',
		rayleighPolicy: 'bucholtz-standard-air',
		ozonePolicy: 'bruneton-2016-no-visible-absorption',
		molecularProfile: 'us-standard-atmosphere-1976-density',
		toneMap: 'exponential',
		multipleScatteringReference: 'none',
	};
}

function summarizeResultPanels(resultId, result) {
	return {
		id: resultId,
		panels: result.skyDomePanels.map((panel) => summarizePanelFromMetrics(panel)),
	};
}

function summarizePanelFromMetrics(panel) {
	const metrics = panel.modelComparisonMetrics;
	const displayMetrics = summarizePanelPixelImage(panel, panel.pixelImage);

	return {
		id: panel.id,
		label: panel.label,
		sunZenithDeg: panel.sunZenithDeg,
		sunElevationDeg: panel.sunElevationDeg,
		warmAffectedPercent: percent(metrics.warmAffectedFraction),
		nonBlueAffectedPercent: percent(metrics.nonBlueAffectedFraction),
		horizonWarmPercent: percent(metrics.horizonRing.warmAffectedFraction),
		horizonNonBluePercent: percent(metrics.horizonRing.nonBlueAffectedFraction),
		horizonLuminance: roundMetric(metrics.horizonRing.luminance.average),
		horizonSaturation: roundMetric(metrics.horizonRing.saturation.average),
		sunNeighborhoodWarmPercent: percent(metrics.sunNeighborhood10Deg.warmAffectedFraction),
		horizonBlueDominance: displayMetrics.horizonBlueDominance,
		brownishPercent: displayMetrics.brownishPercent,
		bluePercent: displayMetrics.bluePercent,
	};
}

function summarizePanelPixelImage(panel, pixelImage) {
	const accumulators = {
		dome: createPixelAccumulator(),
		horizon: createPixelAccumulator(),
		sunNeighborhood: createPixelAccumulator(),
	};
	const sunDirection = directionFromElevationAzimuth(panel.sunElevationDeg, panel.sunAzimuthDeg);

	for (let y = 0; y < pixelImage.height; y += 1) {
		for (let x = 0; x < pixelImage.width; x += 1) {
			const projection = projectionForPixel(x, y, pixelImage.width);
			if (!projection.insideDome) {
				continue;
			}

			const pixel = pixelImage.pixels[y * pixelImage.width + x];
			if (isSkippedPixel(pixel)) {
				continue;
			}

			addPixelMetrics(accumulators.dome, pixel);

			if (projection.radius >= 0.88) {
				addPixelMetrics(accumulators.horizon, pixel);
			}

			const angleFromSunDeg = angleBetweenDeg(projection.direction, sunDirection);
			if (angleFromSunDeg <= 10) {
				addPixelMetrics(accumulators.sunNeighborhood, pixel);
			}
		}
	}

	const dome = finalizePixelAccumulator(accumulators.dome);
	const horizon = finalizePixelAccumulator(accumulators.horizon);
	const sunNeighborhood = finalizePixelAccumulator(accumulators.sunNeighborhood);

	return {
		id: panel.id,
		label: panel.label,
		warmAffectedPercent: percent(dome.warmAffectedFraction),
		nonBlueAffectedPercent: percent(dome.nonBlueAffectedFraction),
		horizonWarmPercent: percent(horizon.warmAffectedFraction),
		horizonNonBluePercent: percent(horizon.nonBlueAffectedFraction),
		horizonLuminance: roundMetric(horizon.luminanceAverage),
		horizonSaturation: roundMetric(horizon.saturationAverage),
		horizonBlueDominance: roundMetric(horizon.blueDominanceAverage),
		brownishPercent: percent(horizon.brownishFraction),
		bluePercent: percent(horizon.blueFraction),
		sunNeighborhoodWarmPercent: percent(sunNeighborhood.warmAffectedFraction),
	};
}

function createPanelDelta(panel, baseline) {
	return {
		id: panel.id,
		label: panel.label,
		warmAffectedPercent: roundMetric(panel.warmAffectedPercent - baseline.warmAffectedPercent),
		nonBlueAffectedPercent: roundMetric(panel.nonBlueAffectedPercent - baseline.nonBlueAffectedPercent),
		horizonWarmPercent: roundMetric(panel.horizonWarmPercent - baseline.horizonWarmPercent),
		horizonNonBluePercent: roundMetric(panel.horizonNonBluePercent - baseline.horizonNonBluePercent),
		horizonLuminance: roundMetric(panel.horizonLuminance - baseline.horizonLuminance),
		horizonSaturation: roundMetric(panel.horizonSaturation - baseline.horizonSaturation),
		horizonBlueDominance: roundMetric(panel.horizonBlueDominance - baseline.horizonBlueDominance),
		brownishPercent: roundMetric(panel.brownishPercent - baseline.brownishPercent),
		bluePercent: roundMetric(panel.bluePercent - baseline.bluePercent),
		sunNeighborhoodWarmPercent: roundMetric(panel.sunNeighborhoodWarmPercent - baseline.sunNeighborhoodWarmPercent),
	};
}

function compareVariantPanels(variants, baselineId) {
	const baseline = variants.find((variant) => variant.id === baselineId);
	if (!baseline) {
		return null;
	}

	return variants
		.filter((variant) => variant.id !== baselineId)
		.map((variant) => ({
			id: variant.id,
			deltaPanels: variant.panels.map((panel) => {
				const baselinePanel = baseline.panels.find((candidate) => candidate.id === panel.id);
				return createPanelDelta(panel, baselinePanel);
			}),
		}));
}

function daylightAggregate(panels) {
	const daylight = panels.filter((panel) => panel.id !== '06h00.sunZenith87');

	return {
		horizonBlueDominance: roundMetric(average(daylight.map((panel) => panel.horizonBlueDominance))),
		brownishPercent: roundMetric(average(daylight.map((panel) => panel.brownishPercent))),
		horizonSaturation: roundMetric(average(daylight.map((panel) => panel.horizonSaturation))),
	};
}

function daylightDeltaAggregate(panels) {
	const daylight = panels.filter((panel) => panel.id !== '06h00.sunZenith87');

	return {
		horizonBlueDominance: roundMetric(average(daylight.map((panel) => panel.horizonBlueDominance))),
		brownishPercent: roundMetric(average(daylight.map((panel) => panel.brownishPercent))),
		horizonSaturation: roundMetric(average(daylight.map((panel) => panel.horizonSaturation))),
	};
}

function remapPixelImage(pixelImage, linearRgbForPixel, displayOptions) {
	const pixels = pixelImage.pixels.map((pixel, index) => {
		const x = index % pixelImage.width;
		const y = Math.floor(index / pixelImage.width);
		const projection = projectionForPixel(x, y, pixelImage.width);

		if (!projection.insideDome || isSkippedPixel(pixel)) {
			return clonePixel(pixel);
		}

		const remapped = linearRgbToPixel(linearRgbForPixel(pixel, projection), displayOptions);
		return {
			...remapped,
			source: pixel.source,
		};
	});

	return {
		...pixelImage,
		pixels,
		bytes: pixels.flatMap((pixel) => [
			pixel.bytes.r,
			pixel.bytes.g,
			pixel.bytes.b,
			pixel.bytes.a,
		]),
	};
}

function clonePixel(pixel) {
	return {
		...pixel,
		bytes: { ...pixel.bytes },
		linearRgb: pixel.linearRgb ? { ...pixel.linearRgb } : pixel.linearRgb,
		displayRgb: pixel.displayRgb ? { ...pixel.displayRgb } : pixel.displayRgb,
		displayLinearRgb: pixel.displayLinearRgb ? { ...pixel.displayLinearRgb } : pixel.displayLinearRgb,
		source: pixel.source ? { ...pixel.source } : pixel.source,
	};
}

function stackPixelImagesVertically(images, artifactLabel) {
	if (images.length === 0) {
		throw new Error(`${artifactLabel} requires at least one image`);
	}

	const width = images[0].width;
	const height = images.reduce((sum, image) => {
		if (image.width !== width) {
			throw new Error(`${artifactLabel} requires equal image widths`);
		}
		return sum + image.height;
	}, 0);
	const pixels = images.flatMap((image) => image.pixels);

	return {
		kind: 'atmosphere-color-pixel-image',
		width,
		height,
		encoding: images[0].encoding,
		exposure: 'per-panel',
		toneMap: images[0].toneMap,
		pixels,
		bytes: pixels.flatMap((pixel) => [
			pixel.bytes.r,
			pixel.bytes.g,
			pixel.bytes.b,
			pixel.bytes.a,
		]),
	};
}

function estimatePanelHorizonLinearLuminance(pixelImage) {
	const values = [];

	for (let y = 0; y < pixelImage.height; y += 1) {
		for (let x = 0; x < pixelImage.width; x += 1) {
			const projection = projectionForPixel(x, y, pixelImage.width);
			if (!projection.insideDome || projection.radius < 0.88) {
				continue;
			}

			const pixel = pixelImage.pixels[y * pixelImage.width + x];
			if (isSkippedPixel(pixel)) {
				continue;
			}

			values.push(luminance(pixel.linearRgb));
		}
	}

	return Math.max(1e-9, average(values));
}

function proxyWeightForGeometry(geometry, panel, variant) {
	if (variant.kind === 'surface-bounce-proxy') {
		return smoothstep(0.45, 1, geometry.radius);
	}

	if (variant.kind === 'aureole-proxy') {
		const sunDirection = directionFromElevationAzimuth(panel.sunElevationDeg, panel.sunAzimuthDeg);
		const angleDeg = angleBetweenDeg(geometry.direction, sunDirection);
		const angular = Math.exp(-((angleDeg / variant.angularSigmaDeg) ** 2));
		return angular * smoothstep(0.55, 1, geometry.radius);
	}

	return 0;
}

function normalizeLinearRgbToLuminance(rgb) {
	const y = luminance(rgb);
	return {
		r: rgb.r / y,
		g: rgb.g / y,
		b: rgb.b / y,
	};
}

function createPixelAccumulator() {
	return {
		count: 0,
		warmCount: 0,
		nonBlueCount: 0,
		brownishCount: 0,
		blueCount: 0,
		luminanceSum: 0,
		saturationSum: 0,
		blueDominanceSum: 0,
	};
}

function addPixelMetrics(accumulator, pixel) {
	const rgb = pixel.displayRgb ?? {
		r: pixel.bytes.r / 255,
		g: pixel.bytes.g / 255,
		b: pixel.bytes.b / 255,
	};
	const hsv = rgbToHsv(rgb);
	const pixelLuminance = luminance(rgb);
	const blueDominance = rgb.b - Math.max(rgb.r, rgb.g);

	accumulator.count += 1;
	accumulator.luminanceSum += pixelLuminance;
	accumulator.saturationSum += hsv.s;
	accumulator.blueDominanceSum += blueDominance;

	if (hsv.h >= 20 && hsv.h <= 70 && hsv.s >= 0.22 && hsv.v >= 0.18) {
		accumulator.warmCount += 1;
	}

	if ((hsv.h < 185 || hsv.h > 260) && hsv.s >= 0.15 && hsv.v >= 0.18) {
		accumulator.nonBlueCount += 1;
	}

	if (hsv.h >= 20 && hsv.h <= 80 && hsv.s >= 0.08 && hsv.v >= 0.15) {
		accumulator.brownishCount += 1;
	}

	if (hsv.h >= 185 && hsv.h <= 260 && hsv.s >= 0.08 && hsv.v >= 0.15) {
		accumulator.blueCount += 1;
	}
}

function finalizePixelAccumulator(accumulator) {
	if (accumulator.count === 0) {
		return {
			warmAffectedFraction: 0,
			nonBlueAffectedFraction: 0,
			brownishFraction: 0,
			blueFraction: 0,
			luminanceAverage: null,
			saturationAverage: null,
			blueDominanceAverage: null,
		};
	}

	return {
		warmAffectedFraction: accumulator.warmCount / accumulator.count,
		nonBlueAffectedFraction: accumulator.nonBlueCount / accumulator.count,
		brownishFraction: accumulator.brownishCount / accumulator.count,
		blueFraction: accumulator.blueCount / accumulator.count,
		luminanceAverage: accumulator.luminanceSum / accumulator.count,
		saturationAverage: accumulator.saturationSum / accumulator.count,
		blueDominanceAverage: accumulator.blueDominanceSum / accumulator.count,
	};
}

function projectionForPixel(x, y, size) {
	const ndcX = ((x + 0.5) / size) * 2 - 1;
	const ndcY = 1 - ((y + 0.5) / size) * 2;
	const radius = Math.sqrt(ndcX * ndcX + ndcY * ndcY);

	if (radius > 1) {
		return {
			insideDome: false,
			radius,
			direction: null,
		};
	}

	const zenithAngleRad = radius * Math.PI / 2;
	const elevationDeg = 90 - radiansToDegrees(zenithAngleRad);
	const azimuthDeg = radiansToDegrees(Math.atan2(-ndcY, ndcX));

	return {
		insideDome: true,
		radius,
		direction: directionFromElevationAzimuth(elevationDeg, azimuthDeg),
	};
}

function directionFromElevationAzimuth(elevationDeg, azimuthDeg) {
	const elevationRad = degreesToRadians(elevationDeg);
	const azimuthRad = degreesToRadians(azimuthDeg);
	const horizontal = Math.cos(elevationRad);

	return [
		horizontal * Math.sin(azimuthRad),
		Math.sin(elevationRad),
		horizontal * Math.cos(azimuthRad),
	];
}

function angleBetweenDeg(a, b) {
	return radiansToDegrees(Math.acos(clampSigned(dot3(a, b))));
}

function rgbToHsv(rgb) {
	const max = Math.max(rgb.r, rgb.g, rgb.b);
	const min = Math.min(rgb.r, rgb.g, rgb.b);
	const delta = max - min;
	let h = 0;

	if (delta !== 0) {
		if (max === rgb.r) {
			h = 60 * (((rgb.g - rgb.b) / delta) % 6);
		} else if (max === rgb.g) {
			h = 60 * (((rgb.b - rgb.r) / delta) + 2);
		} else {
			h = 60 * (((rgb.r - rgb.g) / delta) + 4);
		}
	}

	return {
		h: h < 0 ? h + 360 : h,
		s: max === 0 ? 0 : delta / max,
		v: max,
	};
}

function luminance(rgb) {
	return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function dot3(a, b) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function clampSigned(value) {
	return Math.max(-1, Math.min(1, value));
}

function smoothstep(edge0, edge1, value) {
	const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

function degreesToRadians(value) {
	return value * Math.PI / 180;
}

function radiansToDegrees(value) {
	return value * 180 / Math.PI;
}

function isSkippedPixel(pixel) {
	return pixel?.source?.colorProvenance?.mask === 'dome-sample-mask-skipped';
}

function average(values) {
	const finite = values.filter(Number.isFinite);
	return finite.length > 0
		? finite.reduce((sum, value) => sum + value, 0) / finite.length
		: null;
}

function percent(fraction) {
	return Number.isFinite(fraction) ? roundMetric(fraction * 100) : fraction;
}

function roundMetric(value) {
	return Number.isFinite(value) ? Number(value.toFixed(9)) : value;
}

function formatNumber(value) {
	return Number.isFinite(value) ? value.toFixed(6) : String(value);
}

function readOptionValue(argv, index, optionName) {
	if (index >= argv.length || argv[index].startsWith('--')) {
		throw new Error(`${optionName} requires a value`);
	}

	return argv[index];
}

function readPositiveIntegerOption(argv, index, optionName) {
	const value = Number(readOptionValue(argv, index, optionName));
	if (!Number.isInteger(value) || value <= 0) {
		throw new Error(`${optionName} must be a positive integer`);
	}

	return value;
}

function createProgressFileReporter(progressLogPath) {
	return (event) => {
		fs.appendFileSync(progressLogPath, `${JSON.stringify({
			generatedAt: null,
			...event,
		})}\n`);
	};
}

function normalizeArtifactPath(filePath) {
	return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/gu, '/');
}

function printUsage() {
	return [
		`Usage: node scripts/flat/atmosphere_rejected/weakness-factor-audit.js --out-dir <dir> [--dome-size <pixels>] [--sampling-profile <id>] [--dome-sample-mask ${skyDomeSampleMaskIds().join('|')}] [--skip-transport]`,
		'',
		'Writes audit.json, audit.md, and manifest.json.',
		'Transport diagnostics also write images/*.png and progress.log.',
	].join('\n');
}

function runCli(argv = process.argv.slice(2)) {
	try {
		const options = parseWeaknessFactorAuditArgs(argv);

		if (options.help) {
			console.log(printUsage());
			return 0;
		}

		if (!options.outDir) {
			throw new Error('--out-dir is required');
		}

		fs.mkdirSync(options.outDir, { recursive: true });
		const progressLogPath = path.join(options.outDir, 'progress.log');
		const audit = runWeaknessFactorAudit({
			includeTransport: options.includeTransport,
			domeSize: options.domeSize,
			samplingProfile: options.samplingProfile,
			domeSampleMask: options.domeSampleMask,
			outDir: options.outDir,
			progressReporter: options.includeTransport
				? createProgressFileReporter(progressLogPath)
				: undefined,
		});
		const artifacts = writeWeaknessFactorAuditArtifacts(audit, options.outDir);

		console.log(`Wrote weakness factor audit to ${normalizeArtifactPath(options.outDir)}`);
		console.log(JSON.stringify(Object.fromEntries(
			Object.entries(artifacts).map(([key, value]) => [key, normalizeArtifactPath(value)]),
		), null, 2));

		return 0;
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);

		return 1;
	}
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = runCli();
}
