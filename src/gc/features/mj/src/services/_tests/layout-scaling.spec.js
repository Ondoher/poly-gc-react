import { Registry } from "@polylith/core";
import LayoutScalingService, { LAYOUT_METRIC_CSS_VAR_NAMES } from "../layout-scaling.js";

describe("LayoutScalingService", function() {
	function makeMetricSet(overrides = {}) {
		return {
			metricSetId: null,
			tileWidth: 0,
			tileHeight: 0,
			faceWidth: 0,
			faceHeight: 0,
			rightPad: 0,
			bottomPad: 0,
			cellWidth: 0,
			cellHeight: 0,
			depthX: 0,
			depthY: 0,
			canvasWidth: 0,
			canvasHeight: 0,
			...overrides,
		};
	}

	function makeLayout(positions) {
		return {positions};
	}

	function defaultTolerance(overrides = {}) {
		return {
			preferredMinScale: 0.85,
			preferredMaxScale: 1.2,
			minScale: 0.75,
			maxScale: 1.4,
			...overrides,
		};
	}

	function makeCssVars(metricSetsById = {}, rootVars = {}) {
		return {
			buildObject(descriptor = {}, options = {}) {
				let source = descriptor.prefix === "mj"
					? rootVars
					: (metricSetsById[descriptor.prefix] || {});
				let defaults = options.defaults || {};

				return (descriptor.names || []).reduce(function(result, name) {
					if (Object.prototype.hasOwnProperty.call(source, name)) {
						result[name] = source[name];
						return result;
					}

					if (Object.prototype.hasOwnProperty.call(defaults, name)) {
						result[name] = defaults[name];
					}

					return result;
				}, {});
			},
		};
	}

	function makeService(metricSetsById = null, options = {}) {
		let service = new LayoutScalingService(new Registry());
		service.start();
		service.cssVars = makeCssVars(metricSetsById || {}, {
			gridWidth: 30,
			gridHeight: 16,
			gridDepth: 7,
			...(options.rootVars || {}),
		});
		return service;
	}

	function makeSizeConfig(metricSetsById, overrides = {}) {
		let sizeNames = Array.isArray(overrides.sizeNames)
			? overrides.sizeNames
			: Object.keys(metricSetsById || {});

		return {
			layout: overrides.layout,
			availableSpace: overrides.availableSpace,
			padding: overrides.padding,
			scaleTolerance: overrides.scaleTolerance,
			sizeNames,
		};
	}

	describe("Lifecycle", function() {
		it("should subscribe to the css-vars service during ready", function() {
			let registry = new Registry();
			let cssVarsMock = {
				buildObject() {
					return {};
				},
			};

			registry.makeService("mj:css-vars", cssVarsMock, ["buildObject"]);

			let service = new LayoutScalingService(registry);
			service.start();
			service.ready();

			expect(service.cssVars).toBe(registry.subscribe("mj:css-vars"));
		});

		it("should read metric sets from css-vars when size names are provided", function() {
			let service = makeService({
				tiny: makeMetricSet({tileWidth: 30, tileHeight: 40, cellWidth: 10, cellHeight: 20}),
				small: makeMetricSet({tileWidth: 40, tileHeight: 54, cellWidth: 13, cellHeight: 27}),
				medium: makeMetricSet({tileWidth: 48, tileHeight: 66, cellWidth: 16, cellHeight: 33}),
				normal: makeMetricSet({tileWidth: 56, tileHeight: 77, cellWidth: 19, cellHeight: 38}),
			});

			let context = service.normalizeConfig({
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				sizeNames: ["tiny", "small", "medium", "normal"],
				availableSpace: {width: 100, height: 100},
			});

			expect(context.tileMetricSets.length).toBe(4);
			expect(context.tileMetricSets.map(function(metricSet) {
				return metricSet.metricSetId;
			})).toEqual(["tiny", "small", "medium", "normal"]);
		});

		it("should read logical grid dimensions from css-vars during config normalization", function() {
			let service = makeService({}, {
				rootVars: {
					gridWidth: 40,
					gridHeight: 20,
					gridDepth: 9,
				},
			});

			let context = service.normalizeConfig({
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				sizeNames: [],
				availableSpace: {width: 100, height: 100},
			});

			expect(context.logicalGrid).toEqual({
				width: 40,
				height: 20,
				depth: 9,
			});
		});

		it("should fall back to the default logical grid when css-vars are unavailable", function() {
			let service = new LayoutScalingService(new Registry());
			service.start();

			let context = service.normalizeConfig({
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				sizeNames: [],
				availableSpace: {width: 100, height: 100},
			});

			expect(context.logicalGrid).toEqual({
				width: 30,
				height: 16,
				depth: 7,
			});
		});
	});

	describe("Public API", function() {
		it("should return the same view state for the same inputs", function() {
			let metricSets = {
				tiny: makeMetricSet({
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
				}),
			};
			let service = makeService(metricSets);
			let config = makeSizeConfig(metricSets, {
				layout: makeLayout([
					{x: 0, y: 0, z: 0},
					{x: 2, y: 2, z: 0},
				]),
				availableSpace: {width: 100, height: 160},
			});

			let left = service.getViewState(config);
			let right = service.getViewState(config);

			expect(left).toEqual(right);
		});

		it("should not leak request state across calls", function() {
			let metricSets = {
				tiny: makeMetricSet({
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
				}),
				small: makeMetricSet({
					tileWidth: 60,
					tileHeight: 80,
					cellWidth: 20,
					cellHeight: 40,
				}),
			};
			let service = makeService(metricSets);

			let left = service.getViewState(makeSizeConfig(metricSets, {
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				availableSpace: {width: 60, height: 80},
				sizeNames: ["tiny"],
			}));
			let right = service.getViewState(makeSizeConfig(metricSets, {
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				availableSpace: {width: 120, height: 160},
				sizeNames: ["small"],
			}));

			expect(left.metricSetId).toBe("tiny");
			expect(right.metricSetId).toBe("small");
		});

		it("should keep getViewState class-agnostic", function() {
			let metricSets = {
				tiny: makeMetricSet({
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
				}),
			};
			let service = makeService(metricSets);
			let result = service.getViewState(makeSizeConfig(metricSets, {
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				availableSpace: {width: 60, height: 80},
			}));

			expect(Object.keys(result).sort()).toEqual([
				"hasFit",
				"metricSetId",
				"scale",
			]);
			expect(result.sizeClass).toBeUndefined();
			expect(result.faceClass).toBeUndefined();
		});
	});

	describe("Per-Method Unit Tests", function() {
		describe("metric css var contract", function() {
			it("should keep the expected layout metric css var list in sync with the generator contract", function() {
				expect(LAYOUT_METRIC_CSS_VAR_NAMES).toEqual([
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
			});
		});

		describe("normalize helpers", function() {
			it("should normalize finite numbers unchanged", function() {
				let service = makeService();

				expect(service.normalizeNumber(12.5)).toBe(12.5);
			});

			it("should normalize invalid numbers to zero", function() {
				let service = makeService();

				expect(service.normalizeNumber(undefined)).toBe(0);
				expect(service.normalizeNumber(null)).toBe(0);
				expect(service.normalizeNumber(Number.NaN)).toBe(0);
				expect(service.normalizeNumber(Number.POSITIVE_INFINITY)).toBe(0);
			});

			it("should keep valid positive numbers unchanged", function() {
				let service = makeService();

				expect(service.normalizePositiveNumber(1.25, 9)).toBe(1.25);
			});

			it("should fall back for zero negative or invalid positive numbers", function() {
				let service = makeService();

				expect(service.normalizePositiveNumber(0, 9)).toBe(9);
				expect(service.normalizePositiveNumber(-1, 9)).toBe(9);
				expect(service.normalizePositiveNumber(Number.NaN, 9)).toBe(9);
				expect(service.normalizePositiveNumber(undefined, 9)).toBe(9);
			});
		});

		describe("normalizeTileMetrics", function() {
			it("should fill missing metric fields with zero defaults", function() {
				let service = makeService();

				expect(service.normalizeTileMetrics({})).toEqual(makeMetricSet());
			});

			it("should preserve metricSetId only when it is a string", function() {
				let service = makeService();

				expect(service.normalizeTileMetrics({metricSetId: "tiny"}).metricSetId).toBe("tiny");
				expect(service.normalizeTileMetrics({metricSetId: 42}).metricSetId).toBeNull();
			});

			it("should keep canvas dimensions when they are provided", function() {
				let service = makeService();
				let result = service.normalizeTileMetrics({
					canvasWidth: 400,
					canvasHeight: 300,
				});

				expect(result.canvasWidth).toBe(400);
				expect(result.canvasHeight).toBe(300);
			});
		});

		describe("hasUsableTileMetrics", function() {
			it("should reject metric families missing tile dimensions", function() {
				let service = makeService();

				expect(service.hasUsableTileMetrics(makeMetricSet({
					cellWidth: 10,
					cellHeight: 20,
				}))).toBe(false);
			});

			it("should reject metric families missing cell dimensions", function() {
				let service = makeService();

				expect(service.hasUsableTileMetrics(makeMetricSet({
					tileWidth: 30,
					tileHeight: 40,
				}))).toBe(false);
			});

			it("should accept minimally valid metric families", function() {
				let service = makeService();

				expect(service.hasUsableTileMetrics(makeMetricSet({
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
				}))).toBe(true);
			});
		});

		describe("buildMetricCssVarCacheKey", function() {
			it("should change when the prefix changes", function() {
				let service = makeService();

				expect(
					service.buildMetricCssVarCacheKey("tiny", ["tileWidth"])
				).not.toBe(
					service.buildMetricCssVarCacheKey("small", ["tileWidth"])
				);
			});

			it("should change when the variable-name order changes", function() {
				let service = makeService();

				expect(
					service.buildMetricCssVarCacheKey("tiny", ["tileWidth", "tileHeight"])
				).not.toBe(
					service.buildMetricCssVarCacheKey("tiny", ["tileHeight", "tileWidth"])
				);
			});

			it("should change when the defaults change and stay stable for equivalent inputs", function() {
				let service = makeService();
				let left = service.buildMetricCssVarCacheKey("tiny", ["tileWidth"], {tileWidth: 30});
				let same = service.buildMetricCssVarCacheKey("tiny", ["tileWidth"], {tileWidth: 30});
				let different = service.buildMetricCssVarCacheKey("tiny", ["tileWidth"], {tileWidth: 60});

				expect(left).toBe(same);
				expect(left).not.toBe(different);
			});
		});

		describe("compareCandidateFits", function() {
			it("should prefer a hard-range candidate over a non-hard-range candidate", function() {
				let service = makeService();

				let result = service.compareCandidateFits(
					{fitsScaleRange: true, scale: 1.25, tileMetrics: makeMetricSet({tileWidth: 40}), metricSetId: "a"},
					{fitsScaleRange: false, scale: 1.25, tileMetrics: makeMetricSet({tileWidth: 40}), metricSetId: "b"}
				);

				expect(result).toBeLessThan(0);
			});

			it("should prefer a larger-base candidate before a smaller one", function() {
				let service = makeService();

				let result = service.compareCandidateFits(
					{fitsScaleRange: true, scale: 0.8, tileMetrics: makeMetricSet({tileWidth: 60}), metricSetId: "a"},
					{fitsScaleRange: true, scale: 1, tileMetrics: makeMetricSet({tileWidth: 40}), metricSetId: "b"}
				);

				expect(result).toBeLessThan(0);
			});

			it("should prefer a candidate nearer to scale 1 when tile widths match", function() {
				let service = makeService();

				let result = service.compareCandidateFits(
					{fitsScaleRange: true, scale: 0.95, tileMetrics: makeMetricSet({tileWidth: 40}), metricSetId: "a"},
					{fitsScaleRange: true, scale: 0.8, tileMetrics: makeMetricSet({tileWidth: 40}), metricSetId: "b"}
				);

				expect(result).toBeLessThan(0);
			});

			it("should prefer a downscaled candidate over an equally distant upscaled candidate", function() {
				let service = makeService();

				let result = service.compareCandidateFits(
					{fitsScaleRange: true, scale: 0.9, tileMetrics: makeMetricSet({tileWidth: 40}), metricSetId: "a"},
					{fitsScaleRange: true, scale: 1.1, tileMetrics: makeMetricSet({tileWidth: 40}), metricSetId: "b"}
				);

				expect(result).toBeLessThan(0);
			});

			it("should prefer a stable deterministic order when everything else ties", function() {
				let service = makeService();

				let result = service.compareCandidateFits(
					{fitsScaleRange: true, scale: 1, tileMetrics: makeMetricSet({tileWidth: 40}), metricSetId: "alpha"},
					{fitsScaleRange: true, scale: 1, tileMetrics: makeMetricSet({tileWidth: 40}), metricSetId: "beta"}
				);

				expect(result).toBeLessThan(0);
			});
		});

		describe("evaluateMetricSets", function() {
			it("should return one candidate per metric set when dependencies are stubbed", function() {
				let service = makeService();
				let context = {
					tileMetricSets: [
						makeMetricSet({metricSetId: "tiny"}),
						makeMetricSet({metricSetId: "small"}),
					],
					logicalGrid: {width: 30, height: 16, depth: 7},
					scaleTolerance: defaultTolerance(),
				};
				spyOn(service, "calculateLayoutPixelSizeForMetrics").and.returnValue({width: 50, height: 50});
				spyOn(service, "compareCandidateFits").and.returnValue(0);

				let result = service.evaluateMetricSets(context, {minZ: 0}, {width: 100, height: 100});

				expect(result.length).toBe(2);
			});

			it("should calculate scaleX scaleY and scale from stubbed layout sizes", function() {
				let service = makeService();
				let context = {
					tileMetricSets: [makeMetricSet({metricSetId: "tiny"})],
					logicalGrid: {width: 30, height: 16, depth: 7},
					scaleTolerance: defaultTolerance(),
				};
				spyOn(service, "calculateLayoutPixelSizeForMetrics").and.returnValue({width: 50, height: 80});
				spyOn(service, "compareCandidateFits").and.returnValue(0);

				let result = service.evaluateMetricSets(context, {minZ: 0}, {width: 100, height: 120})[0];

				expect(result.scaleX).toBe(2);
				expect(result.scaleY).toBe(1.5);
				expect(result.scale).toBe(1.5);
			});

			it("should mark fitsScaleRange correctly from the active tolerances", function() {
				let service = makeService();
				let context = {
					tileMetricSets: [makeMetricSet({metricSetId: "tiny"})],
					logicalGrid: {width: 30, height: 16, depth: 7},
					scaleTolerance: defaultTolerance(),
				};
				spyOn(service, "calculateLayoutPixelSizeForMetrics").and.returnValue({width: 100, height: 200});
				spyOn(service, "compareCandidateFits").and.returnValue(0);

				let result = service.evaluateMetricSets(context, {minZ: 0}, {width: 50, height: 100})[0];

				expect(result.fitsScaleRange).toBe(false);
			});

			it("should mark inPreferredScaleRange correctly from the active tolerances", function() {
				let service = makeService();
				let context = {
					tileMetricSets: [makeMetricSet({metricSetId: "tiny"})],
					logicalGrid: {width: 30, height: 16, depth: 7},
					scaleTolerance: defaultTolerance(),
				};
				spyOn(service, "calculateLayoutPixelSizeForMetrics").and.returnValue({width: 100, height: 100});
				spyOn(service, "compareCandidateFits").and.returnValue(0);

				let result = service.evaluateMetricSets(context, {minZ: 0}, {width: 90, height: 90})[0];

				expect(result.inPreferredScaleRange).toBe(true);
			});

			it("should calculate scaledWidth and scaledHeight from stubbed pixel sizes", function() {
				let service = makeService();
				let context = {
					tileMetricSets: [makeMetricSet({metricSetId: "tiny"})],
					logicalGrid: {width: 30, height: 16, depth: 7},
					scaleTolerance: defaultTolerance(),
				};
				spyOn(service, "calculateLayoutPixelSizeForMetrics").and.returnValue({width: 40, height: 80});
				spyOn(service, "compareCandidateFits").and.returnValue(0);

				let result = service.evaluateMetricSets(context, {minZ: 0}, {width: 100, height: 120})[0];

				expect(result.scaledWidth).toBe(60);
				expect(result.scaledHeight).toBe(120);
			});

			it("should attach the inner available space to each candidate", function() {
				let service = makeService();
				let context = {
					tileMetricSets: [makeMetricSet({metricSetId: "tiny"})],
					logicalGrid: {width: 30, height: 16, depth: 7},
					scaleTolerance: defaultTolerance(),
				};
				spyOn(service, "calculateLayoutPixelSizeForMetrics").and.returnValue({width: 40, height: 40});
				spyOn(service, "compareCandidateFits").and.returnValue(0);

				let innerAvailableSpace = {width: 100, height: 120};
				let result = service.evaluateMetricSets(context, {minZ: 0}, innerAvailableSpace)[0];

				expect(result.availableSpace).toBe(innerAvailableSpace);
			});

			it("should populate scaleQuality", function() {
				let service = makeService();
				let context = {
					tileMetricSets: [makeMetricSet({metricSetId: "tiny"})],
					logicalGrid: {width: 30, height: 16, depth: 7},
					scaleTolerance: defaultTolerance(),
				};
				spyOn(service, "calculateLayoutPixelSizeForMetrics").and.returnValue({width: 100, height: 100});
				spyOn(service, "compareCandidateFits").and.returnValue(0);

				let result = service.evaluateMetricSets(context, {minZ: 0}, {width: 90, height: 90})[0];

				expect(result.scaleQuality).toEqual({
					isDownscale: true,
					isUpscale: false,
					isNearNative: false,
					isComfortable: true,
					exceedsHardLimit: false,
				});
			});

			it("should sort candidates by compareCandidateFits when the comparator is stubbed", function() {
				let service = makeService();
				let context = {
					tileMetricSets: [
						makeMetricSet({metricSetId: "b"}),
						makeMetricSet({metricSetId: "a"}),
					],
					logicalGrid: {width: 30, height: 16, depth: 7},
					scaleTolerance: defaultTolerance(),
				};
				spyOn(service, "calculateLayoutPixelSizeForMetrics").and.returnValue({width: 50, height: 50});
				spyOn(service, "compareCandidateFits").and.callFake(function(left, right) {
					return left.metricSetId.localeCompare(right.metricSetId);
				});

				let result = service.evaluateMetricSets(context, {minZ: 0}, {width: 100, height: 100});

				expect(result.map(function(candidate) {
					return candidate.metricSetId;
				})).toEqual(["a", "b"]);
			});
		});

		describe("css-vars metric ingestion", function() {
			it("should return null when cssVars is unavailable", function() {
				let service = makeService();
				service.cssVars = null;

				expect(service.readMetricSetFromCssVars("tiny")).toBeNull();
			});

			it("should return null for blank metric set ids", function() {
				let service = makeService();

				expect(service.readMetricSetFromCssVars("")).toBeNull();
				expect(service.readMetricSetFromCssVars("   ")).toBeNull();
			});

			it("should cache metric objects by prefix and variable-name list", function() {
				let service = makeService();
				let buildCount = 0;

				service.cssVars = {
					buildObject() {
						buildCount += 1;

						return {
							tileWidth: 30,
							tileHeight: 40,
							cellWidth: 10,
							cellHeight: 20,
						};
					},
				};

				let left = service.readMetricSetFromCssVars("tiny");
				let right = service.readMetricSetFromCssVars("tiny");

				expect(left).toBe(right);
				expect(buildCount).toBe(1);
			});

			it("should treat different defaults as different cache entries", function() {
				let service = makeService();
				let buildCount = 0;

				service.cssVars = {
					buildObject(_descriptor, options = {}) {
						buildCount += 1;

						return {
							tileWidth: options.defaults?.tileWidth || 30,
							tileHeight: 40,
							cellWidth: 10,
							cellHeight: 20,
						};
					},
				};

				let left = service.readMetricSetFromCssVars("tiny", undefined, {tileWidth: 30});
				let right = service.readMetricSetFromCssVars("tiny", undefined, {tileWidth: 60});

				expect(left).not.toBe(right);
				expect(left.tileWidth).toBe(30);
				expect(right.tileWidth).toBe(60);
				expect(buildCount).toBe(2);
			});

			it("should trim the metric set id before reading and include it in the normalized result", function() {
				let service = makeService();
				let recordedPrefix = null;

				service.cssVars = {
					buildObject(descriptor) {
						recordedPrefix = descriptor.prefix;
						return {
							tileWidth: 30,
							tileHeight: 40,
							cellWidth: 10,
							cellHeight: 20,
						};
					},
				};

				let result = service.readMetricSetFromCssVars(" tiny ");

				expect(recordedPrefix).toBe("tiny");
				expect(result.metricSetId).toBe("tiny");
			});

			it("should return null and cache null when the built metric family is unusable", function() {
				let service = makeService();
				let buildCount = 0;

				service.cssVars = {
					buildObject() {
						buildCount += 1;
						return {
							tileWidth: 30,
							tileHeight: 40,
						};
					},
				};

				expect(service.readMetricSetFromCssVars("tiny")).toBeNull();
				expect(service.readMetricSetFromCssVars("tiny")).toBeNull();
				expect(buildCount).toBe(1);
			});
		});

		describe("readMetricSetsFromCssVars", function() {
			it("should preserve requested order while filtering invalid families", function() {
				let service = makeService({
					small: makeMetricSet({tileWidth: 60, tileHeight: 80, cellWidth: 20, cellHeight: 40}),
					tiny: makeMetricSet({tileWidth: 30, tileHeight: 40, cellWidth: 10, cellHeight: 20}),
				});

				let result = service.readMetricSetsFromCssVars(["small", "missing", "tiny"]);

				expect(result.map(function(metricSet) {
					return metricSet.metricSetId;
				})).toEqual(["small", "tiny"]);
			});

			it("should handle non-array inputs as empty", function() {
				let service = makeService();

				expect(service.readMetricSetsFromCssVars(null)).toEqual([]);
			});
		});

		describe("scoreCandidateQuality", function() {
			it("should return Infinity for invalid or non-positive scales", function() {
				let service = makeService();

				expect(service.scoreCandidateQuality({scale: 0})).toBe(Number.POSITIVE_INFINITY);
				expect(service.scoreCandidateQuality({scale: -1})).toBe(Number.POSITIVE_INFINITY);
				expect(service.scoreCandidateQuality({scale: Number.NaN})).toBe(Number.POSITIVE_INFINITY);
			});

			it("should prefer exact native scale and apply the slight upscale penalty", function() {
				let service = makeService();

				expect(service.scoreCandidateQuality({scale: 1})).toBe(0);
				expect(service.scoreCandidateQuality({scale: 1.1})).toBeGreaterThan(
					service.scoreCandidateQuality({scale: 0.9})
				);
			});
		});

		describe("getDebugState", function() {
			it("should return the full internal snapshot from calculate when calculate is stubbed", function() {
				let service = makeService();
				let snapshot = {scale: 1.25, pendingInputs: ["x"]};
				spyOn(service, "calculate").and.returnValue(snapshot);

				expect(service.getDebugState({foo: "bar"})).toBe(snapshot);
			});

			it("should preserve candidate diagnostics that are not exposed by getViewState", function() {
				let service = makeService();
				let snapshot = {
					candidateFits: [{metricSetId: "tiny"}],
					selectedFit: {metricSetId: "tiny"},
					layoutPixelSize: {width: 40, height: 50},
					scale: 1,
					pendingInputs: [],
				};
				spyOn(service, "calculate").and.returnValue(snapshot);

				expect(service.getDebugState({}).candidateFits).toEqual([{metricSetId: "tiny"}]);
			});

			it("should preserve pendingInputs from the internal snapshot", function() {
				let service = makeService();
				let snapshot = {
					candidateFits: [],
					selectedFit: null,
					layoutPixelSize: null,
					scale: 1,
					pendingInputs: ["missing metrics"],
				};
				spyOn(service, "calculate").and.returnValue(snapshot);

				expect(service.getDebugState({}).pendingInputs).toEqual(["missing metrics"]);
			});
		});

		describe("scaleQuality helper", function() {
			it("should identify downscale candidates correctly", function() {
				let service = makeService();

				expect(service.buildScaleQuality(0.9, defaultTolerance()).isDownscale).toBe(true);
			});

			it("should identify upscale candidates correctly", function() {
				let service = makeService();

				expect(service.buildScaleQuality(1.1, defaultTolerance()).isUpscale).toBe(true);
			});

			it("should identify near-native candidates correctly", function() {
				let service = makeService();

				expect(service.buildScaleQuality(1, defaultTolerance()).isNearNative).toBe(true);
			});

			it("should mark comfortable candidates correctly", function() {
				let service = makeService();

				expect(service.buildScaleQuality(0.9, defaultTolerance()).isComfortable).toBe(true);
			});

			it("should mark hard-limit overflow correctly", function() {
				let service = makeService();

				expect(service.buildScaleQuality(1.5, defaultTolerance()).exceedsHardLimit).toBe(true);
			});
		});

		describe("layout geometry helpers", function() {
			it("should calculate layout bounds correctly for negative coordinates and non-zero z ranges", function() {
				let service = makeService();
				let result = service.calculateLayoutBounds([
					{x: -2, y: 3, z: 2},
					{x: 4, y: -1, z: 5},
				]);

				expect(result).toEqual({
					minX: -2,
					maxX: 4,
					minY: -1,
					maxY: 3,
					minZ: 2,
					maxZ: 5,
					gridWidth: 8,
					gridHeight: 6,
					gridDepth: 4,
				});
			});

			it("should subtract padding and clamp inner available space at zero", function() {
				let service = makeService();

				expect(service.calculateInnerAvailableSpace(
					{width: 100, height: 80},
					{left: 10, right: 20, top: 5, bottom: 15}
				)).toEqual({
					width: 70,
					height: 60,
				});

				expect(service.calculateInnerAvailableSpace(
					{width: 10, height: 10},
					{left: 20, right: 20, top: 20, bottom: 20}
				)).toEqual({
					width: 0,
					height: 0,
				});
			});

			it("should return null layout pixel size when bounds or metrics are missing", function() {
				let service = makeService();
				let logicalGrid = {width: 30, height: 16, depth: 7};

				expect(service.calculateLayoutPixelSizeForMetrics(null, makeMetricSet(), logicalGrid)).toBeNull();
				expect(service.calculateLayoutPixelSizeForMetrics([{x: 0, y: 0, z: 0}], null, logicalGrid)).toBeNull();
			});

			it("should include depth contribution when calculating layout pixel size", function() {
				let service = makeService();
				let result = service.calculateLayoutPixelSizeForMetrics([
					{x: 0, y: 0, z: 0},
					{x: 0, y: 0, z: 2},
				], makeMetricSet({
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
					depthX: 3,
					depthY: 4,
				}), {
					width: 1,
					height: 1,
					depth: 3,
				});

				expect(result).toEqual({
					width: 36,
					height: 48,
				});
			});
		});

		describe("normalizeConfig", function() {
			it("should prefer explicit positions over layout positions", function() {
				let service = makeService();
				let explicitPositions = [{x: 1, y: 1, z: 1}];
				let layoutPositions = [{x: 0, y: 0, z: 0}];

				let result = service.normalizeConfig({
					layout: makeLayout(layoutPositions),
					positions: explicitPositions,
				});

				expect(result.positions).toEqual(explicitPositions);
			});

			it("should trim valid size names and drop empty ones", function() {
				let service = makeService({
					tiny: makeMetricSet({tileWidth: 30, tileHeight: 40, cellWidth: 10, cellHeight: 20}),
					small: makeMetricSet({tileWidth: 60, tileHeight: 80, cellWidth: 20, cellHeight: 40}),
				});

				let result = service.normalizeConfig({
					sizeNames: [" tiny ", "", "   ", "small"],
				});

				expect(result.sizeNames).toEqual(["tiny", "small"]);
				expect(result.tileMetricSets.map(function(metricSet) {
					return metricSet.metricSetId;
				})).toEqual(["tiny", "small"]);
			});

			it("should apply default scale tolerance and zero-fill missing available space and padding", function() {
				let service = makeService();
				let result = service.normalizeConfig({});

				expect(result.availableSpace).toEqual({width: 0, height: 0});
				expect(result.padding).toEqual({left: 0, right: 0, top: 0, bottom: 0});
				expect(result.scaleTolerance).toEqual({
					preferredMinScale: 0.85,
					preferredMaxScale: 1.2,
					minScale: 0.75,
					maxScale: 2,
				});
			});

			it("should not read metric sets when no size names are provided", function() {
				let service = makeService();
				spyOn(service, "readMetricSetsFromCssVars").and.callThrough();

				let result = service.normalizeConfig({});

				expect(service.readMetricSetsFromCssVars).not.toHaveBeenCalled();
				expect(result.tileMetricSets).toEqual([]);
			});
		});

		describe("buildPendingInputs", function() {
			it("should report only missing-space when metrics exist", function() {
				let service = makeService();
				let result = service.buildPendingInputs({
					availableSpace: {width: 0, height: 100},
					tileMetricSets: [makeMetricSet({tileWidth: 30, tileHeight: 40, cellWidth: 10, cellHeight: 20})],
				});

				expect(result).toEqual([
					"live playfield measurement source is not wired yet",
				]);
			});

			it("should report only missing-metrics when available space exists", function() {
				let service = makeService();
				let result = service.buildPendingInputs({
					availableSpace: {width: 100, height: 100},
					tileMetricSets: [],
				});

				expect(result).toEqual([
					"generated tile metrics are unavailable",
				]);
			});

			it("should return no pending inputs when both space and metrics are valid", function() {
				let service = makeService();
				let result = service.buildPendingInputs({
					availableSpace: {width: 100, height: 100},
					tileMetricSets: [makeMetricSet({tileWidth: 30, tileHeight: 40, cellWidth: 10, cellHeight: 20})],
				});

				expect(result).toEqual([]);
			});
		});

		describe("calculate", function() {
			it("should return scale 1 when no candidate is selected", function() {
				let service = makeService();
				spyOn(service, "normalizeConfig").and.returnValue({
					positions: [],
					sizeNames: [],
					logicalGrid: {width: 30, height: 16, depth: 7},
					availableSpace: {width: 100, height: 100},
					padding: {left: 0, right: 0, top: 0, bottom: 0},
					tileMetricSets: [],
					scaleTolerance: defaultTolerance(),
				});
				spyOn(service, "calculateLayoutBounds").and.returnValue(null);
				spyOn(service, "calculateInnerAvailableSpace").and.returnValue({width: 100, height: 100});
				spyOn(service, "evaluateMetricSets").and.returnValue([]);
				spyOn(service, "buildPendingInputs").and.returnValue([]);

				let result = service.calculate({});

				expect(result.selectedFit).toBeNull();
				expect(result.scale).toBe(1);
			});

			it("should use the first sorted candidate as the selected fit and preserve tolerance", function() {
				let service = makeService();
				let context = {
					positions: [{x: 0, y: 0, z: 0}],
					sizeNames: ["small", "tiny"],
					logicalGrid: {width: 30, height: 16, depth: 7},
					availableSpace: {width: 100, height: 100},
					padding: {left: 0, right: 0, top: 0, bottom: 0},
					tileMetricSets: [],
					scaleTolerance: defaultTolerance(),
				};
				let candidates = [
					{metricSetId: "small", layoutPixelSize: {width: 40, height: 50}, scale: 1},
					{metricSetId: "tiny", layoutPixelSize: {width: 30, height: 40}, scale: 0.9},
				];

				spyOn(service, "normalizeConfig").and.returnValue(context);
				spyOn(service, "calculateLayoutBounds").and.returnValue({minZ: 0});
				spyOn(service, "calculateInnerAvailableSpace").and.returnValue({width: 100, height: 100});
				spyOn(service, "evaluateMetricSets").and.returnValue(candidates);
				spyOn(service, "buildPendingInputs").and.returnValue([]);

				let result = service.calculate({});

				expect(result.selectedFit).toBe(candidates[0]);
				expect(result.layoutPixelSize).toEqual({width: 40, height: 50});
				expect(result.scale).toBe(1);
				expect(result.scaleTolerance).toEqual(defaultTolerance());
			});
		});
	});

	describe("Metric Selection", function() {
		it("should choose the best metric set and derive the scale", function() {
			let metricSets = {
				tiny: makeMetricSet({
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
				}),
				small: makeMetricSet({
					tileWidth: 60,
					tileHeight: 80,
					cellWidth: 20,
					cellHeight: 40,
				}),
			};
			let service = makeService(metricSets, {
				rootVars: {
					gridWidth: 3,
					gridHeight: 3,
					gridDepth: 1,
				},
			});
			let viewState = service.getViewState(makeSizeConfig(metricSets, {
				layout: makeLayout([
					{x: 0, y: 0, z: 0},
					{x: 2, y: 2, z: 0},
				]),
				availableSpace: {width: 100, height: 160},
			}));

			expect(viewState).toEqual({
				metricSetId: "small",
				scale: 1,
				hasFit: true,
			});
		});

		it("should choose the candidate closest to scale 1 when tile widths match", function() {
			let metricSets = {
				native: makeMetricSet({
					tileWidth: 100,
					tileHeight: 100,
					cellWidth: 50,
					cellHeight: 50,
				}),
				"slightly-scaled": makeMetricSet({
					tileWidth: 90,
					tileHeight: 90,
					cellWidth: 45,
					cellHeight: 45,
				}),
			};
			let service = makeService(metricSets);
			let result = service.getViewState(makeSizeConfig(metricSets, {
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				availableSpace: {width: 100, height: 100},
			}));

			expect(result.metricSetId).toBe("native");
		});

		it("should prefer moderate downscale over equivalent upscale when tile widths match", function() {
			let metricSets = {
				downscale: makeMetricSet({
					tileWidth: 111.1111111,
					tileHeight: 111.1111111,
					cellWidth: 55.55555555,
					cellHeight: 55.55555555,
				}),
				upscale: makeMetricSet({
					tileWidth: 90.9090909,
					tileHeight: 90.9090909,
					cellWidth: 45.45454545,
					cellHeight: 45.45454545,
				}),
			};
			let service = makeService(metricSets);
			let result = service.getViewState(makeSizeConfig(metricSets, {
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				availableSpace: {width: 100, height: 100},
			}));

			expect(result.metricSetId).toBe("downscale");
		});

		it("should break ties by larger tile width", function() {
			let metricSets = {
				"larger-tile": makeMetricSet({
					tileWidth: 60,
					tileHeight: 80,
					cellWidth: 20,
					cellHeight: 40,
				}),
				"smaller-tile": makeMetricSet({
					tileWidth: 40,
					tileHeight: 80,
					cellWidth: 30,
					cellHeight: 40,
				}),
			};
			let service = makeService(metricSets);
			let result = service.getViewState(makeSizeConfig(metricSets, {
				layout: makeLayout([
					{x: 0, y: 0, z: 0},
					{x: 2, y: 0, z: 0},
				]),
				availableSpace: {width: 100, height: 80},
			}));

			expect(result.metricSetId).toBe("larger-tile");
		});

		it("should reject an out-of-range candidate in favor of a smaller valid one", function() {
			let metricSets = {
				"valid-smaller": makeMetricSet({
					tileWidth: 120,
					tileHeight: 120,
					cellWidth: 60,
					cellHeight: 60,
				}),
				"too-large": makeMetricSet({
					tileWidth: 140,
					tileHeight: 140,
					cellWidth: 70,
					cellHeight: 70,
				}),
			};
			let service = makeService(metricSets, {
				rootVars: {
					gridWidth: 1,
					gridHeight: 1,
					gridDepth: 1,
				},
			});
			let result = service.getViewState(makeSizeConfig(metricSets, {
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				availableSpace: {width: 100, height: 100},
			}));

			expect(result.metricSetId).toBe("valid-smaller");
		});
	});

	describe("Layout Shapes", function() {
		it("should handle an empty layout", function() {
			let metricSets = {
				tiny: makeMetricSet({
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
				}),
			};
			let service = makeService(metricSets);
			let result = service.getDebugState(makeSizeConfig(metricSets, {
				layout: makeLayout([]),
				availableSpace: {width: 100, height: 100},
			}));

			expect(result.layoutBounds).toBeNull();
			expect(result.candidateFits).toEqual([]);
			expect(result.selectedFit).toBeNull();
		});

		it("should handle a single tile at the origin", function() {
			let metricSets = {
				tiny: makeMetricSet({
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
				}),
			};
			let service = makeService(metricSets);
			let result = service.getDebugState(makeSizeConfig(metricSets, {
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				availableSpace: {width: 100, height: 100},
			}));

			expect(result.layoutBounds).toEqual({
				minX: 0,
				maxX: 0,
				minY: 0,
				maxY: 0,
				minZ: 0,
				maxZ: 0,
				gridWidth: 2,
				gridHeight: 2,
				gridDepth: 1,
			});
			expect(result.layoutPixelSize).toEqual({width: 30, height: 40});
		});

		it("should handle a two-tile horizontal span", function() {
			let metricSets = {
				tiny: makeMetricSet({
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
				}),
			};
			let service = makeService(metricSets);
			let result = service.getDebugState(makeSizeConfig(metricSets, {
				layout: makeLayout([
					{x: 0, y: 0, z: 0},
					{x: 2, y: 0, z: 0},
				]),
				availableSpace: {width: 200, height: 100},
			}));

			expect(result.layoutBounds.gridWidth).toBe(4);
			expect(result.layoutPixelSize.width).toBe(50);
			expect(result.layoutPixelSize.height).toBe(40);
		});

		it("should handle a two-tile vertical span", function() {
			let metricSets = {
				tiny: makeMetricSet({
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
				}),
			};
			let service = makeService(metricSets);
			let result = service.getDebugState(makeSizeConfig(metricSets, {
				layout: makeLayout([
					{x: 0, y: 0, z: 0},
					{x: 0, y: 2, z: 0},
				]),
				availableSpace: {width: 100, height: 200},
			}));

			expect(result.layoutBounds.gridHeight).toBe(4);
			expect(result.layoutPixelSize.width).toBe(30);
			expect(result.layoutPixelSize.height).toBe(80);
		});

		it("should handle a realistic deep stack layout end to end", function() {
			let metricSets = {
				tiny: makeMetricSet({
					metricSetId: "tiny",
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
					depthX: 4,
					depthY: 3,
				}),
				small: makeMetricSet({
					metricSetId: "small",
					tileWidth: 60,
					tileHeight: 80,
					cellWidth: 20,
					cellHeight: 40,
					depthX: 8,
					depthY: 6,
				}),
			};
			let service = makeService(metricSets);
			let result = service.getDebugState(makeSizeConfig(metricSets, {
				layout: makeLayout([
					{x: 0, y: 0, z: 0},
					{x: 2, y: 0, z: 1},
					{x: 4, y: 2, z: 3},
				]),
				availableSpace: {width: 150, height: 180},
			}));

			expect(result.layoutBounds).toEqual({
				minX: 0,
				maxX: 4,
				minY: 0,
				maxY: 2,
				minZ: 0,
				maxZ: 3,
				gridWidth: 6,
				gridHeight: 4,
				gridDepth: 4,
			});
			expect(result.candidateFits[0].metricSetId).toBe("small");
			expect(result.selectedFit.metricSetId).toBe("small");
			expect(result.layoutPixelSize).toEqual({width: 188, height: 196});
			expect(result.scale).toBeCloseTo(Math.min(150 / 188, 180 / 196), 6);
		});

		it("should let depth contribution force a larger metric family out of range", function() {
			let metricSets = {
				tiny: makeMetricSet({
					metricSetId: "tiny",
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
					depthX: 1,
					depthY: 1,
				}),
				small: makeMetricSet({
					metricSetId: "small",
					tileWidth: 60,
					tileHeight: 80,
					cellWidth: 20,
					cellHeight: 40,
					depthX: 10,
					depthY: 10,
				}),
			};
			let service = makeService(metricSets);
			let result = service.getDebugState(makeSizeConfig(metricSets, {
				layout: makeLayout([
					{x: 0, y: 0, z: 0},
					{x: 0, y: 0, z: 6},
				]),
				availableSpace: {width: 45, height: 55},
			}));

			expect(result.selectedFit.metricSetId).toBe("tiny");
			expect(result.candidateFits.map(function(candidate) {
				return candidate.metricSetId;
			})).toEqual(["tiny", "small"]);
		});

		it("should cap rendered scale at the normal metric family hard max", function() {
			let metricSets = {
				tiny: makeMetricSet({
					metricSetId: "tiny",
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
				}),
				normal: makeMetricSet({
					metricSetId: "normal",
					tileWidth: 60,
					tileHeight: 80,
					cellWidth: 20,
					cellHeight: 40,
				}),
			};
			let service = makeService(metricSets);
			let result = service.getDebugState(makeSizeConfig(metricSets, {
				layout: makeLayout([
					{x: 13, y: 7, z: 0},
					{x: 15, y: 7, z: 0},
					{x: 13, y: 9, z: 0},
					{x: 15, y: 9, z: 0},
				]),
				availableSpace: {width: 5000, height: 5000},
				scaleTolerance: defaultTolerance({maxScale: 2}),
			}));

			expect(result.selectedFit.metricSetId).toBe("normal");
			expect(result.selectedFit.requestedScale).toBeGreaterThan(2);
			expect(result.selectedFit.maxRenderedScale).toBe(2);
			expect(result.selectedFit.scale).toBe(2);
			expect(result.scale).toBe(2);
		});
	});

	describe("Available Space", function() {
		it("should handle zero width and zero height", function() {
			let metricSets = {
				tiny: makeMetricSet({
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
				}),
			};
			let service = makeService(metricSets);
			let result = service.getDebugState(makeSizeConfig(metricSets, {
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				availableSpace: {width: 0, height: 0},
			}));

			expect(result.innerAvailableSpace).toEqual({width: 0, height: 0});
			expect(result.scale).toBe(0);
		});

		it("should handle an exact-fit available space", function() {
			let metricSets = {
				tiny: makeMetricSet({
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
				}),
			};
			let service = makeService(metricSets);
			let result = service.getViewState(makeSizeConfig(metricSets, {
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				availableSpace: {width: 30, height: 40},
			}));

			expect(result.scale).toBe(1);
			expect(result.hasFit).toBe(true);
		});

		it("should handle width that is too small while height is sufficient", function() {
			let metricSets = {
				tiny: makeMetricSet({
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
				}),
			};
			let service = makeService(metricSets);
			let result = service.getDebugState(makeSizeConfig(metricSets, {
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				availableSpace: {width: 45, height: 100},
			}));

			expect(result.selectedFit.scaleX).toBe(1.5);
			expect(result.selectedFit.scaleY).toBe(2.5);
			expect(result.scale).toBe(1.5);
		});

		it("should handle height that is too small while width is sufficient", function() {
			let metricSets = {
				tiny: makeMetricSet({
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
				}),
			};
			let service = makeService(metricSets);
			let result = service.getDebugState(makeSizeConfig(metricSets, {
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				availableSpace: {width: 100, height: 32},
			}));

			expect(result.selectedFit.scaleX).toBeCloseTo(3.333333, 5);
			expect(result.selectedFit.scaleY).toBe(0.8);
			expect(result.scale).toBe(0.8);
		});

		it("should handle available space reduced by padding to near zero", function() {
			let metricSets = {
				tiny: makeMetricSet({
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
				}),
			};
			let service = makeService(metricSets);
			let result = service.getDebugState(makeSizeConfig(metricSets, {
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				availableSpace: {width: 100, height: 100},
				padding: {left: 49, right: 49, top: 49, bottom: 49},
			}));

			expect(result.innerAvailableSpace).toEqual({width: 2, height: 2});
			expect(result.scale).toBeCloseTo(0.05, 5);
		});
	});

	describe("Metric Families", function() {
		it("should handle missing metric data", function() {
			let service = makeService();
			let result = service.getDebugState({
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				availableSpace: {width: 100, height: 100},
				sizeNames: ["tiny"],
			});

			expect(result.candidateFits).toEqual([]);
			expect(result.selectedFit).toBeNull();
		});

		it("should handle a single metric family", function() {
			let metricSets = {
				only: makeMetricSet({
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
				}),
			};
			let service = makeService(metricSets);
			let result = service.getDebugState(makeSizeConfig(metricSets, {
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				availableSpace: {width: 100, height: 100},
			}));

			expect(result.candidateFits.length).toBe(1);
			expect(result.selectedFit.metricSetId).toBe("only");
		});

		it("should ignore malformed metric families and keep valid families in play", function() {
			let service = makeService();

			service.cssVars = makeCssVars({
				broken: {
					tileWidth: 30,
					tileHeight: 40,
				},
				valid: {
					tileWidth: 30,
					tileHeight: 40,
					cellWidth: 10,
					cellHeight: 20,
				},
			});

			let result = service.getDebugState({
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				availableSpace: {width: 100, height: 100},
				sizeNames: ["broken", "valid"],
			});

			expect(result.candidateFits.length).toBe(1);
			expect(result.selectedFit.metricSetId).toBe("valid");
		});

		it("should treat a fully malformed family request as unavailable generated metrics", function() {
			let service = makeService();

			service.cssVars = makeCssVars({
				broken: {
					faceWidth: 30,
					faceHeight: 40,
				},
			});

			let result = service.getDebugState({
				layout: makeLayout([{x: 0, y: 0, z: 0}]),
				availableSpace: {width: 100, height: 100},
				sizeNames: ["broken"],
			});

			expect(result.candidateFits).toEqual([]);
			expect(result.selectedFit).toBeNull();
			expect(result.pendingInputs).toEqual([
				"generated tile metrics are unavailable",
			]);
		});
	});

	describe("Debug State", function() {
		it("should return debug information for missing inputs", function() {
			let service = makeService();
			let debugState = service.getDebugState({
				layout: makeLayout([]),
				availableSpace: {width: 0, height: 0},
				sizeNames: ["tiny"],
			});

			expect(debugState.layoutBounds).toBeNull();
			expect(debugState.selectedFit).toBeNull();
			expect(debugState.layoutPixelSize).toBeNull();
			expect(debugState.scale).toBe(1);
			expect(debugState.pendingInputs).toEqual([
				"live playfield measurement source is not wired yet",
				"generated tile metrics are unavailable",
			]);
		});
	});

	describe("Public API Integration", function() {
		describe("getViewState", function() {
			it("should choose the expected metric set in a realistic multi-family case", function() {
				let metricSets = {
					tiny: makeMetricSet({tileWidth: 30, tileHeight: 40, cellWidth: 10, cellHeight: 20}),
					small: makeMetricSet({tileWidth: 60, tileHeight: 80, cellWidth: 20, cellHeight: 40}),
				};
				let service = makeService(metricSets);

				let result = service.getViewState(makeSizeConfig(metricSets, {
					layout: makeLayout([
						{x: 0, y: 0, z: 0},
						{x: 2, y: 2, z: 0},
					]),
					availableSpace: {width: 100, height: 160},
				}));

				expect(result.metricSetId).toBe("small");
			});

			it("should return only the minimal controller-facing shape", function() {
				let metricSets = {
					tiny: makeMetricSet({tileWidth: 30, tileHeight: 40, cellWidth: 10, cellHeight: 20}),
				};
				let service = makeService(metricSets);
				let result = service.getViewState(makeSizeConfig(metricSets, {
					layout: makeLayout([{x: 0, y: 0, z: 0}]),
					availableSpace: {width: 60, height: 80},
				}));

				expect(result).toEqual(jasmine.objectContaining({
					metricSetId: jasmine.anything(),
					scale: jasmine.any(Number),
					hasFit: jasmine.any(Boolean),
				}));
				expect(result.layoutBounds).toBeUndefined();
				expect(result.pendingInputs).toBeUndefined();
			});

			it("should handle an empty layout gracefully", function() {
				let metricSets = {
					tiny: makeMetricSet({tileWidth: 30, tileHeight: 40, cellWidth: 10, cellHeight: 20}),
				};
				let service = makeService(metricSets);
				let result = service.getViewState(makeSizeConfig(metricSets, {
					layout: makeLayout([]),
					availableSpace: {width: 100, height: 100},
				}));

				expect(result).toEqual({
					metricSetId: null,
					scale: 1,
					hasFit: false,
				});
			});

			it("should handle wide available space correctly end to end", function() {
				let metricSets = {
					tiny: makeMetricSet({tileWidth: 30, tileHeight: 40, cellWidth: 10, cellHeight: 20}),
				};
				let service = makeService(metricSets);
				let result = service.getViewState(makeSizeConfig(metricSets, {
					layout: makeLayout([
						{x: 0, y: 0, z: 0},
						{x: 4, y: 0, z: 0},
					]),
					availableSpace: {width: 200, height: 80},
				}));

				expect(result.hasFit).toBe(true);
				expect(result.scale).toBeGreaterThan(0);
			});

			it("should handle tall available space correctly end to end", function() {
				let metricSets = {
					tiny: makeMetricSet({tileWidth: 30, tileHeight: 40, cellWidth: 10, cellHeight: 20}),
				};
				let service = makeService(metricSets);
				let result = service.getViewState(makeSizeConfig(metricSets, {
					layout: makeLayout([
						{x: 0, y: 0, z: 0},
						{x: 0, y: 4, z: 0},
					]),
					availableSpace: {width: 80, height: 200},
				}));

				expect(result.hasFit).toBe(true);
				expect(result.scale).toBeGreaterThan(0);
			});

			it("should reflect the current quality preference in the final choice", function() {
				let metricSets = {
					downscale: makeMetricSet({tileWidth: 60, tileHeight: 80, cellWidth: 20, cellHeight: 40}),
					upscale: makeMetricSet({tileWidth: 50, tileHeight: 66.6666667, cellWidth: 20, cellHeight: 40}),
				};
				let service = makeService(metricSets);
				let result = service.getViewState(makeSizeConfig(metricSets, {
					layout: makeLayout([{x: 0, y: 0, z: 0}]),
					availableSpace: {width: 55, height: 73},
				}));

				expect(result.metricSetId).toBe("downscale");
			});
		});

		describe("getDebugState", function() {
			it("should return the full candidate set end to end", function() {
				let metricSets = {
					tiny: makeMetricSet({tileWidth: 30, tileHeight: 40, cellWidth: 10, cellHeight: 20}),
					small: makeMetricSet({tileWidth: 60, tileHeight: 80, cellWidth: 20, cellHeight: 40}),
				};
				let service = makeService(metricSets);
				let result = service.getDebugState(makeSizeConfig(metricSets, {
					layout: makeLayout([{x: 0, y: 0, z: 0}]),
					availableSpace: {width: 100, height: 100},
				}));

				expect(result.candidateFits.length).toBe(2);
			});

			it("should return the selected fit and layout pixel size end to end", function() {
				let metricSets = {
					tiny: makeMetricSet({tileWidth: 30, tileHeight: 40, cellWidth: 10, cellHeight: 20}),
				};
				let service = makeService(metricSets);
				let result = service.getDebugState(makeSizeConfig(metricSets, {
					layout: makeLayout([{x: 0, y: 0, z: 0}]),
					availableSpace: {width: 100, height: 100},
				}));

				expect(result.selectedFit.metricSetId).toBe("tiny");
				expect(result.layoutPixelSize).toEqual({width: 30, height: 40});
			});

			it("should return pending inputs for incomplete config end to end", function() {
				let service = makeService();
				let result = service.getDebugState({
					layout: makeLayout([]),
					availableSpace: {width: 0, height: 0},
					sizeNames: ["tiny"],
				});

				expect(result.pendingInputs.length).toBeGreaterThan(0);
			});

			it("should show candidate ordering consistent with the chooser rules", function() {
				let metricSets = {
					upscale: makeMetricSet({tileWidth: 50, tileHeight: 66.6666667, cellWidth: 20, cellHeight: 40}),
					downscale: makeMetricSet({tileWidth: 60, tileHeight: 80, cellWidth: 20, cellHeight: 40}),
				};
				let service = makeService(metricSets);
				let result = service.getDebugState(makeSizeConfig(metricSets, {
					layout: makeLayout([{x: 0, y: 0, z: 0}]),
					availableSpace: {width: 55, height: 73},
				}));

				expect(result.candidateFits[0].metricSetId).toBe("downscale");
			});

			it("should expose richer diagnostics than getViewState", function() {
				let metricSets = {
					tiny: makeMetricSet({tileWidth: 30, tileHeight: 40, cellWidth: 10, cellHeight: 20}),
				};
				let service = makeService(metricSets);
				let config = makeSizeConfig(metricSets, {
					layout: makeLayout([{x: 0, y: 0, z: 0}]),
					availableSpace: {width: 100, height: 100},
				});

				let viewState = service.getViewState(config);
				let debugState = service.getDebugState(config);

				expect(debugState.layoutPixelSize).toEqual({width: 30, height: 40});
				expect(viewState.layoutPixelSize).toBeUndefined();
			});
		});
	});
});
