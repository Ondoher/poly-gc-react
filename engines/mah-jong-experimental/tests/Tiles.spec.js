import Grid from '../Grid.js';
import GameRules from '../GameRules.js';
import { GeneratorState } from '../GeneratorState.js';
import FaceInventory from '../FaceInventory.js';
import GeneratedPair from '../GeneratedPair.js';
import TilePicker from '../TilePicker.js';
import Tiles from '../Tiles.js';
import { DIFFICULTY_SETTINGS } from '../difficulty-settings.js';

describe('Tiles', () => {
	function createLayout() {
		return {
			id: 'tiles-layout',
			tiles: 4,
			positions: [
				{x: 1, y: 1, z: 1},
				{x: 4, y: 1, z: 1},
				{x: 7, y: 1, z: 1},
				{x: 10, y: 1, z: 1},
			],
		};
	}

	function createState() {
		return new GeneratorState(new Grid(), new FaceInventory())
			.setupSettings(DIFFICULTY_SETTINGS.standard)
			.setLayout(createLayout())
			.configureBoard();
	}

	it('initializes as a chainable lifecycle hook', () => {
		let rules = new GameRules();
		let state = createState();
		let tiles = new Tiles(rules, state);

		expect(tiles.initialize()).toBe(tiles);
	});

	it('creates a lower-level tile picker by default', () => {
		let rules = new GameRules();
		let state = createState();
		let tiles = new Tiles(rules, state);

		expect(tiles.rules).toBe(rules);
		expect(tiles.state).toBe(state);
		expect(tiles.tilePicker instanceof TilePicker).toBe(true);
	});

	it('selects one generated tile pair without committing it', () => {
		let rules = new GameRules();
		let state = createState();
		let tilePicker = new TilePicker(rules, state);
		let tiles = new Tiles(rules, state, tilePicker);

		spyOn(tilePicker, 'selectTileKey').and.returnValues(0, 1);

		let pair = tiles.selectGeneratedPair();

		expect(tilePicker.selectTileKey).toHaveBeenCalledTimes(2);
		expect(tilePicker.selectTileKey.calls.argsFor(0)).toEqual([[]]);
		expect(tilePicker.selectTileKey.calls.argsFor(1)).toEqual([[0]]);
		expect(pair instanceof GeneratedPair).toBe(true);
		expect(pair.tiles).toEqual([0, 1]);
		expect(state.softLinks.find({
			type: 'open-tiles',
			role: 'after-removal',
			sourceTiles: [0, 1],
		})[0].tiles).toEqual([]);
		expect(state.getPlacedTileCount()).toBe(0);
	});

	it('derives open-tile soft links from the current working board', () => {
		let rules = new GameRules();
		let state = createState();
		let tiles = new Tiles(rules, state);

		state.placeTile(0).placeTile(1).placeTile(2).placeTile(3);

		expect(tiles.getOpenSoftLinkTiles({
			removeTiles: [0, 1],
			ignoreTiles: [0, 1],
		})).toEqual([2, 3]);
		expect(state.hasTile(0)).toBe(true);
		expect(state.hasTile(1)).toBe(true);
	});

	it('allows soft-link removal and ignore options to be omitted', () => {
		let rules = new GameRules();
		let state = createState();
		let tiles = new Tiles(rules, state);

		state.placeTile(0).placeTile(1).placeTile(2).placeTile(3);

		expect(tiles.getOpenSoftLinkTiles()).toEqual([0, 1, 2, 3]);
	});

	it('records open soft links on a prepared pair', () => {
		let rules = new GameRules();
		let state = createState();
		let tiles = new Tiles(rules, state);
		let pair = new GeneratedPair({ tile1: 0, tile2: 1 });

		state.placeTile(0).placeTile(1).placeTile(2).placeTile(3);

		expect(tiles.recordSoftLinks(pair)).toBe(pair);
		expect(state.softLinks.find({
			type: 'open-tiles',
			role: 'after-removal',
			sourceTiles: [0, 1],
		})).toEqual([{
			id: 1,
			type: 'open-tiles',
			role: 'after-removal',
			sourceTiles: [0, 1],
			tiles: [2, 3],
		}]);
	});

	it('tracks unavailable tiles for reason-agnostic selection filtering', () => {
		let rules = new GameRules();
		let state = createState();
		let tiles = new Tiles(rules, state);

		expect(tiles.markTileUnavailable(1)).toBe(tiles);
		expect(tiles.markTilesUnavailable([1, 2])).toBe(tiles);
		expect(tiles.getUnavailableTiles()).toEqual([1, 2]);
		expect(tiles.isTileUnavailable(1)).toBe(true);
		expect(tiles.isTileUnavailable(3)).toBe(false);

		expect(tiles.markTileAvailable(1)).toBe(tiles);
		expect(tiles.getUnavailableTiles()).toEqual([2]);

		expect(tiles.clearUnavailableTiles()).toBe(tiles);
		expect(tiles.getUnavailableTiles()).toEqual([]);
	});

	it('selects one tile key through the lower-level picker', () => {
		let rules = new GameRules();
		let state = createState();
		let tilePicker = new TilePicker(rules, state);
		let tiles = new Tiles(rules, state, tilePicker);

		spyOn(tilePicker, 'selectTileKey').and.returnValue(2);

		expect(tiles.selectTile([0])).toBe(2);
		expect(tilePicker.selectTileKey).toHaveBeenCalledWith([0]);
	});

	it('keeps tile selection delegated to the lower-level picker', () => {
		let rules = new GameRules();
		let state = createState();
		let tilePicker = new TilePicker(rules, state);
		let tiles = new Tiles(rules, state, tilePicker);

		tiles.markTileUnavailable(1);
		spyOn(tilePicker, 'selectTileKey').and.returnValue(2);

		expect(tiles.selectTile([0])).toBe(2);
		expect(tilePicker.selectTileKey).toHaveBeenCalledWith([0]);
		expect(state.unavailableTiles).toEqual([1]);
	});

	it('ranks tile candidates through the lower-level picker', () => {
		let rules = new GameRules();
		let state = createState();
		let tilePicker = new TilePicker(rules, state);
		let tiles = new Tiles(rules, state, tilePicker);
		let rankedTiles = [{tileKey: 1, weight: 2}];

		spyOn(tilePicker, 'rankOpenTiles').and.returnValue(rankedTiles);

		expect(tiles.rankCandidates([0])).toBe(rankedTiles);
		expect(tilePicker.rankOpenTiles).toHaveBeenCalledWith([0]);
	});

	it('keeps the old scoreCandidates name as a compatibility alias', () => {
		let rules = new GameRules();
		let state = createState();
		let tilePicker = new TilePicker(rules, state);
		let tiles = new Tiles(rules, state, tilePicker);
		let rankedTiles = [{tileKey: 1, weight: 2}];

		spyOn(tiles, 'rankCandidates').and.returnValue(rankedTiles);

		expect(tiles.scoreCandidates([0])).toBe(rankedTiles);
		expect(tiles.rankCandidates).toHaveBeenCalledWith([0]);
	});

	it('selects weighted tile metadata through the lower-level picker', () => {
		let rules = new GameRules();
		let state = createState();
		let tilePicker = new TilePicker(rules, state);
		let tiles = new Tiles(rules, state, tilePicker);
		let selected = {tileKey: 3, weight: 4};

		spyOn(tilePicker, 'selectWeightedTile').and.returnValue(selected);

		expect(tiles.selectWeightedTile([1])).toBe(selected);
		expect(tilePicker.selectWeightedTile).toHaveBeenCalledWith([1]);
	});
});
