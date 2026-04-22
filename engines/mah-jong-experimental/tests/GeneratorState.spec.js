import FaceInventory from '../FaceInventory.js';
import { GeneratorState } from '../GeneratorState.js';
import Grid from '../Grid.js';
import SoftLinks from '../SoftLinks.js';
import { DIFFICULTY_SETTINGS } from '../difficulty-settings.js';

describe('GeneratorState', () => {
	function createLayeredLayout() {
		return {
			id: 'generator-state-layout',
			tiles: 3,
			positions: [
				{x: 1, y: 1, z: 0},
				{x: 4, y: 1, z: 1},
				{x: 7, y: 1, z: 3},
			],
		};
	}

	function createState() {
		return new GeneratorState(new Grid(), new FaceInventory());
	}

	it('extends game state with generator-specific collaborators', () => {
		let faceInventory = new FaceInventory();
		let state = new GeneratorState(new Grid(), faceInventory);

		expect(state.faceInventory).toBe(faceInventory);
		expect(state.suspensionRules).toBe(null);
		expect(state.settings).toBe(null);
		expect(state.tilePickerRules).toEqual({});
		expect(state.faceAvoidanceRules).toEqual({
			enabled: false,
			weight: 1,
			suspensionWeight: 3,
			maxWeight: 8,
		});
		expect(state.faceAssignmentRules).toEqual({
			preferredMultiplier: 0.5,
			easyReuseDuplicateScale: 0,
		});
		expect(state.preparedPairs).toEqual([]);
		expect(state.suspended).toEqual([]);
		expect(state.unavailableTiles).toEqual([]);
		expect(state.softLinkRecords).toEqual([]);
		expect(state.nextSoftLinkId).toBe(1);
		expect(state.softLinks instanceof SoftLinks).toBe(true);
	});

	it('tracks generation-only records on generator state', () => {
		let state = createState();
		let preparedPair = {tile1: 0, tile2: 1};
		let suspension = {tile: 2};
		state.unavailableTiles = [2];
		let softLink = state.softLinks.createLink('grouped', {
			role: 'reservation',
			tiles: [0],
		});

		expect(state.addPreparedPair(preparedPair)).toBe(preparedPair);
		expect(state.addSuspension(suspension)).toBe(suspension);
		expect(state.preparedPairs).toEqual([preparedPair]);
		expect(state.suspended).toEqual([suspension]);
		expect(state.unavailableTiles).toEqual([2]);
		expect(state.softLinkRecords).toEqual([softLink]);
		expect(state.nextSoftLinkId).toBe(2);

		expect(state.resetGenerationRecords()).toBe(state);
		expect(state.preparedPairs).toEqual([]);
		expect(state.suspended).toEqual([]);
		expect(state.unavailableTiles).toEqual([]);
		expect(state.softLinkRecords).toEqual([]);
		expect(state.nextSoftLinkId).toBe(1);
	});

	it('uses fluent setup methods without reconfiguring the board', () => {
		let state = createState().setLayout(createLayeredLayout()).configureBoard();
		let suspensionRules = DIFFICULTY_SETTINGS.challenging.suspensionRules;

		spyOn(state, 'configureBoard').and.callThrough();

		expect(state.setupSuspensionRules(suspensionRules)).toBe(state);
		expect(state.setupDifficulty(0.9)).toBe(state);
		expect(state.setupTilePickerRules({highestZOrder: 10})).toBe(state);
		expect(state.setupFaceAvoidanceRules({enabled: true})).toBe(state);
		expect(state.setupFaceAssignmentRules({easyReuseDuplicateScale: 2})).toBe(state);
		expect(state.configureBoard).not.toHaveBeenCalled();
		expect(state.suspensionRules).toBe(suspensionRules);
		expect(state.difficulty()).toBe(0.9);
		expect(state.tilePickerRules).toEqual({highestZOrder: 10});
		expect(state.faceAvoidanceRules.enabled).toBe(true);
		expect(state.faceAssignmentRules.easyReuseDuplicateScale).toBe(2);
	});

	it('clamps stored difficulty as the generation behavior source of truth', () => {
		let state = createState();

		state.setupDifficulty(2);
		expect(state.difficulty()).toBe(1);

		state.setupDifficulty(-1);
		expect(state.difficulty()).toBe(0);
	});

	it('copies resolved settings into the shared generator state', () => {
		let settings = {
			...DIFFICULTY_SETTINGS.expert,
			tilePickerRules: {
				highestZOrder: 12,
				openPressureMultiplier: 0.75,
			},
			faceAvoidanceRules: {
				enabled: true,
				weight: 2,
			},
			faceAssignmentRules: {
				preferredMultiplier: 0.25,
				easyReuseDuplicateScale: 3,
			},
		};
		let state = createState();

		expect(state.setupSettings(settings)).toBe(state);
		expect(state.settings).toBe(settings);
		expect(state.difficulty()).toBe(settings.generationDifficulty);
		expect(state.suspensionRules).toBe(settings.suspensionRules);
		expect(state.tilePickerRules).toEqual(settings.tilePickerRules);
		expect(state.faceAvoidanceRules).toEqual({
			enabled: true,
			weight: 2,
			suspensionWeight: 3,
			maxWeight: 8,
		});
		expect(state.faceAssignmentRules).toEqual({
			preferredMultiplier: 0.25,
			easyReuseDuplicateScale: 3,
		});
	});

	it('exposes tile picker rules and state defaults through focused accessors', () => {
		let state = createState()
			.setupDifficulty(0.8)
			.setupTilePickerRules({
				horizontalMultiplier: 7,
				depthMultiplier: 11,
				openPressureMultiplier: 0.4,
				maxFreedPressure: 5,
				minWindowRatio: 0.5,
			})
			.setLayout(createLayeredLayout())
			.configureBoard();

		state.unavailableTiles = [1];

		expect(state.difficulty()).toBe(0.8);
		expect(state.getMinWindowRatio()).toBe(0.5);
		expect(state.getHighestZOrder()).toBe(4);
		expect(state.getHorizontalMultiplier()).toBe(7);
		expect(state.getDepthMultiplier()).toBe(11);
		expect(state.getOpenPressureMultiplier()).toBe(0.4);
		expect(state.getMaxFreedPressure()).toBe(5);
		expect(state.getBalancePressureMultiplier()).toBe(0.6000000000000001);
		expect(state.getMaxBalanceMargin()).toBe(8);
		expect(state.getShortHorizonProbeMoves()).toBe(0);
		expect(state.getShortHorizonPressureMultiplier()).toBe(0);
		expect(state.unavailableTiles).toEqual([1]);
	});
});
