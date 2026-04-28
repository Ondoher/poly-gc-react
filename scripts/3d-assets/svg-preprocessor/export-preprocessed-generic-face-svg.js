import fs from 'fs';
import path from 'path';
import opentype from 'opentype.js';
import paper from 'paper';
import sharp from 'sharp';
import {
	ASSET_FONTS_DIR,
	LARGE_FACES_DIR,
	preparedSvgPath,
	sourceSvgPath,
} from '../shared/asset-paths.js';
import { loadFacePreprocessingMetadataEntry } from './face-preprocessing-metadata.js';
import { selectAnalogComponentGrouping } from './analog-component-matcher.js';
import { Colors } from './ColorPalette.js';
import {
	makePaintPathWithKnockouts,
	selectKnockoutComponents,
	transformComponentPath,
} from './normalized-face-components.js';
import {
	extractReferenceImageComponents,
	nearestPaletteColor,
} from './reference-image-components.js';
import { loadStructureBackedReferenceComponents } from './reference-structure-components.js';
import { extractSourceSvgComponents } from './source-svg-components.js';
import { composeMatrices } from './source-svg-components.js';
import {
	boundsToTransformMatrix,
	matrixToString,
	targetPixelsToViewBoxBounds,
	unionBounds,
} from './visual-component-alignment.js';

const FACE_KEY = process.argv[2];
const FACE_VIEWBOX = '0 0 94 136';
const LARGE_FACE_CANVAS = Object.freeze({ width: 164, height: 238 });
const GLUTEN_FONT = path.resolve(ASSET_FONTS_DIR, 'gluten-800.ttf');

if (!FACE_KEY) {
	console.error('Usage: node scripts/3d-assets/svg-preprocessor/export-preprocessed-generic-face-svg.js <face-key>');
	process.exit(1);
}

paper.setup([512, 512]);

const metadata = loadMetadata(FACE_KEY);
const sourcePath = sourceSvgPath(FACE_KEY);
const referencePath = path.resolve(LARGE_FACES_DIR, `${FACE_KEY}.png`);
const outputPath = preparedSvgPath(FACE_KEY);
const source = fs.readFileSync(sourcePath, 'utf8');
const sourceComponents = extractSourceSvgComponents(source).components;
const glutenFont = opentype.loadSync(GLUTEN_FONT);
const reference = await extractReferenceImageComponents(referencePath, {
	labelColor: metadata.labelColor,
	labelLocation: metadata.referenceGlyphs?.number?.location,
	labelText: metadata.labelText,
	fontPath: GLUTEN_FONT,
});
const sourcePaintComponents = selectPaintComponents(sourceComponents);
const sourceHueAverageColors = Colors.perceivedHueAverages(sourcePaintComponents.map(rawSourcePaintColor));
const sourceColorCountByHue = Colors.perceivedHueColorCounts(sourcePaintComponents.map(rawSourcePaintColor));
const sourceHueShadesByHue = Colors.sourceHueShadesByHue(sourcePaintComponents.map(rawSourcePaintColor));
const labelRemovedPaintComponents = sourceNumberPresent(metadata)
	? await removeSourceLabelComponents(sourcePaintComponents, metadata, glutenFont)
	: sourcePaintComponents;
const paintComponents = labelRemovedPaintComponents;
const cutoutComponents = selectKnockoutComponents(markSourceBackgroundKnockouts(sourceComponents), paintComponents, {
	maxArea: 500,
});
const structureReferenceArtworkComponents = loadStructureBackedReferenceComponents(FACE_KEY, {
	includeLabels: false,
});
const referenceArtworkComponents = structureReferenceArtworkComponents?.length
	? structureReferenceArtworkComponents
	: removeReferenceLabelComponents(reference.artworkComponents, metadata);
let hueShadesByHue = Colors.hueShadesByHue([
	...sourcePaintComponents.map(rawSourcePaintColor),
	...referenceArtworkComponents.map((component) => component.dominantColor),
	reference.labelComponent?.dominantColor,
	metadata.labelColor,
].filter(Boolean));
const grouping = selectAnalogComponentGrouping(paintComponents, referenceArtworkComponents, {
	gapCandidates: metadata.gapCandidates,
	groupByColor: metadata.groupByColor !== false,
});
const matchResult = grouping.matchResult;
const matches = expandMultiReferenceMatches(matchResult.matches);
hueShadesByHue = Colors.mappedHueShadesByHue(
	matches.flatMap((match) => match.sourceGroup.components.map((component) => ({
		source: rawSourcePaintColor(component),
		target: referencePaintColorForComponent(component, match),
	}))),
	[
		...sourcePaintComponents.map(rawSourcePaintColor),
		...referenceArtworkComponents.map((component) => component.dominantColor),
		reference.labelComponent?.dominantColor,
		metadata.labelColor,
	].filter(Boolean),
);
const overlapPaletteColors = Colors.overlapPaletteColorMap(matches.map((match) => ({
	items: match.sourceGroup.components.map((component) => ({
		key: componentPaletteKey(component),
		source: rawSourcePaintColor(component),
		target: referencePaintColorForComponent(component, match),
		weight: component.pixels || component.area || 1,
		sourceIndex: component.sourceIndex,
	})),
})));
const labelPath = metadata.labelText && glyphOutputPresent('number', true)
	? makeLabelPath(glutenFont, metadata, reference.labelComponent)
	: '';
const labelMask = labelPath ? await renderSvgFragmentMask(labelPath) : null;
const matchTransforms = await selectMatchTransforms(matches, labelMask);
const art = (await Promise.all(matches
	.map((match, index) => buildMatchedGroup(match, index, cutoutComponents, matchTransforms[index]))))
	.flat()
	.map((sourceFragment) => indent(sourceFragment, 2))
	.join('\n');

const output = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${FACE_VIEWBOX}">
	<title>${FACE_KEY} generic preprocessed face</title>
	<desc>
		Preprocessed path-only face generated by generic analog-component matching.
		Reference PNG components provide target position and color; source SVG components provide path geometry.
		Grouping gap: ${grouping.expandedGap}.
		Match status: ${matchResult.status}${matchResult.message ? ` (${matchResult.message})` : ''}.
	</desc>
	<g id="face-art" data-match-status="${matchResult.status}">
${art}
	</g>
${labelPath ? `	<g id="number">\n${indent(labelPath, 2)}\n	</g>\n` : ''}
</svg>
`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, output);
console.log(`Wrote ${path.relative(process.cwd(), outputPath)}`);
if (matchResult.message) {
	console.warn(matchResult.message);
}

async function buildMatchedGroup(match, index, cutoutComponents, transform) {
	return renderOrderedComponents(match.sourceGroup.components).map((component, componentIndex) => makePaintPathWithKnockouts({
		component,
		color: outputPaintColor(component, referencePaintColorForComponent(component, match)),
		knockouts: cutoutComponents.filter((cutout) => isRelatedToGroup(match.sourceGroup, cutout)),
		transform,
		attributes: {
			id: `face-art-part-${index + 1}-${componentIndex + 1}`,
			'data-reference-color': referencePaintColorForComponent(component, match),
		},
	}));
}

function renderOrderedComponents(components) {
	return [...components].sort((left, right) => {
		const leftIndex = Number.isFinite(left.sourceIndex) ? left.sourceIndex : null;
		const rightIndex = Number.isFinite(right.sourceIndex) ? right.sourceIndex : null;

		if (leftIndex != null && rightIndex != null) {
			return leftIndex - rightIndex;
		}

		if (leftIndex != null) {
			return -1;
		}

		if (rightIndex != null) {
			return 1;
		}

		return 0;
	});
}

function referencePaintColorForComponent(component, match) {
	const referenceComponent = analogousReferenceComponent(
		component,
		match.sourceGroup.components,
		match.referenceGroup.components,
	);
	const targetColor = referencePaletteColorForSource(component, referenceComponent, match.referenceGroup);
	const sourceHue = Colors.perceivedHue(rawSourcePaintColor(component));

	return targetColor || sourceHueFallbackColor(sourceHue);
}

function referencePaletteColorForSource(component, referenceComponent, referenceGroup) {
	const sourceHue = Colors.perceivedHue(rawSourcePaintColor(component));
	const colors = referencePaletteColors(referenceComponent, referenceGroup);
	const referenceColor = referenceComponent?.dominantColor || referenceGroup?.dominantColor;
	const sameHueColor = sourceHue
		? colors.find((color) => Colors.perceivedHue(color) === sourceHue)
		: null;

	if (referenceColor) {
		return referenceColor;
	}

	if (sourceHue) {
		return sameHueColor || sourceHueReferenceColor(sourceHue);
	}

	return referenceGroup.dominantColor;
}

function referencePaletteColors(referenceComponent, referenceGroup) {
	return [...new Set([
		...(referenceComponent?.colors || []),
		referenceComponent?.dominantColor,
		...referenceGroupPaletteColors(referenceGroup),
		referenceGroup?.dominantColor,
	].filter(Boolean))];
}

function referenceGroupPaletteColors(referenceGroup) {
	const colors = [];

	for (const component of referenceGroup.components || []) {
		colors.push(...(component.colors || []));
		colors.push(component.dominantColor);
	}

	return colors.filter(Boolean);
}

function sourceHueReferenceColor(family) {
	return sourceHueAverageColors.get(family) || family || null;
}

function sourceHueFallbackColor(family) {
	return sourceHueReferenceColor(family);
}

function analogousReferenceComponent(component, sourceComponents, referenceComponents) {
	if (referenceComponents.length === 0) {
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
	return referenceComponents;
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
	const colorScore = perceivedReferenceComponentColorDistance(rawSourcePaintColor(component), referenceComponent);

	return centerScore + (areaScore * 0.04) + ((colorScore ?? 0) * 0.08);
}

function perceivedReferenceComponentColorDistance(sourceColor, referenceComponent) {
	return Colors.perceivedDistance(sourceColor, referenceComponent.dominantColor);
}

function expandMultiReferenceMatches(matches) {
	return matches.flatMap((match) => {
		if (match.referenceGroup.components.length <= 1 || match.sourceGroup.components.length <= 1) {
			return [match];
		}

		return splitSourceGroupByReferenceComponents(match.sourceGroup, match.referenceGroup);
	});
}

function splitSourceGroupByReferenceComponents(sourceGroup, referenceGroup) {
	const sourceBounds = sourceGroup.bounds;
	const referenceBounds = referenceGroup.bounds;
	const referenceGroups = referenceGroup.components
		.map((component) => makeLocalGroup([component]))
		.sort(compareGroupPosition);

	if (sourceGroup.components.length % referenceGroups.length === 0) {
		const chunkSize = sourceGroup.components.length / referenceGroups.length;
		const sortedComponents = [...sourceGroup.components].sort(compareComponentPosition);

		return referenceGroups.map((referenceGroupItem, index) => ({
			sourceGroup: makeLocalGroup(sortedComponents.slice(index * chunkSize, (index + 1) * chunkSize)),
			referenceGroup: referenceGroupItem,
			distribution: makeDistribution(referenceGroups, referenceGroupItem),
		}));
	}

	const assigned = referenceGroups.map(() => []);

	for (const component of sourceGroup.components) {
		const sourcePoint = normalizedCenter(makeLocalGroup([component]), sourceBounds);
		const closestIndex = referenceGroups
			.map((group, index) => ({
				index,
				distance: distance(sourcePoint, normalizedCenter(group, referenceBounds)),
			}))
			.sort((left, right) => left.distance - right.distance)[0]?.index;

		if (closestIndex != null) {
			assigned[closestIndex].push(component);
		}
	}

	return assigned
		.map((components, index) => components.length > 0
			? {
				sourceGroup: makeLocalGroup(components),
				referenceGroup: referenceGroups[index],
				distribution: makeDistribution(referenceGroups, referenceGroups[index]),
			}
			: null)
		.filter(Boolean);
}

function makeDistribution(referenceGroups, referenceGroup) {
	const horizontalGroups = [...referenceGroups].sort((left, right) => left.center.x - right.center.x);

	return {
		bounds: unionBounds(referenceGroups.map((group) => group.bounds)),
		horizontalIndex: horizontalGroups.indexOf(referenceGroup),
		horizontalCount: horizontalGroups.length,
	};
}

async function selectMatchTransforms(matches, forbiddenMask = null) {
	const candidatesByMatch = await Promise.all(matches.map(makeScaleCandidatesForMatch));
	const selectedIndexes = candidatesByMatch.map((candidates) => bestPixelCandidateIndex(candidates));

	for (let pass = 0; pass < 3; pass += 1) {
		for (let matchIndex = 0; matchIndex < candidatesByMatch.length; matchIndex += 1) {
			selectedIndexes[matchIndex] = bestCoordinatedCandidateIndex(
				candidatesByMatch,
				selectedIndexes,
				matchIndex,
				forbiddenMask,
			);
		}
	}

	return candidatesByMatch.map((candidates, index) => matrixToString(candidates[selectedIndexes[index]].matrix));
}

async function makeScaleCandidatesForMatch(match) {
	const sourceBounds = unionBounds(match.sourceGroup.components.map((component) => component.bounds));
	const targetBounds = targetPixelsToViewBoxBounds(matchBounds(match.referenceGroup), LARGE_FACE_CANVAS);
	const distribution = match.distribution
		? {
			...match.distribution,
			bounds: targetPixelsToViewBoxBounds(match.distribution.bounds, LARGE_FACE_CANVAS),
		}
		: null;
	const referenceMask = renderReferenceGroupMask(reference.image, match.referenceGroup);
	const referenceArea = maskArea(referenceMask);

	return Promise.all(scaleCandidates(sourceBounds, targetBounds).map(async (scale) => {
		const matrix = boundsToTransformMatrix(
			sourceBounds,
			distributedTargetBounds(sourceBounds, targetBounds, scale, distribution),
			{ scale },
		);
		const sourceMask = await renderSourceGroupMask(match.sourceGroup, matrix);

		return {
			matrix,
			sourceMask,
			sourceArea: maskArea(sourceMask),
			referenceMask,
			referenceArea,
			overlapScore: scorePixelOverlap(sourceMask, referenceMask),
		};
	}));
}

function bestPixelCandidateIndex(candidates) {
	return candidates
		.map((candidate, index) => ({ index, score: candidate.overlapScore }))
		.sort((left, right) => right.score - left.score)[0]?.index || 0;
}

function bestCoordinatedCandidateIndex(candidatesByMatch, selectedIndexes, matchIndex, forbiddenMask) {
	const candidates = candidatesByMatch[matchIndex];
	const viableCandidates = candidateSetWithoutForbiddenOverlap(candidates, forbiddenMask);

	return viableCandidates
		.map((candidate, candidateIndex) => ({
			index: candidates.indexOf(candidate),
			score: coordinatedScaleScore(candidate, candidatesByMatch, selectedIndexes, matchIndex, forbiddenMask),
		}))
		.sort((left, right) => right.score - left.score)[0]?.index || 0;
}

function candidateSetWithoutForbiddenOverlap(candidates, forbiddenMask) {
	if (!forbiddenMask) {
		return candidates;
	}

	const labelClearCandidates = candidates.filter((candidate) => (
		maskOverlap(candidate.sourceMask, forbiddenMask) === 0
	));

	return labelClearCandidates.length ? labelClearCandidates : candidates;
}

function coordinatedScaleScore(candidate, candidatesByMatch, selectedIndexes, matchIndex, forbiddenMask) {
	const overlapPenalty = candidatesByMatch.reduce((total, otherCandidates, otherIndex) => {
		if (otherIndex === matchIndex) {
			return total;
		}

		const other = otherCandidates[selectedIndexes[otherIndex]];
		const actualOverlap = maskOverlap(candidate.sourceMask, other.sourceMask);
		const expectedOverlap = maskOverlap(candidate.referenceMask, other.referenceMask);
		const excessOverlap = Math.max(0, actualOverlap - expectedOverlap);
		const overlapRatio = excessOverlap / Math.max(1, Math.min(candidate.sourceArea, other.sourceArea));

		return total + overlapRatio;
	}, 0);
	const forbiddenPenalty = forbiddenMask
		? maskOverlap(candidate.sourceMask, forbiddenMask) / Math.max(1, candidate.sourceArea)
		: 0;

	return candidate.overlapScore - (overlapPenalty * 1.25) - (forbiddenPenalty * 3);
}

function scaleCandidates(sourceBounds, targetBounds) {
	const scaleX = targetBounds.width / sourceBounds.width;
	const scaleY = targetBounds.height / sourceBounds.height;
	const minScale = Math.min(scaleX, scaleY);
	const maxScale = Math.max(scaleX, scaleY);
	const centerScale = Math.sqrt(scaleX * scaleY);
	const steps = 10;
	const shrinkSteps = 6;
	const minShrinkRatio = 0.72;
	const candidates = new Set([
		roundScale(minScale),
		roundScale(centerScale),
		roundScale(maxScale),
	]);

	for (let index = 1; index < steps; index += 1) {
		const ratio = index / steps;
		candidates.add(roundScale(minScale + ((maxScale - minScale) * ratio)));
	}

	for (let index = 0; index < shrinkSteps; index += 1) {
		const ratio = minShrinkRatio + (((1 - minShrinkRatio) * index) / shrinkSteps);
		candidates.add(roundScale(minScale * ratio));
	}

	return [...candidates].filter((scale) => Number.isFinite(scale) && scale > 0);
}

function distributedTargetBounds(sourceBounds, targetBounds, scale, distribution) {
	if (!distribution || distribution.horizontalCount <= 1) {
		return targetBounds;
	}

	const scaledWidth = sourceBounds.width * scale;
	const targetCenterX = distributedCenterX(targetBounds, scaledWidth, distribution);
	const widthOffset = scaledWidth / 2;

	return {
		...targetBounds,
		left: targetCenterX - widthOffset,
		right: targetCenterX + widthOffset,
		width: scaledWidth,
	};
}

function distributedCenterX(targetBounds, scaledWidth, distribution) {
	const { horizontalIndex, horizontalCount, bounds } = distribution;

	if (horizontalIndex <= 0) {
		return bounds.left + (scaledWidth / 2);
	}

	if (horizontalIndex >= horizontalCount - 1) {
		return bounds.right - (scaledWidth / 2);
	}

	const span = bounds.right - bounds.left;
	const ratio = horizontalIndex / (horizontalCount - 1);

	return bounds.left + (span * ratio);
}

function scorePixelOverlap(sourceMask, referenceMask) {
	let intersection = 0;
	let union = 0;

	for (let index = 0; index < referenceMask.length; index += 1) {
		const sourceVisible = sourceMask[index] > 20;
		const referenceVisible = referenceMask[index] > 20;

		if (sourceVisible && referenceVisible) {
			intersection += 1;
		}
		if (sourceVisible || referenceVisible) {
			union += 1;
		}
	}

	return union === 0 ? 0 : intersection / union;
}

function maskArea(mask) {
	let area = 0;

	for (let index = 0; index < mask.length; index += 1) {
		if (mask[index] > 20) {
			area += 1;
		}
	}

	return area;
}

function maskOverlap(left, right) {
	let overlap = 0;

	for (let index = 0; index < left.length; index += 1) {
		if (left[index] > 20 && right[index] > 20) {
			overlap += 1;
		}
	}

	return overlap;
}

async function renderSourceGroupMask(sourceGroup, matrix) {
	const paths = sourceGroup.components.map((component) => {
		const transform = composeMatrices(matrix, component.transform || { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
		return `<path fill="#000" transform="${matrixToString(transform)}" d="${escapeAttribute(component.pathData)}"/>`;
	}).join('\n');
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGE_FACE_CANVAS.width}" height="${LARGE_FACE_CANVAS.height}" viewBox="${FACE_VIEWBOX}">
${paths}
</svg>`;
	const raw = await sharp(Buffer.from(svg))
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const mask = new Uint8Array(raw.info.width * raw.info.height);

	for (let index = 0; index < mask.length; index += 1) {
		mask[index] = raw.data[(index * 4) + 3];
	}

	return mask;
}

async function renderSvgFragmentMask(fragment) {
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGE_FACE_CANVAS.width}" height="${LARGE_FACE_CANVAS.height}" viewBox="${FACE_VIEWBOX}">
${fragment}
</svg>`;
	const raw = await sharp(Buffer.from(svg))
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const mask = new Uint8Array(raw.info.width * raw.info.height);

	for (let index = 0; index < mask.length; index += 1) {
		mask[index] = raw.data[(index * 4) + 3];
	}

	return mask;
}

function renderReferenceGroupMask(image, referenceGroup) {
	const mask = new Uint8Array(image.width * image.height);
	const boundsList = referenceGroup.components.map(matchBounds);

	for (const bounds of boundsList) {
		for (let y = Math.max(0, bounds.top); y <= Math.min(image.height - 1, bounds.bottom); y += 1) {
			for (let x = Math.max(0, bounds.left); x <= Math.min(image.width - 1, bounds.right); x += 1) {
				const index = (y * image.width) + x;
				mask[index] = image.data[(index * 4) + 3] > 20 ? 255 : mask[index];
			}
		}
	}

	return mask;
}

function matchBounds(item) {
	return item.bounds || item;
}

function boundsArea(bounds) {
	return bounds ? bounds.width * bounds.height : 0;
}

function normalizedArea(component, outerBounds) {
	const bounds = matchBounds(component);
	const area = component.pixels || component.area || boundsArea(bounds);
	return area / Math.max(1, boundsArea(outerBounds));
}

function makeLocalGroup(components) {
	const bounds = unionBounds(components.map(matchBounds));

	return {
		components,
		bounds,
		center: {
			x: bounds.left + (bounds.width / 2),
			y: bounds.top + (bounds.height / 2),
		},
		dominantColor: dominantLocalColor(components),
	};
}

function dominantLocalColor(components) {
	const colorWeights = new Map();

	for (const component of components) {
		const color = component.dominantColor || rawSourcePaintColor(component);
		if (!color) {
			continue;
		}
		colorWeights.set(color, (colorWeights.get(color) || 0) + (component.pixels || component.area || 1));
	}

	return [...colorWeights.entries()]
		.sort((left, right) => right[1] - left[1])[0]?.[0] || null;
}

function compareGroupPosition(left, right) {
	return left.center.y - right.center.y || left.center.x - right.center.x;
}

function compareComponentPosition(left, right) {
	const leftBounds = matchBounds(left);
	const rightBounds = matchBounds(right);
	const leftCenterY = left.center?.y ?? (leftBounds.top + (leftBounds.height / 2));
	const rightCenterY = right.center?.y ?? (rightBounds.top + (rightBounds.height / 2));
	const leftCenterX = left.center?.x ?? (leftBounds.left + (leftBounds.width / 2));
	const rightCenterX = right.center?.x ?? (rightBounds.left + (rightBounds.width / 2));

	return leftCenterY - rightCenterY || leftCenterX - rightCenterX;
}

function normalizedCenter(group, bounds) {
	return {
		x: (group.center.x - bounds.left) / Math.max(1, bounds.width),
		y: (group.center.y - bounds.top) / Math.max(1, bounds.height),
	};
}

function distance(left, right) {
	return Math.hypot(left.x - right.x, left.y - right.y);
}

function roundScale(value) {
	return Number(value.toFixed(6));
}

function outputPaintColor(component, referenceColor) {
	if (!recolorComponents()) {
		return rawSourcePaintColor(component);
	}

	const paletteKey = componentPaletteKey(component);

	if (overlapPaletteColors.has(paletteKey)) {
		return overlapPaletteColors.get(paletteKey);
	}

	return Colors.interpolatedPaletteColor(rawSourcePaintColor(component), referenceColor, {
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
		rawSourcePaintColor(component) ?? '',
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

function recolorComponents() {
	return metadata.recolorComponents !== false;
}

function rawSourcePaintColor(component) {
	return isPaint(component.fill) ? component.fill : component.stroke;
}

function canonicalSourcePaintColor(component) {
	const paint = isPaint(component.fill) ? component.fill : component.stroke;
	const rgb = parsePaintRgb(paint);

	return rgb ? canonicalSourcePaletteColor(rgb) : paint;
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

function markSourceBackgroundKnockouts(components) {
	const backgroundColors = sourceBackgroundColors(components);

	if (backgroundColors.size === 0) {
		return components;
	}

	return components.map((component) => ({
		...component,
		negativeSpaceCandidate: component.negativeSpaceCandidate || backgroundColors.has(componentPaint(component)),
	}));
}

function sourceBackgroundColors(components) {
	return new Set([
		...metadataBackgroundColors(),
		...components
			.filter((component) => component.tileLayerCandidate)
			.map(componentPaint)
			.filter(Boolean),
	]);
}

function metadataBackgroundColors() {
	const values = [
		metadata.sourceBackgroundColor,
		metadata.sourceTileBackgroundColor,
		metadata.tileBackgroundColor,
		...(metadata.sourceBackgroundColors || []),
		...(metadata.sourceTileBackgroundColors || []),
		...(metadata.tileBackgroundColors || []),
	];

	return values
		.map((value) => typeof value === 'string' ? value.trim().toLowerCase() : null)
		.filter(Boolean);
}

function componentPaint(component) {
	return (isPaint(component.fill) ? component.fill : component.stroke)?.toLowerCase() || null;
}

function makeLabelPath(font, metadata, labelComponent) {
	const targetBounds = labelComponent || metadata.referenceGlyphs?.number?.bounds;

	if (!targetBounds) {
		throw new Error(`Cannot place label for ${FACE_KEY}; reference top-label component was not found.`);
	}

	const pathData = font.getPath(metadata.labelText, 0, 0, 20).toPathData(3);
	const labelItem = new paper.CompoundPath(pathData);
	const bounds = labelItem.bounds;
	labelItem.remove();
	const target = referencePixelsToViewBox(targetBounds);
	const scaleX = target.width / bounds.width;
	const scaleY = target.height / bounds.height;
	const translateX = target.left - (bounds.left * scaleX);
	const translateY = target.top - (bounds.top * scaleY);
	const transform = `matrix(${format(scaleX)} 0 0 ${format(scaleY)} ${format(translateX)} ${format(translateY)})`;

	const fill = glyphOutputColor('number')
		|| labelComponent?.dominantColor
		|| metadata.referenceGlyphs?.number?.color
		|| metadata.labelColor;

	return `<path fill="${fill}" data-generated-font="Gluten 800" transform="${transform}" d="${pathData}"/>`;
}

function glyphOutputColor(name) {
	return metadata.glyphOutputColors?.[name] || null;
}

function referencePixelsToViewBox(bounds) {
	const scaleX = 94 / LARGE_FACE_CANVAS.width;
	const scaleY = 136 / LARGE_FACE_CANVAS.height;

	return {
		left: bounds.left * scaleX,
		top: bounds.top * scaleY,
		right: bounds.right * scaleX,
		bottom: bounds.bottom * scaleY,
		width: bounds.width * scaleX,
		height: bounds.height * scaleY,
	};
}

function selectPaintComponents(components) {
	return components
		.filter((component) => !component.tileLayerCandidate)
		.filter((component) => !component.negativeSpaceCandidate)
		.filter((component) => isPaint(component.fill) || isPaint(component.stroke))
		.filter((component) => component.area >= 20)
		.sort((left, right) => left.center.y - right.center.y || left.center.x - right.center.x);
}

function isPaint(value) {
	return value && value !== 'none' && !String(value).startsWith('url(');
}

function parsePaintRgb(paint) {
	if (!paint || paint === 'black') {
		return paint === 'black' ? [0, 0, 0] : null;
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

function isRelatedToGroup(group, cutout) {
	return group.components.some((component) => {
		const bounds = component.bounds;
		return cutout.area < component.area
			&& cutout.center.x >= bounds.left
			&& cutout.center.x <= bounds.right
			&& cutout.center.y >= bounds.top
			&& cutout.center.y <= bounds.bottom;
	});
}

function loadMetadata(faceKey) {
	const metadata = loadFacePreprocessingMetadataEntry(faceKey);

	if (!metadata) {
		throw new Error(`No face preprocessing metadata found for ${faceKey}.`);
	}

	return {
		sourceContainsLabel: false,
		...metadata,
	};
}

function removeReferenceLabelComponents(components, metadata) {
	const labelBounds = metadata.referenceGlyphs?.number?.bounds;

	if (!labelBounds) {
		return components;
	}

	return components.filter((component) => !boundsMatchReviewedGlyph(component, labelBounds));
}

function sourceNumberPresent(metadata) {
	return metadata.glyphLayout?.number?.sourcePresent ?? metadata.sourceContainsLabel;
}

function glyphOutputPresent(name, fallback) {
	return metadata.glyphLayout?.[name]?.outputPresent ?? fallback;
}

function boundsMatchReviewedGlyph(component, glyphBounds) {
	const intersection = intersectBounds(component, glyphBounds);

	if (!intersection) {
		return false;
	}

	const intersectionArea = intersection.width * intersection.height;
	const componentArea = Math.max(1, component.bounds ? component.bounds.width * component.bounds.height : component.area || 1);
	const glyphArea = Math.max(1, glyphBounds.width * glyphBounds.height);

	return intersectionArea / Math.min(componentArea, glyphArea) > 0.72;
}

function intersectBounds(left, right) {
	const leftBounds = left.bounds || left;
	const intersection = {
		left: Math.max(leftBounds.left, right.left),
		top: Math.max(leftBounds.top, right.top),
		right: Math.min(leftBounds.right, right.right),
		bottom: Math.min(leftBounds.bottom, right.bottom),
	};
	intersection.width = intersection.right - intersection.left;
	intersection.height = intersection.bottom - intersection.top;

	if (intersection.width <= 0 || intersection.height <= 0) {
		return null;
	}

	return intersection;
}

async function removeSourceLabelComponents(components, metadata, font) {
	if (!metadata.labelText) {
		return components;
	}

	const metadataLabel = findSourceLabelComponentByBounds(components, metadata);
	if (metadataLabel) {
		console.warn(`Removed source label component for ${FACE_KEY} using metadata bounds.`);
		return components.filter((component) => component !== metadataLabel);
	}

	const scored = await Promise.all(components.map(async (component) => ({
		component,
		score: await scoreGlyphLikeComponent(component, components, metadata.labelText, font),
	})));
	const best = scored
		.filter((entry) => Number.isFinite(entry.score))
		.sort((left, right) => right.score - left.score)[0];

	if (!best || best.score < 0.24) {
		console.warn(`sourceContainsLabel is true for ${FACE_KEY}, but no source label component matched "${metadata.labelText}". Keeping all source artwork.`);
		return components;
	}

	console.warn(`Removed source label component for ${FACE_KEY} with glyph score ${format(best.score)}.`);
	return components.filter((component) => component !== best.component);
}

function findSourceLabelComponentByBounds(components, metadata) {
	const sourceBounds = metadata.glyphLayout?.number?.sourceBounds;
	if (!sourceBounds) {
		return null;
	}

	return components
		.map((component) => ({
			component,
			score: boundsDistance(component.bounds, sourceBounds),
		}))
		.filter((candidate) => candidate.score < 2)
		.sort((left, right) => left.score - right.score)[0]?.component || null;
}

function boundsDistance(left, right) {
	return Math.abs(left.left - right.left)
		+ Math.abs(left.top - right.top)
		+ Math.abs(left.right - right.right)
		+ Math.abs(left.bottom - right.bottom);
}

async function scoreGlyphLikeComponent(component, allComponents, labelText, font) {
	const componentMask = await renderComponentMask(component);
	const glyphMask = await renderGlyphMask(labelText, font);
	const overlapScore = maskIntersectionOverUnion(componentMask, glyphMask);
	const aspectScore = scoreAspectSimilarity(component.bounds, getGlyphBounds(labelText, font));
	const uniquenessScore = scoreComponentUniqueness(component, allComponents);

	return (overlapScore * 0.62)
		+ (aspectScore * 0.23)
		+ (uniquenessScore * 0.15);
}

async function renderComponentMask(component) {
	const pathData = transformComponentPath(component);
	const bounds = component.bounds;
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="${bounds.left} ${bounds.top} ${Math.max(bounds.width, 0.001)} ${Math.max(bounds.height, 0.001)}"><path fill="#000000" d="${escapeAttribute(pathData)}"/></svg>`;

	return renderAlphaMask(svg);
}

async function renderGlyphMask(labelText, font) {
	const pathData = font.getPath(labelText, 0, 0, 72).toPathData(3);
	const bounds = getPathBounds(pathData);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="${bounds.left} ${bounds.top} ${Math.max(bounds.width, 0.001)} ${Math.max(bounds.height, 0.001)}"><path fill="#000000" d="${escapeAttribute(pathData)}"/></svg>`;

	return renderAlphaMask(svg);
}

async function renderAlphaMask(svg) {
	const raw = await sharp(Buffer.from(svg))
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const pixels = raw.data;
	const mask = new Uint8Array(raw.info.width * raw.info.height);

	for (let index = 0; index < mask.length; index += 1) {
		mask[index] = pixels[(index * 4) + 3] > 24 ? 1 : 0;
	}

	return mask;
}

function maskIntersectionOverUnion(left, right) {
	let intersection = 0;
	let union = 0;

	for (let index = 0; index < left.length; index += 1) {
		if (left[index] && right[index]) {
			intersection += 1;
		}
		if (left[index] || right[index]) {
			union += 1;
		}
	}

	return union === 0 ? 0 : intersection / union;
}

function scoreAspectSimilarity(componentBounds, glyphBounds) {
	const componentAspect = componentBounds.width / componentBounds.height;
	const glyphAspect = glyphBounds.width / glyphBounds.height;
	const ratio = Math.min(componentAspect, glyphAspect) / Math.max(componentAspect, glyphAspect);

	return Number.isFinite(ratio) ? ratio : 0;
}

function scoreComponentUniqueness(component, allComponents) {
	const similar = allComponents.filter((other) => {
		if (other === component) {
			return false;
		}

		const widthRatio = Math.min(component.bounds.width, other.bounds.width)
			/ Math.max(component.bounds.width, other.bounds.width);
		const heightRatio = Math.min(component.bounds.height, other.bounds.height)
			/ Math.max(component.bounds.height, other.bounds.height);

		return widthRatio > 0.82 && heightRatio > 0.82;
	});

	return similar.length === 0 ? 1 : 1 / (similar.length + 1);
}

function getGlyphBounds(labelText, font) {
	return getPathBounds(font.getPath(labelText, 0, 0, 72).toPathData(3));
}

function getPathBounds(pathData) {
	const item = new paper.CompoundPath(pathData);
	const bounds = {
		left: item.bounds.left,
		top: item.bounds.top,
		width: item.bounds.width,
		height: item.bounds.height,
	};
	item.remove();
	return bounds;
}

function indent(value, depth) {
	const prefix = '\t'.repeat(depth);
	return value
		.split('\n')
		.map((line) => line.trim() ? `${prefix}${line}` : line)
		.join('\n');
}

function format(value) {
	return Number(value.toFixed(6)).toString();
}

function escapeAttribute(value) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

