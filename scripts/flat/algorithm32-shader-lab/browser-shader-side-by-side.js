import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '../../..');
const DEFAULT_OUT_ROOT = path.join(REPO_ROOT, 'tmp/atmosphere/algorithm32_shader_lab');

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const shaderPacketInfo = await readShaderPacket(options.shaderRun);
	const referenceRunDir = path.resolve(options.referenceRun);
	const shaderRunDir = shaderPacketInfo.runDir;
	const referenceImagePath = path.join(referenceRunDir, 'reference-image.png');
	const referenceCopyPath = path.join(shaderRunDir, 'algorithm32-reference-image.png');
	const shaderImagePath = path.join(shaderRunDir, 'shader-image.png');
	const sideBySidePath = path.join(shaderRunDir, 'side-by-side.png');
	const diffImagePath = path.join(shaderRunDir, 'diff-image.png');
	const summaryPath = path.join(shaderRunDir, 'shader-reference-comparison.json');
	const referencePolicy = await readReferencePolicy(referenceRunDir);
	const shaderPolicy = readShaderPolicy(shaderPacketInfo.packet);
	const knownSolverDifference = describeKnownSolverDifference(
		referencePolicy,
		shaderPolicy
	);

	const shaderImageBuffer = decodeDataUrl(shaderPacketInfo.packet.result?.imageDataUrl);
	await fs.copyFile(referenceImagePath, referenceCopyPath);
	await fs.writeFile(shaderImagePath, shaderImageBuffer);
	const imageDiff = await writeDiffImage({
		referenceImagePath: referenceCopyPath,
		shaderImagePath,
		diffImagePath,
	});
	await writeSideBySide({
		referenceImagePath: referenceCopyPath,
		shaderImagePath,
		sideBySidePath,
		shaderLabel: shaderPolicy.includeSecondOrder
			? 'Browser shader Algorithm32'
			: 'Browser shader first-order',
	});

	const summary = {
		kind: 'algorithm32-browser-shader-side-by-side',
		status: shaderPacketInfo.packet.status === 'accepted' ? 'accepted' : 'rejected',
		createdAt: new Date().toISOString(),
		shaderRunDir: relativePath(shaderRunDir),
		referenceRunDir: relativePath(referenceRunDir),
		outputs: {
			algorithm32ReferenceImage: relativePath(referenceCopyPath),
			shaderImage: relativePath(shaderImagePath),
			sideBySideImage: relativePath(sideBySidePath),
			diffImage: imageDiff ? relativePath(diffImagePath) : null,
			summary: relativePath(summaryPath),
		},
		referencePolicy,
		shaderPolicy,
		imageDiff,
		comparisonPolicy:
			'Display-space packaging and diagnostics. Numeric image deltas are experimental diagnostics only unless a later objective run explicitly sets an acceptance tolerance.',
		knownSolverDifference,
	};
	await fs.writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
	await appendReport(shaderRunDir, summary);
	await fs.writeFile(
		path.join(DEFAULT_OUT_ROOT, 'latest-browser-shader-side-by-side.json'),
		`${JSON.stringify(summary, null, 2)}\n`
	);

	console.log(`Side-by-side image written: ${sideBySidePath}`);
}

function parseArgs(argv) {
	const options = {
		shaderRun: path.join(DEFAULT_OUT_ROOT, 'latest.json'),
		referenceRun: '',
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];

		if (arg === '--shader-run') {
			options.shaderRun = argv[index + 1];
			index += 1;
		} else if (arg === '--reference-run') {
			options.referenceRun = argv[index + 1];
			index += 1;
		} else if (arg === '--help' || arg === '-h') {
			printHelp();
			process.exit(0);
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}
	}

	if (!options.referenceRun) {
		throw new Error('--reference-run is required.');
	}

	return options;
}

function printHelp() {
	console.log(`Algorithm32 shader side-by-side packager

Usage:
  node scripts/flat/algorithm32-shader-lab/browser-shader-side-by-side.js --reference-run <folder> [--shader-run <folder-or-result-json>]
`);
}

async function readShaderPacket(inputPath) {
	const resolved = path.resolve(inputPath);
	const stat = await fs.stat(resolved);
	const resultPath = stat.isDirectory() ? path.join(resolved, 'result.json') : resolved;
	const packet = JSON.parse(await fs.readFile(resultPath, 'utf8'));
	const runDir = packet.artifacts?.runDir
		? path.resolve(packet.artifacts.runDir)
		: path.dirname(resultPath);

	if (!packet.result?.imageDataUrl) {
		throw new Error('Shader run does not contain result.imageDataUrl.');
	}

	return { packet, runDir, resultPath };
}

async function readReferencePolicy(referenceRunDir) {
	const imageStatsPath = path.join(referenceRunDir, 'image-stats.json');
	const inputsPath = path.join(referenceRunDir, 'inputs.json');
	const imageStats = await readJsonIfPresent(imageStatsPath);
	const inputs = await readJsonIfPresent(inputsPath);
	const scatteringOrder =
		imageStats?.scatteringOrder ??
		inputs?.config?.scatteringOrder ??
		inputs?.scatteringOrder ??
		'algorithm32';
	const includeSecondOrder =
		typeof imageStats?.includeSecondOrder === 'boolean'
			? imageStats.includeSecondOrder
			: typeof inputs?.config?.includeSecondOrder === 'boolean'
				? inputs.config.includeSecondOrder
				: typeof inputs?.includeSecondOrder === 'boolean'
					? inputs.includeSecondOrder
					: scatteringOrder !== 'first-order';

	return {
		scatteringOrder,
		includeSecondOrder,
		source: imageStats
			? relativePath(imageStatsPath)
			: inputs
				? relativePath(inputsPath)
				: null,
	};
}

function readShaderPolicy(packet) {
	const result = packet.result || {};
	const diagnostics = result.diagnostics || {};
	const imageShaderDiagnostics =
		result.imageShaderDiagnostics ||
		diagnostics.imageShaderDiagnostics ||
		null;
	const mode =
		packet.command?.payload?.mode ||
		result.commandLabel ||
		result.kind ||
		'unknown';
	const scatteringText = [
		mode,
		result.kind,
		imageShaderDiagnostics?.kind,
		imageShaderDiagnostics?.scatteringPolicy,
	]
		.filter(Boolean)
		.join(' ');
	const includeSecondOrder = /second-order/i.test(scatteringText);

	return {
		scatteringOrder: includeSecondOrder ? 'algorithm32' : 'first-order',
		includeSecondOrder,
		mode,
		imageShaderKind: imageShaderDiagnostics?.kind || null,
		scatteringPolicy: imageShaderDiagnostics?.scatteringPolicy || null,
		source: 'shader run result.json',
	};
}

async function readJsonIfPresent(filePath) {
	try {
		return JSON.parse(await fs.readFile(filePath, 'utf8'));
	} catch (error) {
		if (error.code === 'ENOENT') {
			return null;
		}

		throw error;
	}
}

function describeKnownSolverDifference(referencePolicy, shaderPolicy) {
	if (
		referencePolicy.includeSecondOrder === true &&
		shaderPolicy.includeSecondOrder === true
	) {
		return 'The CPU reference image and browser shader image both include the current Algorithm32 second-order approximation. Remaining display-space deltas are expected to come from floating-point precision, rasterization/sample placement, or image encoding differences.';
	}

	if (
		referencePolicy.includeSecondOrder === false &&
		shaderPolicy.includeSecondOrder === false
	) {
		return 'The CPU reference image comes from the Node/Three Algorithm32 path with the second-order approximation disabled. The browser shader image is the current 15-channel first-order spectral shader path, so this pairing isolates shader implementation/display differences from missing second-order energy.';
	}

	if (
		referencePolicy.includeSecondOrder === true &&
		shaderPolicy.includeSecondOrder === false
	) {
		return 'The CPU reference image comes from the Node/Three Algorithm32 path, including the current second-order approximation. The browser shader image is the current 15-channel first-order spectral shader path, so this pairing includes the known missing second-order shader contribution.';
	}

	return 'The CPU reference image has the second-order approximation disabled while the browser shader includes it, so this pairing intentionally compares different scattering policies.';
}

function decodeDataUrl(dataUrl) {
	const prefix = 'data:image/png;base64,';

	if (typeof dataUrl !== 'string' || !dataUrl.startsWith(prefix)) {
		throw new Error('Expected a PNG data URL.');
	}

	return Buffer.from(dataUrl.slice(prefix.length), 'base64');
}

function escapeXml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

async function writeSideBySide({
	referenceImagePath,
	shaderImagePath,
	sideBySidePath,
	shaderLabel,
}) {
	const reference = await normalizePanel(referenceImagePath);
	const shader = await normalizePanel(shaderImagePath);
	const gap = 6;
	const labelHeight = 30;
	const width = reference.width + gap + shader.width;
	const height = labelHeight + Math.max(reference.height, shader.height);
	const labelSvg = Buffer.from(`
<svg width="${width}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#11151c"/>
  <text x="${reference.width / 2}" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#f2f5f8">CPU Algorithm32 reference</text>
  <text x="${reference.width + gap + shader.width / 2}" y="20" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#f2f5f8">${escapeXml(shaderLabel)}</text>
</svg>
`);

	await sharp({
		create: {
			width,
			height,
			channels: 4,
			background: { r: 17, g: 21, b: 28, alpha: 1 },
		},
	})
		.composite([
			{ input: labelSvg, left: 0, top: 0 },
			{ input: reference.buffer, left: 0, top: labelHeight },
			{ input: shader.buffer, left: reference.width + gap, top: labelHeight },
		])
		.png()
		.toFile(sideBySidePath);
}

async function writeDiffImage({
	referenceImagePath,
	shaderImagePath,
	diffImagePath,
}) {
	const reference = sharp(referenceImagePath).ensureAlpha();
	const shader = sharp(shaderImagePath).ensureAlpha();
	const referenceMetadata = await reference.metadata();
	const shaderMetadata = await shader.metadata();

	if (
		referenceMetadata.width !== shaderMetadata.width ||
		referenceMetadata.height !== shaderMetadata.height
	) {
		return {
			status: 'skipped',
			reason: 'Reference and shader image dimensions differ.',
			reference: {
				width: referenceMetadata.width,
				height: referenceMetadata.height,
			},
			shader: {
				width: shaderMetadata.width,
				height: shaderMetadata.height,
			},
		};
	}

	const width = referenceMetadata.width;
	const height = referenceMetadata.height;
	const referencePixels = await reference.raw().toBuffer();
	const shaderPixels = await shader.raw().toBuffer();
	const diffPixels = Buffer.alloc(width * height * 4);
	let maxAbsRgbDelta = 0;
	let sumAbsRgbDelta = 0;
	const pixelDeltas = [];

	for (let offset = 0; offset < referencePixels.length; offset += 4) {
		const redDelta = shaderPixels[offset] - referencePixels[offset];
		const greenDelta = shaderPixels[offset + 1] - referencePixels[offset + 1];
		const blueDelta = shaderPixels[offset + 2] - referencePixels[offset + 2];
		const absRed = Math.abs(redDelta);
		const absGreen = Math.abs(greenDelta);
		const absBlue = Math.abs(blueDelta);
		const pixelMax = Math.max(absRed, absGreen, absBlue);

		maxAbsRgbDelta = Math.max(maxAbsRgbDelta, pixelMax);
		sumAbsRgbDelta += absRed + absGreen + absBlue;
		pixelDeltas.push(pixelMax);
		diffPixels[offset] = Math.min(255, absRed * 4);
		diffPixels[offset + 1] = Math.min(255, absGreen * 4);
		diffPixels[offset + 2] = Math.min(255, absBlue * 4);
		diffPixels[offset + 3] = 255;
	}

	pixelDeltas.sort((a, b) => a - b);
	await sharp(diffPixels, {
		raw: {
			width,
			height,
			channels: 4,
		},
	})
		.png()
		.toFile(diffImagePath);

	return {
		status: 'written',
		width,
		height,
		channels: 'rgba-display-encoded',
		diffImageScale: 'absolute per-channel RGB delta multiplied by 4 and clamped to 255',
		maxAbsRgbDelta,
		meanAbsRgbDelta: sumAbsRgbDelta / (width * height * 3),
		p95PixelMaxAbsRgbDelta: percentileSorted(pixelDeltas, 0.95),
		p99PixelMaxAbsRgbDelta: percentileSorted(pixelDeltas, 0.99),
	};
}

async function normalizePanel(imagePath) {
	const source = sharp(imagePath);
	const metadata = await source.metadata();
	const buffer = await source.png().toBuffer();

	return {
		buffer,
		width: metadata.width,
		height: metadata.height,
	};
}

async function appendReport(shaderRunDir, summary) {
	const reportPath = path.join(shaderRunDir, 'report.md');
	const existingReport = await fs.readFile(reportPath, 'utf8');
	const section = [
		'',
		'## Algorithm32 Reference Pairing',
		'',
		'- `algorithm32-reference-image.png`: CPU Algorithm32 Node/Three reference image.',
		'- `shader-image.png`: browser shader canvas exported from the harness result.',
		'- `side-by-side.png`: Algorithm32 reference beside the current shader image.',
		'- `diff-image.png`: display-space absolute RGB difference image when dimensions match.',
		'- `shader-reference-comparison.json`: side-by-side packaging summary.',
		'',
		`Known solver difference: ${summary.knownSolverDifference}`,
		'',
	].join('\n');
	const reportWithoutOldPairing = removeExistingReferencePairing(existingReport);

	await fs.writeFile(reportPath, `${reportWithoutOldPairing.trimEnd()}${section}`);
}

function removeExistingReferencePairing(report) {
	const header = '\n## Algorithm32 Reference Pairing\n';
	let cleaned = report;
	let start = cleaned.indexOf(header);

	while (start !== -1) {
		const nextHeader = cleaned.indexOf('\n## ', start + header.length);

		if (nextHeader === -1) {
			cleaned = cleaned.slice(0, start);
		} else {
			cleaned = `${cleaned.slice(0, start)}${cleaned.slice(nextHeader)}`;
		}

		start = cleaned.indexOf(header);
	}

	return cleaned;
}

function percentileSorted(values, fraction) {
	if (values.length === 0) {
		return 0;
	}

	const index = Math.min(
		values.length - 1,
		Math.max(0, Math.ceil(values.length * fraction) - 1)
	);

	return values[index];
}

function relativePath(filePath) {
	return path.relative(REPO_ROOT, filePath).replaceAll('\\', '/');
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
