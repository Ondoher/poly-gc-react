import NumberSet from 'utils/NumberSet.js';

/**
 * Use this class to explore narrowing the Mahjongg engine into a pure state machine.
 */
export default class StateMachineExperiment {
	constructor() {
		this.initialState = {
			board: null,
			undoStack: [],
			redoStack: [],
			usedTiles: new NumberSet([]),
			selectedTile: -1,
		};
	}

	/**
	 * Apply an action to the current game state.
	 *
	 * This method is only a placeholder for now so the state-machine split has
	 * a concrete home.
	 *
	 * @param state - Specify the current game state.
	 * @param action - Specify the action that should be reduced into the next state.
	 * @returns A state-machine result once this experiment is implemented.
	 */
	apply(state, action) {
		return {
			state: state || this.initialState,
			action,
			derived: {},
		};
	}
}
