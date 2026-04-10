import Random from 'utils/random.js';
import NumberSet from 'utils/NumberSet.js';

/**
 * Use this class to explore extracting board generation from the runtime engine.
 */
export default class BoardGeneratorExperiment {
	constructor() {
		this.seasonFaceSetArray = [34, 35, 36, 37];
		this.flowerFaceSetArray = [38, 39, 40, 41];
	}

	/**
	 * Generate a board and solution for the given layout and game number.
	 *
	 * This method is only a placeholder for now so the extraction work has a
	 * concrete home.
	 *
	 * @param layout - Specify the layout that should be used to build the board.
	 * @param boardNbr - Specify the game number seed to use for generation.
	 * @returns {GeneratedBoardPayload} Return the payload that would be passed to the engine.
	 */
	generate(layout, boardNbr) {
		Random.randomize(boardNbr);

		void layout;
		void NumberSet;

		/** @type {GeneratedBoardPayload} */
		return {
			boardNbr,
			layout,
			board: null,
			solution: [],
		};
	}
}
