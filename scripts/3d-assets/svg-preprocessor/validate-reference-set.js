import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { ROOT_DIR } from '../shared/asset-paths.js';
import { requireArgument } from './cli-arguments.js';

const STANDARD_FACE_KEYS = Object.freeze([
	...Array.from({ length: 9 }, (_, index) => `b-${index + 1}`),
	...Array.from({ length: 9 }, (_, index) => `c-${index + 1}`),
	...Array.from({ length: 9 }, (_, index) => `d-${index + 1}`),
	'wind-e',
	'wind-s',
	'wind-w',
	'wind-n',
	'dragon-r',
	'dragon-g',
	'dragon-w',
	...Array.from({ length: 4 }, (_, index) => `flower-${index + 1}`),
	...Array.from({ length: 4 }, (_, index) => `season-${index + 1}`),
]);
const LABEL_ROLES = new Set(['suit-label', 'wind-label', 'flower-label', 'season-label']);
const GLYPH_ROLES = new Set(['character-body', 'character-number-glyph', 'wind-character', 'flower-character', 'season-character']);
const ARTWORK_ROLES = new Set(['dot', 'bamboo-stick', 'bamboo-group', 'dragon-artwork', 'main-artwork', 'decoration', 'negative-space']);
const STANDARD_GLYPH_PART_ID_ROLES = new Set(['character-number-glyph', 'wind-character', 'flower-character', 'season-character']);

async function main() {
	const descriptorPath = path.resolve(process.cwd(), requireArgument('--descriptor'));
	const descriptor = readJson(descriptorPath);
	const descriptorDir = path.dirname(descriptorPath);
	const errors = [];
	const warnings = [];

	validateDescriptorShape(descriptor, errors);

	const bootstrapPath = resolveRepoPath(descriptor.semanticBootstrap?.path, descriptorDir);
	const bootstrap = fs.existsSync(bootstrapPath) ? readJson(bootstrapPath) : null;

	if (!bootstrap) {
		errors.push(`Semantic bootstrap not found: ${formatPath(bootstrapPath)}`);
	}

	if (bootstrap) {
		validateBootstrapLink(descriptor, bootstrap, errors);
		validateBootstrapFaces(bootstrap, errors);
		validateBootstrapParts(bootstrap, errors);
		validateAssignmentHints(bootstrap.svgPipeline?.assignmentHints, errors);
	}

	const sourceDir = resolveRepoPath(descriptor.source?.path, descriptorDir);
	if (!fs.existsSync(sourceDir)) {
		errors.push(`Reference source directory not found: ${formatPath(sourceDir)}`);
	}

	const expectedFaceKeys = bootstrap ? Object.keys(bootstrap.svgPipeline?.faces || {}).sort(compareText) : STANDARD_FACE_KEYS;
	const expectedFiles = expectedFaceKeys.map((faceKey) => filenameForFace(descriptor, faceKey));
	const actualFiles = fs.existsSync(sourceDir)
		? fs.readdirSync(sourceDir).filter((filename) => filename.toLowerCase().endsWith('.png')).sort(compareText)
		: [];
	const missingFiles = expectedFiles.filter((filename) => !actualFiles.includes(filename));
	const extraFiles = actualFiles.filter((filename) => !expectedFiles.includes(filename));
	const imageDetails = fs.existsSync(sourceDir)
		? await inspectImages(sourceDir, expectedFiles.filter((filename) => actualFiles.includes(filename)), errors)
		: [];

	if (missingFiles.length) {
		errors.push(`Missing reference PNGs: ${missingFiles.join(', ')}`);
	}

	if (extraFiles.length) {
		errors.push(`Extra reference PNGs: ${extraFiles.join(', ')}`);
	}

	const expectedImageSize = descriptor.coordinateSpace?.imageSize;
	if (Array.isArray(expectedImageSize) && expectedImageSize.length === 2) {
		const [expectedWidth, expectedHeight] = expectedImageSize;
		const dimensionMismatches = imageDetails
			.filter((image) => image.width !== expectedWidth || image.height !== expectedHeight)
			.map((image) => `${image.filename}=${image.width}x${image.height}`);

		if (dimensionMismatches.length) {
			errors.push(`Reference PNG dimensions do not match coordinateSpace.imageSize ${expectedWidth}x${expectedHeight}: ${dimensionMismatches.join(', ')}`);
		}
	}

	const report = {
		descriptorPath: formatPath(descriptorPath),
		referenceSetId: descriptor.referenceSetId || null,
		semanticBootstrapId: descriptor.semanticBootstrap?.bootstrapId || null,
		sourcePath: formatPath(sourceDir),
		expectedFaceCount: expectedFaceKeys.length,
		actualPngCount: actualFiles.length,
		missingFiles,
		extraFiles,
		imageDimensions: summarizeDimensions(imageDetails),
		warnings,
		errors,
		valid: errors.length === 0,
	};

	console.log(JSON.stringify(report, null, 2));

	if (errors.length) {
		process.exitCode = 1;
	}
}

function readJson(filename) {
	return JSON.parse(fs.readFileSync(filename, 'utf8'));
}

function resolveRepoPath(value, descriptorDir) {
	if (!value) {
		return '';
	}

	if (path.isAbsolute(value)) {
		return value;
	}

	const fromRoot = path.resolve(ROOT_DIR, value);
	if (fs.existsSync(fromRoot)) {
		return fromRoot;
	}

	return path.resolve(descriptorDir, value);
}

function validateDescriptorShape(descriptor, errors) {
	if (descriptor.schemaVersion !== 1) {
		errors.push('reference-set schemaVersion must be 1.');
	}

	for (const field of ['referenceSetId', 'name']) {
		if (!nonEmptyString(descriptor[field])) {
			errors.push(`reference-set ${field} must be a non-empty string.`);
		}
	}

	if (!nonEmptyString(descriptor.semanticBootstrap?.bootstrapId)) {
		errors.push('reference-set semanticBootstrap.bootstrapId must be a non-empty string.');
	}

	if (!nonEmptyString(descriptor.semanticBootstrap?.path)) {
		errors.push('reference-set semanticBootstrap.path must be a non-empty string.');
	}

	if (!nonEmptyString(descriptor.source?.path)) {
		errors.push('reference-set source.path must be a non-empty string.');
	}

	if (descriptor.source?.format !== 'png') {
		errors.push('reference-set source.format must be "png".');
	}

	if (descriptor.source?.filenamePattern !== '{faceShortCode}.png') {
		errors.push('reference-set source.filenamePattern must be "{faceShortCode}.png".');
	}

	if (!Array.isArray(descriptor.coordinateSpace?.imageSize) || descriptor.coordinateSpace.imageSize.length !== 2) {
		errors.push('reference-set coordinateSpace.imageSize must be a two-item array.');
	}

	if (!Array.isArray(descriptor.coordinateSpace?.preparedViewBox) || descriptor.coordinateSpace.preparedViewBox.length !== 4) {
		errors.push('reference-set coordinateSpace.preparedViewBox must be a four-item array.');
	}

	validatePalette(descriptor.palette, errors);
}

function validatePalette(palette, errors) {
	if (!palette) {
		errors.push('reference-set palette must be defined.');
		return;
	}

	if (!nonEmptyString(palette.paletteId)) {
		errors.push('reference-set palette.paletteId must be a non-empty string.');
	}

	if (!Array.isArray(palette.colors) || palette.colors.length === 0) {
		errors.push('reference-set palette.colors must be a non-empty array.');
		return;
	}

	for (const [index, color] of palette.colors.entries()) {
		if (!nonEmptyString(color.color) || !/^#[0-9a-f]{6}$/i.test(color.color)) {
			errors.push(`reference-set palette.colors[${index}].color must be a #RRGGBB color.`);
		}

		if (!Array.isArray(color.rgb) || color.rgb.length !== 3 || color.rgb.some((channel) => !Number.isInteger(channel) || channel < 0 || channel > 255)) {
			errors.push(`reference-set palette.colors[${index}].rgb must be three integer channels from 0 to 255.`);
		}
	}

	if (!Number.isFinite(palette.segmentationDistanceThreshold) || palette.segmentationDistanceThreshold < 0) {
		errors.push('reference-set palette.segmentationDistanceThreshold must be a non-negative number.');
	}
}

function validateBootstrapLink(descriptor, bootstrap, errors) {
	if (bootstrap.bootstrapId !== descriptor.semanticBootstrap?.bootstrapId) {
		errors.push(`Semantic bootstrap id mismatch: descriptor=${descriptor.semanticBootstrap?.bootstrapId || ''}, bootstrap=${bootstrap.bootstrapId || ''}`);
	}

	if (bootstrap.semanticCatalogVersion !== descriptor.semanticBootstrap?.semanticCatalogVersion) {
		errors.push(`Semantic catalog version mismatch: descriptor=${descriptor.semanticBootstrap?.semanticCatalogVersion ?? ''}, bootstrap=${bootstrap.semanticCatalogVersion ?? ''}`);
	}
}

function validateBootstrapFaces(bootstrap, errors) {
	const faces = bootstrap.svgPipeline?.faces || {};
	const faceKeys = Object.keys(faces).sort(compareText);
	const missing = STANDARD_FACE_KEYS.filter((faceKey) => !faces[faceKey]);
	const extra = faceKeys.filter((faceKey) => !STANDARD_FACE_KEYS.includes(faceKey));

	if (faceKeys.length !== STANDARD_FACE_KEYS.length) {
		errors.push(`Semantic bootstrap must contain ${STANDARD_FACE_KEYS.length} faces, found ${faceKeys.length}.`);
	}

	if (missing.length) {
		errors.push(`Semantic bootstrap missing standard faces: ${missing.join(', ')}`);
	}

	if (extra.length) {
		errors.push(`Semantic bootstrap has unknown faces: ${extra.join(', ')}`);
	}
}

function validateBootstrapParts(bootstrap, errors) {
	const seenGlobalPartIds = new Set();
	const faces = bootstrap.svgPipeline?.faces || {};

	for (const [faceKey, face] of Object.entries(faces)) {
		if (face.faceShortCode !== faceKey) {
			errors.push(`${faceKey}: faceShortCode must match face key.`);
		}

		for (const [partKey, part] of Object.entries(face.parts || {})) {
			if (part.partId !== partKey) {
				errors.push(`${faceKey}:${partKey}: partId must match part key.`);
			}

			validateBootstrapPartNaming(faceKey, partKey, part, errors);

			if (!nonEmptyString(part.globalPartId)) {
				errors.push(`${faceKey}:${partKey}: globalPartId must be a non-empty string.`);
			} else if (seenGlobalPartIds.has(part.globalPartId)) {
				errors.push(`${faceKey}:${partKey}: duplicate globalPartId ${part.globalPartId}.`);
			} else {
				seenGlobalPartIds.add(part.globalPartId);
			}
		}
	}
}

function validateBootstrapPartNaming(faceKey, partKey, part, errors) {
	if (!['label', 'glyph', 'artwork'].includes(part.contentKind)) {
		errors.push(`${faceKey}:${partKey}: contentKind must be label, glyph, or artwork.`);
	}

	if (LABEL_ROLES.has(part.role)) {
		if (partKey !== 'label') {
			errors.push(`${faceKey}:${partKey}: ${part.role} parts must use partId "label".`);
		}

		if (part.contentKind !== 'label') {
			errors.push(`${faceKey}:${partKey}: ${part.role} parts must use contentKind "label".`);
		}
	}

	if (STANDARD_GLYPH_PART_ID_ROLES.has(part.role) && partKey !== 'glyph') {
		errors.push(`${faceKey}:${partKey}: ${part.role} parts must use partId "glyph".`);
	}

	if (part.role === 'character-body' && partKey !== 'body') {
		errors.push(`${faceKey}:${partKey}: character-body parts must use partId "body".`);
	}

	if (GLYPH_ROLES.has(part.role) && part.contentKind !== 'glyph') {
		errors.push(`${faceKey}:${partKey}: ${part.role} parts must use contentKind "glyph".`);
	}

	if (ARTWORK_ROLES.has(part.role) && part.contentKind !== 'artwork') {
		errors.push(`${faceKey}:${partKey}: ${part.role} parts must use contentKind "artwork".`);
	}
}

function validateAssignmentHints(assignmentHints, errors) {
	if (!assignmentHints) {
		return;
	}

	if (typeof assignmentHints !== 'object' || Array.isArray(assignmentHints)) {
		errors.push('assignmentHints must be an object when defined.');
		return;
	}

	for (const sectionName of ['partId', 'familyPartId', 'partPattern', 'role']) {
		const section = assignmentHints[sectionName];

		if (!section) {
			continue;
		}

		if (typeof section !== 'object' || Array.isArray(section)) {
			errors.push(`assignmentHints.${sectionName} must be an object.`);
			continue;
		}

		for (const [hintKey, hint] of Object.entries(section)) {
			validateAssignmentHint(`assignmentHints.${sectionName}.${hintKey}`, hint, errors);
		}
	}
}

function validateAssignmentHint(pathLabel, hint, errors) {
	if (typeof hint !== 'object' || Array.isArray(hint)) {
		errors.push(`${pathLabel} must be an object.`);
		return;
	}

	if (hint.position && !['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'bottom', 'center'].includes(hint.position)) {
		errors.push(`${pathLabel}.position has unknown value "${hint.position}".`);
	}

	if (hint.region && !['top', 'bottom', 'body', 'center'].includes(hint.region)) {
		errors.push(`${pathLabel}.region has unknown value "${hint.region}".`);
	}

	if (hint.patternType && !['repeated-artwork', 'grouped-repeated-artwork', 'free-form-artwork'].includes(hint.patternType)) {
		errors.push(`${pathLabel}.patternType has unknown value "${hint.patternType}".`);
	}

	if (hint.linkColor !== undefined && typeof hint.linkColor !== 'boolean') {
		errors.push(`${pathLabel}.linkColor must be boolean when defined.`);
	}
}

async function inspectImages(sourceDir, filenames, errors) {
	const images = [];

	for (const filename of filenames) {
		const imagePath = path.resolve(sourceDir, filename);

		try {
			const metadata = await sharp(imagePath).metadata();
			images.push({
				filename,
				width: metadata.width,
				height: metadata.height,
				format: metadata.format,
			});
		} catch (error) {
			errors.push(`Could not read reference PNG ${filename}: ${error.message}`);
		}
	}

	return images;
}

function filenameForFace(descriptor, faceKey) {
	return descriptor.source.filenamePattern.replace('{faceShortCode}', faceKey);
}

function summarizeDimensions(images) {
	const counts = new Map();

	for (const image of images) {
		const key = `${image.width}x${image.height}`;
		counts.set(key, (counts.get(key) || 0) + 1);
	}

	return Object.fromEntries([...counts.entries()].sort(([left], [right]) => compareText(left, right)));
}

function nonEmptyString(value) {
	return typeof value === 'string' && value.trim().length > 0;
}

function compareText(left, right) {
	return left.localeCompare(right);
}

function formatPath(filename) {
	return path.relative(ROOT_DIR, filename).replaceAll('\\', '/');
}

await main();

