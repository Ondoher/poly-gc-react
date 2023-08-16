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
