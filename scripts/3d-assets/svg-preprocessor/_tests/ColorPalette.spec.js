import {
	ColorPalette,
	Colors,
} from '../ColorPalette.js';

describe('ColorPalette', function() {
	it('offers a freeform color-aware reference component endpoint', function() {
		const sourceComponent = component('source-red', box(0, 0, 10, 10), { fill: '#bf3718' });
		const greenNear = component('ref-green-near', box(0, 0, 10, 10), { dominantColor: '#2FC906' });
		const redFar = component('ref-red-far', box(90, 90, 100, 100), { dominantColor: '#FC1D05' });

		expect(Colors.freeformReferenceComponent({
			sourceComponent,
			sourceComponents: [sourceComponent],
			referenceComponents: [greenNear, redFar],
		})).toBe(redFar);
	});

	it('offers a freeform reference paint endpoint with source-hue fallback', function() {
		const sourceComponent = component('source-red', box(0, 0, 10, 10), { fill: '#ff4a2a' });
		const greenReference = component('ref-green', box(0, 0, 10, 10), { dominantColor: '#2FC906' });

		expect(Colors.freeformReferencePaintForComponent({
			sourceComponent,
			sourceComponents: [sourceComponent],
			referenceComponents: [greenReference],
			sourceHueAverages: new Map([['#FC1D05', '#FF4A2A']]),
		})).toBe('#FF4A2A');
	});

	it('synthesizes freeform palette anchors from source-hue averages when reference lacks that hue', function() {
		const pinkSource = component('source-pink', box(0, 0, 10, 10), { fill: '#f5b1b1' });
		const blackSource = component('source-black', box(0, 0, 20, 20), { fill: '#000000' });
		const greenReference = component('ref-green', box(0, 0, 20, 20), { dominantColor: '#2FC906' });

		expect(Colors.freeformReferencePaintForComponent({
			sourceComponent: pinkSource,
			sourceComponents: [pinkSource, blackSource],
			referenceComponents: [greenReference],
			paletteColors: ['#2FC906', '#0505D1', '#FC1D05', '#FF9900'],
			sourceHueAverages: new Map([
				['#BC197A', '#F5B1B1'],
				['#000000', '#000000'],
			]),
		})).toBe('#F5B1B1');
		expect(Colors.freeformReferencePaintForComponent({
			sourceComponent: blackSource,
			sourceComponents: [pinkSource, blackSource],
			referenceComponents: [greenReference],
			paletteColors: ['#2FC906', '#0505D1', '#FC1D05', '#FF9900'],
			sourceHueAverages: new Map([
				['#BC197A', '#F5B1B1'],
				['#000000', '#000000'],
			]),
		})).toBe('#000000');
	});

	it('uses a wider red render range without changing red detection', function() {
		const palette = ColorPalette.fromMappings({
			mappings: [
				{ source: '#ff7777', target: '#FC1D05' },
				{ source: '#c20000', target: '#FC1D05' },
			],
			colors: ['#ff7777', '#c20000', '#FC1D05'],
			sourcePaints: ['#ff7777', '#c20000'],
			overlaps: [{
				items: [
					{
						key: 'light-red',
						source: '#ff7777',
						target: '#FC1D05',
						sourceIndex: 1,
						weight: 1,
					},
					{
						key: 'dark-red',
						source: '#c20000',
						target: '#FC1D05',
						sourceIndex: 2,
						weight: 1,
					},
				],
			}],
		});

		expect(Colors.perceivedHue('#ff7777')).toBe('#FC1D05');
		expect(palette.outputPaint({
			paletteKey: 'light-red',
			sourcePaint: '#ff7777',
			targetPaint: '#FC1D05',
		})).toBe('#FFA2A2');
		expect(palette.outputPaint({
			paletteKey: 'dark-red',
			sourcePaint: '#c20000',
			targetPaint: '#FC1D05',
		})).toBe('#AA0000');
	});

	it('detects muddy brown separately and renders it through the red range', function() {
		const palette = ColorPalette.fromMappings({
			mappings: [
				{ source: '#993300', target: '#993300' },
			],
			colors: ['#993300'],
			sourcePaints: ['#993300'],
		});

		expect(Colors.perceivedHue('#993300')).toBe('#8A3A12');
		expect(palette.outputPaint({
			paletteKey: 'muddy-brown',
			sourcePaint: '#993300',
			targetPaint: '#993300',
		})).toBe('#FC1D05');
	});

	it('uses canonical brown as the freeform target when brown has a red render range', function() {
		const sourceComponent = component('source-brown', box(0, 0, 10, 10), { fill: '#993300' });

		expect(Colors.freeformReferencePaintForComponent({
			sourceComponent,
			sourceComponents: [sourceComponent],
			referenceComponents: [],
			sourceHueAverages: new Map([
				['#8A3A12', '#993300'],
			]),
		})).toBe('#8A3A12');
	});

	it('keeps dark detail colors dark when recoloring mixed-hue artwork to red', function() {
		const items = [
			{ key: 'body', source: '#367D25', target: '#FC1D05', sourceIndex: 1, weight: 300 },
			{ key: 'cap', source: '#108431', target: '#FC1D05', sourceIndex: 2, weight: 50 },
			{ key: 'band', source: '#5c003f', target: '#FC1D05', sourceIndex: 3, weight: 40 },
			{ key: 'outline', source: '#000000', target: '#FC1D05', sourceIndex: 4, weight: 80 },
		];
		const palette = ColorPalette.fromMappings({
			mappings: items,
			colors: [...items.map((item) => item.source), '#FC1D05'],
			sourcePaints: items.map((item) => item.source),
			overlaps: [{ items }],
		});

		expect(palette.outputPaint({
			paletteKey: 'body',
			sourcePaint: '#367D25',
			targetPaint: '#FC1D05',
		})).toBe('#FC1D05');
		expect(palette.outputPaint({
			paletteKey: 'band',
			sourcePaint: '#5c003f',
			targetPaint: '#FC1D05',
		})).toBe('#D20F02');
		expect(palette.outputPaint({
			paletteKey: 'outline',
			sourcePaint: '#000000',
			targetPaint: '#FC1D05',
		})).toBe('#AA0000');
	});

});

function component(componentId, bounds, overrides = {}) {
	return {
		componentId,
		bounds,
		center: {
			x: bounds.left + (bounds.width / 2),
			y: bounds.top + (bounds.height / 2),
		},
		area: bounds.width * bounds.height,
		fill: null,
		stroke: null,
		dominantColor: null,
		...overrides,
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
	};
}
