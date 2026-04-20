import { Service, Registry } from "@polylith/core";

const DEFAULT_LOGICAL_GRID = {
	width: 30,
	height: 16,
	depth: 7,
};
const LOGICAL_GRID_CSS_VAR_NAMES = Object.freeze([
	"gridWidth",
	"gridHeight",
	"gridDepth",
]);

const DEFAULT_SCALE_TOLERANCE = {
	preferredMinScale: 0.85,
	preferredMaxScale: 1.2,
	minScale: 0.75,
	maxScale: 2,
};

/**
 * Describe the CSS-variable names that `mj:layout-scaling` expects to read
 * from `mj:css-vars.buildObject(...)` for one metric family.
 *
 * Under the current convention these names are flat camelCase leaf names, so
 * a prefix of `tiny` reads variables such as `--tiny-tileWidth` and
 * `--tiny-depthX`. The resulting plain object can then be passed directly into
 * `normalizeTileMetrics(...)` after `metricSetId` is added.
 *
 * @type {LayoutMetricCssVarNameList}
 */
export const LAYOUT_METRIC_CSS_VAR_NAMES = Object.freeze([
	"tileWidth",
	"tileHeight",
	"faceWidth",
	"faceHeight",
	"rightPad",
	"bottomPad",
	"cellWidth",
	"cellHeight",
	"depthX",
	"depthY",
	"canvasWidth",
	"canvasHeight",
]);

/**
 * Calculate layout bounds and board-fit scaling for the Mahjongg feature.
 *
 * This service is intentionally stateless with respect to per-board or
 * per-render calculations. Singleton services should only retain global
 * dependencies or cache-like state, so each layout-fit request is driven
 * entirely by the incoming config and is idempotent for the same inputs.
 */
export default class LayoutScalingService extends Service {
	/**
	 * @param {Registry} [registry] - Manage service lookup and registration.
	 */
	constructor(registry) {
		super("mj:layout-scaling", registry);
		this.implement([
			"start",
			"ready",
			"getViewState",
			"getDebugState",
		]);
	}

	/**
	 * Convert an unknown numeric input into a safe number.
	 *
	 * @param {number} value - Specify the candidate numeric value.
	 * @returns {number}
	 */
	normalizeNumber(value) {
		return Number.isFinite(value) ? value : 0;
	}

	/**
	 * Convert an unknown positive numeric input into a safe positive number.
	 *
	 * @param {number} value - Specify the candidate numeric value.
	 * @param {number} fallback - Specify the fallback value when the input is invalid.
	 * @returns {number}
	 */
	normalizePositiveNumber(value, fallback) {
		return Number.isFinite(value) && value > 0 ? value : fallback;
	}

	/**
	 * Normalize one tile-metric object into the internal metric-set shape.
	 *
	 * @param {Partial<LayoutMetricSet>} tileMetrics - Specify the candidate tile metrics.
	 * @returns {LayoutMetricSet}
	 */
	normalizeTileMetrics(tileMetrics = {}) {
		return {
			metricSetId: typeof tileMetrics.metricSetId === "string"
				? tileMetrics.metricSetId
				: null,
			tileWidth: this.normalizeNumber(tileMetrics.tileWidth),
			tileHeight: this.normalizeNumber(tileMetrics.tileHeight),
			faceWidth: this.normalizeNumber(tileMetrics.faceWidth),
			faceHeight: this.normalizeNumber(tileMetrics.faceHeight),
			rightPad: this.normalizeNumber(tileMetrics.rightPad),
			bottomPad: this.normalizeNumber(tileMetrics.bottomPad),
			cellWidth: this.normalizeNumber(tileMetrics.cellWidth),
			cellHeight: this.normalizeNumber(tileMetrics.cellHeight),
			depthX: this.normalizeNumber(tileMetrics.depthX),
			depthY: this.normalizeNumber(tileMetrics.depthY),
			canvasWidth: this.normalizeNumber(tileMetrics.canvasWidth),
			canvasHeight: this.normalizeNumber(tileMetrics.canvasHeight),
		};
	}

	/**
	 * Check whether one normalized metric family has the minimum geometry needed
	 * for layout scaling.
	 *
	 * @param {LayoutMetricSet | null} tileMetrics - Specify the normalized metric-family data to inspect.
	 * @returns {boolean}
	 */
	hasUsableTileMetrics(tileMetrics) {
		return Boolean(
			tileMetrics &&
			tileMetrics.tileWidth > 0 &&
			tileMetrics.tileHeight > 0 &&
			tileMetrics.cellWidth > 0 &&
			tileMetrics.cellHeight > 0
		);
	}

	/**
	 * Build one stable cache key for one metric-family CSS-variable lookup.
	 *
	 * @param {string} prefix - Specify the metric-family prefix.
	 * @param {LayoutMetricCssVarNameList} names - Specify the metric-variable names.
	 * @param {Record<string, any>} [defaults] - Specify any fallback defaults used during object construction.
	 * @returns {string}
	 */
	buildMetricCssVarCacheKey(prefix, names, defaults = {}) {
		let normalizedPrefix = typeof prefix === "string" ? prefix.trim() : "";
		let normalizedNames = Array.isArray(names) ? names : [];
		let serializedDefaults = JSON.stringify(defaults || {});

		return `${normalizedPrefix}|${normalizedNames.join("|")}|${serializedDefaults}`;
	}

	/**
	 * Read the shared logical-grid dimensions from css-vars when available.
	 *
	 * These root-level values are emitted by `layouts.css` under the `mj`
	 * prefix, for example `--mj-gridWidth`.
	 *
	 * @returns {{width: number, height: number, depth: number}}
	 */
	readLogicalGridFromCssVars() {
		if (this.logicalGridCache) {
			return {...this.logicalGridCache};
		}

		if (!this.cssVars || typeof this.cssVars.buildObject !== "function") {
			this.logicalGridCache = {...DEFAULT_LOGICAL_GRID};
			return {...this.logicalGridCache};
		}

		let rawGrid = this.cssVars.buildObject({
			prefix: "mj",
			names: LOGICAL_GRID_CSS_VAR_NAMES,
		}, {
			defaults: {
				gridWidth: DEFAULT_LOGICAL_GRID.width,
				gridHeight: DEFAULT_LOGICAL_GRID.height,
				gridDepth: DEFAULT_LOGICAL_GRID.depth,
			},
		});

		this.logicalGridCache = {
			width: this.normalizePositiveNumber(rawGrid.gridWidth, DEFAULT_LOGICAL_GRID.width),
			height: this.normalizePositiveNumber(rawGrid.gridHeight, DEFAULT_LOGICAL_GRID.height),
			depth: this.normalizePositiveNumber(rawGrid.gridDepth, DEFAULT_LOGICAL_GRID.depth),
		};

		return {...this.logicalGridCache};
	}

	/**
	 * Read one metric family from the css-vars service and cache the constructed object.
	 *
	 * @param {string} metricSetId - Specify the metric-family id such as `tiny`.
	 * @param {LayoutMetricCssVarNameList} [names] - Specify the metric-variable names to read.
	 * @param {Record<string, any>} [defaults] - Specify any fallback defaults used during object construction.
	 * @returns {LayoutMetricSet | null}
	 */
	readMetricSetFromCssVars(
		metricSetId,
		names = LAYOUT_METRIC_CSS_VAR_NAMES,
		defaults = {}
	) {
		if (!this.cssVars || typeof this.cssVars.buildObject !== "function") {
			return null;
		}

		let prefix = typeof metricSetId === "string" ? metricSetId.trim() : "";

		if (!prefix) {
			return null;
		}

		let cacheKey = this.buildMetricCssVarCacheKey(prefix, names, defaults);

		if (Object.prototype.hasOwnProperty.call(this.metricSetCache, cacheKey)) {
			return this.metricSetCache[cacheKey];
		}

		let rawMetrics = this.cssVars.buildObject({
			prefix,
			names,
		}, {
			defaults,
		});
		let tileMetrics = this.normalizeTileMetrics({
			metricSetId: prefix,
			...rawMetrics,
		});

		if (!this.hasUsableTileMetrics(tileMetrics)) {
			this.metricSetCache[cacheKey] = null;
			return null;
		}

		this.metricSetCache[cacheKey] = tileMetrics;
		return tileMetrics;
	}

	/**
	 * Read one explicit set of metric families from css-vars.
	 *
	 * @param {LayoutMetricSetId[]} metricSetIds - Specify the metric-family ids to read.
	 * @returns {LayoutMetricSet[]}
	 */
	readMetricSetsFromCssVars(metricSetIds) {
		let requestedIds = Array.isArray(metricSetIds) ? metricSetIds : [];

		return requestedIds.map(function(metricSetId) {
			return this.readMetricSetFromCssVars(metricSetId);
		}, this).filter(Boolean);
	}

	/**
	 * Build one quality summary for a candidate scale value.
	 *
	 * @param {number} scale - Specify the candidate scale value.
	 * @param {LayoutScaleTolerance} scaleTolerance - Specify the active scale-tolerance policy.
	 * @returns {LayoutScaleQuality}
	 */
	buildScaleQuality(scale, scaleTolerance) {
		let normalizedScale = Number.isFinite(scale) ? scale : 0;

		return {
			isDownscale: normalizedScale > 0 && normalizedScale < 1,
			isUpscale: normalizedScale > 1,
			isNearNative: normalizedScale > 0 && Math.abs(1 - normalizedScale) < 0.001,
			isComfortable:
				normalizedScale >= scaleTolerance.preferredMinScale &&
				normalizedScale <= scaleTolerance.preferredMaxScale,
			exceedsHardLimit:
				normalizedScale < scaleTolerance.minScale ||
				normalizedScale > scaleTolerance.maxScale,
		};
	}

	/**
	 * Find the metric family that defines the largest allowed rendered tile.
	 *
	 * The normal family is the visual quality ceiling: smaller generated metric
	 * families may upscale, but only until their rendered tile is no larger than
	 * normal at the configured hard max scale.
	 *
	 * @param {LayoutMetricSet[]} metricSets - Specify the available metric families.
	 * @returns {LayoutMetricSet | null}
	 */
	getScaleCeilingMetricSet(metricSets) {
		let usableMetricSets = Array.isArray(metricSets)
			? metricSets.filter(this.hasUsableTileMetrics.bind(this))
			: [];

		if (usableMetricSets.length === 0) {
			return null;
		}

		let normalMetricSet = usableMetricSets.find(function(metricSet) {
			return metricSet.metricSetId === "normal";
		});

		if (normalMetricSet) {
			return normalMetricSet;
		}

		return usableMetricSets.slice().sort(function(left, right) {
			return (right.tileWidth * right.tileHeight) - (left.tileWidth * left.tileHeight);
		})[0];
	}

	/**
	 * Calculate the largest scale one metric family may use before exceeding the
	 * configured rendered size ceiling.
	 *
	 * @param {LayoutMetricSet} tileMetrics - Specify the candidate metric family.
	 * @param {LayoutMetricSet | null} ceilingMetricSet - Specify the metric family that defines the ceiling.
	 * @param {LayoutScaleTolerance} scaleTolerance - Specify the active scale-tolerance policy.
	 * @returns {number}
	 */
	calculateMaxRenderedScale(tileMetrics, ceilingMetricSet, scaleTolerance) {
		if (!this.hasUsableTileMetrics(tileMetrics)) {
			return Number.POSITIVE_INFINITY;
		}

		if (!this.hasUsableTileMetrics(ceilingMetricSet)) {
			return scaleTolerance.maxScale;
		}

		let maxRenderedTileWidth = ceilingMetricSet.tileWidth * scaleTolerance.maxScale;
		let maxRenderedTileHeight = ceilingMetricSet.tileHeight * scaleTolerance.maxScale;
		let maxScaleX = maxRenderedTileWidth / tileMetrics.tileWidth;
		let maxScaleY = maxRenderedTileHeight / tileMetrics.tileHeight;

		return Math.min(maxScaleX, maxScaleY);
	}

	/**
	 * Build one continuous quality score for a candidate fit.
	 *
	 * Lower scores are better. This score is intentionally asymmetric: when two
	 * candidates are equally distant from `1`, the downscaled candidate wins over
	 * the upscaled candidate because it is expected to preserve quality better
	 * once the available source detail ceiling is reached.
	 *
	 * @param {LayoutCandidateFit} candidateFit - Specify the candidate fit to score.
	 * @returns {number}
	 */
	scoreCandidateQuality(candidateFit) {
		let scale = Number.isFinite(candidateFit?.scale) ? candidateFit.scale : 0;

		if (scale <= 0) {
			return Number.POSITIVE_INFINITY;
		}

		let distanceFromNative = Math.abs(1 - scale);
		let upscalePenalty = scale > 1 ? distanceFromNative + 0.0001 : distanceFromNative;

		return upscalePenalty;
	}

	/**
	 * Return the candidate metric sets currently available for selection.
	 *
	 * @param {ReturnType<LayoutScalingService["normalizeConfig"]>} context - Specify the normalized calculation inputs.
	 * @returns {LayoutMetricSet[]}
	 */
	getCandidateMetricSets(context) {
		return context.tileMetricSets;
	}

	/**
	 * Compare two candidate fits.
	 *
	 * @param {LayoutCandidateFit} left - Specify the left candidate fit.
	 * @param {LayoutCandidateFit} right - Specify the right candidate fit.
	 * @returns {number}
	 */
	compareCandidateFits(left, right) {
		if (left.fitsScaleRange !== right.fitsScaleRange) {
			return left.fitsScaleRange ? -1 : 1;
		}

		let leftTileWidth = left.tileMetrics?.tileWidth || 0;
		let rightTileWidth = right.tileMetrics?.tileWidth || 0;

		if (leftTileWidth !== rightTileWidth) {
			return rightTileWidth - leftTileWidth;
		}

		let leftQualityScore = this.scoreCandidateQuality(left);
		let rightQualityScore = this.scoreCandidateQuality(right);

		if (leftQualityScore !== rightQualityScore) {
			return leftQualityScore - rightQualityScore;
		}

		let leftMetricSetId = left.metricSetId || "";
		let rightMetricSetId = right.metricSetId || "";

		if (leftMetricSetId < rightMetricSetId) {
			return -1;
		}

		if (leftMetricSetId > rightMetricSetId) {
			return 1;
		}

		return 0;
	}

	/**
	 * Calculate the occupied layout bounds from one tile-position list.
	 *
	 * @param {TilePosition[]} positions - Specify the positions to evaluate.
	 * @returns {LayoutBounds | null}
	 */
	calculateLayoutBounds(positions) {
		if (!Array.isArray(positions) || positions.length === 0) {
			return null;
		}

		let minX = Infinity;
		let maxX = -Infinity;
		let minY = Infinity;
		let maxY = -Infinity;
		let minZ = Infinity;
		let maxZ = -Infinity;

		positions.forEach(function(position) {
			minX = Math.min(minX, position.x);
			maxX = Math.max(maxX, position.x);
			minY = Math.min(minY, position.y);
			maxY = Math.max(maxY, position.y);
			minZ = Math.min(minZ, position.z);
			maxZ = Math.max(maxZ, position.z);
		});

		return {
			minX,
			maxX,
			minY,
			maxY,
			minZ,
			maxZ,
			gridWidth: (maxX - minX) + 2,
			gridHeight: (maxY - minY) + 2,
			gridDepth: (maxZ - minZ) + 1,
		};
	}

	/**
	 * Calculate the usable inner space after padding is removed from available space.
	 *
	 * @param {LayoutAvailableSpace} availableSpace - Specify the measured available space.
	 * @param {LayoutPadding} padding - Specify padding to subtract.
	 * @returns {LayoutAvailableSpace}
	 */
	calculateInnerAvailableSpace(availableSpace, padding) {
		return {
			width: Math.max(0, availableSpace.width - padding.left - padding.right),
			height: Math.max(0, availableSpace.height - padding.top - padding.bottom),
		};
	}

	/**
	 * Calculate the full rendered board size for one metric family.
	 *
	 * This is the fixed logical board box whose midpoint CSS will center when
	 * the canvas is placed in the shell. Later fit calculations measure occupied
	 * tile extents relative to this midpoint so sparse or lopsided layouts still
	 * grow around one stable board center.
	 *
	 * @param {LayoutMetricSet | null} tileMetrics - Specify the tile metrics to evaluate.
	 * @param {{width: number, height: number, depth: number}} logicalGrid - Specify the generated logical grid geometry.
	 * @returns {LayoutPixelSize | null}
	 */
	calculateBoardPixelSizeForMetrics(tileMetrics, logicalGrid) {
		if (!tileMetrics || !logicalGrid) {
			return null;
		}

		let width = ((logicalGrid.width - 1) * tileMetrics.cellWidth) +
			(tileMetrics.depthX * (logicalGrid.depth - 1)) +
			tileMetrics.tileWidth;
		let height = ((logicalGrid.height - 1) * tileMetrics.cellHeight) +
			(tileMetrics.depthY * (logicalGrid.depth - 1)) +
			tileMetrics.tileHeight;

		return {
			width: Math.max(0, width),
			height: Math.max(0, height),
		};
	}

	/**
	 * Calculate the fixed logical board center for one metric family.
	 *
	 * @param {LayoutMetricSet | null} tileMetrics - Specify the tile metrics to evaluate.
	 * @param {{width: number, height: number, depth: number}} logicalGrid - Specify the generated logical grid geometry.
	 * @returns {{x: number, y: number} | null}
	 */
	calculateBoardPixelCenterForMetrics(tileMetrics, logicalGrid) {
		let boardPixelSize = this.calculateBoardPixelSizeForMetrics(tileMetrics, logicalGrid);

		if (!boardPixelSize) {
			return null;
		}

		return {
			x: boardPixelSize.width / 2,
			y: boardPixelSize.height / 2,
		};
	}

	/**
	 * Calculate one rendered tile rectangle in board-pixel coordinates.
	 *
	 * @param {TilePosition} position - Specify the tile position to project.
	 * @param {LayoutMetricSet | null} tileMetrics - Specify the tile metrics to evaluate.
	 * @param {{width: number, height: number, depth: number}} logicalGrid - Specify the generated logical grid geometry.
	 * @returns {{left: number, top: number, right: number, bottom: number} | null}
	 */
	calculateTilePixelRect(position, tileMetrics, logicalGrid) {
		if (!position || !tileMetrics || !logicalGrid) {
			return null;
		}

		let x = this.normalizeNumber(position.x);
		let y = this.normalizeNumber(position.y);
		let z = this.normalizeNumber(position.z);
		let depthOffset = logicalGrid.depth - 1 - z;
		let left = (x * tileMetrics.cellWidth) + (tileMetrics.depthX * depthOffset);
		let top = (y * tileMetrics.cellHeight) + (tileMetrics.depthY * depthOffset);

		return {
			left,
			top,
			right: left + tileMetrics.tileWidth,
			bottom: top + tileMetrics.tileHeight,
		};
	}

	/**
	 * Calculate the unscaled occupied layout size in pixels for one metric set.
	 *
	 * @param {TilePosition[]} positions - Specify the occupied tile positions.
	 * @param {LayoutMetricSet | null} tileMetrics - Specify the tile metrics to evaluate.
	 * @param {{width: number, height: number, depth: number}} logicalGrid - Specify the generated logical grid geometry.
	 * @returns {LayoutPixelSize | null}
	 */
	calculateLayoutPixelSizeForMetrics(positions, tileMetrics, logicalGrid) {
		if (!Array.isArray(positions) || positions.length === 0 || !tileMetrics) {
			return null;
		}

		let boardPixelSize = this.calculateBoardPixelSizeForMetrics(tileMetrics, logicalGrid);

		if (!boardPixelSize) {
			return null;
		}

		let centerX = boardPixelSize.width / 2;
		let centerY = boardPixelSize.height / 2;
		let minLeft = Infinity;
		let maxRight = -Infinity;
		let minTop = Infinity;
		let maxBottom = -Infinity;

		positions.forEach(function(position) {
			let tileRect = this.calculateTilePixelRect(position, tileMetrics, logicalGrid);

			if (!tileRect) {
				return;
			}

			minLeft = Math.min(minLeft, tileRect.left);
			maxRight = Math.max(maxRight, tileRect.right);
			minTop = Math.min(minTop, tileRect.top);
			maxBottom = Math.max(maxBottom, tileRect.bottom);
		}, this);

		if (
			minLeft === Infinity ||
			maxRight === -Infinity ||
			minTop === Infinity ||
			maxBottom === -Infinity
		) {
			return null;
		}

		let leftExtent = Math.max(0, centerX - minLeft);
		let rightExtent = Math.max(0, maxRight - centerX);
		let topExtent = Math.max(0, centerY - minTop);
		let bottomExtent = Math.max(0, maxBottom - centerY);
		let width = 2 * Math.max(leftExtent, rightExtent);
		let height = 2 * Math.max(topExtent, bottomExtent);

		return {
			width: Math.max(0, width),
			height: Math.max(0, height),
		};
	}

	/**
	 * Build one list of unresolved inputs or temporary blockers.
	 *
	 * @param {ReturnType<LayoutScalingService["normalizeConfig"]>} context - Specify the normalized calculation inputs.
	 * @returns {string[]}
	 */
	buildPendingInputs(context) {
		let pendingInputs = [];

		if (context.availableSpace.width <= 0 || context.availableSpace.height <= 0) {
			pendingInputs.push("live playfield measurement source is not wired yet");
		}

		if (context.tileMetricSets.length === 0) {
			pendingInputs.push("generated tile metrics are unavailable");
		}

		return pendingInputs;
	}

	/**
	 * Evaluate every candidate metric set against one layout and available space.
	 *
	 * @param {ReturnType<LayoutScalingService["normalizeConfig"]>} context - Specify the normalized calculation inputs.
	 * @param {LayoutBounds | null} layoutBounds - Specify the occupied logical layout bounds.
	 * @param {LayoutAvailableSpace} innerAvailableSpace - Specify the usable inner space.
	 * @returns {LayoutCandidateFit[]}
	 */
	evaluateMetricSets(context, layoutBounds, innerAvailableSpace) {
		if (!layoutBounds) {
			return [];
		}

		let metricSets = this.getCandidateMetricSets(context);
		let ceilingMetricSet = this.getScaleCeilingMetricSet(metricSets);

		return metricSets.map(function(tileMetrics) {
			let boardPixelCenter = this.calculateBoardPixelCenterForMetrics(
				tileMetrics,
				context.logicalGrid
			);
			let layoutPixelSize = this.calculateLayoutPixelSizeForMetrics(
				context.positions,
				tileMetrics,
				context.logicalGrid
			);
			let scaleX = layoutPixelSize && layoutPixelSize.width > 0
				? innerAvailableSpace.width / layoutPixelSize.width
				: 0;
			let scaleY = layoutPixelSize && layoutPixelSize.height > 0
				? innerAvailableSpace.height / layoutPixelSize.height
				: 0;
			let requestedScale = layoutPixelSize
				? Math.min(scaleX, scaleY)
				: 0;
			let maxRenderedScale = this.calculateMaxRenderedScale(
				tileMetrics,
				ceilingMetricSet,
				context.scaleTolerance
			);
			let scale = requestedScale > 0
				? Math.min(requestedScale, maxRenderedScale)
				: 0;
			let fitsScaleRange =
				requestedScale >= context.scaleTolerance.minScale &&
				requestedScale <= maxRenderedScale;
			let inPreferredScaleRange =
				scale >= context.scaleTolerance.preferredMinScale &&
				scale <= context.scaleTolerance.preferredMaxScale;
			let scaleQuality = this.buildScaleQuality(scale, {
				...context.scaleTolerance,
				maxScale: maxRenderedScale,
			});

			return {
				metricSetId: tileMetrics.metricSetId || null,
				tileMetrics,
				boardPixelCenter,
				layoutPixelSize,
				availableSpace: innerAvailableSpace,
				scaleX,
				scaleY,
				requestedScale,
				maxRenderedScale,
				scale,
				fitsScaleRange,
				inPreferredScaleRange,
				scaledWidth: layoutPixelSize ? layoutPixelSize.width * scale : 0,
				scaledHeight: layoutPixelSize ? layoutPixelSize.height * scale : 0,
				scaleQuality,
			};
		}, this).sort(this.compareCandidateFits.bind(this));
	}

	/**
	 * Normalize one app-facing config object into internal calculation inputs.
	 *
	 * @param {LayoutScalingConfig} config - Specify one scaling request.
	 * @returns {{
	 * 	positions: TilePosition[],
	 * 	sizeNames: LayoutMetricSetId[],
	 * 	logicalGrid: {width: number, height: number, depth: number},
	 * 	availableSpace: LayoutAvailableSpace,
	 * 	padding: LayoutPadding,
	 * 	tileMetricSets: LayoutMetricSet[],
	 * 	scaleTolerance: LayoutScaleTolerance
	 * }}
	 */
	normalizeConfig(config = {}) {
		let layout = config.layout || null;
		let positions = Array.isArray(config.positions)
			? config.positions.slice()
			: (Array.isArray(layout?.positions) ? layout.positions.slice() : []);
		let sizeNames = Array.isArray(config.sizeNames)
			? config.sizeNames.filter(function(name) {
				return typeof name === "string" && name.trim();
			}).map(function(name) {
				return name.trim();
			})
			: [];
		let availableSpace = {
			width: this.normalizeNumber(config.availableSpace?.width),
			height: this.normalizeNumber(config.availableSpace?.height),
		};
		let padding = {
			left: this.normalizeNumber(config.padding?.left),
			right: this.normalizeNumber(config.padding?.right),
			top: this.normalizeNumber(config.padding?.top),
			bottom: this.normalizeNumber(config.padding?.bottom),
		};
		let tileMetricSets = sizeNames.length > 0
			? this.readMetricSetsFromCssVars(sizeNames)
			: [];
		let scaleTolerance = {
			preferredMinScale: this.normalizePositiveNumber(
				config.scaleTolerance?.preferredMinScale,
				DEFAULT_SCALE_TOLERANCE.preferredMinScale
			),
			preferredMaxScale: this.normalizePositiveNumber(
				config.scaleTolerance?.preferredMaxScale,
				DEFAULT_SCALE_TOLERANCE.preferredMaxScale
			),
			minScale: this.normalizePositiveNumber(
				config.scaleTolerance?.minScale,
				DEFAULT_SCALE_TOLERANCE.minScale
			),
			maxScale: this.normalizePositiveNumber(
				config.scaleTolerance?.maxScale,
				DEFAULT_SCALE_TOLERANCE.maxScale
			),
		};

		return {
			positions,
			sizeNames,
			logicalGrid: this.readLogicalGridFromCssVars(),
			availableSpace,
			padding,
			tileMetricSets,
			scaleTolerance,
		};
	}

	/**
	 * Calculate the full internal layout-scaling snapshot for one request.
	 *
	 * @param {LayoutScalingConfig} config - Specify the current layout-scaling inputs.
	 * @returns {LayoutScalingResult}
	 */
	calculate(config = {}) {
		let context = this.normalizeConfig(config);
		let layoutBounds = this.calculateLayoutBounds(context.positions);
		let innerAvailableSpace = this.calculateInnerAvailableSpace(
			context.availableSpace,
			context.padding
		);
		let candidateFits = this.evaluateMetricSets(context, layoutBounds, innerAvailableSpace);
		let selectedFit = candidateFits[0] || null;
		let layoutPixelSize = selectedFit?.layoutPixelSize || null;
		let scale = selectedFit?.scale ?? 1;

		return {
			layoutBounds,
			innerAvailableSpace,
			candidateFits,
			selectedFit,
			layoutPixelSize,
			scale,
			scaleTolerance: {
				...context.scaleTolerance,
			},
			pendingInputs: this.buildPendingInputs(context),
		};
	}

	/**
	 * Start the layout-scaling lifecycle.
	 */
	start() {
		/**
		 * Track the CSS-variable service dependency once the service lifecycle is ready.
		 *
		 * This service may subscribe during startup or ready, but it must not rely
		 * on the dependency until `ready()` has completed.
		 *
		 * @type {CssVarsService | null}
		 */
		this.cssVars = null;
		this.metricSetCache = {};
		this.logicalGridCache = null;
	}

	/**
	 * Mark the service ready for use by wiring dependent services.
	 */
	ready() {
		this.cssVars = this.registry.subscribe("mj:css-vars");
	}

	/**
	 * Return the richer internal layout-scaling snapshot for debugging or analytics.
	 *
	 * Runtime metric metadata is expected to come from generator-emitted CSS
	 * custom properties, grouped into plain JS objects through
	 * `this.cssVars.buildObject(...)`.
	 *
	 * @param {LayoutScalingConfig} config - Specify the current layout, space, and candidate size names.
	 * @returns {LayoutScalingResult}
	 */
	getDebugState(config = {}) {
		return this.calculate(config);
	}

	/**
	 * Return the stable controller-facing layout view state for one scaling request.
	 *
	 * This method is the full public calculation interface for the service. The
	 * same config should produce the same derived view state.
	 *
	 * @param {LayoutScalingConfig} config - Specify the current layout, space, and candidate size names.
	 * @returns {LayoutScalingViewState}
	 */
	getViewState(config = {}) {
		let debugState = this.getDebugState(config);
		let selectedFit = debugState.selectedFit;

		return {
			metricSetId: selectedFit?.metricSetId || null,
			scale: debugState.scale,
			hasFit: Boolean(selectedFit && debugState.layoutPixelSize),
		};
	}
}

new LayoutScalingService();
