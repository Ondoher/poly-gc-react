import { deflateSync } from 'node:zlib';

const BYTE_MAX = 255;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function assertFiniteNumber(value, label) {
	if (!Number.isFinite(value)) {
		throw new TypeError(`${label} must be finite`);
	}
}

function assertRgbObject(rgb, label) {
	if (!rgb || typeof rgb !== 'object' || Array.isArray(rgb)) {
		throw new TypeError(`${label} must be an RGB object`);
	}

	for (const channel of ['r', 'g', 'b']) {
		assertFiniteNumber(rgb[channel], `${label}.${channel}`);
	}
}

function clamp01(value) {
	return Math.max(0, Math.min(1, value));
}

function encodeSrgbChannel(linearValue) {
	const value = clamp01(linearValue);

	if (value <= 0.0031308) {
		return 12.92 * value;
	}

	return 1.055 * Math.pow(value, 1 / 2.4) - 0.055;
}

function encodeDisplayChannel(linearValue, encoding) {
	if (encoding === 'linear') {
		return clamp01(linearValue);
	}

	if (encoding === 'srgb') {
		return encodeSrgbChannel(linearValue);
	}

	throw new Error(`Unknown pixel output encoding: ${encoding}`);
}

function toByte(value) {
	return Math.round(clamp01(value) * BYTE_MAX);
}

function bytesToHex(bytes) {
	return `#${[bytes.r, bytes.g, bytes.b]
		.map((channel) => channel.toString(16).padStart(2, '0'))
		.join('')}`;
}

function exposureFromOptions(options) {
	const exposure = options.exposure ?? 1;
	assertFiniteNumber(exposure, 'pixel output exposure');

	if (exposure < 0) {
		throw new RangeError('pixel output exposure must be nonnegative');
	}

	return exposure;
}

function toneMapFromOptions(options) {
	const toneMap = options.toneMap ?? 'clip';

	if (!['clip', 'preserve-hue'].includes(toneMap)) {
		throw new Error(`Unknown pixel output tone map: ${toneMap}`);
	}

	return toneMap;
}

function applyToneMap(exposedLinearRgb, toneMap) {
	if (toneMap === 'clip') {
		return {
			displayLinearRgb: { ...exposedLinearRgb },
			scale: 1,
			preventedClipChannels: [],
		};
	}

	const maxChannel = Math.max(exposedLinearRgb.r, exposedLinearRgb.g, exposedLinearRgb.b);
	const scale = maxChannel > 1 ? 1 / maxChannel : 1;

	return {
		displayLinearRgb: {
			r: exposedLinearRgb.r * scale,
			g: exposedLinearRgb.g * scale,
			b: exposedLinearRgb.b * scale,
		},
		scale,
		preventedClipChannels: scale < 1
			? ['r', 'g', 'b'].filter((channel) => exposedLinearRgb[channel] > 1)
			: [],
	};
}

function createChannelResult(exposedLinear, displayLinear, encoding) {
	const display = encodeDisplayChannel(displayLinear, encoding);
	const byte = toByte(display);

	return {
		exposedLinear,
		displayLinear,
		display,
		byte,
		clamped: displayLinear < 0 || displayLinear > 1,
	};
}

/**
 * Convert one post-pipeline linear-sRGB color into a deterministic pixel.
 *
 * This helper is deliberately display-side. It does not modify transport
 * radiance, XYZ, or linear RGB diagnostics produced by the reference pipeline.
 *
 * @param {{ r: number, g: number, b: number }} linearRgb - Linear sRGB color.
 * @param {{ exposure?: number, encoding?: 'srgb' | 'linear', toneMap?: 'clip' | 'preserve-hue', alpha?: number }} options - Display policy.
 * @returns {object} Pixel packet with bytes and provenance.
 */
export function linearRgbToPixel(linearRgb, options = {}) {
	assertRgbObject(linearRgb, 'linearRgb');
	const exposure = exposureFromOptions(options);
	const encoding = options.encoding ?? 'srgb';
	const toneMap = toneMapFromOptions(options);
	const alpha = options.alpha ?? BYTE_MAX;

	assertFiniteNumber(alpha, 'pixel output alpha');

	if (alpha < 0 || alpha > BYTE_MAX) {
		throw new RangeError('pixel output alpha must be in [0, 255]');
	}

	const exposedLinearRgb = {
		r: linearRgb.r * exposure,
		g: linearRgb.g * exposure,
		b: linearRgb.b * exposure,
	};
	const toneMapped = applyToneMap(exposedLinearRgb, toneMap);
	const channels = {
		r: createChannelResult(exposedLinearRgb.r, toneMapped.displayLinearRgb.r, encoding),
		g: createChannelResult(exposedLinearRgb.g, toneMapped.displayLinearRgb.g, encoding),
		b: createChannelResult(exposedLinearRgb.b, toneMapped.displayLinearRgb.b, encoding),
	};
	const bytes = {
		r: channels.r.byte,
		g: channels.g.byte,
		b: channels.b.byte,
		a: Math.round(alpha),
	};

	return {
		kind: 'atmosphere-color-pixel',
		sourceColorSpace: 'linear-srgb',
		encoding,
		exposure,
		toneMap,
		linearRgb: { ...linearRgb },
		exposedLinearRgb,
		displayLinearRgb: { ...toneMapped.displayLinearRgb },
		displayRgb: {
			r: channels.r.display,
			g: channels.g.display,
			b: channels.b.display,
		},
		bytes,
		hex: bytesToHex(bytes),
		metadata: {
			clampedChannels: ['r', 'g', 'b'].filter((channel) => channels[channel].clamped),
			displayOnly: true,
			colorSpace: {
				source: 'linear-srgb',
				encoding,
			},
			exposurePolicy: {
				kind: 'scalar',
				value: exposure,
			},
			toneMapPolicy: {
				kind: toneMap,
				scale: toneMapped.scale,
				preventedClipChannels: toneMapped.preventedClipChannels,
			},
			alphaPolicy: {
				kind: 'constant-byte',
				value: bytes.a,
			},
		},
	};
}

/**
 * Convert a completed reference/color packet into one pixel.
 *
 * The packet must already carry post-pipeline linear sRGB. Spectral-to-XYZ and
 * XYZ-to-linear-sRGB remain separate colorimetry work.
 *
 * @param {object} referenceOutput - Pipeline or report packet with `linearRgb`.
 * @param {object} options - Display policy passed to `linearRgbToPixel`.
 * @returns {object} Pixel packet linked to pipeline diagnostics.
 */
export function referenceOutputToPixel(referenceOutput, options = {}) {
	if (!referenceOutput || typeof referenceOutput !== 'object') {
		throw new TypeError('referenceOutput must be an object');
	}

	if (!referenceOutput.linearRgb) {
		throw new Error('referenceOutputToPixel requires referenceOutput.linearRgb');
	}

	const pixel = linearRgbToPixel(referenceOutput.linearRgb, options);

	return {
		...pixel,
		source: {
			stageHistory: Array.isArray(referenceOutput.stageHistory)
				? [...referenceOutput.stageHistory]
				: undefined,
			wavelengthsNm: Array.isArray(referenceOutput.wavelengthsNm)
				? [...referenceOutput.wavelengthsNm]
				: Array.isArray(referenceOutput.spectralRadiance?.wavelengthsNm)
					? [...referenceOutput.spectralRadiance.wavelengthsNm]
					: undefined,
			hasSpectralRadiance: Boolean(referenceOutput.spectralRadiance),
			hasXyz: Boolean(referenceOutput.xyz),
			hasLinearRgb: true,
			colorProvenance: referenceOutput.colorProvenance
				? cloneJsonValue(referenceOutput.colorProvenance)
				: undefined,
		},
	};
}

/**
 * Convert a row-major list of reference/color packets into a byte pixel image.
 *
 * @param {{ width: number, height: number, pixels: object[] }} image - Row-major color packets.
 * @param {object} options - Display policy passed to `referenceOutputToPixel`.
 * @returns {object} Deterministic pixel image packet.
 */
export function referenceOutputsToPixelImage(image, options = {}) {
	if (!image || typeof image !== 'object') {
		throw new TypeError('pixel image input must be an object');
	}

	const { width, height, pixels } = image;

	if (!Number.isInteger(width) || width <= 0) {
		throw new RangeError('pixel image width must be a positive integer');
	}

	if (!Number.isInteger(height) || height <= 0) {
		throw new RangeError('pixel image height must be a positive integer');
	}

	if (!Array.isArray(pixels) || pixels.length !== width * height) {
		throw new RangeError('pixel image pixels must be a row-major array with width * height entries');
	}

	const pixelPackets = pixels.map((pixel) => referenceOutputToPixel(pixel, options));

	return {
		kind: 'atmosphere-color-pixel-image',
		width,
		height,
		encoding: pixelPackets[0]?.encoding ?? options.encoding ?? 'srgb',
		exposure: pixelPackets[0]?.exposure ?? options.exposure ?? 1,
		toneMap: pixelPackets[0]?.toneMap ?? options.toneMap ?? 'clip',
		pixels: pixelPackets,
		bytes: pixelPackets.flatMap((pixel) => [
			pixel.bytes.r,
			pixel.bytes.g,
			pixel.bytes.b,
			pixel.bytes.a,
		]),
		metadata: {
			displayOnly: true,
			pixelCount: pixelPackets.length,
			colorProvenance: firstDefined(pixelPackets.map((pixel) => pixel.source?.colorProvenance)),
			displayPolicy: {
				encoding: pixelPackets[0]?.encoding ?? options.encoding ?? 'srgb',
				exposure: pixelPackets[0]?.exposure ?? options.exposure ?? 1,
				toneMap: pixelPackets[0]?.toneMap ?? options.toneMap ?? 'clip',
				clampedChannels: uniqueSorted(pixelPackets.flatMap((pixel) => pixel.metadata.clampedChannels)),
				preventedClipChannels: uniqueSorted(pixelPackets.flatMap((pixel) => {
					return pixel.metadata.toneMapPolicy.preventedClipChannels;
				})),
			},
		},
	};
}

/**
 * Write a deterministic ASCII PPM body from a pixel image packet.
 *
 * PPM is intentionally simple and dependency-free for first visual artifacts.
 *
 * @param {object} pixelImage - Pixel image from `referenceOutputsToPixelImage`.
 * @returns {string} P3 PPM text.
 */
export function pixelImageToPpm(pixelImage) {
	if (!pixelImage || pixelImage.kind !== 'atmosphere-color-pixel-image') {
		throw new TypeError('pixelImageToPpm requires an atmosphere color pixel image');
	}

	const lines = [
		'P3',
		`# atmosphere-color pixels encoding=${pixelImage.encoding} exposure=${pixelImage.exposure} toneMap=${pixelImage.toneMap}`,
		`${pixelImage.width} ${pixelImage.height}`,
		String(BYTE_MAX),
	];

	for (const pixel of pixelImage.pixels) {
		lines.push(`${pixel.bytes.r} ${pixel.bytes.g} ${pixel.bytes.b}`);
	}

	return `${lines.join('\n')}\n`;
}

/**
 * Write a deterministic RGBA PNG buffer from a pixel image packet.
 *
 * @param {object} pixelImage - Pixel image from `referenceOutputsToPixelImage`.
 * @returns {Buffer} PNG bytes.
 */
export function pixelImageToPng(pixelImage) {
	if (!pixelImage || pixelImage.kind !== 'atmosphere-color-pixel-image') {
		throw new TypeError('pixelImageToPng requires an atmosphere color pixel image');
	}

	const scanlineLength = 1 + pixelImage.width * 4;
	const raw = Buffer.alloc(scanlineLength * pixelImage.height);

	for (let y = 0; y < pixelImage.height; y += 1) {
		const scanlineStart = y * scanlineLength;
		raw[scanlineStart] = 0;

		for (let x = 0; x < pixelImage.width; x += 1) {
			const pixel = pixelImage.pixels[y * pixelImage.width + x];
			const pixelStart = scanlineStart + 1 + x * 4;
			raw[pixelStart] = pixel.bytes.r;
			raw[pixelStart + 1] = pixel.bytes.g;
			raw[pixelStart + 2] = pixel.bytes.b;
			raw[pixelStart + 3] = pixel.bytes.a;
		}
	}

	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(pixelImage.width, 0);
	ihdr.writeUInt32BE(pixelImage.height, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	ihdr[10] = 0;
	ihdr[11] = 0;
	ihdr[12] = 0;

	return Buffer.concat([
		PNG_SIGNATURE,
		pngChunk('IHDR', ihdr),
		pngChunk('IDAT', deflateSync(raw)),
		pngChunk('IEND', Buffer.alloc(0)),
	]);
}

function firstDefined(values) {
	return values.find((value) => value !== undefined);
}

function uniqueSorted(values) {
	return [...new Set(values)].sort();
}

function cloneJsonValue(value) {
	return JSON.parse(JSON.stringify(value));
}

function pngChunk(type, data) {
	const typeBuffer = Buffer.from(type, 'ascii');
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length, 0);
	const crc = Buffer.alloc(4);
	crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

	return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
	let crc = 0xffffffff;

	for (const byte of buffer) {
		crc ^= byte;
		for (let bit = 0; bit < 8; bit += 1) {
			crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
		}
	}

	return (crc ^ 0xffffffff) >>> 0;
}
