import {
	linearRgbToPixel,
	pixelImageToPng,
	pixelImageToPpm,
	referenceOutputToPixel,
	referenceOutputsToPixelImage,
} from '../pixel-output.js';

describe('pixel-output post-pipeline bridge', function() {
	it('encodes linear sRGB through the standard sRGB transfer function', function() {
		const pixel = linearRgbToPixel({
			r: 0,
			g: 0.0031308,
			b: 1,
		});

		// Reason: pixel output is display-side and should use an explicit sRGB encoding policy.
		// Source: Atmosphere Reset Design, pixel artifact generation post-pipeline consumer.
		expect(pixel.kind).toBe('atmosphere-color-pixel');
		expect(pixel.encoding).toBe('srgb');
		expect(pixel.bytes).toEqual({
			r: 0,
			g: 10,
			b: 255,
			a: 255,
		});
		expect(pixel.hex).toBe('#000aff');
		expect(pixel.metadata.displayOnly).toBe(true);
	});

	it('supports linear byte output for numeric inspection', function() {
		const pixel = linearRgbToPixel({
			r: 0.25,
			g: 0.5,
			b: 0.75,
		}, {
			encoding: 'linear',
		});

		// Reason: visual review may need both gamma-encoded display bytes and linear diagnostic bytes.
		// Source: Atmosphere Reset Plan, Phase 6A output encoding open question.
		expect(pixel.bytes).toEqual({
			r: 64,
			g: 128,
			b: 191,
			a: 255,
		});
		expect(pixel.displayRgb).toEqual({
			r: 0.25,
			g: 0.5,
			b: 0.75,
		});
	});

	it('applies exposure before encoding and reports display-only clamping', function() {
		const pixel = linearRgbToPixel({
			r: -0.1,
			g: 0.25,
			b: 0.8,
		}, {
			exposure: 2,
			encoding: 'linear',
			alpha: 128,
		});

		// Reason: display clamp/exposure must be visible metadata rather than hidden transport mutation.
		// Source: Reference Code Design, pixel-output responsibilities.
		expect(pixel.linearRgb).toEqual({
			r: -0.1,
			g: 0.25,
			b: 0.8,
		});
		expect(pixel.exposedLinearRgb).toEqual({
			r: -0.2,
			g: 0.5,
			b: 1.6,
		});
		expect(pixel.displayLinearRgb).toEqual({
			r: -0.2,
			g: 0.5,
			b: 1.6,
		});
		expect(pixel.bytes).toEqual({
			r: 0,
			g: 128,
			b: 255,
			a: 128,
		});
		expect(pixel.metadata.clampedChannels).toEqual(['r', 'b']);
		expect(pixel.metadata.colorSpace).toEqual({
			source: 'linear-srgb',
			encoding: 'linear',
		});
		expect(pixel.metadata.exposurePolicy).toEqual({
			kind: 'scalar',
			value: 2,
		});
		expect(pixel.metadata.toneMapPolicy).toEqual({
			kind: 'clip',
			scale: 1,
			preventedClipChannels: [],
		});
	});

	it('can preserve hue by scaling exposed channels before byte encoding', function() {
		const pixel = linearRgbToPixel({
			r: 0.3,
			g: 0.1,
			b: 0.02,
		}, {
			exposure: 4,
			encoding: 'linear',
			toneMap: 'preserve-hue',
		});

		// Reason: sunset review should avoid channel-by-channel red clipping that shifts hue toward yellow/green.
		// Source: Atmosphere Color Plan, display/tone-mapping policies.
		expect(pixel.exposedLinearRgb).toEqual({
			r: 1.2,
			g: 0.4,
			b: 0.08,
		});
		expect(pixel.displayLinearRgb.r).toBeCloseTo(1, 12);
		expect(pixel.displayLinearRgb.g).toBeCloseTo(1 / 3, 12);
		expect(pixel.displayLinearRgb.b).toBeCloseTo(1 / 15, 12);
		expect(pixel.bytes).toEqual({
			r: 255,
			g: 85,
			b: 17,
			a: 255,
		});
		expect(pixel.metadata.clampedChannels).toEqual([]);
		expect(pixel.metadata.toneMapPolicy).toEqual({
			kind: 'preserve-hue',
			scale: 1 / 1.2,
			preventedClipChannels: ['r'],
		});
	});

	it('converts a reference output without mutating transport diagnostics', function() {
		const referenceOutput = {
			stageHistory: ['composeSpectralRadiance'],
			wavelengthsNm: [450, 550, 650],
			spectralRadiance: {
				wavelengthsNm: [450, 550, 650],
				finalByWavelength: [1, 2, 3],
			},
			xyz: { x: 0.1, y: 0.2, z: 0.3 },
			linearRgb: { r: 0.1, g: 0.2, b: 0.3 },
			colorProvenance: {
				cmf: { sourceId: 'cie-1931-2deg' },
			},
		};
		const originalRadiance = referenceOutput.spectralRadiance.finalByWavelength;
		const pixel = referenceOutputToPixel(referenceOutput, {
			encoding: 'linear',
		});

		// Reason: the bridge consumes post-pipeline color and links diagnostics, but cannot rewrite source truth.
		// Source: Stage Contracts, composeSpectralRadiance excludes display conversion.
		expect(pixel.source).toEqual({
			stageHistory: ['composeSpectralRadiance'],
			wavelengthsNm: [450, 550, 650],
			hasSpectralRadiance: true,
			hasXyz: true,
			hasLinearRgb: true,
			colorProvenance: {
				cmf: { sourceId: 'cie-1931-2deg' },
			},
		});
		expect(referenceOutput.spectralRadiance.finalByWavelength).toBe(originalRadiance);
		expect(referenceOutput.linearRgb).toEqual({ r: 0.1, g: 0.2, b: 0.3 });
	});

	it('builds a row-major pixel image and dependency-free PPM artifact', function() {
		const image = referenceOutputsToPixelImage({
			width: 2,
			height: 1,
			pixels: [
				{ linearRgb: { r: 1, g: 0, b: 0 } },
				{ linearRgb: { r: 0, g: 0.5, b: 1 } },
			],
		}, {
			encoding: 'linear',
		});
		const ppm = pixelImageToPpm(image);
		const png = pixelImageToPng(image);

		// Reason: PPM gives the first image artifact a deterministic byte-to-text representation without renderer dependencies.
		// Source: Atmosphere Reset Design, selected benchmark artifact with stable pixel semantics.
		expect(image.kind).toBe('atmosphere-color-pixel-image');
		expect(image.bytes).toEqual([
			255, 0, 0, 255,
			0, 128, 255, 255,
		]);
		expect(ppm).toBe([
			'P3',
			'# atmosphere-color pixels encoding=linear exposure=1 toneMap=clip',
			'2 1',
			'255',
			'255 0 0',
			'0 128 255',
			'',
		].join('\n'));
		expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
		expect(png.includes(Buffer.from('IHDR', 'ascii'))).toBeTrue();
		expect(png.includes(Buffer.from('IDAT', 'ascii'))).toBeTrue();
		expect(png.includes(Buffer.from('IEND', 'ascii'))).toBeTrue();
	});

	it('rejects missing color, invalid output policy, and mismatched image dimensions', function() {
		// Reason: display artifacts should fail loudly on malformed post-pipeline input.
		// Source: Reference Code Design, public API error discipline.
		expect(() => referenceOutputToPixel({}))
			.toThrowError(/linearRgb/);
		expect(() => linearRgbToPixel({ r: 0, g: 0, b: 0 }, { encoding: 'aces' }))
			.toThrowError(/Unknown pixel output encoding/);
		expect(() => linearRgbToPixel({ r: 0, g: 0, b: 0 }, { toneMap: 'mystery' }))
			.toThrowError(/Unknown pixel output tone map/);
		expect(() => referenceOutputsToPixelImage({
			width: 2,
			height: 2,
			pixels: [{ linearRgb: { r: 0, g: 0, b: 0 } }],
		})).toThrowError(/width \* height/);
	});
});
