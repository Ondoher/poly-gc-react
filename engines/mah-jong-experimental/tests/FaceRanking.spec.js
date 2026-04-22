import FaceInventory from '../FaceInventory.js';
import { FaceRanking } from '../FaceRanking.js';
import GeneratedPair from '../GeneratedPair.js';
import { GeneratorState } from '../GeneratorState.js';
import Grid from '../Grid.js';

describe('FaceRanking', () => {
	function createState(faceInventory = new FaceInventory()) {
		return new GeneratorState(new Grid(), faceInventory);
	}

	it('uses the generator state and its face inventory', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory);
		let ranking = new FaceRanking(state);

		expect(ranking.state).toBe(state);
		expect(ranking.inventory).toBe(faceInventory);
		expect(ranking.avoidance).toBeDefined();
	});

	it('leaves unpreferred distance factors unchanged', () => {
		let ranking = new FaceRanking(createState());

		expect(ranking.getAdjustedDistanceFactor(10, false)).toBe(10);
	});

	it('uses the default preferred multiplier for preferred distance factors', () => {
		let ranking = new FaceRanking(createState());

		expect(ranking.getAdjustedDistanceFactor(10, true)).toBe(5);
	});

	it('honors custom preferred multipliers from generator state', () => {
		let state = createState()
			.setupFaceAssignmentRules({preferredMultiplier: 0.25});
		let ranking = new FaceRanking(state);

		expect(ranking.getAdjustedDistanceFactor(20, true)).toBe(5);
	});

	it('sums avoidance penalties for the face-set id across the target tiles', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory);
		let ranking = new FaceRanking(state);

		faceInventory.faceSets.set(7, {
			id: 7,
			suit: 'bamboo',
			faces: [28, 29],
		});
		spyOn(ranking.avoidance, 'getPenalty').and.callFake((tile, faceSetId) => {
			return tile + faceSetId;
		});

		expect(ranking.getAvoidancePenalty(7, [1, 3])).toBe(18);
		expect(ranking.avoidance.getPenalty).toHaveBeenCalledWith(1, 7);
		expect(ranking.avoidance.getPenalty).toHaveBeenCalledWith(3, 7);
	});

	it('requires the ranked face group to exist in the face inventory', () => {
		let ranking = new FaceRanking(createState());

		expect(() => ranking.getAvoidancePenalty(99, [1]))
			.toThrowError(TypeError);
	});

	it('does not duplicate reused face groups when duplicate scaling is off', () => {
		let state = createState()
			.setupDifficulty(0.1)
			.setupFaceAssignmentRules({easyReuseDuplicateScale: 0});
		let ranking = new FaceRanking(state);

		expect(ranking.getFaceGroupDuplicateCount(0, 4)).toBe(1);
	});

	it('does not duplicate reused face groups outside easy-side pressure', () => {
		let state = createState()
			.setupDifficulty(0.5)
			.setupFaceAssignmentRules({easyReuseDuplicateScale: 4});
		let ranking = new FaceRanking(state);

		expect(ranking.getFaceGroupDuplicateCount(0, 4)).toBe(1);
	});

	it('does not duplicate reused face groups without reuse history', () => {
		let state = createState()
			.setupDifficulty(0.1)
			.setupFaceAssignmentRules({easyReuseDuplicateScale: 4});
		let ranking = new FaceRanking(state);

		expect(ranking.getFaceGroupDuplicateCount(0, 0)).toBe(1);
	});

	it('duplicates closer reused face groups more strongly on easy settings', () => {
		let state = createState()
			.setupDifficulty(0)
			.setupFaceAssignmentRules({easyReuseDuplicateScale: 4});
		let ranking = new FaceRanking(state);

		expect(ranking.getFaceGroupDuplicateCount(0, 4)).toBe(5);
		expect(ranking.getFaceGroupDuplicateCount(3, 4)).toBe(1);
	});

	it('uses generator-state difficulty when calculating reused face-group duplicates', () => {
		let state = createState()
			.setupDifficulty(0)
			.setupFaceAssignmentRules({easyReuseDuplicateScale: 4});
		let ranking = new FaceRanking(state);

		expect(ranking.getFaceGroupDuplicateCount(0, 4)).toBe(5);
	});

	it('ranks available face groups deterministically when no prepared tile pair is provided', () => {
		let faceInventory = new FaceInventory();
		let ranking = new FaceRanking(createState(faceInventory));

		faceInventory.faceSets.set(5, {
			id: 5,
			suit: 'bamboo',
			faces: [20, 21],
		});
		faceInventory.faceSets.set(2, {
			id: 2,
			suit: 'bamboo',
			faces: [8],
		});
		faceInventory.faceSets.set(3, {
			id: 3,
			suit: 'bamboo',
			faces: [12, 13],
		});

		expect(ranking.rankFaceGroups(2)).toEqual([3, 5]);
	});

	it('keeps the live preferred-face-group bias inside ranking output', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory)
			.setupFaceAssignmentRules({preferredMultiplier: 0.25});
		let ranking = new FaceRanking(state);
		let preparedPair = new GeneratedPair({
			tile1: 0,
			tile2: 1,
			preferredFaceGroup: 1,
		});

		faceInventory.faceSets.set(1, {
			id: 1,
			suit: 'bamboo',
			faces: [4, 5],
		});
		faceInventory.faceSets.set(2, {
			id: 2,
			suit: 'bamboo',
			faces: [8, 9],
		});
		faceInventory.assignedFacePairs = [
			{faceGroup: 1},
			{faceGroup: 2},
		];

		expect(ranking.rankFaceGroups(2, preparedPair)).toEqual([1, 2]);
	});

	it('uses generator-state difficulty while ranking duplicate face groups', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory)
			.setupDifficulty(0)
			.setupFaceAssignmentRules({easyReuseDuplicateScale: 4});
		let ranking = new FaceRanking(state);

		faceInventory.faceSets.set(1, {
			id: 1,
			suit: 'bamboo',
			faces: [4, 5],
		});
		faceInventory.faceSets.set(2, {
			id: 2,
			suit: 'bamboo',
			faces: [8, 9],
		});
		faceInventory.assignedFacePairs = [
			{faceGroup: 1},
			{faceGroup: 2},
		];

		expect(ranking.rankFaceGroups(2)).toEqual([
			2,
			2,
			2,
			2,
			2,
			1,
		]);
	});

	it('orders reused face groups by most recent assignment first', () => {
		let faceInventory = new FaceInventory();
		let ranking = new FaceRanking(createState(faceInventory));

		faceInventory.faceSets.set(1, {
			id: 1,
			suit: 'bamboo',
			faces: [4, 5],
		});
		faceInventory.faceSets.set(2, {
			id: 2,
			suit: 'bamboo',
			faces: [8, 9],
		});
		faceInventory.faceSets.set(3, {
			id: 3,
			suit: 'bamboo',
			faces: [12, 13],
		});
		faceInventory.assignedFacePairs = [
			{faceGroup: 1},
			{faceGroup: 2},
			{faceGroup: 3},
		];

		expect(ranking.rankFaceGroups(2)).toEqual([3, 2, 1]);
	});

	it('uses live inverse avoidance ranking for unused face groups', () => {
		let faceInventory = new FaceInventory();
		let ranking = new FaceRanking(createState(faceInventory));
		let preparedPair = new GeneratedPair({
			tile1: 0,
			tile2: 1,
		});

		faceInventory.faceSets.set(1, {
			id: 1,
			suit: 'bamboo',
			faces: [4, 5],
		});
		faceInventory.faceSets.set(2, {
			id: 2,
			suit: 'bamboo',
			faces: [8, 9],
		});
		faceInventory.faceSets.set(3, {
			id: 3,
			suit: 'bamboo',
			faces: [12, 13],
		});
		spyOn(ranking, 'getAvoidancePenalty').and.callFake((faceGroup) => {
			return {
				1: 4,
				2: 2,
				3: 0,
			}[faceGroup] ?? 0;
		});

		expect(ranking.rankFaceGroups(2, preparedPair)).toEqual([3, 1, 2]);
	});

	it('returns difficulty-window details for ranked face groups', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory)
			.setupDifficulty(1)
			.setupTilePickerRules({minWindowRatio: 0.25});
		let ranking = new FaceRanking(state);

		faceInventory.faceSets.set(1, {
			id: 1,
			suit: 'bamboo',
			faces: [4, 5],
		});
		faceInventory.faceSets.set(2, {
			id: 2,
			suit: 'bamboo',
			faces: [8, 9],
		});
		faceInventory.faceSets.set(3, {
			id: 3,
			suit: 'bamboo',
			faces: [12, 13],
		});

		expect(ranking.getRankedFaceGroupWindow(2)).toEqual({
			window: [3],
			start: 2,
			end: 3,
			size: 1,
			count: 3,
			difficulty: 1,
		});
	});

	it('selects one face group from the ranked face-group window', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory)
			.setupDifficulty(1)
			.setupTilePickerRules({minWindowRatio: 0.25});
		let ranking = new FaceRanking(state);

		faceInventory.faceSets.set(1, {
			id: 1,
			suit: 'bamboo',
			faces: [4, 5],
		});
		faceInventory.faceSets.set(2, {
			id: 2,
			suit: 'bamboo',
			faces: [8, 9],
		});
		faceInventory.faceSets.set(3, {
			id: 3,
			suit: 'bamboo',
			faces: [12, 13],
		});

		expect(ranking.selectRankedFaceGroup(2)).toBe(3);
	});
});
