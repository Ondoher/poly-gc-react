import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as THREE from 'three';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_OUT_ROOT = path.join(
	REPO_ROOT,
	'tmp/atmosphere/algorithm32_shader_lab'
);

const RAY_DIRECTION_ANGLE_TOLERANCE_RADIANS = 1e-9;
const HIT_DISTANCE_TOLERANCE_METERS = 1e-6;
const RAY_ORIGIN_TOLERANCE_METERS = 1e-9;

function parseArgs(argv) {
	const options = {
		outRoot: DEFAULT_OUT_ROOT,
		browserRun: null,
		label: 'browser-ray-depth-diagnostics-comparison',
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
	console.log(`Algorithm32 browser ray/depth diagnostics

Usage:
  node scripts/flat/algorithm32-shader-lab/browser-ray-depth-diagnostics.js --browser-run <artifact-folder-or-result-json>

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
	log(runLog, 'Started browser ray/depth diagnostic comparison.');
	const browserPacketInfo = await readBrowserPacket(options);
	log(runLog, `Loaded browser artifact ${browserPacketInfo.sourcePath}.`);
	const browserResult = browserPacketInfo.packet.result;

	if (!browserResult || !Array.isArray(browserResult.selectedPixels)) {
		throw new Error('Browser artifact does not contain result.selectedPixels.');
	}

	const comparison = compareBrowserSamples(browserResult);
	const criteria = evaluateCriteria({
		browserPacket: browserPacketInfo.packet,
		browserResult,
		comparison,
	});
	const summary = summarizeCriteria(criteria);
	const endedAt = new Date();
	const artifact = await nextArtifactDirectory(options.outRoot, options.label);
	const packet = {
		kind: 'algorithm32-browser-ray-depth-diagnostics-comparison',
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
		`Browser ray/depth diagnostics ${packet.status}: ${artifact.directory}`
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

function compareBrowserSamples(browserResult) {
	const sceneSetup = createBaselineScene(browserResult.canvas);
	const byId = new Map();
	const sampleComparisons = browserResult.selectedPixels.map((browserSample) => {
		const cpuSample = sampleCpuScene({
			sceneSetup,
			x: browserSample.x,
			y: browserSample.y,
		});
		const comparison = compareSample(browserSample, cpuSample);
		byId.set(browserSample.id, comparison);
		return comparison;
	});
	const cardProjectionComparisons = sceneSetup.cards.map((card) => {
		const projected = worldToPixel(card.mesh.position, sceneSetup.camera, sceneSetup.canvas);
		const browserSample = browserResult.selectedPixels.find(
			(sample) => sample.id === card.id
		);

		return {
			id: card.id,
			expectedPixel: projected,
			browserPixel: browserSample
				? { x: browserSample.x, y: browserSample.y }
				: null,
			pixelDelta: browserSample
				? {
					x: browserSample.x - projected.x,
					y: browserSample.y - projected.y,
				}
				: null,
		};
	});

	return {
		kind: 'algorithm32-browser-ray-depth-comparison',
		threeRevision: THREE.REVISION,
		canvas: sceneSetup.canvas,
		camera: {
			positionMeters: vectorToArray(sceneSetup.camera.position),
			lookAtMeters: [0, 420, -5000],
			verticalFovDegrees: sceneSetup.camera.fov,
			aspect: sceneSetup.camera.aspect,
			near: sceneSetup.camera.near,
			far: sceneSetup.camera.far,
		},
		sampleComparisons,
		cardProjectionComparisons,
		maxRayOriginDeltaMeters: Math.max(
			0,
			...sampleComparisons.map((sample) => sample.rayOriginDeltaMeters)
		),
		maxRayDirectionAngleRadians: Math.max(
			0,
			...sampleComparisons.map((sample) => sample.rayDirectionAngleRadians)
		),
		maxFiniteHitDistanceDeltaMeters: Math.max(
			0,
			...sampleComparisons
				.map((sample) => sample.hitDistanceDeltaMeters)
				.filter((value) => value !== null)
		),
		classificationMismatches: sampleComparisons.filter(
			(sample) => !sample.classificationMatches || !sample.hitObjectMatches
		),
	};
}

function createBaselineScene(canvas) {
	const normalizedCanvas = {
		width: canvas.width,
		height: canvas.height,
	};
	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(
		52,
		normalizedCanvas.width / normalizedCanvas.height,
		0.1,
		150000
	);
	camera.position.set(0, 2, 0);
	camera.lookAt(new THREE.Vector3(0, 420, -5000));
	camera.updateMatrixWorld(true);
	camera.updateProjectionMatrix();

	const meshes = [];
	const cards = [];
	for (const definition of baselineCardDefinitions()) {
		const geometry = new THREE.PlaneGeometry(definition.width, definition.height);
		const material = new THREE.MeshBasicMaterial({
			color: definition.materialColor,
			side: THREE.FrontSide,
		});
		const mesh = new THREE.Mesh(geometry, material);
		mesh.name = definition.id;
		mesh.position.copy(definition.center);
		mesh.userData = {
			kind: 'card',
			spectrumId: definition.spectrumId,
		};
		mesh.updateMatrixWorld(true);
		scene.add(mesh);
		meshes.push(mesh);
		cards.push({ ...definition, mesh });
	}

	const groundGeometry = new THREE.PlaneGeometry(120000, 120000);
	const groundMaterial = new THREE.MeshBasicMaterial({
		color: 0x344038,
		side: THREE.DoubleSide,
	});
	const ground = new THREE.Mesh(groundGeometry, groundMaterial);
	ground.name = 'ground-plane';
	ground.rotation.x = -Math.PI / 2;
	ground.position.set(0, 0, -30000);
	ground.userData = {
		kind: 'ground',
		spectrumId: 'ground',
	};
	ground.updateMatrixWorld(true);
	scene.add(ground);
	meshes.push(ground);

	return {
		canvas: normalizedCanvas,
		scene,
		camera,
		meshes,
		cards,
	};
}

function baselineCardDefinitions() {
	return [
		{
			id: 'near-red-card',
			spectrumId: 'red',
			center: new THREE.Vector3(-260, 130, -1000),
			width: 260,
			height: 260,
			materialColor: 0xcc2936,
		},
		{
			id: 'middle-green-card',
			spectrumId: 'green',
			center: new THREE.Vector3(0, 440, -5000),
			width: 900,
			height: 900,
			materialColor: 0x3a8f43,
		},
		{
			id: 'far-blue-card',
			spectrumId: 'blue',
			center: new THREE.Vector3(5200, 1800, -22000),
			width: 3600,
			height: 3600,
			materialColor: 0x2b68c0,
		},
	];
}

function sampleCpuScene({ sceneSetup, x, y }) {
	const raycaster = new THREE.Raycaster();
	const ndc = pixelToNdc(x, y, sceneSetup.canvas.width, sceneSetup.canvas.height);
	raycaster.setFromCamera(ndc, sceneSetup.camera);
	const hits = raycaster.intersectObjects(sceneSetup.meshes, false);
	const hit = hits.length > 0 ? hits[0] : null;

	return {
		x,
		y,
		ndc,
		classification: hit ? hit.object.userData.kind : 'sky',
		hitObject: hit?.object?.name || null,
		hitDistanceMeters: hit?.distance || null,
		threeRay: {
			origin: vectorToArray(raycaster.ray.origin),
			direction: vectorToArray(raycaster.ray.direction),
		},
	};
}

function compareSample(browserSample, cpuSample) {
	const rayOriginDeltaMeters = distanceBetween(
		browserSample.threeRay.origin,
		cpuSample.threeRay.origin
	);
	const rayDirectionAngleRadians = angleBetween(
		browserSample.threeRay.direction,
		cpuSample.threeRay.direction
	);
	const hitDistanceDeltaMeters =
		browserSample.hitDistanceMeters === null && cpuSample.hitDistanceMeters === null
			? null
			: Math.abs(browserSample.hitDistanceMeters - cpuSample.hitDistanceMeters);

	return {
		id: browserSample.id,
		pixel: {
			x: browserSample.x,
			y: browserSample.y,
		},
		browser: summarizeSample(browserSample),
		cpu: summarizeSample(cpuSample),
		classificationMatches:
			browserSample.classification === cpuSample.classification,
		hitObjectMatches: browserSample.hitObject === cpuSample.hitObject,
		ndcDelta: {
			x: browserSample.ndc.x - cpuSample.ndc.x,
			y: browserSample.ndc.y - cpuSample.ndc.y,
		},
		rayOriginDeltaMeters,
		rayDirectionAngleRadians,
		hitDistanceDeltaMeters,
	};
}

function summarizeSample(sample) {
	return {
		classification: sample.classification,
		hitObject: sample.hitObject,
		hitDistanceMeters: sample.hitDistanceMeters,
		ndc: sample.ndc,
		threeRay: sample.threeRay,
	};
}

function evaluateCriteria({ browserPacket, browserResult, comparison }) {
	const criteria = [];
	const cardProjectionFailures = comparison.cardProjectionComparisons.filter(
		(item) =>
			!item.browserPixel ||
			item.pixelDelta.x !== 0 ||
			item.pixelDelta.y !== 0
	);

	criteria.push(criterion({
		id: 'browser-artifact-accepted',
		status:
			browserPacket.status === 'accepted' && browserResult.status === 'accepted'
				? 'passed'
				: 'failed',
		measured: {
			harnessStatus: browserPacket.status,
			browserStatus: browserResult.status,
			resultKind: browserResult.kind,
		},
		notes: 'The comparison starts from an accepted browser diagnostic artifact.',
	}));
	criteria.push(criterion({
		id: 'selected-sample-count',
		status: browserResult.selectedPixels.length >= 5 ? 'passed' : 'failed',
		measured: {
			selectedPixels: browserResult.selectedPixels.length,
		},
		notes: 'The browser artifact includes the expected sky, card, and ground diagnostic samples.',
	}));
	criteria.push(criterion({
		id: 'classification-and-hit-object-parity',
		status:
			comparison.classificationMismatches.length === 0 ? 'passed' : 'failed',
		measured: {
			mismatchCount: comparison.classificationMismatches.length,
			mismatches: comparison.classificationMismatches.map((sample) => ({
				id: sample.id,
				browser: sample.browser,
				cpu: sample.cpu,
			})),
		},
		notes: 'Browser Raycaster classifications and hit object names match the independent Node/Three scene.',
	}));
	criteria.push(criterion({
		id: 'ray-origin-parity',
		status:
			comparison.maxRayOriginDeltaMeters <= RAY_ORIGIN_TOLERANCE_METERS
				? 'passed'
				: 'failed',
		tolerance: {
			maxRayOriginDeltaMeters: RAY_ORIGIN_TOLERANCE_METERS,
		},
		measured: {
			maxRayOriginDeltaMeters: comparison.maxRayOriginDeltaMeters,
		},
		notes: 'Browser and Node camera ray origins match.',
	}));
	criteria.push(criterion({
		id: 'ray-direction-parity',
		status:
			comparison.maxRayDirectionAngleRadians <=
				RAY_DIRECTION_ANGLE_TOLERANCE_RADIANS
				? 'passed'
				: 'failed',
		tolerance: {
			maxRayDirectionAngleRadians: RAY_DIRECTION_ANGLE_TOLERANCE_RADIANS,
		},
		measured: {
			maxRayDirectionAngleRadians: comparison.maxRayDirectionAngleRadians,
		},
		notes: 'Browser and Node camera ray directions match for selected pixels.',
	}));
	criteria.push(criterion({
		id: 'finite-hit-distance-parity',
		status:
			comparison.maxFiniteHitDistanceDeltaMeters <= HIT_DISTANCE_TOLERANCE_METERS
				? 'passed'
				: 'failed',
		tolerance: {
			maxFiniteHitDistanceDeltaMeters: HIT_DISTANCE_TOLERANCE_METERS,
		},
		measured: {
			maxFiniteHitDistanceDeltaMeters:
				comparison.maxFiniteHitDistanceDeltaMeters,
		},
		notes: 'Finite object and ground hit distances match the independent Node/Three scene.',
	}));
	criteria.push(criterion({
		id: 'projected-card-sample-pixels',
		status: cardProjectionFailures.length === 0 ? 'passed' : 'failed',
		measured: {
			failures: cardProjectionFailures,
			comparisons: comparison.cardProjectionComparisons,
		},
		notes: 'Card diagnostic pixels are projected from card world centers.',
	}));

	return criteria;
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
		kind: 'algorithm32-browser-ray-depth-diagnostics-command',
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
		kind: 'algorithm32-browser-ray-depth-diagnostics-criteria',
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
	await writeJson(path.join(options.outRoot, 'latest-browser-ray-depth-diagnostics.json'), {
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
		'# Browser Ray And Depth Diagnostics',
		'',
		`Status: ${packet.status}`,
		'',
		'This artifact compares the browser-selected Three rays and hit distances against an independent Node/Three reconstruction of the same simple scene.',
		'',
		'## Source Browser Run',
		'',
		`- Browser source: \`${packet.browserArtifact.sourcePath}\``,
		`- Browser result kind: \`${packet.browserArtifact.resultKind}\``,
		'',
		'## Metrics',
		'',
		`- Max ray origin delta: ${comparison.maxRayOriginDeltaMeters}`,
		`- Max ray direction angle radians: ${comparison.maxRayDirectionAngleRadians}`,
		`- Max finite hit distance delta meters: ${comparison.maxFiniteHitDistanceDeltaMeters}`,
		`- Classification mismatches: ${comparison.classificationMismatches.length}`,
		'',
		'## Criteria',
		'',
		...criteria.map((item) => `- ${item.id}: ${item.status}`),
		'',
	].join('\n');
}

function pixelToNdc(x, y, width, height) {
	return {
		x: ((x + 0.5) / width) * 2 - 1,
		y: -(((y + 0.5) / height) * 2 - 1),
	};
}

function worldToPixel(position, camera, canvas) {
	const projected = position.clone().project(camera);

	return {
		x: Math.max(
			0,
			Math.min(canvas.width - 1, Math.floor(((projected.x + 1) / 2) * canvas.width))
		),
		y: Math.max(
			0,
			Math.min(canvas.height - 1, Math.floor(((-projected.y + 1) / 2) * canvas.height))
		),
	};
}

function distanceBetween(a, b) {
	return Math.sqrt(
		(a[0] - b[0]) ** 2 +
			(a[1] - b[1]) ** 2 +
			(a[2] - b[2]) ** 2
	);
}

function angleBetween(a, b) {
	const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
	const lengthA = Math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2);
	const lengthB = Math.sqrt(b[0] ** 2 + b[1] ** 2 + b[2] ** 2);
	const normalizedDot = Math.max(-1, Math.min(1, dot / (lengthA * lengthB)));
	return Math.acos(normalizedDot);
}

function vectorToArray(vector) {
	return [vector.x, vector.y, vector.z];
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
