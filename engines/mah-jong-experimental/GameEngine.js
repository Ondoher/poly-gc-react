import NumberSet from '../../src/gc/utils/NumberSet.js';
import GameRules from './GameRules.js';

/**
 * Use this class to explore narrowing the Mahjongg engine into a pure runtime
 * state machine layered on top of game state and rules.
 */
export default class GameEngine {
	/**
	 * Create a runtime engine layered on top of game state and rules.
	 *
	 * @param {GameRules} [rules=new GameRules()]
	 */
	constructor(rules = new GameRules()) {
		this.rules = rules;

		this.initialState = {
			gameState: null,
			undoStack: [],
			redoStack: [],
			selectedTileKey: -1,
		};
	}

	/**
	 * Return the active game state from a runtime state snapshot.
	 *
	 * @param {MjRuntimeState} [state=this.initialState]
	 * @returns {GameState | null}
	 */
	getGameState(state = this.initialState) {
		return state.gameState;
	}

	/**
	 * Return the currently selected tile id.
	 *
	 * @param {MjRuntimeState} [state=this.initialState]
	 * @returns {number}
	 */
	getSelectedTile(state = this.initialState) {
		return state.selectedTileKey;
	}

	/**
	 * Check whether the runtime state can undo a move.
	 *
	 * @param {MjRuntimeState} [state=this.initialState]
	 * @returns {boolean}
	 */
	canUndo(state = this.initialState) {
		return state.undoStack.length > 0;
	}

	/**
	 * Check whether the runtime state can redo a move.
	 *
	 * @param {MjRuntimeState} [state=this.initialState]
	 * @returns {boolean}
	 */
	canRedo(state = this.initialState) {
		return state.redoStack.length > 0;
	}

	/**
	 * Return derived runtime state for UI or controller consumption.
	 *
	 * @param {MjRuntimeState} [state=this.initialState]
	 * @returns {MjDerivedState}
	 */
	getDerivedState(state = this.initialState) {
		let gameState = state.gameState;
		let openTileKeys = gameState ? this.rules.getOpenTiles(gameState) : [];
		let placed = gameState?.placedTiles
			? new NumberSet([]).union(gameState.placedTiles)
			: new NumberSet([]);

		return {
			canUndo: this.canUndo(state),
			canRedo: this.canRedo(state),
			remaining: gameState ? gameState.getPlacedTileCount() : 0,
			won: gameState ? this.rules.isWon(gameState) : false,
			lost: gameState ? this.rules.isLost(gameState) : false,
			open: new NumberSet(openTileKeys),
			played: placed,
		};
	}

	/**
	 * Load a generated game state into the runtime engine.
	 *
	 * @param {GameState} gameState
	 * @returns {MjRuntimeState}
	 */
	load(gameState) {
		this.initialState = {
			gameState,
			undoStack: [],
			redoStack: [],
			selectedTileKey: -1,
		};

		return this.initialState;
	}

	/**
	 * Attempt to play a pair of tiles.
	 *
	 * @param {TileKey} tile1
	 * @param {TileKey} tile2
	 * @param {MjRuntimeState} [state=this.initialState]
	 * @returns {MjRuntimeState}
	 */
	playTiles(tile1, tile2, state = this.initialState) {
		let gameState = state.gameState;

		if (!gameState || !this.rules.isPlayablePair(gameState, tile1, tile2)) {
			return state;
		}

		gameState.removeTile(tile1);
		gameState.removeTile(tile2);
		state.undoStack.push({tile1, tile2});
		state.redoStack = [];
		state.selectedTileKey = -1;

		return state;
	}

	/**
	 * Undo the most recent played move.
	 *
	 * @param {MjRuntimeState} [state=this.initialState]
	 * @returns {MjRuntimeState}
	 */
	undo(state = this.initialState) {
		let move = state.undoStack.pop();

		if (!move || !state.gameState) {
			return state;
		}

		state.gameState.placeTile(move.tile1);
		state.gameState.placeTile(move.tile2);
		state.redoStack.push(move);

		return state;
	}

	/**
	 * Redo the most recently undone move.
	 *
	 * @param {MjRuntimeState} [state=this.initialState]
	 * @returns {MjRuntimeState}
	 */
	redo(state = this.initialState) {
		let move = state.redoStack.pop();

		if (!move || !state.gameState) {
			return state;
		}

		state.gameState.removeTile(move.tile1);
		state.gameState.removeTile(move.tile2);
		state.undoStack.push(move);

		return state;
	}

	/**
	 * Select one tile in the current runtime state.
	 *
	 * @param {TileKey} tileKey
	 * @param {MjRuntimeState} [state=this.initialState]
	 * @returns {MjRuntimeState}
	 */
	selectTile(tileKey, state = this.initialState) {
		state.selectedTileKey = tileKey;
		return state;
	}

	/**
	 * Clear any current tile selection.
	 *
	 * @param {MjRuntimeState} [state=this.initialState]
	 * @returns {MjRuntimeState}
	 */
	clearSelection(state = this.initialState) {
		state.selectedTileKey = -1;
		return state;
	}

	/**
	 * Package a state snapshot, an action, and derived values together.
	 *
	 * @param {MjRuntimeState | null} state
	 * @param {unknown} action
	 * @returns {{state: MjRuntimeState, action: unknown, derived: MjDerivedState}}
	 */
	apply(state, action) {
		state = state || this.initialState;

		return {
			state,
			action,
			derived: this.getDerivedState(state),
		};
	}
}
