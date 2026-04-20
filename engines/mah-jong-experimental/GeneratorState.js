import FaceInventory from "./FaceInventory";
import GameState from "./GameState";
import Grid from "./Grid";

export class GeneratorState extends GameState {
	/**
	 *
	 * @param {Grid} grid
	 * @param {FaceInventory} faceInventory
	 */
	constructor(grid, faceInventory) {
		super(grid);

		this._faceInventory = faceInventory;

		/** @type {SuspensionRules} */
		this.suspensionRules = {
			frequency: 0
		}

		/** @type {number} */
		this._difficulty = 0.5;

		/** @type {TilePickerOptions} */
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
	}

	setupSuspensionRules(rules) {
		this.suspensionRules = rules;
		this.configureBoard();
	}

	setupDifficulty(difficulty = 0.5) {
		this._difficulty = Math.max(0, Math.min(1, difficulty));
	}

	setupTilePickerRules(rules = {}) {
		this.tilePickerRules = rules;
	}

	setupFaceAvoidanceRules(rules = {}) {
		this.faceAvoidanceRules = {
			...this.faceAvoidanceRules,
			...rules,
		};
	}

	setupFaceAssignmentRules(rules = {}) {
		this.faceAssignmentRules = {
			...this.faceAssignmentRules,
			...rules,
		};
	}

	/** @type {FaceInventory} */
	get faceInventory() {
		return this._faceInventory;
	}

	/**
	 *
	 * @param {DifficultyOptions} options
	 */
	difficulty(options) {
		return options.difficulty ?? this._difficulty;
	}


	/**
	 * Collapse generator settings, per-call overrides, and default picker values
	 * into one resolved options object.
	 *
	 * @param {object} [options={}]
	 * @returns {{
	 * 	difficulty: number,
	 * 	minWindowRatio: number,
	 * 	highestZOrder: number,
	 * 	horizontalMultiplier: number,
	 * 	depthMultiplier: number,
	 * 	openPressureMultiplier: number,
	 * 	maxFreedPressure: number,
	 * 	balancePressureMultiplier: number,
	 * 	maxBalanceMargin: number,
	 * 	shortHorizonProbeMoves: number,
	 * 	shortHorizonPressureMultiplier: number,
	 * 	pendingRemovedTileKeys: TileKey[],
	 * }}
	 */
	collapseOptions(options = {}) {
		let tilePickerRules = this.settings?.tilePickerRules || {};
		let difficulty = options.difficulty
			?? this.settings?.generationDifficulty
			?? 0.5;
		let resolved = {
			...tilePickerRules,
			...options,
			difficulty,
			minWindowRatio: options.minWindowRatio ?? 0.25,
			highestZOrder: options.highestZOrder
				?? tilePickerRules.highestZOrder
				?? this.gameState.getGridHeight(),
			horizontalMultiplier: options.horizontalMultiplier
				?? tilePickerRules.horizontalMultiplier
				?? 2,
			depthMultiplier: options.depthMultiplier
				?? options.verticalMultiplier
				?? tilePickerRules.depthMultiplier
				?? tilePickerRules.verticalMultiplier
				?? 4,
			openPressureMultiplier: options.openPressureMultiplier
				?? tilePickerRules.openPressureMultiplier
				?? Math.max(0, (difficulty - 0.5) * 2),
			maxFreedPressure: options.maxFreedPressure
				?? tilePickerRules.maxFreedPressure
				?? 6,
			balancePressureMultiplier: options.balancePressureMultiplier
				?? tilePickerRules.balancePressureMultiplier
				?? Math.max(0, (difficulty - 0.5) * 2),
			maxBalanceMargin: options.maxBalanceMargin
				?? tilePickerRules.maxBalanceMargin
				?? 8,
			shortHorizonProbeMoves: options.shortHorizonProbeMoves
				?? tilePickerRules.shortHorizonProbeMoves
				?? 0,
			shortHorizonPressureMultiplier: options.shortHorizonPressureMultiplier
				?? tilePickerRules.shortHorizonPressureMultiplier
				?? 0,
			pendingRemovedTileKeys: options.pendingRemovedTileKeys || [],
		};

		return resolved;
	}


}
