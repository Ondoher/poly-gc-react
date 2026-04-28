import {
	composeMatrices,
	extractSourceSvgComponents,
	parseTransform,
	sanitizeSvgSource,
} from '../source-svg-components.js';

describe('source SVG components', function() {
	it('sanitizes Adobe namespace entities before parsing', function() {
		const source = `<!DOCTYPE svg [
<!ENTITY ns_ai "http://ns.adobe.com/AdobeIllustrator/10.0/">
]>
<svg xmlns:i="&ns_ai;" requiredExtensions="&ns_ai;"></svg>`;

		const sanitized = sanitizeSvgSource(source);

		expect(sanitized).not.toContain('<!DOCTYPE');
		expect(sanitized).toContain('xmlns:i="http://ns.adobe.com/AdobeIllustrator/10.0/"');
		expect(sanitized).toContain('requiredExtensions="http://ns.adobe.com/AdobeIllustrator/10.0/"');
	});

	it('parses common SVG transform commands', function() {
		expectMatrix(parseTransform('translate(10, 20)'), {
			a: 1,
			b: 0,
			c: 0,
			d: 1,
			e: 10,
			f: 20,
		});
		expectMatrix(parseTransform('scale(2, 3)'), {
			a: 2,
			b: 0,
			c: 0,
			d: 3,
			e: 0,
			f: 0,
		});
		expectMatrix(parseTransform('matrix(1 2 3 4 5 6)'), {
			a: 1,
			b: 2,
			c: 3,
			d: 4,
			e: 5,
			f: 6,
		});
		expectMatrix(parseTransform('rotate(90)'), {
			a: 0,
			b: 1,
			c: -1,
			d: 0,
			e: 0,
			f: 0,
		});
	});

	it('composes parent and child matrices in SVG order', function() {
		const composed = composeMatrices(
			parseTransform('translate(10, 20)'),
			parseTransform('scale(2, 3)'),
		);

		expectMatrix(composed, {
			a: 2,
			b: 0,
			c: 0,
			d: 3,
			e: 10,
			f: 20,
		});
	});

	it('extracts geometry with inherited group paint, class, transform, and ancestry', function() {
		const source = `<svg viewBox="0 0 100 100">
	<style>.glyph { fill: #F00; stroke: #00F; stroke-width: 2; opacity: 0.5; }</style>
	<g id="art" class="glyph" transform="translate(5, 10)">
		<rect id="mark" x="1" y="2" width="3" height="4"/>
	</g>
</svg>`;

		const result = extractSourceSvgComponents(source);
		const component = result.components[0];

		expect(result.viewBox).toEqual({ minX: 0, minY: 0, width: 100, height: 100 });
		expect(result.groups).toEqual(['art']);
		expect(component.id).toBe('mark');
		expect(component.tagName).toBe('rect');
		expect(component.className).toBe('glyph');
		expect(component.fill).toBe('#ff0000');
		expect(component.stroke).toBe('#0000ff');
		expect(component.strokeWidth).toBe('2');
		expect(component.opacity).toBe('0.5');
		expect(component.parentGroupIds).toEqual(['art']);
		expect(component.bounds.left).toBe(6);
		expect(component.bounds.top).toBe(12);
		expect(component.bounds.width).toBe(3);
		expect(component.bounds.height).toBe(4);
	});

	it('preserves expanded use provenance on child geometry', function() {
		const source = `<svg viewBox="0 0 100 100">
	<g data-source-use="symbol-a" transform="translate(10, 0)">
		<g id="symbol-a">
			<rect id="mark" x="1" y="2" width="3" height="4" fill="#111"/>
		</g>
	</g>
</svg>`;

		const component = extractSourceSvgComponents(source).components[0];

		expect(component.parentGroupIds).toEqual(['symbol-a']);
		expect(component.sourceUseId).toBe('symbol-a');
		expect(component.sourceUseInstanceId).toBe('source-use.0001.symbol-a');
		expect(component.sourceUseInstances).toEqual([{
			sourceUseId: 'symbol-a',
			sourceUseInstanceId: 'source-use.0001.symbol-a',
		}]);
	});

	it('extracts all supported geometry tags as path-backed components', function() {
		const source = `<svg viewBox="0 0 100 100">
	<circle id="circle" cx="10" cy="10" r="4" fill="#111"/>
	<ellipse id="ellipse" cx="25" cy="10" rx="6" ry="3" fill="#222"/>
	<polygon id="polygon" points="40,5 50,5 45,15" fill="#333"/>
	<polyline id="polyline" points="55,5 65,5 65,15" fill="none" stroke="#444"/>
	<line id="line" x1="70" y1="5" x2="80" y2="15" stroke="#555"/>
</svg>`;

		const components = extractSourceSvgComponents(source).components;

		expect(components.map((component) => component.id)).toEqual([
			'circle',
			'ellipse',
			'polygon',
			'polyline',
			'line',
		]);
		expect(components.every((component) => component.pathData)).toBe(true);
		expect(components.every((component) => component.bounds.width > 0)).toBe(true);
		expect(components.every((component) => component.bounds.height > 0)).toBe(true);
	});

	it('applies paint precedence from parent, class, inline style, then direct attributes', function() {
		const source = `<svg viewBox="0 0 50 50">
	<style>.mark { fill: #222; stroke: #333; stroke-width: 2; }</style>
	<g fill="#111" stroke="#000" opacity="0.4">
		<rect id="class-paint" class="mark" x="1" y="1" width="4" height="4"/>
		<rect id="inline-paint" class="mark" x="10" y="1" width="4" height="4" style="fill: #444; stroke: #555; opacity: 0.7;"/>
		<rect id="attribute-paint" class="mark" x="20" y="1" width="4" height="4" style="fill: #444; stroke: #555;" fill="#666" stroke="#777" stroke-width="8"/>
	</g>
</svg>`;

		const components = extractSourceSvgComponents(source).components;
		const classPaint = findComponent(components, 'class-paint');
		const inlinePaint = findComponent(components, 'inline-paint');
		const attributePaint = findComponent(components, 'attribute-paint');

		expect(classPaint.fill).toBe('#222222');
		expect(classPaint.stroke).toBe('#333333');
		expect(classPaint.strokeWidth).toBe('2');
		expect(classPaint.opacity).toBe('0.4');
		expect(inlinePaint.fill).toBe('#444444');
		expect(inlinePaint.stroke).toBe('#555555');
		expect(inlinePaint.opacity).toBe('0.7');
		expect(attributePaint.fill).toBe('#666666');
		expect(attributePaint.stroke).toBe('#777777');
		expect(attributePaint.strokeWidth).toBe('8');
	});

	it('preserves paint server URL fragment case', function() {
		const source = `<svg viewBox="0 0 20 20">
	<defs><linearGradient id="linearGradient8797"/></defs>
	<rect id="gradient-mark" x="1" y="1" width="10" height="10" fill="url(#linearGradient8797)"/>
</svg>`;

		const component = extractSourceSvgComponents(source).components[0];

		expect(component.fill).toBe('url(#linearGradient8797)');
	});

	it('does not mark gradient-filled artwork as a tile layer', function() {
		const source = `<svg viewBox="0 0 100 140">
	<defs><linearGradient id="linearGradient8797"/></defs>
	<rect id="bamboo-body" x="20" y="20" width="40" height="20" fill="url(#linearGradient8797)"/>
</svg>`;

		const component = extractSourceSvgComponents(source).components[0];

		expect(component.tileLayerCandidate).toBe(false);
	});

	it('marks components under an intake tile-background hint as tile layer candidates', function() {
		const source = `<svg viewBox="0 0 100 140">
	<defs>
		<linearGradient id="SVGID_1_">
			<stop offset="0" stop-color="#fff"/>
			<stop offset="1" stop-color="#fff" stop-opacity="0"/>
		</linearGradient>
	</defs>
	<g id="tile-body" data-source-layer="tile-background">
		<path id="outer-shell" d="M0,0 H100 V140 H0 Z"/>
		<path id="face-shell" class="st3" d="M5,5 H95 V135 H5 Z"/>
		<path id="face-gradient" fill="url(#tileBase)" d="M10,10 H90 V130 H10 Z"/>
		<path id="tile-highlight" fill="url(#SVGID_1_)" d="M70,10 H95 V35 H70 Z"/>
	</g>
	<path id="glyph" fill="#111" d="M30,45 H60 V100 H30 Z"/>
</svg>`;

		const components = extractSourceSvgComponents(source).components;

		expect(findComponent(components, 'tile-highlight').tileLayerCandidate).toBe(true);
		expect(findComponent(components, 'tile-highlight').sourceLayerRoles).toEqual(['tile-background']);
		expect(findComponent(components, 'glyph').tileLayerCandidate).toBe(false);
	});

	it('marks geometry with an intake tile-background hint as tile layer candidates', function() {
		const source = `<svg viewBox="0 0 100 140">
	<g id="mixed-source-group">
		<path id="tile-highlight" data-source-layer="tile-background" fill="url(#SVGID_1_)" d="M70,10 H95 V35 H70 Z"/>
		<circle id="dot" cx="50" cy="70" r="10" fill="#111"/>
	</g>
</svg>`;

		const components = extractSourceSvgComponents(source).components;

		expect(findComponent(components, 'tile-highlight').tileLayerCandidate).toBe(true);
		expect(findComponent(components, 'tile-highlight').sourceLayerRoles).toEqual(['tile-background']);
		expect(findComponent(components, 'dot').tileLayerCandidate).toBe(false);
		expect(findComponent(components, 'dot').sourceLayerRoles).toEqual([]);
	});

	it('composes nested group transforms and records id ancestry in order', function() {
		const source = `<svg viewBox="0 0 100 100">
	<g id="outer" class="outer-class" transform="translate(10, 0)">
		<g transform="translate(0, 5)">
			<g id="inner" transform="scale(2)">
				<rect id="mark" x="1" y="1" width="3" height="4"/>
			</g>
		</g>
	</g>
</svg>`;

		const component = extractSourceSvgComponents(source).components[0];

		expect(component.parentGroupIds).toEqual(['outer', 'inner']);
		expect(component.className).toBe('outer-class');
		expect(component.bounds.left).toBe(12);
		expect(component.bounds.top).toBe(7);
		expect(component.bounds.width).toBe(6);
		expect(component.bounds.height).toBe(8);
	});

	it('extracts SVG text nodes as path-backed components', function() {
		const source = `<svg viewBox="0 0 100 100">
	<text id="season-label" x="20" y="40" style="font-size:18px;fill:#123456;stroke:none">WIN</text>
</svg>`;

		const component = extractSourceSvgComponents(source).components[0];

		expect(component.id).toBe('season-label');
		expect(component.tagName).toBe('text');
		expect(component.textValue).toBe('WIN');
		expect(component.fontSize).toBe(18);
		expect(component.fontPath).toContain('.ttf');
		expect(component.fill).toBe('#123456');
		expect(component.pathData).toContain('M');
		expect(component.bounds.left).toBeGreaterThan(15);
		expect(component.bounds.top).toBeGreaterThan(15);
		expect(component.bounds.width).toBeGreaterThan(10);
		expect(component.bounds.height).toBeGreaterThan(8);
	});

	it('extracts SVG text position from tspans when needed', function() {
		const source = `<svg viewBox="207 383 69 89">
	<g id="SEASON_4">
		<text id="text18614" style="font-size:22.436203px;fill:#000000">
			<tspan id="tspan18616" x="219.44171" y="465.8392">WIN</tspan>
		</text>
		<path id="path4341" fill="#19156e" d="M 241,388 H 265 V 443 H 241 Z"/>
	</g>
</svg>`;

		const components = extractSourceSvgComponents(source).components;
		const text = findComponent(components, 'text18614');

		expect(components.map((component) => component.id)).toEqual(['text18614', 'path4341']);
		expect(text.tagName).toBe('text');
		expect(text.textValue).toBe('WIN');
		expect(text.parentGroupIds).toEqual(['SEASON_4']);
		expect(text.bounds.left).toBeGreaterThan(215);
		expect(text.bounds.bottom).toBeLessThan(470);
	});

	it('skips unsupported tags and unusable geometry', function() {
		const source = `<svg viewBox="0 0 100 100">
	<title>ignored</title>
	<rect id="zero-width" x="1" y="1" width="0" height="10"/>
	<circle id="bad-circle" cx="x" cy="10" r="5"/>
	<line id="bad-line" x1="1" y1="2" x2="bad" y2="4"/>
	<path id="bad-path" d="not-a-path"/>
	<rect id="valid" x="10" y="10" width="5" height="5"/>
</svg>`;

		const components = extractSourceSvgComponents(source).components;

		expect(components.map((component) => component.id)).toEqual(['valid']);
	});

	it('skips tiny low-alpha path dust before normalization', function() {
		const source = `<svg viewBox="0 0 100 100">
	<path id="dust" style="fill:black;fill-opacity:0.07;stroke:none" d="M10,10 H10.05 V10.05 Z"/>
	<path id="painted-dust" style="fill:black;fill-opacity:1;stroke:none" d="M20,20 H20.05 V20.05 Z"/>
	<path id="visible-small" style="fill:black;fill-opacity:1;stroke:none" d="M40,40 H40.2 V40.2 Z"/>
	<path id="visible-faint" style="fill:black;fill-opacity:0.07;stroke:none" d="M30,30 H32 V32 H30 Z"/>
</svg>`;

		const components = extractSourceSvgComponents(source).components;

		expect(components.map((component) => component.id)).toEqual(['visible-small', 'visible-faint']);
		expect(components[0].fillOpacity).toBe('1');
		expect(components[1].fillOpacity).toBe('0.07');
	});

	it('marks white geometry as negative-space candidates', function() {
		const source = `<svg viewBox="0 0 50 50">
	<path id="cutout" fill="#fff" d="M5,5 H15 V15 H5 Z"/>
</svg>`;

		const component = extractSourceSvgComponents(source).components[0];

		expect(component.negativeSpaceCandidate).toBe(true);
		expect(component.fill).toBe('#ffffff');
	});

	it('marks full viewBox outlines as tile layer candidates', function() {
		const source = `<svg viewBox="0 0 100 140">
	<rect id="outline" x="0" y="0" width="100" height="140" fill="none" stroke="#000"/>
	<circle id="dot" cx="50" cy="70" r="5" fill="#111"/>
</svg>`;

		const components = extractSourceSvgComponents(source).components;
		const outline = components.find((component) => component.id === 'outline');
		const dot = components.find((component) => component.id === 'dot');

		expect(outline.tileLayerCandidate).toBe(true);
		expect(dot.tileLayerCandidate).toBe(false);
	});

	it('marks obvious tile and background layers as tile layer candidates', function() {
		const source = `<svg viewBox="0 0 100 140">
	<rect id="pattern" x="10" y="10" width="12" height="12" fill="url(#tile)"/>
	<rect id="class-layer" class="st3" x="25" y="10" width="12" height="12" fill="#111"/>
	<rect id="outside" x="150" y="150" width="10" height="10" fill="#222"/>
	<rect id="background" x="0" y="0" width="90" height="120" fill="#eee"/>
	<circle id="paint" cx="50" cy="70" r="10" fill="#333"/>
</svg>`;

		const components = extractSourceSvgComponents(source).components;

		expect(findComponent(components, 'pattern').tileLayerCandidate).toBe(true);
		expect(findComponent(components, 'class-layer').tileLayerCandidate).toBe(true);
		expect(findComponent(components, 'outside').tileLayerCandidate).toBe(true);
		expect(findComponent(components, 'background').tileLayerCandidate).toBe(true);
		expect(findComponent(components, 'paint').tileLayerCandidate).toBe(false);
	});

	it('does not mark a large layer as background without later overlapping face paint', function() {
		const source = `<svg viewBox="0 0 100 140">
	<path id="background" fill="#eee" d="M0,0 H90 V120 H0 Z"/>
</svg>`;

		const background = extractSourceSvgComponents(source).components[0];

		expect(background.tileLayerCandidate).toBe(false);
	});

	it('does not mark large colored artwork as a background layer', function() {
		const source = `<svg viewBox="0 0 100 140">
	<path id="dragon-body" fill="#c20000" stroke="none" d="M10,10 H80 V125 H10 Z"/>
	<circle id="dragon-label" cx="75" cy="20" r="8" fill="#c20000"/>
</svg>`;

		const components = extractSourceSvgComponents(source).components;

		expect(findComponent(components, 'dragon-body').tileLayerCandidate).toBe(false);
		expect(findComponent(components, 'dragon-label').tileLayerCandidate).toBe(false);
	});

	it('marks large shell layers before known tile layers as tile candidates', function() {
		const source = `<svg viewBox="0 0 100 140">
	<path id="outer-shadow" d="M0,0 H100 V140 H0 Z"/>
	<path id="colored-shell" fill="#005f00" d="M10,10 H90 V130 H10 Z"/>
	<path id="face-shell" fill="#cddacd" d="M12,12 H88 V128 H12 Z"/>
	<path id="white-face" class="st3" d="M14,14 H86 V126 H14 Z"/>
	<path id="face-artwork" fill="#038249" d="M35,40 H55 V100 H35 Z"/>
</svg>`;

		const { components } = extractSourceSvgComponents(source);

		expect(findComponent(components, 'outer-shadow').tileLayerCandidate).toBe(true);
		expect(findComponent(components, 'colored-shell').tileLayerCandidate).toBe(true);
		expect(findComponent(components, 'face-shell').tileLayerCandidate).toBe(true);
		expect(findComponent(components, 'white-face').tileLayerCandidate).toBe(true);
		expect(findComponent(components, 'face-artwork').tileLayerCandidate).toBe(false);
	});

	it('does not mark large colored artwork as shell just because a later tile outline exists', function() {
		const source = `<svg viewBox="0 0 100 140">
	<path id="dragon-body" fill="#069200" stroke="none" d="M15,15 H85 V110 H15 Z"/>
	<path id="dragon-detail" fill="#069200" stroke="none" d="M65,100 H80 V120 H65 Z"/>
	<rect id="tile-outline" x="0" y="0" width="100" height="140" fill="none" stroke="#000"/>
</svg>`;

		const { components } = extractSourceSvgComponents(source);

		expect(findComponent(components, 'dragon-body').tileLayerCandidate).toBe(false);
		expect(findComponent(components, 'dragon-detail').tileLayerCandidate).toBe(false);
		expect(findComponent(components, 'tile-outline').tileLayerCandidate).toBe(true);
	});

	it('splits compound paths into subcomponents with source provenance', function() {
		const source = `<svg viewBox="0 0 40 20">
	<path id="pair" fill="#111" d="M0,0 H10 V10 H0 Z M20,0 H30 V10 H20 Z"/>
</svg>`;

		const components = extractSourceSvgComponents(source, { splitCompoundPaths: true }).components;

		expect(components.length).toBe(2);
		expect(components.every((component) => component.id === 'pair')).toBe(true);
		expect(components.every((component) => component.componentLevel === 'subcomponent')).toBe(true);
		expect(components.map((component) => component.subcomponentIndex)).toEqual([0, 1]);
		expect(components.every((component) => component.parentComponentId === 'src-element.0001')).toBe(true);
		expect(components.map((component) => component.bounds.left)).toEqual([0, 20]);
	});

	it('keeps compound paths whole when splitting is disabled', function() {
		const source = `<svg viewBox="0 0 40 20">
	<path id="pair" fill="#111" d="M0,0 H10 V10 H0 Z M20,0 H30 V10 H20 Z"/>
</svg>`;

		const components = extractSourceSvgComponents(source).components;

		expect(components.length).toBe(1);
		expect(components[0].componentLevel).toBe('element');
		expect(components[0].subcomponentIndex).toBeNull();
	});

	it('keeps nested compound subpaths clustered together when splitting', function() {
		const source = `<svg viewBox="0 0 50 20">
	<path id="nested" fill="#111" d="M0,0 H20 V20 H0 Z M5,5 H10 V10 H5 Z M30,0 H40 V10 H30 Z"/>
</svg>`;

		const components = extractSourceSvgComponents(source, { splitCompoundPaths: true }).components;

		expect(components.length).toBe(2);
		expect(components.map((component) => component.bounds.left)).toEqual([0, 30]);
		expect(components[0].pathData).toContain('M5,5');
	});

	it('splits a compound path into bands when separated lobes share one outer contour', function() {
		const source = `<svg viewBox="0 0 40 60">
	<path id="stacked" fill="#111" d="M5,0 H35 V50 H5 Z M8,3 H32 V22 H8 Z M12,7 H28 V18 H12 Z M8,28 H32 V47 H8 Z M12,32 H28 V43 H12 Z"/>
</svg>`;

		const components = extractSourceSvgComponents(source, { splitCompoundPaths: true }).components;

		expect(components.length).toBe(2);
		expect(components.every((component) => component.id === 'stacked')).toBe(true);
		expect(components.every((component) => component.componentLevel === 'subcomponent')).toBe(true);
		expect(components.every((component) => component.splitStrategy === 'compound-path-band')).toBe(true);
		expect(components.map((component) => component.bounds.top)).toEqual([0, 25]);
	});

	it('keeps one outer shape whole when contained bands are internal details', function() {
		const source = `<svg viewBox="0 0 20 40">
	<path id="stick" fill="#111" d="M4,1 H16 V39 H4 Z M7,4 H13 V15 H7 Z M7,19 H13 V20 H7 Z M7,24 H13 V35 H7 Z"/>
</svg>`;

		const components = extractSourceSvgComponents(source, { splitCompoundPaths: true }).components;

		expect(components.length).toBe(1);
		expect(components[0].id).toBe('stick');
		expect(components[0].componentLevel).toBe('element');
		expect(components[0].splitStrategy).toBe('geometry-element');
	});

	it('keeps an outer contour with direct child counters as one shape', function() {
		const source = `<svg viewBox="0 0 30 50">
	<path id="eight" fill="#111" d="M15,1 C5,1 5,20 15,20 C5,20 5,49 15,49 C25,49 25,20 15,20 C25,20 25,1 15,1 Z M10,6 H20 V16 H10 Z M10,27 H20 V39 H10 Z"/>
</svg>`;

		const components = extractSourceSvgComponents(source, { splitCompoundPaths: true }).components;

		expect(components.length).toBe(1);
		expect(components[0].id).toBe('eight');
		expect(components[0].componentLevel).toBe('element');
		expect(components[0].splitStrategy).toBe('geometry-element');
	});

	it('does not create subcomponents for a single path island', function() {
		const source = `<svg viewBox="0 0 20 20">
	<path id="single" fill="#111" d="M0,0 H10 V10 H0 Z"/>
</svg>`;

		const components = extractSourceSvgComponents(source, { splitCompoundPaths: true }).components;

		expect(components.length).toBe(1);
		expect(components[0].componentLevel).toBe('element');
	});
});

function expectMatrix(actual, expected) {
	for (const [key, value] of Object.entries(expected)) {
		expect(actual[key]).withContext(key).toBeCloseTo(value, 6);
	}
}

function findComponent(components, id) {
	return components.find((component) => component.id === id);
}
