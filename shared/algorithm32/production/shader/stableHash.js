/**
 * Create a deterministic, browser-safe hash for shader descriptors and source.
 *
 * @param {unknown} value - Store the value to hash.
 * @returns {string} Return a stable non-cryptographic hash string.
 */
export function stableHash(value) {
	const text = stableStringify(value);
	let hash = 2166136261;

	for (let index = 0; index < text.length; index += 1) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}

	return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Serialize a value with sorted object keys and stable typed-array handling.
 *
 * @param {unknown} value - Store the value to serialize.
 * @returns {string} Return deterministic JSON-like text.
 */
export function stableStringify(value) {
	return serializeStableValue(value, new WeakSet());
}

/**
 * Serialize one stable value.
 *
 * @param {unknown} value - Store the value to serialize.
 * @param {WeakSet<object>} seenObjects - Track visited objects.
 * @returns {string} Return stable text.
 */
function serializeStableValue(value, seenObjects) {
	if (value === null) {
		return 'null';
	}

	const valueType = typeof value;

	if (valueType === 'string') {
		return JSON.stringify(value);
	}

	if (valueType === 'number') {
		if (Number.isNaN(value)) {
			return '"Number.NaN"';
		}

		if (value === Number.POSITIVE_INFINITY) {
			return '"Number.POSITIVE_INFINITY"';
		}

		if (value === Number.NEGATIVE_INFINITY) {
			return '"Number.NEGATIVE_INFINITY"';
		}

		return JSON.stringify(value);
	}

	if (valueType === 'boolean') {
		return value ? 'true' : 'false';
	}

	if (valueType === 'undefined') {
		return '"undefined"';
	}

	if (valueType === 'bigint') {
		return `"BigInt:${value.toString()}"`;
	}

	if (Array.isArray(value)) {
		return `[${value.map((entry) => serializeStableValue(entry, seenObjects)).join(',')}]`;
	}

	if (ArrayBuffer.isView(value)) {
		return `${value.constructor.name}[${Array.from(value).map((entry) =>
			serializeStableValue(entry, seenObjects)).join(',')}]`;
	}

	if (valueType !== 'object') {
		return JSON.stringify(String(value));
	}

	if (seenObjects.has(value)) {
		throw new TypeError('Cannot stable-hash cyclic values.');
	}

	seenObjects.add(value);

	const entries = Object.keys(value)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${serializeStableValue(value[key], seenObjects)}`);

	seenObjects.delete(value);

	return `{${entries.join(',')}}`;
}

export default stableHash;
