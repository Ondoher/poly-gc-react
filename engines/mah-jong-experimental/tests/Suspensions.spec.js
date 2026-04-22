import Faces from '../Faces.js';
import FaceInventory from '../FaceInventory.js';
import { GeneratorState } from '../GeneratorState.js';
import Grid from '../Grid.js';
import GameRules from '../GameRules.js';
import GeneratedPair from '../GeneratedPair.js';
import Suspensions from '../Suspensions.js';
import Tiles from '../Tiles.js';

describe('Suspensions', () => {
	function createSuspensions() {
		let state = new GeneratorState(new Grid(), new FaceInventory());
		let rules = new GameRules();
		let tiles = new Tiles(rules, state);
		let faces = new Faces(state);

		return new Suspensions({
			state,
			tiles,
			faces,
		});
	}

	it('stores injected domain orchestrators from an options object', () => {
		let state = new GeneratorState(new Grid(), new FaceInventory());
		let rules = new GameRules();
		let tiles = new Tiles(rules, state);
		let faces = new Faces(state);
		let suspensions = new Suspensions({
			state,
			tiles,
			faces,
		});

		expect(suspensions.state).toBe(state);
		expect(suspensions.tiles).toBe(tiles);
		expect(suspensions.faces).toBe(faces);
	});

	it('initializes fluently without implementing suspension policy yet', () => {
		let suspensions = createSuspensions();

		expect(suspensions.initialize()).toBe(suspensions);
		expect(suspensions.canReleaseSuspension()).toBe(false);
		expect(suspensions.canCreateSuspension()).toBe(false);
		expect(suspensions.step()).toBe(false);
	});

	it('returns a released pair before creating a new suspension', () => {
		let suspensions = createSuspensions();
		let pair = new GeneratedPair({ tile1: 0, tile2: 1 });

		spyOn(suspensions, 'canReleaseSuspension').and.returnValue(true);
		spyOn(suspensions, 'releaseSuspension').and.returnValue(pair);
		spyOn(suspensions, 'canCreateSuspension').and.returnValue(true);
		spyOn(suspensions, 'createSuspension').and.returnValue(new GeneratedPair({
			tile1: 2,
			tile2: 3,
		}));

		expect(suspensions.step()).toBe(pair);
		expect(suspensions.releaseSuspension).toHaveBeenCalled();
		expect(suspensions.createSuspension).not.toHaveBeenCalled();
	});

	it('returns a newly suspended pair when nothing can be released', () => {
		let suspensions = createSuspensions();
		let pair = new GeneratedPair({ tile1: 0, tile2: 1 });

		spyOn(suspensions, 'canReleaseSuspension').and.returnValue(false);
		spyOn(suspensions, 'canCreateSuspension').and.returnValue(true);
		spyOn(suspensions, 'createSuspension').and.returnValue(pair);

		expect(suspensions.step()).toBe(pair);
		expect(suspensions.createSuspension).toHaveBeenCalled();
	});

	it('keeps unimplemented policy methods explicit', () => {
		let suspensions = createSuspensions();

		expect(() => suspensions.createSuspension())
			.toThrowError('Suspension creation is not implemented yet');
		expect(() => suspensions.releaseSuspension({tile: 1}))
			.toThrowError('Suspension release is not implemented yet');
	});
});
