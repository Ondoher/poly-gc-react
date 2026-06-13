/**
 * Resolve a finite number or fall back to a known numeric value.
 *
 * @param {unknown} value - Specify the candidate numeric value.
 * @param {number} fallback - Specify the fallback value.
 * @returns {number}
 */
export function finiteNumber(value, fallback = 0) {
	const number = Number(value);

	return Number.isFinite(number) ? number : fallback;
}

/**
 * Resolve a partial vector-like value into a complete `FlatVector3`.
 *
 * @param {Partial<FlatVector3> | null | undefined} value - Specify the candidate vector value.
 * @param {FlatVector3} fallback - Specify fallback coordinates.
 * @returns {FlatVector3}
 */
export function vectorFrom(value, fallback = { x: 0, y: 0, z: 0 }) {
	return {
		x: finiteNumber(value?.x, fallback.x ?? 0),
		y: finiteNumber(value?.y, fallback.y ?? 0),
		z: finiteNumber(value?.z, fallback.z ?? 0),
	};
}

/**
 * Clone a vector into an immutable plain object.
 *
 * @param {FlatVector3} vector - Specify the vector to clone.
 * @returns {Readonly<FlatVector3>}
 */
export function cloneVector(vector) {
	return Object.freeze({
		x: vector.x,
		y: vector.y,
		z: vector.z,
	});
}

/**
 * Add two vectors component by component.
 *
 * @param {FlatVector3} left - Specify the left vector.
 * @param {FlatVector3} right - Specify the right vector.
 * @returns {FlatVector3}
 */
export function add(left, right) {
	return {
		x: left.x + right.x,
		y: left.y + right.y,
		z: left.z + right.z,
	};
}

/**
 * Subtract the right vector from the left vector.
 *
 * @param {FlatVector3} left - Specify the left vector.
 * @param {FlatVector3} right - Specify the right vector.
 * @returns {FlatVector3}
 */
export function subtract(left, right) {
	return {
		x: left.x - right.x,
		y: left.y - right.y,
		z: left.z - right.z,
	};
}

/**
 * Scale a vector by a scalar value.
 *
 * @param {FlatVector3} vector - Specify the vector to scale.
 * @param {number} scalar - Specify the scale factor.
 * @returns {FlatVector3}
 */
export function scale(vector, scalar) {
	return {
		x: vector.x * scalar,
		y: vector.y * scalar,
		z: vector.z * scalar,
	};
}

/**
 * Calculate the dot product for two vectors.
 *
 * @param {FlatVector3} left - Specify the left vector.
 * @param {FlatVector3} right - Specify the right vector.
 * @returns {number}
 */
export function dot(left, right) {
	return left.x * right.x + left.y * right.y + left.z * right.z;
}

/**
 * Calculate vector length.
 *
 * @param {FlatVector3} vector - Specify the vector to measure.
 * @returns {number}
 */
export function length(vector) {
	return Math.hypot(vector.x, vector.y, vector.z);
}

/**
 * Normalize a vector, throwing when no direction can be derived.
 *
 * @param {FlatVector3} vector - Specify the vector to normalize.
 * @param {string} errorMessage - Specify the error message for zero-length vectors.
 * @returns {FlatVector3}
 */
export function normalize(vector, errorMessage = 'Cannot normalize a zero-length vector.') {
	const vectorLength = length(vector);

	if (vectorLength === 0) {
		throw new Error(errorMessage);
	}

	return scale(vector, 1 / vectorLength);
}

/**
 * Clamp a numeric value to the inclusive range.
 *
 * @param {number} value - Specify the value to clamp.
 * @param {number} min - Specify the inclusive lower bound.
 * @param {number} max - Specify the inclusive upper bound.
 * @returns {number}
 */
export function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

/**
 * Resolve a positive integer integration step count.
 *
 * @param {unknown} value - Specify the candidate step count.
 * @returns {number}
 */
export function stepsFrom(value) {
	return Math.max(1, Math.floor(Number(value) || 1));
}

/**
 * Resolve object or tuple RGB input into a complete `FlatRgbColor`.
 *
 * @param {FlatRgbColorInput | null | undefined} value - Specify the candidate RGB value.
 * @param {FlatRgbColor} fallback - Specify fallback channels.
 * @returns {FlatRgbColor}
 */
export function rgbFrom(value, fallback) {
	if (Array.isArray(value)) {
		return {
			r: finiteNumber(value[0], fallback.r),
			g: finiteNumber(value[1], fallback.g),
			b: finiteNumber(value[2], fallback.b),
		};
	}

	return {
		r: finiteNumber(value?.r, fallback.r),
		g: finiteNumber(value?.g, fallback.g),
		b: finiteNumber(value?.b, fallback.b),
	};
}

/**
 * Clone an RGB color into an immutable plain object.
 *
 * @param {FlatRgbColor} value - Specify the RGB value to clone.
 * @returns {Readonly<FlatRgbColor>}
 */
export function cloneRgb(value) {
	return Object.freeze({
		r: value.r,
		g: value.g,
		b: value.b,
	});
}

/**
 * Add two RGB values component by component.
 *
 * @param {FlatRgbColor} left - Specify the left RGB value.
 * @param {FlatRgbColor} right - Specify the right RGB value.
 * @returns {FlatRgbColor}
 */
export function addRgb(left, right) {
	return {
		r: left.r + right.r,
		g: left.g + right.g,
		b: left.b + right.b,
	};
}

/**
 * Multiply two RGB values component by component.
 *
 * @param {FlatRgbColor} left - Specify the left RGB value.
 * @param {FlatRgbColor} right - Specify the right RGB value.
 * @returns {FlatRgbColor}
 */
export function multiplyRgb(left, right) {
	return {
		r: left.r * right.r,
		g: left.g * right.g,
		b: left.b * right.b,
	};
}

/**
 * Scale an RGB value by a scalar.
 *
 * @param {FlatRgbColor} value - Specify the RGB value to scale.
 * @param {number} scalar - Specify the scale factor.
 * @returns {FlatRgbColor}
 */
export function scaleRgb(value, scalar) {
	return {
		r: value.r * scalar,
		g: value.g * scalar,
		b: value.b * scalar,
	};
}
