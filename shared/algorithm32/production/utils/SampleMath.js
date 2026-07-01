/**
 * Find the nearest sample index in an ordered numeric sample array.
 *
 * @param {readonly number[]} samples - Supplies the ordered samples to search.
 * @param {number} value - Supplies the target value.
 * @param {NearestSampleIndexOptions} [options] - Supplies call-local lookup
 * behavior.
 * @returns {number} The nearest sample index, or -1 when no unclamped sample
 * exists.
 */
function nearestSampleIndex(samples, value, options = {}) {
	if (samples.length === 0) {
		return -1;
	}

	const clamp = options.clamp !== false;
	const first = samples[0];
	const last = samples[samples.length - 1];

	if (!clamp && (value < first || value > last)) {
		return -1;
	}

	let nearestIndex = 0;
	let nearestDistance = Math.abs(value - first);

	for (let index = 1; index < samples.length; index += 1) {
		const distance = Math.abs(value - samples[index]);

		if (distance < nearestDistance) {
			nearestIndex = index;
			nearestDistance = distance;
		}
	}

	return nearestIndex;
}

/**
 * Return samples padded before and after with one value.
 *
 * @param {readonly number[]} samples - Supplies the samples to pad.
 * @param {SamplePaddingOptions} [options] - Supplies call-local padding
 * behavior.
 * @returns {number[]} The padded samples.
 */
function padSamples(samples, options = {}) {
	const before = options.before ?? 0;
	const after = options.after ?? 0;
	const value = options.value ?? 0;

	return [
		...Array.from({ length: before }, () => value),
		...samples,
		...Array.from({ length: after }, () => value),
	];
}

/**
 * Check whether samples are monotonic in one direction.
 *
 * @param {readonly number[]} samples - Supplies the samples to inspect.
 * @param {MonotonicOptions} [options] - Supplies call-local monotonic behavior.
 * @returns {boolean} True when the samples follow the requested monotonic rule.
 */
function isMonotonic(samples, options = {}) {
	const direction = options.direction ?? 'ascending';
	const strict = options.strict === true;

	for (let index = 1; index < samples.length; index += 1) {
		const previous = samples[index - 1];
		const current = samples[index];

		if (direction === 'descending') {
			if (strict ? current >= previous : current > previous) {
				return false;
			}
			continue;
		}

		if (strict ? current <= previous : current < previous) {
			return false;
		}
	}

	return true;
}

/**
 * Return sample/index pairs in traversal order.
 *
 * @param {readonly number[]} samples - Supplies the samples to traverse.
 * @param {SampleWalkOptions} [options] - Supplies call-local traversal behavior.
 * @returns {SampleWalkEntry[]} The sample traversal entries.
 */
function walkSamples(samples, options = {}) {
	const direction = options.direction ?? 'ascending';
	const indexes = samples.map((_, index) => index);

	if (direction === 'descending') {
		indexes.reverse();
	}

	return indexes.map((index) => ({
		index,
		value: samples[index],
	}));
}

/**
 * Create a deterministic signature for an ordered numeric sample array.
 *
 * @param {readonly number[]} samples - Supplies the samples to sign.
 * @param {SampleSignatureOptions} [options] - Supplies call-local signature
 * behavior.
 * @returns {string} The deterministic sample signature.
 */
function sampleSignature(samples, options = {}) {
	const precision = options.precision ?? 6;
	const separator = options.separator ?? ',';

	return samples
		.map((value) => {
			const formatted = value.toFixed(precision);

			return formatted.includes('.')
				? formatted.replace(/\.?0+$/, '')
				: formatted;
		})
		.join(separator);
}

export default Object.freeze({
	isMonotonic,
	nearestSampleIndex,
	padSamples,
	sampleSignature,
	walkSamples,
});
