import fs from 'fs';
import path from 'path';
import paper from 'paper';
import { parse as parseSvgAst } from 'svg-parser';

const DEFAULT_INPUT = 'scripts/output/asset-pipeline/traditional/images/final-rendering-color-svg/d-1.svg';
const DEFAULT_OUTPUT = 'scripts/output/asset-pipeline/traditional/experiments/paper-flatten/d-1.paper-united.svg';

await main();

async function main() {
	const options = readOptions();
	const svgSource = fs.readFileSync(options.input, 'utf8');
	const viewBox = parseViewBox(svgSource);
	const scope = new paper.PaperScope();
	scope.setup(new scope.Size(viewBox.width, viewBox.height));

	const inputPaths = extractSvgPaths(svgSource);
	const paperItems = inputPaths
		.filter((entry) => entry.d && !isTileBodyFill(entry.fill))
		.map((entry) => createPaperPath(scope, entry, options.flatness));
	const outputItems = outputItemsForMode(scope, paperItems, options);

	writeSvgOutput(options.output, {
		viewBox,
		items: outputItems,
		metadata: {
			input: normalizePath(options.input),
			mode: options.mode,
			flatness: options.flatness,
			inputPathCount: inputPaths.length,
			cutterPathCount: paperItems.length,
			outputPathCount: outputItems.length,
		},
	});

	console.log(JSON.stringify({
		ok: true,
		input: normalizePath(options.input),
		output: normalizePath(options.output),
		mode: options.mode,
		flatness: options.flatness,
		inputPathCount: inputPaths.length,
		cutterPathCount: paperItems.length,
		outputPathCount: outputItems.length,
	}, null, 2));
}

function readOptions() {
	const args = process.argv.slice(2);
	const options = {
		input: DEFAULT_INPUT,
		output: DEFAULT_OUTPUT,
		mode: 'unite-by-fill',
		flatness: 0.25,
	};

	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === '--input') {
			options.input = args[index + 1] || options.input;
			index += 1;
		} else if (arg === '--output') {
			options.output = args[index + 1] || options.output;
			index += 1;
		} else if (arg === '--mode') {
			options.mode = args[index + 1] || options.mode;
			index += 1;
		} else if (arg === '--flatness') {
			options.flatness = Number.parseFloat(args[index + 1]);
			index += 1;
		}
	}

	if (!Number.isFinite(options.flatness) || options.flatness <= 0) {
		throw new Error('--flatness must be a positive number.');
	}
	if (!['flatten', 'unite-by-fill', 'unite-all'].includes(options.mode)) {
		throw new Error('--mode must be one of "flatten", "unite-by-fill", or "unite-all".');
	}

	return options;
}

function extractSvgPaths(svgSource) {
	const ast = parseSvgAst(svgSource);
	const paths = [];
	visitSvgNode(ast, [], (node, inheritedTransforms) => {
		if (node.type !== 'element' || node.tagName !== 'path') {
			return;
		}

		const properties = node.properties || {};
		paths.push({
			d: String(properties.d || ''),
			fill: normalizeFill(properties.fill),
			fillRule: String(properties.fillRule || properties['fill-rule'] || 'nonzero'),
			transform: [...inheritedTransforms, String(properties.transform || '').trim()].filter(Boolean),
		});
	});
	return paths;
}

function visitSvgNode(node, inheritedTransforms, onNode) {
	if (!node || typeof node !== 'object') {
		return;
	}

	const properties = node.properties || {};
	const nextTransforms = node.type === 'element' && properties.transform
		? [...inheritedTransforms, String(properties.transform)]
		: inheritedTransforms;
	onNode(node, inheritedTransforms);

	for (const child of node.children || []) {
		visitSvgNode(child, nextTransforms, onNode);
	}
}

function createPaperPath(scope, entry, flatness) {
	const item = new scope.CompoundPath({
		pathData: entry.d,
		insert: false,
	});
	item.fillColor = entry.fill;
	item.fillRule = entry.fillRule;
	for (const transform of entry.transform) {
		applyTransform(item, transform);
	}
	item.flatten(flatness);
	item.data = {
		fill: entry.fill,
		fillRule: entry.fillRule,
	};
	return item;
}

function outputItemsForMode(scope, paperItems, options) {
	if (options.mode === 'flatten') {
		return paperItems;
	}

	if (options.mode === 'unite-all') {
		return uniteAllPaths(scope, paperItems, options.flatness);
	}

	return unitePathsByFill(scope, paperItems, options.flatness);
}

function unitePathsByFill(scope, items, flatness) {
	const groups = new Map();
	for (const item of items) {
		const fill = item.data.fill || '#000000';
		if (!groups.has(fill)) {
			groups.set(fill, []);
		}
		groups.get(fill).push(item);
	}

	const results = [];
	for (const [fill, groupItems] of groups) {
		let united = groupItems[0].clone({ insert: false });
		for (let index = 1; index < groupItems.length; index += 1) {
			const next = groupItems[index];
			const result = united.unite(next, { insert: false });
			united.remove();
			united = result;
			united.fillColor = fill;
			united.flatten(flatness);
		}
		united.fillColor = fill;
		united.data = {
			fill,
			fillRule: 'nonzero',
		};
		results.push(united);
	}

	scope.project.clear();
	return results;
}

function uniteAllPaths(scope, items, flatness) {
	if (items.length === 0) {
		return [];
	}

	let united = items[0].clone({ insert: false });
	for (let index = 1; index < items.length; index += 1) {
		const result = united.unite(items[index], { insert: false });
		united.remove();
		united = result;
		united.flatten(flatness);
	}

	united.fillColor = '#000000';
	united.data = {
		fill: '#000000',
		fillRule: 'nonzero',
	};
	scope.project.clear();

	return [united];
}

function applyTransform(item, transform) {
	const matrix = parseMatrixTransform(transform);
	if (matrix) {
		item.transform(matrix);
	}
}

function parseMatrixTransform(transform) {
	const match = String(transform || '').match(/matrix\(([^)]+)\)/);
	if (!match) {
		return null;
	}

	const values = match[1].split(/[\s,]+/).filter(Boolean).map((value) => Number.parseFloat(value));
	if (values.length !== 6 || values.some((value) => !Number.isFinite(value))) {
		return null;
	}

	return new paper.Matrix(...values);
}

function writeSvgOutput(outputPath, { viewBox, items, metadata }) {
	fs.mkdirSync(path.dirname(outputPath), { recursive: true });
	const pathMarkup = items.map((item, index) => {
		return `\t<path id="paper-${index + 1}" fill="${escapeXml(item.data.fill || '#000000')}" fill-rule="${escapeXml(item.data.fillRule || 'nonzero')}" d="${escapeXml(item.pathData)}"/>`;
	}).join('\n');
	const metadataComment = escapeXml(JSON.stringify(metadata));
	const svg = [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}">`,
		'\t<title>Paper flattened cutter experiment</title>',
		`\t<!-- ${metadataComment} -->`,
		pathMarkup,
		'</svg>',
		'',
	].join('\n');
	fs.writeFileSync(outputPath, svg, 'utf8');
}

function parseViewBox(svgSource) {
	const match = svgSource.match(/viewBox=(["'])(.*?)\1/);
	const [minX = 0, minY = 0, width = 94, height = 136] = String(match?.[2] || '0 0 94 136')
		.split(/[\s,]+/)
		.map((value) => Number.parseFloat(value));
	return { minX, minY, width, height };
}

function normalizeFill(fill) {
	const value = String(fill || '#000000').trim();
	return value.toLowerCase();
}

function isTileBodyFill(fill) {
	return fill === '#fff' || fill === '#ffffff' || fill === 'white';
}

function normalizePath(filename) {
	return path.relative(process.cwd(), filename).replaceAll('\\', '/');
}

function escapeXml(value) {
	return String(value)
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}
