import fs from 'fs';
import path from 'path';
import {
	LARGE_FACES_DIR,
	ROOT_DIR,
	preparedSvgPath,
	preprocessingOutputScope,
	sourceSvgPath,
	validationArtifactPath,
} from '../shared/asset-paths.js';

export const SCRIPT_DIR = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1');

export const DISCUSSION_REQUIRED_FACE_KEYS = new Set([
	'b-1',
	'd-1',
	'season-1',
	'season-2',
	'season-3',
	'season-4',
	'flower-1',
	'flower-2',
	'flower-3',
	'flower-4',
]);

export function getFacePaths(faceKey, options = {}) {
	const outputScope = options.outputScope === undefined
		? preprocessingOutputScope()
		: options.outputScope;
	const sourceSvg = sourceSvgPath(faceKey);

	return {
		faceKey,
		outputScope,
		sourceSvg,
		referencePng: path.resolve(LARGE_FACES_DIR, `${faceKey}.png`),
		preprocessedSvg: preparedSvgPath(faceKey, outputScope),
		report: validationArtifactPath('reports', `${faceKey}-validation-report.json`, outputScope),
		sourceComponents: validationArtifactPath('source-components', `${faceKey}-source-components.json`, outputScope),
		sideBySide: validationArtifactPath('side-by-side', `${faceKey}-side-by-side.png`, outputScope),
		sourceReferenceResult: validationArtifactPath('source-reference-result', `${faceKey}-source-reference-result.png`, outputScope),
		overlay: validationArtifactPath('overlays', `${faceKey}-overlay.png`, outputScope),
		diff: validationArtifactPath('diffs', `${faceKey}-diff.png`, outputScope),
	};
}

export function validatePreprocessedFace(faceKey) {
	const paths = getFacePaths(faceKey);
	const errors = [];
	const warnings = [];
	const svgSource = fs.existsSync(paths.preprocessedSvg)
		? fs.readFileSync(paths.preprocessedSvg, 'utf8')
		: null;
	const hasRequiredReference = fs.existsSync(paths.referencePng);
	const hasRequiredSvg = Boolean(svgSource);

	if (!hasRequiredReference) {
		errors.push({
			code: 'missing-reference',
			message: `Missing canonical reference image: ${path.relative(ROOT_DIR, paths.referencePng)}`,
		});
	}

	if (!hasRequiredSvg) {
		errors.push({
			code: 'missing-svg',
			message: `Missing preprocessed SVG: ${path.relative(ROOT_DIR, paths.preprocessedSvg)}`,
		});
	}

	const viewBox = svgSource ? readViewBox(svgSource) : null;
	const hasCanonicalViewBox = Boolean(
		viewBox
		&& nearlyEqual(viewBox.minX, 0)
		&& nearlyEqual(viewBox.minY, 0)
		&& nearlyEqual(viewBox.width, 94)
		&& nearlyEqual(viewBox.height, 136)
	);

	if (svgSource && !hasCanonicalViewBox) {
		errors.push({
			code: 'noncanonical-viewbox',
			message: 'Preprocessed SVG must use viewBox="0 0 94 136".',
			value: viewBox,
		});
	}

	const hasText = svgSource ? /<text\b/i.test(svgSource) : false;
	const hasImages = svgSource ? /<image\b/i.test(svgSource) : false;
	const unsupportedEffects = svgSource ? findUnsupportedEffects(svgSource) : [];
	const colorReport = svgSource ? collectColors(svgSource) : { colors: [], unsupportedColors: [] };
	const groups = svgSource ? collectGroups(svgSource) : {};
	const suspiciousLayers = svgSource ? findSuspiciousLayers(svgSource) : [];

	if (hasText) {
		errors.push({
			code: 'text-node',
			message: 'Preprocessed SVG must convert text to path geometry.',
		});
	}

	if (hasImages) {
		errors.push({
			code: 'image-node',
			message: 'Preprocessed SVG must not embed raster images.',
		});
	}

	for (const effect of unsupportedEffects) {
		errors.push({
			code: 'unsupported-effect',
			message: `Unsupported SVG effect found: ${effect}`,
		});
	}

	if (suspiciousLayers.length > 0) {
		warnings.push({
			code: 'suspicious-layer',
			message: 'Potential tile body/background/frame layer names found; inspect before accepting.',
			values: suspiciousLayers,
		});
	}

	const status = errors.some((error) => error.code === 'missing-reference')
		? 'blocked-missing-reference'
		: errors.length > 0
			? 'failed-static-validation'
			: 'needs-review';

	return {
		faceKey,
		status,
		iteration: 1,
		operatorNotes: [],
		discussionRequired: DISCUSSION_REQUIRED_FACE_KEYS.has(faceKey),
		static: {
			hasRequiredReference,
			hasRequiredSvg,
			hasCanonicalViewBox,
			hasText,
			hasImages,
			unsupportedEffects,
			errors,
			warnings,
		},
		reference: {
			path: normalizePath(paths.referencePng),
			exists: hasRequiredReference,
		},
		svg: {
			path: normalizePath(paths.preprocessedSvg),
			exists: hasRequiredSvg,
			viewBox,
			colors: colorReport.colors,
			unsupportedColors: colorReport.unsupportedColors,
			hasText,
			hasImages,
			groups,
		},
		comparison: {
			artworkBottomAligned: null,
			artworkLeftAligned: null,
			artworkRightAligned: null,
			topLabelAligned: null,
			labelOverlap: null,
			notes: [],
		},
		outputs: {},
	};
}

export function writeJson(outputPath, data) {
	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, `${JSON.stringify(data, null, 2)}\n`);
}

export function normalizePath(filePath) {
	return path.relative(ROOT_DIR, filePath).replaceAll(path.sep, '/');
}

export function readViewBox(svgSource) {
	const match = svgSource.match(/\bviewBox\s*=\s*"([^"]+)"/i);

	if (!match) {
		return null;
	}

	const values = match[1].trim().split(/[\s,]+/).map((value) => Number.parseFloat(value));

	if (values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
		return null;
	}

	return {
		raw: match[1],
		minX: values[0],
		minY: values[1],
		width: values[2],
		height: values[3],
	};
}

function nearlyEqual(left, right) {
	return Math.abs(left - right) < 0.000001;
}

function findUnsupportedEffects(svgSource) {
	const effects = [];
	const checks = [
		[/<filter\b/i, 'filter-element'],
		[/\bfilter\s*=/i, 'filter-attribute'],
		[/drop-shadow\s*\(/i, 'drop-shadow'],
		[/<linearGradient\b/i, 'linear-gradient'],
		[/<radialGradient\b/i, 'radial-gradient'],
		[/<mask\b/i, 'mask'],
	];

	for (const [pattern, name] of checks) {
		if (pattern.test(svgSource)) {
			effects.push(name);
		}
	}

	return effects;
}

function collectColors(svgSource) {
	const colors = new Set();

	for (const match of svgSource.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
		colors.add(normalizeColor(match[0]));
	}

	const sortedColors = [...colors].sort();

	return {
		colors: sortedColors,
		unsupportedColors: [],
	};
}

function normalizeColor(color) {
	const lower = color.toLowerCase();

	if (/^#[0-9a-f]{3}$/.test(lower)) {
		return `#${lower[1]}${lower[1]}${lower[2]}${lower[2]}${lower[3]}${lower[3]}`;
	}

	if (/^#[0-9a-f]{8}$/.test(lower)) {
		return lower.slice(0, 7);
	}

	return lower;
}

function collectGroups(svgSource) {
	const groups = {};

	for (const match of svgSource.matchAll(/<g\b[^>]*\bid\s*=\s*"([^"]+)"/gi)) {
		groups[match[1]] = {
			present: true,
		};
	}

	return groups;
}

function findSuspiciousLayers(svgSource) {
	const suspicious = new Set();

	for (const match of svgSource.matchAll(/\b(?:id|class)\s*=\s*"([^"]+)"/gi)) {
		const value = match[1];
		const lower = value.toLowerCase();

		if (
			/(?:^|[-_\s])(tile|background|frame|border|body)(?:$|[-_\s])/.test(lower)
			&& !/(negative|tile-body)/.test(lower)
		) {
			suspicious.add(value);
		}
	}

	return [...suspicious].sort();
}

