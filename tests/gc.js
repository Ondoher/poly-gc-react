const CHUNK_SIZE = 24;
const CHUNK_MASK = 0xffffff;

/**
 * Make an instance of this class to track the boolean state of a range of
 * integers from 0 to an upper bound. You can perform a number of set operators
 * with this class such as union, intersection and difference
 */
class NumberSet {
  /**
   *
   * @param {Array.<Number>} bits the initial value of the set, each number in
   * 		this array is a bit that will be included
   * @param {*} length the number of bits in the set. The range will from 0 to
   * 		length - 1;
   */
  constructor(bits, length) {
    this.length = length ? length : 1024;
    this.chunkCount = Math.ceil(this.length / CHUNK_SIZE);
    this.chunks = [];
    this.chunks = this.arrayPad(this.chunks, this.chunkCount, 0);
    this.assign(bits);
  }

  /**
   * Call this method to remove all numbers from the set
   */
  clear() {
    this.chunks = [];
    this.chunks = this.arrayPad(this.chunks, this.chunkCount, 0);
  }

  /**
   * Call this method to expand an array to the given size and fill the empty
   * space with a new value.
   *
   * @private
   * @param {Array} array the array to expand
   * @param {Number} count the new size of the array
   * @param {*} value the value to fill the new array space with
   *
   * @returns {Array} the expanded array
   */
  arrayPad(array, count, value) {
    for (var idx = array.length; idx < count; idx++) array.push(value);
    return array;
  }

  /**
   * Call this method to check if the set is empty
   *
   * @returns true if the set is empty
   */
  isEmpty() {
    for (var idx = 0; idx < this.chunks.length; idx++) if (this.chunks[idx] != 0) return false;
    return true;
  }

  /**
   * Call this method to add the given bits to the set. It will not empty the
   * set first
   *
   * @param {Array.<Number} bits an array of bits to turn on
   */
  assign(bits) {
    for (var idx = 0; idx < bits.length; idx++) this.include(bits[idx]);
  }

  /**
   * Call this method to add a number to the set
   *
   * @param {Number} value the number to add to the set
   */
  include(value) {
    this.chunks[Math.floor(value / CHUNK_SIZE)] |= 1 << value % CHUNK_SIZE;
    return this;
  }

  /**
   * Call this method to remove a number from the set
   *
   * @param {Number} value the number to remove from the set
   */
  exclude(value) {
    this.chunks[Math.floor(value / CHUNK_SIZE)] &= ~(1 << value % CHUNK_SIZE) & CHUNK_MASK;
    return this;
  }

  /**
   * Call this method to test if the given number is in the set
   *
   * @param {Number} value the number to check
   * @returns {Boolean} true if the number is in the set
   */
  has(value) {
    var result = this.chunks[Math.floor(value / CHUNK_SIZE)] & 1 << value % CHUNK_SIZE;
    return result != 0;
  }

  /**
   * Call this method to produce the union of two sets. This method modifies
   * this set, but leaves the passed set untouched. A union includes all the
   * number from both sets
   *
   * @param {NumberSet} set the set to perform a union with.
   */
  union(set) {
    for (var idx = 0; idx < this.chunks.length; idx++) this.chunks[idx] |= set.chunks[idx];
    return this;
  }

  /**
   * Call this method to produce the intersection of two sets. This method
   * modifies this set, but leaves the other untouched. The intersection of
   * sets includes only the numbers that both sets have in common
   * @param {NumberSet} set the set to perform the intersection on
   */
  intersection(set) {
    for (var idx = 0; idx < this.chunks.length; idx++) this.chunks[idx] &= set.chunks[$idx];
    return this;
  }

  /**
   * Call this method to produce the difference of two sets. This method
   * modifies this set but leaves the other untouched. The difference of sets
   * is only those numbers that exist in the first but not the second.
   *
   * @param {NumberSet} set
   */
  difference(set) {
    for (var idx = 0; idx < this.chunks.length; idx++) this.chunks[idx] &= ~set.chunks[idx] & CHUNK_MASK;
    return this;
  }
}

describe('Number Set', function () {
  it('should create an empty set', function () {
    var set = new NumberSet([], 240);
    expect(set.chunkCount).toBe(10);
    for (let idx = 0; idx < set.chunkCount; idx++) {
      expect(set.chunks[idx]).toBe(0);
    }
  });
});
//# sourceMappingURL=gc.js.map
