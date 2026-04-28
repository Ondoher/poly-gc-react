import { extractSourceSvgComponents } from '../source-svg-components.js';
import {
	findSmallIsolatedCandidates,
	getPaintComponents,
	selectKnockoutComponents,
} from '../normalized-face-components.js';

describe('source normalization domain behavior', function() {
	it('keeps tile chrome out of downstream artwork candidates', function() {
		const source = `<svg viewBox="0 0 100 140">
	<rect id="outline" x="0" y="0" width="100" height="140" fill="none" stroke="#222"/>
	<rect id="background" x="0" y="0" width="90" height="120" fill="#eee"/>
	<circle id="face-mark" class="face-art" cx="50" cy="70" r="10" fill="#111"/>
</svg>`;

		const components = extractSourceSvgComponents(source).components;
		const downstreamArtwork = components.filter((component) => !component.tileLayerCandidate);

		expect(findComponent(components, 'outline').tileLayerCandidate).toBe(true);
		expect(findComponent(components, 'background').tileLayerCandidate).toBe(true);
		expect(downstreamArtwork.map((component) => component.id)).toEqual(['face-mark']);
	});

	it('keeps source cutouts available without making them paint artwork', function() {
		const source = `<svg viewBox="0 0 100 100">
	<g id="art">
		<path id="body" class="paint-red" fill="#d00" d="M10,10 H80 V80 H10 Z"/>
		<path id="inner-cutout" fill="#fff" d="M35,35 H55 V55 H35 Z"/>
	</g>
</svg>`;

		const components = extractSourceSvgComponents(source).components;
		const paintComponents = getPaintComponents(components, ['paint-red']);
		const cutouts = selectKnockoutComponents(components, paintComponents, {
			sourceArtGroupId: 'art',
		});

		expect(paintComponents.map((component) => component.id)).toEqual(['body']);
		expect(findComponent(components, 'inner-cutout').negativeSpaceCandidate).toBe(true);
		expect(cutouts.map((component) => component.id)).toEqual(['inner-cutout']);
	});

	it('preserves separable repeated artwork members from one compound path', function() {
		const source = `<svg viewBox="0 0 100 40">
	<g id="bamboo-group">
		<path id="bamboo-sticks" fill="#070" d="M0,0 H10 V30 H0 Z M30,0 H40 V30 H30 Z M60,0 H70 V30 H60 Z"/>
	</g>
</svg>`;

		const components = extractSourceSvgComponents(source, { splitCompoundPaths: true }).components;

		expect(components.length).toBe(3);
		expect(components.map((component) => component.parentGroupIds)).toEqual([
			['bamboo-group'],
			['bamboo-group'],
			['bamboo-group'],
		]);
		expect(components.every((component) => component.id === 'bamboo-sticks')).toBe(true);
		expect(components.every((component) => component.parentComponentId === 'src-element.0001')).toBe(true);
		expect(components.map((component) => component.bounds.left)).toEqual([0, 30, 60]);
	});

	it('discovers small top-corner optional labels ahead of body artwork', function() {
		const source = `<svg viewBox="0 0 100 140">
	<path id="body-art" fill="#111" d="M25,40 H80 V120 H25 Z"/>
	<path id="number-label" fill="#d00" d="M8,8 H18 V24 H8 Z"/>
</svg>`;

		const components = extractSourceSvgComponents(source).components;
		const candidates = findSmallIsolatedCandidates(components, null, {
			topBandRatio: 0.3,
			maxAreaRatio: 0.18,
			minWidth: 5,
			minHeight: 5,
		});

		expect(candidates[0].item.id).toBe('number-label');
		expect(candidates[0].topBand).toBe(true);
		expect(candidates[0].nearestCorner).toBe('topLeft');
	});

	it('does not let large central artwork masquerade as an optional glyph', function() {
		const source = `<svg viewBox="0 0 100 140">
	<path id="large-body-art" fill="#111" d="M20,25 H90 V125 H20 Z"/>
	<path id="small-glyph" fill="#d00" d="M8,8 H18 V24 H8 Z"/>
</svg>`;

		const components = extractSourceSvgComponents(source).components;
		const candidates = findSmallIsolatedCandidates(components, null, {
			topBandRatio: 0.3,
			maxAreaRatio: 0.18,
			minWidth: 5,
			minHeight: 5,
		});

		expect(candidates.map((candidate) => candidate.item.id)).toEqual(['small-glyph']);
	});
});

function findComponent(components, id) {
	return components.find((component) => component.id === id);
}
