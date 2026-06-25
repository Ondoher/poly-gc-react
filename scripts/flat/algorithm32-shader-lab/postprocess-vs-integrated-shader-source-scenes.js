import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

import {
	compareRgbaImages,
	readPngRgba,
	writePng,
} from './cpu-soft-shader-unlit-parity-matrix.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const DEFAULT_OUT_ROOT = path.join(
	REPO_ROOT,
	'tmp/atmosphere/algorithm32_shader_lab'
);

function parseArgs(argv) {
	const options = {
		browserRun: null,
		outRoot: DEFAULT_OUT_ROOT,
		help: false,
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--browser-run') {
			options.browserRun = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--out-root') {
			options.outRoot = path.resolve(argv[index + 1]);
			index += 1;
		} else if (arg === '--help' || arg === '-h') {
			options.help = true;
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}
	}

	if (!options.help && !options.browserRun) {
		throw new Error('--browser-run is required.');
	}

	return options;
}

function printHelp() {
	console.log(`Postprocess GPU shader vs integrated shader subjective scenes

Usage:
  node scripts/flat/algorithm32-shader-lab/postprocess-vs-integrated-shader-source-scenes.js --browser-run tmp/atmosphere/algorithm32_shader_lab/<run>

Options:
  --browser-run <path>  Harness run from browser-three-native-live-pass-soft-shader-matrix.
  --out-root <path>     Output root for latest summary. Default: tmp/atmosphere/algorithm32_shader_lab.
`);
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	if (options.help) {
		printHelp();
		return;
	}

	const result = await runPostprocessVsIntegratedShaderSourceScenes(options);
	console.log(
		`Postprocess GPU vs integrated shader scenes ${result.status}: ${result.artifact.relativeFolder}`
	);
	console.log(
		`Criteria: ${result.summary.passed} passed, ${result.summary.failed} failed`
	);
}

export async function runPostprocessVsIntegratedShaderSourceScenes(options) {
	const startedAt = new Date();
	const artifact = {
		directory: options.browserRun,
		relativeFolder: relativePath(options.browserRun),
	};
	const harnessResult = await readJson(path.join(options.browserRun, 'result.json'));
	const browserResult = harnessResult.result || {};

	if (
		browserResult.kind !==
		'algorithm32-browser-three-native-live-pass-soft-shader-matrix-result'
	) {
		throw new Error(
			`Expected a live-pass matrix browser run, received ${browserResult.kind || 'unknown'}.`
		);
	}

	const casesRoot = path.join(options.browserRun, 'postprocess-vs-integrated-cases');
	await fs.mkdir(casesRoot, { recursive: true });
	const caseResults = [];

	for (const caseResult of browserResult.results || []) {
		caseResults.push(
			await writeCaseComparison({
				casesRoot,
				caseResult,
			})
		);
	}

	const galleryPath = await writeGallery({
		artifact,
		caseResults,
	});
	const criteria = buildCriteria({
		harnessResult,
		browserResult,
		caseResults,
		galleryPath,
	});
	const summary = summarizeCriteria(criteria);
	const status = summary.failed === 0 ? 'accepted' : 'rejected';
	const completedAt = new Date();
	const packet = {
		kind: 'postprocess-vs-integrated-shader-source-scenes-result',
		status,
		createdAt: startedAt.toISOString(),
		completedAt: completedAt.toISOString(),
		durationMs: completedAt.getTime() - startedAt.getTime(),
		artifactFolder: artifact.relativeFolder,
		sourceBrowserRun: artifact.relativeFolder,
		galleryPath,
		summary,
		cases: caseResults.map((item) => item.summary),
	};

	await writeJson(
		path.join(options.browserRun, 'postprocess-vs-integrated-result.json'),
		packet
	);
	await writeJson(
		path.join(options.browserRun, 'postprocess-vs-integrated-case-results.json'),
		{
			kind: 'postprocess-vs-integrated-shader-source-scenes-case-results',
			cases: caseResults.map((item) => item.summary),
		}
	);
	await writeJson(
		path.join(options.browserRun, 'postprocess-vs-integrated-criteria-results.json'),
		{
			kind: 'postprocess-vs-integrated-shader-source-scenes-criteria',
			summary,
			criteria,
		}
	);
	await writeText(
		path.join(options.browserRun, 'postprocess-vs-integrated-report.md'),
		makeReport({ packet, caseResults })
	);
	await writeJson(
		path.join(options.outRoot, 'latest-postprocess-vs-integrated-shader-scenes.json'),
		packet
	);

	return { artifact, status, summary, packet };
}

async function writeCaseComparison({ casesRoot, caseResult }) {
	const caseRoot = path.join(casesRoot, caseResult.id);
	await fs.mkdir(caseRoot, { recursive: true });
	const width = caseResult.canvas?.width || 320;
	const height = caseResult.canvas?.height || 180;
	const postprocessDataUrl = caseResult.atmosphereParity?.oracleImageDataUrl;
	const integratedDataUrl = caseResult.imageDataUrl;

	if (!postprocessDataUrl || !integratedDataUrl) {
		throw new Error(`Case ${caseResult.id} is missing one or both image data URLs.`);
	}

	const postprocessPath = path.join(caseRoot, 'postprocess-gpu-shader.png');
	const integratedPath = path.join(caseRoot, 'integrated-three-native-shader.png');
	const diffPath = path.join(caseRoot, 'postprocess-vs-integrated-diff.png');
	const sideBySidePath = path.join(
		caseRoot,
		'postprocess-vs-integrated-side-by-side.png'
	);
	await writeDataUrlPng(postprocessPath, postprocessDataUrl);
	await writeDataUrlPng(integratedPath, integratedDataUrl);

	const postprocessImage = await readPngRgba(postprocessPath);
	const integratedImage = await readPngRgba(integratedPath);
	const comparison = compareRgbaImages({
		a: postprocessImage,
		b: integratedImage,
	});
	await writePng(
		diffPath,
		width,
		height,
		diffPixels(postprocessImage.data, integratedImage.data)
	);
	await writeSideBySide({
		caseResult,
		postprocessPath,
		integratedPath,
		outputPath: sideBySidePath,
		width,
		height,
	});
	await writeJson(path.join(caseRoot, 'comparison.json'), {
		kind: 'postprocess-vs-integrated-shader-source-scenes-comparison',
		caseId: caseResult.id,
		sourceKind: caseResult.sourcePacket?.kind || null,
		passMode: caseResult.passMode,
		sceneLight: caseResult.sceneLight || null,
		comparison,
		postprocessPath: relativePath(postprocessPath),
		integratedPath: relativePath(integratedPath),
		diffPath: relativePath(diffPath),
		sideBySidePath: relativePath(sideBySidePath),
	});

	return {
		caseRoot,
		summary: {
			id: caseResult.id,
			sourceKind: caseResult.sourcePacket?.kind || null,
			passMode: caseResult.passMode,
			postprocessPath: relativePath(postprocessPath),
			integratedPath: relativePath(integratedPath),
			diffPath: relativePath(diffPath),
			sideBySidePath: relativePath(sideBySidePath),
			comparison,
			sourceLightMode: caseResult.sceneLight?.mode || null,
		},
	};
}

async function writeDataUrlPng(filePath, dataUrl) {
	const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl);
	if (!match) {
		throw new Error(`Expected PNG data URL for ${filePath}.`);
	}
	await fs.writeFile(filePath, Buffer.from(match[1], 'base64'));
}

function diffPixels(left, right) {
	const length = Math.min(left.length, right.length);
	const pixels = Buffer.alloc(length);
	for (let index = 0; index < length; index += 4) {
		pixels[index] = Math.abs(left[index] - right[index]);
		pixels[index + 1] = Math.abs(left[index + 1] - right[index + 1]);
		pixels[index + 2] = Math.abs(left[index + 2] - right[index + 2]);
		pixels[index + 3] = 255;
	}
	return pixels;
}

async function writeSideBySide({
	caseResult,
	postprocessPath,
	integratedPath,
	outputPath,
	width,
	height,
}) {
	const labelHeight = 46;
	const gap = 10;
	await sharp({
		create: {
			width: width * 2 + gap,
			height: height + labelHeight,
			channels: 4,
			background: { r: 18, g: 22, b: 28, alpha: 1 },
		},
	})
		.composite([
			{
				input: Buffer.from(
					labelSvg({
						width,
						height: labelHeight,
						title: 'Postprocess GPU shader',
						subtitle: caseSubtitle(caseResult),
					})
				),
				left: 0,
				top: 0,
			},
			{
				input: Buffer.from(
					labelSvg({
						width,
						height: labelHeight,
						title: 'Integrated Three shader',
						subtitle: caseSubtitle(caseResult),
					})
				),
				left: width + gap,
				top: 0,
			},
			{ input: postprocessPath, left: 0, top: labelHeight },
			{ input: integratedPath, left: width + gap, top: labelHeight },
		])
		.png()
		.toFile(outputPath);
}

async function writeGallery({ artifact, caseResults }) {
	const panels = await Promise.all(
		caseResults.map((item) => readPngRgba(item.summary.sideBySidePath))
	);
	const width = Math.max(...panels.map((item) => item.width));
	const gap = 16;
	const padding = 18;
	const height =
		padding * 2 +
		panels.reduce((sum, item) => sum + item.height, 0) +
		gap * (panels.length - 1);
	const composites = [];
	let top = padding;
	for (let index = 0; index < caseResults.length; index += 1) {
		composites.push({
			input: caseResults[index].summary.sideBySidePath,
			left: padding,
			top,
		});
		top += panels[index].height + gap;
	}
	const galleryPath = path.join(
		artifact.directory,
		'postprocess-vs-integrated-gallery.png'
	);
	await sharp({
		create: {
			width: width + padding * 2,
			height,
			channels: 4,
			background: { r: 12, g: 15, b: 20, alpha: 1 },
		},
	})
		.composite(composites)
		.png()
		.toFile(galleryPath);
	return relativePath(galleryPath);
}

function buildCriteria({ harnessResult, browserResult, caseResults, galleryPath }) {
	const expectedIds =
		'distant-midday,distant-sunset-behind-camera,local-closest,local-090deg';
	return [
		{
			id: 'source-browser-run-accepted',
			status:
				harnessResult.status === 'accepted' && browserResult.status === 'accepted'
					? 'passed'
					: 'failed',
			measured: {
				harnessStatus: harnessResult.status,
				browserStatus: browserResult.status,
				browserKind: browserResult.kind,
			},
		},
		{
			id: 'four-subjective-scenes-rendered',
			status:
				caseResults.map((item) => item.summary.id).join(',') === expectedIds
					? 'passed'
					: 'failed',
			measured: caseResults.map((item) => ({
				id: item.summary.id,
				sourceKind: item.summary.sourceKind,
				passMode: item.summary.passMode,
			})),
		},
		{
			id: 'postprocess-and-integrated-images-written',
			status:
				caseResults.length === 4 &&
				caseResults.every(
					(item) => item.summary.postprocessPath && item.summary.integratedPath
				)
					? 'passed'
					: 'failed',
			measured: caseResults.map((item) => ({
				id: item.summary.id,
				postprocessPath: item.summary.postprocessPath,
				integratedPath: item.summary.integratedPath,
			})),
		},
		{
			id: 'side-by-side-comparisons-written',
			status:
				galleryPath &&
				caseResults.every((item) => item.summary.sideBySidePath)
					? 'passed'
					: 'failed',
			measured: {
				galleryPath,
				sideBySidePaths: caseResults.map(
					(item) => item.summary.sideBySidePath
				),
			},
		},
		{
			id: 'images-compared-for-inspection',
			status: caseResults.every(
				(item) => item.summary.comparison.status === 'compared'
			)
				? 'passed'
				: 'failed',
			measured: caseResults.map((item) => ({
				id: item.summary.id,
				comparison: item.summary.comparison,
			})),
		},
	];
}

function makeReport({ packet, caseResults }) {
	return [
		'# Postprocess GPU Shader vs Integrated Shader Subjective Scenes',
		'',
		`Status: ${packet.status}`,
		'',
		'These visual inspection images compare the existing packet/postprocess GPU shader with the integrated Three-native `Algorithm32AtmospherePass` shader for the same browser scene, camera, source, light, and geometry setup.',
		'',
		'## Gallery',
		'',
		`- \`${packet.galleryPath}\``,
		'',
		'## Cases',
		'',
		...caseResults.map(
			(item) =>
				`- ${item.summary.id}: side-by-side \`${item.summary.sideBySidePath}\`, postprocess \`${item.summary.postprocessPath}\`, integrated \`${item.summary.integratedPath}\`, maxAbsRgbDelta=${item.summary.comparison.maxAbsRgbDelta}, p99=${item.summary.comparison.p99PixelMaxAbsRgbDelta}.`
		),
		'',
		'This is subjective comparison material. The deltas are recorded for inspection, not as a new parity gate.',
		'',
	].join('\n');
}

function caseSubtitle(caseResult) {
	const source = caseResult.sourcePacket?.kind || 'unknown-source';
	return `${caseResult.id} | ${source}`;
}

function labelSvg({ width, height, title, subtitle }) {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
	<rect width="100%" height="100%" fill="#151922"/>
	<text x="10" y="19" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#f2f4f8">${escapeXml(title)}</text>
	<text x="10" y="38" font-family="Arial, sans-serif" font-size="11" fill="#aeb7c8">${escapeXml(subtitle)}</text>
</svg>`;
}

function summarizeCriteria(criteria) {
	return {
		passed: criteria.filter((criterion) => criterion.status === 'passed').length,
		failed: criteria.filter((criterion) => criterion.status === 'failed').length,
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

function relativePath(filePath) {
	return path.relative(REPO_ROOT, filePath).replaceAll('\\', '/');
}

function escapeXml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
	main().catch((error) => {
		console.error(error);
		process.exitCode = 1;
	});
}
