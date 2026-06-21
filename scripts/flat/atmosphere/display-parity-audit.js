import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
	linearRgbToPixel,
	pixelImageToPng,
	pixelImageToPpm,
} from './color/pixel-output.js';
import {
	loadOfficialCie1931Table,
	spectralRadianceToLinearSrgb,
	spectralRadianceToUnnormalizedLinearSrgb,
} from './color/spectral-color.js';
import {
	resolveSkyPatchWavelengthGrid,
} from './run-reference-probe.js';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const TONE_MAP = 'exponential';
const CONTACT_SHEET_CELL_SIZE = Object.freeze({ width: 28, height: 16 });
const SPECTRAL_DISPLAY_COLUMNS = Object.freeze([
	'normalized-xyz.exp1-srgb',
	'normalized-xyz.exp8-srgb',
	'normalized-xyz.exp8-linear',
	'unnormalized-xyz.exp1-srgb',
	'unnormalized-xyz.exp8-srgb',
	'unnormalized-xyz.exp8-linear',
]);
const LINEAR_RGB_DISPLAY_COLUMNS = Object.freeze([
	'linear-rgb.exp1-srgb',
	'linear-rgb.exp8-srgb',
	'linear-rgb.exp8-linear',
]);
const DISPLAY_VARIANTS = Object.freeze([
	Object.freeze({
		id: 'exp1-srgb',
		label: 'exposure=1 / sRGB bytes',
		exposure: 1,
		encoding: 'srgb',
	}),
	Object.freeze({
		id: 'exp8-srgb',
		label: 'exposure=8 / sRGB bytes',
		exposure: 8,
		encoding: 'srgb',
	}),
	Object.freeze({
		id: 'exp8-linear',
		label: 'exposure=8 / linear bytes',
		exposure: 8,
		encoding: 'linear',
	}),
]);

export function parseDisplayParityAuditArgs(argv) {
	const options = {};

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

		if (arg === '--source-summary') {
			options.sourceSummaryPath = readOptionValue(argv, ++index, arg);
			continue;
		}

		throw new Error(`Unknown display parity audit option: ${arg}`);
	}

	return options;
}

export function runDisplayParityAudit(options = {}) {
	const syntheticSpectralSamples = createSyntheticSpectralSamples();
	const sourceSummarySamples = options.sourceSummaryPath
		? extractSpectralSamplesFromTask3Summary(
			JSON.parse(fs.readFileSync(options.sourceSummaryPath, 'utf8')),
			options.sourceSummaryPath,
		)
		: [];
	const spectralSamples = [
		...syntheticSpectralSamples,
		...sourceSummarySamples,
	].map(createSpectralAuditRow);
	const linearRgbSamples = createSyntheticLinearRgbSamples().map(createLinearRgbAuditRow);

	const audit = {
		kind: 'flat-atmosphere-display-parity-audit',
		generatedAt: null,
		generatedAtPolicy: 'omitted-for-deterministic-output',
		objective: 'Compare display-only scale, exposure, and byte-encoding choices without re-running atmosphere transport.',
		toneMap: TONE_MAP,
		sourceSummary: options.sourceSummaryPath
			? {
				path: normalizeArtifactPath(options.sourceSummaryPath),
				policy: 'explicit --source-summary input',
			}
			: null,
		colorTransforms: [
			{
				id: 'normalized-xyz',
				label: 'Current equal-energy normalized CIE XYZ path',
			},
			{
				id: 'unnormalized-xyz',
				label: 'Raw CIE XYZ integral diagnostic path',
			},
		],
		displayVariants: DISPLAY_VARIANTS.map((variant) => ({ ...variant, toneMap: TONE_MAP })),
		contactSheet: {
			columns: {
				spectral: [...SPECTRAL_DISPLAY_COLUMNS],
				linearRgb: [...LINEAR_RGB_DISPLAY_COLUMNS],
			},
			cellSize: { ...CONTACT_SHEET_CELL_SIZE },
		},
		spectralSamples,
		linearRgbSamples,
	};

	return {
		...audit,
		analysis: analyzeDisplayParity(audit),
	};
}

export function extractSpectralSamplesFromTask3Summary(summary, sourceSummaryPath = 'summary.json') {
	if (!summary || typeof summary !== 'object') {
		throw new TypeError('Task 3 summary must be an object');
	}

	const wavelengthGridId = summary.fixedInputs?.wavelengthGrid;
	if (!wavelengthGridId) {
		throw new Error('Task 3 summary must include fixedInputs.wavelengthGrid');
	}

	const wavelengthGrid = resolveSkyPatchWavelengthGrid(wavelengthGridId);
	if (!Array.isArray(summary.rows)) {
		throw new Error('Task 3 summary must include rows');
	}

	const variants = [
		{
			key: 'control',
			label: 'Brion ozone control',
		},
		{
			key: 'noVisibleAbsorption',
			label: 'Bruneton no visible absorption',
		},
	];
	const samples = [];

	for (const row of summary.rows) {
		for (const variant of variants) {
			const rowVariant = row[variant.key];
			if (!rowVariant) {
				throw new Error(`Task 3 summary row ${row.id} is missing ${variant.key}`);
			}

			samples.push(createTask3RadianceSample({
				row,
				variant,
				point: 'center',
				values: rowVariant.centerRadianceSelected,
				displayHex: rowVariant.centerDisplayHex,
				wavelengthGrid,
				sourceSummaryPath,
			}));
			samples.push(createTask3RadianceSample({
				row,
				variant,
				point: 'horizon',
				values: rowVariant.horizonRadianceSelected,
				displayHex: rowVariant.horizonDisplayHex,
				wavelengthGrid,
				sourceSummaryPath,
			}));
		}
	}

	return samples;
}

export function writeDisplayParityAuditArtifacts(audit, outDir) {
	if (!outDir) {
		throw new Error('writeDisplayParityAuditArtifacts requires outDir');
	}

	fs.mkdirSync(outDir, { recursive: true });
	const jsonPath = path.join(outDir, 'audit.json');
	const markdownPath = path.join(outDir, 'audit.md');
	const ppmPath = path.join(outDir, 'audit.ppm');
	const pngPath = path.join(outDir, 'audit.png');
	const manifestPath = path.join(outDir, 'manifest.json');
	const contactSheet = buildDisplayParityContactSheet(audit);

	fs.writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`);
	fs.writeFileSync(markdownPath, buildDisplayParityMarkdown(audit));
	fs.writeFileSync(ppmPath, pixelImageToPpm(contactSheet));
	fs.writeFileSync(pngPath, pixelImageToPng(contactSheet));
	fs.writeFileSync(manifestPath, `${JSON.stringify({
		kind: 'flat-atmosphere-display-parity-audit-manifest',
		generatedAt: null,
		generatedAtPolicy: 'omitted-for-deterministic-output',
		artifacts: {
			json: path.basename(jsonPath),
			markdown: path.basename(markdownPath),
			ppm: path.basename(ppmPath),
			png: path.basename(pngPath),
		},
		sourceSummary: audit.sourceSummary,
		objective: audit.objective,
		conclusion: audit.analysis.conclusion,
	}, null, 2)}\n`);

	return {
		jsonPath,
		markdownPath,
		ppmPath,
		pngPath,
		manifestPath,
	};
}

export function buildDisplayParityMarkdown(audit) {
	const lines = [
		'# Display Parity Audit',
		'',
		audit.objective,
		'',
		`Tone map: \`${audit.toneMap}\``,
		`Source summary: ${audit.sourceSummary ? `\`${audit.sourceSummary.path}\`` : '`none`'}`,
		'',
		'## Conclusion',
		'',
		...audit.analysis.conclusion.map((item) => `- ${item}`),
		'',
		'## Aggregate Metrics',
		'',
		'| Comparison | Mean luminance delta | Mean luminance ratio | Mean saturation delta | Mean encoded RGB delta |',
		'|---|---:|---:|---:|---:|',
		formatDeltaRow('normalized exposure 8 vs 1', audit.analysis.normalizedExposure8Vs1),
		formatDeltaRow('raw exposure 1 vs normalized exposure 1', audit.analysis.rawExposure1VsNormalizedExposure1),
		formatDeltaRow('raw exposure 8 vs normalized exposure 8', audit.analysis.rawExposure8VsNormalizedExposure8),
		formatDeltaRow('normalized exposure 8 sRGB vs linear bytes', audit.analysis.normalizedExposure8SrgbVsLinear),
		'',
		`Mean raw/normalized XYZ Y scale: \`${formatNumber(audit.analysis.xyzScale.meanRawToNormalizedYScale)}\``,
		'',
		'## Spectral Samples',
		'',
		'| Sample | Norm exp1 | Norm exp8 | Norm exp8 linear | Raw exp1 | Raw exp8 | Raw/Norm Y |',
		'|---|---:|---:|---:|---:|---:|---:|',
		...audit.spectralSamples.map(formatSpectralSampleRow),
		'',
		'## Linear RGB Samples',
		'',
		'| Sample | Exp1 | Exp8 | Exp8 linear |',
		'|---|---:|---:|---:|',
		...audit.linearRgbSamples.map(formatLinearRgbSampleRow),
		'',
		'## Contact Sheet Columns',
		'',
		`Spectral: ${audit.contactSheet.columns.spectral.map((id) => `\`${id}\``).join(', ')}`,
		'',
		`Linear RGB: ${audit.contactSheet.columns.linearRgb.map((id) => `\`${id}\``).join(', ')}`,
		'',
	];

	return `${lines.join('\n')}\n`;
}

export function buildDisplayParityContactSheet(audit) {
	const columns = SPECTRAL_DISPLAY_COLUMNS.length;
	const rows = audit.spectralSamples.length + audit.linearRgbSamples.length;
	const width = columns * CONTACT_SHEET_CELL_SIZE.width;
	const height = rows * CONTACT_SHEET_CELL_SIZE.height;
	const blankPixel = {
		bytes: {
			r: 28,
			g: 28,
			b: 28,
			a: 255,
		},
	};
	const pixels = Array.from({ length: width * height }, () => blankPixel);

	let rowIndex = 0;
	for (const sample of audit.spectralSamples) {
		paintContactSheetRow(pixels, width, rowIndex, sample.displays, SPECTRAL_DISPLAY_COLUMNS);
		rowIndex += 1;
	}

	for (const sample of audit.linearRgbSamples) {
		paintContactSheetRow(pixels, width, rowIndex, sample.displays, LINEAR_RGB_DISPLAY_COLUMNS);
		rowIndex += 1;
	}

	return {
		kind: 'atmosphere-color-pixel-image',
		width,
		height,
		encoding: 'mixed',
		exposure: 'mixed',
		toneMap: TONE_MAP,
		pixels,
		bytes: pixels.flatMap((pixel) => [
			pixel.bytes.r,
			pixel.bytes.g,
			pixel.bytes.b,
			pixel.bytes.a,
		]),
		metadata: {
			displayOnly: true,
			pixelCount: pixels.length,
			displayPolicy: {
				encoding: 'mixed',
				exposure: 'mixed',
				toneMap: TONE_MAP,
			},
		},
	};
}

function createTask3RadianceSample({
	row,
	variant,
	point,
	values,
	displayHex,
	wavelengthGrid,
	sourceSummaryPath,
}) {
	assertArrayLength(values, wavelengthGrid.wavelengthsNm.length, `${row.id}.${variant.key}.${point}`);

	return {
		id: `task3.${variant.key}.${row.id}.${point}`,
		label: `${row.label} ${variant.label} ${point}`,
		wavelengthsNm: wavelengthGrid.wavelengthsNm,
		values,
		source: {
			kind: 'task3-summary-radiance',
			path: normalizeArtifactPath(sourceSummaryPath),
			rowId: row.id,
			rowLabel: row.label,
			variant: variant.key,
			point,
			sourceDisplayHex: displayHex,
			wavelengthGrid: wavelengthGrid.metadata,
		},
	};
}

function createSyntheticSpectralSamples() {
	const wavelengthsNm = loadOfficialCie1931Table().wavelengthsNm;

	return [
		{
			id: 'synthetic.equal-energy-low',
			label: 'Synthetic equal-energy low radiance',
			wavelengthsNm,
			values: wavelengthsNm.map(() => 0.01),
			source: {
				kind: 'synthetic-spectrum',
				description: 'Equal visible energy at 0.01 radiance units.',
			},
		},
		{
			id: 'synthetic.clear-blue-broad',
			label: 'Synthetic broad blue sky spectrum',
			wavelengthsNm,
			values: wavelengthsNm.map((wavelengthNm) => {
				return 0.0025
					+ 0.018 * gaussian(wavelengthNm, 470, 48)
					+ 0.004 * gaussian(wavelengthNm, 555, 80);
			}),
			source: {
				kind: 'synthetic-spectrum',
				description: 'Broad short-wavelength weighted spectrum for display response checks.',
			},
		},
		{
			id: 'synthetic.warm-horizon-broad',
			label: 'Synthetic broad warm horizon spectrum',
			wavelengthsNm,
			values: wavelengthsNm.map((wavelengthNm) => {
				return 0.002
					+ 0.012 * gaussian(wavelengthNm, 610, 75)
					+ 0.004 * gaussian(wavelengthNm, 520, 110);
			}),
			source: {
				kind: 'synthetic-spectrum',
				description: 'Warm broad spectrum for sunset/horizon display response checks.',
			},
		},
	];
}

function createSyntheticLinearRgbSamples() {
	return [
		{
			id: 'linear.muted-daylight-blue',
			label: 'Synthetic muted daylight blue',
			linearRgb: { r: 0.18, g: 0.24, b: 0.36 },
			source: {
				kind: 'synthetic-linear-rgb',
			},
		},
		{
			id: 'linear.brown-horizon',
			label: 'Synthetic brown horizon',
			linearRgb: { r: 0.3, g: 0.24, b: 0.12 },
			source: {
				kind: 'synthetic-linear-rgb',
			},
		},
		{
			id: 'linear.warm-sunset',
			label: 'Synthetic warm sunset',
			linearRgb: { r: 0.45, g: 0.18, b: 0.04 },
			source: {
				kind: 'synthetic-linear-rgb',
			},
		},
	];
}

function createSpectralAuditRow(sample) {
	const normalized = spectralRadianceToLinearSrgb(sample.values, sample.wavelengthsNm);
	const unnormalized = spectralRadianceToUnnormalizedLinearSrgb(sample.values, sample.wavelengthsNm);
	const colorTransforms = [
		createColorTransform('normalized-xyz', normalized),
		createColorTransform('unnormalized-xyz', unnormalized),
	];
	const displays = colorTransforms.flatMap((transform) => {
		return DISPLAY_VARIANTS.map((variant) => createDisplayResult(transform, variant));
	});

	return {
		id: sample.id,
		label: sample.label,
		source: sample.source,
		wavelengthCount: sample.wavelengthsNm.length,
		wavelengthRangeNm: [sample.wavelengthsNm[0], sample.wavelengthsNm[sample.wavelengthsNm.length - 1]],
		spectrumSummary: summarizeSpectralValues(sample.values, sample.wavelengthsNm),
		colorTransforms,
		displays,
	};
}

function createLinearRgbAuditRow(sample) {
	const transform = {
		id: 'linear-rgb',
		label: 'Provided linear RGB',
		xyz: null,
		linearRgb: roundRgb(sample.linearRgb),
		linearLuminance: roundMetric(relativeLuminance(sample.linearRgb)),
		provenance: {
			sourceColorSpace: 'linear-srgb',
			normalization: 'not applicable',
		},
	};

	return {
		id: sample.id,
		label: sample.label,
		source: sample.source,
		colorTransform: transform,
		displays: DISPLAY_VARIANTS.map((variant) => createDisplayResult(transform, variant)),
	};
}

function createColorTransform(id, color) {
	return {
		id,
		label: id === 'normalized-xyz'
			? 'Current equal-energy normalized CIE XYZ'
			: 'Unnormalized raw CIE XYZ diagnostic',
		xyz: roundXyz(color.xyz),
		linearRgb: roundRgb(color.linearRgb),
		linearLuminance: roundMetric(relativeLuminance(color.linearRgb)),
		provenance: {
			normalization: color.provenance.normalization,
			normalizationScale: roundMetric(color.provenance.normalizationScale),
			yEqualEnergyResponse: roundMetric(color.provenance.yEqualEnergyResponse),
			cmf: color.provenance.cmf,
			rgbMatrix: color.provenance.rgbMatrix,
			clamping: color.provenance.clamping,
		},
	};
}

function createDisplayResult(transform, variant) {
	const pixel = linearRgbToPixel(transform.linearRgb, {
		exposure: variant.exposure,
		encoding: variant.encoding,
		toneMap: TONE_MAP,
	});
	const displayLinearLuminance = relativeLuminance(clampRgb(pixel.displayLinearRgb));
	const encodedLuminance = relativeLuminance(pixel.displayRgb);

	return {
		id: `${transform.id}.${variant.id}`,
		transformId: transform.id,
		displayVariantId: variant.id,
		exposure: variant.exposure,
		encoding: variant.encoding,
		toneMap: TONE_MAP,
		hex: pixel.hex,
		bytes: { ...pixel.bytes },
		displayLinearRgb: roundRgb(pixel.displayLinearRgb),
		displayRgb: roundRgb(pixel.displayRgb),
		displayLinearLuminance: roundMetric(displayLinearLuminance),
		displayLinearSaturation: roundMetric(rgbSaturation(clampRgb(pixel.displayLinearRgb))),
		encodedLuminance: roundMetric(encodedLuminance),
		metadata: pixel.metadata,
	};
}

function analyzeDisplayParity(audit) {
	return {
		sampleCounts: {
			spectral: audit.spectralSamples.length,
			linearRgb: audit.linearRgbSamples.length,
			sourceSummarySpectral: audit.spectralSamples
				.filter((sample) => sample.source.kind === 'task3-summary-radiance')
				.length,
		},
		xyzScale: summarizeXyzScale(audit.spectralSamples),
		normalizedExposure8Vs1: summarizeDisplayDelta(
			audit.spectralSamples,
			'normalized-xyz.exp1-srgb',
			'normalized-xyz.exp8-srgb',
		),
		rawExposure1VsNormalizedExposure1: summarizeDisplayDelta(
			audit.spectralSamples,
			'normalized-xyz.exp1-srgb',
			'unnormalized-xyz.exp1-srgb',
		),
		rawExposure8VsNormalizedExposure8: summarizeDisplayDelta(
			audit.spectralSamples,
			'normalized-xyz.exp8-srgb',
			'unnormalized-xyz.exp8-srgb',
		),
		normalizedExposure8SrgbVsLinear: summarizeDisplayDelta(
			audit.spectralSamples,
			'normalized-xyz.exp8-srgb',
			'normalized-xyz.exp8-linear',
		),
		linearRgbExposure8Vs1: summarizeDisplayDelta(
			audit.linearRgbSamples,
			'linear-rgb.exp1-srgb',
			'linear-rgb.exp8-srgb',
		),
		conclusion: buildConclusion(audit),
	};
}

function buildConclusion(audit) {
	const scale = summarizeXyzScale(audit.spectralSamples);
	const exposure = summarizeDisplayDelta(
		audit.spectralSamples,
		'normalized-xyz.exp1-srgb',
		'normalized-xyz.exp8-srgb',
	);
	const rawVsNormalized = summarizeDisplayDelta(
		audit.spectralSamples,
		'normalized-xyz.exp8-srgb',
		'unnormalized-xyz.exp8-srgb',
	);

	return [
		`Raw CIE XYZ keeps about ${formatNumber(scale.meanRawToNormalizedYScale)}x more Y scale than the current normalized path on these samples, so exponential tone mapping is strongly scale-sensitive.`,
		`Changing normalized display exposure from 1 to 8 shifts mean display-linear luminance by ${formatNumber(exposure.meanDisplayLinearLuminanceDelta)} and mean saturation by ${formatNumber(exposure.meanDisplayLinearSaturationDelta)}.`,
		`At exposure 8, raw-vs-normalized display output still differs by a mean encoded RGB delta of ${formatNumber(rawVsNormalized.meanEncodedRgbAbsoluteDelta)}, which is large enough that display scale must be pinned before judging PNG-level parity.`,
		'This does not identify display mapping as the source of the brown horizon geometry, but it is large enough to affect perceived contrast and saturation in paper-image comparisons.',
	];
}

function summarizeXyzScale(samples) {
	const ratios = samples.map((sample) => {
		const normalized = findColorTransform(sample, 'normalized-xyz');
		const unnormalized = findColorTransform(sample, 'unnormalized-xyz');

		return safeRatio(unnormalized.xyz.y, normalized.xyz.y);
	});

	return {
		meanRawToNormalizedYScale: roundMetric(mean(ratios)),
		minRawToNormalizedYScale: roundMetric(Math.min(...ratios)),
		maxRawToNormalizedYScale: roundMetric(Math.max(...ratios)),
	};
}

function summarizeDisplayDelta(samples, aId, bId) {
	const deltas = samples.map((sample) => {
		const a = findDisplay(sample, aId);
		const b = findDisplay(sample, bId);

		return {
			displayLinearLuminanceDelta: b.displayLinearLuminance - a.displayLinearLuminance,
			displayLinearLuminanceRatio: safeRatio(b.displayLinearLuminance, a.displayLinearLuminance),
			displayLinearSaturationDelta: b.displayLinearSaturation - a.displayLinearSaturation,
			encodedRgbAbsoluteDelta: mean([
				Math.abs(b.displayRgb.r - a.displayRgb.r),
				Math.abs(b.displayRgb.g - a.displayRgb.g),
				Math.abs(b.displayRgb.b - a.displayRgb.b),
			]),
		};
	});

	return {
		from: aId,
		to: bId,
		meanDisplayLinearLuminanceDelta: roundMetric(mean(deltas.map((delta) => delta.displayLinearLuminanceDelta))),
		meanDisplayLinearLuminanceRatio: roundMetric(mean(deltas.map((delta) => delta.displayLinearLuminanceRatio))),
		meanDisplayLinearSaturationDelta: roundMetric(mean(deltas.map((delta) => delta.displayLinearSaturationDelta))),
		meanEncodedRgbAbsoluteDelta: roundMetric(mean(deltas.map((delta) => delta.encodedRgbAbsoluteDelta))),
	};
}

function formatDeltaRow(label, delta) {
	return `| ${label} | ${formatNumber(delta.meanDisplayLinearLuminanceDelta)} | ${formatNumber(delta.meanDisplayLinearLuminanceRatio)} | ${formatNumber(delta.meanDisplayLinearSaturationDelta)} | ${formatNumber(delta.meanEncodedRgbAbsoluteDelta)} |`;
}

function formatSpectralSampleRow(sample) {
	const normalized = findColorTransform(sample, 'normalized-xyz');
	const unnormalized = findColorTransform(sample, 'unnormalized-xyz');

	return `| ${sample.label} | ${findDisplay(sample, 'normalized-xyz.exp1-srgb').hex} | ${findDisplay(sample, 'normalized-xyz.exp8-srgb').hex} | ${findDisplay(sample, 'normalized-xyz.exp8-linear').hex} | ${findDisplay(sample, 'unnormalized-xyz.exp1-srgb').hex} | ${findDisplay(sample, 'unnormalized-xyz.exp8-srgb').hex} | ${formatNumber(safeRatio(unnormalized.xyz.y, normalized.xyz.y))} |`;
}

function formatLinearRgbSampleRow(sample) {
	return `| ${sample.label} | ${findDisplay(sample, 'linear-rgb.exp1-srgb').hex} | ${findDisplay(sample, 'linear-rgb.exp8-srgb').hex} | ${findDisplay(sample, 'linear-rgb.exp8-linear').hex} |`;
}

function paintContactSheetRow(pixels, width, rowIndex, displays, columns) {
	for (const [columnIndex, columnId] of columns.entries()) {
		const display = displays.find((candidate) => candidate.id === columnId);
		if (!display) {
			continue;
		}

		for (let y = 0; y < CONTACT_SHEET_CELL_SIZE.height; y += 1) {
			for (let x = 0; x < CONTACT_SHEET_CELL_SIZE.width; x += 1) {
				const pixelIndex = ((rowIndex * CONTACT_SHEET_CELL_SIZE.height + y) * width)
					+ columnIndex * CONTACT_SHEET_CELL_SIZE.width
					+ x;
				pixels[pixelIndex] = {
					bytes: { ...display.bytes },
				};
			}
		}
	}
}

function summarizeSpectralValues(values, wavelengthsNm) {
	const selectedWavelengths = [450, 550, 650].map((wavelengthNm) => {
		const index = nearestWavelengthIndex(wavelengthsNm, wavelengthNm);

		return {
			wavelengthNm: wavelengthsNm[index],
			value: roundMetric(values[index]),
		};
	});

	return {
		min: roundMetric(Math.min(...values)),
		max: roundMetric(Math.max(...values)),
		mean: roundMetric(mean(values)),
		selectedWavelengths,
	};
}

function findColorTransform(sample, id) {
	const transform = sample.colorTransforms.find((candidate) => candidate.id === id);
	if (!transform) {
		throw new Error(`Missing color transform ${id} for ${sample.id}`);
	}

	return transform;
}

function findDisplay(sample, id) {
	const display = sample.displays.find((candidate) => candidate.id === id);
	if (!display) {
		throw new Error(`Missing display result ${id} for ${sample.id}`);
	}

	return display;
}

function assertArrayLength(values, length, label) {
	if (!Array.isArray(values) || values.length !== length) {
		throw new Error(`${label} must provide ${length} spectral values`);
	}
}

function readOptionValue(argv, index, optionName) {
	if (index >= argv.length || argv[index].startsWith('--')) {
		throw new Error(`${optionName} requires a value`);
	}

	return argv[index];
}

function printUsage() {
	return [
		'Usage: node scripts/flat/atmosphere/display-parity-audit.js --out-dir <dir> [--source-summary <summary.json>]',
		'',
		'Writes audit.json, audit.md, audit.ppm, audit.png, and manifest.json.',
		'The audit is display-only and does not run atmosphere transport.',
	].join('\n');
}

function runCli(argv = process.argv.slice(2)) {
	try {
		const options = parseDisplayParityAuditArgs(argv);

		if (options.help) {
			console.log(printUsage());
			return 0;
		}

		if (!options.outDir) {
			throw new Error('--out-dir is required');
		}

		const audit = runDisplayParityAudit({
			sourceSummaryPath: options.sourceSummaryPath,
		});
		const artifacts = writeDisplayParityAuditArtifacts(audit, options.outDir);

		console.log(`Wrote display parity audit to ${normalizeArtifactPath(options.outDir)}`);
		console.log(JSON.stringify(Object.fromEntries(
			Object.entries(artifacts).map(([key, value]) => [key, normalizeArtifactPath(value)]),
		), null, 2));

		return 0;
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);

		return 1;
	}
}

function nearestWavelengthIndex(wavelengthsNm, targetNm) {
	let bestIndex = 0;
	let bestDistance = Infinity;

	for (const [index, wavelengthNm] of wavelengthsNm.entries()) {
		const distance = Math.abs(wavelengthNm - targetNm);
		if (distance < bestDistance) {
			bestDistance = distance;
			bestIndex = index;
		}
	}

	return bestIndex;
}

function gaussian(x, center, width) {
	const t = (x - center) / width;

	return Math.exp(-0.5 * t * t);
}

function relativeLuminance(rgb) {
	return 0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b;
}

function rgbSaturation(rgb) {
	const max = Math.max(rgb.r, rgb.g, rgb.b);
	const min = Math.min(rgb.r, rgb.g, rgb.b);

	return max > 0 ? (max - min) / max : 0;
}

function clampRgb(rgb) {
	return {
		r: clamp01(rgb.r),
		g: clamp01(rgb.g),
		b: clamp01(rgb.b),
	};
}

function clamp01(value) {
	return Math.max(0, Math.min(1, value));
}

function safeRatio(numerator, denominator) {
	return denominator !== 0 ? numerator / denominator : null;
}

function mean(values) {
	const finiteValues = values.filter(Number.isFinite);

	return finiteValues.length > 0
		? finiteValues.reduce((sum, value) => sum + value, 0) / finiteValues.length
		: null;
}

function roundXyz(xyz) {
	return {
		x: roundMetric(xyz.x),
		y: roundMetric(xyz.y),
		z: roundMetric(xyz.z),
	};
}

function roundRgb(rgb) {
	return {
		r: roundMetric(rgb.r),
		g: roundMetric(rgb.g),
		b: roundMetric(rgb.b),
	};
}

function roundMetric(value) {
	return Number.isFinite(value) ? Number(value.toFixed(9)) : value;
}

function formatNumber(value) {
	return Number.isFinite(value) ? value.toFixed(6) : String(value);
}

function normalizeArtifactPath(filePath) {
	return path.relative(process.cwd(), path.resolve(filePath)).replace(/\\/gu, '/');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	process.exitCode = runCli();
}
