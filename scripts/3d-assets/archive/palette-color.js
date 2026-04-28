export function hexToRgb(hex) {
	const normalized = normalizeHex(hex);

	return [
		Number.parseInt(normalized.slice(1, 3), 16),
		Number.parseInt(normalized.slice(3, 5), 16),
		Number.parseInt(normalized.slice(5, 7), 16),
	];
}

export function rgbToHex(rgb) {
	const [red, green, blue] = rgb.map((channel) => clamp(Math.round(channel), 0, 255));

	return `#${hexByte(red)}${hexByte(green)}${hexByte(blue)}`;
}

export function rgbToOklab(rgb) {
	const [red, green, blue] = rgb.map((channel) => srgbToLinear(channel / 255));
	const l = Math.cbrt((0.4122214708 * red) + (0.5363325363 * green) + (0.0514459929 * blue));
	const m = Math.cbrt((0.2119034982 * red) + (0.6806995451 * green) + (0.1073969566 * blue));
	const s = Math.cbrt((0.0883024619 * red) + (0.2817188376 * green) + (0.6299787005 * blue));

	return {
		l: (0.2104542553 * l) + (0.793617785 * m) - (0.0040720468 * s),
		a: (1.9779984951 * l) - (2.428592205 * m) + (0.4505937099 * s),
		b: (0.0259040371 * l) + (0.7827717662 * m) - (0.808675766 * s),
	};
}

export function oklabToRgb(lab) {
	const l = lab.l + (0.3963377774 * lab.a) + (0.2158037573 * lab.b);
	const m = lab.l - (0.1055613458 * lab.a) - (0.0638541728 * lab.b);
	const s = lab.l - (0.0894841775 * lab.a) - (1.291485548 * lab.b);
	const l3 = l ** 3;
	const m3 = m ** 3;
	const s3 = s ** 3;

	return [
		linearToSrgb((4.0767416621 * l3) - (3.3077115913 * m3) + (0.2309699292 * s3)) * 255,
		linearToSrgb((-1.2684380046 * l3) + (2.6097574011 * m3) - (0.3413193965 * s3)) * 255,
		linearToSrgb((-0.0041960863 * l3) - (0.7034186147 * m3) + (1.707614701 * s3)) * 255,
	].map((channel) => clamp(channel, 0, 255));
}

export function oklabToOklch(lab) {
	return {
		l: lab.l,
		c: Math.hypot(lab.a, lab.b),
		h: normalizeHue((Math.atan2(lab.b, lab.a) * 180) / Math.PI),
	};
}

export function oklchToOklab(lch) {
	const hueRadians = (normalizeHue(lch.h) * Math.PI) / 180;

	return {
		l: lch.l,
		a: lch.c * Math.cos(hueRadians),
		b: lch.c * Math.sin(hueRadians),
	};
}

export function hexToOklch(hex) {
	return oklabToOklch(rgbToOklab(hexToRgb(hex)));
}

export function oklchToHex(lch) {
	return rgbToHex(oklabToRgb(oklchToOklab(lch)));
}

export function interpolateOklch(fromHex, toHex, amount) {
	const from = hexToOklch(fromHex);
	const to = hexToOklch(toHex);
	const t = clamp(amount, 0, 1);

	return oklchToHex({
		l: lerp(from.l, to.l, t),
		c: lerp(from.c, to.c, t),
		h: interpolateHue(from.h, to.h, t),
	});
}

function normalizeHex(hex) {
	if (typeof hex !== 'string') {
		throw new TypeError(`Expected hex color string, received ${typeof hex}.`);
	}

	const value = hex.trim();
	const shorthand = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(value);

	if (shorthand) {
		return `#${shorthand[1]}${shorthand[1]}${shorthand[2]}${shorthand[2]}${shorthand[3]}${shorthand[3]}`.toLowerCase();
	}

	if (/^#[0-9a-f]{6}$/i.test(value)) {
		return value.toLowerCase();
	}

	throw new Error(`Invalid hex color: ${hex}`);
}

function srgbToLinear(value) {
	return value <= 0.04045
		? value / 12.92
		: ((value + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value) {
	const clamped = clamp(value, 0, 1);

	return clamped <= 0.0031308
		? clamped * 12.92
		: (1.055 * (clamped ** (1 / 2.4))) - 0.055;
}

function interpolateHue(from, to, amount) {
	const delta = ((((to - from) % 360) + 540) % 360) - 180;
	return normalizeHue(from + (delta * amount));
}

function normalizeHue(hue) {
	return ((hue % 360) + 360) % 360;
}

function lerp(from, to, amount) {
	return from + ((to - from) * amount);
}

function hexByte(value) {
	return value.toString(16).padStart(2, '0');
}

function clamp(value, min, max) {
	return Math.min(max, Math.max(min, value));
}

