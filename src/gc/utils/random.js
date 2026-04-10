/**
 * This module modifies the standard randomization algorith of the Math object
 * to have a predictible sequence of random values from a beginning seed. If
 * passed a numer then the randomized value will be turned into an integer with
 * that as the max value. It is using a seedable value so that we can easily
 * reproduce a layout from a given seed.
 *
 * This algorithm was stolen from the product Delphi.
 *
 * @module randomize */

class Random {
	constructor() {
		this.randSeed = Date.now();
	}

	/**
	 * Call this method to set the seed value for the randomizer. The initial value
	 * will be the current time in milliseconds.
	 *
	 * @param {Number} value for the seed,
	 */
	randomize(value) {
		value = (value === undefined) ? Date.now() : value;

		this.randSeed = value;
	}

	/**
	 * Call this method to get a random number. If passed a value, the return
	 * will be an integer between 0 and that number - 1. without it will be a
	 * real value between 0 and 1, not inclusive.
	 *
	 * @param {Number} [limit] if passed the upper boundary of the integer - 1
	 *
	 * @returns {Number} the randomized value as either an integer or a decimal
	 *     value depending on how it was called.
	 */
	random(limit)
	{
		var randPow = Math.pow(2, -31);
		var randLimit = Math.pow(2, 31);
		var magic = 0x8088405;
		var rand = this.randSeed * magic + 1;

		this.randSeed = rand % randLimit

		rand = rand % randLimit
		rand = rand * randPow;

		if (limit) {
			rand = Math.floor(Math.abs(rand) * limit);
		}

		return rand;
	}

	/**
	 * Generate a random number using a bell curve. The curve is created using
	 * the analogy of dice. For example, a random number built with two six
	 * sided dice will have the peak of the curve at 7 with 2 and 12 being at
	 * the bottom.
	 *
	 * @param {number} dice - how many random numbers to pick
	 * @param {number} faces - the range, from 1 - faces, of the number
	 * @param {boolean} [zeroBased] - if true, the random range for each die will be from 0 - faces-1
	 *
	 * @return {number} the random number
	 */
	randomCurve(dice, faces, zeroBased = false) {
		let result = 0;
		let adjust = zeroBased ? 0 : 1
		for (let idx = 0; idx < dice; idx++) {
			result += this.random(faces) + adjust;
		}

		return result;
	}

	/**
	 * Generate a bell-shaped integer within an inclusive range using the faster
	 * dice-curve approximation.
	 *
	 * @param {number} start - inclusive lower bound
	 * @param {number} end - inclusive upper bound
	 * @param {number} [dice] - how many random rolls to average
	 *
	 * @returns {number} a bell-shaped integer within the given range
	 */
	randomCurveRange(start, end, dice = 3) {
		if (!Number.isInteger(start) || !Number.isInteger(end)) {
			throw new Error('start and end must be integers');
		}

		if (!Number.isInteger(dice) || dice < 1) {
			throw new Error('dice must be a positive integer');
		}

		if (end < start) {
			throw new Error('end must be greater than or equal to start');
		}

		if (start === end) {
			return start;
		}

		let span = end - start;
		let curve = this.randomCurve(dice, span + 1, true);
		let averaged = Math.round(curve / dice);

		return start + averaged;
	}

	/**
	 * Generate a normally distributed random number using the Box-Muller transform.
	 *
	 * @param {number} [mean] - center of the distribution
	 * @param {number} [stddev] - standard deviation
	 *
	 * @returns {number} a normally distributed random number
	 */
	randomNormal(mean = 0, stddev = 1) {
		let u1 = 0;
		let u2 = 0;

		// Avoid log(0)
		while (u1 === 0) {
			u1 = this.random();
		}

		while (u2 === 0) {
			u2 = this.random();
		}

		let z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

		return z0 * stddev + mean;
	}

	/**
	 * Generate a uniformly distributed integer in the inclusive range [start, end].
	 *
	 * @param {number} start
	 * @param {number} end
	 *
	 * @returns {number} a uniformly distributed integer
	 */
	randomInt(start, end) {
		if (!Number.isInteger(start) || !Number.isInteger(end)) {
			throw new Error('start and end must be integers');
		}

		if (end < start) {
			throw new Error('end must be greater than or equal to start');
		}

		return start + this.random(end - start + 1);
	}

	/**
	 * Generate a normally distributed integer by rounding the output of randomNormal.
	 *
	 * @param {number} [mean] - center of the distribution
	 * @param {number} [stddev] - standard deviation
	 *
	 * @returns {number} a rounded normally distributed integer
	 */
	randomNormalInt(mean = 0, stddev = 1) {
		return Math.round(this.randomNormal(mean, stddev));
	}

	/**
	 * Generate a normally distributed integer within an inclusive range.
	 * Values outside the range are discarded and retried.
	 *
	 * @param {number} start - inclusive lower bound
	 * @param {number} end - inclusive upper bound
	 * @param {number} [mean] - defaults to midpoint
	 * @param {number} [stddev] - defaults to range / 6
	 *
	 * @returns {number} a normally distributed integer within the given range
	 */
	randomNormalRange(start, end, mean = undefined, stddev = undefined) {
		if (!Number.isInteger(start) || !Number.isInteger(end)) {
			throw new Error('start and end must be integers');
		}

		if (end < start) {
			throw new Error('end must be greater than or equal to start');
		}

		if (start === end) {
			return start;
		}

		let width = end - start;
		let center = mean ?? (start + end) / 2;
		let spread = stddev ?? (width / 6);

		while (true) {
			let value = this.randomNormalInt(center, spread);
			if (value >= start && value <= end) {
				return value;
			}
		}
	}

	/**
	 * Convenience alias for a bell-shaped integer over an inclusive range.
	 *
	 * @param {number} start
	 * @param {number} end
	 *
	 * @returns {number} a normally distributed integer within the given range
	 */
	randomBell(start, end) {
		return this.randomNormalRange(start, end);
	}





	/**
	 * call this method to pick a random number from an array and remove it
	 * @param {Array} list the array of itens to chooise from
	 *
	 * @returns {*} the chosen item
	 */
	pickOne(list) {
		var pos = Math.floor(this.random() * list.length);
		var choice = list.splice(pos, 1);
		return choice[0];
	}

	/**
	 * Call this method to pick two items from a given list. The items are
	 * removed from the array
	 *
	 * @param {Array} list the array of items to choose
	 * @returns {Array} the two chosen items
	 */
	pickPair(list) {
		var result = [];
		result.push(this.pickOne(list))
		result.push(this.pickOne(list))

		return result;
	}

	/**
	 * Call this method to chose a random item from a list. The item is not
	 * removed.
	 *
	 * @param {Array} list the list of items to choose from
	 *
	 * @returns {*} the chosen item
	 */
	chooseOne(list) {
		var pos = Math.floor(this.random() * list.length);
		return list[pos];
	}

	/**
	 * Call this method to choose a given number of items from a list. The items
	 * are removed.
	 *
	 * @param {Number} count te number of items to pick
	 * @param {*} list the list of items to choose from
	 *
	 * @returns {Array} the chosen items
	 */
	pick(count, list) {

		var result = [];
		for(var idx = 0; idx < count; idx++) {
			result.push(this.pickOne(list));
		}

		return result;
	}

	/**
	 * Call this method to randomly pick a number of items from a list. The
	 * items are not removed.
	 *
	 * @param {Number} count the number of items to choose
	 * @param {Array} list the list of items to choose from
	 *
	 * @returns {Array} the list of items chosen
	 */
	choose(count, list){
		var result = [];
		for(var idx = 0; idx < count; idx++) {
			result.push(this.chooseOne(list));
		}

		return result;
	}

	/**
	 * Call this method to randmply pick a given number of item pairs. The items
	 * will be removed from the list.
	 *
	 * @param {Number} count the number of pairs to pick
	 * @param {Array} list the list of items to choose from
	 *
	 * @returns {Array.<Array>} the item pairs chosen. Each pair is an array of
	 * 	two items from the list
	 */
	pickPairs(count, list) {
		var result = [];

		for(var idx = 0; idx < count; idx++) {
			result.push(this.pickPair(list));
		}

		return result;
	}

	/**
	 * Call this method to pick pairs of strings from an array of strings. This
	 * returns an array of strings where each chosen pair has been concatenated.
	 * The strings are removed from the list.
	 *
	 * @param {Number} the number of pairs to pick
	 * @param {Array.<String>} list the strings to pick from
	 * @returns {Array.<String>} the array of string pairs
	 */
	pickStringPairs(count, list) {
		var result = [];

		for(var idx = 0; idx < count; idx++) {
			result.push(this.pickPair(list).join(''));
		}

		return result;

	}





};

export default new Random();
