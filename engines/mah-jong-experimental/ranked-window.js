import Random from '../../src/gc/utils/random.js';

/**
 * Clamp a numeric value to the inclusive range between `min` and `max`.
 *
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
	return Math.max(min, Math.min(max, value));
}

/**
 * Build a difficulty-shaped selection window from an already ranked list.
 *
 * Easier and harder difficulties narrow the eligible window toward opposite
 * ends of the ranked list, while middle difficulty keeps the broadest window.
 *
 * @template Candidate
 * @param {Candidate[]} candidates
 * @param {{ difficulty?: number, minWindowRatio?: number }} [options={}]
 * @returns {RankedWindow<Candidate>}
 */
export function getRankedWindow(candidates, options = {}) {
	let difficulty = clamp(options.difficulty ?? 0.5, 0, 1);
	let minWindowRatio = clamp(options.minWindowRatio ?? 0.25, 0, 1);
	let count = candidates.length;

	if (count === 0) {
		return {
			window: [],
			start: 0,
			end: 0,
			size: 0,
			count,
			difficulty,
		};
	}

	let edgePressure = Math.abs(difficulty - 0.5) * 2;
	let windowRatio = 1 - edgePressure * (1 - minWindowRatio);
	let windowSize = Math.max(1, Math.ceil(count * windowRatio));
	let start = Math.round((count - windowSize) * difficulty);

	return {
		window: candidates.slice(start, start + windowSize),
		start,
		end: start + windowSize,
		size: windowSize,
		count,
		difficulty,
	};
}

/**
 * Select one candidate from a difficulty-shaped ranked window.
 *
 * @template Candidate
 * @param {Candidate[]} candidates
 * @param {{ difficulty?: number, minWindowRatio?: number }} [options={}]
 * @returns {Candidate | null}
 */
export function selectRankedCandidate(candidates, options = {}) {
	let windowDetails = getRankedWindow(candidates, options);
	let { window } = windowDetails;

	if (window.length === 0) {
		return null;
	}

	return Random.chooseOne(window);
}
