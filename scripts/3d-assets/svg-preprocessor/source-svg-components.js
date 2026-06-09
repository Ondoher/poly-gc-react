import path from 'path';
import opentype from 'opentype.js';
import paper from 'paper';
import { ASSET_FONTS_DIR } from '../shared/asset-paths.js';

const IDENTITY = Object.freeze({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
const GEOMETRY_TAGS = new Set(['path', 'circle', 'ellipse', 'rect', 'polygon', 'polyline', 'line']);
const TEXT_TAGS = new Set(['text']);
const INVISIBLE_DUST_MAX_AREA = 0.25;
const INVISIBLE_DUST_MAX_ALPHA = 0.1;
const TINY_PATH_DUST_MAX_AREA = 0.01;
const TEXT_FONT_CACHE = new Map();
const TEXT_FONT_DIRECTORIES = [
	ASSET_FONTS_DIR,
	process.env.WINDIR ? path.resolve(process.env.WINDIR, 'Fonts') : 'C:\\Windows\\Fonts',
	'/usr/share/fonts/truetype/dejavu',
	'/usr/share/fonts/dejavu',
	'/usr/local/share/fonts',
];
const TEXT_FONT_CANDIDATES_BY_FAMILY = new Map([
	['bitstream vera sans', ['Vera.ttf', 'DejaVuSans.ttf', 'arial.ttf']],
	['century schoolbook l', ['C059-Roman.otf', 'CenturySchL-Roma.otf', 'CENTURY.TTF', 'BOOKOS.TTF', 'times.ttf', 'DejaVuSerif.ttf']],
	['dejavu sans', ['DejaVuSans.ttf', 'DejaVuSansCondensed.ttf']],
	['dejavu serif', ['DejaVuSerif.ttf']],
	['arial', ['arial.ttf', 'Arial.ttf']],
	['century', ['CENTURY.TTF']],
	['serif', ['DejaVuSerif.ttf', 'times.ttf', 'Times New Roman.ttf', 'Times.ttf']],
	['sans-serif', ['DejaVuSans.ttf', 'arial.ttf']],
]);

export function extractSourceSvgComponents(svgSource, options = {}) {
	paper.setup([options.width || 512, options.height || 512]);

	const source = sanitizeSvgSource(svgSource);
	const classStyles = parseClassStyles(source);
	const viewBox = readViewBox(source);
	const components = [];
	const stack = [{
		id: null,
		className: null,
		matrix: { ...IDENTITY },
		groupIds: [],
		sourceLayerRoles: [],
		sourceUseInstances: [],
		paint: {},
	}];
	const tagPattern = /<[^>]+>/g;
	let match;
	let sourceElementIndex = 0;
	let sourceUseInstanceIndex = 0;

	while ((match = tagPattern.exec(source)) !== null) {
		const tag = match[0];

		if (/^<\//.test(tag) || /^<\?/.test(tag) || /^<!/.test(tag)) {
			if (/^<\/g\b/i.test(tag) && stack.length > 1) {
				stack.pop();
			}
			continue;
		}

		const tagName = readTagName(tag);
		const attributes = parseAttributes(tag);
		const parent = stack[stack.length - 1];

		if (TEXT_TAGS.has(tagName)) {
			const textElementEnd = findTextElementEnd(source, tagPattern.lastIndex);
			const textElementSource = textElementEnd
				? source.slice(match.index, textElementEnd)
				: tag;
			const componentRecords = buildComponentRecords({
				tagName,
				tag: textElementSource,
				attributes,
				parent,
				classStyles,
				viewBox,
				sourceElementIndex,
				splitCompoundPaths: false,
				textFontOptions: options,
			});
			sourceElementIndex += 1;

			for (const component of componentRecords) {
				components.push(component);
			}

			if (textElementEnd) {
				tagPattern.lastIndex = textElementEnd;
			}
			continue;
		}

		if (tagName === 'g') {
			const className = attributes.class || parent.className;
			const id = attributes.id || null;
			const sourceLayerRole = sourceLayerRoleFromAttributes(attributes);
			const sourceUseId = attributes['data-source-use'] || null;
			const sourceUseInstances = sourceUseId
				? [
					...parent.sourceUseInstances,
					{
						sourceUseId,
						sourceUseInstanceId: `source-use.${String(sourceUseInstanceIndex += 1).padStart(4, '0')}.${sourceUseId}`,
					},
				]
				: parent.sourceUseInstances;
			const matrix = composeMatrices(parent.matrix, parseTransform(attributes.transform || ''));
			stack.push({
				id,
				className,
				matrix,
				groupIds: id ? [...parent.groupIds, id] : parent.groupIds,
				sourceLayerRoles: sourceLayerRole ? [...parent.sourceLayerRoles, sourceLayerRole] : parent.sourceLayerRoles,
				sourceUseInstances,
				paint: resolvePaint({
					attributes,
					className,
					classStyles,
					parentPaint: parent.paint,
				}),
			});

			if (tag.endsWith('/>')) {
				stack.pop();
			}
			continue;
		}

		if (!GEOMETRY_TAGS.has(tagName)) {
			continue;
		}

		const componentRecords = buildComponentRecords({
			tagName,
			tag,
			attributes,
			parent,
			classStyles,
			viewBox,
			sourceElementIndex,
			splitCompoundPaths: options.splitCompoundPaths === true,
		});
		sourceElementIndex += 1;

		for (const component of componentRecords) {
			components.push(component);
		}
	}

	const classifiedComponents = classifyTileLayerCandidates(components, viewBox);

	return {
		viewBox,
		components: classifiedComponents,
		groups: [...new Set(classifiedComponents.flatMap((component) => component.parentGroupIds))],
	};
}

export function sanitizeSvgSource(svgSource) {
	return svgSource
		.replace(/<!DOCTYPE[\s\S]*?\]>/i, '')
		.replace(/xmlns:x="&ns_extend;"/g, 'xmlns:x="http://ns.adobe.com/Extensibility/1.0/"')
		.replace(/xmlns:i="&ns_ai;"/g, 'xmlns:i="http://ns.adobe.com/AdobeIllustrator/10.0/"')
		.replace(/xmlns:graph="&ns_graphs;"/g, 'xmlns:graph="http://ns.adobe.com/Graphs/1.0/"')
		.replace(/requiredExtensions="&ns_ai;"/g, 'requiredExtensions="http://ns.adobe.com/AdobeIllustrator/10.0/"');
}

export function parseTransform(transform) {
	let matrix = { ...IDENTITY };

	for (const match of transform.matchAll(/(matrix|translate|scale|rotate)\(([^)]+)\)/g)) {
		const [, command, rawValues] = match;
		const values = rawValues
			.split(/[\s,]+/)
			.filter(Boolean)
			.map((value) => Number.parseFloat(value));
		let next = null;

		if (command === 'matrix') {
			next = { a: values[0], b: values[1], c: values[2], d: values[3], e: values[4], f: values[5] };
		} else if (command === 'translate') {
			next = { a: 1, b: 0, c: 0, d: 1, e: values[0] || 0, f: values[1] || 0 };
		} else if (command === 'scale') {
			next = { a: values[0], b: 0, c: 0, d: values[1] ?? values[0], e: 0, f: 0 };
		} else if (command === 'rotate') {
			const angle = ((values[0] || 0) * Math.PI) / 180;
			const rotation = {
				a: Math.cos(angle),
				b: Math.sin(angle),
				c: -Math.sin(angle),
				d: Math.cos(angle),
				e: 0,
				f: 0,
			};

			if (values.length >= 3) {
				next = composeMatrices(
					composeMatrices(
						{ a: 1, b: 0, c: 0, d: 1, e: values[1], f: values[2] },
						rotation,
					),
					{ a: 1, b: 0, c: 0, d: 1, e: -values[1], f: -values[2] },
				);
			} else {
				next = rotation;
			}
		}

		if (!next || Object.values(next).some((value) => !Number.isFinite(value))) {
			throw new Error(`Invalid transform "${match[0]}"`);
		}

		matrix = composeMatrices(matrix, next);
	}

	return matrix;
}

export function composeMatrices(outer, inner) {
	return {
		a: (outer.a * inner.a) + (outer.c * inner.b),
		b: (outer.b * inner.a) + (outer.d * inner.b),
		c: (outer.a * inner.c) + (outer.c * inner.d),
		d: (outer.b * inner.c) + (outer.d * inner.d),
		e: (outer.a * inner.e) + (outer.c * inner.f) + outer.e,
		f: (outer.b * inner.e) + (outer.d * inner.f) + outer.f,
	};
}

function buildComponentRecords({
	tagName,
	tag,
	attributes,
	parent,
	classStyles,
	viewBox,
	sourceElementIndex,
	splitCompoundPaths,
	textFontOptions,
}) {
	const className = attributes.class || parent.className || null;
	const sourceLayerRole = sourceLayerRoleFromAttributes(attributes);
	const sourceLayerRoles = sourceLayerRole ? [...parent.sourceLayerRoles, sourceLayerRole] : parent.sourceLayerRoles;
	const paint = resolvePaint({
		attributes,
		className,
		classStyles,
		parentPaint: parent.paint,
	});
	const transform = composeMatrices(parent.matrix, parseTransform(attributes.transform || ''));
	const pathData = geometryToPathData(tagName, attributes, tag, paint, textFontOptions);

	if (!pathData) {
		return [];
	}

	const bounds = getTransformedBounds(pathData, transform);

	if (!bounds || bounds.width <= 0 || bounds.height <= 0) {
		return [];
	}

	if (isInvisibleDustPath({ tagName, paint, bounds })) {
		return [];
	}

	const parentComponentId = `src-element.${String(sourceElementIndex + 1).padStart(4, '0')}`;
	const baseComponent = {
		id: attributes.id || null,
		tagName,
		className,
		fill: normalizePaint(paint.fill),
		stroke: normalizePaint(paint.stroke),
		strokeWidth: paint.strokeWidth ?? attributes['stroke-width'] ?? null,
		fillRule: paint.fillRule ?? null,
		opacity: paint.opacity ?? null,
		fillOpacity: paint.fillOpacity ?? null,
		strokeOpacity: paint.strokeOpacity ?? null,
		textValue: tagName === 'text' ? readTextValue(tag) : null,
		fontSize: tagName === 'text' ? textFontSize(paint, attributes) : null,
		fontFamily: tagName === 'text' ? paint.fontFamily ?? attributes['font-family'] ?? null : null,
		fontPath: tagName === 'text' ? resolveTextFontPath(paint, attributes, textFontOptions) : null,
		pathData,
		bounds,
		center: bounds.center,
		area: Number((bounds.width * bounds.height).toFixed(3)),
		parentGroupIds: parent.groupIds,
		sourceLayerRoles,
		sourceUseId: parent.sourceUseInstances.at(-1)?.sourceUseId || null,
		sourceUseInstanceId: parent.sourceUseInstances.at(-1)?.sourceUseInstanceId || null,
		sourceUseInstances: parent.sourceUseInstances,
		transform,
		sourceIndex: sourceElementIndex,
		sourceElementIndex,
		parentComponentId: null,
		subcomponentIndex: null,
		componentLevel: 'element',
		splitStrategy: 'geometry-element',
		sourceElementComponentId: parentComponentId,
		sourceElement: tag,
		tileLayerCandidate: false,
		negativeSpaceCandidate: isWhitePaint(paint.fill) || isWhitePaint(paint.stroke),
	};

	if (tagName !== 'path' || !splitCompoundPaths) {
		return [baseComponent];
	}

	const subcomponents = splitPathComponent(baseComponent, pathData, transform);

	return subcomponents.length > 1 ? subcomponents : [baseComponent];
}

function classifyTileLayerCandidates(components, viewBox) {
	const baseCandidates = new Set(components.filter((component) => isBaseTileLayerCandidate(component, viewBox)));

	return components.map((component, index) => ({
		...component,
		tileLayerCandidate: baseCandidates.has(component)
			|| isLargeBackgroundLayer(component, components, index, baseCandidates, viewBox),
	}));
}

function getTransformedBounds(pathData, matrix) {
	return getPathBounds(pathData, matrix);
}

function getPathBounds(pathData, matrix = IDENTITY) {
	let item;
	try {
		item = new paper.CompoundPath(pathData);
		item.transform(new paper.Matrix(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f));
	} catch (error) {
		item?.remove();
		return null;
	}

	const bounds = item.bounds;
	const result = {
		left: round(bounds.left),
		top: round(bounds.top),
		right: round(bounds.right),
		bottom: round(bounds.bottom),
		width: round(bounds.width),
		height: round(bounds.height),
		center: {
			x: round(bounds.center.x),
			y: round(bounds.center.y),
		},
	};

	item.remove();
	return result;
}

function splitPathComponent(baseComponent, pathData, transform) {
	let item;

	try {
		item = new paper.CompoundPath(pathData);
	} catch (error) {
		item?.remove();
		return [];
	}

	const children = [...(item.children || [])];

	if (children.length <= 1) {
		item.remove();
		return [];
	}

	const childRecords = children
		.map((child, index) => {
			const childPathData = child.pathData;
			const localBounds = getPathBounds(childPathData);
			const bounds = getTransformedBounds(childPathData, transform);

			if (!childPathData || !localBounds || !bounds || bounds.width <= 0 || bounds.height <= 0) {
				return null;
			}

			return {
				pathData: childPathData,
				localBounds,
				bounds,
				subcomponentIndex: index,
			};
		})
		.filter(Boolean);

	item.remove();

	const clusters = clusterContainedSubpaths(childRecords);

	if (clusters.length <= 1) {
		return splitCompoundPathByContainedBands(baseComponent, pathData, transform, childRecords);
	}

	return clusters.map((cluster) => ({
		...baseComponent,
		pathData: cluster.pathData,
		bounds: cluster.bounds,
		center: cluster.bounds.center,
		area: Number((cluster.bounds.width * cluster.bounds.height).toFixed(3)),
		parentComponentId: baseComponent.sourceElementComponentId,
		subcomponentIndex: cluster.subcomponentIndex,
		componentLevel: 'subcomponent',
		splitStrategy: 'compound-path-island',
	}));
}

function splitCompoundPathByContainedBands(baseComponent, pathData, transform, childRecords) {
	const topLevelRecords = childRecords.filter((record, index) => !childRecords.some((candidate, candidateIndex) => (
		candidateIndex !== index && containsBounds(candidate.localBounds, record.localBounds)
	)));

	if (topLevelRecords.length !== 1 || childRecords.length <= 2) {
		return [];
	}

	const containedRecords = childRecords.filter((record) => record !== topLevelRecords[0]);
	const axis = separatedClusterAxis(containedRecords.map((record) => record.localBounds));

	if (!axis) {
		return [];
	}

	const clusters = clusterBoundsByAxis(containedRecords, axis);

	if (!shouldSplitContainedShapeClusters(clusters, axis)) {
		return [];
	}

	return intersectCompoundPathWithClusterBands({
		baseComponent,
		pathData,
		transform,
		axis,
		clusters,
		outerBounds: topLevelRecords[0].localBounds,
	});
}

function separatedClusterAxis(boundsList) {
	const yClusters = clusterBoundsByAxis(boundsList.map((bounds, index) => ({ localBounds: bounds, subcomponentIndex: index })), 'y');
	const xClusters = clusterBoundsByAxis(boundsList.map((bounds, index) => ({ localBounds: bounds, subcomponentIndex: index })), 'x');

	if (yClusters.length > 1 && yClusters.length >= xClusters.length) {
		return 'y';
	}

	if (xClusters.length > 1) {
		return 'x';
	}

	return null;
}

function clusterBoundsByAxis(records, axis) {
	const startKey = axis === 'y' ? 'top' : 'left';
	const endKey = axis === 'y' ? 'bottom' : 'right';
	const sorted = [...records].sort((left, right) => (
		left.localBounds[startKey] - right.localBounds[startKey]
		|| left.subcomponentIndex - right.subcomponentIndex
	));
	const clusters = [];

	for (const record of sorted) {
		const current = clusters[clusters.length - 1];
		const tolerance = Math.max(record.localBounds[endKey] - record.localBounds[startKey], 1) * 0.05;

		if (!current || record.localBounds[startKey] > current.end + tolerance) {
			clusters.push({
				records: [record],
				start: record.localBounds[startKey],
				end: record.localBounds[endKey],
			});
		} else {
			current.records.push(record);
			current.start = Math.min(current.start, record.localBounds[startKey]);
			current.end = Math.max(current.end, record.localBounds[endKey]);
		}
	}

	return clusters;
}

function shouldSplitContainedShapeClusters(clusters, axis) {
	if (clusters.length <= 1) {
		return false;
	}

	const spans = clusters.map((cluster) => cluster.end - cluster.start);
	const largestSpan = Math.max(...spans);
	const smallestSpan = Math.min(...spans);

	if (largestSpan <= 0 || smallestSpan / largestSpan < 0.35) {
		return false;
	}

	const clusterCounts = clusters.map((cluster) => cluster.records.length);
	const largestCount = Math.max(...clusterCounts);
	const smallestCount = Math.min(...clusterCounts);

	if (smallestCount < 2) {
		return false;
	}

	if (largestCount > 1 && smallestCount / largestCount < 0.5) {
		return false;
	}

	return clusters.every((cluster) => hasContainedShapeMass(cluster, axis));
}

function hasContainedShapeMass(cluster, axis) {
	const span = cluster.end - cluster.start;
	const crossStartKey = axis === 'y' ? 'left' : 'top';
	const crossEndKey = axis === 'y' ? 'right' : 'bottom';
	const crossSpan = Math.max(...cluster.records.map((record) => record.localBounds[crossEndKey]))
		- Math.min(...cluster.records.map((record) => record.localBounds[crossStartKey]));

	return span > 0 && crossSpan > 0;
}

function intersectCompoundPathWithClusterBands({
	baseComponent,
	pathData,
	transform,
	axis,
	clusters,
	outerBounds,
}) {
	let item;

	try {
		item = new paper.CompoundPath(pathData);
	} catch (error) {
		item?.remove();
		return [];
	}

	const bandLimits = clusters.map((cluster, index) => {
		const previous = clusters[index - 1];
		const next = clusters[index + 1];

		return {
			start: previous ? (previous.end + cluster.start) / 2 : axis === 'y' ? outerBounds.top : outerBounds.left,
			end: next ? (cluster.end + next.start) / 2 : axis === 'y' ? outerBounds.bottom : outerBounds.right,
		};
	});
	const splitComponents = bandLimits
		.map((limit, index) => {
			const rectangle = axis === 'y'
				? new paper.Path.Rectangle(
					new paper.Point(outerBounds.left - 1, limit.start),
					new paper.Size(outerBounds.width + 2, limit.end - limit.start),
				)
				: new paper.Path.Rectangle(
					new paper.Point(limit.start, outerBounds.top - 1),
					new paper.Size(limit.end - limit.start, outerBounds.height + 2),
				);
			const intersection = item.intersect(rectangle, { insert: false });
			rectangle.remove();

			if (!intersection || intersection.isEmpty()) {
				intersection?.remove();
				return null;
			}

			const childPathData = intersection.pathData;
			intersection.remove();
			const bounds = getTransformedBounds(childPathData, transform);

			if (!childPathData || !bounds || bounds.width <= 0 || bounds.height <= 0) {
				return null;
			}

			return {
				...baseComponent,
				pathData: childPathData,
				bounds,
				center: bounds.center,
				area: Number((bounds.width * bounds.height).toFixed(3)),
				parentComponentId: baseComponent.sourceElementComponentId,
				subcomponentIndex: index,
				componentLevel: 'subcomponent',
				splitStrategy: 'compound-path-band',
			};
		})
		.filter(Boolean);

	item.remove();

	return splitComponents.length > 1 ? splitComponents : [];
}

function clusterContainedSubpaths(records) {
	const topLevelRecords = records.filter((record, index) => !records.some((candidate, candidateIndex) => (
		candidateIndex !== index && containsBounds(candidate.bounds, record.bounds)
	)));

	return topLevelRecords.map((topLevel, clusterIndex) => {
		const members = records
			.filter((record) => record === topLevel || containsBounds(topLevel.bounds, record.bounds))
			.sort((left, right) => left.subcomponentIndex - right.subcomponentIndex);

		return {
			subcomponentIndex: clusterIndex,
			pathData: members.map((member) => member.pathData).join(' '),
			bounds: topLevel.bounds,
		};
	});
}

function containsBounds(outer, inner) {
	const tolerance = 0.01;

	return inner.left >= outer.left - tolerance
		&& inner.right <= outer.right + tolerance
		&& inner.top >= outer.top - tolerance
		&& inner.bottom <= outer.bottom + tolerance;
}

function geometryToPathData(tagName, attributes, tag, paint, textFontOptions) {
	if (tagName === 'path') {
		return attributes.d || null;
	}

	if (tagName === 'text') {
		return textToPathData(tag, attributes, paint, textFontOptions);
	}

	if (tagName === 'circle') {
		const cx = readNumber(attributes.cx);
		const cy = readNumber(attributes.cy);
		const r = readNumber(attributes.r);
		return Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(r)
			? circlePath(cx, cy, r)
			: null;
	}

	if (tagName === 'ellipse') {
		const cx = readNumber(attributes.cx);
		const cy = readNumber(attributes.cy);
		const rx = readNumber(attributes.rx);
		const ry = readNumber(attributes.ry);
		return Number.isFinite(cx) && Number.isFinite(cy) && Number.isFinite(rx) && Number.isFinite(ry)
			? ellipsePath(cx, cy, rx, ry)
			: null;
	}

	if (tagName === 'rect') {
		const x = readNumber(attributes.x, 0);
		const y = readNumber(attributes.y, 0);
		const width = readNumber(attributes.width);
		const height = readNumber(attributes.height);
		return Number.isFinite(width) && Number.isFinite(height)
			? `M${x},${y} H${x + width} V${y + height} H${x} Z`
			: null;
	}

	if (tagName === 'polygon' || tagName === 'polyline') {
		const points = parsePoints(attributes.points || '');
		if (points.length < 2) {
			return null;
		}
		return `${points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ')}${tagName === 'polygon' ? ' Z' : ''}`;
	}

	if (tagName === 'line') {
		const x1 = readNumber(attributes.x1);
		const y1 = readNumber(attributes.y1);
		const x2 = readNumber(attributes.x2);
		const y2 = readNumber(attributes.y2);
		return [x1, y1, x2, y2].every(Number.isFinite)
			? `M${x1},${y1} L${x2},${y2}`
			: null;
	}

	return null;
}

function findTextElementEnd(source, startIndex) {
	const match = /<\/text\s*>/i.exec(source.slice(startIndex));
	return match ? startIndex + match.index + match[0].length : null;
}

function loadTextFont(fontPath) {
	if (!TEXT_FONT_CACHE.has(fontPath)) {
		const font = opentype.loadSync(fontPath);
		font.__sourcePath = fontPath;
		TEXT_FONT_CACHE.set(fontPath, font);
	}
	return TEXT_FONT_CACHE.get(fontPath);
}

function textToPathData(tag, attributes, paint, textFontOptions = {}) {
	const text = readTextValue(tag);
	const fontPath = resolveTextFontPath(paint, attributes, textFontOptions);
	const textFont = textFontOptions.textFont
		|| (fontPath ? loadTextFont(fontPath) : null);

	if (!text || !textFont) {
		return null;
	}

	const tspanAttributes = readFirstTspanAttributes(tag);
	const x = readCoordinateList(attributes.x)[0] ?? readCoordinateList(tspanAttributes.x)[0];
	const y = readCoordinateList(attributes.y)[0] ?? readCoordinateList(tspanAttributes.y)[0];
	const fontSize = textFontSize(paint, attributes, tspanAttributes);

	if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(fontSize)) {
		return null;
	}

	return textFont.getPath(text, x, y, fontSize).toPathData(3);
}

function resolveTextFontPath(paint, attributes, textFontOptions = {}) {
	if (textFontOptions.textFontPath) {
		return textFontOptions.textFontPath;
	}

	const familyPath = findFontPathForFamily(paint.fontFamily ?? attributes['font-family']);
	return familyPath || findFontPathForFamily('serif');
}

function findFontPathForFamily(fontFamily) {
	for (const family of fontFamilyNames(fontFamily)) {
		for (const fileName of TEXT_FONT_CANDIDATES_BY_FAMILY.get(family) || [`${family}.ttf`]) {
			const fontPath = findFontFile(fileName);
			if (fontPath) {
				return fontPath;
			}
		}
	}

	return null;
}

function fontFamilyNames(fontFamily) {
	return String(fontFamily || '')
		.split(',')
		.map((family) => family.trim().replace(/^['"]|['"]$/g, '').toLowerCase())
		.filter(Boolean);
}

function findFontFile(fileName) {
	for (const directory of TEXT_FONT_DIRECTORIES) {
		const fontPath = path.resolve(directory, fileName);
		try {
			if (fsExists(fontPath)) {
				return fontPath;
			}
		} catch (error) {
			// Ignore inaccessible system font directories.
		}
	}

	return null;
}

function fsExists(filePath) {
	try {
		opentype.loadSync(filePath);
		return true;
	} catch (error) {
		return false;
	}
}

function readTextValue(tag) {
	return decodeXmlEntities(tag
		.replace(/<style\b[\s\S]*?<\/style>/gi, '')
		.replace(/<[^>]+>/g, '')
		.replace(/\s+/g, ' ')
		.trim());
}

function readFirstTspanAttributes(tag) {
	const tspanTag = /<tspan\b[^>]*>/i.exec(tag)?.[0];
	return tspanTag ? parseAttributes(tspanTag) : {};
}

function textFontSize(paint, attributes, tspanAttributes = {}) {
	return readLength(
		tspanAttributes['font-size']
		?? attributes['font-size']
		?? paint.fontSize,
		16,
	);
}

function readCoordinateList(value) {
	return String(value || '')
		.trim()
		.split(/[\s,]+/)
		.filter(Boolean)
		.map((entry) => readLength(entry))
		.filter(Number.isFinite);
}

function readLength(value, fallback = NaN) {
	if (value == null || value === '') {
		return fallback;
	}
	const match = /^(-?\d*\.?\d+(?:e[-+]?\d+)?)/i.exec(String(value).trim());
	return match ? Number.parseFloat(match[1]) : fallback;
}

function decodeXmlEntities(value) {
	return value
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}

function parseClassStyles(svgSource) {
	const styles = {};

	for (const styleMatch of svgSource.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
		const styleSource = styleMatch[1];

		for (const classMatch of styleSource.matchAll(/\.([A-Za-z0-9_-]+)\s*\{([^}]+)\}/g)) {
			styles[classMatch[1]] = parseStyleDeclaration(classMatch[2]);
		}
	}

	return styles;
}

function resolvePaint({ attributes, className, classStyles, parentPaint }) {
	const classPaint = className
		? classStyles[className] || {}
		: {};
	const inlinePaint = attributes.style
		? parseStyleDeclaration(attributes.style)
		: {};

	return {
		...parentPaint,
		...classPaint,
		...inlinePaint,
		...pickDefined({
			fill: attributes.fill,
			stroke: attributes.stroke,
			strokeWidth: attributes['stroke-width'],
			fillRule: attributes['fill-rule'],
			fillOpacity: attributes['fill-opacity'],
			strokeOpacity: attributes['stroke-opacity'],
			opacity: attributes.opacity,
		}),
	};
}

function parseStyleDeclaration(style) {
	const output = {};

	for (const declaration of style.split(';')) {
		const [rawName, rawValue] = declaration.split(':');
		if (!rawName || !rawValue) {
			continue;
		}
		const name = rawName.trim();
		const value = rawValue.trim();

		if (name === 'fill') {
			output.fill = value;
		} else if (name === 'stroke') {
			output.stroke = value;
		} else if (name === 'stroke-width') {
			output.strokeWidth = value;
		} else if (name === 'fill-rule') {
			output.fillRule = value;
		} else if (name === 'fill-opacity') {
			output.fillOpacity = value;
		} else if (name === 'stroke-opacity') {
			output.strokeOpacity = value;
		} else if (name === 'opacity') {
			output.opacity = value;
		} else if (name === 'font-size') {
			output.fontSize = value;
		} else if (name === 'font-family') {
			output.fontFamily = value;
		}
	}

	return output;
}

function parseAttributes(tag) {
	const attributes = {};

	for (const match of tag.matchAll(/([:\w-]+)\s*=\s*"([^"]*)"/g)) {
		attributes[match[1]] = match[2];
	}

	return attributes;
}

function readTagName(tag) {
	return /^<\s*([:\w-]+)/.exec(tag)?.[1]?.toLowerCase() || '';
}

function readViewBox(svgSource) {
	const values = /\bviewBox\s*=\s*"([^"]+)"/i.exec(svgSource)?.[1]
		?.trim()
		.split(/[\s,]+/)
		.map((value) => Number.parseFloat(value));

	if (!values || values.length !== 4 || values.some((value) => !Number.isFinite(value))) {
		return null;
	}

	return {
		minX: values[0],
		minY: values[1],
		width: values[2],
		height: values[3],
	};
}

function circlePath(cx, cy, radius) {
	return ellipsePath(cx, cy, radius, radius);
}

function ellipsePath(cx, cy, rx, ry) {
	return [
		`M${cx - rx},${cy}`,
		`C${cx - rx},${cy - (ry * 0.5522847498)} ${cx - (rx * 0.5522847498)},${cy - ry} ${cx},${cy - ry}`,
		`C${cx + (rx * 0.5522847498)},${cy - ry} ${cx + rx},${cy - (ry * 0.5522847498)} ${cx + rx},${cy}`,
		`C${cx + rx},${cy + (ry * 0.5522847498)} ${cx + (rx * 0.5522847498)},${cy + ry} ${cx},${cy + ry}`,
		`C${cx - (rx * 0.5522847498)},${cy + ry} ${cx - rx},${cy + (ry * 0.5522847498)} ${cx - rx},${cy}`,
		'Z',
	].join(' ');
}

function parsePoints(points) {
	const values = points
		.trim()
		.split(/[\s,]+/)
		.map((value) => Number.parseFloat(value));
	const result = [];

	for (let index = 0; index < values.length - 1; index += 2) {
		if (Number.isFinite(values[index]) && Number.isFinite(values[index + 1])) {
			result.push({ x: values[index], y: values[index + 1] });
		}
	}

	return result;
}

function sourceLayerRoleFromAttributes(attributes) {
	const sourceLayerRole = attributes['data-source-layer'] || null;
	return sourceLayerRole === 'tile-background' ? sourceLayerRole : null;
}

function isBaseTileLayerCandidate(component, viewBox) {
	if (component.sourceLayerRoles?.includes('tile-background')) {
		return true;
	}

	if (viewBox && !boundsOverlap(component.bounds, viewBoxBounds(viewBox))) {
		return true;
	}

	if (isViewBoxOutline(component, viewBox)) {
		return true;
	}

	if (component.className && /^st[0-6]$/.test(component.className)) {
		return true;
	}

	if (component.tagName === 'rect' && component.bounds.width > 80 && component.bounds.height > 100) {
		return true;
	}

	return isTilePaintServerReference(component.fill);
}

function isLargeBackgroundLayer(component, components, index, baseCandidates, viewBox) {
	return isLargeViewBoxLayer(component, viewBox)
		&& (
			(isBackgroundPaint(component)
				&& components.slice(index + 1).some((candidate) => isLaterFacePaintLayer(candidate, component, baseCandidates)))
			|| isEarlierTileShellLayer(component, components, index, baseCandidates, viewBox)
		);
}

function isLaterFacePaintLayer(candidate, backgroundCandidate, baseCandidates) {
	return !baseCandidates.has(candidate)
		&& !candidate.negativeSpaceCandidate
		&& (isPaint(candidate.fill) || isPaint(candidate.stroke))
		&& boundsOverlap(candidate.bounds, backgroundCandidate.bounds);
}

function isEarlierTileShellLayer(component, components, index, baseCandidates, viewBox) {
	return components.slice(index + 1).some((candidate) => (
		baseCandidates.has(candidate)
		&& !isViewBoxOutline(candidate, viewBox)
		&& boundsOverlap(component.bounds, candidate.bounds)
	));
}

function isInvisibleDustPath({ tagName, paint, bounds }) {
	const area = bounds.width * bounds.height;

	return tagName === 'path'
		&& (
			area <= TINY_PATH_DUST_MAX_AREA
			|| (
				area <= INVISIBLE_DUST_MAX_AREA
				&& maxEffectivePaintAlpha(paint) <= INVISIBLE_DUST_MAX_ALPHA
			)
		);
}

function maxEffectivePaintAlpha(paint) {
	const opacity = numericOpacity(paint.opacity);
	const alphas = [];

	if (isPaint(paint.fill)) {
		alphas.push(opacity * numericOpacity(paint.fillOpacity));
	}
	if (isPaint(paint.stroke)) {
		alphas.push(opacity * numericOpacity(paint.strokeOpacity));
	}

	return alphas.length > 0 ? Math.max(...alphas) : 0;
}

function numericOpacity(value) {
	const number = Number(value);

	if (!Number.isFinite(number)) {
		return 1;
	}

	return Math.max(0, Math.min(1, number));
}

function isLargeViewBoxLayer(component, viewBox) {
	if (!viewBox) {
		return false;
	}

	return component.bounds.width >= viewBox.width * 0.65
		&& component.bounds.height >= viewBox.height * 0.7;
}

function isBackgroundPaint(component) {
	const fill = String(component.fill || '').toLowerCase();
	const stroke = String(component.stroke || '').toLowerCase();

	return isVisibleBackgroundPaint(fill)
		|| (!isPaint(fill) && isVisibleBackgroundPaint(stroke));
}

function isVisibleBackgroundPaint(value) {
	return Boolean(value)
		&& (value.startsWith('url(')
			|| isWhitePaint(value)
			|| value === '#eeeeee'
			|| value === '#eee');
}

function isTilePaintServerReference(value) {
	const paintServerId = /^url\(#([^)]+)\)$/i.exec(String(value || '').trim())?.[1] || '';

	return /(?:tile|pattern|background|shell|face|base)/i.test(paintServerId);
}

function viewBoxBounds(viewBox) {
	return {
		left: viewBox.minX,
		top: viewBox.minY,
		right: viewBox.minX + viewBox.width,
		bottom: viewBox.minY + viewBox.height,
	};
}

function boundsOverlap(left, right) {
	return left.left < right.right
		&& left.right > right.left
		&& left.top < right.bottom
		&& left.bottom > right.top;
}

function isViewBoxOutline(component, viewBox) {
	return component.tagName === 'rect'
		&& viewBox
		&& isEmptyPaint(component.fill)
		&& isPaint(component.stroke)
		&& nearlyEqual(component.bounds.left, viewBox.minX)
		&& nearlyEqual(component.bounds.top, viewBox.minY)
		&& nearlyEqual(component.bounds.right, viewBox.minX + viewBox.width)
		&& nearlyEqual(component.bounds.bottom, viewBox.minY + viewBox.height);
}

function isEmptyPaint(value) {
	return !value || value === 'none' || value === 'transparent';
}

function isPaint(value) {
	return Boolean(value) && value !== 'none' && value !== 'transparent';
}

function nearlyEqual(left, right) {
	return Math.abs(left - right) < 0.01;
}

function isWhitePaint(value) {
	const normalized = normalizePaint(value);

	if (normalized === 'white') {
		return true;
	}

	const color = parseRgbPaint(normalized);
	if (!color) {
		return false;
	}

	const darkestChannel = Math.min(color.r, color.g, color.b);
	const lightestChannel = Math.max(color.r, color.g, color.b);

	return darkestChannel >= 240 && lightestChannel - darkestChannel <= 16;
}

function normalizePaint(value) {
	if (!value || value === 'none') {
		return value || null;
	}

	if (/^url\(/i.test(value.trim())) {
		return value.trim();
	}

	const normalized = value.toLowerCase();
	const shorthandHex = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(normalized);

	if (shorthandHex) {
		return `#${shorthandHex.slice(1).map((digit) => digit + digit).join('')}`;
	}

	return normalized;
}

function parseRgbPaint(value) {
	const hex = /^#([0-9a-f]{6})$/i.exec(value || '');
	if (hex) {
		return {
			r: Number.parseInt(hex[1].slice(0, 2), 16),
			g: Number.parseInt(hex[1].slice(2, 4), 16),
			b: Number.parseInt(hex[1].slice(4, 6), 16),
		};
	}

	const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(value || '');
	if (!rgb) {
		return null;
	}

	const [r, g, b] = rgb.slice(1).map((channel) => Number.parseInt(channel, 10));
	if ([r, g, b].some((channel) => !Number.isFinite(channel) || channel < 0 || channel > 255)) {
		return null;
	}

	return { r, g, b };
}

function readNumber(value, fallback = NaN) {
	if (value == null || value === '') {
		return fallback;
	}
	return Number.parseFloat(value);
}

function pickDefined(values) {
	return Object.fromEntries(Object.entries(values).filter(([, value]) => value != null));
}

function round(value) {
	return Number(value.toFixed(3));
}

