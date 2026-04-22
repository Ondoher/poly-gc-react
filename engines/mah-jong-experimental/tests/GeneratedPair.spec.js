import GeneratedPair from '../GeneratedPair.js';

describe('GeneratedPair', () => {
	it('stores one prepared structural tile pair', () => {
		let pair = new GeneratedPair({
			tile1: 4,
			tile2: 9,
			preferredFaceGroup: 7,
			faceGroup: 8,
			faces: [32, 33],
		});

		expect(pair.tile1).toBe(4);
		expect(pair.tile2).toBe(9);
		expect(pair.tiles).toEqual([4, 9]);
		expect(pair.preferredFaceGroup).toBe(7);
		expect(pair.faceGroup).toBe(8);
		expect(pair.faces).toEqual([32, 33]);
	});

	it('stores assigned face-pair metadata fluently', () => {
		let pair = new GeneratedPair({ tile1: 0, tile2: 1 });

		expect(pair.assignFaces({
			faceGroup: 6,
			face1: 24,
			face2: 25,
		})).toBe(pair);

		expect(pair.faceGroup).toBe(6);
		expect(pair.faces).toEqual([24, 25]);
	});

	it('clones itself without sharing mutable arrays', () => {
		let pair = new GeneratedPair({
			tile1: 1,
			tile2: 2,
			faces: [4, 5],
		});
		let clone = pair.clone();

		clone.faces.push(6);

		expect(clone).not.toBe(pair);
		expect(pair.faces).toEqual([4, 5]);
	});

	it('returns a plain data snapshot', () => {
		let pair = new GeneratedPair({
			tile1: 3,
			tile2: 5,
			preferredFaceGroup: 2,
			faceGroup: 4,
			faces: [16, 17],
		});

		expect(pair.toJSON()).toEqual({
			tile1: 3,
			tile2: 5,
			preferredFaceGroup: 2,
			faceGroup: 4,
			faces: [16, 17],
		});
	});
});
