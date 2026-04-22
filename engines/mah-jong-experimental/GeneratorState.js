import GameState from "./GameState.js";
import Grid from "./Grid.js";
import SoftLinks from "./SoftLinks.js";

export class GeneratorState extends GameState {
	/**
	 *
	 * @param {Grid} grid
	 * @param {FaceInventory} faceInventory
	 */
	constructor(grid, faceInventory = null) {
		super(grid);

		this._faceInventory = faceInventory;

		/** @type {SuspensionRules | null} */
		this.suspensionRules = null;

		/** @type {number} */
		this._difficulty = 0.5;

		/** @type {DifficultySettings | null} */
		this.settings = null;

		/** @type {TilePickerRules} */
		this.tilePickerRules = {};

		/** @type {FaceAvoidanceRules} */
		this.faceAvoidanceRules = {
			enabled: false,
			weight: 1,
			suspensionWeight: 3,
			maxWeight: 8,
		};

		/** @type {FaceAssignmentRules} */
		this.faceAssignmentRules = {
			preferredMultiplier: 0.5,
			easyReuseDuplicateScale: 0,
		};

		/**
		 * Prepared tile pairs selected during generation.
		 *
		 * These records are generation-only metadata. They are needed while faces
		 * are assigned, but they are not part of the playable game state after the
		 * board has been generated.
		 *
		 * @type {GeneratedPair[]}
		 */
		this.preparedPairs = [];

		/**
		 * Active suspended generation records.
		 *
		 * Suspension is not implemented in the current simplified generator, but
		 * the collection belongs here because it is generation-run metadata.
		 *
		 * @type {TileSuspension[]}
		 */
		this.suspended = [];

		/**
		 * Tile keys temporarily unavailable for tile selection.
		 *
		 * This is reason-agnostic generation metadata. Suspension policy can hold
		 * a tile without leaking suspension knowledge into the tile picker.
		 *
		 * @type {TileKey[]}
		 */
		this.unavailableTiles = [];

		/**
		 * Non-structural conceptual links created during generation.
		 *
		 * The records live on generator state so multiple domains can create and
		 * consume them without becoming directly coupled.
		 *
		 * @type {SoftLink[]}
		 */
		this.softLinkRecords = [];

		/** @type {number} */
		this.nextSoftLinkId = 1;

		/**
		 * Registry helper for creating and querying soft-link records.
		 *
		 * @type {SoftLinks}
		 */
		this.softLinks = new SoftLinks(this);
	}

	/**
	 * Reset generation-only record collections for a new generator run.
	 *
	 * @returns {GeneratorState}
	 */
	resetGenerationRecords() {
		this.preparedPairs = [];
		this.suspended = [];
		this.unavailableTiles = [];
		this.softLinkRecords = [];
		this.nextSoftLinkId = 1;
		return this;
	}

	/**
	 * Store one prepared tile pair for later face assignment.
	 *
	 * @param {GeneratedPair} pair
	 * @returns {GeneratedPair}
	 */
	addPreparedPair(pair) {
		this.preparedPairs.push(pair);
		return pair;
	}

	/**
	 * Store the face inventory owned by the `Faces` domain orchestrator.
	 *
	 * @param {FaceInventory} faceInventory
	 * @returns {GeneratorState}
	 */
	setFaceInventory(faceInventory) {
		this._faceInventory = faceInventory;
		return this;
	}

	/**
	 * Store one suspended record for later release.
	 *
	 * @param {TileSuspension} suspension
	 * @returns {TileSuspension}
	 */
	addSuspension(suspension) {
		this.suspended.push(suspension);
		return suspension;
	}

	/**
	 * @param {SuspensionRules | null} rules
	 * @returns {GeneratorState}
	 */
	setupSuspensionRules(rules = null) {
		this.suspensionRules = rules;
		return this;
	}

	/**
	 * @param {number} [difficulty=0.5]
	 * @returns {GeneratorState}
	 */
	setupDifficulty(difficulty = 0.5) {
		this._difficulty = Math.max(0, Math.min(1, difficulty));
		return this;
	}

	/**
	 * @param {TilePickerRules} [rules={}]
	 * @returns {GeneratorState}
	 */
	setupTilePickerRules(rules = {}) {
		this.tilePickerRules = rules;
		return this;
	}

	/**
	 * Store resolved generator settings and copy the rule groups that generator
	 * collaborators consume through this shared state object.
	 *
	 * @param {DifficultySettings} settings
	 * @returns {GeneratorState}
	 */
	setupSettings(settings) {
		this.settings = settings;

		if (settings?.generationDifficulty !== undefined) {
			this.setupDifficulty(settings.generationDifficulty);
		}

		if (settings?.suspensionRules !== undefined) {
			this.setupSuspensionRules(settings.suspensionRules);
		}

		this.setupTilePickerRules(settings?.tilePickerRules || {});
		this.setupFaceAvoidanceRules(settings?.faceAvoidanceRules || {});
		this.setupFaceAssignmentRules(settings?.faceAssignmentRules || {});

		return this;
	}

	/**
	 * @param {FaceAvoidanceRules} [rules={}]
	 * @returns {GeneratorState}
	 */
	setupFaceAvoidanceRules(rules = {}) {
		this.faceAvoidanceRules = {
			...this.faceAvoidanceRules,
			...rules,
		};
		return this;
	}

	/**
	 * @param {FaceAssignmentRules} [rules={}]
	 * @returns {GeneratorState}
	 */
	setupFaceAssignmentRules(rules = {}) {
		this.faceAssignmentRules = {
			...this.faceAssignmentRules,
			...rules,
		};
		return this;
	}

	/** @type {FaceInventory} */
	get faceInventory() {
		return this._faceInventory;
	}

	/**
	 *
	 * @returns {number}
	 */
	difficulty() {
		return this._difficulty;
	}

	/**
	 * @returns {number}
	 */
	getMinWindowRatio() {
		return this.tilePickerRules.minWindowRatio ?? 0.25;
	}

	/**
	 * @returns {number}
	 */
	getHighestZOrder() {
		return this.tilePickerRules.highestZOrder ?? this.getGridHeight();
	}

	/**
	 * @returns {number}
	 */
	getHorizontalMultiplier() {
		return this.tilePickerRules.horizontalMultiplier ?? 2;
	}

	/**
	 * @returns {number}
	 */
	getDepthMultiplier() {
		return this.tilePickerRules.depthMultiplier
			?? this.tilePickerRules.verticalMultiplier
			?? 4;
	}

	/**
	 * @returns {number}
	 */
	getOpenPressureMultiplier() {
		return this.tilePickerRules.openPressureMultiplier
			?? Math.max(0, (this.difficulty() - 0.5) * 2);
	}

	/**
	 * @returns {number}
	 */
	getMaxFreedPressure() {
		return this.tilePickerRules.maxFreedPressure ?? 6;
	}

	/**
	 * @returns {number}
	 */
	getBalancePressureMultiplier() {
		return this.tilePickerRules.balancePressureMultiplier
			?? Math.max(0, (this.difficulty() - 0.5) * 2);
	}

	/**
	 * @returns {number}
	 */
	getMaxBalanceMargin() {
		return this.tilePickerRules.maxBalanceMargin ?? 8;
	}

	/**
	 * @returns {number}
	 */
	getShortHorizonProbeMoves() {
		return this.tilePickerRules.shortHorizonProbeMoves ?? 0;
	}

	/**
	 * @returns {number}
	 */
	getShortHorizonPressureMultiplier() {
		return this.tilePickerRules.shortHorizonPressureMultiplier ?? 0;
	}

}
