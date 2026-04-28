const STANDARD_COLOR_RANGES = Object.freeze({
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

const RENDER_COLOR_RANGES = Object.freeze({
	'#0505D1': Object.freeze({ dark: '#02046F', center: '#0505D1', light: '#7F85FF' }),
	'#FC1D05': Object.freeze({ dark: '#AA0000', center: '#FC1D05', light: '#FFA2A2' }),
	'#8A3A12': Object.freeze({ dark: '#AA0000', center: '#FC1D05', light: '#FFA2A2' }),
});

/**
 * Provides generally useful color operations as a singleton service.
 */
export class ColorsModel {
	/**
	 * Maps a source paint shade into a target paint hue.
	 *
	 * @param {string} sourcePaint - Source component paint before recoloring.
	 * @param {string} targetPaint - Target/reference paint after semantic color matching.
	 * @param {ColorPaletteInterpolationOptions} options - Optional learned shade tables.
	 * @returns {string} Interpolated target-hue paint.
	 */
	interpolatedPaletteColor(sourcePaint, targetPaint, options = {}) {
		return interpolatedPaletteColor(sourcePaint, targetPaint, options);
	}

	/**
	 * Builds hue shades from raw colors.
	 *
	 * @param {string[]} colors - Paint colors to classify into standard hues.
	 * @returns {ColorPaletteHueShadesByHue} Hue shades keyed by canonical hue center.
	 */
	hueShadesByHue(colors) {
		return makeHueShadesByHue(colors);
	}

	/**
	 * Builds source-only hue shades from raw colors.
	 *
	 * @param {string[]} colors - Source paint colors to classify into standard hues.
	 * @returns {ColorPaletteHueShadesByHue} Source-only hue shades keyed by canonical hue center.
	 */
	sourceHueShadesByHue(colors) {
		return makeSourceHueShadesByHue(colors);
	}

	/**
	 * Builds hue shades from source-to-target color mappings.
	 *
	 * @param {ColorPaletteMapping[]} mappings - Source-to-target paint mappings.
	 * @param {string[]} colors - Additional source/reference colors used as evidence.
	 * @returns {ColorPaletteHueShadesByHue} Mapped hue shades keyed by canonical hue center.
	 */
	mappedHueShadesByHue(mappings, colors = []) {
		return makeMappedHueShadesByHue(mappings, colors);
	}

	/**
	 * Builds precomputed output paints from grouped overlap evidence.
	 *
	 * @param {ColorPaletteOverlap[]} overlaps - Grouped overlap evidence.
	 * @returns {ColorPaletteOutputPaintByKey} Output paints keyed by source component palette key.
	 */
	overlapPaletteColorMap(overlaps) {
		return makeOverlapPaletteColorMap(overlaps);
	}

	/**
	 * Parses a supported CSS paint string.
	 *
	 * @param {string} value - CSS paint string to parse.
	 * @returns {ColorPaletteRgbColor | null} RGB channels, or null when unsupported.
	 */
	parseColor(value) {
		return parseCssColor(value);
	}

	/**
	 * Computes perceived distance between two paints.
	 *
	 * @param {string} leftPaint - First paint to compare.
	 * @param {string} rightPaint - Second paint to compare.
	 * @returns {number | null} Perceived color distance, or null when either paint is unsupported.
	 */
	perceivedDistance(leftPaint, rightPaint) {
		return perceivedColorDistance(leftPaint, rightPaint);
	}

	/**
	 * Classifies a paint into a standard perceived hue.
	 *
	 * @param {string} paint - Paint to classify.
	 * @returns {string | null} Canonical hue center color, or null for unsupported/pure white paints.
	 */
	perceivedHue(paint) {
		return perceivedColorHue(paint);
	}

	/**
	 * Finds the average range color for a perceived hue.
	 *
	 * @param {string} hue - Canonical hue center color.
	 * @returns {string | null} Average hue color, or the input hue when no standard range exists.
	 */
	perceivedHueRangeMean(hue) {
		return perceivedColorHueRangeMean(hue);
	}

	/**
	 * Computes average colors for each perceived hue in a color set.
	 *
	 * @param {string[]} colors - Paint colors to average by hue.
	 * @returns {Map<string, string>} Average paint keyed by canonical hue center color.
	 */
	perceivedHueAverages(colors) {
		return makePerceivedColorHueAverages(colors);
	}

	/**
	 * Counts unique colors in each perceived hue.
	 *
	 * @param {string[]} colors - Paint colors to count by hue.
	 * @returns {ColorPaletteColorCountByHue} Unique color counts keyed by canonical hue center color.
	 */
	perceivedHueColorCounts(colors) {
		return makePerceivedColorHueColorCounts(colors);
	}

	/**
	 * Reports whether a canonical hue has a separate render output range.
	 *
	 * @param {string} hue - Canonical hue center paint.
	 * @returns {boolean} True when rendering should use an art-directed range for this hue.
	 */
	hasRenderRangeOverride(hue) {
		return Boolean(RENDER_COLOR_RANGES[hue]);
	}

	/**
	 * Chooses the best freeform reference component using the old exporter color-aware matcher.
	 *
	 * @param {ColorPaletteFreeformReferenceComponentMatchOptions} options - Source/reference matching context.
	 * @returns {ColorPaletteMatchComponent | null} Best matching reference component, if any.
	 */
	freeformReferenceComponent({
		sourceComponent,
		sourceComponents = [],
		referenceComponents = [],
	} = {}) {
		return freeformReferenceComponent(sourceComponent, sourceComponents, referenceComponents);
	}

	/**
	 * Chooses freeform reference paint using the old exporter color-aware fallback rules.
	 *
	 * @param {ColorPaletteFreeformReferencePaintOptions} options - Source/reference paint matching context.
	 * @returns {string | null} Reference paint or source-hue fallback paint.
	 */
	freeformReferencePaintForComponent({
		sourceComponent,
		sourceComponents = [],
		referenceComponents = [],
		paletteColors = [],
		sourceHueAverages = new Map(),
	} = {}) {
		const referenceComponent = freeformReferenceComponent(sourceComponent, sourceComponents, referenceComponents);
		const targetPaint = referenceComponent?.dominantColor || null;
		const sourceHue = perceivedColorHue(componentPaint(sourceComponent));
		const targetHue = perceivedColorHue(targetPaint);

		if (sourceHue && targetHue === sourceHue) {
			return targetPaint;
		}

		return nearestSameHuePalettePaint(componentPaint(sourceComponent), paletteColors, sourceHue)
			|| sourceHueReferencePaint(sourceHue, sourceHueAverages)
			|| componentPaint(sourceComponent);
	}

	/**
	 * Formats RGB channels as an uppercase hex paint.
	 *
	 * @param {ColorPaletteRgbColor | number[]} rgb - RGB channels to format.
	 * @returns {string} Uppercase `#RRGGBB` paint.
	 */
	formatColor(rgb) {
		return formatHexColor(rgb);
	}
}

export const Colors = Object.freeze(new ColorsModel());

/**
 * Models the standard hues, learned hue shades, and overlap-derived output paints.
 */
export class ColorPalette {
	/**
	 * Creates a palette from already-computed shade and overlap tables.
	 *
	 * @param {ColorPaletteOptions} options - Palette tables to use.
	 */
	constructor({
		hueShadesByHue = makeHueShadesByHue([]),
		sourceColorCountByHue = new Map(),
		sourceHueShadesByHue = new Map(),
		overlapPaletteColors = new Map(),
	} = {}) {
		/** @type {ColorPaletteHueShadesByHue} Learned shade offsets keyed by canonical hue center. */
		this.hueShadesByHue = hueShadesByHue;
		/** @type {ColorPaletteColorCountByHue} Unique source color counts keyed by canonical hue center. */
		this.sourceColorCountByHue = sourceColorCountByHue;
		/** @type {ColorPaletteHueShadesByHue} Source-only shade offsets keyed by canonical hue center. */
		this.sourceHueShadesByHue = sourceHueShadesByHue;
		/** @type {ColorPaletteOutputPaintByKey} Precomputed output paints keyed by stable source component palette key. */
		this.overlapPaletteColors = overlapPaletteColors;
	}

	/**
	 * Builds a palette from source/reference color mappings.
	 *
	 * @param {ColorPaletteFromMappingsOptions} options - Mapping and overlap evidence to mine.
	 * @returns {ColorPalette} Palette for output paint decisions.
	 */
	static fromMappings({
		mappings = [],
		colors = [],
		sourcePaints = [],
		overlaps = [],
	} = {}) {
		return new ColorPalette({
			hueShadesByHue: Colors.mappedHueShadesByHue(mappings, colors),
			sourceColorCountByHue: Colors.perceivedHueColorCounts(sourcePaints),
			sourceHueShadesByHue: Colors.sourceHueShadesByHue(sourcePaints),
			overlapPaletteColors: Colors.overlapPaletteColorMap(overlaps),
		});
	}

	/**
	 * Chooses the output paint for one source component.
	 *
	 * @param {ColorPaletteOutputPaintOptions} options - Source, target, and palette key for the component.
	 * @returns {string} Output paint to write into the rendered SVG.
	 */
	outputPaint({ paletteKey, sourcePaint, targetPaint }) {
		if (!targetPaint) {
			return sourcePaint;
		}

		if (this.overlapPaletteColors.has(paletteKey)) {
			return this.overlapPaletteColors.get(paletteKey);
		}

		return Colors.interpolatedPaletteColor(sourcePaint, targetPaint, {
			hueShadesByHue: this.hueShadesByHue,
			sourceColorCountByHue: this.sourceColorCountByHue,
			sourceHueShadesByHue: this.sourceHueShadesByHue,
		});
	}

	/**
	 * Chooses freeform artwork output paint using old-exporter overlap evidence first.
	 *
	 * @param {ColorPaletteOutputPaintOptions} options - Source, target, and palette key for the component.
	 * @returns {string} Output paint to write into a freeform rendered SVG component.
	 */
	freeformOutputPaint(options) {
		return this.outputPaint(options);
	}
}

/**
 * Maps a source paint shade into a target paint hue.
 *
 * @param {string} sourcePaint - Source component paint before recoloring.
 * @param {string} targetPaint - Target/reference paint after semantic color matching.
 * @param {ColorPaletteInterpolationOptions} options - Optional learned shade tables.
 * @returns {string} Interpolated target-hue paint.
 */
function interpolatedPaletteColor(sourcePaint, targetPaint, options = {}) {
	const sourceRgb = parseCssColor(sourcePaint);
	const targetRgb = parseCssColor(targetPaint);

	if (!sourceRgb || !targetRgb) {
		return targetPaint;
	}

	const sourceRange = colorRangeForRgb(sourceRgb);
	const targetRange = colorRangeForRgb(targetRgb);

	if (!sourceRange || !targetRange) {
		return targetPaint;
	}

	const renderTargetRange = renderRangeForRange(targetRange);
	const renderTargetRgb = hasRenderRangeOverride(targetRange)
		? parseCssColor(renderTargetRange.center) || targetRgb
		: targetRgb;

	if (formatHexColor(sourceRgb) === formatHexColor(targetRgb) && !hasRenderRangeOverride(targetRange)) {
		return formatHexColor(targetRgb);
	}

	const hueShadesByHue = options.hueShadesByHue || makeHueShadesByHue([sourcePaint, targetPaint]);
	const sourceHueShades = hueShadesForRange(sourceRange, hueShadesByHue);
	const sourceColorCount = options.sourceColorCountByHue?.get(sourceRange.center);
	const sourceOnlyHueShades = options.sourceHueShadesByHue?.get(sourceRange.center) || [];

	if (sourceColorCount === 1) {
		return formatHexColor(renderTargetRgb);
	}

	const sourceHueShade = snapHueShade(shadeOffsetFromCenter(sourceRgb, sourceRange), sourceHueShades);
	const anchoredSourceOffset = anchoredTargetShadeOffset(sourceHueShade, sourceOnlyHueShades, targetRgb, sourceRange);
	const targetShadeOffset = anchoredSourceOffset ?? shadeOffsetForHueShade(sourceHueShade, sourceHueShades, targetRange, hueShadesByHue);
	const targetCenter = rgbToOklab(renderTargetRgb);

	if (targetShadeOffset < 0) {
		return formatHexColor(oklabToRgb(interpolateOklab(
			rgbToOklab(parseCssColor(renderTargetRange.dark)),
			targetCenter,
			1 + targetShadeOffset,
		)));
	}

	if (targetShadeOffset > 0) {
		return formatHexColor(oklabToRgb(interpolateOklab(
			targetCenter,
			rgbToOklab(parseCssColor(renderTargetRange.light)),
			targetShadeOffset,
		)));
	}

	return formatHexColor(renderTargetRgb);
}

/**
 * Builds hue shades from raw colors.
 *
 * @param {string[]} colors - Paint colors to classify into standard hues.
 * @returns {ColorPaletteHueShadesByHue} Hue shades keyed by canonical hue center.
 */
function makeHueShadesByHue(colors) {
	const hueShades = new Map(Object.values(STANDARD_COLOR_RANGES).map((range) => [range.center, [0]]));

	for (const color of colors || []) {
		const rgb = parseCssColor(color);
		const range = rgb ? colorRangeForRgb(rgb) : null;

		if (!range) {
			continue;
		}

		hueShades.get(range.center).push(shadeOffsetFromCenter(rgb, range));
	}

	for (const [key, offsets] of hueShades) {
		hueShades.set(key, dedupeShadeOffsets(offsets));
	}

	return hueShades;
}

/**
 * Builds source-only hue shades from raw colors.
 *
 * @param {string[]} colors - Source paint colors to classify into standard hues.
 * @returns {ColorPaletteHueShadesByHue} Source-only hue shades keyed by canonical hue center.
 */
function makeSourceHueShadesByHue(colors) {
	const hueShades = new Map(Object.values(STANDARD_COLOR_RANGES).map((range) => [range.center, []]));

	for (const color of colors || []) {
		const rgb = parseCssColor(color);
		const range = rgb ? colorRangeForRgb(rgb) : null;

		if (!range) {
			continue;
		}

		hueShades.get(range.center).push(shadeOffsetFromCenter(rgb, range));
	}

	for (const [key, offsets] of hueShades) {
		hueShades.set(key, dedupeShadeOffsets(offsets, { includeZero: false }));
	}

	return hueShades;
}

/**
 * Builds hue shades from source-to-target color mappings.
 *
 * @param {ColorPaletteMapping[]} mappings - Source-to-target paint mappings.
 * @param {string[]} colors - Additional source/reference colors used as evidence.
 * @returns {ColorPaletteHueShadesByHue} Mapped hue shades keyed by canonical hue center.
 */
function makeMappedHueShadesByHue(mappings, colors = []) {
	const hueShades = makeHueShadesByHue([
		...colors,
		...(mappings || []).flatMap((mapping) => [mapping.source, mapping.target]),
	]);
	const targetMappedOffsets = new Map();

	for (const mapping of mappings || []) {
		const sourceRgb = parseCssColor(mapping.source);
		const targetRgb = parseCssColor(mapping.target);
		const sourceRange = sourceRgb ? colorRangeForRgb(sourceRgb) : null;
		const targetRange = targetRgb ? colorRangeForRgb(targetRgb) : null;

		if (!sourceRange || !targetRange) {
			continue;
		}

		const sourceHueShade = snapHueShade(
			shadeOffsetFromCenter(sourceRgb, sourceRange),
			hueShadesForRange(sourceRange, hueShades),
		);
		const offsets = targetMappedOffsets.get(targetRange.center) || [];

		offsets.push(sourceHueShade.hueShade);
		targetMappedOffsets.set(targetRange.center, offsets);
	}

	for (const [targetCenter, mappedOffsets] of targetMappedOffsets) {
		const currentHueShades = hueShades.get(targetCenter) || [0];
		hueShades.set(targetCenter, dedupeShadeOffsets([...currentHueShades, ...mappedOffsets]));
	}

	return hueShades;
}

/**
 * Builds precomputed output paints from grouped overlap evidence.
 *
 * @param {ColorPaletteOverlap[]} overlaps - Grouped overlap evidence.
 * @returns {ColorPaletteOutputPaintByKey} Output paints keyed by source component palette key.
 */
function makeOverlapPaletteColorMap(overlaps) {
	const colors = new Map();
	const targetGroups = collectOverlapTargetGroups(overlaps);
	const shadeTablesByTarget = shadeTablesByTargetKey(targetGroups);

	for (const { targetKey, items } of targetGroups) {
		const shadeRanks = rankedOverlapSourceShades(items, shadeTablesByTarget.get(targetKey));

		for (const item of items) {
			const targetRgb = parseCssColor(item.target);
			const targetRange = targetRgb ? colorRangeForRgb(targetRgb) : null;
			const rank = shadeRanks.get(sourceShadeKey(item.source));

			if (!targetRgb || !targetRange || rank == null) {
				continue;
			}

			colors.set(item.key, paletteColorForShadeRank(targetRgb, targetRange, rank, shadeTablesByTarget.get(targetKey)));
		}
	}

	return colors;
}

/**
 * Parses a supported CSS paint string.
 *
 * @param {string} value - CSS paint string to parse.
 * @returns {ColorPaletteRgbColor | null} RGB channels, or null when unsupported.
 */
function parseCssColor(value) {
	if (!value) {
		return null;
	}

	if (String(value).toLowerCase() === 'black') {
		return [0, 0, 0];
	}

	const hex = /^#([0-9a-f]{6})$/i.exec(String(value).trim())?.[1];

	return hex
		? [
			Number.parseInt(hex.slice(0, 2), 16),
			Number.parseInt(hex.slice(2, 4), 16),
			Number.parseInt(hex.slice(4, 6), 16),
		]
		: null;
}

/**
 * Computes perceived distance between two paints.
 *
 * @param {string} leftPaint - First paint to compare.
 * @param {string} rightPaint - Second paint to compare.
 * @returns {number | null} Perceived color distance, or null when either paint is unsupported.
 */
function perceivedColorDistance(leftPaint, rightPaint) {
	const leftRgb = parseCssColor(leftPaint);
	const rightRgb = parseCssColor(rightPaint);

	if (!leftRgb || !rightRgb) {
		return null;
	}

	return Math.sqrt(oklabDistance(rgbToOklab(leftRgb), rgbToOklab(rightRgb)));
}

/**
 * Classifies a paint into a standard perceived hue.
 *
 * @param {string} paint - Paint to classify.
 * @returns {string | null} Canonical hue center color, or null for unsupported/pure white paints.
 */
function perceivedColorHue(paint) {
	const rgb = parseCssColor(paint);

	if (!rgb) {
		return null;
	}

	return perceivedColorHueForRgb(rgb);
}

function perceivedColorHueForRgb(rgb) {
	if (isPureWhiteRgb(rgb)) {
		return null;
	}

	return perceivedColorHueForOklch(rgbToOklch(rgb));
}

/**
 * Finds the average range color for a perceived hue.
 *
 * @param {string} hue - Canonical hue center color.
 * @returns {string | null} Average hue color, or the input hue when no standard range exists.
 */
function perceivedColorHueRangeMean(hue) {
	const range = STANDARD_COLOR_RANGES[hue];

	if (!range) {
		return hue || null;
	}

	return formatHexColor(oklabToRgb(interpolateOklab(
		rgbToOklab(parseCssColor(range.dark)),
		rgbToOklab(parseCssColor(range.light)),
		0.5,
	)));
}

/**
 * Computes average colors for each perceived hue in a color set.
 *
 * @param {string[]} colors - Paint colors to average by hue.
 * @returns {Map<string, string>} Average paint keyed by canonical hue center color.
 */
function makePerceivedColorHueAverages(colors) {
	const colorsByHue = new Map();

	for (const color of colors || []) {
		const hue = perceivedColorHue(color);
		const rgb = parseCssColor(color);

		if (!hue || !rgb) {
			continue;
		}

		const hueColors = colorsByHue.get(hue) || new Map();
		hueColors.set(formatHexColor(rgb), rgb);
		colorsByHue.set(hue, hueColors);
	}

	return new Map([...colorsByHue].map(([hue, hueColors]) => [
		hue,
		averageOklabColor([...hueColors.values()]),
	]));
}

/**
 * Counts unique colors in each perceived hue.
 *
 * @param {string[]} colors - Paint colors to count by hue.
 * @returns {ColorPaletteColorCountByHue} Unique color counts keyed by canonical hue center color.
 */
function makePerceivedColorHueColorCounts(colors) {
	const colorsByHue = new Map();

	for (const color of colors || []) {
		const hue = perceivedColorHue(color);
		const rgb = parseCssColor(color);

		if (!hue || !rgb) {
			continue;
		}

		const hueColors = colorsByHue.get(hue) || new Set();
		hueColors.add(formatHexColor(rgb));
		colorsByHue.set(hue, hueColors);
	}

	return new Map([...colorsByHue].map(([hue, hueColors]) => [hue, hueColors.size]));
}

/**
 * Chooses the best freeform reference component using the old exporter color-aware matcher.
 *
 * @param {ColorPaletteMatchComponent | null} sourceComponent - Source component to match.
 * @param {ColorPaletteMatchComponent[]} sourceComponents - Source components in the same semantic part.
 * @param {ColorPaletteMatchComponent[]} referenceComponents - Candidate reference components.
 * @returns {ColorPaletteMatchComponent | null} Best matching reference component, if any.
 */
function freeformReferenceComponent(sourceComponent, sourceComponents = [], referenceComponents = []) {
	if (!sourceComponent || !referenceComponents || referenceComponents.length === 0) {
		return null;
	}

	if (referenceComponents.length === 1) {
		return referenceComponents[0];
	}

	const sourceBounds = unionBounds(sourceComponents.map(matchBounds));
	const referenceBounds = unionBounds(referenceComponents.map(matchBounds));
	const candidateComponents = perceivedReferenceCandidates(sourceComponent, referenceComponents);

	return candidateComponents
		.map((referenceComponent) => ({
			component: referenceComponent,
			score: analogousReferenceScore(sourceComponent, referenceComponent, sourceBounds, referenceBounds),
		}))
		.sort((left, right) => left.score - right.score)[0]?.component || null;
}

function perceivedReferenceCandidates(sourceComponent, referenceComponents) {
	const sourceHue = perceivedColorHue(componentPaint(sourceComponent));
	const sameHue = sourceHue
		? referenceComponents.filter((referenceComponent) => (
			perceivedColorHue(referenceComponent.dominantColor) === sourceHue
		))
		: [];

	return sameHue.length > 0 ? sameHue : referenceComponents;
}

function analogousReferenceScore(sourceComponent, referenceComponent, sourceBounds, referenceBounds) {
	const hasBounds = sourceBounds && referenceBounds;
	const sourcePoint = hasBounds ? normalizedCenter(sourceComponent, sourceBounds) : null;
	const referencePoint = hasBounds ? normalizedCenter(referenceComponent, referenceBounds) : null;
	const centerScore = hasBounds ? distance(sourcePoint, referencePoint) : 0;
	const sourceAreaRatio = hasBounds ? normalizedArea(sourceComponent, sourceBounds) : 0;
	const referenceAreaRatio = hasBounds ? normalizedArea(referenceComponent, referenceBounds) : 0;
	const areaScore = hasBounds
		? Math.abs(Math.log((sourceAreaRatio + 0.0001) / (referenceAreaRatio + 0.0001)))
		: 0;
	const colorScore = perceivedColorDistance(componentPaint(sourceComponent), referenceComponent.dominantColor);

	return centerScore + (areaScore * 0.04) + ((colorScore ?? 0) * 1.2);
}

function sourceHueReferencePaint(hue, sourceHueAverages) {
	return shouldUseCanonicalFreeformHue(hue)
		? hue
		: sourceHueAverages.get(hue) || hue || null;
}

function shouldUseCanonicalFreeformHue(hue) {
	return hue === '#8A3A12';
}

function nearestSameHuePalettePaint(sourcePaint, paletteColors, sourceHue) {
	if (!sourceHue) {
		return null;
	}

	return (paletteColors || [])
		.filter((paint) => perceivedColorHue(paint) === sourceHue)
		.map((paint) => ({
			paint,
			distance: perceivedColorDistance(sourcePaint, paint),
		}))
		.filter((entry) => entry.distance != null)
		.sort((left, right) => left.distance - right.distance)[0]?.paint || null;
}

/**
 * Formats RGB channels as an uppercase hex paint.
 *
 * @param {ColorPaletteRgbColor | number[]} rgb - RGB channels to format.
 * @returns {string} Uppercase `#RRGGBB` paint.
 */
function formatHexColor(rgb) {
	return `#${rgb.map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

function averageOklabColor(colors) {
	if (colors.length === 0) {
		return null;
	}

	const total = colors
		.map(rgbToOklab)
		.reduce((sum, color) => ({
			L: sum.L + color.L,
			a: sum.a + color.a,
			b: sum.b + color.b,
		}), { L: 0, a: 0, b: 0 });

	return formatHexColor(oklabToRgb({
		L: total.L / colors.length,
		a: total.a / colors.length,
		b: total.b / colors.length,
	}));
}

function componentPaint(component) {
	return isPaint(component?.fill) ? component.fill : component?.stroke;
}

function isPaint(value) {
	return Boolean(value) && value !== 'none' && value !== 'transparent';
}

function matchBounds(item) {
	return item?.bounds || item;
}

function unionBounds(boundsList) {
	const validBounds = (boundsList || [])
		.map((bounds) => normalizeBounds(bounds))
		.filter(Boolean);

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
		width: right - left,
		height: bottom - top,
	};
}

function normalizeBounds(bounds) {
	if (!bounds) {
		return null;
	}

	const left = bounds.left ?? bounds.minX ?? 0;
	const top = bounds.top ?? bounds.minY ?? 0;
	const right = bounds.right ?? (left + (bounds.width ?? 0));
	const bottom = bounds.bottom ?? (top + (bounds.height ?? 0));

	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
	};
}

function normalizedCenter(item, outerBounds) {
	const bounds = normalizeBounds(item.bounds || item);
	const center = item.center || {
		x: bounds.left + (bounds.width / 2),
		y: bounds.top + (bounds.height / 2),
	};

	return {
		x: (center.x - outerBounds.left) / Math.max(1, outerBounds.width),
		y: (center.y - outerBounds.top) / Math.max(1, outerBounds.height),
	};
}

function normalizedArea(item, outerBounds) {
	const bounds = normalizeBounds(item.bounds || item);
	const area = item.pixels || item.area || bounds.width * bounds.height;

	return area / Math.max(1, outerBounds.width * outerBounds.height);
}

function distance(left, right) {
	return Math.hypot(left.x - right.x, left.y - right.y);
}

function colorRangeForRgb(rgb) {
	if (isPureWhiteRgb(rgb)) {
		return null;
	}

	if (isWhiteRgb(rgb)) {
		return STANDARD_COLOR_RANGES['#F4F4F4'];
	}

	if (isNeutralRgb(rgb)) {
		return STANDARD_COLOR_RANGES['#000000'];
	}

	const perceivedHue = perceivedColorHueForRgb(rgb);

	if (perceivedHue && STANDARD_COLOR_RANGES[perceivedHue]) {
		return STANDARD_COLOR_RANGES[perceivedHue];
	}

	return nearestColorRangeForRgb(rgb);
}

function nearestColorRangeForRgb(rgb) {
	const entries = Object.values(STANDARD_COLOR_RANGES);
	const oklab = rgbToOklab(rgb);

	return entries
		.map((range) => ({
			range,
			distance: oklabDistance(oklab, rgbToOklab(parseCssColor(range.center))),
		}))
		.sort((left, right) => left.distance - right.distance)[0]?.range || null;
}

function hueShadesForRange(range, hueShadesByHue) {
	return hueShadesByHue.get(range.center) || [0];
}

function dedupeShadeOffsets(offsets, options = {}) {
	const tolerance = 0.035;
	const unique = [];

	for (const offset of offsets.sort((left, right) => left - right)) {
		const previous = unique[unique.length - 1];

		if (previous == null || Math.abs(previous - offset) > tolerance) {
			unique.push(offset);
		}
	}

	if (options.includeZero !== false && !unique.some((offset) => Math.abs(offset) <= 0.000001)) {
		unique.push(0);
		unique.sort((left, right) => left - right);
	}

	return unique;
}

function snapHueShade(offset, hueShades) {
	return hueShades
		.map((hueShade, index) => ({
			hueShade,
			rank: hueShades.length <= 1 ? 0.5 : index / (hueShades.length - 1),
			distance: Math.abs(hueShade - offset),
		}))
		.sort((left, right) => left.distance - right.distance)[0] || { hueShade: 0, rank: 0.5 };
}

function shadeOffsetForHueShade(sourceHueShade, sourceHueShades, targetRange, hueShadesByHue) {
	const targetHueShades = hueShadesForRange(targetRange, hueShadesByHue);

	if (targetHueShades.length > 1) {
		return targetHueShades
			.map((hueShade) => ({
				hueShade,
				distance: Math.abs(hueShade - sourceHueShade.hueShade),
			}))
			.sort((left, right) => left.distance - right.distance)[0]?.hueShade ?? 0;
	}

	return sourceHueShade.hueShade;
}

function anchoredTargetShadeOffset(sourceHueShade, sourceOnlyHueShades, targetRgb, sourceRange) {
	if (sourceOnlyHueShades.length <= 1) {
		return null;
	}

	const targetOffset = shadeOffsetFromCenter(targetRgb, sourceRange);
	const anchorIndex = sourceOnlyHueShades
		.map((hueShade, index) => ({ index, distance: Math.abs(hueShade - targetOffset) }))
		.sort((left, right) => left.distance - right.distance || left.index - right.index)[0]?.index;
	const sourceIndex = sourceOnlyHueShades.findIndex((hueShade) => Math.abs(hueShade - sourceHueShade.hueShade) <= 0.035);

	if (anchorIndex == null || sourceIndex < 0) {
		return null;
	}

	if (sourceIndex === anchorIndex) {
		return 0;
	}

	if (sourceIndex < anchorIndex) {
		return anchorIndex <= 0 ? 0 : -((anchorIndex - sourceIndex) / anchorIndex);
	}

	const aboveCount = sourceOnlyHueShades.length - 1 - anchorIndex;
	return aboveCount <= 0 ? 0 : (sourceIndex - anchorIndex) / aboveCount;
}

function groupOverlapItemsByTarget(items) {
	const groups = new Map();

	for (const item of items) {
		const targetRgb = parseCssColor(item.target);
		const targetRange = targetRgb ? colorRangeForRgb(targetRgb) : null;

		if (!targetRange) {
			continue;
		}

		const key = `${targetRange.center}:${formatHexColor(targetRgb)}`;
		const group = groups.get(key) || [];

		group.push(item);
		groups.set(key, group);
	}

	return groups;
}

function collectOverlapTargetGroups(overlaps) {
	return (overlaps || []).flatMap((overlap) => (
		[...groupOverlapItemsByTarget(overlap.items || [])]
			.map(([targetKey, items]) => ({ targetKey, items }))
	));
}

function shadeTablesByTargetKey(targetGroups) {
	const shadeTables = new Map();

	for (const { targetKey, items } of targetGroups) {
		const summary = lightnessSummaryForItems(items);
		const previous = shadeTables.get(targetKey) || { darker: 0, lighter: 0, shadeCount: 1 };

		shadeTables.set(targetKey, {
			darker: Math.max(previous.darker, summary.darker),
			lighter: Math.max(previous.lighter, summary.lighter),
			shadeCount: Math.max(previous.shadeCount, summary.shadeCount),
		});
	}

	return shadeTables;
}

function lightnessSummaryForItems(items) {
	const entries = sourceLightnessEntries(items);
	const centerIndex = centerLightnessIndex(entries, items[0]?.target);

	if (centerIndex == null) {
		return { darker: 0, lighter: 0, shadeCount: entries.length };
	}

	const centerLightness = entries[centerIndex][1];

	return {
		darker: centerLightness - entries[0][1],
		lighter: entries[entries.length - 1][1] - centerLightness,
		shadeCount: entries.length,
	};
}

function rankedOverlapSourceShades(items, shadeTable = { darker: 0, lighter: 0, shadeCount: 1 }) {
	return new Map(rankedLightnessShadeEntries(sourceLightnessEntries(items), shadeTable, items[0]?.target));
}

function sourceLightnessEntries(items) {
	const shades = new Map();

	for (const item of items) {
		const sourceRgb = parseCssColor(item.source);

		if (!sourceRgb) {
			continue;
		}

		const key = sourceShadeKey(item.source);
		const weight = Number.isFinite(item.weight) ? item.weight : 1;

		if (!shades.has(key)) {
			shades.set(key, {
				lightness: rgbToOklab(sourceRgb).L,
				source: formatHexColor(sourceRgb),
				weight,
				sourceIndex: Number.isFinite(item.sourceIndex) ? item.sourceIndex : Infinity,
			});
			continue;
		}

		const shade = shades.get(key);
		shade.weight += weight;
		shade.sourceIndex = Math.min(shade.sourceIndex, Number.isFinite(item.sourceIndex) ? item.sourceIndex : Infinity);
	}

	return [...shades.entries()]
		.map(([key, shade]) => [key, shade.lightness, shade.weight, shade.source, shade.sourceIndex])
		.sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]));
}

function rankedLightnessShadeEntries(entries, shadeTable, targetPaint = null) {
	if (entries.length === 0) {
		return [];
	}

	if (entries.length === 1) {
		return [[entries[0][0], 0.5]];
	}

	const targetAnchoredEntries = renderRangeAnchoredShadeEntries(entries, targetPaint);
	if (targetAnchoredEntries) {
		return targetAnchoredEntries;
	}

	const centerIndex = centerLightnessIndex(entries, targetPaint);

	if (centerIndex == null) {
		if (targetPaint && entries.length > 1 && !entriesContainHue(entries, perceivedColorHue(targetPaint))) {
			return entries.map((entry, index) => [entry[0], index / (entries.length - 1)]);
		}

		return entries.map((entry) => [entry[0], 0.5]);
	}

	return twoSidedShadeRanks(entries, centerIndex);
}

function renderRangeAnchoredShadeEntries(entries, targetPaint) {
	const targetRgb = parseCssColor(targetPaint);
	const targetRange = targetRgb ? colorRangeForRgb(targetRgb) : null;

	if (!targetRange || !hasRenderRangeOverride(targetRange) || !entriesContainHue(entries, targetRange.center)) {
		return null;
	}

	const targetLightness = rgbToOklab(targetRgb).L;
	const darkerEntries = entries.filter((entry) => entry[1] < targetLightness);
	const lighterEntries = entries.filter((entry) => entry[1] > targetLightness);

	if (darkerEntries.length === 0 || lighterEntries.length === 0) {
		return null;
	}

	const ranks = new Map();
	darkerEntries
		.sort((left, right) => left[1] - right[1])
		.forEach((entry, index) => {
			ranks.set(entry[0], darkerEntries.length === 1
				? 0
				: (index / (darkerEntries.length - 1)) * 0.5);
		});
	lighterEntries
		.sort((left, right) => left[1] - right[1])
		.forEach((entry, index) => {
			ranks.set(entry[0], lighterEntries.length === 1
				? 1
				: 0.5 + (((index + 1) / lighterEntries.length) * 0.5));
		});

	return entries.map((entry) => [entry[0], ranks.get(entry[0]) ?? 0.5]);
}

function twoSidedShadeRanks(entries, centerIndex) {
	const centerLightness = entries[centerIndex][1];
	const darkerEntries = entries
		.map((entry, index) => ({ entry, index }))
		.filter(({ index, entry }) => index !== centerIndex && entry[1] < centerLightness)
		.sort((left, right) => left.entry[1] - right.entry[1]);
	const lighterEntries = entries
		.map((entry, index) => ({ entry, index }))
		.filter(({ index, entry }) => index !== centerIndex && entry[1] > centerLightness)
		.sort((left, right) => left.entry[1] - right.entry[1]);
	const ranks = new Map([[entries[centerIndex][0], 0.5]]);

	darkerEntries.forEach(({ entry }, index) => {
		const rank = darkerEntries.length === 1
			? 0
			: (index / darkerEntries.length) * 0.5;

		ranks.set(entry[0], rank);
	});

	lighterEntries.forEach(({ entry }, index) => {
		const rank = lighterEntries.length === 1
			? 1
			: 0.5 + (((index + 1) / lighterEntries.length) * 0.5);

		ranks.set(entry[0], rank);
	});

	return entries.map((entry) => [entry[0], ranks.get(entry[0]) ?? 0.5]);
}

function shadeRanksForTable(shadeTable = {}) {
	const shadeCount = Math.max(1, Math.floor(shadeTable.shadeCount || 1));
	const darkerSpan = Math.max(shadeTable.darker || 0, 0);
	const lighterSpan = Math.max(shadeTable.lighter || 0, 0);

	if (shadeCount <= 1 || (darkerSpan <= 0.001 && lighterSpan <= 0.001)) {
		return [0.5];
	}

	if (darkerSpan <= 0.001) {
		return evenlySpacedRanks(0.5, 1, shadeCount);
	}

	if (lighterSpan <= 0.001) {
		return evenlySpacedRanks(0, 0.5, shadeCount);
	}

	const belowCount = Math.max(1, Math.round(((shadeCount - 1) * darkerSpan) / (darkerSpan + lighterSpan)));
	const aboveCount = Math.max(1, shadeCount - 1 - belowCount);

	return [
		...evenlySpacedRanks(0, 0.5, belowCount + 1).slice(0, -1),
		0.5,
		...evenlySpacedRanks(0.5, 1, aboveCount + 1).slice(1),
	];
}

function nearestShadeRank(lightness, entries, centerIndex, ranks) {
	const centerLightness = entries[centerIndex][1];
	const sideRanks = ranks.filter((rank) => lightness < centerLightness ? rank < 0.5 : rank > 0.5);

	if (sideRanks.length === 0) {
		return 0.5;
	}

	const sameSideEntries = entries
		.filter((entry) => lightness < centerLightness ? entry[1] < centerLightness : entry[1] > centerLightness)
		.map((entry) => entry[1])
		.sort((left, right) => lightness < centerLightness ? right - left : left - right);
	const index = sameSideEntries.findIndex((value) => value === lightness);
	const hueShadeIndex = clamp(index < 0 ? 0 : index, 0, sideRanks.length - 1);

	return sideRanks[hueShadeIndex];
}

function evenlySpacedRanks(start, end, count) {
	if (count <= 1) {
		return [start];
	}

	return Array.from({ length: count }, (_, index) => start + (((end - start) * index) / (count - 1)));
}

function centerLightnessIndex(entries, targetPaint = null) {
	if (entries.length === 0) {
		return null;
	}

	const minLightness = entries[0][1];
	const maxLightness = entries[entries.length - 1][1];
	const lightnessSpan = maxLightness - minLightness;

	if (lightnessSpan <= 0.001) {
		return null;
	}

	const targetHue = perceivedColorHue(targetPaint);
	const sameHueAnchor = targetHue
		? entries
			.map((entry, index) => ({
				index,
				weight: entry[2] || 0,
				distance: perceivedColorHue(entry[3]) === targetHue
					? perceivedColorDistance(entry[3], targetPaint)
					: null,
			}))
			.filter((entry) => entry.distance != null)
			.sort((left, right) => right.weight - left.weight || left.distance - right.distance || left.index - right.index)[0]?.index
		: null;

	if (sameHueAnchor != null) {
		return sameHueAnchor;
	}

	const zOrderAnchor = targetHue
		? entries
			.map((entry, index) => ({
				index,
				sourceIndex: Number.isFinite(entry[4]) ? entry[4] : null,
			}))
			.filter((entry) => entry.sourceIndex != null)
			.sort((left, right) => left.sourceIndex - right.sourceIndex || left.index - right.index)[0]?.index
		: null;

	if (zOrderAnchor != null) {
		return zOrderAnchor;
	}

	if (targetHue) {
		return null;
	}

	const maxWeight = Math.max(...entries.map((entry) => entry[2] || 0));
	const weightAnchor = entries
		.map((entry, index) => ({ index, weight: entry[2] || 0 }))
		.filter((entry) => entry.weight === maxWeight)
		.sort((left, right) => left.index - right.index)[0]?.index;

	if (weightAnchor != null && maxWeight > 0) {
		return weightAnchor;
	}

	const midpoint = minLightness + (lightnessSpan / 2);

	return entries
		.map((entry, index) => ({ index, distance: Math.abs(entry[1] - midpoint) }))
		.sort((left, right) => left.distance - right.distance || left.index - right.index)[0].index;
}

function entriesContainHue(entries, hue) {
	return Boolean(hue) && entries.some((entry) => perceivedColorHue(entry[3]) === hue);
}

function sourceShadeKey(sourcePaint) {
	const rgb = parseCssColor(sourcePaint);
	return rgb ? formatHexColor(rgb) : String(sourcePaint);
}

function paletteColorForShadeRank(targetRgb, targetRange, rank, shadeTable = {}) {
	const offset = rank <= 0.5
		? -1 + (rank * 2)
		: (rank - 0.5) * 2;
	const renderTargetRange = renderRangeForRange(targetRange);
	const renderTargetRgb = hasRenderRangeOverride(targetRange)
		? parseCssColor(renderTargetRange.center) || targetRgb
		: targetRgb;
	const targetCenter = rgbToOklab(renderTargetRgb);

	if (offset < 0) {
		if (hasRenderRangeOverride(targetRange)) {
			return formatHexColor(oklabToRgb(interpolateOklab(
				rgbToOklab(parseCssColor(renderTargetRange.dark)),
				targetCenter,
				1 + offset,
			)));
		}

		return formatHexColor(constrainHueShadeRgb(oklabToRgb(applyReferenceLightnessContrast(
			targetCenter,
			rgbToOklab(parseCssColor(renderTargetRange.dark)),
			-(shadeTable.darker || 0),
			offset,
		)), targetRange, offset));
	}

	if (offset > 0) {
		if (hasRenderRangeOverride(targetRange)) {
			return formatHexColor(oklabToRgb(interpolateOklab(
				targetCenter,
				rgbToOklab(parseCssColor(renderTargetRange.light)),
				offset,
			)));
		}

		return formatHexColor(constrainHueShadeRgb(oklabToRgb(applyReferenceLightnessContrast(
			targetCenter,
			rgbToOklab(parseCssColor(renderTargetRange.light)),
			shadeTable.lighter || 0,
			offset,
		)), targetRange, offset));
	}

	return formatHexColor(renderTargetRgb);
}

function renderRangeForRange(range) {
	return RENDER_COLOR_RANGES[range.center] || range;
}

function hasRenderRangeOverride(range) {
	return Boolean(RENDER_COLOR_RANGES[range.center]);
}

function constrainHueShadeRgb(rgb, targetRange, offset) {
	if (targetRange.center === '#2FC906') {
		const [red, green, blue] = rgb;

		if (offset < 0) {
			return [
				Math.min(red, 0),
				Math.max(green, 80),
				Math.min(blue, 10),
			];
		}

		if (offset > 0) {
			return [
				Math.min(red, 120),
				Math.max(green, 215),
				Math.min(blue, 90),
			];
		}
	}

	return rgb;
}

function applyReferenceLightnessContrast(reference, paletteLimit, sourceLightnessSpan, offset) {
	const paletteDelta = paletteLimit.L - reference.L;
	const direction = Math.sign(paletteDelta || sourceLightnessSpan || offset);
	const paletteSpan = Math.abs(paletteDelta);
	const learnedSpan = Math.abs(sourceLightnessSpan);
	const span = Math.max(
		paletteSpan,
		Math.min(learnedSpan, paletteSpan > 0.001 ? paletteSpan * 1.75 : learnedSpan),
	);
	const amount = paletteSpan > 0.001 ? (span / paletteSpan) * Math.abs(offset) : Math.abs(offset);
	const contrastLightness = reference.L + (direction * paletteSpan * amount);

	return {
		L: clamp(contrastLightness, 0, 1),
		a: reference.a,
		b: reference.b,
	};
}

function shadePosition(rgb, range) {
	const color = rgbToOklab(rgb);
	const dark = rgbToOklab(parseCssColor(range.dark));
	const light = rgbToOklab(parseCssColor(range.light));
	const axis = {
		L: light.L - dark.L,
		a: light.a - dark.a,
		b: light.b - dark.b,
	};
	const lengthSquared = (axis.L ** 2) + (axis.a ** 2) + (axis.b ** 2);

	if (lengthSquared <= 0) {
		return 0.5;
	}

	return clamp(
		(((color.L - dark.L) * axis.L) + ((color.a - dark.a) * axis.a) + ((color.b - dark.b) * axis.b)) / lengthSquared,
		0,
		1,
	);
}

function shadeOffsetFromCenter(rgb, range) {
	const shade = shadePosition(rgb, range);
	const centerShade = shadeCenterPosition(range);

	if (shade < centerShade) {
		return centerShade <= 0 ? 0 : -((centerShade - shade) / centerShade);
	}

	if (shade > centerShade) {
		return centerShade >= 1 ? 0 : (shade - centerShade) / (1 - centerShade);
	}

	return 0;
}

function shadeCenterPosition(range) {
	if (String(range.dark).toLowerCase() === String(range.center).toLowerCase()) {
		return 0.5;
	}

	return shadePosition(parseCssColor(range.center), range);
}

function interpolateOklab(left, right, amount) {
	return {
		L: left.L + ((right.L - left.L) * amount),
		a: left.a + ((right.a - left.a) * amount),
		b: left.b + ((right.b - left.b) * amount),
	};
}

function rgbToOklab(rgb) {
	const [red, green, blue] = rgb.map((channel) => srgbToLinear(channel / 255));
	const l = Math.cbrt((0.4122214708 * red) + (0.5363325363 * green) + (0.0514459929 * blue));
	const m = Math.cbrt((0.2119034982 * red) + (0.6806995451 * green) + (0.1073969566 * blue));
	const s = Math.cbrt((0.0883024619 * red) + (0.2817188376 * green) + (0.6299787005 * blue));

	return {
		L: (0.2104542553 * l) + (0.7936177850 * m) - (0.0040720468 * s),
		a: (1.9779984951 * l) - (2.4285922050 * m) + (0.4505937099 * s),
		b: (0.0259040371 * l) + (0.7827717662 * m) - (0.8086757660 * s),
	};
}

function rgbToOklch(rgb) {
	const oklab = rgbToOklab(rgb);
	const chroma = Math.hypot(oklab.a, oklab.b);
	const hue = (Math.atan2(oklab.b, oklab.a) * 180 / Math.PI + 360) % 360;

	return {
		L: oklab.L,
		C: chroma,
		H: hue,
	};
}

function perceivedColorHueForOklch(oklch) {
	if (oklch.C < 0.035) {
		return oklch.L >= 0.82 ? '#F4F4F4' : '#000000';
	}

	if (oklch.L >= 0.92 && oklch.C < 0.075) {
		return '#F4F4F4';
	}

	if (oklch.L <= 0.18 && oklch.C < 0.09) {
		return '#000000';
	}

	if (hueInRange(oklch.H, 335, 15)) {
		return '#BC197A';
	}

	if (hueInRange(oklch.H, 15, 25) && oklch.L >= 0.74 && oklch.C <= 0.14) {
		return '#BC197A';
	}

	if (isBrownOklch(oklch)) {
		return '#8A3A12';
	}

	if (hueInRange(oklch.H, 15, 45)) {
		return '#FC1D05';
	}

	if (hueInRange(oklch.H, 45, 85)) {
		return '#FF9900';
	}

	if (hueInRange(oklch.H, 85, 125)) {
		return '#F6F610';
	}

	if (hueInRange(oklch.H, 125, 190)) {
		return '#2FC906';
	}

	if (hueInRange(oklch.H, 190, 285)) {
		return '#0505D1';
	}

	if (hueInRange(oklch.H, 285, 335)) {
		return '#BC197A';
	}

	return null;
}

function isBrownOklch(oklch) {
	return hueInRange(oklch.H, 25, 65)
		&& oklch.L <= 0.62
		&& oklch.C >= 0.05
		&& oklch.C <= 0.22;
}

function hueInRange(hue, start, end) {
	return start <= end
		? hue >= start && hue < end
		: hue >= start || hue < end;
}

function oklabToRgb(oklab) {
	const l = oklab.L + (0.3963377774 * oklab.a) + (0.2158037573 * oklab.b);
	const m = oklab.L - (0.1055613458 * oklab.a) - (0.0638541728 * oklab.b);
	const s = oklab.L - (0.0894841775 * oklab.a) - (1.2914855480 * oklab.b);
	const l3 = l ** 3;
	const m3 = m ** 3;
	const s3 = s ** 3;

	return [
		linearToSrgb((4.0767416621 * l3) - (3.3077115913 * m3) + (0.2309699292 * s3)) * 255,
		linearToSrgb((-1.2684380046 * l3) + (2.6097574011 * m3) - (0.3413193965 * s3)) * 255,
		linearToSrgb((-0.0041960863 * l3) - (0.7034186147 * m3) + (1.7076147010 * s3)) * 255,
	];
}

function srgbToLinear(value) {
	return value <= 0.04045
		? value / 12.92
		: ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value) {
	const clamped = clamp(value, 0, 1);

	return clamped <= 0.0031308
		? clamped * 12.92
		: (1.055 * (clamped ** (1 / 2.4))) - 0.055;
}

function oklabDistance(left, right) {
	return ((left.L - right.L) ** 2) + ((left.a - right.a) ** 2) + ((left.b - right.b) ** 2);
}

function isNeutralRgb(rgb) {
	return Math.max(...rgb) - Math.min(...rgb) < 28;
}

function isWhiteRgb(rgb) {
	return !isPureWhiteRgb(rgb)
		&& Math.min(...rgb) >= 180
		&& Math.max(...rgb) - Math.min(...rgb) < 42;
}

function isPureWhiteRgb(rgb) {
	return formatHexColor(rgb) === '#FFFFFF';
}

function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

