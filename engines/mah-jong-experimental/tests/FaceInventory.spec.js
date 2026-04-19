import Random from '../../../src/gc/utils/random.js';
import FaceInventory from '../FaceInventory.js';

describe('FaceInventory', () => {
	it('starts empty', () => {
		let inventory = new FaceInventory();

		expect(inventory.getRemainingPairCount()).toBe(0);
		expect(inventory.hasRemainingPairs()).toBe(false);
		expect(inventory.peekNextPair()).toBe(null);
		expect(inventory.drawPair()).toBe(null);
	});

	it('builds a simple set of matching pairs for a board size', () => {
		Random.randomize(123);

		let inventory = new FaceInventory().shuffleTiles(8);

		expect(inventory.getRemainingPairCount()).toBe(4);
		expect(inventory.hasRemainingPairs()).toBe(true);

		let first = inventory.peekNextPair();

		expect(first).toBeDefined();
		expect(inventory.getFaceGroup(first.face1)).toBe(first.faceGroup);
		expect(inventory.getFaceGroup(first.face2)).toBe(first.faceGroup);
	});

	it('draws pairs in order and reduces remaining count', () => {
		Random.randomize(321);

		let inventory = new FaceInventory().shuffleTiles(4);
		let first = inventory.peekNextPair();
		let drawn = inventory.drawPair();

		expect(drawn).toEqual(first);
		expect(inventory.getRemainingPairCount()).toBe(1);
	});

	it('can be cleared after initialization', () => {
		Random.randomize(999);

		let inventory = new FaceInventory().shuffleTiles(4);
		inventory.clear();

		expect(inventory.getRemainingPairCount()).toBe(0);
		expect(inventory.hasRemainingPairs()).toBe(false);
		expect(inventory.peekNextPair()).toBe(null);
	});
});
