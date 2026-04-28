import fs from 'fs';
import path from 'path';
import opentype from 'opentype.js';
import paper from 'paper';
import {
	ASSET_FONTS_DIR,
	LARGE_FACES_DIR,
	preparedSvgPath,
	sourceSvgPath,
} from '../shared/asset-paths.js';
import { loadFacePreprocessingMetadataEntry } from './face-preprocessing-metadata.js';
import { groupAnalogComponents } from './analog-component-matcher.js';
import { Colors } from './ColorPalette.js';
import {
	findSmallIsolatedCandidates,
	getComponentUnionBounds,
	isRelatedKnockout,
	makePaintPathWithKnockouts,
	selectKnockoutComponents,
} from './normalized-face-components.js';
import {
	extractReferenceImageComponents,
	nearestPaletteColor,
	readRgba,
} from './reference-image-components.js';
import { extractSourceSvgComponents } from './source-svg-components.js';
import { sourceToReferenceTransform, unionBounds } from './visual-component-alignment.js';

const FACE_KEY = process.argv[2];
const FACE_VIEWBOX = '0 0 94 136';
const LARGE_FACE_CANVAS = Object.freeze({ width: 164, height: 238 });
const DRAGON_SAFE_REFERENCE_BOX_RATIO = Object.freeze({
	left: 24 / 164,
	top: 25 / 238,
	right: 136 / 164,
	bottom: 216 / 238,
});
const GLUTEN_FONT = path.resolve(ASSET_FONTS_DIR, 'gluten-800.ttf');
const CJK_FONT_CANDIDATES = Object.freeze([
	path.resolve(ASSET_FONTS_DIR, 'cjk-label.ttf'),
	'C:/Windows/Fonts/STKAITI.TTF',
	'C:/Windows/Fonts/STFANGSO.TTF',
	'C:/Windows/Fonts/STSONG.TTF',
	'C:/Windows/Fonts/simhei.ttf',
	'C:/Windows/Fonts/NotoSansJP-VF.ttf',
]);
const DRAGON_WHITE_REFERENCE_PATH = path.resolve(LARGE_FACES_DIR, 'dragon-w.png');
const FLOWER_OR_SEASON = /^(flower|season)-[1-4]$/.test(FACE_KEY || '');
const SEASON_FACE = /^season-[1-4]$/.test(FACE_KEY || '');
const DRAGON_FACE = /^dragon-[grw]$/.test(FACE_KEY || '');
const MIN_SOURCE_PAINT_AREA = 4;

if (!FACE_KEY) {
	console.error('Usage: node scripts/3d-assets/svg-preprocessor/export-preprocessed-generic-special-face-svg.js <face-key>');
	process.exit(1);
}

paper.setup([512, 512]);

const metadata = loadMetadata(FACE_KEY);
const sourcePath = sourceSvgPath(FACE_KEY);
const referencePath = path.resolve(LARGE_FACES_DIR, `${FACE_KEY}.png`);
const outputPath = preparedSvgPath(FACE_KEY);
const source = fs.readFileSync(sourcePath, 'utf8');
const sourceExtracted = extractSourceSvgComponents(source);
const sourceComponents = sourceExtracted.components;
const sourcePaintComponents = selectPaintComponents(sourceComponents);
const sourceHueAverageColors = Colors.perceivedHueAverages(sourcePaintComponents.map(sourcePaintColor));
const sourceColorCountByHue = Colors.perceivedHueColorCounts(sourcePaintComponents.map(sourcePaintColor));
const sourceHueShadesByHue = Colors.sourceHueShadesByHue(sourcePaintComponents.map(sourcePaintColor));
let hueShadesByHue = Colors.hueShadesByHue(sourcePaintComponents.map(sourcePaintColor));

if (DRAGON_FACE) {
	const dragonOutput = await makeDragonOutput(sourcePaintComponents, sourceExtracted.viewBox);
	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	fs.writeFileSync(outputPath, dragonOutput);
	console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);
	process.exit(0);
}

const sourceGroups = groupAnalogComponents(sourcePaintComponents, { expandedGap: 0 });
const reference = await extractReferenceImageComponents(referencePath, {
	labelColor: metadata.labelColor,
	labelText: metadata.labelText,
	fontPath: GLUTEN_FONT,
});
hueShadesByHue = Colors.hueShadesByHue([
	...sourcePaintComponents.map(sourcePaintColor),
	...reference.components.map((component) => component.dominantColor),
	metadata.labelColor,
].filter(Boolean));
const roles = makeReferenceRoles(reference);
const assignments = assignSourceGroupsToRoles(sourceGroups, roles);
let overlapPaletteColors = new Map();
const glutenFont = opentype.loadSync(GLUTEN_FONT);
const roleColorMappingItems = [
	...roleColorMappings(assignments.main, roles.main),
	...roleColorMappings(assignments.character, roles.character),
].filter((item) => item.source && item.target);
hueShadesByHue = Colors.mappedHueShadesByHue(roleColorMappingItems, [
	...sourcePaintComponents.map(sourcePaintColor),
	...reference.components.map((component) => component.dominantColor),
	metadata.labelColor,
].filter(Boolean));
overlapPaletteColors = Colors.overlapPaletteColorMap([
	...roleColorOverlaps(assignments.main, roles.main),
	...roleColorOverlaps(assignments.character, roles.character),
]);
const labelPath = metadata.labelText && glyphOutputPresent('number', true)
	? makeLabelPath(glutenFont, metadata, roles.label?.bounds)
	: '';
const characterOutputWanted = glyphOutputPresent('character', FLOWER_OR_SEASON);
const assignedCharacterPaths = characterOutputWanted && roles.character && assignments.character.length > 0
	? renderRole({
		id: 'character',
		role: roles.character,
		sourceGroups: assignments.character,
		sourceComponents,
		color: glyphOutputColor('character') || roles.character.dominantColor,
		forceColor: Boolean(glyphOutputColor('character')),
	})
	: '';
const generatedCharacterPath = characterOutputWanted && !assignedCharacterPaths && shouldGenerateCharacterPath()
	? makeCharacterPath(metadata.characterText, roles.character?.bounds, glyphOutputColor('character') || roles.character?.dominantColor)
	: '';
const characterPaths = assignedCharacterPaths || generatedCharacterPath;
const mainArtworkPaths = renderRole({
	id: 'main-artwork',
	role: roles.main,
	sourceGroups: assignments.main,
	sourceComponents,
	color: null,
});

const output = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${FACE_VIEWBOX}">
	<title>${FACE_KEY} generic-special preprocessed face</title>
	<desc>
		Experimental generic special-case face. Source classes are not used as
		semantic roles. Source components are assigned to generated-label,
		optional top-character, and main-artwork roles by relative visual
		position against the canonical reference PNG.
	</desc>
${indent(mainArtworkPaths, 1)}
${labelPath ? `	<g id="number">\n${indent(labelPath, 2)}\n	</g>\n` : ''}${characterPaths ? `${indent(characterPaths, 1)}\n` : ''}
</svg>
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output);
console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);

async function makeDragonOutput(components, sourceViewBox) {
	const referenceWhiteBox = await getDragonWhiteReferenceBounds();
	const dragonReference = await extractReferenceImageComponents(referencePath, { minPixels: 4 });
	const referenceComponents = dragonReference.artworkComponents.length
		? dragonReference.artworkComponents
		: [];
	const dragonColorOverlaps = [{
		items: components.map((component) => ({
			key: componentPaletteKey(component),
			source: sourcePaintColor(component),
			target: referencePaintColorForComponent(component, components, referenceComponents) || dragonColor(FACE_KEY),
			weight: component.pixels || component.area || 1,
			sourceIndex: component.sourceIndex,
		})),
	}];
	overlapPaletteColors = Colors.overlapPaletteColorMap(dragonColorOverlaps);
	hueShadesByHue = Colors.mappedHueShadesByHue(
		dragonColorOverlaps.flatMap((overlap) => overlap.items),
		[
			...components.map(sourcePaintColor),
			...dragonReference.components.map((component) => component.dominantColor),
		].filter(Boolean),
	);
	const sourceCalibrationBox = await getSourceDragonWhiteBox(components, sourceViewBox);
	const sourceArtBounds = getComponentUnionBounds(components) || sourceCalibrationBox;
	const fittedSourceArtBox = centeredFitBox(sourceArtBounds, sourceCalibrationBox);
	const calibrationTransform = sourceToReferenceUniformFitMatrix(sourceCalibrationBox, referenceWhiteBox);
	const fittedReferenceArtBox = transformBounds(fittedSourceArtBox, calibrationTransform);
	const transform = boundsToTransform(sourceArtBounds, fittedReferenceArtBox);
	const color = dragonColor(FACE_KEY);
	const artPaths = components
		.map((component, index) => makePaintPathWithKnockouts({
			component,
			color: outputPaintColor(component, referencePaintColorForComponent(component, components, referenceComponents) || color),
			transform,
			attributes: {
				id: `dragon-art-part-${index + 1}`,
				'data-special-role': 'dragon-art',
				'data-dragon-calibration': 'source-white-box-family-transform',
				'data-reference-color': referencePaintColorForComponent(component, components, referenceComponents) || color,
			},
		}))
		.map((sourceFragment) => indent(sourceFragment, 2))
		.join('\n');

	return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${FACE_VIEWBOX}">
	<title>${FACE_KEY} generic-special dragon face</title>
	<desc>
		Special-case dragon preprocessing. Dragon artwork is artwork-only; no
		label is generated. Source white-dragon geometry defines the
		family scale, fitted uniformly into the canonical or simulated
		white-dragon reference box so source aspect ratio is preserved.
	</desc>
	<g id="dragon-art" data-match-status="matched-dragon-white-box">
${artPaths}
	</g>
</svg>
`;
}

function sourceToReferenceUniformFitTransform(sourceBounds, targetPixelBounds) {
	return matrixToTransform(sourceToReferenceUniformFitMatrix(sourceBounds, targetPixelBounds));
}

function sourceToReferenceUniformFitMatrix(sourceBounds, targetPixelBounds) {
	const targetBounds = referencePixelsToViewBox(targetPixelBounds);
	const sourceWidth = sourceBounds.right - sourceBounds.left;
	const sourceHeight = sourceBounds.bottom - sourceBounds.top;
	const scale = Math.min(
		targetBounds.width / sourceWidth,
		targetBounds.height / sourceHeight,
	);
	const sourceCenterX = sourceBounds.left + (sourceWidth / 2);
	const sourceCenterY = sourceBounds.top + (sourceHeight / 2);
	const targetCenterX = targetBounds.left + (targetBounds.width / 2);
	const targetCenterY = targetBounds.top + (targetBounds.height / 2);
	const translateX = targetCenterX - (sourceCenterX * scale);
	const translateY = targetCenterY - (sourceCenterY * scale);

	return {
		a: scale,
		b: 0,
		c: 0,
		d: scale,
		e: translateX,
		f: translateY,
	};
}

function boundsToTransform(sourceBounds, targetBounds) {
	const scaleX = targetBounds.width / (sourceBounds.right - sourceBounds.left);
	const scaleY = targetBounds.height / (sourceBounds.bottom - sourceBounds.top);
	return matrixToTransform({
		a: scaleX,
		b: 0,
		c: 0,
		d: scaleY,
		e: targetBounds.left - (sourceBounds.left * scaleX),
		f: targetBounds.top - (sourceBounds.top * scaleY),
	});
}

function transformBounds(bounds, matrix) {
	const points = [
		{ x: bounds.left, y: bounds.top },
		{ x: bounds.right, y: bounds.top },
		{ x: bounds.right, y: bounds.bottom },
		{ x: bounds.left, y: bounds.bottom },
	].map((point) => ({
		x: (matrix.a * point.x) + (matrix.c * point.y) + matrix.e,
		y: (matrix.b * point.x) + (matrix.d * point.y) + matrix.f,
	}));
	const left = Math.min(...points.map((point) => point.x));
	const top = Math.min(...points.map((point) => point.y));
	const right = Math.max(...points.map((point) => point.x));
	const bottom = Math.max(...points.map((point) => point.y));

	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

function matrixToTransform(matrix) {
	return `matrix(${format(matrix.a)} ${format(matrix.b)} ${format(matrix.c)} ${format(matrix.d)} ${format(matrix.e)} ${format(matrix.f)})`;
}

function centeredFitBox(sourceArtBounds, targetBox) {
	const artWidth = sourceArtBounds.right - sourceArtBounds.left;
	const artHeight = sourceArtBounds.bottom - sourceArtBounds.top;

	if (artWidth <= 0 || artHeight <= 0 || targetBox.width <= 0 || targetBox.height <= 0) {
		return sourceArtBounds;
	}

	const scale = Math.min(targetBox.width / artWidth, targetBox.height / artHeight);
	const width = artWidth * scale;
	const height = artHeight * scale;
	const centerX = targetBox.left + (targetBox.width / 2);
	const centerY = targetBox.top + (targetBox.height / 2);

	return {
		left: centerX - (width / 2),
		top: centerY - (height / 2),
		right: centerX + (width / 2),
		bottom: centerY + (height / 2),
		width,
		height,
	};
}

async function getSourceDragonWhiteBox(fallbackComponents, fallbackViewBox) {
	const whiteSourcePath = sourceSvgPath('dragon-w');

	try {
		const whiteSource = fs.readFileSync(whiteSourcePath, 'utf8');
		const whiteExtracted = extractSourceSvgComponents(whiteSource);
		const whiteOuterBox = whiteExtracted.viewBox ? viewBoxToBounds(whiteExtracted.viewBox) : null;
		const currentOuterBox = fallbackViewBox
			? viewBoxToBounds(fallbackViewBox)
			: whiteOuterBox;
		const whiteBox = findWhiteDragonRectangleBox(whiteExtracted.components);

		if (whiteBox && whiteOuterBox && currentOuterBox) {
			return boxFromPaddingRatios(currentOuterBox, paddingRatios(whiteBox, whiteOuterBox));
		}

		if (currentOuterBox) {
			const referenceWhiteBox = await getDragonWhiteReferenceBounds();
			return boxFromPaddingRatios(currentOuterBox, referencePaddingRatios(referenceWhiteBox));
		}
	} catch (error) {
		console.warn(`Could not read source white-dragon calibration box: ${error.message}`);
	}

	const sourceArtBounds = getComponentUnionBounds(fallbackComponents);
	if (!sourceArtBounds && fallbackViewBox) {
		return viewBoxToBounds(fallbackViewBox);
	}

	const referenceWhiteBox = await getDragonWhiteReferenceBounds();
	const referenceArtBounds = await getReferenceAlphaBounds(referencePath);

	return simulatedSourceDragonWhiteBox(sourceArtBounds, referenceArtBounds, referenceWhiteBox);
}

function paddingRatios(innerBox, outerBox) {
	return {
		left: (innerBox.left - outerBox.left) / outerBox.width,
		right: (outerBox.right - innerBox.right) / outerBox.width,
		top: (innerBox.top - outerBox.top) / outerBox.height,
		bottom: (outerBox.bottom - innerBox.bottom) / outerBox.height,
	};
}

function referencePaddingRatios(referenceWhiteBox) {
	return {
		left: referenceWhiteBox.left / LARGE_FACE_CANVAS.width,
		right: (LARGE_FACE_CANVAS.width - referenceWhiteBox.right) / LARGE_FACE_CANVAS.width,
		top: referenceWhiteBox.top / LARGE_FACE_CANVAS.height,
		bottom: (LARGE_FACE_CANVAS.height - referenceWhiteBox.bottom) / LARGE_FACE_CANVAS.height,
	};
}

function boxFromPaddingRatios(outerBox, ratios) {
	const left = outerBox.left + (outerBox.width * ratios.left);
	const top = outerBox.top + (outerBox.height * ratios.top);
	const right = outerBox.right - (outerBox.width * ratios.right);
	const bottom = outerBox.bottom - (outerBox.height * ratios.bottom);

	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

function findWhiteDragonRectangleBox(components) {
	return components
		.filter((component) => !component.tileLayerCandidate)
		.filter((component) => !component.negativeSpaceCandidate)
		.filter((component) => isPaint(component.fill) || isPaint(component.stroke))
		.filter((component) => isRectangleLikeComponent(component))
		.sort((left, right) => right.bounds.width * right.bounds.height - left.bounds.width * left.bounds.height)[0]?.bounds || null;
}

function isRectangleLikeComponent(component) {
	const boundsArea = component.bounds.width * component.bounds.height;
	if (!Number.isFinite(boundsArea) || boundsArea <= 0) {
		return false;
	}

	const pathArea = transformedPathArea(component);
	if (!Number.isFinite(pathArea) || pathArea <= 0) {
		return false;
	}

	return pathArea / boundsArea >= 0.92;
}

function transformedPathArea(component) {
	let item = null;
	try {
		item = new paper.CompoundPath(component.pathData);
		const transform = component.transform || { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
		item.transform(new paper.Matrix(transform.a, transform.b, transform.c, transform.d, transform.e, transform.f));
		return Math.abs(item.area);
	} catch {
		return NaN;
	} finally {
		item?.remove();
	}
}

function simulatedSourceDragonWhiteBox(sourceArtBounds, referenceArtBounds, referenceWhiteBox) {
	const leftRatio = (referenceArtBounds.left - referenceWhiteBox.left) / referenceWhiteBox.width;
	const rightRatio = (referenceArtBounds.right - referenceWhiteBox.left) / referenceWhiteBox.width;
	const topRatio = (referenceArtBounds.top - referenceWhiteBox.top) / referenceWhiteBox.height;
	const bottomRatio = (referenceArtBounds.bottom - referenceWhiteBox.top) / referenceWhiteBox.height;
	const sourceWidth = sourceArtBounds.width / Math.max(0.000001, rightRatio - leftRatio);
	const sourceHeight = sourceArtBounds.height / Math.max(0.000001, bottomRatio - topRatio);
	const left = sourceArtBounds.left - (sourceWidth * leftRatio);
	const top = sourceArtBounds.top - (sourceHeight * topRatio);

	return {
		left,
		top,
		right: left + sourceWidth,
		bottom: top + sourceHeight,
		width: sourceWidth,
		height: sourceHeight,
	};
}

function viewBoxToBounds(viewBox) {
	return {
		left: viewBox.minX,
		top: viewBox.minY,
		right: viewBox.minX + viewBox.width,
		bottom: viewBox.minY + viewBox.height,
		width: viewBox.width,
		height: viewBox.height,
	};
}

async function getDragonWhiteReferenceBounds() {
	const image = await readRgba(DRAGON_WHITE_REFERENCE_PATH);
	const visibleBounds = getAlphaBounds(image, DRAGON_WHITE_REFERENCE_PATH);

	if (isFrameLikeAlphaShape(image, visibleBounds)) {
		return visibleBounds;
	}

	console.warn('Reference white dragon is not frame-like; using simulated safe dragon reference box.');
	return safeDragonReferenceBox();
}

async function getReferenceAlphaBounds(filePath) {
	return getAlphaBounds(await readRgba(filePath), filePath);
}

function getAlphaBounds(image, filePath) {
	let left = image.width;
	let top = image.height;
	let right = -1;
	let bottom = -1;

	for (let y = 0; y < image.height; y += 1) {
		for (let x = 0; x < image.width; x += 1) {
			const alpha = image.data[((y * image.width + x) * 4) + 3];

			if (alpha <= 8) {
				continue;
			}

			left = Math.min(left, x);
			top = Math.min(top, y);
			right = Math.max(right, x);
			bottom = Math.max(bottom, y);
		}
	}

	if (right < left || bottom < top) {
		throw new Error(`Cannot find visible bounds for ${path.relative(process.cwd(), filePath)}.`);
	}

	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

function isFrameLikeAlphaShape(image, bounds) {
	const thickness = Math.max(2, Math.round(Math.min(bounds.width, bounds.height) * 0.08));
	const edgeCoverage = [
		alphaCoverage(image, {
			left: bounds.left,
			top: bounds.top,
			right: bounds.right,
			bottom: Math.min(bounds.bottom, bounds.top + thickness),
		}),
		alphaCoverage(image, {
			left: bounds.left,
			top: Math.max(bounds.top, bounds.bottom - thickness),
			right: bounds.right,
			bottom: bounds.bottom,
		}),
		alphaCoverage(image, {
			left: bounds.left,
			top: bounds.top,
			right: Math.min(bounds.right, bounds.left + thickness),
			bottom: bounds.bottom,
		}),
		alphaCoverage(image, {
			left: Math.max(bounds.left, bounds.right - thickness),
			top: bounds.top,
			right: bounds.right,
			bottom: bounds.bottom,
		}),
	];

	return edgeCoverage.every((coverage) => coverage >= 0.18)
		&& edgeCoverage.filter((coverage) => coverage >= 0.35).length >= 2;
}

function alphaCoverage(image, bounds) {
	let visible = 0;
	let total = 0;

	for (let y = Math.max(0, bounds.top); y <= Math.min(image.height - 1, bounds.bottom); y += 1) {
		for (let x = Math.max(0, bounds.left); x <= Math.min(image.width - 1, bounds.right); x += 1) {
			total += 1;

			if (image.data[((y * image.width + x) * 4) + 3] > 8) {
				visible += 1;
			}
		}
	}

	return total === 0 ? 0 : visible / total;
}

function safeDragonReferenceBox() {
	const left = DRAGON_SAFE_REFERENCE_BOX_RATIO.left * LARGE_FACE_CANVAS.width;
	const top = DRAGON_SAFE_REFERENCE_BOX_RATIO.top * LARGE_FACE_CANVAS.height;
	const right = DRAGON_SAFE_REFERENCE_BOX_RATIO.right * LARGE_FACE_CANVAS.width;
	const bottom = DRAGON_SAFE_REFERENCE_BOX_RATIO.bottom * LARGE_FACE_CANVAS.height;

	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

function dragonColor(faceKey) {
	const colors = {
		'dragon-g': '#2FC906',
		'dragon-r': '#FC1D05',
		'dragon-w': '#0505D1',
	};

	return colors[faceKey] || '#000000';
}

function makeReferenceRoles(referenceData) {
	if (!referenceData.labelComponent && metadata.labelText) {
		throw new Error(`Cannot place generated label for ${FACE_KEY}; reference label component was not found.`);
	}

	const characterComponents = shouldUseCharacterRole()
		? selectTopCharacterComponents(referenceData.artworkComponents, referenceData.labelComponent)
		: [];
	const characterComponentSet = new Set(characterComponents);
	const mainComponents = referenceData.artworkComponents
		.filter((component) => !characterComponentSet.has(component));

	return {
		label: referenceData.labelComponent
			? makeRole('label', [referenceData.labelComponent])
			: null,
		character: characterComponents.length > 0
			? makeRole('character', characterComponents)
			: null,
		main: makeRole('main-artwork', mainComponents),
	};
}

function selectTopCharacterComponents(components, labelComponent) {
	const outerBounds = unionBounds([...(labelComponent ? [labelComponent] : []), ...components].map((component) => component.bounds || component));
	const labelSide = labelComponent ? getSide(labelComponent, outerBounds) : null;
	const characterCorner = glyphCorner('character', 'referenceCorner')
		|| cornerForSide(labelSide === 'left' ? 'right' : 'left');
	const candidates = findSmallIsolatedCandidates(components, outerBounds, {
		topBandRatio: 0.4,
		maxAreaRatio: 0.22,
		minWidth: 18,
		minHeight: 18,
	})
		.filter((candidate) => candidate.topBand)
		.filter((candidate) => candidate.normalizedCenter.y < 0.34)
		.filter((candidate) => candidateMatchesCorner(candidate, characterCorner))
		.filter((candidate) => !labelSide || !glyphCorner('character', 'referenceCorner') || candidate.side !== labelSide)
		.sort((left, right) => cornerDistance(left, characterCorner) - cornerDistance(right, characterCorner)
			|| right.area - left.area);

	return candidates.slice(0, 1).map((candidate) => candidate.item);
}

function makeRole(name, components) {
	const bounds = unionBounds(components.map((component) => component.bounds || component));
	return {
		name,
		components,
		bounds,
		center: {
			x: bounds.left + (bounds.width / 2),
			y: bounds.top + (bounds.height / 2),
		},
		dominantColor: dominantComponentColor(components),
	};
}

function assignSourceGroupsToRoles(groups, roles) {
	const sourceOuter = unionBounds(groups.map((group) => group.bounds));
	const roleOuter = unionBounds([roles.label, roles.character, roles.main].filter(Boolean).map((role) => role.bounds));
	const assignments = {
		label: [],
		character: [],
		main: [],
	};

	const shouldRemoveSourceLabel = glyphSourcePresent('number', FLOWER_OR_SEASON || metadata.sourceContainsLabel);
	const labelGroup = shouldRemoveSourceLabel && roles.label
		? findSourceLabelGroup(groups, roles, sourceOuter, roleOuter)
		: null;
	const shouldFindCharacter = glyphSourcePresent('character', FLOWER_OR_SEASON);
	const characterGroups = shouldFindCharacter && roles.character
		? findCharacterSourceGroups(groups.filter((group) => group !== labelGroup), roles, sourceOuter, roleOuter)
		: [];
	const characterGroupSet = new Set(characterGroups);

	if (labelGroup) {
		assignments.label.push(labelGroup);
	}
	if (characterGroups.length > 0) {
		assignments.character.push(...characterGroups);
	}

	assignments.main = groups.filter((group) => group !== labelGroup && !characterGroupSet.has(group));

	return assignments;
}

function findSourceLabelGroup(groups, roles, sourceOuter, roleOuter) {
	const metadataGroup = findSourceGlyphGroupByBounds(groups, 'number');
	if (metadataGroup) {
		return metadataGroup;
	}

	if (!FLOWER_OR_SEASON) {
		return findClosestGroup(groups, roles.label, sourceOuter, roleOuter);
	}

	const targetCorner = glyphCorner('number', 'sourceCorner')
		|| cornerForSide(getSide(roles.label, roleOuter));
	const candidates = findSmallIsolatedCandidates(groups, sourceOuter, {
		topBandRatio: 0.4,
		maxAreaRatio: 0.22,
		minWidth: 5,
		minHeight: 12,
		})
		.filter((candidate) => candidate.topBand)
		.filter((candidate) => candidate.normalizedCenter.y < 0.36)
		.filter((candidate) => candidate.areaRatio > 0.015)
		.filter((candidate) => candidateMatchesCorner(candidate, targetCorner))
		.sort((left, right) => cornerDistance(left, targetCorner) - cornerDistance(right, targetCorner)
			|| right.area - left.area);

	return candidates[0]?.item || null;
}

function findCharacterSourceGroups(groups, roles, sourceOuter, roleOuter) {
	if (!FLOWER_OR_SEASON) {
		return [];
	}

	if (SEASON_FACE) {
		const targetCorner = glyphCorner('character', 'sourceCorner');
		const metadataCornerGroup = targetCorner
			? findClosestSourceGlyphGroup(groups, sourceOuter, targetCorner)
			: null;
		if (metadataCornerGroup) {
			return findSeasonCharacterSourceGroups(groups, metadataCornerGroup, roles, sourceOuter, roleOuter);
		}
	}

	const targetCorner = glyphCorner('character', 'sourceCorner')
		|| cornerForSide(getSide(roles.character, roleOuter));
	const candidates = findSmallIsolatedCandidates(groups, sourceOuter, {
		topBandRatio: 0.4,
		maxAreaRatio: 0.26,
		minWidth: 18,
		minHeight: 18,
	})
		.filter((candidate) => candidate.topBand)
		.filter((candidate) => candidate.normalizedCenter.y < 0.38)
		.filter((candidate) => candidate.normalizedBottom < 0.62)
		.filter((candidate) => candidateMatchesCorner(candidate, targetCorner))
		.sort((left, right) => cornerDistance(left, targetCorner) - cornerDistance(right, targetCorner)
			|| groupArea(right) - groupArea(left));

	return candidates[0]?.item ? [candidates[0].item] : [];
}

function findClosestSourceGlyphGroup(groups, sourceOuter, targetCorner) {
	return findSmallIsolatedCandidates(groups, sourceOuter, {
		topBandRatio: 0.4,
		maxAreaRatio: 0.26,
		minWidth: 5,
		minHeight: 5,
	})
		.filter((candidate) => candidate.topBand)
		.filter((candidate) => candidate.normalizedCenter.y < 0.36)
		.filter((candidate) => candidate.normalizedBottom < 0.4)
		.sort((left, right) => cornerDistance(left, targetCorner) - cornerDistance(right, targetCorner)
			|| left.area - right.area)[0]?.item || null;
}

function findSeasonCharacterSourceGroups(groups, characterGroup, roles, sourceOuter, roleOuter) {
	const targetCorner = glyphCorner('character', 'sourceCorner')
		|| cornerForSide(getSide(roles.character, roleOuter));
	const metadataColor = characterGroup.dominantColor;
	const candidates = findSmallIsolatedCandidates(groups, sourceOuter, {
		topBandRatio: 0.4,
		maxAreaRatio: 0.26,
		minWidth: 5,
		minHeight: 5,
	})
		.filter((candidate) => candidate.item === characterGroup || candidate.item.dominantColor === metadataColor)
		.filter((candidate) => candidate.topBand)
		.filter((candidate) => candidate.normalizedCenter.y < 0.33)
		.filter((candidate) => candidate.normalizedBottom < 0.36)
		.filter((candidate) => candidateMatchesCorner(candidate, targetCorner))
		.sort((left, right) => cornerDistance(left, targetCorner) - cornerDistance(right, targetCorner)
			|| left.item.bounds.left - right.item.bounds.left);

	const selected = candidates.map((candidate) => candidate.item);
	return selected.includes(characterGroup)
		? selected
		: [characterGroup, ...selected];
}

function findSourceGlyphGroupByBounds(groups, name) {
	const targetBounds = metadata.glyphLayout?.[name]?.sourceBounds;
	if (!targetBounds) {
		return null;
	}

	return groups
		.map((group) => ({
			group,
			score: boundsDistance(group.bounds, targetBounds),
		}))
		.filter((candidate) => candidate.score < 2)
		.sort((left, right) => left.score - right.score)[0]?.group || null;
}

function findClosestGroup(groups, role, sourceOuter, roleOuter) {
	return groups
		.map((group) => ({
			group,
			distance: distance(
				normalizedCenter(group, sourceOuter),
				normalizedCenter(role, roleOuter),
			),
		}))
		.sort((left, right) => left.distance - right.distance)[0]?.group || null;
}

function renderRole({ id, role, sourceGroups: assignedGroups, sourceComponents, color, forceColor = false }) {
	if (!role || assignedGroups.length === 0) {
		return '';
	}

	const components = assignedGroups
		.flatMap((group) => group.components)
		.sort(compareByRenderOrder);
	const sourceBounds = unionBounds(components.map((component) => component.bounds));
	const transform = sourceToReferenceTransform(sourceBounds, role.bounds, LARGE_FACE_CANVAS);
	const cutoutComponents = selectKnockoutComponents(sourceComponents, components, {
		maxArea: Infinity,
	});
	const paths = components.map((component, index) => makePaintPathWithKnockouts({
		component,
		color: outputPaintColor(component, forceColor
			? color
			: referencePaintColorForComponent(component, components, role.components) || color || nearestPaintColor(component), { force: forceColor }),
		knockouts: cutoutComponents.filter((cutout) => isRelatedKnockout(component, cutout)),
		transform,
		attributes: {
			id: `${id}-part-${index + 1}`,
			'data-special-role': id,
		},
	}));

	return `<g id="${id}">
${indent(paths.join('\n'), 1)}
</g>`;
}

function roleColorMappings(assignedGroups, role) {
	if (!role || !assignedGroups) {
		return [];
	}

	const components = assignedGroups.flatMap((group) => group.components);

	return components.map((component) => ({
		source: sourcePaintColor(component),
		target: referencePaintColorForComponent(component, components, role.components)
			|| role.dominantColor
			|| nearestPaintColor(component),
	}));
}

function roleColorOverlaps(assignedGroups, role) {
	if (!role || !assignedGroups) {
		return [];
	}

	const assignedComponents = assignedGroups.flatMap((group) => group.components);

	return [{
		items: assignedComponents.map((component) => ({
			key: componentPaletteKey(component),
			source: sourcePaintColor(component),
			target: referencePaintColorForComponent(component, assignedComponents, role.components)
				|| role.dominantColor
				|| nearestPaintColor(component),
			weight: component.pixels || component.area || 1,
			sourceIndex: component.sourceIndex,
		})),
	}];
}

function referencePaintColorForComponent(component, sourceComponents, referenceComponents) {
	const referenceComponent = analogousReferenceComponent(component, sourceComponents, referenceComponents);
	const targetColor = referenceComponent?.dominantColor || null;
	const sourceHue = Colors.perceivedHue(sourcePaintColor(component));
	const targetHue = Colors.perceivedHue(targetColor);

	if (sourceHue && targetHue && sourceHue !== targetHue) {
		return sourceHueReferenceColor(sourceHue);
	}

	return targetColor || sourceHueReferenceColor(sourceHue);
}

function sourceHueReferenceColor(family) {
	return sourceHueAverageColors.get(family) || family || null;
}

function sourceHueFallbackColor(family) {
	return sourceHueReferenceColor(family);
}

function analogousReferenceComponent(component, sourceComponents, referenceComponents) {
	if (!referenceComponents || referenceComponents.length === 0) {
		return null;
	}

	if (referenceComponents.length === 1) {
		return referenceComponents[0];
	}

	const sourceBounds = unionBounds(sourceComponents.map(matchBounds));
	const referenceBounds = unionBounds(referenceComponents.map(matchBounds));
	const candidateComponents = perceivedReferenceCandidates(component, referenceComponents);

	return candidateComponents
		.map((referenceComponent) => ({
			component: referenceComponent,
			distance: analogousReferenceScore(component, referenceComponent, sourceBounds, referenceBounds),
		}))
		.sort((left, right) => left.distance - right.distance)[0]?.component || null;
}

function perceivedReferenceCandidates(component, referenceComponents) {
	const sourceHue = Colors.perceivedHue(sourcePaintColor(component));
	const sameHue = sourceHue
		? referenceComponents.filter((referenceComponent) => (
			Colors.perceivedHue(referenceComponent.dominantColor) === sourceHue
		))
		: [];

	return sameHue.length > 0 ? sameHue : referenceComponents;
}

function analogousReferenceScore(component, referenceComponent, sourceBounds, referenceBounds) {
	const hasBounds = sourceBounds && referenceBounds;
	const sourcePoint = hasBounds ? normalizedCenter(component, sourceBounds) : null;
	const referencePoint = hasBounds ? normalizedCenter(referenceComponent, referenceBounds) : null;
	const centerScore = hasBounds ? distance(sourcePoint, referencePoint) : 0;
	const sourceAreaRatio = hasBounds ? normalizedArea(component, sourceBounds) : 0;
	const referenceAreaRatio = hasBounds ? normalizedArea(referenceComponent, referenceBounds) : 0;
	const areaScore = hasBounds
		? Math.abs(Math.log((sourceAreaRatio + 0.0001) / (referenceAreaRatio + 0.0001)))
		: 0;
	const colorScore = perceivedReferenceComponentColorDistance(sourcePaintColor(component), referenceComponent);

	return centerScore + (areaScore * 0.04) + ((colorScore ?? 0) * 1.2);
}

function perceivedReferenceComponentColorDistance(sourceColor, referenceComponent) {
	return Colors.perceivedDistance(sourceColor, referenceComponent.dominantColor);
}

function compareByRenderOrder(left, right) {
	const layered = compareByOverlappingDetailLayer(left, right);

	if (layered !== 0) {
		return layered;
	}

	return (left.sourceIndex ?? 0) - (right.sourceIndex ?? 0);
}

function compareByOverlappingDetailLayer(left, right) {
	const overlap = boundsIntersection(left.bounds, right.bounds);

	if (!overlap) {
		return 0;
	}

	const leftArea = Math.max(1, left.area || boundsArea(left.bounds));
	const rightArea = Math.max(1, right.area || boundsArea(right.bounds));
	const largerArea = Math.max(leftArea, rightArea);
	const smallerArea = Math.min(leftArea, rightArea);
	const overlapArea = boundsArea(overlap);

	if (largerArea / smallerArea < 4 || overlapArea / smallerArea < 0.2) {
		return 0;
	}

	return leftArea > rightArea ? -1 : 1;
}

function boundsIntersection(left, right) {
	if (!left || !right) {
		return null;
	}

	const intersection = {
		left: Math.max(left.left, right.left),
		top: Math.max(left.top, right.top),
		right: Math.min(left.right, right.right),
		bottom: Math.min(left.bottom, right.bottom),
	};

	if (intersection.right <= intersection.left || intersection.bottom <= intersection.top) {
		return null;
	}

	return {
		...intersection,
		width: intersection.right - intersection.left,
		height: intersection.bottom - intersection.top,
	};
}

function boundsArea(bounds) {
	return bounds ? bounds.width * bounds.height : 0;
}

function matchBounds(item) {
	return item?.bounds || item;
}

function normalizedArea(component, outerBounds) {
	const bounds = matchBounds(component);
	const area = component.pixels || component.area || boundsArea(bounds);
	return area / Math.max(1, boundsArea(outerBounds));
}

function makeLabelPath(font, metadata, labelBounds) {
	if (!labelBounds) {
		return '';
	}

	const pathData = font.getPath(metadata.labelText, 0, 0, 20).toPathData(3);
	const labelItem = new paper.CompoundPath(pathData);
	const bounds = labelItem.bounds;
	labelItem.remove();
	const target = referencePixelsToViewBox(labelBounds);
	const scaleX = target.width / bounds.width;
	const scaleY = target.height / bounds.height;
	const translateX = target.left - (bounds.left * scaleX);
	const translateY = target.top - (bounds.top * scaleY);
	const transform = `matrix(${format(scaleX)} 0 0 ${format(scaleY)} ${format(translateX)} ${format(translateY)})`;

	return `<path fill="${glyphOutputColor('number') || metadata.labelColor}" data-generated-font="Gluten 800" transform="${transform}" d="${pathData}"/>`;
}

function makeCharacterPath(characterText, characterBounds, color) {
	if (!characterBounds) {
		return '';
	}

	const fontPath = findCharacterFontPath(characterText);
	if (!fontPath) {
		console.warn(`Cannot generate character ${characterText} for ${FACE_KEY}; no local CJK font contains it.`);
		return '';
	}

	const font = opentype.loadSync(fontPath);
	const pathData = font.getPath(characterText, 0, 0, 32).toPathData(3);
	const characterItem = new paper.CompoundPath(pathData);
	const bounds = characterItem.bounds;
	characterItem.remove();
	const target = referencePixelsToViewBox(characterBounds);
	const scale = Math.min(target.width / bounds.width, target.height / bounds.height);
	const width = bounds.width * scale;
	const height = bounds.height * scale;
	const translateX = target.left + ((target.width - width) / 2) - (bounds.left * scale);
	const translateY = target.top + ((target.height - height) / 2) - (bounds.top * scale);
	const transform = `matrix(${format(scale)} 0 0 ${format(scale)} ${format(translateX)} ${format(translateY)})`;
	const fontName = path.basename(fontPath);

	return `<g id="character" data-generated-character="${escapeAttribute(characterText)}">
	<path fill="${color || '#0505D1'}" data-generated-font="${escapeAttribute(fontName)}" transform="${transform}" d="${pathData}"/>
</g>`;
}

function findCharacterFontPath(characterText) {
	const configuredPath = metadata.characterFontPath
		? path.resolve(process.cwd(), metadata.characterFontPath)
		: null;
	const candidates = configuredPath
		? [configuredPath, ...CJK_FONT_CANDIDATES]
		: CJK_FONT_CANDIDATES;

	return candidates.find((candidate) => fontContainsText(candidate, characterText)) || null;
}

function fontContainsText(fontPath, text) {
	try {
		if (!fs.existsSync(fontPath)) {
			return false;
		}
		const font = opentype.loadSync(fontPath);
		return [...text].every((character) => font.charToGlyph(character).unicode === character.codePointAt(0));
	} catch {
		return false;
	}
}

function selectPaintComponents(components) {
	return components
		.filter((component) => !component.tileLayerCandidate)
		.filter((component) => !component.negativeSpaceCandidate)
		.filter((component) => isPaint(component.fill) || isPaint(component.stroke))
		.filter((component) => component.area >= MIN_SOURCE_PAINT_AREA)
		.sort((left, right) => left.center.y - right.center.y || left.center.x - right.center.x);
}

function isRelatedToGroup(group, cutout) {
	return group.components.some((component) => (
		cutout.area < component.area
		&& cutout.center.x >= component.bounds.left
		&& cutout.center.x <= component.bounds.right
		&& cutout.center.y >= component.bounds.top
		&& cutout.center.y <= component.bounds.bottom
	));
}

function referencePixelsToViewBox(bounds) {
	return {
		left: bounds.left * (94 / LARGE_FACE_CANVAS.width),
		top: bounds.top * (136 / LARGE_FACE_CANVAS.height),
		width: bounds.width * (94 / LARGE_FACE_CANVAS.width),
		height: bounds.height * (136 / LARGE_FACE_CANVAS.height),
	};
}

function nearestPaintColor(component) {
	const componentColor = metadata.sourceComponentColors?.[component.id];

	if (componentColor) {
		return componentColor;
	}

	const paint = isPaint(component.fill) ? component.fill : component.stroke;
	const rgb = parsePaintRgb(paint);

	if (!rgb) {
		return '#000000';
	}

	return nearestPaletteColor(rgb);
}

function outputPaintColor(component, recoloredPaint, options = {}) {
	if (options.force) {
		return recoloredPaint;
	}

	if (!recolorComponents()) {
		return sourcePaintColor(component);
	}

	const paletteKey = componentPaletteKey(component);

	if (overlapPaletteColors.has(paletteKey)) {
		return overlapPaletteColors.get(paletteKey);
	}

	return Colors.interpolatedPaletteColor(sourcePaintColor(component), recoloredPaint, {
		hueShadesByHue,
		sourceColorCountByHue,
		sourceHueShadesByHue,
	});
}

function componentPaletteKey(component) {
	const bounds = component.bounds || {};

	return [
		component.sourceIndex ?? '',
		component.id ?? '',
		sourcePaintColor(component) ?? '',
		formatKeyNumber(bounds.left),
		formatKeyNumber(bounds.top),
		formatKeyNumber(bounds.right),
		formatKeyNumber(bounds.bottom),
		String(component.pathData || '').slice(0, 96),
	].join('|');
}

function formatKeyNumber(value) {
	return Number.isFinite(value) ? Number(value.toFixed(3)).toString() : '';
}

function sourcePaintColor(component) {
	return isPaint(component.fill) ? component.fill : component.stroke;
}

function canonicalSourcePaletteColor(rgb) {
	const [red, green, blue] = rgb;
	const max = Math.max(red, green, blue);
	const min = Math.min(red, green, blue);

	if (max - min < 28) {
		return nearestPaletteColor(rgb);
	}

	if (red > green && red > blue) {
		return '#FC1D05';
	}

	if (green > red && green > blue) {
		return '#2FC906';
	}

	if (blue > red && blue > green) {
		return '#0505D1';
	}

	return nearestPaletteColor(rgb);
}

function recolorComponents() {
	return metadata.recolorComponents !== false;
}

function parsePaintRgb(paint) {
	if (paint === 'black') {
		return [0, 0, 0];
	}

	const hex = /^#([0-9a-f]{6})$/i.exec(paint)?.[1];

	return hex
		? [
			Number.parseInt(hex.slice(0, 2), 16),
			Number.parseInt(hex.slice(2, 4), 16),
			Number.parseInt(hex.slice(4, 6), 16),
		]
		: null;
}

function isChromatic(rgb) {
	return Math.max(...rgb) - Math.min(...rgb) >= 28;
}

function dominantComponentColor(components) {
	const counts = new Map();

	for (const component of components) {
		if (!component.dominantColor) {
			continue;
		}

		counts.set(component.dominantColor, (counts.get(component.dominantColor) || 0) + (component.pixels || 1));
	}

	return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || '#000000';
}

function normalizedCenter(item, outerBounds) {
	return {
		x: (item.center.x - outerBounds.left) / Math.max(1, outerBounds.width),
		y: (item.center.y - outerBounds.top) / Math.max(1, outerBounds.height),
	};
}

function normalizedBottom(item, outerBounds) {
	return (item.bounds.bottom - outerBounds.top) / Math.max(1, outerBounds.height);
}

function getSide(item, outerBounds) {
	const center = item.center || {
		x: item.bounds.left + (item.bounds.width / 2),
		y: item.bounds.top + (item.bounds.height / 2),
	};

	return (center.x - outerBounds.left) / Math.max(1, outerBounds.width) < 0.5 ? 'left' : 'right';
}

function distance(left, right) {
	return Math.hypot(left.x - right.x, left.y - right.y);
}

function boundsDistance(left, right) {
	return Math.abs(left.left - right.left)
		+ Math.abs(left.top - right.top)
		+ Math.abs(left.right - right.right)
		+ Math.abs(left.bottom - right.bottom);
}

function cornerForSide(side) {
	return side === 'left' ? 'topLeft' : 'topRight';
}

function shouldUseCharacterRole() {
	return metadata.glyphLayout?.character
		? metadata.glyphLayout.character.referenceCorner !== false
		: FLOWER_OR_SEASON;
}

function shouldGenerateCharacterPath() {
	return Boolean(metadata.characterText)
		&& metadata.glyphLayout?.character?.sourcePresent === false;
}

function glyphSourcePresent(name, fallback) {
	return metadata.glyphLayout?.[name]?.sourcePresent ?? fallback;
}

function glyphOutputPresent(name, fallback) {
	return metadata.glyphLayout?.[name]?.outputPresent ?? fallback;
}

function glyphOutputColor(name) {
	return metadata.glyphOutputColors?.[name] || null;
}

function glyphCorner(name, field) {
	return metadata.glyphLayout?.[name]?.[field] || null;
}

function candidateMatchesCorner(candidate, corner) {
	if (!corner) {
		return true;
	}

	return candidate.nearestCorner === corner || cornerDistance(candidate, corner) < 0.5;
}

function cornerDistance(candidate, corner) {
	return candidate.cornerDistances?.[corner] ?? Infinity;
}

function groupArea(group) {
	return group.bounds.width * group.bounds.height;
}

function isPaint(value) {
	return value && value !== 'none' && !String(value).startsWith('url(');
}

function loadMetadata(faceKey) {
	const metadata = loadFacePreprocessingMetadataEntry(faceKey);

	if (!metadata) {
		throw new Error(`No face preprocessing metadata found for ${faceKey}.`);
	}

	return metadata;
}

function indent(value, depth) {
	const prefix = '\t'.repeat(depth);
	return value
		.split('\n')
		.map((line) => line.trim() ? `${prefix}${line}` : line)
		.join('\n');
}

function escapeAttribute(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

function format(value) {
	return Number(value.toFixed(6)).toString();
}

