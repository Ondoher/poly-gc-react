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

const OPTICAL_LENGTH_TOLERANCE_METERS = 1e-6;
const OPTICAL_DEPTH_TOLERANCE = 1e-12;
const TRANSMITTANCE_TOLERANCE = 1e-12;
const SHADER_OPTICAL_LENGTH_TOLERANCE_METERS = 10;
const SHADER_TRANSMITTANCE_TOLERANCE = 1e-3;
const SHADER_PATH_DISTANCE_TOLERANCE_METERS = 0.1;

const ATMOSPHERE = Object.freeze({
	bottomRadiusMeters: 6360000,
	topRadiusMeters: 6420000,
	rayleighScaleHeightMeters: 8000,
	mieScaleHeightMeters: 1200,
	rayleighCoefficientScale: 1.24062e-6,
	mieAngstromAlpha: 0.8,
	mieAngstromBeta: 0.04,
	mieScaleHeightMetersForCoefficient: 1200,
	ozoneAbsorption: 0,
	componentViewSamples: 32,
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

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		browserRun: null,
		label: 'browser-atmosphere-components-comparison',
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
	console.log(`Algorithm32 browser atmosphere-component diagnostics

Usage:
  node scripts/flat/algorithm32-shader-lab/browser-atmosphere-components-diagnostics.js --browser-run <artifact-folder-or-result-json>

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
	log(runLog, 'Started browser atmosphere-component comparison.');
	const browserPacketInfo = await readBrowserPacket(options);
	log(runLog, `Loaded browser artifact ${browserPacketInfo.sourcePath}.`);
	const browserResult = browserPacketInfo.packet.result;

	if (!browserResult || !Array.isArray(browserResult.atmosphereComponents)) {
		throw new Error('Browser artifact does not contain result.atmosphereComponents.');
	}

	const comparison = compareAtmosphereComponents(browserResult);
	const criteria = evaluateCriteria({
		browserPacket: browserPacketInfo.packet,
		browserResult,
		comparison,
	});
	const summary = summarizeCriteria(criteria);
	const endedAt = new Date();
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	const packet = {
		kind: 'algorithm32-browser-atmosphere-components-comparison',
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

	console.log(
		`Browser atmosphere-component diagnostics ${packet.status}: ${artifact.directory}`
	);
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

function compareAtmosphereComponents(browserResult) {
	const browserComponentsById = new Map(
		browserResult.atmosphereComponents.map((component) => [component.id, component])
	);
	const comparisons = browserResult.selectedPixels.map((sample) => {
		const browserComponent = browserComponentsById.get(sample.id);
		const cpuComponent = computeAtmosphereComponents(sample);
		return compareComponent(browserComponent, cpuComponent);
	});
	const finiteObjectComponents = comparisons.filter(
		(comparison) => comparison.browser.pathKind === 'finite-scene-segment'
	);

	return {
		kind: 'algorithm32-browser-atmosphere-components-comparison',
		componentCount: comparisons.length,
		comparisons,
		maxPathDistanceDeltaMeters: maxAbs(
			comparisons.map((comparison) => comparison.pathDistanceDeltaMeters)
		),
		maxRayleighOpticalLengthDeltaMeters: maxAbs(
			comparisons.map((comparison) => comparison.opticalLengthDeltas.rayleigh)
		),
		maxMieOpticalLengthDeltaMeters: maxAbs(
			comparisons.map((comparison) => comparison.opticalLengthDeltas.mie)
		),
		maxOpticalDepthDelta: maxAbs(
			comparisons.flatMap((comparison) => comparison.opticalDepthDeltas)
		),
		maxTransmittanceDelta: maxAbs(
			comparisons.flatMap((comparison) => comparison.transmittanceDeltas)
		),
		transmittanceBounds: {
			min: Math.min(...comparisons.map((comparison) => comparison.browser.minTransmittance)),
			max: Math.max(...comparisons.map((comparison) => comparison.browser.maxTransmittance)),
		},
		shaderComparison: compareShaderDiagnostics(
			browserResult.atmosphereShaderDiagnostics
		),
		finiteObjectMeanTransmittanceById: Object.fromEntries(
			finiteObjectComponents.map((comparison) => [
				comparison.id,
				comparison.browser.meanTransmittance,
			])
		),
	};
}

function compareShaderDiagnostics(shaderDiagnostics) {
	if (!shaderDiagnostics) {
		return {
			status: 'missing',
			reason: 'Browser artifact did not include atmosphereShaderDiagnostics.',
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
		maxRayleighOpticalLengthDeltaMeters: maxAbs(
			shaderDiagnostics.samples.map((sample) => sample.deltas.rayleighOpticalLength)
		),
		maxMieOpticalLengthDeltaMeters: maxAbs(
			shaderDiagnostics.samples.map((sample) => sample.deltas.mieOpticalLength)
		),
		maxTransmittanceDelta: maxAbs(
			shaderDiagnostics.samples.map((sample) => sample.deltas.transmittance)
		),
		maxPathDistanceDeltaMeters: maxAbs(
			shaderDiagnostics.samples.map((sample) => sample.deltas.pathDistanceMeters)
		),
		samples: shaderDiagnostics.samples,
	};
}

function compareComponent(browserComponent, cpuComponent) {
	if (!browserComponent) {
		throw new Error(`Missing browser atmosphere component ${cpuComponent.id}.`);
	}

	return {
		id: cpuComponent.id,
		browser: summarizeComponent(browserComponent),
		cpu: summarizeComponent(cpuComponent),
		pathDistanceDeltaMeters:
			browserComponent.pathDistanceMeters - cpuComponent.pathDistanceMeters,
		opticalLengthDeltas: {
			rayleigh:
				browserComponent.opticalLengths.rayleighOpticalLength -
				cpuComponent.opticalLengths.rayleighOpticalLength,
			mie:
				browserComponent.opticalLengths.mieOpticalLength -
				cpuComponent.opticalLengths.mieOpticalLength,
			absorption:
				browserComponent.opticalLengths.absorptionOpticalLength -
				cpuComponent.opticalLengths.absorptionOpticalLength,
		},
		opticalDepthDeltas: browserComponent.opticalDepthByWavelength.map(
			(value, index) => value - cpuComponent.opticalDepthByWavelength[index]
		),
		transmittanceDeltas: browserComponent.transmittanceByWavelength.map(
			(value, index) => value - cpuComponent.transmittanceByWavelength[index]
		),
	};
}

function summarizeComponent(component) {
	return {
		id: component.id,
		classification: component.classification,
		hitObject: component.hitObject,
		pathKind: component.pathKind,
		pathDistanceMeters: component.pathDistanceMeters,
		sampleCount: component.sampleCount,
		opticalLengths: component.opticalLengths,
		minTransmittance: component.minTransmittance,
		maxTransmittance: component.maxTransmittance,
		meanTransmittance: component.meanTransmittance,
	};
}

function evaluateCriteria({ browserPacket, browserResult, comparison }) {
	const finiteTransmittance = comparison.comparisons.every((item) =>
		item.browser.minTransmittance >= 0 &&
		item.browser.maxTransmittance <= 1 &&
		Number.isFinite(item.browser.meanTransmittance)
	);
	const finiteObjectTrend = comparison.finiteObjectMeanTransmittanceById;
	const distanceTrendPass =
		finiteObjectTrend['near-red-card'] >
		finiteObjectTrend['middle-green-card'] &&
		finiteObjectTrend['middle-green-card'] >
		finiteObjectTrend['far-blue-card'];

	return [
		criterion({
			id: 'browser-artifact-accepted',
			status:
				browserPacket.status === 'accepted' &&
				browserResult.status === 'accepted' &&
				browserResult.kind === 'algorithm32-browser-atmosphere-components-result'
					? 'passed'
					: 'failed',
			measured: {
				harnessStatus: browserPacket.status,
				browserStatus: browserResult.status,
				resultKind: browserResult.kind,
			},
			notes: 'The comparison starts from an accepted browser atmosphere-component artifact.',
		}),
		criterion({
			id: 'component-coverage',
			status:
				comparison.componentCount === browserResult.selectedPixels.length
					? 'passed'
					: 'failed',
			measured: {
				componentCount: comparison.componentCount,
				selectedPixels: browserResult.selectedPixels.length,
			},
			notes: 'Every selected pixel has an atmosphere-component packet.',
		}),
		criterion({
			id: 'transmittance-bounds',
			status: finiteTransmittance ? 'passed' : 'failed',
			measured: comparison.transmittanceBounds,
			notes: 'All selected-pixel transmittance values are finite and bounded in [0, 1].',
		}),
		criterion({
			id: 'optical-length-parity',
			status:
				comparison.maxRayleighOpticalLengthDeltaMeters <=
					OPTICAL_LENGTH_TOLERANCE_METERS &&
				comparison.maxMieOpticalLengthDeltaMeters <=
					OPTICAL_LENGTH_TOLERANCE_METERS
					? 'passed'
					: 'failed',
			tolerance: {
				maxRayleighOpticalLengthDeltaMeters: OPTICAL_LENGTH_TOLERANCE_METERS,
				maxMieOpticalLengthDeltaMeters: OPTICAL_LENGTH_TOLERANCE_METERS,
			},
			measured: {
				maxRayleighOpticalLengthDeltaMeters:
					comparison.maxRayleighOpticalLengthDeltaMeters,
				maxMieOpticalLengthDeltaMeters:
					comparison.maxMieOpticalLengthDeltaMeters,
			},
			notes: 'Browser optical-length integration matches the Node reference.',
		}),
		criterion({
			id: 'optical-depth-parity',
			status:
				comparison.maxOpticalDepthDelta <= OPTICAL_DEPTH_TOLERANCE
					? 'passed'
					: 'failed',
			tolerance: {
				maxOpticalDepthDelta: OPTICAL_DEPTH_TOLERANCE,
			},
			measured: {
				maxOpticalDepthDelta: comparison.maxOpticalDepthDelta,
			},
			notes: 'Browser wavelength optical depth matches the Node reference.',
		}),
		criterion({
			id: 'transmittance-parity',
			status:
				comparison.maxTransmittanceDelta <= TRANSMITTANCE_TOLERANCE
					? 'passed'
					: 'failed',
			tolerance: {
				maxTransmittanceDelta: TRANSMITTANCE_TOLERANCE,
			},
			measured: {
				maxTransmittanceDelta: comparison.maxTransmittanceDelta,
			},
			notes: 'Browser Beer-Lambert transmittance matches the Node reference.',
		}),
		criterion({
			id: 'distance-response-trend',
			status: distanceTrendPass ? 'passed' : 'failed',
			measured: finiteObjectTrend,
			notes: 'Mean transmittance decreases from the near card to the middle card to the far card.',
		}),
		criterion({
			id: 'shader-diagnostic-available',
			status:
				comparison.shaderComparison.status === 'accepted' ? 'passed' : 'failed',
			measured: comparison.shaderComparison,
			notes: 'The browser artifact includes accepted WebGL2 atmosphere-component shader readback.',
		}),
		criterion({
			id: 'shader-optical-length-parity',
			status:
				comparison.shaderComparison.status === 'accepted' &&
				comparison.shaderComparison.maxRayleighOpticalLengthDeltaMeters <=
					SHADER_OPTICAL_LENGTH_TOLERANCE_METERS &&
				comparison.shaderComparison.maxMieOpticalLengthDeltaMeters <=
					SHADER_OPTICAL_LENGTH_TOLERANCE_METERS
					? 'passed'
					: 'failed',
			tolerance: {
				maxRayleighOpticalLengthDeltaMeters:
					SHADER_OPTICAL_LENGTH_TOLERANCE_METERS,
				maxMieOpticalLengthDeltaMeters:
					SHADER_OPTICAL_LENGTH_TOLERANCE_METERS,
			},
			measured: comparison.shaderComparison,
			notes: 'The WebGL2 diagnostic shader optical-length output matches the JS component packet within float-readback tolerance.',
		}),
		criterion({
			id: 'shader-transmittance-parity',
			status:
				comparison.shaderComparison.status === 'accepted' &&
				comparison.shaderComparison.maxTransmittanceDelta <=
					SHADER_TRANSMITTANCE_TOLERANCE &&
				comparison.shaderComparison.maxPathDistanceDeltaMeters <=
					SHADER_PATH_DISTANCE_TOLERANCE_METERS
					? 'passed'
					: 'failed',
			tolerance: {
				maxTransmittanceDelta: SHADER_TRANSMITTANCE_TOLERANCE,
				maxPathDistanceDeltaMeters: SHADER_PATH_DISTANCE_TOLERANCE_METERS,
			},
			measured: comparison.shaderComparison,
			notes: 'The WebGL2 diagnostic shader 532 nm Beer-Lambert transmittance matches the JS component packet.',
		}),
	];
}

function computeAtmosphereComponents(sample) {
	const origin = threeToAlgorithmWorld(sample.threeRay.origin);
	const direction = normalize(threeDirectionToAlgorithm(sample.threeRay.direction));
	const pathDistanceMeters = sample.classification === 'sky'
		? distanceToTopAtmosphereBoundary(origin, direction)
		: sample.hitDistanceMeters;
	const opticalLengths = computeOpticalLengthsAlongDistance({
		origin,
		direction,
		distance: pathDistanceMeters,
		sampleCount: ATMOSPHERE.componentViewSamples,
	});
	const opticalDepthByWavelength = SPECTRAL_WAVELENGTHS_NM.map((wavelengthNm) => {
		const wavelengthMicrometers = wavelengthNm * 1e-3;

		return (
			rayleighScatteringCoefficientAt(wavelengthMicrometers) *
				opticalLengths.rayleighOpticalLength +
			mieExtinctionCoefficientAt(wavelengthMicrometers) *
				opticalLengths.mieOpticalLength +
			ATMOSPHERE.ozoneAbsorption * opticalLengths.absorptionOpticalLength
		);
	});
	const transmittanceByWavelength = opticalDepthByWavelength.map((tau) =>
		Math.exp(-tau)
	);

	return {
		id: sample.id,
		classification: sample.classification,
		hitObject: sample.hitObject,
		pathKind: sample.classification === 'sky' ? 'sky-to-top-atmosphere' : 'finite-scene-segment',
		pathDistanceMeters,
		sampleCount: ATMOSPHERE.componentViewSamples,
		algorithm32Ray: {
			origin,
			direction,
		},
		opticalLengths,
		wavelengthsNanometers: SPECTRAL_WAVELENGTHS_NM,
		opticalDepthByWavelength,
		transmittanceByWavelength,
		minTransmittance: Math.min(...transmittanceByWavelength),
		maxTransmittance: Math.max(...transmittanceByWavelength),
		meanTransmittance: mean(transmittanceByWavelength),
	};
}

function computeOpticalLengthsAlongDistance({ origin, direction, distance, sampleCount }) {
	const step = distance / sampleCount;
	let rayleighOpticalLength = 0;
	let mieOpticalLength = 0;
	let absorptionOpticalLength = 0;
	let minAltitudeMeters = Number.POSITIVE_INFINITY;
	let maxAltitudeMeters = Number.NEGATIVE_INFINITY;

	for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
		const sampleDistance = sampleIndex * step;
		const samplePosition = addScaled(origin, direction, sampleDistance);
		const density = densityAtPosition(samplePosition);
		const weight = sampleIndex === 0 || sampleIndex === sampleCount ? 0.5 : 1;

		rayleighOpticalLength += density.rayleigh * weight * step;
		mieOpticalLength += density.mie * weight * step;
		absorptionOpticalLength += density.absorption * weight * step;
		minAltitudeMeters = Math.min(minAltitudeMeters, density.altitudeMeters);
		maxAltitudeMeters = Math.max(maxAltitudeMeters, density.altitudeMeters);
	}

	return {
		distanceMeters: distance,
		rayleighOpticalLength,
		mieOpticalLength,
		absorptionOpticalLength,
		altitudeRangeMeters: {
			min: minAltitudeMeters,
			max: maxAltitudeMeters,
		},
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
	const discriminant =
		radius * radius * (mu * mu - 1) +
		ATMOSPHERE.topRadiusMeters * ATMOSPHERE.topRadiusMeters;

	return Math.max(0, -radius * mu + Math.sqrt(Math.max(0, discriminant)));
}

function rayleighScatteringCoefficientAt(wavelengthMicrometers) {
	return ATMOSPHERE.rayleighCoefficientScale * wavelengthMicrometers ** -4;
}

function mieExtinctionCoefficientAt(wavelengthMicrometers) {
	return (
		(ATMOSPHERE.mieAngstromBeta / ATMOSPHERE.mieScaleHeightMetersForCoefficient) *
		wavelengthMicrometers ** -ATMOSPHERE.mieAngstromAlpha
	);
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
		kind: 'algorithm32-browser-atmosphere-components-command',
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
		kind: 'algorithm32-browser-atmosphere-components-criteria',
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
	await writeJson(path.join(options.outRoot, 'latest-browser-atmosphere-components.json'), {
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
		'# Browser Atmosphere Component Diagnostics',
		'',
		`Status: ${packet.status}`,
		'',
		'This artifact compares browser-selected optical lengths, wavelength optical depth, and Beer-Lambert transmittance against a Node reference using the same selected Three rays and hit distances.',
		'',
		'## Source Browser Run',
		'',
		`- Browser source: \`${packet.browserArtifact.sourcePath}\``,
		`- Browser result kind: \`${packet.browserArtifact.resultKind}\``,
		'',
		'## Metrics',
		'',
		`- Components: ${comparison.componentCount}`,
		`- Max rayleigh optical-length delta: ${comparison.maxRayleighOpticalLengthDeltaMeters}`,
		`- Max mie optical-length delta: ${comparison.maxMieOpticalLengthDeltaMeters}`,
		`- Max optical-depth delta: ${comparison.maxOpticalDepthDelta}`,
		`- Max transmittance delta: ${comparison.maxTransmittanceDelta}`,
		`- Transmittance range: ${comparison.transmittanceBounds.min} to ${comparison.transmittanceBounds.max}`,
		`- Shader diagnostic status: ${comparison.shaderComparison.status}`,
		`- Shader max transmittance delta: ${comparison.shaderComparison.maxTransmittanceDelta ?? 'n/a'}`,
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

function mean(values) {
	if (values.length === 0) {
		return 0;
	}

	return values.reduce((sum, value) => sum + value, 0) / values.length;
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
