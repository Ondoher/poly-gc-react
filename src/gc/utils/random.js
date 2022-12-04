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

/**
 * Call this method to set the seed value for the randomizer. The initial value
 * will be the current time in milliseconds.
 *
 * @param {Number} value for the seed,
 */
Math.randomize = function (value) {

	value = (value === undefined) ? Date.now() : value;

	Math.randSeed = value;
};

/**
 * Cal this number to get a random number. If passed a value, the return will be
 * an inter between 0 and that number - 1. without it will be a real value
 * between 0 and 1, not inclusive.
 *
 * @param {Number} [limit] if passed the upper boundary of the integer - 1
 *
 * @returns {Number} the randomized value as either an integer or a decimak
 *     value depending on how it was called.
 */

Math.random = function(limit)
{
	var randPow = Math.pow(2, -31);
	var randLimit = Math.pow(2, 31);
	var magic = 0x8088405;
	var rand = this.randSeed * magic + 1;

	this.randSeed = rand % randLimit

	rand = rand % randLimit
	rand = rand * randPow;

	if (limit)
		rand = Math.floor(Math.abs(rand) * limit);

	return rand;
}

Math.randomize();
