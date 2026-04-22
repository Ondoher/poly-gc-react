import Grid from '../Grid.js';
import { GeneratorState } from '../GeneratorState.js';
import FaceInventory from '../FaceInventory.js';
import Faces from '../Faces.js';
import GeneratedPair from '../GeneratedPair.js';
import { DIFFICULTY_SETTINGS } from '../difficulty-settings.js';

describe('Faces', () => {
	function createLayout() {
		return {
			id: 'faces-layout',
			tiles: 4,
			positions: [
				{x: 1, y: 1, z: 1},
				{x: 4, y: 1, z: 1},
				{x: 7, y: 1, z: 1},
				{x: 10, y: 1, z: 1},
			],
		};
	}

	function createState(faceInventory = new FaceInventory()) {
		return new GeneratorState(new Grid(), faceInventory)
			.setupSettings(DIFFICULTY_SETTINGS.standard)
			.setLayout(createLayout())
			.configureBoard();
	}

	it('creates and registers the face inventory by default', () => {
		let state = createState();
		let faces = new Faces(state);

		expect(faces.state).toBe(state);
		expect(faces.faceInventory instanceof FaceInventory).toBe(true);
		expect(state.faceInventory).toBe(faces.faceInventory);
		expect(faces.faceAvoidance.state).toBe(state);
		expect(faces.faceRanking.state).toBe(state);
		expect(faces.faceRanking.inventory).toBe(faces.faceInventory);
		expect(faces.faceRanking.avoidance).toBe(faces.faceAvoidance);
	});

	it('can use an injected face inventory when a test or caller needs one', () => {
		let faceInventory = new FaceInventory();
		let state = createState();
		let faces = new Faces(state, { faceInventory });

		expect(faces.faceInventory).toBe(faceInventory);
		expect(state.faceInventory).toBe(faceInventory);
		expect(faces.faceRanking.inventory).toBe(faceInventory);
	});

	it('initializes the face inventory for the board size', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory);
		let faces = new Faces(state, { faceInventory });

		spyOn(faceInventory, 'initialize').and.callThrough();

		expect(faces.initialize()).toBe(faces);
		expect(faceInventory.initialize).toHaveBeenCalledWith(4);
		expect(faceInventory.getRemainingPairCount()).toBe(2);
	});

	it('selects one matching face pair from the ranked face group', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory);
		let faces = new Faces(state, { faceInventory });
		let pair = new GeneratedPair({ tile1: 0, tile2: 1 });
		let facePair = { faceGroup: 1, face1: 4, face2: 5 };

		spyOn(faces.faceRanking, 'selectRankedFaceGroup').and.returnValue(1);
		spyOn(faceInventory, 'selectPairFromGroup').and.returnValue(facePair);

		expect(faces.selectFacesForPair(pair)).toBe(facePair);
		expect(faces.faceRanking.selectRankedFaceGroup).toHaveBeenCalledWith(
			2,
			pair
		);
		expect(faceInventory.selectPairFromGroup).toHaveBeenCalledWith(1);
	});

	it('throws when no ranked face group can be selected', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory);
		let faces = new Faces(state, { faceInventory });
		let pair = new GeneratedPair({ tile1: 0, tile2: 1 });

		spyOn(faces.faceRanking, 'selectRankedFaceGroup').and.returnValue(null);

		expect(() => faces.selectFacesForPair(pair))
			.toThrowError('Unable to select a face group during generation');
	});

	it('throws when the selected face group cannot provide a face pair', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory);
		let faces = new Faces(state, { faceInventory });
		let pair = new GeneratedPair({ tile1: 0, tile2: 1 });

		spyOn(faces.faceRanking, 'selectRankedFaceGroup').and.returnValue(1);
		spyOn(faceInventory, 'selectPairFromGroup').and.returnValue(null);

		expect(() => faces.selectFacesForPair(pair))
			.toThrowError('Selected face group could not provide a face pair');
	});

	it('selects one full face set from the ranked face group', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory);
		let faces = new Faces(state, { faceInventory });
		let pair = new GeneratedPair({ tile1: 0, tile2: 1 });
		let fullFaceSet = {
			faceGroup: 1,
			faces: [4, 5, 6, 7],
		};

		spyOn(faces.faceRanking, 'selectRankedFaceGroup').and.returnValue(1);
		spyOn(faceInventory, 'selectFullFaceSet').and.returnValue(fullFaceSet);

		expect(faces.selectFullFaceSet(pair)).toBe(fullFaceSet);
		expect(faces.faceRanking.selectRankedFaceGroup).toHaveBeenCalledWith(
			4,
			pair
		);
		expect(faceInventory.selectFullFaceSet).toHaveBeenCalledWith(1);
	});

	it('throws when no ranked full face set group can be selected', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory);
		let faces = new Faces(state, { faceInventory });
		let pair = new GeneratedPair({ tile1: 0, tile2: 1 });

		spyOn(faces.faceRanking, 'selectRankedFaceGroup').and.returnValue(null);

		expect(() => faces.selectFullFaceSet(pair))
			.toThrowError('Unable to select a full face set during generation');
	});

	it('throws when the selected face group cannot provide a full face set', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory);
		let faces = new Faces(state, { faceInventory });
		let pair = new GeneratedPair({ tile1: 0, tile2: 1 });

		spyOn(faces.faceRanking, 'selectRankedFaceGroup').and.returnValue(1);
		spyOn(faceInventory, 'selectFullFaceSet').and.returnValue(null);

		expect(() => faces.selectFullFaceSet(pair))
			.toThrowError('Selected face group could not provide a full face set');
	});

	it('does not choose a preferred face group when face avoidance is disabled', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory);
		let faces = new Faces(state, { faceInventory });
		let pair = new GeneratedPair({ tile1: 0, tile2: 1 });

		expect(faces.preparePairForFaceAssignment(pair)).toBe(pair);
		expect(pair.preferredFaceGroup).toBe(-1);
	});

	it('chooses the lowest-avoidance face group as a soft assignment preference', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory)
			.setupFaceAvoidanceRules({enabled: true});
		let faces = new Faces(state, { faceInventory });
		let pair = new GeneratedPair({ tile1: 0, tile2: 1 });

		faceInventory.faceSets = new Map([
			[1, {id: 1, suit: 'bamboo', faces: [4, 5]}],
			[2, {id: 2, suit: 'bamboo', faces: [8, 9]}],
		]);
		faces.faceAvoidance.addFaceAvoidance(0, 1, 3);
		faces.faceAvoidance.addFaceAvoidance(1, 1, 2);
		faces.faceAvoidance.addFaceAvoidance(0, 2, 1);

		expect(faces.getPreferredFaceGroup(2, pair.tiles)).toBe(2);

		faces.preparePairForFaceAssignment(pair);

		expect(pair.preferredFaceGroup).toBe(2);
	});

	it('keeps an existing preferred face group during face-assignment preparation', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory)
			.setupFaceAvoidanceRules({enabled: true});
		let faces = new Faces(state, { faceInventory });
		let pair = new GeneratedPair({
			tile1: 0,
			tile2: 1,
			preferredFaceGroup: 7,
		});

		spyOn(faces, 'getPreferredFaceGroup').and.returnValue(2);

		faces.preparePairForFaceAssignment(pair);

		expect(pair.preferredFaceGroup).toBe(7);
		expect(faces.getPreferredFaceGroup).not.toHaveBeenCalled();
	});

	it('assigns a selected face pair to one prepared tile pair and game state', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory);
		let faces = new Faces(state, { faceInventory });
		let pair = new GeneratedPair({ tile1: 0, tile2: 1 });
		let facePair = { faceGroup: 3, face1: 12, face2: 13 };

		spyOn(faces, 'selectFacesForPair').and.returnValue(facePair);

		expect(faces.assignFacesToPair(pair)).toBe(pair);
		expect(pair.faceGroup).toBe(3);
		expect(pair.faces).toEqual([12, 13]);
		expect(state.getFace(0)).toBe(12);
		expect(state.getFace(1)).toBe(13);
		expect(faceInventory.assignedFacePairs).toEqual([{
			tile1: 0,
			tile2: 1,
			faceGroup: 3,
		}]);
	});

	it('does not apply face avoidance when the rule is disabled', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory)
			.setupFaceAvoidanceRules({enabled: false, weight: 4});
		let faces = new Faces(state, { faceInventory });
		let pair = new GeneratedPair({
			tile1: 0,
			tile2: 1,
			faceGroup: 3,
		});

		state.softLinks.createLink('open-tiles', {
			role: 'after-removal',
			sourceTiles: pair.tiles,
			tiles: [2, 3],
		});

		expect(faces.applyFaceAvoidance(pair)).toBe(faces);
		expect(faces.faceAvoidance.getPenalty(2, 3)).toBe(0);
		expect(faces.faceAvoidance.getPenalty(3, 3)).toBe(0);
	});

	it('applies configured face avoidance to open soft links', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory)
			.setupFaceAvoidanceRules({enabled: true, weight: 4});
		let faces = new Faces(state, { faceInventory });
		let pair = new GeneratedPair({
			tile1: 0,
			tile2: 1,
			faceGroup: 3,
		});

		state.softLinks.createLink('open-tiles', {
			role: 'after-removal',
			sourceTiles: pair.tiles,
			tiles: [2, 3],
		});

		expect(faces.applyFaceAvoidance(pair)).toBe(faces);
		expect(faces.faceAvoidance.getPenalty(2, 3)).toBe(4);
		expect(faces.faceAvoidance.getPenalty(3, 3)).toBe(4);
		expect(faces.faceAvoidance.getPenalty(2, 4)).toBe(0);
	});

	it('uses a default face-avoidance weight when none is configured', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory)
			.setupFaceAvoidanceRules({enabled: true});
		let faces = new Faces(state, { faceInventory });
		let pair = new GeneratedPair({
			tile1: 0,
			tile2: 1,
			faceGroup: 3,
		});

		state.softLinks.createLink('open-tiles', {
			role: 'after-removal',
			sourceTiles: pair.tiles,
			tiles: [2],
		});

		faces.applyFaceAvoidance(pair);

		expect(faces.faceAvoidance.getPenalty(2, 3)).toBe(1);
	});

	it('applies face avoidance after assigning the selected face pair', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory)
			.setupFaceAvoidanceRules({enabled: true, weight: 2});
		let faces = new Faces(state, { faceInventory });
		let pair = new GeneratedPair({
			tile1: 0,
			tile2: 1,
		});
		let facePair = { faceGroup: 3, face1: 12, face2: 13 };

		state.softLinks.createLink('open-tiles', {
			role: 'after-removal',
			sourceTiles: pair.tiles,
			tiles: [2, 3],
		});

		spyOn(faces, 'selectFacesForPair').and.returnValue(facePair);

		faces.assignFacesToPair(pair);

		expect(pair.faceGroup).toBe(3);
		expect(faces.faceAvoidance.getPenalty(2, 3)).toBe(2);
		expect(faces.faceAvoidance.getPenalty(3, 3)).toBe(2);
	});

	it('assigns face pairs to every prepared tile pair', () => {
		let faceInventory = new FaceInventory();
		let state = createState(faceInventory);
		let faces = new Faces(state, { faceInventory });
		let preparedPairs = [
			new GeneratedPair({ tile1: 0, tile2: 1 }),
			new GeneratedPair({ tile1: 2, tile2: 3 }),
		];
		let calls = [];

		spyOn(faces, 'preparePairForFaceAssignment').and.callFake((pair) => {
			calls.push(`prepare:${pair.tile1}`);
			return pair;
		});
		spyOn(faces, 'assignFacesToPair').and.callFake((pair) => {
			calls.push(`assign:${pair.tile1}`);
			pair.assignFaces({
				faceGroup: pair.tile1,
				face1: pair.tile1,
				face2: pair.tile2,
			});
			return pair;
		});
		faces.initialize();

		expect(faces.assignFacesToPreparedPairs(preparedPairs)).toBe(preparedPairs);
		expect(faces.preparePairForFaceAssignment).toHaveBeenCalledTimes(2);
		expect(faces.assignFacesToPair).toHaveBeenCalledTimes(2);
		expect(calls).toEqual([
			'prepare:0',
			'assign:0',
			'prepare:2',
			'assign:2',
		]);
		expect(preparedPairs[0].faces.length).toBe(2);
		expect(preparedPairs[1].faces.length).toBe(2);
	});

	it('keeps the old assignFacesToPairSet name as a compatibility alias', () => {
		let state = createState();
		let faces = new Faces(state);
		let preparedPairs = [];

		spyOn(faces, 'assignFacesToPreparedPairs').and.returnValue(preparedPairs);

		expect(faces.assignFacesToPairSet(preparedPairs)).toBe(preparedPairs);
		expect(faces.assignFacesToPreparedPairs).toHaveBeenCalledWith(preparedPairs);
	});
});
