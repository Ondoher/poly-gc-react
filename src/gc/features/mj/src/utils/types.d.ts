/**
 * Identify one generated layout metric family such as `tiny` or `normal`.
 */
type LayoutMetricSetId = string;

/**
 * Describe one generated metric family that can render the MJ board.
 */
type LayoutMetricSet = {
	/** Name of the generated metric family. */
	metricSetId: LayoutMetricSetId | null;
	/** Full tile box width in pixels. */
	tileWidth: number;
	/** Full tile box height in pixels. */
	tileHeight: number;
	/** Visible face width in pixels. */
	faceWidth: number;
	/** Visible face height in pixels. */
	faceHeight: number;
	/** Right-side bevel or overhang padding in pixels. */
	rightPad: number;
	/** Bottom bevel or overhang padding in pixels. */
	bottomPad: number;
	/** Horizontal grid step for one logical half-cell in pixels. */
	cellWidth: number;
	/** Vertical grid step for one logical half-cell in pixels. */
	cellHeight: number;
	/** Horizontal offset contributed by one z-layer of depth. */
	depthX: number;
	/** Vertical offset contributed by one z-layer of depth. */
	depthY: number;
	/** Full generated canvas width for the complete logical grid. */
	canvasWidth?: number;
	/** Full generated canvas height for the complete logical grid. */
	canvasHeight?: number;
}

/**
 * Describe the plain metric object returned from `cssVars.buildObject(...)`
 * before the caller adds `metricSetId`.
 *
 * Under the current convention, layout-metric CSS variable names are flat and
 * use camelCase leaf names relative to the family prefix, for example:
 *
 * - `--tiny-tileWidth`
 * - `--tiny-faceHeight`
 * - `--tiny-depthX`
 */
type LayoutMetricCssVarObject = Omit<LayoutMetricSet, "metricSetId">;

/** One layout-metric CSS-variable name relative to the family prefix. */
type LayoutMetricCssVarName = keyof LayoutMetricCssVarObject;

/** Ordered list of layout-metric CSS-variable names for one metric family. */
type LayoutMetricCssVarNameList = LayoutMetricCssVarName[];

/**
 * Group every available metric family plus the preferred selection order.
 */
type LayoutMetricCatalog = {
	/** Lookup table of metric-family data by id. */
	metricSets: Record<string, LayoutMetricSet>;
	/** Ordered metric-family ids from smallest to largest or equivalent rank. */
	order: LayoutMetricSetId[];
	/** Id of the largest generated metric family when known. */
	maxMetricSetId: LayoutMetricSetId | null;
}

/**
 * Describe one usable rectangle measured from the live DOM.
 */
type LayoutAvailableSpace = {
	/** Usable width in pixels. */
	width: number;
	/** Usable height in pixels. */
	height: number;
}

/**
 * Describe edge padding that should be subtracted from available space.
 */
type LayoutPadding = {
	/** Left padding in pixels. */
	left: number;
	/** Right padding in pixels. */
	right: number;
	/** Top padding in pixels. */
	top: number;
	/** Bottom padding in pixels. */
	bottom: number;
}

/**
 * Describe preferred and hard scale limits for fit evaluation.
 */
type LayoutScaleTolerance = {
	/** Lowest scale still considered visually preferred. */
	preferredMinScale: number;
	/** Highest scale still considered visually preferred. */
	preferredMaxScale: number;
	/** Absolute minimum allowed scale. */
	minScale: number;
	/** Absolute maximum allowed scale. */
	maxScale: number;
}

/**
 * Describe the occupied logical extents of one active layout.
 */
type LayoutBounds = {
	/** Smallest occupied logical x position. */
	minX: number;
	/** Largest occupied logical x position. */
	maxX: number;
	/** Smallest occupied logical y position. */
	minY: number;
	/** Largest occupied logical y position. */
	maxY: number;
	/** Smallest occupied logical z position. */
	minZ: number;
	/** Largest occupied logical z position. */
	maxZ: number;
	/** Occupied layout width in logical grid units. */
	gridWidth: number;
	/** Occupied layout height in logical grid units. */
	gridHeight: number;
	/** Occupied layout depth in logical z layers. */
	gridDepth: number;
}

/**
 * Describe one unscaled or scaled layout size in pixels.
 */
type LayoutPixelSize = {
	/** Width in pixels. */
	width: number;
	/** Height in pixels. */
	height: number;
}

/**
 * Summarize the visual quality characteristics of one scale decision.
 */
type LayoutScaleQuality = {
	/** Whether the fit requires shrinking the chosen metric family. */
	isDownscale: boolean;
	/** Whether the fit requires enlarging the chosen metric family. */
	isUpscale: boolean;
	/** Whether the fit is close to native size. */
	isNearNative: boolean;
	/** Whether the fit stays inside the currently comfortable scale band. */
	isComfortable: boolean;
	/** Whether the fit exceeds the hard visual ceiling. */
	exceedsHardLimit: boolean;
}

/**
 * Describe one candidate fit result for one metric family.
 */
type LayoutCandidateFit = {
	/** Id of the metric family used for this candidate. */
	metricSetId: LayoutMetricSetId | null;
	/** Metric-family geometry used to evaluate the fit. */
	tileMetrics: LayoutMetricSet;
	/** Fixed logical board center in unscaled board-canvas pixels. */
	boardPixelCenter?: {
		x: number;
		y: number;
	};
	/** Unscaled occupied layout size in pixels for this candidate. */
	layoutPixelSize: LayoutPixelSize | null;
	/** Measured usable space that the layout is trying to fit into. */
	availableSpace: LayoutAvailableSpace;
	/** Horizontal scale needed to fit the candidate. */
	scaleX: number;
	/** Vertical scale needed to fit the candidate. */
	scaleY: number;
	/** Uncapped scale requested by the available space. */
	requestedScale?: number;
	/** Largest scale allowed by the rendered tile-size ceiling. */
	maxRenderedScale?: number;
	/** Final chosen scale after applying the rendered tile-size ceiling. */
	scale: number;
	/** Whether the candidate fits inside the hard scale range. */
	fitsScaleRange: boolean;
	/** Whether the candidate fits inside the preferred scale range. */
	inPreferredScaleRange: boolean;
	/** Final scaled width in pixels. */
	scaledWidth: number;
	/** Final scaled height in pixels. */
	scaledHeight: number;
	/** Optional quality summary for chooser logic. */
	scaleQuality?: LayoutScaleQuality;
}

/**
 * Describe the full output of one layout-scaling calculation.
 */
type LayoutScalingResult = {
	/** Occupied logical bounds for the active layout. */
	layoutBounds: LayoutBounds | null;
	/** Available space after any padding adjustments. */
	innerAvailableSpace: LayoutAvailableSpace;
	/** Every candidate fit evaluated for the available metric families. */
	candidateFits: LayoutCandidateFit[];
	/** Winning candidate fit when one is available. */
	selectedFit: LayoutCandidateFit | null;
	/** Chosen layout size in pixels before final placement. */
	layoutPixelSize: LayoutPixelSize | null;
	/** Final chosen scale for the selected fit. */
	scale: number;
	/** Tolerance values used while evaluating candidates. */
	scaleTolerance: LayoutScaleTolerance;
	/** List of unresolved required inputs that blocked a complete calculation. */
	pendingInputs: string[];
}

/**
 * Describe the stable app-facing payload that the controller can map into view state.
 *
 * This intentionally avoids any knowledge of concrete CSS class names. The
 * controller can translate `metricSetId` into geometry classes and apply the
 * numeric values as CSS custom properties or other view state.
 */
type LayoutScalingViewState = {
	/** Selected generated metric-family id for the current fit. */
	metricSetId: LayoutMetricSetId | null;
	/** Final chosen scale for the current fit. */
	scale: number;
	/** Whether the calculator found a usable fit. */
	hasFit: boolean;
}

/**
 * Describe the app-facing inputs accepted by the layout-scaling service.
 *
 * This config is intended to be passed as one complete request to the
 * stateless layout-scaling service.
 */
type LayoutScalingConfig = {
	/** Optional active layout object whose positions can be derived automatically. */
	layout?: Layout | null;
	/** Optional explicit tile positions when a full layout object is not supplied. */
	positions?: TilePosition[];
	/** Optional candidate metric-family names such as `tiny` or `normal`. */
	sizeNames?: LayoutMetricSetId[];
	/** Measured usable render space for the current board or preview surface. */
	availableSpace?: Partial<LayoutAvailableSpace>;
	/** Optional padding that should be subtracted from available space. */
	padding?: Partial<LayoutPadding>;
	/** Optional scale-tolerance policy override. */
	scaleTolerance?: Partial<LayoutScaleTolerance>;
}

/** One CSS-variable name relative to the shared prefix. */
type LayoutCssVarName = string;

/** Ordered list of CSS-variable names relative to the shared prefix. */
type LayoutCssVarNameList = LayoutCssVarName[];

/**
 * Describe one CSS-variable group that can be read into a plain object.
 */
type LayoutCssVarGroupDescriptor = {
	/** Common CSS-variable prefix shared by every field in the group. */
	prefix: string;
	/** Variable names relative to the shared prefix. */
	names: LayoutCssVarNameList;
}

/**
 * Describe the CSS-variable names needed to construct one layout metric set.
 */
type LayoutMetricCssVarDescriptor = {
	/** Family-specific CSS-variable prefix such as `tiny` or `--tiny-`. */
	prefix: string;
	/** Flat camelCase variable names for one metric-family object. */
	names: LayoutMetricCssVarNameList;
}

/**
 * Control how one CSS-variable group is read into a plain object.
 */
type LayoutCssVarBuildOptions = {
	/** Optional element whose computed vars should be read instead of `:root`. */
	element?: Element | null;
	/** Whether plain numeric strings should be converted to numbers. */
	coerceNumbers?: boolean;
	/** Fallback values to use when one field has no CSS variable value. */
	defaults?: Record<string, any>;
}
