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

const JS_NODE_TOLERANCE = 1e-12;
const SHADER_TOLERANCE = 1e-5;

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
});

const DIRECT_RADIANCE_SUN_CASE = Object.freeze({
	id: 'figure1-13h15-z21',
	sourceTimeOfDay: '13h15',
	sourceSunZenithDegrees: 21,
	sunAltitudeDegrees: 69,
	sunAzimuthDegrees: 85.31410016049729,
	role: 'highest-Sun render and stress case',
});

const SPECTRAL_WAVELENGTHS_NM = [
	375.666666666667,
	407,
	438.333333333333,
	469.666666666667,
	501,
	532.333333333333,
	563.666666666667,
	595,
	626.333333333333,
	657.666666666667,
	689,
	720.333333333333,
	751.666666666667,
	783,
	814.333333333333,
];
const SPECTRAL_SOLAR_IRRADIANCE = [
	1.068866666667,
	1.729673,
	1.862071666667,
	2.022063333333,
	1.908154,
	1.883391,
	1.834246666667,
	1.76744,
	1.65952,
	1.548102333333,
	1.45078,
	1.340960333333,
	1.262433333333,
	1.175208,
	1.090824,
];
const SPECTRAL_CHANNELS = SPECTRAL_WAVELENGTHS_NM.map(
	(wavelengthNanometers, index) => ({
		wavelengthNanometers,
		solarIrradiance: SPECTRAL_SOLAR_IRRADIANCE[index],
	})
);

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		browserRun: null,
		label: 'browser-direct-radiance-spectral-comparison',
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
	console.log(`Algorithm32 browser spectral direct radiance diagnostics

Usage:
  node scripts/flat/algorithm32-shader-lab/browser-direct-radiance-spectral-diagnostics.js --browser-run <artifact-folder-or-result-json>
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
	log(runLog, 'Started browser spectral direct radiance comparison.');
	const browserPacketInfo = await readBrowserPacket(options);
	log(runLog, `Loaded browser artifact ${browserPacketInfo.sourcePath}.`);
	const browserResult = browserPacketInfo.packet.result;

	if (!browserResult || !Array.isArray(browserResult.directRadianceSpectralDiagnostics)) {
		throw new Error('Browser artifact does not contain result.directRadianceSpectralDiagnostics.');
	}

	const comparison = compareSpectralRadiance(browserResult);
	const criteria = evaluateCriteria({
		browserPacket: browserPacketInfo.packet,
		browserResult,
		comparison,
	});
	const summary = summarizeCriteria(criteria);
	const endedAt = new Date();
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	const packet = {
		kind: 'algorithm32-browser-direct-radiance-spectral-comparison',
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

	console.log(`Browser spectral direct radiance diagnostics ${packet.status}: ${artifact.directory}`);
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

function compareSpectralRadiance(browserResult) {
	const browserById = new Map(
		browserResult.directRadianceSpectralDiagnostics.map((diagnostic) => [
			diagnostic.id,
			diagnostic,
		])
	);
	const comparisons = browserResult.selectedPixels.map((sample) => {
		const browserDiagnostic = browserById.get(sample.id);
		const cpuDiagnostic = computeDirectRadianceSpectralDiagnostic(sample);
		return compareDiagnostic(browserDiagnostic, cpuDiagnostic);
	});
	const compositionErrors = comparisons.flatMap((item) =>
		item.browser.finalRadianceByWavelength.map((finalRadiance, index) =>
			Math.abs(
				finalRadiance -
				(
					item.browser.transmittedObjectRadianceByWavelength[index] +
					item.browser.firstOrderPathRadianceByWavelength[index]
				)
			)
		)
	);
	const shaderComparison = compareShaderDiagnostics(
		browserResult.directRadianceSpectralShaderDiagnostics
	);

	return {
		kind: 'algorithm32-browser-direct-radiance-spectral-comparison',
		sampleCount: comparisons.length,
		channelCount: SPECTRAL_CHANNELS.length,
		flatSampleCount: comparisons.length * SPECTRAL_CHANNELS.length,
		comparisons,
		maxTransmittanceDelta: maxAbs(
			comparisons.flatMap((item) => item.deltas.transmittanceByWavelength)
		),
		maxRayleighRadianceDelta: maxAbs(
			comparisons.flatMap((item) =>
				item.deltas.firstOrderRayleighPathRadianceByWavelength
			)
		),
		maxMieRadianceDelta: maxAbs(
			comparisons.flatMap((item) =>
				item.deltas.firstOrderMiePathRadianceByWavelength
			)
		),
		maxPathRadianceDelta: maxAbs(
			comparisons.flatMap((item) =>
				item.deltas.firstOrderPathRadianceByWavelength
			)
		),
		maxFinalRadianceDelta: maxAbs(
			comparisons.flatMap((item) => item.deltas.finalRadianceByWavelength)
		),
		maxCompositionError: Math.max(0, ...compositionErrors),
		radianceBounds: {
			minPathRadiance: Math.min(
				...comparisons.flatMap((item) =>
					item.browser.firstOrderPathRadianceByWavelength
				)
			),
			maxPathRadiance: Math.max(
				...comparisons.flatMap((item) =>
					item.browser.firstOrderPathRadianceByWavelength
				)
			),
			minFinalRadiance: Math.min(
				...comparisons.flatMap((item) => item.browser.finalRadianceByWavelength)
			),
			maxFinalRadiance: Math.max(
				...comparisons.flatMap((item) => item.browser.finalRadianceByWavelength)
			),
		},
		shaderComparison,
		limitations: [...new Set(
			browserResult.directRadianceSpectralDiagnostics.flatMap((item) =>
				item.limitations || []
			)
		)],
	};
}

function compareDiagnostic(browserDiagnostic, cpuDiagnostic) {
	if (!browserDiagnostic) {
		throw new Error(`Missing browser spectral diagnostic ${cpuDiagnostic.id}.`);
	}

	return {
		id: cpuDiagnostic.id,
		browser: summarizeSpectralDiagnostic(browserDiagnostic),
		cpu: summarizeSpectralDiagnostic(cpuDiagnostic),
		deltas: {
			transmittanceByWavelength: subtractArrays(
				browserDiagnostic.transmittanceByWavelength,
				cpuDiagnostic.transmittanceByWavelength
			),
			firstOrderRayleighPathRadianceByWavelength: subtractArrays(
				browserDiagnostic.firstOrderRayleighPathRadianceByWavelength,
				cpuDiagnostic.firstOrderRayleighPathRadianceByWavelength
			),
			firstOrderMiePathRadianceByWavelength: subtractArrays(
				browserDiagnostic.firstOrderMiePathRadianceByWavelength,
				cpuDiagnostic.firstOrderMiePathRadianceByWavelength
			),
			firstOrderPathRadianceByWavelength: subtractArrays(
				browserDiagnostic.firstOrderPathRadianceByWavelength,
				cpuDiagnostic.firstOrderPathRadianceByWavelength
			),
			finalRadianceByWavelength: subtractArrays(
				browserDiagnostic.finalRadianceByWavelength,
				cpuDiagnostic.finalRadianceByWavelength
			),
		},
	};
}

function summarizeSpectralDiagnostic(diagnostic) {
	return {
		id: diagnostic.id,
		classification: diagnostic.classification,
		hitObject: diagnostic.hitObject,
		spectrumId: diagnostic.spectrumId,
		pathKind: diagnostic.pathKind,
		pathDistanceMeters: diagnostic.pathDistanceMeters,
		wavelengthsNanometers: diagnostic.wavelengthsNanometers,
		transmittanceByWavelength: diagnostic.transmittanceByWavelength,
		objectRadianceByWavelength: diagnostic.objectRadianceByWavelength,
		transmittedObjectRadianceByWavelength:
			diagnostic.transmittedObjectRadianceByWavelength,
		firstOrderRayleighPathRadianceByWavelength:
			diagnostic.firstOrderRayleighPathRadianceByWavelength,
		firstOrderMiePathRadianceByWavelength:
			diagnostic.firstOrderMiePathRadianceByWavelength,
		firstOrderPathRadianceByWavelength:
			diagnostic.firstOrderPathRadianceByWavelength,
		finalRadianceByWavelength: diagnostic.finalRadianceByWavelength,
	};
}

function compareShaderDiagnostics(shaderDiagnostics) {
	if (!shaderDiagnostics) {
		return {
			status: 'missing',
			reason: 'Browser artifact did not include spectral shader diagnostics.',
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
		sampleCount: shaderDiagnostics.sampleCount,
		channelCount: shaderDiagnostics.channelCount,
		flatSampleCount: shaderDiagnostics.flatSampleCount,
		maxRayleighRadianceDelta: maxAbs(
			shaderDiagnostics.flatSamples.map((sample) =>
				sample.deltas.firstOrderRayleighPathRadiance
			)
		),
		maxMieRadianceDelta: maxAbs(
			shaderDiagnostics.flatSamples.map((sample) =>
				sample.deltas.firstOrderMiePathRadiance
			)
		),
		maxPathRadianceDelta: maxAbs(
			shaderDiagnostics.flatSamples.map((sample) =>
				sample.deltas.firstOrderPathRadiance
			)
		),
		maxFinalRadianceDelta: maxAbs(
			shaderDiagnostics.flatSamples.map((sample) => sample.deltas.finalRadiance)
		),
	};
}

function evaluateCriteria({ browserPacket, browserResult, comparison }) {
	const finiteRadiance = comparison.comparisons.every((item) =>
		item.browser.transmittanceByWavelength.every((value) =>
			Number.isFinite(value) && value >= 0 && value <= 1
		) &&
		item.browser.firstOrderPathRadianceByWavelength.every((value) =>
			Number.isFinite(value) && value >= 0
		) &&
		item.browser.finalRadianceByWavelength.every((value) =>
			Number.isFinite(value) && value >= 0
		)
	);
	const limitationsRecorded =
		comparison.limitations.includes('15-wavelength first-order spectral diagnostic') &&
		comparison.limitations.includes('first-order single scattering only');

	return [
		criterion({
			id: 'browser-artifact-accepted',
			status:
				browserPacket.status === 'accepted' &&
				browserResult.status === 'accepted' &&
				browserResult.kind === 'algorithm32-browser-direct-radiance-spectral-diagnostics-result'
					? 'passed'
					: 'failed',
			measured: {
				harnessStatus: browserPacket.status,
				browserStatus: browserResult.status,
				resultKind: browserResult.kind,
			},
			notes: 'The comparison starts from an accepted browser spectral direct-radiance artifact.',
		}),
		criterion({
			id: 'spectral-coverage',
			status:
				comparison.sampleCount === browserResult.selectedPixels.length &&
				comparison.channelCount === SPECTRAL_CHANNELS.length &&
				comparison.flatSampleCount ===
					browserResult.selectedPixels.length * SPECTRAL_CHANNELS.length
					? 'passed'
					: 'failed',
			measured: {
				sampleCount: comparison.sampleCount,
				channelCount: comparison.channelCount,
				flatSampleCount: comparison.flatSampleCount,
			},
			notes: 'Every selected pixel has all 15 first-order spectral channels.',
		}),
		criterion({
			id: 'finite-nonnegative-spectral-radiance',
			status: finiteRadiance ? 'passed' : 'failed',
			measured: comparison.radianceBounds,
			notes: 'Selected spectral path and final radiance values are finite and nonnegative.',
		}),
		criterion({
			id: 'spectral-js-node-parity',
			status:
				comparison.maxTransmittanceDelta <= JS_NODE_TOLERANCE &&
				comparison.maxRayleighRadianceDelta <= JS_NODE_TOLERANCE &&
				comparison.maxMieRadianceDelta <= JS_NODE_TOLERANCE &&
				comparison.maxPathRadianceDelta <= JS_NODE_TOLERANCE &&
				comparison.maxFinalRadianceDelta <= JS_NODE_TOLERANCE
					? 'passed'
					: 'failed',
			tolerance: {
				maxDelta: JS_NODE_TOLERANCE,
			},
			measured: {
				maxTransmittanceDelta: comparison.maxTransmittanceDelta,
				maxRayleighRadianceDelta: comparison.maxRayleighRadianceDelta,
				maxMieRadianceDelta: comparison.maxMieRadianceDelta,
				maxPathRadianceDelta: comparison.maxPathRadianceDelta,
				maxFinalRadianceDelta: comparison.maxFinalRadianceDelta,
			},
			notes: 'Browser JS spectral first-order radiance matches independent Node recomputation.',
		}),
		criterion({
			id: 'spectral-composition-identity',
			status:
				comparison.maxCompositionError <= JS_NODE_TOLERANCE
					? 'passed'
					: 'failed',
			tolerance: {
				maxCompositionError: JS_NODE_TOLERANCE,
			},
			measured: {
				maxCompositionError: comparison.maxCompositionError,
			},
			notes: 'Each spectral final radiance equals T * objectRadiance + first-order path radiance.',
		}),
		criterion({
			id: 'iteration-limitations-recorded',
			status: limitationsRecorded ? 'passed' : 'failed',
			measured: {
				limitations: comparison.limitations,
			},
			notes: 'The artifact explicitly labels this as first-order spectral diagnostics, not full Algorithm32 parity.',
		}),
		criterion({
			id: 'shader-diagnostic-available',
			status:
				comparison.shaderComparison.status === 'accepted' ? 'passed' : 'failed',
			measured: comparison.shaderComparison,
			notes: 'The browser artifact includes accepted WebGL2 spectral direct-radiance shader readback.',
		}),
		criterion({
			id: 'shader-spectral-component-parity',
			status:
				comparison.shaderComparison.status === 'accepted' &&
				comparison.shaderComparison.maxRayleighRadianceDelta <=
					SHADER_TOLERANCE &&
				comparison.shaderComparison.maxMieRadianceDelta <= SHADER_TOLERANCE
					? 'passed'
					: 'failed',
			tolerance: {
				maxComponentRadianceDelta: SHADER_TOLERANCE,
			},
			measured: comparison.shaderComparison,
			notes: 'The WebGL2 shader Rayleigh and Mie spectral radiance components match browser JS within float-readback tolerance.',
		}),
		criterion({
			id: 'shader-spectral-final-parity',
			status:
				comparison.shaderComparison.status === 'accepted' &&
				comparison.shaderComparison.maxPathRadianceDelta <= SHADER_TOLERANCE &&
				comparison.shaderComparison.maxFinalRadianceDelta <= SHADER_TOLERANCE
					? 'passed'
					: 'failed',
			tolerance: {
				maxRadianceDelta: SHADER_TOLERANCE,
			},
			measured: comparison.shaderComparison,
			notes: 'The WebGL2 shader spectral path and final radiance match browser JS within float-readback tolerance.',
		}),
	];
}

function computeDirectRadianceSpectralDiagnostic(sample) {
	const channels = SPECTRAL_CHANNELS.map((channel) =>
		computeDirectRadianceChannelPacket(sample, channel)
	);
	const first = channels[0];

	return {
		id: sample.id,
		classification: sample.classification,
		hitObject: sample.hitObject,
		spectrumId: sample.spectrumId,
		pathKind: first.pathKind,
		pathDistanceMeters: first.pathDistanceMeters,
		algorithm32Ray: first.algorithm32Ray,
		wavelengthsNanometers: channels.map((channel) => channel.wavelengthNanometers),
		transmittanceByWavelength: channels.map((channel) => channel.transmittance),
		objectRadianceByWavelength: channels.map((channel) => channel.objectRadiance),
		transmittedObjectRadianceByWavelength: channels.map((channel) =>
			channel.transmittedObjectRadiance
		),
		firstOrderRayleighPathRadianceByWavelength: channels.map((channel) =>
			channel.firstOrderRayleighPathRadiance
		),
		firstOrderMiePathRadianceByWavelength: channels.map((channel) =>
			channel.firstOrderMiePathRadiance
		),
		firstOrderPathRadianceByWavelength: channels.map((channel) =>
			channel.firstOrderPathRadiance
		),
		finalRadianceByWavelength: channels.map((channel) => channel.finalRadiance),
	};
}

function computeDirectRadianceChannelPacket(sample, channel) {
	const origin = threeToAlgorithmWorld(sample.threeRay.origin);
	const direction = normalize(threeDirectionToAlgorithm(sample.threeRay.direction));
	const pathDistanceMeters = sample.classification === 'sky'
		? distanceToTopAtmosphereBoundary(origin, direction)
		: sample.hitDistanceMeters;
	const wavelengthNanometers = channel.wavelengthNanometers;
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
		solarIrradiance: channel.solarIrradiance,
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
		solarIrradiance: channel.solarIrradiance,
		algorithm32Ray: {
			origin,
			direction,
		},
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
	solarIrradiance,
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
		solarIrradiance *
		rayleighScatteringCoefficientAt(wavelengthMicrometers) *
		rayleighPhase;
	const mie =
		mieSum *
		step *
		solarIrradiance *
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
		kind: 'algorithm32-browser-direct-radiance-spectral-command',
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
		kind: 'algorithm32-browser-direct-radiance-spectral-criteria',
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
	await writeJson(
		path.join(options.outRoot, 'latest-browser-direct-radiance-spectral.json'),
		{
			...packet,
			artifacts: {
				runDir: artifact.directory,
				resultPath: path.join(artifact.directory, 'result.json'),
				comparisonPath: path.join(artifact.directory, 'comparison.json'),
				criteriaPath: path.join(artifact.directory, 'criteria-results.json'),
				reportPath: path.join(artifact.directory, 'report.md'),
			},
		}
	);
}

function makeReport({ packet, comparison, criteria }) {
	return [
		'# Browser Spectral Direct Radiance Diagnostics',
		'',
		`Status: ${packet.status}`,
		'',
		'This artifact compares selected-pixel 15-channel first-order spectral direct-radiance diagnostics from browser JS and WebGL2 shader readback against independent Node recomputation using the same Three rays and hit distances.',
		'',
		'## Source Browser Run',
		'',
		`- Browser source: \`${packet.browserArtifact.sourcePath}\``,
		`- Browser result kind: \`${packet.browserArtifact.resultKind}\``,
		'',
		'## Metrics',
		'',
		`- Samples: ${comparison.sampleCount}`,
		`- Channels: ${comparison.channelCount}`,
		`- Flattened shader values: ${comparison.flatSampleCount}`,
		`- Max JS/Node transmittance delta: ${comparison.maxTransmittanceDelta}`,
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

function subtractArrays(a, b) {
	return a.map((value, index) => value - b[index]);
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
