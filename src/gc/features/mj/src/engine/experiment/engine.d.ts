/**
 * Describe the position of a placeable tile on the Mahjongg grid.
 */
export interface TilePosition {
	/**
	 * Identify the horizontal grid coordinate of the tile.
	 */
	x: number;

	/**
	 * Identify the vertical grid coordinate of the tile.
	 */
	y: number;

	/**
	 * Identify the depth layer of the tile.
	 */
	z: number;
}

/**
 * Describe the set of tile positions that make up a layout.
 */
export type PositionSet = TilePosition[];

/**
 * Describe the internal engine state required to process rules and state
 * transitions.
 */
export interface MjEngineInternalState {
	/**
	 * Identify the game number seed for the current game.
	 */
	boardNbr: number;

	/**
	 * Identify the current layout blueprint.
	 */
	layout: Layout | null;

	/**
	 * Hold the generated board for the active game.
	 */
	board: Board | null;

	/**
	 * Hold one guaranteed solution for the generated board.
	 */
	solution: Tile[];

	/**
	 * Track which tiles are still occupying the board.
	 */
	usedTiles: NumberSet;

	/**
	 * Track which logical grid spaces are occupied.
	 */
	usedSpaces: NumberSet[][];

	/**
	 * Track which tiles are currently selectable.
	 */
	selectableTiles: NumberSet;

	/**
	 * Track the tiles that are currently playable.
	 */
	playableTiles: Tile[];

	/**
	 * Track the number of tiles remaining on the board.
	 */
	tileCount: number;

	/**
	 * Track the move history for undo.
	 */
	undoStack: Tile[];

	/**
	 * Track the move history for redo.
	 */
	redoStack: Tile[];
}

/**
 * Describe the externally consumable game state derived from the internal
 * engine state.
 */
export interface MjEngineExternalState {
	/**
	 * Report whether the current state can undo a move.
	 */
	canUndo: boolean;

	/**
	 * Report whether the current state can redo a move.
	 */
	canRedo: boolean;

	/**
	 * Report how many tiles remain on the board.
	 */
	remaining: number;

	/**
	 * Report whether the board has been cleared.
	 */
	won: boolean;

	/**
	 * Report whether no more moves are available.
	 */
	lost: boolean;

	/**
	 * Expose which tiles are currently open for play.
	 */
	open: NumberSet;

	/**
	 * Expose which tiles are still present on the board.
	 */
	played: NumberSet;
}

/**
 * Describe the payload a board generator passes to the runtime engine after
 * building a solvable board.
 */
export interface GeneratedBoardPayload {
	/**
	 * Identify the game number seed used to generate the board.
	 */
	boardNbr: number;

	/**
	 * Identify the layout used during board generation.
	 */
	layout: Layout;

	/**
	 * Hold the generated board with positioned pieces and assigned faces.
	 */
	board: Board | null;

	/**
	 * Hold one guaranteed solution in placement order.
	 */
	solution: Tile[];
}
