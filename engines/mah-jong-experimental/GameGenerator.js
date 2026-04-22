import Random from '../../src/gc/utils/random.js';
import Grid from './Grid.js';
import { GeneratorState } from './GeneratorState.js';
import GameRules from './GameRules.js';
import Faces from './Faces.js';
import Suspensions from './Suspensions.js';
import Tiles from './Tiles.js';
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
		 * @type {GeneratorState | null}
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
		 * Face-domain orchestrator used to initialize and assign generated faces.
		 *
		 * @type {Faces | null}
		 */
		this.faces = null;

		/**
		 * Tile-domain orchestrator used to select structural pairs.
		 *
		 * @type {Tiles | null}
		 */
		this.tiles = null;

		/**
		 * Suspension policy orchestrator used for delayed-match generation.
		 *
		 * This is currently wired as an infrastructure seam only. Active
		 * generation still uses the normal prepared-pair path.
		 *
		 * @type {Suspensions | null}
		 */
		this.suspensions = null;

		/**
		 * Fallback prepared-pair collection before a generation state exists.
		 *
		 * During an active run, `preparedPairs` is owned by `GeneratorState` because
		 * it is generation-only metadata rather than playable game state.
		 *
		 * @type {GeneratedPair[]}
		 */
		this._preparedPairs = [];

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
	 * Prepared generated tile pairs in removal order.
	 *
	 * @type {GeneratedPair[]}
	 */
	get preparedPairs() {
		return this.gameState?.preparedPairs ?? this._preparedPairs;
	}

	/**
	 * @param {GeneratedPair[]} preparedPairs
	 */
	set preparedPairs(preparedPairs) {
		if (this.gameState) {
			this.gameState.preparedPairs = preparedPairs;
			return;
		}

		this._preparedPairs = preparedPairs;
	}

	/**
	 * Backward-compatible alias for the older pair-set property name.
	 *
	 * @type {GeneratedPair[]}
	 */
	get pairSet() {
		return this.preparedPairs;
	}

	/**
	 * @param {GeneratedPair[]} pairSet
	 */
	set pairSet(pairSet) {
		this.preparedPairs = pairSet;
	}

	/**
	 * Backward-compatible alias for the older pair collection property name.
	 *
	 * @type {GeneratedPair[]}
	 */
	get pairs() {
		return this.preparedPairs;
	}

	/**
	 * @param {GeneratedPair[]} pairs
	 */
	set pairs(pairs) {
		this.preparedPairs = pairs;
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
	 * @returns {GeneratorState}
	 */
	createGameState(layout, boardNbr) {
		let gameState = new GeneratorState(this.createGrid());

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
	 * @param {GeneratorState} gameState
	 * @param {DifficultySettings} settings
	 * @returns {void}
	 */
	initializeState(gameState, settings) {
		gameState.setupSettings(settings);

		this.gameState = gameState;
		this.settings = settings;
		this.initializeTiles();
		this.initializeFaces();
		this.initializeSuspensions();
		this.gameState.resetGenerationRecords();
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
	 * Initialize structural tile-selection orchestration.
	 *
	 * @returns {void}
	 */
	initializeTiles() {
		this.tiles = new Tiles(this.rules, this.gameState).initialize();
	}

	/**
	 * Initialize face-related generator state before structural generation.
	 *
	 * @returns {void}
	 */
	initializeFaces() {
		this.faces = new Faces(this.gameState).initialize();
	}

	/**
	 * Initialize cross-domain suspension orchestration.
	 *
	 * @returns {void}
	 */
	initializeSuspensions() {
		this.suspensions = new Suspensions({
			state: this.gameState,
			tiles: this.tiles,
			faces: this.faces,
		}).initialize();
	}

	/**
	 * Backward-compatible alias for the older face-initialization stage name.
	 *
	 * @returns {void}
	 */
	shuffleTiles() {
		this.initializeFaces();
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
	 * Select one generated tile pair from the current open board.
	 *
	 * @returns {GeneratedPair}
	 */
	pickGeneratedPair() {
		return this.tiles.selectGeneratedPair();
	}

	/**
	 * Run one prepared-pair generation step and commit its selected pair.
	 *
	 * Suspension policy gets the first chance to act. When it has nothing to do,
	 * generation falls back to normal structural tile-pair selection.
	 *
	 * @returns {void}
	 */
	preparePair() {
		let pair = this.suspensions.step();

		if (!pair) {
			pair = this.pickGeneratedPair();
		}

		if (!pair) {
			throw new Error('Generation step did not return a pair');
		}

		this.commitGeneratedPair(pair);
	}

	/**
	 * Backward-compatible alias for the older placement-step name.
	 *
	 * @returns {void}
	 */
	placeGeneratedPair() {
		this.preparePair();
	}

	/**
	 * Prepare generated tile pairs before deferred face assignment.
	 *
	 * The layout defines tile slots. Prepared tile pairs define the committed matching
	 * relationships and removal order for those slots. Generation runs backward
	 * from a fully occupied working board, so each selected tile pair is
	 * committed and removed from the temporary board while solution metadata is
	 * recorded.
	 *
	 * @returns {void}
	 */
	preparePairs() {
		this.occupyAllTiles();

		let steps = Math.floor(this.gameState.getBoardCount() / 2);

		for (let step = 0; step < steps; step++) {
			this.preparePair();
		}
	}

	/**
	 * Backward-compatible alias for the older prepared-pairs stage name.
	 *
	 * @returns {void}
	 */
	generatePairSet() {
		this.preparePairs();
	}

	/**
	 * Backward-compatible alias for the older structural-stage name.
	 *
	 * @returns {void}
	 */
	buildBoardStructure() {
		this.preparePairs();
	}

	/**
	 * Commit a selected generated tile pair as the next solution step.
	 *
	 * Generation works backward from a full board, so committing the tile pair
	 * records it in solution order and removes its tiles from the temporary
	 * working board.
	 *
	 * @param {GeneratedPair} pair
	 * @returns {void}
	 */
	commitGeneratedPair(pair) {
		this.gameState.addPreparedPair(pair);
		this.solution.push(pair.tile1, pair.tile2);
		this.gameState.removeTile(pair.tile1);
		this.gameState.removeTile(pair.tile2);
	}

	/**
	 * Backward-compatible alias for the older board-mutation-oriented name.
	 *
	 * @param {GeneratedPair} pair
	 * @returns {void}
	 */
	removeGeneratedPair(pair) {
		this.commitGeneratedPair(pair);
	}

	/**
	 * Assign one selected face pair to a prepared tile pair, making it an
	 * assigned pair.
	 *
	 * `GameGenerator` keeps the stage seam, while `Faces` owns the lower-level
	 * ranking, inventory selection, state mutation, and avoidance bookkeeping.
	 *
	 * @param {GeneratedPair} pair
	 * @returns {void}
	 */
	assignFacesToPair(pair) {
		this.faces.assignFacesToPair(pair);
	}

	/**
	 * Assign face pairs to every prepared tile pair.
	 *
	 * After this stage, the prepared pairs have become assigned pairs and the
	 * generated board has concrete faces.
	 *
	 * @returns {void}
	 */
	assignFacesToPreparedPairs() {
		this.faces.assignFacesToPreparedPairs(this.preparedPairs);

		this.gameState.setSolution(this.solution);
	}

	/**
	 * Backward-compatible alias for the older face-assignment stage name.
	 *
	 * @returns {void}
	 */
	assignFacesToPairSet() {
		this.assignFacesToPreparedPairs();
	}

	/**
	 * Backward-compatible alias for the older deferred-face stage name.
	 *
	 * @returns {void}
	 */
	assignDeferredFaces() {
		this.assignFacesToPreparedPairs();
	}

	/**
	 * Backward-compatible alias for the older face-assignment stage name.
	 *
	 * @returns {void}
	 */
	fillInRemainingFaces() {
		this.assignFacesToPreparedPairs();
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
	 * @returns {GeneratorPayload}
	 */
	generate(layout, boardNbr, parameters = { difficulty: DIFFICULTY_LEVELS.standard }) {
		Random.randomize(boardNbr);
		let settings = this.resolveSettings(parameters);
		let gameState = this.createGameState(layout, boardNbr);

		this.rules = this.createGameRules();
		this.initializeState(gameState, settings);
		this.initializeGeneration();
		this.preparePairs();
		this.assignFacesToPreparedPairs();
		this.restoreBoardForPlay();

		return {
			gameState,
			solution: this.solution,
		};
	}
}
