import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import minimist from "minimist";
import { readJsonFile } from "./utils.js";
import { buildLayoutMetricSet } from "./metrics.js";
import { GRID_WIDTH, GRID_HEIGHT, GRID_DEPTH } from "./table-size.js";

const argv = minimist(process.argv.slice(2), {
	string: ["config", "output"],
	alias: {
		c: "config",
		o: "output",
	},
});

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_CONFIG = "scripts/tile-css/tile-sizes.json";
const DEFAULT_OUTPUT = "scripts/tile-css/_tmp-layouts.css";
const LAYOUT_METRIC_FIELDS = Object.freeze([
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
const LOGICAL_GRID_FIELDS = Object.freeze([
	"gridWidth",
	"gridHeight",
	"gridDepth",
]);
const ROOT_TILE_REGISTRY_FIELDS = Object.freeze([
	"string-default-size",
	"string-size-order",
	"number-size-count",
]);
const SIZE_REGISTRY_FIELDS = Object.freeze([
	"string-label",
	"number-order",
	"number-min-viewport-width",
	"number-min-viewport-height",
]);

function resolveRepoPath(relativePath) {
	return path.resolve(repoRoot, relativePath);
}

async function ensureDir(dir) {
	await mkdir(dir, { recursive: true });
}

function formatCssNumber(value) {
	return Number.isFinite(value) ? `${value}` : "0";
}

function formatCssString(value) {
	return typeof value === "string" ? value : "";
}

function getPositiveNumber(value, fallback = 0) {
	return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function toDisplayLabel(sizeId) {
	return String(sizeId)
		.replace(/[-_]+/g, " ")
		.replace(/\b\w/g, function(character) {
			return character.toUpperCase();
		});
}

function compareSizeDefinitions(left, right) {
	let leftHasExplicitOrder = Number.isFinite(left.explicitOrder);
	let rightHasExplicitOrder = Number.isFinite(right.explicitOrder);

	if (leftHasExplicitOrder && rightHasExplicitOrder && left.explicitOrder !== right.explicitOrder) {
		return left.explicitOrder - right.explicitOrder;
	}

	if (leftHasExplicitOrder !== rightHasExplicitOrder) {
		return leftHasExplicitOrder ? -1 : 1;
	}

	if (left.area !== right.area) {
		return left.area - right.area;
	}

	if (left.width !== right.width) {
		return left.width - right.width;
	}

	if (left.height !== right.height) {
		return left.height - right.height;
	}

	return left.id.localeCompare(right.id);
}

function buildSizeRegistry(sizes) {
	let entries = Object.entries(sizes).map(function([sizeId, sizeConfig]) {
		let minViewport = sizeConfig && typeof sizeConfig.minViewport === "object"
			? sizeConfig.minViewport
			: {};

	return {
			id: sizeId,
			label: typeof sizeConfig.label === "string" && sizeConfig.label.trim()
				? sizeConfig.label.trim()
				: toDisplayLabel(sizeId),
			explicitOrder: Number.isFinite(sizeConfig.order) ? sizeConfig.order : null,
			width: getPositiveNumber(sizeConfig.width, 0),
			height: getPositiveNumber(sizeConfig.height, 0),
			area: getPositiveNumber(sizeConfig.width, 0) * getPositiveNumber(sizeConfig.height, 0),
			minViewportWidth: getPositiveNumber(
				sizeConfig.minViewportWidth ?? minViewport.width,
				0
			),
			minViewportHeight: getPositiveNumber(
				sizeConfig.minViewportHeight ?? minViewport.height,
				0
			),
			isDefault: sizeConfig.default === true,
		};
	});
	let sortedEntries = entries.slice().sort(compareSizeDefinitions);
	let defaultEntry = entries.find(function(entry) {
		return entry.isDefault;
	});

	if (!defaultEntry) {
		defaultEntry = entries.slice().sort(function(left, right) {
			return compareSizeDefinitions(right, left);
		})[0] || null;
	}

	return {
		defaultSizeId: defaultEntry?.id || "",
		order: sortedEntries.map(function(entry) {
			return entry.id;
		}),
		entries: sortedEntries.map(function(entry, index) {
			return {
				...entry,
				order: index,
			};
		}),
	};
}

function renderRootMetricVars(metricSets, sizeRegistry) {
	let lines = [
		":root {",
		"\t--mj-css-ready: 1;",
		"",
		"\t/* logical grid */",
	];
	let logicalGrid = {
		gridWidth: GRID_WIDTH,
		gridHeight: GRID_HEIGHT,
		gridDepth: GRID_DEPTH,
	};

	LOGICAL_GRID_FIELDS.forEach(function(field) {
		lines.push(`\t--mj-${field}: ${formatCssNumber(logicalGrid[field])};`);
	});

	lines.push("");
	lines.push("\t/* tile size registry */");
	lines.push(`\t--mj-${ROOT_TILE_REGISTRY_FIELDS[0]}: ${formatCssString(sizeRegistry.defaultSizeId)};`);
	lines.push(`\t--mj-${ROOT_TILE_REGISTRY_FIELDS[1]}: ${formatCssString(sizeRegistry.order.join(" "))};`);
	lines.push(`\t--mj-${ROOT_TILE_REGISTRY_FIELDS[2]}: ${formatCssNumber(sizeRegistry.entries.length)};`);
	lines.push("");

	sizeRegistry.entries.forEach(function(entry) {
		lines.push(`\t/* ${entry.id} metadata */`);
		lines.push(`\t--${entry.id}-${SIZE_REGISTRY_FIELDS[0]}: ${formatCssString(entry.label)};`);
		lines.push(`\t--${entry.id}-${SIZE_REGISTRY_FIELDS[1]}: ${formatCssNumber(entry.order)};`);
		lines.push(`\t--${entry.id}-${SIZE_REGISTRY_FIELDS[2]}: ${formatCssNumber(entry.minViewportWidth)};`);
		lines.push(`\t--${entry.id}-${SIZE_REGISTRY_FIELDS[3]}: ${formatCssNumber(entry.minViewportHeight)};`);
		lines.push("");
	});

	Object.entries(metricSets).forEach(function([metricSetId, metricSet], index) {
		lines.push(`\t/* ${metricSetId} */`);

		LAYOUT_METRIC_FIELDS.forEach(function(field) {
			lines.push(`\t--${metricSetId}-${field}: ${formatCssNumber(metricSet[field])};`);
		});

		if (index < Object.keys(metricSets).length - 1) {
			lines.push("");
		}
	});

	lines.push("}");
	return lines.join("\n");
}

function renderLayoutsCss(metricSets, sizeRegistry, configPath) {
	return [
		"/*******************************************************************************",
		"This file is auto generated by scripts/tile-css/generate-layouts.js",
		`config: ${configPath}`,
		"",
		"The file is intentionally named layouts.css rather than vars.css so it can",
		"grow beyond custom properties if layout-level rules are added later.",
		"*******************************************************************************/",
		"",
		renderRootMetricVars(metricSets, sizeRegistry),
		"",
	].join("\n");
}

async function main() {
	let configPath = argv.config
		? path.resolve(argv.config)
		: resolveRepoPath(DEFAULT_CONFIG);
	let outputPath = argv.output
		? path.resolve(argv.output)
		: resolveRepoPath(DEFAULT_OUTPUT);
	let sizes = await readJsonFile(configPath);
	let metricSets = Object.entries(sizes).reduce(function(result, [metricSetId, sizeConfig]) {
		result[metricSetId] = buildLayoutMetricSet(sizeConfig);
		return result;
	}, {});
	let sizeRegistry = buildSizeRegistry(sizes);
	let css = renderLayoutsCss(metricSets, sizeRegistry, path.relative(repoRoot, configPath));

	await ensureDir(path.dirname(outputPath));
	await writeFile(outputPath, css, "utf-8");

	console.log(`Generated ${path.relative(repoRoot, outputPath)}`);
}

await main();
