import fs from 'fs';
import path from 'path';
import { getFacePaths, normalizePath } from './preprocessed-face-validation-utils.js';
import { extractSourceSvgComponents } from './source-svg-components.js';
import { findSmallIsolatedCandidates, getComponentUnionBounds } from './normalized-face-components.js';

const faceKey = process.argv[2];

if (!faceKey) {
	console.error('Usage: node scripts/3d-assets/svg-preprocessor/inspect-source-svg-components.js <face-key>');
	process.exit(1);
}

const paths = getFacePaths(faceKey);

if (!fs.existsSync(paths.sourceSvg)) {
	console.error(`Missing source SVG for ${faceKey}: ${path.relative(process.cwd(), paths.sourceSvg)}`);
	process.exit(1);
}

const source = fs.readFileSync(paths.sourceSvg, 'utf8');
const extracted = extractSourceSvgComponents(source);
const components = extracted.components
	.map((component, index) => ({
		index,
		id: component.id,
		tagName: component.tagName,
		className: component.className,
		fill: component.fill,
		stroke: component.stroke,
		strokeWidth: component.strokeWidth,
		bounds: component.bounds,
		center: component.center,
		area: component.area,
		parentGroupIds: component.parentGroupIds,
		tileLayerCandidate: component.tileLayerCandidate,
		negativeSpaceCandidate: component.negativeSpaceCandidate,
	}))
	.sort((left, right) => right.area - left.area);
const paintComponents = extracted.components
	.filter((component) => !component.tileLayerCandidate)
	.filter((component) => !component.negativeSpaceCandidate);
const smallIsolatedCandidates = findSmallIsolatedCandidates(
	paintComponents,
	getComponentUnionBounds(paintComponents),
	{ topBandRatio: 0.4, maxAreaRatio: 0.22 },
).map((candidate) => ({
	id: candidate.item.id,
	className: candidate.item.className,
	fill: candidate.item.fill,
	stroke: candidate.item.stroke,
	bounds: candidate.bounds,
	center: candidate.center,
	area: Number(candidate.area.toFixed(3)),
	areaRatio: Number(candidate.areaRatio.toFixed(4)),
	normalizedBottom: Number(candidate.normalizedBottom.toFixed(4)),
	cornerDistances: Object.fromEntries(Object.entries(candidate.cornerDistances)
		.map(([corner, distanceValue]) => [corner, Number(distanceValue.toFixed(4))])),
	nearestCorner: candidate.nearestCorner,
	relativePosition: candidate.relativePosition,
	side: candidate.side,
	topBand: candidate.topBand,
	isolationScore: Number(candidate.isolationScore.toFixed(3)),
}));
const report = {
	faceKey,
	sourceSvg: normalizePath(paths.sourceSvg),
	viewBox: extracted.viewBox,
	componentCount: components.length,
	paintSummary: summarizePaint(components),
	smallIsolatedCandidates,
	components,
};

console.log(`${faceKey}: ${components.length} source components`);
console.log(JSON.stringify({
	faceKey: report.faceKey,
	sourceSvg: report.sourceSvg,
	viewBox: report.viewBox,
	componentCount: report.componentCount,
	paintSummary: report.paintSummary,
	smallIsolatedCandidates: report.smallIsolatedCandidates,
}, null, 2));
for (const component of components.slice(0, 12)) {
	console.log([
		`#${component.index}`,
		component.id || '(no-id)',
		component.tagName,
		component.className || '(no-class)',
		component.fill || '(no-fill)',
		`area=${component.area}`,
		`bounds=${component.bounds.left},${component.bounds.top},${component.bounds.right},${component.bounds.bottom}`,
		component.tileLayerCandidate ? 'tile-candidate' : '',
		component.negativeSpaceCandidate ? 'negative-space' : '',
	].filter(Boolean).join(' '));
}

function summarizePaint(components) {
	const summary = new Map();

	for (const component of components) {
		const key = `${component.className || '(no-class)'}|${component.fill || '(no-fill)'}|${component.stroke || '(no-stroke)'}`;
		const current = summary.get(key) || {
			className: component.className,
			fill: component.fill,
			stroke: component.stroke,
			count: 0,
			totalArea: 0,
		};
		current.count += 1;
		current.totalArea += component.area;
		summary.set(key, current);
	}

	return [...summary.values()]
		.map((entry) => ({
			...entry,
			totalArea: Number(entry.totalArea.toFixed(3)),
		}))
		.sort((left, right) => right.totalArea - left.totalArea);
}

