import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
	FLAT_SCENE_SKY_RAY_LIMIT_METERS,
	FLAT_SCENE_SKY_RAY_LIMIT_POLICY,
	NUMERICAL_CONTROLS,
	SPECTRAL_CHANNELS,
	runNodeThreeReference,
} from './node-three-reference.js';
import {
	createAlgorithm32Model,
	createFlatLocalPointSunSource,
	createFlatZUpAtmosphereGeometry,
	GEOMETRY_KINDS,
	SOURCE_KINDS,
} from './algorithm32-source-contract.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_OUT_ROOT = path.join(
	REPO_ROOT,
	'tmp/atmosphere/algorithm32_shader_lab'
);
const DEFAULT_ATMOSFLAT_REFERENCE = path.join(
	REPO_ROOT,
	'tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes'
);
const SCRIPT_PATH = path.relative(REPO_ROOT, __filename).replaceAll('\\', '/');

const LOCAL_RENDER_CASES = [
	{
		id: 'local-source-closest-day',
		role: 'day-closest-approach',
		offsetDegrees: 0,
		sceneMode: 'three-card-reference',
		args: ['--width', '240', '--height', '120', '--scattering-order', 'first-order'],
		imageName: 'local-source-closest-day.png',
	},
	{
		id: 'local-source-090deg-rise-sunset',
		role: 'rise-sunset-90deg-orbit-offset',
		offsetDegrees: 90,
		sceneMode: 'sunset-floor',
		args: [
			'--scene',
			'sunset-floor',
			'--sunset-framing',
			'less-zoom',
			'--width',
			'320',
			'--height',
			'180',
			'--scattering-order',
			'first-order',
		],
		imageName: 'local-source-090deg-rise-sunset.png',
	},
];

async function main() {
	const options = parseArgs(process.argv.slice(2));

	if (options.help) {
		printHelp();
		return;
	}

	const startedAt = new Date();
	const runLog = [];
	log(runLog, 'Started CPU local-source integrated render experiment.');
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	const casesRoot = path.join(artifact.directory, 'cases');

	await fs.mkdir(casesRoot, { recursive: true });
	log(runLog, `Created artifact folder ${artifact.relativeFolder}.`);

	const reference = await loadAtmosflatReference(options.atmosflatReference);
	log(runLog, `Loaded atmosflat source reference ${reference.relativeDirectory}.`);

	const distantControl = await runDistantControl({ options, casesRoot, runLog });
	log(runLog, `Distant control completed with ${distantControl.status}.`);

	const localCases = [];
	for (const localCaseDefinition of LOCAL_RENDER_CASES) {
		const localCase = await runLocalCase({
			options,
			artifact,
			casesRoot,
			reference,
			localCaseDefinition,
			runLog,
		});
		localCases.push(localCase);
		log(runLog, `${localCase.id} completed with ${localCase.status}.`);
	}

	const criteria = evaluateCriteria({
		options,
		distantControl,
		localCases,
		reference,
	});
	const summary = summarizeCriteria(criteria);
	const endedAt = new Date();
	const packet = {
		kind: 'algorithm32-cpu-local-source-integrated-render-result',
		status: summary.failed === 0 ? 'accepted' : 'rejected',
		createdAt: startedAt.toISOString(),
		completedAt: endedAt.toISOString(),
		durationMs: endedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		summary,
	};

	await writeArtifact({
		artifact,
		options,
		reference,
		distantControl,
		localCases,
		criteria,
		summary,
		packet,
		runLog,
	});

	console.log(`CPU local-source integrated render ${packet.status}: ${artifact.directory}`);
	console.log(
		`Criteria: ${summary.passed} passed, ${summary.failed} failed, ${summary.unresolved} unresolved`
	);
}

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		label: 'cpu-local-source-integrated-render',
		atmosflatReference: DEFAULT_ATMOSFLAT_REFERENCE,
		sceneSkyRayLimitMeters: FLAT_SCENE_SKY_RAY_LIMIT_METERS,
		sceneSkyRayLimitPolicy: FLAT_SCENE_SKY_RAY_LIMIT_POLICY,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--out-root') {
			options.outRoot = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--label') {
			options.label = slug(argv[index + 1]);
			index += 1;
		} else if (arg === '--atmosflat-reference') {
			options.atmosflatReference = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--scene-sky-ray-limit-meters') {
			options.sceneSkyRayLimitMeters = Number(argv[index + 1]);
			options.sceneSkyRayLimitPolicy = 'explicit-command-line-poc-override';
			index += 1;
		} else if (arg === '--help' || arg === '-h') {
			options.help = true;
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}
	}

	if (
		!Number.isFinite(options.sceneSkyRayLimitMeters) ||
		options.sceneSkyRayLimitMeters <= 0
	) {
		throw new Error('--scene-sky-ray-limit-meters must be a positive number.');
	}

	return options;
}

function printHelp() {
	console.log(`Algorithm32 CPU local-source integrated render

Usage:
  node scripts/flat/algorithm32-shader-lab/cpu-local-source-integrated-render.js

Options:
  --out-root <path>                    Output root. Default: tmp/atmosphere/algorithm32_shader_lab
  --label <name>                       Artifact folder label.
  --atmosflat-reference <path>         Accepted atmosflat32 artifact. Default: tmp/atmosphere/atmosflat32/018-flat-app-rotation-skydomes
  --scene-sky-ray-limit-meters <value> Flat no-hit sky segment limit. Default: ${FLAT_SCENE_SKY_RAY_LIMIT_METERS}
`);
}

async function loadAtmosflatReference(referenceDirectory) {
	const directory = path.resolve(referenceDirectory);
	const inputs = await readJson(path.join(directory, 'inputs.json'));

	return {
		directory,
		relativeDirectory: path.relative(REPO_ROOT, directory).replaceAll('\\', '/'),
		inputs,
	};
}

async function runDistantControl({ options, casesRoot }) {
	const referencePath = path.join(
		options.outRoot,
		'037-algorithm32-simple-card-reference'
	);
	const run = await runNodeThreeReference([
		'--out-root',
		casesRoot,
		'--label',
		'distant-sun-regression-control',
		'--width',
		'240',
		'--height',
		'120',
		'--compare-reference',
		referencePath,
	]);
	const runDir = run.artifact.directory;
	const result = await readJson(path.join(runDir, 'result.json'));
	const comparison = await readJson(
		path.join(runDir, 'source-contract-comparison.json')
	);

	return {
		id: 'distant-sun-regression-control',
		status: result.status,
		summary: result.summary,
		runDir: path.relative(REPO_ROOT, runDir).replaceAll('\\', '/'),
		reference: path.relative(REPO_ROOT, referencePath).replaceAll('\\', '/'),
		comparisonSummary: {
			imageMatches: comparison.imageComparison.matches,
			imageMaxAbsByteDelta: comparison.imageComparison.maxAbsByteDelta,
			selectedMatches: comparison.selectedComparison.matches,
			geometryMatches: comparison.geometryComparison.matches,
			transportMatches: comparison.transportComparison.matches,
			criteriaMatches: comparison.criteriaComparison.matches,
		},
	};
}

async function runLocalCase({
	options,
	artifact,
	casesRoot,
	reference,
	localCaseDefinition,
}) {
	const sourceConfig = sourceConfigForOffset({
		reference,
		offsetDegrees: localCaseDefinition.offsetDegrees,
	});
	const model = createLocalModel({
		options,
		reference,
		sourceConfig,
	});
	const sunCaseOverride = sunCaseFromSourceSample({
		localCaseDefinition,
		sourceSample: model.sampleSource(sourceConfig.observerPositionMeters),
	});
	const args = [
		'--out-root',
		casesRoot,
		'--label',
		localCaseDefinition.id,
		...localCaseDefinition.args,
	];
	const run = await runNodeThreeReference(args, {
		algorithm32Model: model,
		sunCaseOverride,
		sourceRunLabel: localCaseDefinition.role,
	});
	const runDir = run.artifact.directory;
	const result = await readJson(path.join(runDir, 'result.json'));
	const sourceContract = await readJson(path.join(runDir, 'source-contract.json'));
	const sourceSampleTraces = await readJson(
		path.join(runDir, 'source-sample-traces.json')
	);
	const transportDiagnostics = await readJson(
		path.join(runDir, 'transport-diagnostics.json')
	);
	const imageStats = await readJson(path.join(runDir, 'image-stats.json'));
	const criteria = await readJson(path.join(runDir, 'criteria-results.json'));
	const topLevelImagePath = path.join(artifact.directory, localCaseDefinition.imageName);

	await fs.copyFile(path.join(runDir, 'reference-image.png'), topLevelImagePath);

	return {
		id: localCaseDefinition.id,
		role: localCaseDefinition.role,
		offsetDegrees: localCaseDefinition.offsetDegrees,
		sceneMode: localCaseDefinition.sceneMode,
		status: result.status,
		summary: result.summary,
		runDir: path.relative(REPO_ROOT, runDir).replaceAll('\\', '/'),
		imagePath: path
			.relative(REPO_ROOT, topLevelImagePath)
			.replaceAll('\\', '/'),
		sourceConfig: summarizeSourceConfig(sourceConfig),
		sunCaseOverride,
		sourceContract,
		sourceSampleTraces,
		transportSummary: summarizeTransport(transportDiagnostics),
		imageStats,
		criteriaSummary: criteria.summary,
	};
}

function sourceConfigForOffset({ reference, offsetDegrees }) {
	const suffix = `${String(offsetDegrees).padStart(3, '0')}deg`;
	const sourceConfig = reference.inputs.transportSourceConfigs.find((item) =>
		item.flatSourceConfig.sceneKey.includes(suffix)
	);

	if (!sourceConfig) {
		throw new Error(`Missing atmosflat local source config for offset ${offsetDegrees}.`);
	}

	return sourceConfig;
}

function createLocalModel({ options, reference, sourceConfig }) {
	const geometry = createFlatZUpAtmosphereGeometry({
		topAltitudeMeters:
			reference.inputs.geometry.atmosphereGeometry.atmosphereTopAltitudeMeters,
		observerPositionMeters: sourceConfig.observerPositionMeters,
		sceneSkyRayLimitMeters: options.sceneSkyRayLimitMeters,
		sceneSkyRayLimitPolicy: options.sceneSkyRayLimitPolicy,
	});
	const source = createFlatLocalPointSunSource({
		id: sourceConfig.sceneKey,
		positionMeters: sourceConfig.positionMeters,
		radiusKm: sourceConfig.radiusKm,
		referenceDistanceKm: sourceConfig.radianceConfig.referenceDistanceKm,
		referenceSpectralIncidentScale: sourceConfig.referenceSpectralIncidentScale,
		distanceFalloff: sourceConfig.radianceConfig.distanceFalloff,
		spectralChannels: SPECTRAL_CHANNELS,
		color: sourceConfig.color,
		provenance: {
			sourceArtifact: reference.relativeDirectory,
			flatSceneKey: sourceConfig.flatSourceConfig.sceneKey,
			appSolarIrradianceScale:
				sourceConfig.flatSourceConfig.solarIrradianceScale,
			calibratedSolarIrradianceScale: sourceConfig.solarIrradianceScale,
			brightnessCalibration: sourceConfig.brightnessCalibration,
		},
	});

	return createAlgorithm32Model({
		geometry,
		source,
		spectralProfile: {
			kind: 'algorithm32-15-channel-profile',
			channels: SPECTRAL_CHANNELS.map((channel) => ({
				wavelengthNanometers: channel.wavelengthNanometers,
				solarIrradiance: channel.solarIrradiance,
			})),
		},
		numericalConfig: {
			...NUMERICAL_CONTROLS,
			localSourceMode: 'first-order-integrated-render',
			localSecondOrder: 'deferred',
		},
	});
}

function sunCaseFromSourceSample({ localCaseDefinition, sourceSample }) {
	const direction = sourceSample.direction;
	const altitudeDegrees = radiansToDegrees(Math.asin(direction[2]));
	const azimuthDegrees = radiansToDegrees(Math.atan2(direction[1], direction[0]));

	return {
		id: localCaseDefinition.id,
		role: localCaseDefinition.role,
		sourceKind: SOURCE_KINDS.flatLocalPointSun,
		offsetDegrees: localCaseDefinition.offsetDegrees,
		sunAltitudeDegrees: altitudeDegrees,
		sunAzimuthDegrees: azimuthDegrees,
		sunDirection: direction,
		sourceDistanceMeters: sourceSample.distanceMeters,
		incidentScale: sourceSample.incidentScale,
	};
}

function summarizeSourceConfig(sourceConfig) {
	return {
		sceneKey: sourceConfig.sceneKey,
		flatSceneKey: sourceConfig.flatSourceConfig.sceneKey,
		positionMeters: sourceConfig.positionMeters,
		observerPositionMeters: sourceConfig.observerPositionMeters,
		observerDistanceKm: sourceConfig.observerDistanceKm,
		radiusKm: sourceConfig.radiusKm,
		referenceDistanceKm: sourceConfig.radianceConfig.referenceDistanceKm,
		distanceFalloff: sourceConfig.radianceConfig.distanceFalloff,
		referenceSpectralIncidentScale: sourceConfig.referenceSpectralIncidentScale,
		calibratedSolarIrradianceScale: sourceConfig.solarIrradianceScale,
		rawAppSolarIrradianceScale:
			sourceConfig.flatSourceConfig.solarIrradianceScale,
		brightnessCalibration: sourceConfig.brightnessCalibration,
	};
}

function summarizeTransport(transportDiagnostics) {
	const sourceDistances = transportDiagnostics.samplePackets.map(
		(packet) => packet.sourceSampleAtRayOrigin.distanceMeters
	);
	const incidentScales = transportDiagnostics.samplePackets.map(
		(packet) => packet.sourceSampleAtRayOrigin.incidentScale
	);
	const pathRadianceMeans = transportDiagnostics.samplePackets.map((packet) =>
		mean(packet.transfer.pathRadianceByWavelength)
	);

	return {
		sourceKind: transportDiagnostics.sourceKind,
		geometryKind: transportDiagnostics.geometryKind,
		sampleCount: transportDiagnostics.samplePackets.length,
		minSourceDistanceMeters: Math.min(...sourceDistances),
		maxSourceDistanceMeters: Math.max(...sourceDistances),
		minIncidentScale: Math.min(...incidentScales),
		maxIncidentScale: Math.max(...incidentScales),
		maxMeanPathRadiance: Math.max(...pathRadianceMeans),
		cacheDiagnostics: transportDiagnostics.cacheDiagnostics,
	};
}

function evaluateCriteria({ options, distantControl, localCases, reference }) {
	const criteria = [];

	criteria.push(
		criterion({
			id: 'distant-sun-regression-control-unchanged',
			status:
				distantControl.status === 'accepted' &&
				Object.entries(distantControl.comparisonSummary).every(
					([key, value]) =>
						key === 'imageMaxAbsByteDelta' ? value === 0 : value === true
				)
					? 'pass'
					: 'fail',
			tolerance: {
				status: 'accepted',
				imageMaxAbsByteDelta: 0,
				selectedAndTransportJson: 'reference-owned fields exact',
			},
			measured: distantControl,
			notes:
				'The default spherical distant-Sun renderer still matches the accepted CPU reference after the local-source integration.',
		})
	);

	for (const localCase of localCases) {
		criteria.push(
			criterion({
				id: `${localCase.id}-accepted-render`,
				status: localCase.status === 'accepted' ? 'pass' : 'fail',
				tolerance: { status: 'accepted' },
				measured: {
					status: localCase.status,
					summary: localCase.summary,
					runDir: localCase.runDir,
					imagePath: localCase.imagePath,
				},
				notes:
					'Nested CPU render accepted using the configured local source and active-source transport criteria.',
			})
		);
		criteria.push(
			criterion({
				id: `${localCase.id}-flat-local-source-contract`,
				status:
					localCase.sourceContract.source.kind ===
						SOURCE_KINDS.flatLocalPointSun &&
					localCase.sourceContract.geometry.kind ===
						GEOMETRY_KINDS.flatZUpAtmosphere &&
					localCase.sourceContract.geometry.sceneSkyRayLimitMeters ===
						options.sceneSkyRayLimitMeters
						? 'pass'
						: 'fail',
				tolerance: {
					sourceKind: SOURCE_KINDS.flatLocalPointSun,
					geometryKind: GEOMETRY_KINDS.flatZUpAtmosphere,
					sceneSkyRayLimitMeters: options.sceneSkyRayLimitMeters,
				},
				measured: {
					sourceKind: localCase.sourceContract.source.kind,
					geometryKind: localCase.sourceContract.geometry.kind,
					sceneSkyRayLimitMeters:
						localCase.sourceContract.geometry.sceneSkyRayLimitMeters,
					sceneSkyRayLimitPolicy:
						localCase.sourceContract.geometry.sceneSkyRayLimitPolicy,
				},
				notes:
					'The nested render uses the configured flat/local source contract, including the renderer-owned sky/no-hit segment policy.',
			})
		);
		criteria.push(
			criterion({
				id: `${localCase.id}-finite-source-samples`,
				status:
					localCase.sourceSampleTraces.samples.every(
						(sample) =>
							sample.sourceSample.kind === SOURCE_KINDS.flatLocalPointSun &&
							sample.sourceSample.distanceKind === 'finite' &&
							Number.isFinite(sample.sourceSample.distanceMeters) &&
							sample.sourceSample.distanceMeters > 0
					)
						? 'pass'
						: 'fail',
				tolerance: {
					sourceKind: SOURCE_KINDS.flatLocalPointSun,
					distanceKind: 'finite',
					distanceMeters: 'finite positive',
				},
				measured: localCase.sourceSampleTraces.samples.map((sample) => ({
					id: sample.id,
					sourceSample: sample.sourceSample,
				})),
				notes:
					'Observer, 10 km, and camera trace points all sample the finite local source.',
			})
		);
		criteria.push(
			criterion({
				id: `${localCase.id}-first-order-local-cache-policy`,
				status:
					localCase.imageStats.cacheDiagnostics.incidentSkyCacheEntries === 0 &&
					localCase.transportSummary.cacheDiagnostics.incidentSkyCacheEntries === 0
						? 'pass'
						: 'fail',
				tolerance: { incidentSkyCacheEntries: 0 },
				measured: {
					imageCacheEntries:
						localCase.imageStats.cacheDiagnostics.incidentSkyCacheEntries,
					diagnosticCacheEntries:
						localCase.transportSummary.cacheDiagnostics.incidentSkyCacheEntries,
				},
				notes:
					'Local-source CPU rendering is intentionally first-order; distant-Sun second-order cache use is not silently applied.',
			})
		);
	}

	const day = localCases.find((item) => item.role === 'day-closest-approach');
	const rise = localCases.find(
		(item) => item.role === 'rise-sunset-90deg-orbit-offset'
	);
	criteria.push(
		criterion({
			id: 'closest-brighter-than-90deg-source',
			status:
				day &&
				rise &&
				day.sunCaseOverride.incidentScale > rise.sunCaseOverride.incidentScale
					? 'pass'
					: 'fail',
			tolerance: {
				ordering: 'closest incident scale > 90 degree incident scale',
			},
			measured: {
				closestIncidentScale: day?.sunCaseOverride.incidentScale,
				ninetyDegreeIncidentScale: rise?.sunCaseOverride.incidentScale,
				referenceBrightnessCalibration: reference.inputs.brightnessCalibration,
			},
			notes:
				'The integrated render preserves the atmosflat calibrated inverse-square source-distance relationship.',
		})
	);
	criteria.push(
		criterion({
			id: 'flat-scene-sky-ray-limit-policy-recorded',
			status: 'pass',
			tolerance: {
				defaultMeters: FLAT_SCENE_SKY_RAY_LIMIT_METERS,
				overrideAllowed: true,
			},
			measured: {
				sceneSkyRayLimitMeters: options.sceneSkyRayLimitMeters,
				sceneSkyRayLimitPolicy: options.sceneSkyRayLimitPolicy,
				provenance:
					'Accepted artifact 062 found 100% lost/cannot see at 1,926.774 km for the recorded target/render setup; this is a POC renderer policy, not a physical constant.',
				futurePolicy:
					'Shorter practical-resolution caps can be tested later for realistic object sizes that lose angular resolution before fully fading.',
			},
			notes:
				'The flat scene no-hit ray limit is explicit and configurable, seeded by the accepted visibility experiment but not treated as universal physics.',
		})
	);

	return criteria;
}

async function writeArtifact({
	artifact,
	options,
	reference,
	distantControl,
	localCases,
	criteria,
	summary,
	packet,
	runLog,
}) {
	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'algorithm32-cpu-local-source-integrated-render-command',
		scriptPath: SCRIPT_PATH,
		options: {
			...options,
			atmosflatReference: path
				.relative(REPO_ROOT, options.atmosflatReference)
				.replaceAll('\\', '/'),
		},
	});
	await writeJson(path.join(artifact.directory, 'inputs.json'), {
		kind: 'algorithm32-cpu-local-source-integrated-render-inputs',
		sourceReference: reference.relativeDirectory,
		sourceBoundary: reference.inputs.sourceBoundary,
		atmosflatGeometry: reference.inputs.geometry,
		brightnessCalibration: reference.inputs.brightnessCalibration,
		sceneSkyRayLimit: {
			meters: options.sceneSkyRayLimitMeters,
			kilometers: options.sceneSkyRayLimitMeters / 1000,
			policy: options.sceneSkyRayLimitPolicy,
			status:
				'Renderer-owned POC no-hit sky ray length for flat scene images; configurable and not an Algorithm32 atmosphere constant.',
			futureShorterDistanceNote:
				'Later experiments may choose a shorter practical cap because realistic objects lose angular resolution before becoming fully obscured.',
		},
		localRenderCases: LOCAL_RENDER_CASES,
	});
	await writeJson(path.join(artifact.directory, 'distant-control.json'), distantControl);
	await writeJson(path.join(artifact.directory, 'local-render-cases.json'), {
		kind: 'algorithm32-cpu-local-source-integrated-render-cases',
		cases: localCases,
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'algorithm32-cpu-local-source-integrated-render-criteria',
		summary,
		criteria,
	});
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeText(path.join(artifact.directory, 'run.log'), `${runLog.join('\n')}\n`);
	await writeText(path.join(artifact.directory, 'report.md'), makeReport({
		artifact,
		summary,
		distantControl,
		localCases,
		options,
	}));
	await fs.copyFile(__filename, path.join(artifact.directory, 'script-snapshot.js'));
}

function makeReport({
	artifact,
	summary,
	distantControl,
	localCases,
	options,
}) {
	return [
		'# CPU Local-Source Integrated Render',
		'',
		`Artifact: \`${artifact.relativeFolder}\``,
		'',
		`Status: ${summary.failed === 0 ? 'accepted' : 'rejected'} (${summary.passed} passed, ${summary.failed} failed, ${summary.unresolved} unresolved).`,
		'',
		'This POC fully routes the CPU image renderer through the Algorithm32 source/geometry contract for flat/local point Sun cases. The first-order local path evaluates source direction, distance falloff, spectral incident scale, source-path transmittance, and phase at each atmosphere sample. It does not render a visible solar disc, ground bounce, local second-order cache behavior, or shader output.',
		'',
		'## Distant Control',
		'',
		`- \`${distantControl.runDir}\`: ${distantControl.status}, exact image delta ${distantControl.comparisonSummary.imageMaxAbsByteDelta}.`,
		'',
		'## Local Images',
		'',
		...localCases.map(
			(localCase) =>
				`- \`${localCase.imagePath}\`: ${localCase.role}, offset ${localCase.offsetDegrees} deg, distance ${(localCase.sunCaseOverride.sourceDistanceMeters / 1000).toFixed(3)} km, incident scale ${localCase.sunCaseOverride.incidentScale}.`
		),
		'',
		'## Flat Scene Ray Policy',
		'',
		`- Limit: ${options.sceneSkyRayLimitMeters} m (${(options.sceneSkyRayLimitMeters / 1000).toFixed(3)} km).`,
		`- Policy: ${options.sceneSkyRayLimitPolicy}.`,
		'- This is a renderer-owned no-hit sky segment policy seeded by the accepted flat visibility run, not an atmosphere constant. A shorter practical cap can be tested later for realistic object angular-resolution loss.',
		'',
		'## Outputs',
		'',
		'- `distant-control.json`: default distant-Sun no-regression control.',
		'- `local-render-cases.json`: nested run summaries, source contracts, traces, and transport summaries.',
		'- `local-source-closest-day.png`: closest-approach local-source CPU image.',
		'- `local-source-090deg-rise-sunset.png`: 90-degree orbit-offset local-source CPU image.',
		'- `criteria-results.json`: aggregate criteria.',
		'',
	].join('\n');
}

function criterion({ id, status, tolerance, measured, notes }) {
	return {
		criterionId: id,
		status,
		tolerance,
		measured,
		notes,
	};
}

function summarizeCriteria(criteria) {
	return {
		total: criteria.length,
		passed: criteria.filter((item) => item.status === 'pass').length,
		failed: criteria.filter((item) => item.status === 'fail').length,
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

async function readJson(filePath) {
	return JSON.parse(await fs.readFile(filePath, 'utf8'));
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

function radiansToDegrees(value) {
	return (value * 180) / Math.PI;
}

function mean(values) {
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function log(runLog, message) {
	runLog.push(`${new Date().toISOString()} ${message}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
