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
const SOURCE_DETECTION_HUE_CENTERS = new Set(Object.values(SOURCE_DETECTION_HUE_RANGES).map((range) => range.center));

/**
 * Chooses component output colors from fixed hue palettes.
 */
export class ColorPicker {
	/**
	 * Creates a picker from built palette data.
	 *
	 * @param {BuiltColorPalette} palette - Fixed hue palettes and component shade assignments.
	 */
	constructor(palette = {}) {
		this.hues = palette.hues || new Map();
		this.componentShadesByKey = palette.componentShadesByKey || new Map();
	}

	/**
	 * Picks one output color from the target hue palette.
	 *
	 * @param {ColorPickerOptions} options - Component source, target, and palette key.
	 * @returns {string} Output palette color.
	 */
	pick({ paletteKey, sourcePaint, targetPaint }) {
		if (!targetPaint) {
			return sourcePaint;
		}

		const targetHue = targetHueForPaint(targetPaint);

		if (!targetHue) {
			return targetPaint;
		}

		const huePalette = this.hues.get(targetHue) || centerOnlyPalette(targetHue);
		const shadeAssignment = this.componentShadesByKey.has(paletteKey)
			? this.componentShadesByKey.get(paletteKey)
			: sourceShade(sourcePaint);

		return paletteEntryForAssignment(huePalette, shadeAssignment).color;
	}
}

function paletteEntryForAssignment(huePalette, assignment) {
	if (assignment && typeof assignment === 'object') {
		const sideEntry = paletteEntryForSideRank(huePalette, assignment.side, assignment.rank);

		if (sideEntry) {
			return sideEntry;
		}

		return nearestPaletteEntry(huePalette, assignment.shade);
	}

	return nearestPaletteEntry(huePalette, assignment);
}

function paletteEntryForSideRank(huePalette, side, rank) {
	if (side === 'center') {
		return centerPaletteEntry(huePalette);
	}

	if (side !== 'dark' && side !== 'light') {
		return null;
	}

	const entries = (huePalette.entries || [])
		.filter((entry) => side === 'dark'
			? (entry.shade || 0) < 0
			: (entry.shade || 0) > 0)
		.sort((left, right) => side === 'dark'
			? (right.shade || 0) - (left.shade || 0)
			: (left.shade || 0) - (right.shade || 0));

	return entries[Math.max(0, Math.min(entries.length - 1, (rank || 1) - 1))] || null;
}

function centerPaletteEntry(huePalette) {
	return (huePalette.entries || []).find((entry) => (entry.shade || 0) === 0)
		|| { shade: 0, color: huePalette.center };
}

function nearestPaletteEntry(huePalette, shade) {
	return (huePalette.entries || [{ shade: 0, color: huePalette.center }])
		.map((entry) => ({
			entry,
			distance: Math.abs((entry.shade || 0) - (shade || 0)),
		}))
		.sort((left, right) => left.distance - right.distance)[0].entry;
}

function sourceShade(sourcePaint) {
	const sourceRgb = parseColor(sourcePaint);
	const sourceRange = sourceRgb ? colorRangeForRgb(sourceRgb) : null;

	return sourceRange ? shadeOffsetFromCenter(sourceRgb, sourceRange) : 0;
}

function centerOnlyPalette(hue) {
	return {
		hue,
		center: hue,
		entries: [{ shade: 0, color: hue }],
	};
}

function targetHueForPaint(paint) {
	const normalized = normalizeColor(paint);

	if (!parseColor(normalized)) {
		return null;
	}

	return SOURCE_DETECTION_HUE_CENTERS.has(normalized) ? normalized : normalized;
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

	return rgb ? `#${rgb.map((channel) => Math.max(0, Math.min(255, channel)).toString(16).padStart(2, '0')).join('')}`.toUpperCase() : value;
}
