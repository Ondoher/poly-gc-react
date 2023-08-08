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

var Random = {
	/**
	 * Call this method to set the seed value for the randomizer. The initial value
	 * will be the current time in milliseconds.
	 *
	 * @param {Number} value for the seed,
	 */
	randomize: function (value) {
		value = (value === undefined) ? Date.now() : value;

		Random.randSeed = value;
	},

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
	random:  function(limit)
	{
		var randPow = Math.pow(2, -31);
		var randLimit = Math.pow(2, 31);
		var magic = 0x8088405;
		var rand = Random.randSeed * magic + 1;

		Random.randSeed = rand % randLimit

		rand = rand % randLimit
		rand = rand * randPow;

		if (limit) {
			rand = Math.floor(Math.abs(rand) * limit);
		}

		return rand;
	}
};

Random.randomize();
export default Random
