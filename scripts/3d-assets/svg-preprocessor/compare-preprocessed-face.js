import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import {
	getFacePaths,
	normalizePath,
	validatePreprocessedFace,
	writeJson,
} from './preprocessed-face-validation-utils.js';

const faceKey = process.argv[2];

if (!faceKey) {
	console.error('Usage: node scripts/3d-assets/svg-preprocessor/compare-preprocessed-face.js <face-key>');
	process.exit(1);
}

const paths = getFacePaths(faceKey);
const staticReport = validatePreprocessedFace(faceKey);

if (staticReport.static.errors.length > 0) {
	staticReport.outputs.validationReport = normalizePath(paths.report);
	writeJson(paths.report, staticReport);
	console.error(`Static validation failed for ${faceKey}; wrote ${path.relative(process.cwd(), paths.report)}`);
	for (const error of staticReport.static.errors) {
		console.error(`- ${error.code}: ${error.message}`);
	}
	process.exit(1);
}

fs.mkdirSync(path.dirname(paths.report), { recursive: true });

const referenceImage = await readRgba(paths.referencePng);
const svgSource = fs.readFileSync(paths.preprocessedSvg, 'utf8');
const rawSourceSvg = fs.existsSync(paths.sourceSvg)
	? fs.readFileSync(paths.sourceSvg, 'utf8')
	: null;
const sourceImage = rawSourceSvg
	? await renderSourceSvg(rawSourceSvg, referenceImage.height, referenceImage.width)
	: null;
const svgImage = await renderSvg(svgSource, referenceImage.width, referenceImage.height);
const renderedGroups = await renderGroups(svgSource, referenceImage.width, referenceImage.height);
const groupBounds = Object.fromEntries(Object.entries(renderedGroups).map(([id, group]) => [id, group.bounds]));
const referenceBounds = getAlphaBounds(referenceImage.data, referenceImage.width, referenceImage.height);
const referenceComponents = getAlphaComponents(referenceImage.data, referenceImage.width, referenceImage.height);
const svgBounds = getAlphaBounds(svgImage.data, svgImage.width, svgImage.height);
const svgComponents = getAlphaComponents(svgImage.data, svgImage.width, svgImage.height);
const mainGroupId = findMainGroupId(groupBounds);
const labelBounds = findLabelBounds(groupBounds);
const mainArtworkBounds = mainGroupId ? groupBounds[mainGroupId] : svgBounds;
const topLabelId = Object.keys(labelBounds).find((id) => id === 'label' || id === 'number' || id === 'wind-label')
	|| Object.keys(labelBounds)[0]
	|| null;
const topLabelBounds = topLabelId ? groupBounds[topLabelId] : null;
const referenceTopLabelBounds = findReferenceTopLabelBounds(referenceComponents, topLabelBounds);
const referenceMainArtworkBounds = findReferenceMainArtworkBounds({
	mainGroupId,
	referenceBounds,
	referenceComponents,
	referenceTopLabelBounds,
});
const artworkReferenceBounds = referenceMainArtworkBounds || referenceBounds;
const overlapDetails = findPixelLabelOverlaps(svgImage, renderedGroups, labelBounds);
const overlaps = overlapDetails.map((detail) => detail.id);
const blockingOverlaps = isAllowedLabelOverlapFace(faceKey) ? [] : overlaps;

await writeRgbaPng(paths.sideBySide, makeSideBySide(referenceImage, svgImage));
if (sourceImage) {
	await writeRgbaPng(paths.sourceReferenceResult, makeSourceReferenceResult(sourceImage, referenceImage, svgImage));
}
await writeRgbaPng(paths.overlay, makeOverlay(referenceImage, svgImage, {
	referenceBounds,
	mainArtworkBounds,
	labelBounds,
	referenceComponents,
	svgComponents,
}));
await writeRgbaPng(paths.diff, makeDiff(referenceImage, svgImage));

const notes = [];
if (!mainGroupId) {
	notes.push('No conventional main artwork group was found; using full rendered SVG visible bounds.');
}
if (overlaps.length > 0) {
	notes.push(`Main artwork pixels overlap label group(s): ${overlaps.join(', ')}.`);
}

const report = {
	...staticReport,
	status: blockingOverlaps.length > 0 ? 'blocked-overlap' : staticReport.status,
	reference: {
		...staticReport.reference,
		sourceSvg: rawSourceSvg ? normalizePath(paths.sourceSvg) : null,
		canvas: {
			width: referenceImage.width,
			height: referenceImage.height,
		},
		bounds: referenceBounds,
		components: referenceComponents,
		topLabelBounds: referenceTopLabelBounds,
		mainArtworkBounds: referenceMainArtworkBounds,
	},
	svg: {
		...staticReport.svg,
		renderedBounds: svgBounds,
		components: svgComponents,
		groups: mergeGroupReports(staticReport.svg.groups, groupBounds),
		mainGroupId,
		mainArtworkBounds,
		topLabelId,
		topLabelBounds,
		labelBounds,
	},
	comparison: {
		artworkBottomAligned: boundsDeltas(mainArtworkBounds, artworkReferenceBounds)?.bottom === 0,
		artworkLeftAligned: boundsDeltas(mainArtworkBounds, artworkReferenceBounds)?.left === 0,
		artworkRightAligned: boundsDeltas(mainArtworkBounds, artworkReferenceBounds)?.right === 0,
		topLabelAligned: boundsDeltas(topLabelBounds, referenceTopLabelBounds || referenceBounds)?.top === 0,
		labelOverlap: blockingOverlaps.length > 0,
		artworkDeltas: boundsDeltas(mainArtworkBounds, artworkReferenceBounds),
		topLabelDeltas: boundsDeltas(topLabelBounds, referenceTopLabelBounds || referenceBounds),
		artworkReferenceBounds,
		overlaps,
		blockingOverlaps,
		overlapDetails,
		notes,
	},
	outputs: {
		sideBySide: normalizePath(paths.sideBySide),
		sourceReferenceResult: sourceImage ? normalizePath(paths.sourceReferenceResult) : null,
		overlay: normalizePath(paths.overlay),
		diff: normalizePath(paths.diff),
		validationReport: normalizePath(paths.report),
	},
};

writeJson(paths.report, report);

console.log(`Wrote ${path.relative(process.cwd(), paths.sideBySide)}`);
if (sourceImage) {
	console.log(`Wrote ${path.relative(process.cwd(), paths.sourceReferenceResult)}`);
}
console.log(`Wrote ${path.relative(process.cwd(), paths.overlay)}`);
console.log(`Wrote ${path.relative(process.cwd(), paths.diff)}`);
console.log(`Wrote ${path.relative(process.cwd(), paths.report)}`);
console.log(`Comparison status for ${faceKey}: ${report.status}`);

if (report.status.startsWith('blocked') || report.status === 'failed-static-validation') {
	process.exit(1);
}

async function readRgba(filePath) {
	const metadata = await sharp(filePath).metadata();
	const data = await sharp(filePath)
		.ensureAlpha()
		.raw()
		.toBuffer();

	return {
		width: metadata.width,
		height: metadata.height,
		data,
	};
}

async function renderSvg(svgSourceToRender, width, height) {
	const data = await sharp(Buffer.from(svgSourceToRender))
		.resize(width, height, { fit: 'fill' })
		.ensureAlpha()
		.raw()
		.toBuffer();

	return { width, height, data };
}

async function renderSourceSvg(svgSourceToRender, height, fallbackWidth) {
	const aspectRatio = readSvgAspectRatio(svgSourceToRender);
	const width = aspectRatio
		? Math.max(1, Math.round(height * aspectRatio))
		: fallbackWidth;

	const data = await sharp(Buffer.from(sanitizeRawSourceSvg(svgSourceToRender)))
		.resize(width, height, {
			fit: 'contain',
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		})
		.ensureAlpha()
		.raw()
		.toBuffer();

	return { width, height, data };
}

function readSvgAspectRatio(svgSourceToRender) {
	const viewBoxMatch = svgSourceToRender.match(/\bviewBox\s*=\s*"([^"]+)"/i);

	if (viewBoxMatch) {
		const values = viewBoxMatch[1].trim().split(/[\s,]+/).map((value) => Number.parseFloat(value));

		if (values.length === 4 && values[2] > 0 && values[3] > 0) {
			return values[2] / values[3];
		}
	}

	const width = readSvgLength(svgSourceToRender, 'width');
	const height = readSvgLength(svgSourceToRender, 'height');

	return width && height ? width / height : null;
}

function readSvgLength(svgSourceToRender, name) {
	const match = svgSourceToRender.match(new RegExp(`\\b${name}\\s*=\\s*"([0-9.]+)`, 'i'));
	return match ? Number.parseFloat(match[1]) : null;
}

function sanitizeRawSourceSvg(svgSourceToRender) {
	return svgSourceToRender
		.replace(/<!DOCTYPE[\s\S]*?\]>/i, '')
		.replace(/xmlns:x="&ns_extend;"/g, 'xmlns:x="http://ns.adobe.com/Extensibility/1.0/"')
		.replace(/xmlns:i="&ns_ai;"/g, 'xmlns:i="http://ns.adobe.com/AdobeIllustrator/10.0/"')
		.replace(/xmlns:graph="&ns_graphs;"/g, 'xmlns:graph="http://ns.adobe.com/Graphs/1.0/"')
		.replace(/requiredExtensions="&ns_ai;"/g, 'requiredExtensions="http://ns.adobe.com/AdobeIllustrator/10.0/"');
}

async function writeRgbaPng(outputPath, image) {
	await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
	await sharp(image.data, {
		raw: {
			width: image.width,
			height: image.height,
			channels: 4,
		},
	}).png().toFile(outputPath);
}

async function renderGroups(svgSourceToRender, width, height) {
	const groups = extractGroups(svgSourceToRender);
	const renderedGroups = {};

	for (const group of groups) {
		try {
			const groupSvg = makeGroupSvg(svgSourceToRender, group.markup);
			const groupImage = await renderSvg(groupSvg, width, height);
			const groupBounds = getAlphaBounds(groupImage.data, width, height);

			if (groupBounds) {
				renderedGroups[group.id] = {
					bounds: groupBounds,
					image: groupImage,
				};
			}
		} catch (error) {
			renderedGroups[group.id] = {
				bounds: null,
				image: null,
			};
		}
	}

	return renderedGroups;
}

function extractGroups(svgSourceToParse) {
	const groups = [];
	const groupStartPattern = /<g\b[^>]*\bid\s*=\s*"([^"]+)"[^>]*>/gi;
	let match;

	while ((match = groupStartPattern.exec(svgSourceToParse)) !== null) {
		const start = match.index;
		const end = findGroupEnd(svgSourceToParse, groupStartPattern.lastIndex);

		if (end) {
			groups.push({
				id: match[1],
				markup: svgSourceToParse.slice(start, end),
			});
		}
	}

	return groups;
}

function findGroupEnd(svgSourceToParse, startIndex) {
	const tagPattern = /<\/?g\b[^>]*>/gi;
	tagPattern.lastIndex = startIndex;
	let depth = 1;
	let match;

	while ((match = tagPattern.exec(svgSourceToParse)) !== null) {
		if (match[0].startsWith('</')) {
			depth -= 1;
		} else if (!match[0].endsWith('/>')) {
			depth += 1;
		}

		if (depth === 0) {
			return tagPattern.lastIndex;
		}
	}

	return null;
}

function makeGroupSvg(svgSourceToParse, groupMarkup) {
	const openTag = svgSourceToParse.match(/<svg\b[^>]*>/i)?.[0] || '<svg viewBox="0 0 94 136">';
	const defsAndStyles = [...svgSourceToParse.matchAll(/<(?:defs|style)\b[\s\S]*?<\/(?:defs|style)>/gi)]
		.map((match) => match[0])
		.join('\n');

	return `${openTag}\n${defsAndStyles}\n${groupMarkup}\n</svg>`;
}

function getAlphaBounds(data, width, height) {
	let left = width;
	let top = height;
	let right = -1;
	let bottom = -1;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const alpha = data[((y * width + x) * 4) + 3];
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
		return null;
	}

	return {
		left,
		top,
		right,
		bottom,
		width: right - left + 1,
		height: bottom - top + 1,
	};
}

function getAlphaComponents(data, width, height) {
	const visible = new Uint8Array(width * height);
	const seen = new Uint8Array(width * height);
	const components = [];

	for (let index = 0; index < width * height; index += 1) {
		if (data[(index * 4) + 3] > 8) {
			visible[index] = 1;
		}
	}

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const index = y * width + x;

			if (!visible[index] || seen[index]) {
				continue;
			}

			const queue = [[x, y]];
			let left = x;
			let top = y;
			let right = x;
			let bottom = y;
			let pixels = 0;
			seen[index] = 1;

			for (let cursor = 0; cursor < queue.length; cursor += 1) {
				const [currentX, currentY] = queue[cursor];
				pixels += 1;
				left = Math.min(left, currentX);
				top = Math.min(top, currentY);
				right = Math.max(right, currentX);
				bottom = Math.max(bottom, currentY);

				for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
					const nextX = currentX + dx;
					const nextY = currentY + dy;

					if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) {
						continue;
					}

					const nextIndex = nextY * width + nextX;

					if (visible[nextIndex] && !seen[nextIndex]) {
						seen[nextIndex] = 1;
						queue.push([nextX, nextY]);
					}
				}
			}

			components.push({
				pixels,
				left,
				top,
				right,
				bottom,
				width: right - left + 1,
				height: bottom - top + 1,
			});
		}
	}

	return components.sort((left, right) => right.pixels - left.pixels);
}

function findMainGroupId(groupBounds) {
	const names = [
		'suit-art',
		'bamboo-8-face-art',
		'dots-2-face-art',
		'dots-5-face-art',
		'dots-7-face-art',
		'flower-and-stem',
		'botanical-art',
		'season-art',
		'character-art',
		'dragon-art',
		'primary-art',
		'face-art',
		'artwork',
	];

	return names.find((name) => groupBounds[name])
		|| Object.keys(groupBounds).find((name) => /^dots-\d+-face-art$/.test(name) && groupBounds[name])
		|| Object.keys(groupBounds).find((name) => /^characters-\d+-face-art$/.test(name) && groupBounds[name])
		|| null;
}

function findReferenceTopLabelBounds(referenceComponents, topLabelBounds) {
	if (!topLabelBounds) {
		return null;
	}

	const topLabelCenterX = (topLabelBounds.left + topLabelBounds.right) / 2;
	const topLabelCenterY = (topLabelBounds.top + topLabelBounds.bottom) / 2;
	const candidates = topLabelBounds.top > 70
		? referenceComponents
		: referenceComponents.filter((component) => component.top <= topLabelBounds.top + 8);
	const topCandidates = candidates
		.sort((left, right) => {
			const leftDistance = Math.abs(((left.left + left.right) / 2) - topLabelCenterX);
			const rightDistance = Math.abs(((right.left + right.right) / 2) - topLabelCenterX);
			const leftYDistance = Math.abs(((left.top + left.bottom) / 2) - topLabelCenterY);
			const rightYDistance = Math.abs(((right.top + right.bottom) / 2) - topLabelCenterY);
			return (leftDistance + leftYDistance) - (rightDistance + rightYDistance) || left.pixels - right.pixels;
		});

	return topCandidates[0] || null;
}

function findReferenceMainArtworkBounds({
	mainGroupId,
	referenceBounds,
	referenceComponents,
	referenceTopLabelBounds,
}) {
	if (!mainGroupId || !isStandardSuitMainGroup(mainGroupId) || !referenceTopLabelBounds) {
		return null;
	}

	const artworkComponents = referenceComponents.filter((component) => component !== referenceTopLabelBounds);
	return unionBounds(artworkComponents) || referenceBounds;
}

function isStandardSuitMainGroup(groupId) {
	return groupId === 'suit-art'
		|| groupId === 'face-art'
		|| /^dots-\d+-face-art$/.test(groupId)
		|| /^characters-\d+-face-art$/.test(groupId);
}

function isAllowedLabelOverlapFace(key) {
	return key === 'b-8';
}

function findPixelLabelOverlaps(svgImageToCheck, renderedGroups, labels) {
	return Object.entries(labels)
		.map(([id]) => {
			const labelImage = renderedGroups[id]?.image;

			if (!labelImage) {
				return null;
			}

			const pixels = countNonLabelPixelsUnderLabel(svgImageToCheck.data, labelImage.data);

			return pixels > 0
				? { id, pixels }
				: null;
		})
		.filter(Boolean);
}

function countNonLabelPixelsUnderLabel(fullSvgData, labelData) {
	let pixels = 0;

	for (let index = 0; index < fullSvgData.length; index += 4) {
		const labelAlpha = labelData[index + 3];

		if (labelAlpha <= 8) {
			continue;
		}

		const fullAlpha = fullSvgData[index + 3];

		if (fullAlpha > labelAlpha + 8) {
			pixels += 1;
		}
	}

	return pixels;
}

function findLabelBounds(groupBounds) {
	const names = ['label', 'number', 'wind-label', 'character'];
	return Object.fromEntries(names.filter((name) => groupBounds[name]).map((name) => [name, groupBounds[name]]));
}

function makeSideBySide(referenceImage, svgImage) {
	const width = referenceImage.width * 2;
	const height = referenceImage.height;
	const data = makeChecker(width, height);

	blit(data, width, referenceImage.data, referenceImage.width, referenceImage.height, 0, 0, 1);
	blit(data, width, svgImage.data, svgImage.width, svgImage.height, referenceImage.width, 0, 1);

	for (let y = 0; y < height; y += 1) {
		writePixel(data, width, referenceImage.width - 1, y, 51, 51, 51, 255);
		writePixel(data, width, referenceImage.width, y, 51, 51, 51, 255);
	}

	return { width, height, data };
}

function makeSourceReferenceResult(sourceImage, referenceImage, svgImage) {
	const referenceOffsetX = sourceImage.width;
	const svgOffsetX = sourceImage.width + referenceImage.width;
	const width = sourceImage.width + referenceImage.width + svgImage.width;
	const height = referenceImage.height;
	const data = makeChecker(width, height);

	blit(data, width, sourceImage.data, sourceImage.width, sourceImage.height, 0, 0, 1);
	blit(data, width, referenceImage.data, referenceImage.width, referenceImage.height, referenceOffsetX, 0, 1);
	blit(data, width, svgImage.data, svgImage.width, svgImage.height, svgOffsetX, 0, 1);

	for (const x of [referenceOffsetX - 1, referenceOffsetX, svgOffsetX - 1, svgOffsetX]) {
		for (let y = 0; y < height; y += 1) {
			writePixel(data, width, x, y, 51, 51, 51, 255);
		}
	}

	return { width, height, data };
}

function makeOverlay(referenceImage, svgImage, {
	referenceBounds,
	mainArtworkBounds,
	labelBounds,
	referenceComponents,
	svgComponents,
}) {
	const data = makeChecker(referenceImage.width, referenceImage.height);
	blit(data, referenceImage.width, referenceImage.data, referenceImage.width, referenceImage.height, 0, 0, 0.45);
	blit(data, referenceImage.width, svgImage.data, svgImage.width, svgImage.height, 0, 0, 0.75);
	drawBounds(data, referenceImage.width, referenceImage.height, referenceBounds, [0, 170, 255, 255]);
	drawBounds(data, referenceImage.width, referenceImage.height, mainArtworkBounds, [255, 0, 255, 255]);
	drawComponentBounds(data, referenceImage.width, referenceImage.height, referenceComponents, [0, 190, 95, 255]);
	drawComponentBounds(data, referenceImage.width, referenceImage.height, svgComponents, [255, 140, 0, 255]);
	for (const bounds of Object.values(labelBounds)) {
		drawBounds(data, referenceImage.width, referenceImage.height, bounds, [255, 204, 0, 255]);
	}

	return {
		width: referenceImage.width,
		height: referenceImage.height,
		data,
	};
}

function drawComponentBounds(data, width, height, components, color) {
	for (const component of components) {
		if (component.pixels < 20) {
			continue;
		}

		drawBounds(data, width, height, component, color);
	}
}

function makeDiff(referenceImage, svgImage) {
	const data = Buffer.alloc(referenceImage.data.length);

	for (let index = 0; index < data.length; index += 4) {
		const referenceAlpha = referenceImage.data[index + 3] / 255;
		const svgAlpha = svgImage.data[index + 3] / 255;
		data[index] = Math.abs((referenceImage.data[index] * referenceAlpha) - (svgImage.data[index] * svgAlpha));
		data[index + 1] = Math.abs((referenceImage.data[index + 1] * referenceAlpha) - (svgImage.data[index + 1] * svgAlpha));
		data[index + 2] = Math.abs((referenceImage.data[index + 2] * referenceAlpha) - (svgImage.data[index + 2] * svgAlpha));
		data[index + 3] = Math.max(referenceImage.data[index + 3], svgImage.data[index + 3]);
	}

	return {
		width: referenceImage.width,
		height: referenceImage.height,
		data,
	};
}

function makeChecker(width, height) {
	const data = Buffer.alloc(width * height * 4);
	const size = 12;

	for (let y = 0; y < height; y += 1) {
		for (let x = 0; x < width; x += 1) {
			const dark = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0;
			const value = dark ? 220 : 249;
			writePixel(data, width, x, y, value, value, value, 255);
		}
	}

	return data;
}

function blit(target, targetWidth, source, sourceWidth, sourceHeight, offsetX, offsetY, opacity) {
	for (let y = 0; y < sourceHeight; y += 1) {
		for (let x = 0; x < sourceWidth; x += 1) {
			const sourceIndex = (y * sourceWidth + x) * 4;
			const alpha = (source[sourceIndex + 3] / 255) * opacity;

			if (alpha <= 0) {
				continue;
			}

			const targetIndex = (((y + offsetY) * targetWidth) + x + offsetX) * 4;
			const inverseAlpha = 1 - alpha;
			target[targetIndex] = Math.round(source[sourceIndex] * alpha + target[targetIndex] * inverseAlpha);
			target[targetIndex + 1] = Math.round(source[sourceIndex + 1] * alpha + target[targetIndex + 1] * inverseAlpha);
			target[targetIndex + 2] = Math.round(source[sourceIndex + 2] * alpha + target[targetIndex + 2] * inverseAlpha);
			target[targetIndex + 3] = 255;
		}
	}
}

function drawBounds(data, width, height, bounds, color) {
	if (!bounds) {
		return;
	}

	for (let x = bounds.left; x <= bounds.right; x += 1) {
		writePixelSafe(data, width, height, x, bounds.top, color);
		writePixelSafe(data, width, height, x, bounds.bottom, color);
	}

	for (let y = bounds.top; y <= bounds.bottom; y += 1) {
		writePixelSafe(data, width, height, bounds.left, y, color);
		writePixelSafe(data, width, height, bounds.right, y, color);
	}
}

function writePixelSafe(data, width, height, x, y, color) {
	if (x < 0 || y < 0 || x >= width || y >= height) {
		return;
	}

	writePixel(data, width, x, y, color[0], color[1], color[2], color[3]);
}

function writePixel(data, width, x, y, red, green, blue, alpha) {
	const index = (y * width + x) * 4;
	data[index] = red;
	data[index + 1] = green;
	data[index + 2] = blue;
	data[index + 3] = alpha;
}

function mergeGroupReports(staticGroups, renderedGroups) {
	const merged = {};
	const names = new Set([...Object.keys(staticGroups), ...Object.keys(renderedGroups)]);

	for (const name of names) {
		merged[name] = {
			...(staticGroups[name] || { present: false }),
			bounds: renderedGroups[name] || null,
		};
	}

	return merged;
}

function boundsDeltas(bounds, referenceBounds) {
	if (!bounds || !referenceBounds) {
		return null;
	}

	return {
		left: bounds.left - referenceBounds.left,
		top: bounds.top - referenceBounds.top,
		right: bounds.right - referenceBounds.right,
		bottom: bounds.bottom - referenceBounds.bottom,
		width: bounds.width - referenceBounds.width,
		height: bounds.height - referenceBounds.height,
	};
}

function unionBounds(boundsList) {
	const validBounds = boundsList.filter(Boolean);

	if (validBounds.length === 0) {
		return null;
	}

	const left = Math.min(...validBounds.map((bounds) => bounds.left));
	const top = Math.min(...validBounds.map((bounds) => bounds.top));
	const right = Math.max(...validBounds.map((bounds) => bounds.right));
	const bottom = Math.max(...validBounds.map((bounds) => bounds.bottom));

	return {
		left,
		top,
		right,
		bottom,
		width: right - left + 1,
		height: bottom - top + 1,
	};
}

