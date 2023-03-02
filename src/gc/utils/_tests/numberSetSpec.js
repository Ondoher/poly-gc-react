import NumberSet from "utils/NumberSet.js";

describe('Number Set', function() {
	it('should create an empty set', function() {
		var set = new NumberSet([], 240);

		expect(set.chunkCount).toBe(10);

		for (let idx = 0; idx < set.chunkCount; idx++) {
			expect(set.chunks[idx]).toBe(0)
		}
	})
})
