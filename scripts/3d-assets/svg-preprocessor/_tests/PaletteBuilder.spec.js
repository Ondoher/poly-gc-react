import { ColorPicker } from '../ColorPicker.js';
import { PaletteBuilder } from '../PaletteBuilder.js';

describe('PaletteBuilder and ColorPicker', function() {
	it('pins the reference hue at the center of every built hue palette', function() {
		const palette = new PaletteBuilder({
			mappings: [
				{ key: 'dark', source: '#000000', target: '#2FC906' },
				{ key: 'light', source: '#5be335', target: '#2FC906' },
			],
			colors: ['#000000', '#5be335', '#2FC906'],
			overlaps: [{
				items: [
					{ key: 'dark', source: '#000000', target: '#2FC906' },
					{ key: 'light', source: '#5be335', target: '#2FC906' },
				],
			}],
		}).build();
		const green = palette.hues.get('#2FC906');

		expect(green.entries.some((entry) => entry.shade === 0 && entry.color === '#2FC906')).toBeTrue();
	});

	it('picks only colors from the built target hue palette', function() {
		const palette = new PaletteBuilder({
			mappings: [
				{ key: 'source-dark', source: '#000000', target: '#2FC906' },
				{ key: 'source-center', source: '#2FC906', target: '#2FC906' },
				{ key: 'source-light', source: '#5be335', target: '#2FC906' },
			],
			colors: ['#000000', '#2FC906', '#5be335'],
			overlaps: [{
				items: [
					{ key: 'source-dark', source: '#000000', target: '#2FC906' },
					{ key: 'source-center', source: '#2FC906', target: '#2FC906' },
					{ key: 'source-light', source: '#5be335', target: '#2FC906' },
				],
			}],
		}).build();
		const picker = new ColorPicker(palette);
		const greenPaletteColors = palette.hues.get('#2FC906').entries.map((entry) => entry.color);

		expect(greenPaletteColors).toContain('#2FC906');
		expect(greenPaletteColors).toContain(picker.pick({
			paletteKey: 'source-dark',
			sourcePaint: '#000000',
			targetPaint: '#2FC906',
		}));
		expect(greenPaletteColors).toContain(picker.pick({
			paletteKey: 'source-light',
			sourcePaint: '#5be335',
			targetPaint: '#2FC906',
		}));
	});

	it('counts repeated source paints as one hue shade role', function() {
		const palette = new PaletteBuilder({
			mappings: [
				{ key: 'light-1', source: '#5be335', target: '#2FC906' },
				{ key: 'dark-1', source: '#069200', target: '#2FC906' },
				{ key: 'light-2', source: '#5be335', target: '#2FC906' },
				{ key: 'dark-2', source: '#069200', target: '#2FC906' },
			],
			colors: ['#5be335', '#069200', '#2FC906'],
			overlaps: [{
				items: [
					{ key: 'light-1', source: '#5be335', target: '#2FC906' },
					{ key: 'dark-1', source: '#069200', target: '#2FC906' },
					{ key: 'light-2', source: '#5be335', target: '#2FC906' },
					{ key: 'dark-2', source: '#069200', target: '#2FC906' },
				],
			}],
		}).build();
		const picker = new ColorPicker(palette);

		expect(palette.hues.get('#2FC906').entries.length).toBe(2);
		expect(picker.pick({
			paletteKey: 'light-1',
			sourcePaint: '#5be335',
			targetPaint: '#2FC906',
		})).toBe('#2FC906');
		expect(picker.pick({
			paletteKey: 'light-2',
			sourcePaint: '#5be335',
			targetPaint: '#2FC906',
		})).toBe('#2FC906');
		expect(picker.pick({
			paletteKey: 'dark-1',
			sourcePaint: '#069200',
			targetPaint: '#2FC906',
		})).toBe('#004D00');
		expect(picker.pick({
			paletteKey: 'dark-2',
			sourcePaint: '#069200',
			targetPaint: '#2FC906',
		})).toBe('#004D00');
	});

	it('uses the shade closest to the target hue center as the local center', function() {
		const palette = new PaletteBuilder({
			mappings: [
				{ key: 'light-1', source: '#5be335', target: '#2FC906' },
				{ key: 'dark-1', source: '#069200', target: '#2FC906' },
				{ key: 'light-2', source: '#9a9a9a', target: '#2FC906' },
				{ key: 'dark-2', source: '#000000', target: '#2FC906' },
			],
			colors: ['#5be335', '#069200', '#9a9a9a', '#000000', '#2FC906'],
			overlaps: [
				{
					items: [
						{ key: 'light-1', source: '#5be335', target: '#2FC906' },
						{ key: 'dark-1', source: '#069200', target: '#2FC906' },
					],
				},
				{
					items: [
						{ key: 'light-2', source: '#9a9a9a', target: '#2FC906' },
						{ key: 'dark-2', source: '#000000', target: '#2FC906' },
					],
				},
			],
		}).build();
		const picker = new ColorPicker(palette);

		expect(picker.pick({
			paletteKey: 'light-2',
			sourcePaint: '#9a9a9a',
			targetPaint: '#2FC906',
		})).toBe('#2FC906');
		expect(picker.pick({
			paletteKey: 'dark-1',
			sourcePaint: '#069200',
			targetPaint: '#2FC906',
		})).toBe('#004D00');
		expect(picker.pick({
			paletteKey: 'dark-2',
			sourcePaint: '#000000',
			targetPaint: '#2FC906',
		})).toBe('#004D00');
	});

	it('maps the observed shade closest to the target hue center onto the reference color', function() {
		const palette = new PaletteBuilder({
			mappings: [
				{ key: 'near-reference', source: '#35C212', target: '#2FC906' },
				{ key: 'darker-detail', source: '#0B7600', target: '#2FC906' },
				{ key: 'lighter-highlight', source: '#5BE335', target: '#2FC906' },
			],
			colors: ['#35C212', '#0B7600', '#5BE335', '#2FC906'],
			overlaps: [{
				items: [
					{ key: 'near-reference', source: '#35C212', target: '#2FC906' },
					{ key: 'darker-detail', source: '#0B7600', target: '#2FC906' },
					{ key: 'lighter-highlight', source: '#5BE335', target: '#2FC906' },
				],
			}],
		}).build();
		const picker = new ColorPicker(palette);

		expect(picker.pick({
			paletteKey: 'near-reference',
			sourcePaint: '#35C212',
			targetPaint: '#2FC906',
		})).toBe('#2FC906');
		expect(picker.pick({
			paletteKey: 'darker-detail',
			sourcePaint: '#0B7600',
			targetPaint: '#2FC906',
		})).not.toBe('#2FC906');
		expect(picker.pick({
			paletteKey: 'lighter-highlight',
			sourcePaint: '#5BE335',
			targetPaint: '#2FC906',
		})).not.toBe('#2FC906');
	});

	it('uses the shade closest to the red hue center as the local center', function() {
		const palette = new PaletteBuilder({
			mappings: [
				{ key: 'red-body', source: '#c20000', target: '#FC1D05' },
				{ key: 'red-highlight', source: '#ff7777', target: '#FC1D05' },
			],
			colors: ['#c20000', '#ff7777', '#FC1D05'],
			overlaps: [{
				items: [
					{ key: 'red-body', source: '#c20000', target: '#FC1D05' },
					{ key: 'red-highlight', source: '#ff7777', target: '#FC1D05' },
				],
			}],
		}).build();
		const picker = new ColorPicker(palette);

		expect(picker.pick({
			paletteKey: 'red-body',
			sourcePaint: '#c20000',
			targetPaint: '#FC1D05',
		})).toBe('#FC1D05');
		expect(picker.pick({
			paletteKey: 'red-highlight',
			sourcePaint: '#ff7777',
			targetPaint: '#FC1D05',
		})).toBe('#FFA2A2');
	});

	it('maps distinct dark-side source roles to distinct available palette entries', function() {
		const palette = new PaletteBuilder({
			mappings: [
				{ key: 'body', source: '#367D25', target: '#2FC906' },
				{ key: 'near-dark', source: '#108431', target: '#2FC906' },
				{ key: 'mid-dark', source: '#5c003f', target: '#2FC906' },
				{ key: 'outline', source: 'black', target: '#2FC906' },
			],
			colors: ['#108431', '#367D25', '#5c003f', 'black', '#2FC906'],
			overlaps: [{
				items: [
					{ key: 'body', source: '#367D25', target: '#2FC906' },
					{ key: 'near-dark', source: '#108431', target: '#2FC906' },
					{ key: 'mid-dark', source: '#5c003f', target: '#2FC906' },
					{ key: 'outline', source: 'black', target: '#2FC906' },
				],
			}],
		}).build();
		const picker = new ColorPicker(palette);

		expect(new Set([
			picker.pick({
				paletteKey: 'body',
				sourcePaint: '#367D25',
				targetPaint: '#2FC906',
			}),
			picker.pick({
				paletteKey: 'near-dark',
				sourcePaint: '#108431',
				targetPaint: '#2FC906',
			}),
			picker.pick({
				paletteKey: 'mid-dark',
				sourcePaint: '#5c003f',
				targetPaint: '#2FC906',
			}),
			picker.pick({
				paletteKey: 'outline',
				sourcePaint: 'black',
				targetPaint: '#2FC906',
			}),
		]).size).toBe(4);
		expect(picker.pick({
			paletteKey: 'body',
			sourcePaint: '#367D25',
			targetPaint: '#2FC906',
		})).toBe('#2FC906');
		expect(picker.pick({
			paletteKey: 'near-dark',
			sourcePaint: '#108431',
			targetPaint: '#2FC906',
		})).not.toBe('#2FC906');
	});

	it('uses the reference blue as the blue render center', function() {
		const palette = new PaletteBuilder({
			mappings: [
				{ key: 'blue-dark', source: '#069200', target: '#0505D1' },
				{ key: 'blue-body', source: '#5be335', target: '#0505D1' },
			],
			colors: ['#069200', '#5be335', '#0505D1'],
			overlaps: [{
				items: [
					{ key: 'blue-dark', source: '#069200', target: '#0505D1' },
					{ key: 'blue-body', source: '#5be335', target: '#0505D1' },
				],
			}],
		}).build();
		const picker = new ColorPicker(palette);

		expect(picker.pick({
			paletteKey: 'blue-dark',
			sourcePaint: '#069200',
			targetPaint: '#0505D1',
		})).toBe('#0505D1');
		expect(picker.pick({
			paletteKey: 'blue-body',
			sourcePaint: '#5be335',
			targetPaint: '#0505D1',
		})).toBe('#7F85FF');
	});
});
