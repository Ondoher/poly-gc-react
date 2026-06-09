import paper from 'paper';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { parse as parseSvgAst } from 'svg-parser';
import { composeMatrices, parseTransform } from './source-svg-components.js';
import { transformPathData } from './svg-path-geometry.js';

const IDENTITY = Object.freeze({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
const STROKE_OUTLINE_CURVE_SEGMENTS = 10;

installSvgDomParser();

export function getPaintComponents(components, classNames) {
	const classSet = new Set(classNames);
	return components.filter((component) => classSet.has(component.className));
}

export function makePaintPathWithKnockouts({
	component,
	color,
	knockouts = [],
	transform = IDENTITY,
	attributes = {},
}) {
	const outputTransform = composeMatrices(normalizeMatrix(transform), component.transform || IDENTITY);

	if (isStrokeOnly(component)) {
		const strokeWidth = visibleStrokeWidth(component);
		if (strokeWidth <= 0) {
			return '';
		}

		const strokePathDataList = strokeOnlyComponentToFilledPathDataList(component, outputTransform, strokeWidth);
		const pathAttributes = mergedPaintPathAttributes({
			...attributes,
			'data-geometry-normalized': [
				attributes?.['data-geometry-normalized'],
				'stroke-to-fill',
			].filter(Boolean).join(' '),
		}, false);
		const customAttributes = Object.entries(pathAttributes)
			.map(([name, value]) => value == null ? '' : ` ${name}="${escapeAttribute(String(value))}"`)
			.join('');

		return strokePathDataList
			.map((strokePathData) => `<path fill="${escapeAttribute(color)}" fill-rule="evenodd"${customAttributes} data-source-id="${escapeAttribute(component.id || '')}" data-source-class="${escapeAttribute(component.className || '')}" d="${escapeAttribute(strokePathData)}"/>`)
			.join('\n');
	}

	const knockoutPathData = pruneNestedKnockouts(knockouts)
		.map((knockout) => transformComponentPath(knockout, transform));
	const hasKnockouts = knockoutPathData.length > 0;
	const pathData = hasKnockouts
		? transformComponentPath(component, transform)
		: component.pathData;
	const bakedPathData = hasKnockouts
		? subtractKnockouts(pathData, knockoutPathData)
		: pathData;
	const transformAttribute = hasKnockouts
		? ''
		: makeTransformAttribute(outputTransform);
	const knockoutAttributes = knockoutPathData.length > 0
		? ` data-negative-space="paper-subtract" data-knockout-count="${knockoutPathData.length}"`
		: '';
	const safePathData = safeFilledPathData(component, bakedPathData);
	const pathAttributes = mergedPaintPathAttributes(attributes, safePathData !== bakedPathData);
	const customAttributes = Object.entries(pathAttributes)
		.map(([name, value]) => value == null ? '' : ` ${name}="${escapeAttribute(String(value))}"`)
		.join('');
	const paintAttributes = makePaintAttributes(component, color);

	return `<path${paintAttributes}${transformAttribute}${knockoutAttributes}${customAttributes} data-source-id="${escapeAttribute(component.id || '')}" data-source-class="${escapeAttribute(component.className || '')}" d="${escapeAttribute(safePathData)}"/>`;
}

function mergedPaintPathAttributes(attributes, degenerateSubpathPruned) {
	const nextAttributes = { ...(attributes || {}) };
	const geometryNormalizations = [
		nextAttributes['data-geometry-normalized'],
		degenerateSubpathPruned ? 'degenerate-subpath-pruned' : null,
	]
		.filter(Boolean)
		.flatMap((value) => String(value).split(/\s+/))
		.filter(Boolean);

	if (geometryNormalizations.length > 0) {
		nextAttributes['data-geometry-normalized'] = [...new Set(geometryNormalizations)].join(' ');
	}

	return nextAttributes;
}

export function selectKnockoutComponents(components, paintComponents, options = {}) {
	const {
		maxArea = Infinity,
		paintUnionAreaRatio = 0.95,
		sourceArtGroupId = null,
	} = options;
	const paintUnion = getComponentUnionBounds(paintComponents);

	return components.filter((component) => {
		if (!component.negativeSpaceCandidate || !paintUnion) {
			return false;
		}

		if (sourceArtGroupId && !component.parentGroupIds.includes(sourceArtGroupId)) {
			return false;
		}

		return component.area <= maxArea
			&& component.area < paintUnion.area * paintUnionAreaRatio
			&& boundsOverlap(component.bounds, paintUnion)
			&& !boundsContainBounds(component.bounds, paintUnion);
	});
}

export function isRelatedKnockout(paintComponent, knockoutComponent) {
	return knockoutComponent.area < paintComponent.area
		&& (
			sharesNestedGroup(paintComponent, knockoutComponent)
			|| boundsContainCenter(paintComponent.bounds, knockoutComponent.center)
			|| boundsOverlap(paintComponent.bounds, knockoutComponent.bounds)
		);
}

export function transformComponentPath(component, transform = IDENTITY) {
	return transformPathData(
		transformPathData(component.pathData, component.transform || IDENTITY),
		transform,
	);
}

export function subtractKnockouts(pathData, knockoutPathDataList) {
	if (knockoutPathDataList.length === 0) {
		return pathData;
	}

	let result = new paper.CompoundPath(pathData);

	for (const knockoutPathData of knockoutPathDataList) {
		const knockout = new paper.CompoundPath(knockoutPathData);
		const next = result.subtract(knockout, { insert: false });

		result.remove();
		knockout.remove();
		result = next;
	}

	const output = result.pathData;
	result.remove();
	return output;
}

export function pruneNestedKnockouts(knockouts) {
	return knockouts.filter((candidate) => !knockouts.some((other) => {
		if (candidate === other || candidate.area >= other.area) {
			return false;
		}

		return boundsContainBounds(other.bounds, candidate.bounds);
	}));
}

export function getComponentUnionBounds(components) {
	if (components.length === 0) {
		return null;
	}

	const boundsList = components.map((component) => component.bounds || component);
	const left = Math.min(...boundsList.map((bounds) => bounds.left));
	const top = Math.min(...boundsList.map((bounds) => bounds.top));
	const right = Math.max(...boundsList.map((bounds) => bounds.right));
	const bottom = Math.max(...boundsList.map((bounds) => bounds.bottom));

	return {
		left,
		top,
		right,
		bottom,
		width: right - left,
		height: bottom - top,
		area: (right - left) * (bottom - top),
	};
}

export function findSmallIsolatedCandidates(items, outerBounds = null, options = {}) {
	const bounds = outerBounds || getComponentUnionBounds(items.map((item) => item.bounds || item));

	if (!bounds) {
		return [];
	}

	const {
		topBandRatio = 0.4,
		maxAreaRatio = 0.22,
		minWidth = 1,
		minHeight = 1,
		isolationGapRatio = 0.025,
	} = options;
	const outerArea = bounds.width * bounds.height;
	const isolationGap = Math.max(bounds.width, bounds.height) * isolationGapRatio;

	return items
		.map((item) => makeSemanticCandidate({
			item,
			outerBounds: bounds,
			outerArea,
			isolationGap,
			items,
		}))
		.filter((candidate) => candidate.areaRatio <= maxAreaRatio)
		.filter((candidate) => candidate.bounds.width >= minWidth && candidate.bounds.height >= minHeight)
		.map((candidate) => ({
			...candidate,
			topBand: candidate.normalizedCenter.y <= topBandRatio,
			topBandRatio,
		}))
		.sort((left, right) => {
			if (left.topBand !== right.topBand) {
				return left.topBand ? -1 : 1;
			}

			return right.isolationScore - left.isolationScore
				|| left.normalizedCenter.y - right.normalizedCenter.y
				|| left.normalizedCenter.x - right.normalizedCenter.x;
		});
}

export function boundsContainCenter(bounds, center) {
	return center.x >= bounds.left
		&& center.x <= bounds.right
		&& center.y >= bounds.top
		&& center.y <= bounds.bottom;
}

export function boundsContainBounds(outer, inner) {
	return inner.left >= outer.left
		&& inner.top >= outer.top
		&& inner.right <= outer.right
		&& inner.bottom <= outer.bottom;
}

export function boundsOverlap(left, right) {
	return left.left < right.right
		&& left.right > right.left
		&& left.top < right.bottom
		&& left.bottom > right.top;
}

function sharesNestedGroup(left, right) {
	const nearestGroup = left.parentGroupIds[left.parentGroupIds.length - 1];
	return Boolean(nearestGroup) && right.parentGroupIds.includes(nearestGroup);
}

function makeSemanticCandidate({ item, outerBounds, outerArea, isolationGap, items }) {
	const bounds = item.bounds || item;
	const center = item.center || {
		x: bounds.left + (bounds.width / 2),
		y: bounds.top + (bounds.height / 2),
	};
	const area = bounds.width * bounds.height;
	const nearbyLargerItems = items.filter((other) => {
		if (other === item) {
			return false;
		}

		const otherBounds = other.bounds || other;
		const otherArea = otherBounds.width * otherBounds.height;

		return otherArea > area * 1.5 && boundsOverlap(expandBounds(bounds, isolationGap), otherBounds);
	});
	const normalizedCenter = {
		x: (center.x - outerBounds.left) / Math.max(1, outerBounds.width),
		y: (center.y - outerBounds.top) / Math.max(1, outerBounds.height),
	};
	const cornerDistances = {
		topLeft: Math.hypot(normalizedCenter.x, normalizedCenter.y),
		topRight: Math.hypot(1 - normalizedCenter.x, normalizedCenter.y),
		bottomLeft: Math.hypot(normalizedCenter.x, 1 - normalizedCenter.y),
		bottomRight: Math.hypot(1 - normalizedCenter.x, 1 - normalizedCenter.y),
	};

	return {
		item,
		bounds,
		center,
		area,
		areaRatio: area / Math.max(1, outerArea),
		normalizedCenter,
		normalizedBottom: (bounds.bottom - outerBounds.top) / Math.max(1, outerBounds.height),
		cornerDistances,
		nearestCorner: Object.entries(cornerDistances)
			.sort((left, right) => left[1] - right[1])[0][0],
		relativePosition: [
			normalizedCenter.y < 0.4 ? 'top' : normalizedCenter.y > 0.72 ? 'bottom' : 'middle',
			normalizedCenter.x < 0.4 ? 'left' : normalizedCenter.x > 0.6 ? 'right' : 'center',
		].join('-'),
		side: normalizedCenter.x < 0.5 ? 'left' : 'right',
		isolationScore: 1 / (nearbyLargerItems.length + 1),
	};
}

function expandBounds(bounds, amount) {
	return {
		left: bounds.left - amount,
		top: bounds.top - amount,
		right: bounds.right + amount,
		bottom: bounds.bottom + amount,
		width: bounds.width + (amount * 2),
		height: bounds.height + (amount * 2),
	};
}

function escapeAttribute(value) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function makePaintAttributes(component, color) {
	const fillRule = component.fillRule
		? ` fill-rule="${escapeAttribute(component.fillRule)}"`
		: '';
	return ` fill="${escapeAttribute(color)}"${fillRule}`;
}

function strokeOnlyComponentToFilledPathDataList(component, transform, strokeWidth) {
	const transformAttribute = makeTransformAttribute(transform);
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1000 -1000 2000 2000"><path d="${escapeAttribute(component.pathData || '')}" fill="none" stroke="black" stroke-width="${escapeAttribute(String(strokeWidth))}"${transformAttribute}/></svg>`;
	const svgData = new SVGLoader().parse(svg);
	const pathDataList = [];

	for (const svgPath of svgData.paths) {
		const style = svgPath.userData?.style || {};

		for (const subPath of svgPath.subPaths || []) {
			const points = subPath.getPoints(STROKE_OUTLINE_CURVE_SEGMENTS);
			const geometry = points.length >= 2
				? SVGLoader.pointsToStroke(points, style, STROKE_OUTLINE_CURVE_SEGMENTS, 0.001)
				: null;

			if (!geometry) {
				continue;
			}

			const boundaryPathData = geometryToBoundaryPathCommands(geometry).join(' ');
			if (boundaryPathData) {
				pathDataList.push(boundaryPathData);
			}
			geometry.dispose();
		}
	}

	if (pathDataList.length === 0) {
		throw new Error(`Stroke-only component ${component.id || component.componentId || '(unknown)'} did not produce filled stroke geometry.`);
	}

	return pathDataList;
}

function geometryToBoundaryPathCommands(geometry) {
	const nonIndexed = geometry.index ? geometry.toNonIndexed() : geometry;
	const positions = nonIndexed.attributes.position;
	const edges = new Map();

	for (let index = 0; index + 2 < positions.count; index += 3) {
		const points = [
			{ x: positions.getX(index), y: positions.getY(index) },
			{ x: positions.getX(index + 1), y: positions.getY(index + 1) },
			{ x: positions.getX(index + 2), y: positions.getY(index + 2) },
		];

		if (triangleArea(points) <= 0.000001) {
			continue;
		}

		addBoundaryEdge(edges, points[0], points[1]);
		addBoundaryEdge(edges, points[1], points[2]);
		addBoundaryEdge(edges, points[2], points[0]);
	}

	if (nonIndexed !== geometry) {
		nonIndexed.dispose();
	}

	return boundaryEdgesToPathCommands([...edges.values()]);
}

function addBoundaryEdge(edges, start, end) {
	const startKey = pointKey(start);
	const endKey = pointKey(end);
	const edgeKey = startKey < endKey
		? `${startKey}|${endKey}`
		: `${endKey}|${startKey}`;

	if (edges.has(edgeKey)) {
		edges.delete(edgeKey);
		return;
	}

	edges.set(edgeKey, {
		start: { ...start, key: startKey },
		end: { ...end, key: endKey },
	});
}

function boundaryEdgesToPathCommands(edges) {
	const unused = new Set(edges.keys());
	const adjacency = new Map();

	for (const index of unused) {
		const edge = edges[index];
		appendAdjacency(adjacency, edge.start.key, { index, point: edge.end });
		appendAdjacency(adjacency, edge.end.key, { index, point: edge.start });
	}

	const commands = [];

	while (unused.size > 0) {
		const firstIndex = unused.values().next().value;
		const firstEdge = edges[firstIndex];
		const loop = [firstEdge.start, firstEdge.end];
		unused.delete(firstIndex);

		let previousKey = firstEdge.start.key;
		let currentKey = firstEdge.end.key;

		while (currentKey !== loop[0].key) {
			const next = (adjacency.get(currentKey) || [])
				.find((candidate) => unused.has(candidate.index) && candidate.point.key !== previousKey)
				|| (adjacency.get(currentKey) || [])
					.find((candidate) => unused.has(candidate.index));

			if (!next) {
				break;
			}

			unused.delete(next.index);
			previousKey = currentKey;
			currentKey = next.point.key;

			if (currentKey !== loop[0].key) {
				loop.push(next.point);
			}
		}

		if (loop.length >= 3) {
			commands.push(pathCommandForLoop(loop));
		}
	}

	return commands;
}

function appendAdjacency(adjacency, key, entry) {
	if (!adjacency.has(key)) {
		adjacency.set(key, []);
	}

	adjacency.get(key).push(entry);
}

function pathCommandForLoop(loop) {
	const [first, ...rest] = loop;
	return `M${format(first.x)},${format(first.y)} ${rest.map((point) => `L${format(point.x)},${format(point.y)}`).join(' ')} Z`;
}

function pointKey(point) {
	return `${format(point.x)},${format(point.y)}`;
}

function triangleArea(points) {
	return Math.abs(
		((points[1].x - points[0].x) * (points[2].y - points[0].y))
		- ((points[2].x - points[0].x) * (points[1].y - points[0].y)),
	) / 2;
}

function installSvgDomParser() {
	if (typeof globalThis.DOMParser !== 'undefined') {
		return;
	}

	globalThis.DOMParser = class {
		parseFromString(source) {
			const ast = parseSvgAst(source);
			const svgRoot = ast.children.find((node) => node.type === 'element');
			const idMap = new Map();
			const document = {
				documentElement: null,
				getElementById(id) {
					return idMap.get(id) ?? null;
				},
			};
			const documentElement = wrapSvgAstNode(svgRoot, document, idMap);
			document.documentElement = documentElement;
			assignViewportElement(documentElement, document);
			return document;
		}
	};
}

function wrapSvgAstNode(node, document, idMap) {
	const properties = node?.properties ?? {};
	const domNode = {
		nodeType: 1,
		nodeName: node.tagName,
		childNodes: [],
		style: parseInlineStyle(properties.style),
		viewportElement: null,
		getAttribute(name) {
			const value = readSvgProperty(properties, name);
			return value == null ? null : String(value);
		},
		getAttributeNS(namespace, name) {
			if (namespace === 'http://www.w3.org/1999/xlink') {
				const xlinkValue = readSvgProperty(properties, `xlink:${name}`) ?? readSvgProperty(properties, `xlink${capitalize(name)}`);
				return xlinkValue == null ? null : String(xlinkValue);
			}

			const value = readSvgProperty(properties, name);
			return value == null ? null : String(value);
		},
		hasAttribute(name) {
			return readSvgProperty(properties, name) != null;
		},
	};

	if (properties.id) {
		idMap.set(String(properties.id), domNode);
	}

	domNode.childNodes = (node.children || [])
		.filter((child) => child?.type === 'element')
		.map((child) => wrapSvgAstNode(child, document, idMap));

	return domNode;
}

function assignViewportElement(node, document) {
	node.viewportElement = document;
	for (const child of node.childNodes) {
		assignViewportElement(child, document);
	}
}

function parseInlineStyle(styleText) {
	const styleValues = !styleText
		? {}
		: String(styleText)
			.split(';')
			.map((entry) => entry.trim())
			.filter(Boolean)
			.reduce((result, entry) => {
				const separator = entry.indexOf(':');

				if (separator < 0) {
					return result;
				}

				result[entry.slice(0, separator).trim()] = entry.slice(separator + 1).trim();
				return result;
			}, {});

	return new Proxy(styleValues, {
		get(target, property) {
			if (typeof property !== 'string') {
				return target[property];
			}

			return property in target ? target[property] : '';
		},
	});
}

function readSvgProperty(properties, name) {
	if (Object.hasOwn(properties, name)) {
		return properties[name];
	}

	const camelCaseName = name.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
	if (Object.hasOwn(properties, camelCaseName)) {
		return properties[camelCaseName];
	}

	return null;
}

function capitalize(value) {
	return value.slice(0, 1).toUpperCase() + value.slice(1);
}

function safeFilledPathData(component, pathData) {
	if (isStrokeOnly(component) || !isEvenOddFill(component) || !pathData) {
		return pathData;
	}

	const compoundPath = new paper.CompoundPath(pathData);
	const children = compoundPath.children || [];

	if (children.length <= 1) {
		compoundPath.remove();
		return pathData;
	}

	const keptPathData = children
		.filter((child) => child.pathData && Math.abs(child.area || 0) > 0.000001)
		.map((child) => child.pathData);

	compoundPath.remove();

	return keptPathData.length > 0 && keptPathData.length !== children.length
		? keptPathData.join(' ')
		: pathData;
}

function isEvenOddFill(component) {
	return String(component.fillRule || '').toLowerCase() === 'evenodd';
}

function isStrokeOnly(component) {
	return !isPaint(component.fill) && isPaint(component.stroke);
}

function visibleStrokeWidth(component) {
	const value = component.strokeWidth;

	if (value == null || value === '') {
		return 1;
	}

	const width = Number.parseFloat(String(value));
	return Number.isFinite(width) ? width : 1;
}

function isPaint(value) {
	return Boolean(value) && value !== 'none' && value !== 'transparent';
}

function makeTransformAttribute(matrix) {
	if (isIdentity(matrix)) {
		return '';
	}

	return ` transform="matrix(${format(matrix.a)} ${format(matrix.b)} ${format(matrix.c)} ${format(matrix.d)} ${format(matrix.e)} ${format(matrix.f)})"`;
}

function normalizeMatrix(transform) {
	return typeof transform === 'string'
		? parseTransform(transform)
		: transform || IDENTITY;
}

function isIdentity(matrix) {
	return nearlyEqual(matrix.a, 1)
		&& nearlyEqual(matrix.b, 0)
		&& nearlyEqual(matrix.c, 0)
		&& nearlyEqual(matrix.d, 1)
		&& nearlyEqual(matrix.e, 0)
		&& nearlyEqual(matrix.f, 0);
}

function nearlyEqual(left, right) {
	return Math.abs(left - right) < 0.000001;
}

function format(value) {
	return Number(value.toFixed(6)).toString();
}

