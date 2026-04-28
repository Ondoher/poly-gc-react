import paper from 'paper';
import {
	boundsContainBounds,
	boundsContainCenter,
	boundsOverlap,
	findSmallIsolatedCandidates,
	getComponentUnionBounds,
	getPaintComponents,
	isRelatedKnockout,
	makePaintPathWithKnockouts,
	pruneNestedKnockouts,
	selectKnockoutComponents,
	subtractKnockouts,
	transformComponentPath,
} from '../normalized-face-components.js';

describe('normalized face components', function() {
	beforeEach(function() {
		paper.setup([200, 200]);
	});

	it('selects paint components by class name', function() {
		const components = [
			component('red', { className: 'paint-red' }),
			component('blue', { className: 'paint-blue' }),
			component('cutout', { className: 'negative-space' }),
			component('none', { className: null }),
		];

		expect(getPaintComponents(components, ['paint-red', 'paint-blue']).map((item) => item.id))
			.toEqual(['red', 'blue']);
	});

	it('returns null union bounds for an empty component set', function() {
		expect(getComponentUnionBounds([])).toBeNull();
	});

	it('computes union bounds and area for components', function() {
		const bounds = getComponentUnionBounds([
			component('left', { bounds: box(0, 10, 20, 40) }),
			component('right', { bounds: box(15, 5, 35, 30) }),
		]);

		expect(bounds).toEqual({
			left: 0,
			top: 5,
			right: 35,
			bottom: 40,
			width: 35,
			height: 35,
			area: 1225,
		});
	});

	it('checks center containment inclusively', function() {
		const bounds = box(10, 20, 30, 40);

		expect(boundsContainCenter(bounds, { x: 10, y: 20 })).toBe(true);
		expect(boundsContainCenter(bounds, { x: 30, y: 40 })).toBe(true);
		expect(boundsContainCenter(bounds, { x: 31, y: 40 })).toBe(false);
		expect(boundsContainCenter(bounds, { x: 30, y: 41 })).toBe(false);
	});

	it('checks bounds containment inclusively', function() {
		const outer = box(10, 20, 30, 40);

		expect(boundsContainBounds(outer, box(10, 20, 30, 40))).toBe(true);
		expect(boundsContainBounds(outer, box(12, 22, 28, 38))).toBe(true);
		expect(boundsContainBounds(outer, box(9, 22, 28, 38))).toBe(false);
		expect(boundsContainBounds(outer, box(12, 22, 31, 38))).toBe(false);
	});

	it('checks overlapping bounds with touching edges excluded', function() {
		expect(boundsOverlap(box(0, 0, 10, 10), box(5, 5, 15, 15))).toBe(true);
		expect(boundsOverlap(box(0, 0, 10, 10), box(10, 0, 20, 10))).toBe(false);
		expect(boundsOverlap(box(0, 0, 10, 10), box(0, 10, 10, 20))).toBe(false);
		expect(boundsOverlap(box(0, 0, 10, 10), box(11, 11, 20, 20))).toBe(false);
	});

	it('finds small isolated candidates and sorts top-band candidates first', function() {
		const outer = box(0, 0, 100, 100);
		const topLeft = component('top-left', { bounds: box(5, 5, 15, 20) });
		const topRight = component('top-right', { bounds: box(70, 10, 80, 20) });
		const bottom = component('bottom', { bounds: box(20, 80, 30, 90) });
		const large = component('large', { bounds: box(35, 35, 85, 85) });

		const candidates = findSmallIsolatedCandidates([bottom, large, topRight, topLeft], outer, {
			topBandRatio: 0.3,
			maxAreaRatio: 0.2,
			minWidth: 5,
			minHeight: 5,
			isolationGapRatio: 0.01,
		});

		expect(candidates.map((candidate) => candidate.item.id)).toEqual(['top-left', 'top-right', 'bottom']);
		expect(candidates[0].topBand).toBe(true);
		expect(candidates[0].nearestCorner).toBe('topLeft');
		expect(candidates[0].relativePosition).toBe('top-left');
		expect(candidates[2].topBand).toBe(false);
	});

	it('filters small candidates by size thresholds', function() {
		const outer = box(0, 0, 100, 100);
		const tooSmall = component('too-small', { bounds: box(5, 5, 7, 7) });
		const usable = component('usable', { bounds: box(20, 5, 30, 15) });

		const candidates = findSmallIsolatedCandidates([tooSmall, usable], outer, {
			minWidth: 5,
			minHeight: 5,
			maxAreaRatio: 0.2,
		});

		expect(candidates.map((candidate) => candidate.item.id)).toEqual(['usable']);
	});

	it('selects negative-space components that overlap paint without containing all paint', function() {
		const paintComponents = [
			component('paint-a', { bounds: box(0, 0, 20, 20), area: 400 }),
			component('paint-b', { bounds: box(30, 0, 50, 20), area: 400 }),
		];
		const components = [
			...paintComponents,
			component('inside-cutout', {
				bounds: box(5, 5, 15, 15),
				negativeSpaceCandidate: true,
				parentGroupIds: ['art'],
			}),
			component('outside-cutout', {
				bounds: box(70, 70, 80, 80),
				negativeSpaceCandidate: true,
				parentGroupIds: ['art'],
			}),
			component('too-large-cutout', {
				bounds: box(-5, -5, 55, 25),
				negativeSpaceCandidate: true,
				parentGroupIds: ['art'],
			}),
			component('wrong-group-cutout', {
				bounds: box(35, 5, 45, 15),
				negativeSpaceCandidate: true,
				parentGroupIds: ['other'],
			}),
			component('painted-shape', {
				bounds: box(5, 5, 15, 15),
				negativeSpaceCandidate: false,
				parentGroupIds: ['art'],
			}),
		];

		const selected = selectKnockoutComponents(components, paintComponents, {
			maxArea: 500,
			sourceArtGroupId: 'art',
		});

		expect(selected.map((item) => item.id)).toEqual(['inside-cutout']);
	});

	it('requires paint components before selecting knockouts', function() {
		const selected = selectKnockoutComponents([
			component('cutout', {
				bounds: box(5, 5, 15, 15),
				negativeSpaceCandidate: true,
			}),
		], []);

		expect(selected).toEqual([]);
	});

	it('relates knockouts by nested group, contained center, or overlapping bounds', function() {
		const paint = component('paint', {
			bounds: box(10, 10, 50, 50),
			parentGroupIds: ['outer', 'art'],
			area: 1600,
		});
		const sameGroup = component('same-group', {
			bounds: box(70, 70, 80, 80),
			parentGroupIds: ['art'],
			area: 100,
		});
		const containedCenter = component('contained-center', {
			bounds: box(45, 45, 65, 65),
			area: 400,
		});
		const overlapping = component('overlapping', {
			bounds: box(45, 45, 70, 70),
			center: { x: 57.5, y: 57.5 },
			area: 625,
		});
		const unrelated = component('unrelated', {
			bounds: box(70, 70, 80, 80),
			area: 100,
		});
		const larger = component('larger', {
			bounds: box(0, 0, 100, 100),
			area: 10000,
		});

		expect(isRelatedKnockout(paint, sameGroup)).toBe(true);
		expect(isRelatedKnockout(paint, containedCenter)).toBe(true);
		expect(isRelatedKnockout(paint, overlapping)).toBe(true);
		expect(isRelatedKnockout(paint, unrelated)).toBe(false);
		expect(isRelatedKnockout(paint, larger)).toBe(false);
	});

	it('prunes nested knockout components in favor of their containing knockout', function() {
		const outer = component('outer', { bounds: box(0, 0, 30, 30), area: 900 });
		const inner = component('inner', { bounds: box(10, 10, 20, 20), area: 100 });
		const sibling = component('sibling', { bounds: box(40, 0, 50, 10), area: 100 });

		expect(pruneNestedKnockouts([inner, sibling, outer]).map((item) => item.id))
			.toEqual(['sibling', 'outer']);
	});

	it('transforms component paths with source and output transforms', function() {
		const pathData = transformComponentPath(component('mark', {
			pathData: 'M0,0 H10 V10 H0 Z',
			transform: { a: 1, b: 0, c: 0, d: 1, e: 5, f: 10 },
		}), { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 });

		expect(pathData).toContain('M10,20');
		expect(pathData).toContain('h20');
		expect(pathData).toContain('v20');
		expect(pathData).toContain('h-20');
	});

	it('renders filled paint paths with transform and provenance attributes when no knockouts are present', function() {
		const output = makePaintPathWithKnockouts({
			component: component('body', {
				className: 'paint-red',
				fill: '#d00',
				fillRule: 'evenodd',
				pathData: 'M0,0 H10 V10 H0 Z',
				transform: { a: 1, b: 0, c: 0, d: 1, e: 5, f: 10 },
			}),
			color: '#ff0000',
			attributes: {
				'data-part-id': 'body',
				'data-empty': null,
			},
		});

		expect(output).toContain('fill="#ff0000"');
		expect(output).toContain('fill-rule="evenodd"');
		expect(output).toContain('transform="matrix(1 0 0 1 5 10)"');
		expect(output).toContain('data-source-id="body"');
		expect(output).toContain('data-source-class="paint-red"');
		expect(output).toContain('data-part-id="body"');
		expect(output).not.toContain('data-empty');
		expect(output).toContain('d="M0,0 H10 V10 H0 Z"');
	});

	it('renders stroke-only paint paths with stroke attributes', function() {
		const output = makePaintPathWithKnockouts({
			component: component('outline', {
				fill: 'none',
				stroke: '#111',
				strokeWidth: 3,
				pathData: 'M0,0 H10 V10 H0 Z',
			}),
			color: '#222222',
		});

		expect(output).toContain('fill="none"');
		expect(output).toContain('stroke="#222222"');
		expect(output).toContain('stroke-width="3"');
	});

	it('subtracts knockout paths from paint paths', function() {
		const output = subtractKnockouts('M0,0 H20 V20 H0 Z', [
			'M5,5 H15 V15 H5 Z',
		]);

		expect(output).toContain('M0,0');
		expect(output).toContain('M5,15');
		expect(output).toContain('v-10');
		expect(output).not.toBe('M0,0 H20 V20 H0 Z');
	});

	it('bakes knockouts into paint paths and records negative-space provenance', function() {
		const output = makePaintPathWithKnockouts({
			component: component('body', {
				className: 'paint-red',
				fill: '#d00',
				pathData: 'M0,0 H20 V20 H0 Z',
			}),
			color: '#ff0000',
			knockouts: [
				component('cutout', {
					pathData: 'M5,5 H15 V15 H5 Z',
				}),
			],
			transform: { a: 1, b: 0, c: 0, d: 1, e: 10, f: 0 },
		});

		expect(output).toContain('fill="#ff0000"');
		expect(output).toContain('data-negative-space="paper-subtract"');
		expect(output).toContain('data-knockout-count="1"');
		expect(output).toContain('data-source-id="body"');
		expect(output).not.toContain('transform="matrix');
		expect(output).toContain('M10,0');
		expect(output).toContain('M15,15');
		expect(output).toContain('h10');
	});
});

function component(id, options = {}) {
	const bounds = options.bounds || box(0, 0, 10, 10);

	return {
		id,
		className: options.className ?? null,
		bounds,
		center: options.center || {
			x: bounds.left + (bounds.width / 2),
			y: bounds.top + (bounds.height / 2),
		},
		area: options.area ?? bounds.area,
		parentGroupIds: options.parentGroupIds || [],
		negativeSpaceCandidate: Boolean(options.negativeSpaceCandidate),
		fill: options.fill,
		stroke: options.stroke,
		strokeWidth: options.strokeWidth,
		fillRule: options.fillRule,
		pathData: options.pathData,
		transform: options.transform,
	};
}

function box(left, top, right, bottom) {
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
