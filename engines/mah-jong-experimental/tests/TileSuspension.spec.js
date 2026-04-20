import TileSuspension from '../TileSuspension.js';

describe('TileSuspension', () => {
	it('stores one suspended-tile record', () => {
		let suspension = new TileSuspension({
			tile: 12,
			faces: [40, 41],
			placedAt: 8,
			placementCount: 4,
			openCount: 6,
			originalPair: [3, 9],
			faceGroup: 10,
		});

		expect(suspension.tile).toBe(12);
		expect(suspension.faces).toEqual([40, 41]);
		expect(suspension.placedAt).toBe(8);
		expect(suspension.placementCount).toBe(4);
		expect(suspension.openCount).toBe(6);
		expect(suspension.originalPair).toEqual([3, 9]);
		expect(suspension.faceGroup).toBe(10);
	});

	it('clones itself without sharing mutable arrays', () => {
		let suspension = new TileSuspension({
			tile: 4,
			faces: [8, 9],
			originalPair: [1, 2],
			faceGroup: 2,
		});
		let clone = suspension.clone();

		clone.faces.push(10);
		clone.originalPair.push(3);

		expect(clone).not.toBe(suspension);
		expect(suspension.faces).toEqual([8, 9]);
		expect(suspension.originalPair).toEqual([1, 2]);
	});

	it('returns a plain data snapshot', () => {
		let suspension = new TileSuspension({
			tile: 7,
			faces: [28, 29],
			placedAt: 5,
			placementCount: 3,
			openCount: 4,
			originalPair: [0, 1],
			faceGroup: 7,
		});

		expect(suspension.toJSON()).toEqual({
			tile: 7,
			faces: [28, 29],
			placedAt: 5,
			placementCount: 3,
			openCount: 4,
			originalPair: [0, 1],
			faceGroup: 7,
		});
	});
});
