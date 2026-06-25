import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import {
	ATMOSPHERE,
	FLAT_SCENE_SKY_RAY_LIMIT_METERS,
	FLAT_SCENE_SKY_RAY_LIMIT_POLICY,
	NUMERICAL_CONTROLS,
	SPECTRAL_CHANNELS,
	SUN_CASES,
	runNodeThreeReference,
	sunDirection,
} from './node-three-reference.js';
import {
	createAlgorithm32Model,
	createDistantDirectionalSunSource,
	createFlatLocalPointSunSource,
	createFlatZUpAtmosphereGeometry,
	createSphericalAtmosphereGeometry,
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
const IMAGE_WIDTH = 320;
const IMAGE_HEIGHT = 180;
const LOCAL_OFFSETS = [0, 45, 90, 135, 180];
const DISTANT_CASES = [
	{
		id: 'distant-high-sun',
		label: 'Distant high',
		sunCaseId: 'figure1-13h15-z21',
		imageName: 'distant-high-sun.png',
	},
	{
		id: 'distant-low-sun',
		label: 'Distant low',
		sunCaseId: 'figure1-06h00-z87',
		imageName: 'distant-low-sun.png',
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
	log(runLog, 'Started CPU source subjective gallery.');
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	const casesRoot = path.join(artifact.directory, 'cases');

	await fs.mkdir(casesRoot, { recursive: true });
	log(runLog, `Created artifact folder ${artifact.relativeFolder}.`);

	const reference = await loadAtmosflatReference(options.atmosflatReference);
	log(runLog, `Loaded atmosflat source reference ${reference.relativeDirectory}.`);

	const cases = [];
	for (const distantCase of DISTANT_CASES) {
		const result = await runDistantCase({
			artifact,
			casesRoot,
			distantCase,
			runLog,
		});
		cases.push(result);
		log(runLog, `${result.id} completed with ${result.status}.`);
	}
	for (const offsetDegrees of LOCAL_OFFSETS) {
		const result = await runLocalCase({
			artifact,
			casesRoot,
			reference,
			offsetDegrees,
			options,
			runLog,
		});
		cases.push(result);
		log(runLog, `${result.id} completed with ${result.status}.`);
	}

	const galleryPath = await writeGallery({ artifact, cases });
	const criteria = evaluateCriteria({ cases, galleryPath });
	const summary = summarizeCriteria(criteria);
	const endedAt = new Date();
	const packet = {
		kind: 'algorithm32-cpu-source-subjective-gallery-result',
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
		cases,
		galleryPath,
		criteria,
		summary,
		packet,
		runLog,
	});

	console.log(`CPU source subjective gallery ${packet.status}: ${artifact.directory}`);
	console.log(
		`Criteria: ${summary.passed} passed, ${summary.failed} failed, ${summary.unresolved} unresolved`
	);
}

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		label: 'cpu-source-subjective-gallery',
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
	console.log(`Algorithm32 CPU source subjective gallery

Usage:
  node scripts/flat/algorithm32-shader-lab/cpu-source-subjective-gallery.js

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

async function runDistantCase({ artifact, casesRoot, distantCase }) {
	const sunCase = SUN_CASES.find((item) => item.id === distantCase.sunCaseId);

	if (!sunCase) {
		throw new Error(`Missing Sun case ${distantCase.sunCaseId}.`);
	}

	const model = createDistantModel(sunCase);
	const run = await runNodeThreeReference(
		[
			'--out-root',
			casesRoot,
			'--label',
			distantCase.id,
			'--width',
			String(IMAGE_WIDTH),
			'--height',
			String(IMAGE_HEIGHT),
			'--scattering-order',
			'first-order',
		],
		{
			algorithm32Model: model,
			sunCaseOverride: {
				...sunCase,
				sunDirection: sunDirection(sunCase),
			},
			sourceRunLabel: 'subjective-distant-source-gallery',
		}
	);
	const runDir = run.artifact.directory;
	const result = await readJson(path.join(runDir, 'result.json'));
	const imageStats = await readJson(path.join(runDir, 'image-stats.json'));
	const sourceContract = await readJson(path.join(runDir, 'source-contract.json'));
	const topLevelImagePath = path.join(artifact.directory, distantCase.imageName);

	await fs.copyFile(path.join(runDir, 'reference-image.png'), topLevelImagePath);

	return {
		id: distantCase.id,
		label: distantCase.label,
		sourceFamily: 'distant',
		status: result.status,
		summary: result.summary,
		sunCaseId: sunCase.id,
		sunDirection: sunDirection(sunCase),
		runDir: path.relative(REPO_ROOT, runDir).replaceAll('\\', '/'),
		imagePath: path.relative(REPO_ROOT, topLevelImagePath).replaceAll('\\', '/'),
		imageStats,
		sourceContract,
	};
}

async function runLocalCase({
	artifact,
	casesRoot,
	reference,
	offsetDegrees,
	options,
}) {
	const sourceConfig = sourceConfigForOffset({ reference, offsetDegrees });
	const model = createLocalModel({ reference, sourceConfig, options });
	const sourceSample = model.sampleSource(sourceConfig.observerPositionMeters);
	const caseId = `local-${String(offsetDegrees).padStart(3, '0')}deg`;
	const imageName = `${caseId}.png`;
	const run = await runNodeThreeReference(
		[
			'--out-root',
			casesRoot,
			'--label',
			caseId,
			'--width',
			String(IMAGE_WIDTH),
			'--height',
			String(IMAGE_HEIGHT),
			'--scattering-order',
			'first-order',
		],
		{
			algorithm32Model: model,
			sunCaseOverride: sunCaseFromSourceSample({ caseId, offsetDegrees, sourceSample }),
			sourceRunLabel: 'subjective-local-source-gallery',
		}
	);
	const runDir = run.artifact.directory;
	const result = await readJson(path.join(runDir, 'result.json'));
	const imageStats = await readJson(path.join(runDir, 'image-stats.json'));
	const sourceContract = await readJson(path.join(runDir, 'source-contract.json'));
	const sourceSampleTraces = await readJson(
		path.join(runDir, 'source-sample-traces.json')
	);
	const topLevelImagePath = path.join(artifact.directory, imageName);

	await fs.copyFile(path.join(runDir, 'reference-image.png'), topLevelImagePath);

	return {
		id: caseId,
		label: `Local ${offsetDegrees} deg`,
		sourceFamily: 'local',
		offsetDegrees,
		status: result.status,
		summary: result.summary,
		sourceDistanceKm: sourceSample.distanceKm,
		incidentScale: sourceSample.incidentScale,
		sunDirection: sourceSample.direction,
		runDir: path.relative(REPO_ROOT, runDir).replaceAll('\\', '/'),
		imagePath: path.relative(REPO_ROOT, topLevelImagePath).replaceAll('\\', '/'),
		imageStats,
		sourceContract,
		sourceSampleTraces,
	};
}

function createDistantModel(sunCase) {
	return createAlgorithm32Model({
		geometry: createSphericalAtmosphereGeometry({ atmosphere: ATMOSPHERE }),
		source: createDistantDirectionalSunSource({
			sunCase,
			direction: sunDirection(sunCase),
			spectralChannels: SPECTRAL_CHANNELS,
		}),
		spectralProfile: spectralProfile(),
		numericalConfig: {
			...NUMERICAL_CONTROLS,
			subjectiveGallery: 'first-order-only',
		},
	});
}

function createLocalModel({ reference, sourceConfig, options }) {
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
		spectralProfile: spectralProfile(),
		numericalConfig: {
			...NUMERICAL_CONTROLS,
			localSourceMode: 'subjective-first-order-gallery',
			localSecondOrder: 'deferred',
		},
	});
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

function sunCaseFromSourceSample({ caseId, offsetDegrees, sourceSample }) {
	const direction = sourceSample.direction;

	return {
		id: caseId,
		sourceKind: SOURCE_KINDS.flatLocalPointSun,
		offsetDegrees,
		sunAltitudeDegrees: radiansToDegrees(Math.asin(direction[2])),
		sunAzimuthDegrees: radiansToDegrees(Math.atan2(direction[1], direction[0])),
		sunDirection: direction,
		sourceDistanceMeters: sourceSample.distanceMeters,
		incidentScale: sourceSample.incidentScale,
	};
}

async function writeGallery({ artifact, cases }) {
	const panelWidth = IMAGE_WIDTH;
	const panelHeight = IMAGE_HEIGHT;
	const labelHeight = 44;
	const gap = 12;
	const padding = 16;
	const width = padding * 2 + cases.length * panelWidth + (cases.length - 1) * gap;
	const height = padding * 2 + labelHeight + panelHeight;
	const composites = [];

	for (let index = 0; index < cases.length; index += 1) {
		const galleryCase = cases[index];
		const left = padding + index * (panelWidth + gap);
		const imagePath = path.resolve(REPO_ROOT, galleryCase.imagePath);

		composites.push({
			input: Buffer.from(labelSvg({
				width: panelWidth,
				height: labelHeight,
				title: galleryCase.label,
				subtitle: labelSubtitle(galleryCase),
			})),
			left,
			top: padding,
		});
		composites.push({
			input: imagePath,
			left,
			top: padding + labelHeight,
		});
	}

	const galleryPath = path.join(artifact.directory, 'subjective-gallery.png');

	await sharp({
		create: {
			width,
			height,
			channels: 4,
			background: { r: 18, g: 22, b: 28, alpha: 1 },
		},
	})
		.composite(composites)
		.png()
		.toFile(galleryPath);

	return path.relative(REPO_ROOT, galleryPath).replaceAll('\\', '/');
}

function labelSvg({ width, height, title, subtitle }) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
		<rect width="100%" height="100%" fill="#151922"/>
		<text x="10" y="17" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#f2f4f8">${escapeXml(title)}</text>
		<text x="10" y="35" font-family="Arial, sans-serif" font-size="12" fill="#aeb7c8">${escapeXml(subtitle)}</text>
	</svg>`;
}

function labelSubtitle(galleryCase) {
	if (galleryCase.sourceFamily === 'distant') {
		return galleryCase.sunCaseId;
	}

	return `${galleryCase.sourceDistanceKm.toFixed(1)} km, scale ${galleryCase.incidentScale.toFixed(3)}`;
}

function evaluateCriteria({ cases, galleryPath }) {
	const criteria = [];
	const localCases = cases.filter((item) => item.sourceFamily === 'local');
	const distantCases = cases.filter((item) => item.sourceFamily === 'distant');

	criteria.push(
		criterion({
			id: 'subjective-gallery-cases-rendered',
			status:
				cases.length === DISTANT_CASES.length + LOCAL_OFFSETS.length &&
				cases.every((item) => item.status === 'accepted')
					? 'pass'
					: 'fail',
			tolerance: {
				totalCases: DISTANT_CASES.length + LOCAL_OFFSETS.length,
				nestedStatus: 'accepted',
			},
			measured: cases.map((item) => ({
				id: item.id,
				status: item.status,
				summary: item.summary,
				runDir: item.runDir,
				imagePath: item.imagePath,
			})),
			notes:
				'Every panel was rendered through the CPU Algorithm32/Three path. The gallery is visual-review output, not a visual pass/fail claim.',
		})
	);
	criteria.push(
		criterion({
			id: 'distant-source-panels-present',
			status:
				distantCases.length === DISTANT_CASES.length &&
				distantCases.every(
					(item) => item.sourceContract.source.kind === 'distant-directional-sun'
				)
					? 'pass'
					: 'fail',
			tolerance: {
				distantPanels: DISTANT_CASES.map((item) => item.id),
				sourceKind: 'distant-directional-sun',
			},
			measured: distantCases.map((item) => ({
				id: item.id,
				sunCaseId: item.sunCaseId,
				sourceKind: item.sourceContract.source.kind,
			})),
			notes:
				'The gallery includes first-order distant high-Sun and low-Sun reference panels.',
		})
	);
	criteria.push(
		criterion({
			id: 'local-source-angle-panels-present',
			status:
				LOCAL_OFFSETS.every((offset) =>
					localCases.some((item) => item.offsetDegrees === offset)
				) &&
				localCases.every(
					(item) => item.sourceContract.source.kind === SOURCE_KINDS.flatLocalPointSun
				)
					? 'pass'
					: 'fail',
			tolerance: {
				localOffsetsDegrees: LOCAL_OFFSETS,
				sourceKind: SOURCE_KINDS.flatLocalPointSun,
			},
			measured: localCases.map((item) => ({
				id: item.id,
				offsetDegrees: item.offsetDegrees,
				sourceDistanceKm: item.sourceDistanceKm,
				incidentScale: item.incidentScale,
				sourceKind: item.sourceContract.source.kind,
			})),
			notes:
				'The local panels use the previously requested flat-Sun orbit offsets: 0, 45, 90, 135, and 180 degrees from closest approach.',
		})
	);
	criteria.push(
		criterion({
			id: 'subjective-gallery-written',
			status: galleryPath ? 'pass' : 'fail',
			tolerance: { galleryPath: 'present' },
			measured: { galleryPath },
			notes:
				'The top-level contact sheet is written for quick subjective inspection.',
		})
	);

	return criteria;
}

async function writeArtifact({
	artifact,
	options,
	reference,
	cases,
	galleryPath,
	criteria,
	summary,
	packet,
	runLog,
}) {
	await writeJson(path.join(artifact.directory, 'command.json'), {
		kind: 'algorithm32-cpu-source-subjective-gallery-command',
		scriptPath: SCRIPT_PATH,
		options: {
			...options,
			atmosflatReference: path
				.relative(REPO_ROOT, options.atmosflatReference)
				.replaceAll('\\', '/'),
		},
	});
	await writeJson(path.join(artifact.directory, 'inputs.json'), {
		kind: 'algorithm32-cpu-source-subjective-gallery-inputs',
		sourceReference: reference.relativeDirectory,
		imageSize: { width: IMAGE_WIDTH, height: IMAGE_HEIGHT },
		scatteringOrder: 'first-order',
		distantCases: DISTANT_CASES,
		localOffsetsDegrees: LOCAL_OFFSETS,
		localSourceCalibration: reference.inputs.brightnessCalibration,
		sceneSkyRayLimit: {
			meters: options.sceneSkyRayLimitMeters,
			kilometers: options.sceneSkyRayLimitMeters / 1000,
			policy: options.sceneSkyRayLimitPolicy,
			status:
				'Renderer-owned POC no-hit sky ray length for flat scene images; configurable and not an Algorithm32 atmosphere constant.',
		},
	});
	await writeJson(path.join(artifact.directory, 'subjective-cases.json'), {
		kind: 'algorithm32-cpu-source-subjective-gallery-cases',
		galleryPath,
		cases,
	});
	await writeJson(path.join(artifact.directory, 'criteria-results.json'), {
		kind: 'algorithm32-cpu-source-subjective-gallery-criteria',
		summary,
		criteria,
	});
	await writeJson(path.join(artifact.directory, 'result.json'), packet);
	await writeText(path.join(artifact.directory, 'run.log'), `${runLog.join('\n')}\n`);
	await writeText(path.join(artifact.directory, 'report.md'), makeReport({
		artifact,
		summary,
		cases,
		galleryPath,
	}));
	await fs.copyFile(__filename, path.join(artifact.directory, 'script-snapshot.js'));
}

function makeReport({ artifact, summary, cases, galleryPath }) {
	return [
		'# CPU Source Subjective Gallery',
		'',
		`Artifact: \`${artifact.relativeFolder}\``,
		'',
		`Status: ${summary.failed === 0 ? 'accepted' : 'rejected'} (${summary.passed} passed, ${summary.failed} failed, ${summary.unresolved} unresolved).`,
		'',
		'This artifact is a visual-review gallery, not a new objective physics gate. All panels use the fixed Three card scene and first-order CPU Algorithm32 rendering so the visible differences come from the configured light source.',
		'',
		'## Gallery',
		'',
		`- \`${galleryPath}\``,
		'',
		'## Panels',
		'',
		...cases.map((item) =>
			item.sourceFamily === 'local'
				? `- \`${item.imagePath}\`: local ${item.offsetDegrees} deg, ${item.sourceDistanceKm.toFixed(3)} km, incident scale ${item.incidentScale}.`
				: `- \`${item.imagePath}\`: ${item.label}, ${item.sunCaseId}.`
		),
		'',
		'## Notes',
		'',
		'- Local panels use the accepted atmosflat32 `018` source positions and calibrated closest-approach brightness.',
		'- Direct local solar-disc camera radiance, local second-order cache behavior, and ground bounce remain deferred.',
		'- The flat scene sky-ray limit is explicit renderer configuration, seeded by the accepted long-distance visibility experiment and adjustable in later POCs.',
		'',
	].join('\n');
}

function spectralProfile() {
	return {
		kind: 'algorithm32-15-channel-profile',
		channels: SPECTRAL_CHANNELS.map((channel) => ({
			wavelengthNanometers: channel.wavelengthNanometers,
			solarIrradiance: channel.solarIrradiance,
		})),
	};
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

function escapeXml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function log(runLog, message) {
	runLog.push(`${new Date().toISOString()} ${message}`);
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
