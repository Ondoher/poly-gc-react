/**
 * Generate a short base-36 identifier string using a random number source.
 *
 * @param {number} size - Number of trailing base-36 characters to keep.
 * @returns {string}
 */
export function shortId(size = 6) {
	return Math.random().toString(36).slice(-size);
}

/**
 * Create a debounced wrapper that delays calls to the callback while also
 * enforcing a maximum wait before the callback runs.
 *
 * @param {Function} cb - Callback to invoke after the debounce delay expires.
 * @param {number} duration - Preferred debounce delay in milliseconds.
 * @param {number} maxDuration - Maximum time in milliseconds that repeated calls may postpone execution.
 * @returns {Function}
 */
export function debounce(cb, duration, maxDuration) {
	var toHdl;
	var start = Date.now() - maxDuration;

	return function(...args) {
		var now = Date.now();
		var ms;

		if (toHdl) {
		var end = Math.min(now + duration, start + maxDuration);
			ms = end - now;
			clearTimeout(toHdl);
		} else {
			start =  now;
			ms = duration;
		}

		toHdl = setTimeout(function() {
			toHdl = false;
			try {
				cb(...args);
			} catch (e) {
				console.error(e.message);
				if (e.stack) console.log(e.stack);
			}
		}, ms);
	};
}
