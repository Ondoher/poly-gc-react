import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_OUT_ROOT = path.join(
	REPO_ROOT,
	'tmp/atmosphere/algorithm32_shader_lab'
);

const DIRECT_RADIANCE_TOLERANCE = 1e-12;
const COMPOSITION_TOLERANCE = 1e-12;
const SHADER_RADIANCE_TOLERANCE = 1e-5;
const SHADER_COMPONENT_TOLERANCE = 1e-5;

const ATMOSPHERE = Object.freeze({
	bottomRadiusMeters: 6360000,
	topRadiusMeters: 6420000,
	rayleighScaleHeightMeters: 8000,
	mieScaleHeightMeters: 1200,
	rayleighCoefficientScale: 1.24062e-6,
	mieAngstromAlpha: 0.8,
	mieAngstromBeta: 0.04,
	mieSingleScatteringAlbedo: 0.8,
	miePhaseFunctionG: 0.7,
	ozoneAbsorption: 0,
	directRadianceViewSamples: 20,
	directRadianceSunTransmittanceSamples: 10,
	diagnosticWavelengthNanometers: 532.333333333333,
	diagnosticSolarIrradiance: 1.883391,
});

const DIRECT_RADIANCE_SUN_CASE = Object.freeze({
	id: 'figure1-13h15-z21',
	sourceTimeOfDay: '13h15',
	sourceSunZenithDegrees: 21,
	sunAltitudeDegrees: 69,
	sunAzimuthDegrees: 85.31410016049729,
	role: 'highest-Sun render and stress case',
});

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		browserRun: null,
		label: 'browser-direct-radiance-comparison',
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--out-root') {
			options.outRoot = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--browser-run') {
			options.browserRun = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--label') {
			options.label = slug(argv[index + 1]);
			index += 1;
		} else if (arg === '--help' || arg === '-h') {
			options.help = true;
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}
	}

	return options;
}

function printHelp() {
	console.log(`Algorithm32 browser direct radiance diagnostics

Usage:
  node scripts/flat/algorithm32-shader-lab/browser-direct-radiance-diagnostics.js --browser-run <artifact-folder-or-result-json>

Options:
  --browser-run <path>  Browser artifact folder or result.json. Defaults to latest.json.
  --out-root <path>     Output root. Default: tmp/atmosphere/algorithm32_shader_lab
  --label <name>        Artifact folder label.
`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));

	if (options.help) {
		printHelp();
		return;
	}

	const startedAt = new Date();
	const runLog = [];
	log(runLog, 'Started browser direct radiance comparison.');
	const browserPacketInfo = await readBrowserPacket(options);
	log(runLog, `Loaded browser artifact ${browserPacketInfo.sourcePath}.`);
	const browserResult = browserPacketInfo.packet.result;

	if (!browserResult || !Array.isArray(browserResult.directRadianceDiagnostics)) {
		throw new Error('Browser artifact does not contain result.directRadianceDiagnostics.');
	}

	const comparison = compareDirectRadiance(browserResult);
	const criteria = evaluateCriteria({
		browserPacket: browserPacketInfo.packet,
		browserResult,
		comparison,
	});
	const summary = summarizeCriteria(criteria);
	const endedAt = new Date();
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	const packet = {
		kind: 'algorithm32-browser-direct-radiance-comparison',
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		createdAt: startedAt.toISOString(),
		completedAt: endedAt.toISOString(),
		durationMs: endedAt.getTime() - startedAt.getTime(),
		browserArtifact: {
			sourcePath: browserPacketInfo.sourcePath,
			runDir: browserPacketInfo.packet.artifacts?.runDir || null,
			commandId: browserPacketInfo.packet.command?.id || null,
			resultKind: browserResult.kind,
		},
		summary,
	};

	log(
		runLog,
		`Comparison ${packet.status}: ${summary.passed} passed, ${summary.failed} failed, ${summary.unresolved} unresolved.`
	);

	await writeArtifacts({
		artifact,
		options,
		packet,
		browserPacketInfo,
		comparison,
		criteria,
		runLog,
	});

	console.log(`Browser direct radiance diagnostics ${packet.status}: ${artifact.directory}`);
	console.log(
		`Criteria: ${summary.passed} passed, ${summary.failed} failed, ${summary.unresolved} unresolved`
	);
}

async function readBrowserPacket(options) {
	const sourcePath = options.browserRun
		? await resolveBrowserResultPath(options.browserRun)
		: path.join(options.outRoot, 'latest.json');
	const packet = JSON.parse(await fs.readFile(sourcePath, 'utf8'));

	return {
		sourcePath: path.relative(REPO_ROOT, sourcePath).replaceAll('\\', '/'),
		packet,
	};
}

async function resolveBrowserResultPath(inputPath) {
	const stats = await fs.stat(inputPath);
	return stats.isDirectory() ? path.join(inputPath, 'result.json') : inputPath;
}

function compareDirectRadiance(browserResult) {
	const browserDiagnosticsById = new Map(
		browserResult.directRadianceDiagnostics.map((diagnostic) => [
			diagnostic.id,
			diagnostic,
		])
	);
	const comparisons = browserResult.selectedPixels.map((sample) => {
		const browserDiagnostic = browserDiagnosticsById.get(sample.id);
		const cpuDiagnostic = computeDirectRadianceDiagnostic(sample);
		return compareDiagnostic(browserDiagnostic, cpuDiagnostic);
	});
	const compositionErrors = browserResult.directRadianceDiagnostics.map((item) =>
		Math.abs(
			item.finalRadiance -
			(item.transmittedObjectRadiance + item.firstOrderPathRadiance)
		)
	);

	return {
		kind: 'algorithm32-browser-direct-radiance-comparison',
		componentCount: comparisons.length,
		comparisons,
		maxTransmittanceDelta: maxAbs(
			comparisons.map((item) => item.deltas.transmittance)
		),
		maxRayleighRadianceDelta: maxAbs(
			comparisons.map((item) => item.deltas.firstOrderRayleighPathRadiance)
		),
		maxMieRadianceDelta: maxAbs(
			comparisons.map((item) => item.deltas.firstOrderMiePathRadiance)
		),
		maxPathRadianceDelta: maxAbs(
			comparisons.map((item) => item.deltas.firstOrderPathRadiance)
		),
		maxFinalRadianceDelta: maxAbs(
			comparisons.map((item) => item.deltas.finalRadiance)
		),
		maxCompositionError: Math.max(0, ...compositionErrors),
		radianceBounds: {
			minPathRadiance: Math.min(
				...comparisons.map((item) => item.browser.firstOrderPathRadiance)
			),
			maxPathRadiance: Math.max(
				...comparisons.map((item) => item.browser.firstOrderPathRadiance)
			),
			minFinalRadiance: Math.min(
				...comparisons.map((item) => item.browser.finalRadiance)
			),
			maxFinalRadiance: Math.max(
				...comparisons.map((item) => item.browser.finalRadiance)
			),
		},
		shaderComparison: compareShaderDiagnostics(
			browserResult.directRadianceShaderDiagnostics
		),
		limitations: [...new Set(
			browserResult.directRadianceDiagnostics.flatMap((item) =>
				item.limitations || []
			)
		)],
	};
}

function compareDiagnostic(browserDiagnostic, cpuDiagnostic) {
	if (!browserDiagnostic) {
		throw new Error(`Missing browser direct radiance diagnostic ${cpuDiagnostic.id}.`);
	}

	return {
		id: cpuDiagnostic.id,
		browser: summarizeRadianceDiagnostic(browserDiagnostic),
		cpu: summarizeRadianceDiagnostic(cpuDiagnostic),
		deltas: {
			transmittance:
				browserDiagnostic.transmittance - cpuDiagnostic.transmittance,
			firstOrderRayleighPathRadiance:
				browserDiagnostic.firstOrderRayleighPathRadiance -
				cpuDiagnostic.firstOrderRayleighPathRadiance,
			firstOrderMiePathRadiance:
				browserDiagnostic.firstOrderMiePathRadiance -
				cpuDiagnostic.firstOrderMiePathRadiance,
			firstOrderPathRadiance:
				browserDiagnostic.firstOrderPathRadiance -
				cpuDiagnostic.firstOrderPathRadiance,
			finalRadiance:
				browserDiagnostic.finalRadiance - cpuDiagnostic.finalRadiance,
		},
	};
}

function summarizeRadianceDiagnostic(diagnostic) {
	return {
		id: diagnostic.id,
		classification: diagnostic.classification,
		hitObject: diagnostic.hitObject,
		spectrumId: diagnostic.spectrumId,
		pathKind: diagnostic.pathKind,
		pathDistanceMeters: diagnostic.pathDistanceMeters,
		wavelengthNanometers: diagnostic.wavelengthNanometers,
		transmittance: diagnostic.transmittance,
		objectRadiance: diagnostic.objectRadiance,
		transmittedObjectRadiance: diagnostic.transmittedObjectRadiance,
		firstOrderRayleighPathRadiance:
			diagnostic.firstOrderRayleighPathRadiance,
		firstOrderMiePathRadiance: diagnostic.firstOrderMiePathRadiance,
		firstOrderPathRadiance: diagnostic.firstOrderPathRadiance,
		finalRadiance: diagnostic.finalRadiance,
	};
}

function compareShaderDiagnostics(shaderDiagnostics) {
	if (!shaderDiagnostics) {
		return {
			status: 'missing',
			reason: 'Browser artifact did not include directRadianceShaderDiagnostics.',
		};
	}
	if (shaderDiagnostics.status !== 'accepted') {
		return {
			status: shaderDiagnostics.status,
			reason: shaderDiagnostics.reason,
		};
	}

	return {
		status: 'accepted',
		componentCount: shaderDiagnostics.componentCount,
		maxRayleighRadianceDelta: maxAbs(
			shaderDiagnostics.samples.map((sample) =>
				sample.deltas.firstOrderRayleighPathRadiance
			)
		),
		maxMieRadianceDelta: maxAbs(
			shaderDiagnostics.samples.map((sample) =>
				sample.deltas.firstOrderMiePathRadiance
			)
		),
		maxPathRadianceDelta: maxAbs(
			shaderDiagnostics.samples.map((sample) =>
				sample.deltas.firstOrderPathRadiance
			)
		),
		maxFinalRadianceDelta: maxAbs(
			shaderDiagnostics.samples.map((sample) => sample.deltas.finalRadiance)
		),
		samples: shaderDiagnostics.samples,
	};
}

function evaluateCriteria({ browserPacket, browserResult, comparison }) {
	const finiteRadiance = comparison.comparisons.every((item) =>
		Number.isFinite(item.browser.firstOrderPathRadiance) &&
		Number.isFinite(item.browser.finalRadiance) &&
		item.browser.firstOrderPathRadiance >= -DIRECT_RADIANCE_TOLERANCE &&
		item.browser.finalRadiance >= -DIRECT_RADIANCE_TOLERANCE &&
		item.browser.transmittance >= -DIRECT_RADIANCE_TOLERANCE &&
		item.browser.transmittance <= 1 + DIRECT_RADIANCE_TOLERANCE
	);
	const skyPathRadiancePresent = comparison.comparisons
		.filter((item) => item.browser.classification === 'sky')
		.some((item) => item.browser.firstOrderPathRadiance > 0);
	const limitationsRecorded =
		comparison.limitations.includes('first-order single scattering only') &&
		comparison.limitations.includes('one-wavelength diagnostic at 532.333333333333 nm');

	return [
		criterion({
			id: 'browser-artifact-accepted',
			status:
				browserPacket.status === 'accepted' &&
				browserResult.status === 'accepted' &&
				browserResult.kind === 'algorithm32-browser-direct-radiance-diagnostics-result'
					? 'passed'
					: 'failed',
			measured: {
				harnessStatus: browserPacket.status,
				browserStatus: browserResult.status,
				resultKind: browserResult.kind,
			},
			notes: 'The comparison starts from an accepted browser direct-radiance artifact.',
		}),
		criterion({
			id: 'radiance-coverage',
			status:
				comparison.componentCount === browserResult.selectedPixels.length
					? 'passed'
					: 'failed',
			measured: {
				componentCount: comparison.componentCount,
				selectedPixels: browserResult.selectedPixels.length,
			},
			notes: 'Every selected pixel has a direct-radiance diagnostic packet.',
		}),
		criterion({
			id: 'finite-nonnegative-radiance',
			status: finiteRadiance ? 'passed' : 'failed',
			measured: comparison.radianceBounds,
			notes: 'Selected first-order path and final radiance values are finite and nonnegative; transmittance remains bounded.',
		}),
		criterion({
			id: 'direct-radiance-js-node-parity',
			status:
				comparison.maxRayleighRadianceDelta <= DIRECT_RADIANCE_TOLERANCE &&
				comparison.maxMieRadianceDelta <= DIRECT_RADIANCE_TOLERANCE &&
				comparison.maxPathRadianceDelta <= DIRECT_RADIANCE_TOLERANCE &&
				comparison.maxFinalRadianceDelta <= DIRECT_RADIANCE_TOLERANCE
					? 'passed'
					: 'failed',
			tolerance: {
				maxRadianceDelta: DIRECT_RADIANCE_TOLERANCE,
			},
			measured: {
				maxRayleighRadianceDelta: comparison.maxRayleighRadianceDelta,
				maxMieRadianceDelta: comparison.maxMieRadianceDelta,
				maxPathRadianceDelta: comparison.maxPathRadianceDelta,
				maxFinalRadianceDelta: comparison.maxFinalRadianceDelta,
			},
			notes: 'Browser JS first-order radiance matches independent Node recomputation.',
		}),
		criterion({
			id: 'object-composition-identity',
			status:
				comparison.maxCompositionError <= COMPOSITION_TOLERANCE
					? 'passed'
					: 'failed',
			tolerance: {
				maxCompositionError: COMPOSITION_TOLERANCE,
			},
			measured: {
				maxCompositionError: comparison.maxCompositionError,
			},
			notes: 'Final diagnostic radiance equals T * objectRadiance + first-order path radiance.',
		}),
		criterion({
			id: 'sky-path-radiance-present',
			status: skyPathRadiancePresent ? 'passed' : 'failed',
			measured: {
				skySamples: comparison.comparisons
					.filter((item) => item.browser.classification === 'sky')
					.map((item) => ({
						id: item.id,
						firstOrderPathRadiance: item.browser.firstOrderPathRadiance,
					})),
			},
			notes: 'At least one sky sample has positive first-order atmospheric radiance.',
		}),
		criterion({
			id: 'iteration-limitations-recorded',
			status: limitationsRecorded ? 'passed' : 'failed',
			measured: {
				limitations: comparison.limitations,
			},
			notes: 'The artifact explicitly labels this as a one-wavelength first-order diagnostic, not final Algorithm32 parity.',
		}),
		criterion({
			id: 'shader-diagnostic-available',
			status:
				comparison.shaderComparison.status === 'accepted' ? 'passed' : 'failed',
			measured: comparison.shaderComparison,
			notes: 'The browser artifact includes accepted WebGL2 direct-radiance shader readback.',
		}),
		criterion({
			id: 'shader-component-radiance-parity',
			status:
				comparison.shaderComparison.status === 'accepted' &&
				comparison.shaderComparison.maxRayleighRadianceDelta <=
					SHADER_COMPONENT_TOLERANCE &&
				comparison.shaderComparison.maxMieRadianceDelta <=
					SHADER_COMPONENT_TOLERANCE
					? 'passed'
					: 'failed',
			tolerance: {
				maxComponentRadianceDelta: SHADER_COMPONENT_TOLERANCE,
			},
			measured: comparison.shaderComparison,
			notes: 'The WebGL2 shader Rayleigh and Mie first-order radiance components match browser JS within float-readback tolerance.',
		}),
		criterion({
			id: 'shader-final-radiance-parity',
			status:
				comparison.shaderComparison.status === 'accepted' &&
				comparison.shaderComparison.maxPathRadianceDelta <=
					SHADER_RADIANCE_TOLERANCE &&
				comparison.shaderComparison.maxFinalRadianceDelta <=
					SHADER_RADIANCE_TOLERANCE
					? 'passed'
					: 'failed',
			tolerance: {
				maxRadianceDelta: SHADER_RADIANCE_TOLERANCE,
			},
			measured: comparison.shaderComparison,
			notes: 'The WebGL2 shader first-order path and final radiance match browser JS within float-readback tolerance.',
		}),
	];
}

function computeDirectRadianceDiagnostic(sample) {
	const origin = threeToAlgorithmWorld(sample.threeRay.origin);
	const direction = normalize(threeDirectionToAlgorithm(sample.threeRay.direction));
	const pathDistanceMeters = sample.classification === 'sky'
		? distanceToTopAtmosphereBoundary(origin, direction)
		: sample.hitDistanceMeters;
	const wavelengthNanometers = ATMOSPHERE.diagnosticWavelengthNanometers;
	const wavelengthMicrometers = wavelengthNanometers * 1e-3;
	const sunRay = sunDirection(DIRECT_RADIANCE_SUN_CASE);
	const fullOpticalLengths = computeOpticalLengthsAlongDistance({
		origin,
		direction,
		distance: pathDistanceMeters,
		sampleCount: ATMOSPHERE.directRadianceViewSamples,
	});
	const opticalDepth = opticalDepthAtWavelength(
		fullOpticalLengths,
		wavelengthNanometers
	);
	const transmittance = Math.exp(-opticalDepth);
	const radiance = computeFirstOrderRadianceAtWavelength({
		origin,
		direction,
		distance: pathDistanceMeters,
		wavelengthNanometers,
		wavelengthMicrometers,
		sunRay,
	});
	const objectRadiance = sample.classification === 'sky'
		? 0
		: objectRadianceAtWavelength(sample.spectrumId, wavelengthNanometers);
	const transmittedObjectRadiance = objectRadiance * transmittance;
	const finalRadiance = transmittedObjectRadiance + radiance.firstOrderPathRadiance;

	return {
		id: sample.id,
		classification: sample.classification,
		hitObject: sample.hitObject,
		spectrumId: sample.spectrumId,
		pathKind: sample.classification === 'sky' ? 'sky-to-top-atmosphere' : 'finite-scene-segment',
		pathDistanceMeters,
		wavelengthNanometers,
		algorithm32Ray: {
			origin,
			direction,
		},
		opticalLengths: fullOpticalLengths,
		opticalDepth,
		transmittance,
		objectRadiance,
		transmittedObjectRadiance,
		firstOrderRayleighPathRadiance:
			radiance.firstOrderRayleighPathRadiance,
		firstOrderMiePathRadiance: radiance.firstOrderMiePathRadiance,
		firstOrderPathRadiance: radiance.firstOrderPathRadiance,
		finalRadiance,
	};
}

function computeFirstOrderRadianceAtWavelength({
	origin,
	direction,
	distance,
	wavelengthNanometers,
	wavelengthMicrometers,
	sunRay,
}) {
	if (distance === 0) {
		return {
			firstOrderRayleighPathRadiance: 0,
			firstOrderMiePathRadiance: 0,
			firstOrderPathRadiance: 0,
		};
	}

	const sampleCount = ATMOSPHERE.directRadianceViewSamples;
	const step = distance / sampleCount;
	const samples = [];
	const cumulativeRayleigh = [0];
	const cumulativeMie = [0];
	let rayleighSum = 0;
	let mieSum = 0;

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sampleDistance = sampleIndex * step;
		const position = addScaled(origin, direction, sampleDistance);
		const density = densityAtPosition(position);
		samples.push({ position, density });

		if (sampleIndex > 0) {
			const previousDensity = samples[sampleIndex - 1].density;
			cumulativeRayleigh[sampleIndex] =
				cumulativeRayleigh[sampleIndex - 1] +
				0.5 * (previousDensity.rayleigh + density.rayleigh) * step;
			cumulativeMie[sampleIndex] =
				cumulativeMie[sampleIndex - 1] +
				0.5 * (previousDensity.mie + density.mie) * step;
		}
	}

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sample = samples[sampleIndex];
		const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;
		const viewTransmittance = computeTransmittanceAtWavelength({
			rayleighOpticalLength: cumulativeRayleigh[sampleIndex],
			mieOpticalLength: cumulativeMie[sampleIndex],
			absorptionOpticalLength: 0,
		}, wavelengthNanometers);
		const sunTransmittance = computeTransmittanceToSunAtWavelength({
			position: sample.position,
			sunRay,
			wavelengthNanometers,
		});
		const transmittance = viewTransmittance * sunTransmittance;

		rayleighSum += transmittance * sample.density.rayleigh * weight;
		mieSum += transmittance * sample.density.mie * weight;
	}

	const nu = dot(direction, sunRay);
	const rayleighPhase = rayleighPhaseFunction(nu);
	const miePhase = miePhaseFunction(ATMOSPHERE.miePhaseFunctionG, nu);
	const rayleigh =
		rayleighSum *
		step *
		ATMOSPHERE.diagnosticSolarIrradiance *
		rayleighScatteringCoefficientAt(wavelengthMicrometers) *
		rayleighPhase;
	const mie =
		mieSum *
		step *
		ATMOSPHERE.diagnosticSolarIrradiance *
		mieScatteringCoefficientAt(wavelengthMicrometers) *
		miePhase;

	return {
		firstOrderRayleighPathRadiance: rayleigh,
		firstOrderMiePathRadiance: mie,
		firstOrderPathRadiance: rayleigh + mie,
	};
}

function computeOpticalLengthsAlongDistance({ origin, direction, distance, sampleCount }) {
	const step = distance / sampleCount;
	let rayleighOpticalLength = 0;
	let mieOpticalLength = 0;
	let absorptionOpticalLength = 0;

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sampleDistance = sampleIndex * step;
		const samplePosition = addScaled(origin, direction, sampleDistance);
		const density = densityAtPosition(samplePosition);
		const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;

		rayleighOpticalLength += density.rayleigh * weight * step;
		mieOpticalLength += density.mie * weight * step;
		absorptionOpticalLength += density.absorption * weight * step;
	}

	return {
		distanceMeters: distance,
		rayleighOpticalLength,
		mieOpticalLength,
		absorptionOpticalLength,
	};
}

function densityAtPosition(position) {
	const altitudeMeters = length(position) - ATMOSPHERE.bottomRadiusMeters;

	return {
		altitudeMeters,
		rayleigh: Math.exp(-Math.max(0, altitudeMeters) / ATMOSPHERE.rayleighScaleHeightMeters),
		mie: Math.exp(-Math.max(0, altitudeMeters) / ATMOSPHERE.mieScaleHeightMeters),
		absorption: 0,
	};
}

function distanceToTopAtmosphereBoundary(origin, direction) {
	const radius = length(origin);
	const mu = dot(origin, direction) / radius;

	return distanceToTopAtmosphereBoundaryForRadiusMu(radius, mu);
}

function distanceToTopAtmosphereBoundaryForRadiusMu(radius, mu) {
	const discriminant =
		radius * radius * (mu * mu - 1) +
		ATMOSPHERE.topRadiusMeters * ATMOSPHERE.topRadiusMeters;

	return Math.max(0, -radius * mu + Math.sqrt(Math.max(0, discriminant)));
}

function rayIntersectsGround(radius, mu) {
	return (
		mu < 0 &&
		radius * radius * (mu * mu - 1) +
			ATMOSPHERE.bottomRadiusMeters * ATMOSPHERE.bottomRadiusMeters >=
			0
	);
}

function rayleighScatteringCoefficientAt(wavelengthMicrometers) {
	return ATMOSPHERE.rayleighCoefficientScale * wavelengthMicrometers ** -4;
}

function mieExtinctionCoefficientAt(wavelengthMicrometers) {
	return (
		(ATMOSPHERE.mieAngstromBeta / ATMOSPHERE.mieScaleHeightMeters) *
		wavelengthMicrometers ** -ATMOSPHERE.mieAngstromAlpha
	);
}

function mieScatteringCoefficientAt(wavelengthMicrometers) {
	return (
		mieExtinctionCoefficientAt(wavelengthMicrometers) *
		ATMOSPHERE.mieSingleScatteringAlbedo
	);
}

function opticalDepthAtWavelength(opticalLengths, wavelengthNanometers) {
	const wavelengthMicrometers = wavelengthNanometers * 1e-3;

	return (
		rayleighScatteringCoefficientAt(wavelengthMicrometers) *
			opticalLengths.rayleighOpticalLength +
		mieExtinctionCoefficientAt(wavelengthMicrometers) *
			opticalLengths.mieOpticalLength +
		ATMOSPHERE.ozoneAbsorption *
			(opticalLengths.absorptionOpticalLength || 0)
	);
}

function computeTransmittanceAtWavelength(opticalLengths, wavelengthNanometers) {
	return Math.exp(-opticalDepthAtWavelength(opticalLengths, wavelengthNanometers));
}

function computeTransmittanceToSunAtWavelength({
	position,
	sunRay,
	wavelengthNanometers,
}) {
	const radius = length(position);
	const mu = dot(position, sunRay) / radius;

	if (rayIntersectsGround(radius, mu)) {
		return 0;
	}

	return computeTransmittanceAtWavelength(
		computeOpticalLengthsAlongDistance({
			origin: position,
			direction: sunRay,
			distance: distanceToTopAtmosphereBoundaryForRadiusMu(radius, mu),
			sampleCount: ATMOSPHERE.directRadianceSunTransmittanceSamples,
		}),
		wavelengthNanometers
	);
}

function rayleighPhaseFunction(nu) {
	return (3 / (16 * Math.PI)) * (1 + nu * nu);
}

function miePhaseFunction(g, nu) {
	const k = (3 / (8 * Math.PI)) * ((1 - g * g) / (2 + g * g));

	return (k * (1 + nu * nu)) / (1 + g * g - 2 * g * nu) ** 1.5;
}

function objectRadianceAtWavelength(spectrumId, wavelengthNanometers) {
	if (spectrumId === 'red') {
		return wavelengthNanometers >= 626.333333333333 ? 0.045 : 0.003;
	}
	if (spectrumId === 'green') {
		return (
			0.002 +
			0.05 * triangularSpectrumWeight(wavelengthNanometers, 532.333333333333, 65) +
			0.012 * triangularSpectrumWeight(wavelengthNanometers, 563.666666666667, 60)
		);
	}
	if (spectrumId === 'blue') {
		return wavelengthNanometers <= 501 ? 0.045 : 0.003;
	}
	if (spectrumId === 'ground') {
		return 0.012;
	}

	return 0;
}

function triangularSpectrumWeight(lambdaNm, centerNm, halfWidthNm) {
	return Math.max(0, 1 - Math.abs(lambdaNm - centerNm) / halfWidthNm);
}

function sunDirection(sunCase) {
	const altitude = degreesToRadians(sunCase.sunAltitudeDegrees);
	const azimuth = degreesToRadians(sunCase.sunAzimuthDegrees);
	const horizontalLength = Math.cos(altitude);

	return normalize([
		horizontalLength * Math.cos(azimuth),
		horizontalLength * Math.sin(azimuth),
		Math.sin(altitude),
	]);
}

function degreesToRadians(degrees) {
	return degrees * (Math.PI / 180);
}

async function writeArtifacts({
	artifact,
	options,
	packet,
	browserPacketInfo,
	comparison,
	criteria,
	runLog,
}) {
	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'algorithm32-browser-direct-radiance-command',
		options: {
			browserRun: options.browserRun,
			label: options.label,
		},
	});
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeJson(path.join(artifact.directory, 'browser-run-summary.json'), {
		sourcePath: browserPacketInfo.sourcePath,
		command: browserPacketInfo.packet.command,
		status: browserPacketInfo.packet.status,
		resultKind: browserPacketInfo.packet.result?.kind || null,
		artifacts: browserPacketInfo.packet.artifacts || null,
	});
	await writeJson(path.join(artifact.directory, 'comparison.json'), comparison);
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'algorithm32-browser-direct-radiance-criteria',
		status: packet.status,
		summary: packet.summary,
		items: criteria,
	});
	await writeText(path.join(artifact.directory, 'report.md'), makeReport({
		packet,
		comparison,
		criteria,
	}));
	await writeText(path.join(artifact.directory, 'run.log'), `${runLog.join('\n')}\n`);
	await writeJson(path.join(options.outRoot, 'latest-browser-direct-radiance.json'), {
		...packet,
		artifacts: {
			runDir: artifact.directory,
			resultPath: path.join(artifact.directory, 'result.json'),
			comparisonPath: path.join(artifact.directory, 'comparison.json'),
			criteriaPath: path.join(artifact.directory, 'criteria-results.json'),
			reportPath: path.join(artifact.directory, 'report.md'),
		},
	});
}

function makeReport({ packet, comparison, criteria }) {
	return [
		'# Browser Direct Radiance Diagnostics',
		'',
		`Status: ${packet.status}`,
		'',
		'This artifact compares selected-pixel first-order 532 nm direct-radiance diagnostics from browser JS and WebGL2 shader readback against an independent Node recomputation using the same Three rays and hit distances.',
		'',
		'## Source Browser Run',
		'',
		`- Browser source: \`${packet.browserArtifact.sourcePath}\``,
		`- Browser result kind: \`${packet.browserArtifact.resultKind}\``,
		'',
		'## Metrics',
		'',
		`- Components: ${comparison.componentCount}`,
		`- Max JS/Node Rayleigh radiance delta: ${comparison.maxRayleighRadianceDelta}`,
		`- Max JS/Node Mie radiance delta: ${comparison.maxMieRadianceDelta}`,
		`- Max JS/Node path radiance delta: ${comparison.maxPathRadianceDelta}`,
		`- Max JS/Node final radiance delta: ${comparison.maxFinalRadianceDelta}`,
		`- Max composition error: ${comparison.maxCompositionError}`,
		`- Shader diagnostic status: ${comparison.shaderComparison.status}`,
		`- Shader max path radiance delta: ${comparison.shaderComparison.maxPathRadianceDelta ?? 'n/a'}`,
		`- Shader max final radiance delta: ${comparison.shaderComparison.maxFinalRadianceDelta ?? 'n/a'}`,
		`- Limitations: ${comparison.limitations.join('; ')}`,
		'',
		'## Criteria',
		'',
		...criteria.map((item) => `- ${item.id}: ${item.status}`),
		'',
	].join('\n');
}

function threeToAlgorithmWorld(vector) {
	return [
		vector[0],
		-vector[2],
		ATMOSPHERE.bottomRadiusMeters + vector[1],
	];
}

function threeDirectionToAlgorithm(vector) {
	return normalize([vector[0], -vector[2], vector[1]]);
}

function dot(a, b) {
	return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function length(vector) {
	return Math.sqrt(dot(vector, vector));
}

function normalize(vector) {
	const vectorLength = length(vector);

	if (vectorLength === 0) {
		return [0, 0, 0];
	}

	return vector.map((value) => value / vectorLength);
}

function addScaled(origin, direction, distance) {
	return [
		origin[0] + direction[0] * distance,
		origin[1] + direction[1] * distance,
		origin[2] + direction[2] * distance,
	];
}

function maxAbs(values) {
	return values.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
}

function criterion({ id, status, tolerance = null, measured = null, notes }) {
	return {
		id,
		status,
		tolerance,
		measured,
		notes,
	};
}

function summarizeCriteria(criteria) {
	return {
		total: criteria.length,
		passed: criteria.filter((item) => item.status === 'passed').length,
		failed: criteria.filter((item) => item.status === 'failed').length,
		unresolved: criteria.filter((item) => item.status === 'unresolved').length,
	};
}

async function nextArtifactDirectory(outRoot, label) {
	await fs.mkdir(outRoot, { recursive: true });
	const entries = await fs.readdir(outRoot, { withFileTypes: true });
	const maxNumber = entries
		.filter((entry) => entry.isDirectory() && /^\d{3}-/.test(entry.name))
		.reduce((max, entry) => Math.max(max, Number(entry.name.slice(0, 3))), 0);
	const folderName = `${String(maxNumber + 1).padStart(3, '0')}-${slug(label)}`;
	const directory = path.join(outRoot, folderName);

	await fs.mkdir(directory, { recursive: false });

	return {
		directory,
		folderName,
		relativeFolder: path.relative(REPO_ROOT, directory).replaceAll('\\', '/'),
	};
}

async function writeJson(filePath, value) {
	await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeText(filePath, value) {
	await fs.writeFile(filePath, value);
}

function slug(value) {
	return String(value || 'run')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80) || 'run';
}

function log(runLog, message) {
	runLog.push(`${new Date().toISOString()} ${message}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
