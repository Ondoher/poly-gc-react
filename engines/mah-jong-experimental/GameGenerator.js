import Random from '../../src/gc/utils/random.js';
import Grid from './Grid.js';
import GameState from './GameState.js';
import GameRules from './GameRules.js';
import FaceInventory from './FaceInventory.js';
import TilePicker from './TilePicker.js';
import { DIFFICULTY_LEVELS, resolveDifficultySettings } from './difficulty-settings.js';

/**
 * Use this class to explore extracting Mahjongg board generation from the
 * runtime engine.
 */
export default class GameGenerator {
	/**
	 * Create a generator with its own rules helper.
	 *
	 * @param {GameRules} [rules=new GameRules()]
	 */
	constructor(rules = new GameRules()) {
		/**
		 * Rules helper used to evaluate the working game state during generation.
		 *
		 * @type {GameRules}
		 */
		this.rules = rules;

		/**
		 * Stable face ids for the season face set.
		 *
		 * @type {Face[]}
		 */
		this.seasonFaceSetArray = [34, 35, 36, 37];

		/**
		 * Stable face ids for the flower face set.
		 *
		 * @type {Face[]}
		 */
		this.flowerFaceSetArray = [38, 39, 40, 41];

		/**
		 * The working game state for the current generation run.
		 *
		 * This is `null` until `generate()` initializes a fresh run.
		 *
		 * @type {GameState | null}
		 */
		this.gameState = null;

		/**
		 * Fully resolved difficulty settings for the current generation run.
		 *
		 * This is `null` until `generate()` resolves one difficulty preset and any
		 * optional overrides.
		 *
		 * @type {DifficultySettings | null}
		 */
		this.settings = null;

		/**
		 * Generation-time face inventory used to draw matching face pairs.
		 *
		 * @type {FaceInventory}
		 */
		this.faceInventory = new FaceInventory();

		/**
		 * Tile picker used to choose structural pairs from the current open board.
		 *
		 * @type {TilePicker | null}
		 */
		this.tilePicker = null;

		/**
		 * Generated structural pairs in authored removal order.
		 *
		 * Each record uses board-local tile keys and is later assigned faces by the
		 * face inventory.
		 *
		 * @type {TilePair[]}
		 */
		this.pairs = [];

		/**
		 * Active suspended generation records.
		 *
		 * Suspension is not implemented in the current simplified generator, but the
		 * property is kept here because it is part of the intended end-state
		 * generator model.
		 *
		 * @type {Suspended[]}
		 */
		this.suspended = [];

		/**
		 * One known valid generated removal path expressed as tile keys.
		 *
		 * The solution is recorded in removal order while the generator authors the
		 * board backward, then returned to the caller as generation metadata.
		 *
		 * @type {TileKey[]}
		 */
		this.solution = [];
	}

	/**
	 * Create the occupancy grid used for generated game state.
	 *
	 * @returns {Grid}
	 */
	createGrid() {
		return new Grid();
	}

	/**
	 * Create and initialize a fresh game state for generation.
	 *
	 * @param {Layout} layout
	 * @param {number} boardNbr
	 * @returns {GameState}
	 */
	createGameState(layout, boardNbr) {
		let gameState = new GameState(this.createGrid());

		gameState
			.setBoardNbr(boardNbr)
			.setLayout(layout)
			.configureBoard();

		return gameState;
	}

	/**
	 * Create a rules helper for generator-side state evaluation.
	 *
	 * @returns {GameRules}
	 */
	createGameRules() {
		return new GameRules();
	}

	/**
	 * Resolve the full generator settings bundle for one generate call.
	 *
	 * @param {GenerateParameters} [parameters]
	 * @returns {DifficultySettings}
	 */
	resolveSettings(parameters = { difficulty: DIFFICULTY_LEVELS.standard }) {
		return resolveDifficultySettings(parameters);
	}

	/**
	 * Reset per-generation working state on this generator instance.
	 *
	 * @param {GameState} gameState
	 * @param {DifficultySettings} settings
	 * @returns {void}
	 */
	initializeState(gameState, settings) {
		this.gameState = gameState;
		this.settings = settings;
		this.faceInventory.clear();
		this.tilePicker = new TilePicker(this.rules, this.gameState, this.settings);
		this.pairs = [];
		this.suspended = [];
		this.solution = [];
	}

	/**
	 * Initialize generation-only working state before tile removal begins.
	 *
	 * @returns {void}
	 */
	initializeGeneration() {
	}

	/**
	 * Populate the face inventory used during generation.
	 *
	 * @returns {void}
	 */
	shuffleTiles() {
		this.faceInventory.initializeSimplePairs(this.gameState.getBoardCount());
	}

	/**
	 * Occupy every tile slot so generation can author the board backward.
	 *
	 * @returns {void}
	 */
	occupyAllTiles() {
		for (let tileKey = 0; tileKey < this.gameState.getBoardCount(); tileKey++) {
			this.gameState.placeTile(tileKey);
		}
	}

	/**
	 * Remove one generated pair or suspension step from the full board.
	 *
	 * @returns {void}
	 */
	placeGeneratedPair() {
		let tileKey1 = this.tilePicker.pickTile();
		let tileKey2 = this.tilePicker.pickTile([tileKey1]);

		this.removeGeneratedPair(tileKey1, tileKey2);
	}

	/**
	 * Remove one generated pair from the working full board and record it.
	 *
	 * @param {TileKey} tileKey1
	 * @param {TileKey} tileKey2
	 * @returns {void}
	 */
	removeGeneratedPair(tileKey1, tileKey2) {
		this.pairs.push({ tile1: tileKey1, tile2: tileKey2 });
		this.solution.push(tileKey1, tileKey2);
		this.gameState.removeTile(tileKey1);
		this.gameState.removeTile(tileKey2);
	}

	/**
	 * Resolve any deferred face assignment after structural generation is done.
	 *
	 * @returns {void}
	 */
	fillInRemainingFaces() {
		this.pairs.forEach((pair) => {
			let facePair = this.faceInventory.drawPair();

			if (!facePair) {
				throw new Error('Ran out of face pairs during generation');
			}

			this.gameState.setFace(pair.tile1, facePair.face1);
			this.gameState.setFace(pair.tile2, facePair.face2);
		});

		this.gameState.setSolution(this.solution);
	}

	/**
	 * Restore final board occupancy for runtime play after backward generation.
	 *
	 * @returns {void}
	 */
	restoreBoardForPlay() {
		if (this.gameState.grid) {
			this.gameState.grid.clear();
		}

		this.occupyAllTiles();
	}

	/**
	 * Generate a new game payload.
	 *
	 * @param {Layout} layout
	 * @param {number} boardNbr
	 * @param {GenerateParameters} [parameters={ difficulty: 'standard' }]
	 * @returns {{gameState: GameState, solution: TileKey[]}}
	 */
	generate(layout, boardNbr, parameters = { difficulty: DIFFICULTY_LEVELS.standard }) {
		Random.randomize(boardNbr);
		let settings = this.resolveSettings(parameters);
		let gameState = this.createGameState(layout, boardNbr);
		let steps = Math.floor(gameState.getBoardCount() / 2);

		this.rules = this.createGameRules();
		this.initializeState(gameState, settings);
		this.initializeGeneration();
		this.shuffleTiles();
		this.occupyAllTiles();

		for (let step = 0; step < steps; step++) {
			this.placeGeneratedPair();
		}

		this.fillInRemainingFaces();
		this.restoreBoardForPlay();

		return {
			gameState,
			solution: this.solution,
		};
	}
}
