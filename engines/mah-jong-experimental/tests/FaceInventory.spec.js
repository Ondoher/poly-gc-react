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

	it('builds face sets with matching face pairs for a board size', () => {
		Random.randomize(123);

		let inventory = new FaceInventory().initialize(8);

		expect(inventory.getRemainingPairCount()).toBe(4);
		expect(inventory.hasRemainingPairs()).toBe(true);

		let first = inventory.peekNextPair();

		expect(first).toBeDefined();
		expect(inventory.getFaceGroup(first.face1)).toBe(first.faceGroup);
		expect(inventory.getFaceGroup(first.face2)).toBe(first.faceGroup);
	});

	it('keeps shuffleTiles as the current lower-level initialization implementation', () => {
		Random.randomize(123);

		let inventory = new FaceInventory();

		expect(inventory.shuffleTiles(4)).toBe(inventory);
		expect(inventory.getRemainingPairCount()).toBe(2);
	});

	it('uses the shared suit names for concrete faces and face groups', () => {
		let inventory = new FaceInventory();

		expect(inventory.getSuit(0)).toBe('bamboo');
		expect(inventory.getSuit(108)).toBe('dragons');
		expect(inventory.getSuit(120)).toBe('winds');
		expect(inventory.getSuit(136)).toBe('flowers');
		expect(inventory.getSuit(140)).toBe('seasons');
		expect(inventory.getSuitFromFaceGroup(27)).toBe('dragons');
	});

	it('draws face pairs in order and reduces remaining count', () => {
		Random.randomize(321);

		let inventory = new FaceInventory().shuffleTiles(4);
		let first = inventory.peekNextPair();
		let drawn = inventory.drawPair();

		expect(drawn).toEqual(first);
		expect(inventory.getRemainingPairCount()).toBe(1);
	});

	it('checks whether a face group has enough remaining faces to be selected', () => {
		let inventory = new FaceInventory();

		inventory.faceSets.set(3, {
			id: 3,
			suit: 'bamboo',
			faces: [12, 13],
		});
		inventory.faceSets.set(4, {
			id: 4,
			suit: 'bamboo',
			faces: [16],
		});

		expect(inventory.canSelectFromGroup(3)).toBe(true);
		expect(inventory.canSelectFromGroup(3, 4)).toBe(false);
		expect(inventory.canSelectFromGroup(4)).toBe(false);
		expect(inventory.canSelectFromGroup(99)).toBe(false);
	});

	it('checks whether a face group has a complete full face set', () => {
		let inventory = new FaceInventory();

		inventory.faceSets.set(3, {
			id: 3,
			suit: 'bamboo',
			faces: [12, 13, 14, 15],
		});
		inventory.faceSets.set(4, {
			id: 4,
			suit: 'bamboo',
			faces: [16, 17],
		});

		expect(inventory.canSelectFullFaceSet(3)).toBe(true);
		expect(inventory.canSelectFullFaceSet(4)).toBe(false);
		expect(inventory.canSelectFullFaceSet(99)).toBe(false);
	});

	it('selects one complete full face set from a selected face group', () => {
		let inventory = new FaceInventory();

		inventory.faceSets.set(3, {
			id: 3,
			suit: 'bamboo',
			faces: [12, 13, 14, 15],
		});

		expect(inventory.selectFullFaceSet(3)).toEqual({
			faceGroup: 3,
			faces: [12, 13, 14, 15],
		});
		expect(inventory.faceSets.has(3)).toBe(false);
		expect(inventory.getRemainingPairCount()).toBe(0);
	});

	it('selects one face pair from a selected face group', () => {
		let inventory = new FaceInventory();

		inventory.faceSets.set(3, {
			id: 3,
			suit: 'bamboo',
			faces: [12, 13, 14, 15],
		});

		expect(inventory.selectPairFromGroup(3)).toEqual({
			faceGroup: 3,
			face1: 12,
			face2: 13,
		});
		expect(inventory.faceSets.get(3).faces).toEqual([14, 15]);
		expect(inventory.getRemainingPairCount()).toBe(1);
	});

	it('removes a face group after selecting its last face pair', () => {
		let inventory = new FaceInventory();

		inventory.faceSets.set(3, {
			id: 3,
			suit: 'bamboo',
			faces: [12, 13],
		});

		expect(inventory.selectPairFromGroup(3)).toEqual({
			faceGroup: 3,
			face1: 12,
			face2: 13,
		});
		expect(inventory.faceSets.has(3)).toBe(false);
		expect(inventory.getRemainingPairCount()).toBe(0);
	});

	it('returns null when a selected face group cannot provide a face pair', () => {
		let inventory = new FaceInventory();

		inventory.faceSets.set(4, {
			id: 4,
			suit: 'bamboo',
			faces: [16],
		});

		expect(inventory.selectPairFromGroup(4)).toBe(null);
		expect(inventory.selectPairFromGroup(99)).toBe(null);
	});

	it('returns null when a selected face group cannot provide a full face set', () => {
		let inventory = new FaceInventory();

		inventory.faceSets.set(4, {
			id: 4,
			suit: 'bamboo',
			faces: [16, 17],
		});

		expect(inventory.selectFullFaceSet(4)).toBe(null);
		expect(inventory.selectFullFaceSet(99)).toBe(null);
		expect(inventory.faceSets.get(4).faces).toEqual([16, 17]);
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
