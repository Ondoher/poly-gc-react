import sharp from 'sharp';
import opentype from 'opentype.js';
import paper from 'paper';

export const STANDARD_PALETTE = Object.freeze([
	{ color: '#F6F610', rgb: [246, 246, 16] },
	{ color: '#FF9900', rgb: [255, 153, 0] },
	{ color: '#0505D1', rgb: [5, 5, 209] },
	{ color: '#2FC906', rgb: [47, 201, 6] },
	{ color: '#FC1D05', rgb: [252, 29, 5] },
	{ color: '#000000', rgb: [0, 0, 0] },
]);

export async function extractReferenceImageComponents(referencePath, options = {}) {
	const image = await readRgba(referencePath);
	const paletteOptions = {
		palette: options.palette,
		segmentationDistanceThreshold: options.segmentationDistanceThreshold,
	};
	const components = getAlphaComponents(image.data, image.width, image.height, { paletteOnly: true, ...paletteOptions })
		.filter((component) => component.pixels >= (options.minPixels || 20))
		.map((component) => ({
			...component,
			center: centerOf(component),
			area: component.width * component.height,
			dominantColor: sampleDominantColor(image, component, paletteOptions),
			colors: samplePaletteColors(image, component, paletteOptions),
		}));
	const labelComponent = await findLabelComponent(image, components, options);
	const artworkComponents = components.filter((component) => component !== labelComponent);

	return {
		image,
		canvas: { width: image.width, height: image.height },
		components,
		labelComponent,
		artworkComponents,
	};
}

export async function readRgba(filePath) {
	const { data, info } = await sharp(filePath)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });

	return {
		width: info.width,
		height: info.height,
		data,
	};
}

export function getAlphaComponents(data, width, height, options = {}) {
	const threshold = options.alphaThreshold ?? 8;
	const paletteOnly = options.paletteOnly ?? false;
	const palette = normalizePalette(options.palette);
	const segmentationDistanceThreshold = options.segmentationDistanceThreshold ?? 12000;
	const visible = new Uint8Array(width * height);
	const seen = new Uint8Array(width * height);
	const components = [];

	for (let index = 0; index < width * height; index += 1) {
		if (data[(index * 4) + 3] > threshold && (!paletteOnly || isPalettePixel(data, index, palette, segmentationDistanceThreshold))) {
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

					const nextIndex = (nextY * width) + nextX;

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

	return components.sort(compareByPosition);
}

export function sampleDominantColor(image, bounds, options = {}) {
	return samplePaletteColors(image, bounds, options)[0] || '#000000';
}

export function samplePaletteColors(image, bounds, options = {}) {
	const palette = normalizePalette(options.palette);
	const counts = new Map(palette.map(({ color }) => [color, 0]));

	for (let y = Math.max(0, bounds.top); y <= Math.min(image.height - 1, bounds.bottom); y += 1) {
		for (let x = Math.max(0, bounds.left); x <= Math.min(image.width - 1, bounds.right); x += 1) {
			const offset = ((y * image.width) + x) * 4;
			const alpha = image.data[offset + 3];

			if (alpha <= 20) {
				continue;
			}

			const color = nearestPaletteColor([
				image.data[offset],
				image.data[offset + 1],
				image.data[offset + 2],
			], palette);
			counts.set(color, counts.get(color) + 1);
		}
	}

	return [...counts.entries()]
		.filter((entry) => entry[1] > 0)
		.sort((left, right) => right[1] - left[1])
		.map((entry) => entry[0]);
}

export function nearestPaletteColor(rgb, palette = STANDARD_PALETTE) {
	return normalizePalette(palette)
		.map((entry) => ({
			color: entry.color,
			distance: square(rgb[0] - entry.rgb[0]) + square(rgb[1] - entry.rgb[1]) + square(rgb[2] - entry.rgb[2]),
		}))
		.sort((left, right) => left.distance - right.distance)[0].color;
}

function isPalettePixel(data, index, palette, segmentationDistanceThreshold) {
	const offset = index * 4;
	const rgb = [data[offset], data[offset + 1], data[offset + 2]];
	const distance = nearestPaletteDistance(rgb, palette);

	return distance <= segmentationDistanceThreshold;
}

function nearestPaletteDistance(rgb, palette = STANDARD_PALETTE) {
	return Math.min(...normalizePalette(palette).map((entry) => (
		square(rgb[0] - entry.rgb[0]) + square(rgb[1] - entry.rgb[1]) + square(rgb[2] - entry.rgb[2])
	)));
}

function normalizePalette(palette = STANDARD_PALETTE) {
	const colors = Array.isArray(palette) ? palette : palette?.colors;

	if (!Array.isArray(colors) || colors.length === 0) {
		return STANDARD_PALETTE;
	}

	return colors.map((entry) => ({
		color: entry.color,
		rgb: entry.rgb,
	}));
}

export async function findLabelComponent(image, components, options = {}) {
	const glyphMatch = await findGlyphLabelComponent(image, components, options);

	if (glyphMatch) {
		return glyphMatch;
	}

	if (options.labelText) {
		return null;
	}

	return findTopLabelComponent(components, options);
}

export function findTopLabelComponent(components, options = {}) {
	const candidates = components.filter((component) => component.top < 70 && component.left < 70);
	const labelColorCandidates = options.labelColor
		? components.filter((component) => component.dominantColor?.toLowerCase() === options.labelColor.toLowerCase())
		: [];

	if (labelColorCandidates.length > 0) {
		return labelColorCandidates
			.sort((left, right) => left.area - right.area || left.top - right.top || left.left - right.left)[0];
	}

	return candidates
		.sort((left, right) => left.top - right.top || left.left - right.left || left.pixels - right.pixels)[0]
		|| null;
}

async function findGlyphLabelComponent(image, components, options) {
	if (!options.labelText || !options.fontPath) {
		return null;
	}

	const candidates = components.filter((component) => isPlausibleLabelCandidate(component, image, options));
	const scored = await Promise.all(candidates.map(async (component) => ({
		component,
		score: await scoreGlyphCandidate(image, component, options, components),
	})));

	return scored
		.filter((entry) => entry.score >= (options.glyphScoreThreshold ?? 0.2))
		.sort((left, right) => right.score - left.score || left.component.pixels - right.component.pixels)[0]?.component
		|| null;
}

function isPlausibleLabelCandidate(component, image, options) {
	if (sizePlausibility(component, image) === 0) {
		return false;
	}

	if (options.labelLocation && !componentLocationMatches(component, image, options.labelLocation)) {
		return false;
	}

	if (options.labelColor && component.dominantColor?.toLowerCase() !== options.labelColor.toLowerCase()) {
		return false;
	}

	return true;
}

function componentLocationMatches(component, image, location) {
	const [vertical, horizontal] = location.split('-');
	const centerX = (component.left + (component.width / 2)) / image.width;
	const centerY = (component.top + (component.height / 2)) / image.height;
	const verticalMatches = vertical === 'top'
		? centerY < 0.36
		: vertical === 'bottom'
			? centerY > 0.64
			: centerY >= 0.30 && centerY <= 0.70;
	const horizontalMatches = horizontal === 'left'
		? centerX < 0.42
		: horizontal === 'right'
			? centerX > 0.58
			: centerX >= 0.30 && centerX <= 0.70;

	return verticalMatches && horizontalMatches;
}

async function scoreGlyphCandidate(image, component, options, components) {
	const candidateMask = await renderComponentMask(image, component);
	const glyphMask = await renderGlyphMask(options.labelText, options.fontPath, component.width, component.height);

	const shapeScore = maskIntersectionOverUnion(candidateMask, glyphMask);
	const aspectScore = aspectSimilarity(component, options.labelText);
	const sizeScore = sizePlausibility(component, image);

	if (sizeScore === 0) {
		return 0;
	}

	const uniquenessScore = componentUniqueness(component, components);
	const colorScore = options.labelColor
		? component.dominantColor?.toLowerCase() === options.labelColor.toLowerCase()
			? 1
			: 0
		: 0.5;

	return (shapeScore * 0.55)
		+ (aspectScore * 0.2)
		+ (sizeScore * 0.09)
		+ (uniquenessScore * 0.08)
		+ (colorScore * 0.08);
}

async function renderComponentMask(image, component) {
	const cropped = Buffer.alloc(component.width * component.height);

	for (let y = 0; y < component.height; y += 1) {
		for (let x = 0; x < component.width; x += 1) {
			const sourceX = component.left + x;
			const sourceY = component.top + y;
			const sourceIndex = ((sourceY * image.width) + sourceX) * 4;
			cropped[(y * component.width) + x] = image.data[sourceIndex + 3] > 20 ? 255 : 0;
		}
	}

	return sharp(cropped, {
		raw: {
			width: component.width,
			height: component.height,
			channels: 1,
		},
	})
		.resize(32, 32, { fit: 'fill' })
		.raw()
		.toBuffer();
}

async function renderGlyphMask(labelText, fontPath, targetWidth, targetHeight) {
	const font = opentype.loadSync(fontPath);
	const pathData = font.getPath(labelText, 0, 0, 72).toPathData(3);
	const item = new paper.CompoundPath(pathData);
	const bounds = item.bounds;
	item.remove();
	const padding = 4;
	const width = Math.max(1, targetWidth);
	const height = Math.max(1, targetHeight);
	const scale = Math.min((width - (padding * 2)) / bounds.width, (height - (padding * 2)) / bounds.height);
	const translateX = padding + ((width - (padding * 2) - (bounds.width * scale)) / 2) - (bounds.left * scale);
	const translateY = padding + ((height - (padding * 2) - (bounds.height * scale)) / 2) - (bounds.top * scale);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
	<path fill="#000" transform="matrix(${scale} 0 0 ${scale} ${translateX} ${translateY})" d="${pathData}"/>
</svg>`;

	return sharp(Buffer.from(svg))
		.resize(32, 32, { fit: 'fill' })
		.ensureAlpha()
		.raw()
		.toBuffer()
		.then((rgba) => {
			const mask = Buffer.alloc(32 * 32);
			for (let index = 0; index < mask.length; index += 1) {
				mask[index] = rgba[(index * 4) + 3] > 20 ? 255 : 0;
			}
			return mask;
		});
}

function maskIntersectionOverUnion(leftMask, rightMask) {
	let intersection = 0;
	let union = 0;

	for (let index = 0; index < leftMask.length; index += 1) {
		const leftVisible = leftMask[index] > 20;
		const rightVisible = rightMask[index] > 20;

		if (leftVisible && rightVisible) {
			intersection += 1;
		}

		if (leftVisible || rightVisible) {
			union += 1;
		}
	}

	return union === 0 ? 0 : intersection / union;
}

function aspectSimilarity(component, labelText) {
	const expectedAspect = /^[NSWE]$/i.test(labelText)
		? 0.65
		: labelText === '1'
			? 0.45
			: 0.6;
	const aspect = component.width / Math.max(1, component.height);
	const ratio = Math.min(aspect, expectedAspect) / Math.max(aspect, expectedAspect);

	return Math.max(0, Math.min(1, ratio));
}

function sizePlausibility(component, image) {
	const widthRatio = component.width / image.width;
	const heightRatio = component.height / image.height;
	const areaRatio = (component.width * component.height) / (image.width * image.height);

	if (widthRatio > 0.35 || heightRatio > 0.3 || areaRatio > 0.12) {
		return 0;
	}

	const widthScore = triangularScore(widthRatio, 0.08, 0.5);
	const heightScore = triangularScore(heightRatio, 0.12, 0.45);

	return Math.min(widthScore, heightScore);
}

function componentUniqueness(component, components) {
	const similarCount = components.filter((candidate) => {
		if (candidate === component) {
			return true;
		}

		const widthRatio = Math.min(component.width, candidate.width) / Math.max(component.width, candidate.width);
		const heightRatio = Math.min(component.height, candidate.height) / Math.max(component.height, candidate.height);
		const aspect = component.width / Math.max(1, component.height);
		const candidateAspect = candidate.width / Math.max(1, candidate.height);
		const aspectRatio = Math.min(aspect, candidateAspect) / Math.max(aspect, candidateAspect);

		return widthRatio > 0.75 && heightRatio > 0.75 && aspectRatio > 0.75;
	}).length;

	return 1 / similarCount;
}

function triangularScore(value, min, max) {
	if (value <= min || value >= max) {
		return 0;
	}

	const middle = (min + max) / 2;
	return value <= middle
		? (value - min) / (middle - min)
		: (max - value) / (max - middle);
}

export function centerOf(bounds) {
	return {
		x: (bounds.left + bounds.right) / 2,
		y: (bounds.top + bounds.bottom) / 2,
	};
}

function compareByPosition(left, right) {
	return left.top - right.top || left.left - right.left;
}

function square(value) {
	return value * value;
}

