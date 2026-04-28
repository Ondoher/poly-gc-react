const SOURCE_DETECTION_HUE_RANGES = Object.freeze({
	'#F4F4F4': Object.freeze({ dark: '#B8B8B8', center: '#F4F4F4', light: '#FEFEFE' }),
	'#F6F610': Object.freeze({ dark: '#9B9700', center: '#F6F610', light: '#FFFF61' }),
	'#FF9900': Object.freeze({ dark: '#9C5200', center: '#FF9900', light: '#FFC04A' }),
	'#8A3A12': Object.freeze({ dark: '#4A1C00', center: '#8A3A12', light: '#B8662A' }),
	'#0505D1': Object.freeze({ dark: '#02046F', center: '#0505D1', light: '#555CFF' }),
	'#2FC906': Object.freeze({ dark: '#004D00', center: '#2FC906', light: '#73F246' }),
	'#FC1D05': Object.freeze({ dark: '#9C1204', center: '#FC1D05', light: '#FF6B4A' }),
	'#BC197A': Object.freeze({ dark: '#6F0D46', center: '#BC197A', light: '#F06DB8' }),
	'#000000': Object.freeze({ dark: '#000000', center: '#000000', light: '#6A6A6A' }),
});

const RENDER_OUTPUT_HUE_RANGES = Object.freeze({
	'#0505D1': Object.freeze({ dark: '#02046F', center: '#0505D1', light: '#7F85FF' }),
	'#FC1D05': Object.freeze({ dark: '#AA0000', center: '#FC1D05', light: '#FFA2A2' }),
	'#8A3A12': Object.freeze({ dark: '#AA0000', center: '#FC1D05', light: '#FFA2A2' }),
});
const SOURCE_DETECTION_HUE_CENTERS = new Set(Object.values(SOURCE_DETECTION_HUE_RANGES).map((range) => range.center));

const SHADE_EPSILON = 0.035;

/**
 * Builds fixed hue palettes from source/reference color evidence.
 */
export class PaletteBuilder {
	/**
	 * Creates a builder from source-to-target color evidence.
	 *
	 * @param {PaletteBuilderOptions} options - Mapping and overlap evidence to mine.
	 */
	constructor({
		mappings = [],
		colors = [],
		overlaps = [],
	} = {}) {
		this.mappings = mappings;
		this.colors = colors;
		this.overlaps = overlaps;
	}

	/**
	 * Builds hue palettes and component shade assignments.
	 *
	 * @returns {BuiltColorPalette} Fixed palette data for ColorPicker.
	 */
	build() {
		const collections = this.seedHueCollections();

		for (const color of this.colors || []) {
			const rgb = parseColor(color);
			const hue = rgb ? targetHueForPaint(color) : null;

			if (hue) {
				this.ensureHueCollection(collections, hue);
			}
		}

		for (const overlap of this.overlaps || []) {
			this.addOverlap(collections, overlap.items || []);
		}

		for (const mapping of this.mappings || []) {
			this.addMapping(collections, mapping);
		}

		const hues = new Map([...collections].map(([hue, collection]) => [hue, buildHuePalette(collection)]));

		return {
			hues,
			componentShadesByKey: this.componentShadesByKey(),
		};
	}

	seedHueCollections() {
		return new Map(Object.values(SOURCE_DETECTION_HUE_RANGES).map((range) => [
			range.center,
			newHueCollection(range.center),
		]));
	}

	ensureHueCollection(collections, hue) {
		if (!collections.has(hue)) {
			collections.set(hue, newHueCollection(hue));
		}

		return collections.get(hue);
	}

	addOverlap(collections, items) {
		for (const itemGroup of groupItemsByTargetHue(items)) {
			const first = itemGroup[0];
			const targetHue = targetHueForPaint(first?.target);

			if (!targetHue) {
				continue;
			}

			const collection = collectShadeOffsets(rankedSourceShades(itemGroup).map((item) => item.shade));

			this.addShades(this.ensureHueCollection(collections, targetHue), collection);
		}
	}

	addMapping(collections, mapping) {
		const sourceRgb = parseColor(mapping.source);
		const targetHue = targetHueForPaint(mapping.target);

		if (!sourceRgb || !targetHue) {
			return;
		}

		this.addShades(this.ensureHueCollection(collections, targetHue), collectSourceShades([mapping]));
	}

	addShades(hue, collection) {
		hue.count = Math.max(hue.count, collection.count);
		hue.darkCount = Math.max(hue.darkCount, collection.darkCount);
		hue.lightCount = Math.max(hue.lightCount, collection.lightCount);
		hue.maxDarkDelta = Math.max(hue.maxDarkDelta, collection.darkDelta);
		hue.maxLightDelta = Math.max(hue.maxLightDelta, collection.lightDelta);
	}

	componentShadesByKey() {
		const shades = new Map();

		for (const overlap of this.overlaps || []) {
			for (const itemGroup of groupItemsByTargetHue(overlap.items || [])) {
				for (const item of rankedSourceShades(itemGroup)) {
					if (item.key) {
						shades.set(item.key, {
							shade: item.shade,
							side: item.side,
							rank: item.rank,
						});
					}
				}
			}
		}

		return shades;
	}
}

function newHueCollection(referenceHue) {
	return {
		hue: referenceHue,
		count: 1,
		maxDarkDelta: 0,
		maxLightDelta: 0,
		darkCount: 0,
		lightCount: 0,
	};
}

function collectSourceShades(items) {
	const shadeItems = new Map();

	for (const item of items || []) {
		const sourceRgb = parseColor(item.source);
		const sourceShade = sourceRgb ? sourceShadeOffset(sourceRgb, item.target) : null;

		if (sourceShade !== null) {
			const sourcePaint = formatColor(sourceRgb);

			shadeItems.set(sourcePaint, {
				shade: sourceShade,
			});
		}
	}

	return collectShadeOffsets(normalizedShadeOffsets([...shadeItems.values()]));
}

function rankedSourceShades(items) {
	const paintGroups = new Map();

	for (const item of items || []) {
		const rgb = parseColor(item.source);

		if (!rgb) {
			continue;
		}

		const sourcePaint = formatColor(rgb);
		const sourceShade = sourceShadeOffset(rgb, item.target);

		if (sourceShade === null) {
			continue;
		}

		const group = paintGroups.get(sourcePaint) || {
			keys: [],
			shade: sourceShade,
		};

		group.keys.push(item.key);
		paintGroups.set(sourcePaint, group);
	}

	const paintItems = [...paintGroups.values()]
		.sort((left, right) => left.shade - right.shade
			|| String(left.keys[0] || '').localeCompare(String(right.keys[0] || '')));

	if (paintItems.length === 0) {
		return [];
	}

	const centerShade = centerShadeClosestToHueCenter(paintItems);
	const roleItems = paintItems.map((item) => ({
		...item,
		shade: quantizeShade(item.shade - centerShade),
	}));
	const darkRanks = rankedSideShades(roleItems, 'dark');
	const lightRanks = rankedSideShades(roleItems, 'light');

	return roleItems.flatMap((item) => {
		const side = sideForShade(item.shade);
		const rank = side === 'dark'
			? darkRanks.get(item.shade)
			: side === 'light'
			? lightRanks.get(item.shade)
			: 0;

		return item.keys.map((key) => ({
			key,
			shade: item.shade,
			side,
			rank,
		}));
	});
}

function rankedSideShades(items, side) {
	const sideShades = [...new Set(items
		.map((item) => item.shade)
		.filter((shade) => sideForShade(shade) === side))]
		.sort((left, right) => side === 'dark'
			? right - left
			: left - right);

	return new Map(sideShades.map((shade, index) => [shade, index + 1]));
}

function sideForShade(shade) {
	if (shade < 0) {
		return 'dark';
	}

	if (shade > 0) {
		return 'light';
	}

	return 'center';
}

function collectShadeOffsets(shades) {
	const uniqueShades = [...new Set((shades || []).map((shade) => quantizeShade(shade)))];
	const darkShades = uniqueShades.filter((shade) => shade < 0);
	const lightShades = uniqueShades.filter((shade) => shade > 0);

	return {
		count: uniqueShades.length || 1,
		darkDelta: darkShades.length ? Math.abs(Math.min(...darkShades)) : 0,
		lightDelta: lightShades.length ? Math.max(...lightShades) : 0,
		darkCount: darkShades.length,
		lightCount: lightShades.length,
	};
}

function normalizedShadeOffsets(shadeItems) {
	const centerShade = centerShadeClosestToHueCenter(shadeItems || []);

	return (shadeItems || []).map((item) => quantizeShade(item.shade - centerShade));
}

function centerShadeClosestToHueCenter(shadeItems) {
	const uniqueItems = [...(shadeItems || [])];

	if (uniqueItems.length === 0) {
		return 0;
	}

	return uniqueItems.reduce((closest, item) => {
		if (closest === null) {
			return item;
		}

		const itemDistance = Math.abs(item.shade);
		const closestDistance = Math.abs(closest.shade);

		return itemDistance < closestDistance
			|| (itemDistance === closestDistance && item.shade < closest.shade)
			? item
			: closest;
	}, null)?.shade || 0;
}

function buildHuePalette(collection) {
	const outputRange = outputRangeForHue(collection.hue);
	const count = Math.max(collection.count, collection.darkCount + collection.lightCount + 1);
	const { darkSlots, lightSlots } = allocateSideSlots({
		count,
		darkCount: collection.darkCount,
		lightCount: collection.lightCount,
		darkDistance: collection.maxDarkDelta,
		lightDistance: collection.maxLightDelta,
	});
	const darkEntries = darkSlots === 0
		? []
		: Array.from({ length: darkSlots }, (_, index) => {
			const shade = -(collection.maxDarkDelta * ((darkSlots - index) / darkSlots));
			const amount = index / darkSlots;

			return {
				shade,
				color: interpolateColor(outputRange.dark, outputRange.center, amount),
			};
		});
	const lightEntries = lightSlots === 0
		? []
		: Array.from({ length: lightSlots }, (_, index) => {
			const shade = collection.maxLightDelta * ((index + 1) / lightSlots);
			const amount = (index + 1) / lightSlots;

			return {
				shade,
				color: interpolateColor(outputRange.center, outputRange.light, amount),
			};
		});

	return {
		hue: collection.hue,
		center: outputRange.center,
		entries: [
			...darkEntries,
			{ shade: 0, color: normalizeColor(outputRange.center) },
			...lightEntries,
		],
	};
}

function allocateSideSlots({ count, darkCount, lightCount, darkDistance, lightDistance }) {
	const sideSlots = Math.max(0, count - 1);
	let darkSlots = Math.min(darkCount, sideSlots);
	let lightSlots = Math.min(lightCount, sideSlots - darkSlots);
	let remaining = sideSlots - darkSlots - lightSlots;

	while (remaining > 0) {
		const totalDistance = darkDistance + lightDistance;
		const preferDark = totalDistance <= 0
			? darkSlots <= lightSlots
			: ((darkSlots + 1) / Math.max(darkDistance, SHADE_EPSILON))
				<= ((lightSlots + 1) / Math.max(lightDistance, SHADE_EPSILON));

		if (preferDark && darkDistance > 0) {
			darkSlots += 1;
		} else if (lightDistance > 0) {
			lightSlots += 1;
		} else if (darkDistance > 0) {
			darkSlots += 1;
		} else {
			lightSlots += 1;
		}

		remaining -= 1;
	}

	return { darkSlots, lightSlots };
}

function groupItemsByTargetHue(items) {
	const groups = new Map();

	for (const item of items || []) {
		const targetHue = targetHueForPaint(item.target);

		if (!targetHue) {
			continue;
		}

		const group = groups.get(targetHue) || [];

		group.push(item);
		groups.set(targetHue, group);
	}

	return [...groups.values()];
}

function outputRangeForHue(hue) {
	return RENDER_OUTPUT_HUE_RANGES[hue] || SOURCE_DETECTION_HUE_RANGES[hue] || { dark: hue, center: hue, light: hue };
}

function targetHueForPaint(paint) {
	const normalized = normalizeColor(paint);

	if (!parseColor(normalized)) {
		return null;
	}

	return SOURCE_DETECTION_HUE_CENTERS.has(normalized) || RENDER_OUTPUT_HUE_RANGES[normalized]
		? normalized
		: normalized;
}

function sourceShadeOffset(rgb, targetPaint) {
	const targetRgb = parseColor(targetPaint);

	if (targetRgb) {
		return quantizeShade(calculateShade(rgb) - calculateShade(targetRgb));
	}

	const sourceRange = colorRangeForRgb(rgb);

	return sourceRange ? quantizeShade(shadeOffsetFromCenter(rgb, sourceRange)) : null;
}

function colorRangeForRgb(rgb) {
	return Object.values(SOURCE_DETECTION_HUE_RANGES)
		.map((range) => ({
			range,
			distance: colorDistance(rgb, parseColor(range.center)),
		}))
		.sort((left, right) => left.distance - right.distance)[0]?.range || null;
}

function shadeOffsetFromCenter(rgb, range) {
	const shade = calculateShade(rgb);
	const center = calculateShade(parseColor(range.center));
	const dark = calculateShade(parseColor(range.dark));
	const light = calculateShade(parseColor(range.light));

	if (shade < center) {
		return dark === center ? 0 : -((center - shade) / (center - dark));
	}

	if (shade > center) {
		return light === center ? 0 : ((shade - center) / (light - center));
	}

	return 0;
}

function interpolateColor(leftColor, rightColor, amount) {
	const left = parseColor(leftColor);
	const right = parseColor(rightColor);

	return formatColor(left.map((channel, index) => Math.round(channel + ((right[index] - channel) * amount))));
}

function colorDistance(left, right) {
	return Math.sqrt(left.reduce((total, channel, index) => total + ((channel - right[index]) ** 2), 0));
}

function calculateShade(rgb) {
	return ((0.2126 * rgb[0]) + (0.7152 * rgb[1]) + (0.0722 * rgb[2])) / 255;
}

function parseColor(value) {
	const normalized = String(value || '').trim();

	if (normalized.toLowerCase() === 'black') {
		return [0, 0, 0];
	}

	const hex = /^#([0-9a-f]{6})$/i.exec(normalized)?.[1];

	return hex
		? [
			Number.parseInt(hex.slice(0, 2), 16),
			Number.parseInt(hex.slice(2, 4), 16),
			Number.parseInt(hex.slice(4, 6), 16),
		]
		: null;
}

function normalizeColor(value) {
	const rgb = parseColor(value);

	return rgb ? formatColor(rgb) : value;
}

function formatColor(rgb) {
	return `#${rgb.map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function quantizeShade(shade) {
	return Number(Number(shade || 0).toFixed(3));
}
