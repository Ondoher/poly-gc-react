import type { ReactElement } from 'react';

/**
 * Define the exported service contract for the Mahjongg controller.
 */
export interface MJControllerService {
	/**
	 * Start the controller service lifecycle.
	 */
	start(): unknown;

	/**
	 * Mark the controller as ready to serve requests.
	 */
	ready(): void;

	/**
	 * Render the Mahjongg board view.
	 */
	render(): Promise<ReactElement>;

	/**
	 * Called by the hint action when the player asks for a hint.
	 */
	hint(): void;

	/**
	 * Undo the latest move.
	 */
	undo(): void;

	/**
	 * Redo the most recent move.
	 */
	redo(): void;

	/**
	 * Called by the solve action when the controller should solve the board.
	 */
	solve(): void;

	/**
	 * Called by the play action when a board number should be started.
	 *
	 * @param boardNbr - Specify the board number to play.
	 */
	play(boardNbr: number): void;

	/**
	 * Called by tile selection when the user selects a tile.
	 *
	 * @param tile - Specify the selected tile id.
	 */
	select(tile: number): void;

	/**
	 * Called by the pause action when the paused state should change.
	 *
	 * @param on - Specify the paused state, or omit it to toggle.
	 */
	pause(on?: boolean): void;

	/**
	 * Called by the peek action when peek mode should toggle.
	 */
	peek(): void;

	/**
	 * Called by layout selection when the current layout should change.
	 *
	 * @param layout - Specify the layout name to use.
	 */
	selectLayout(layout: string): void;

	/**
	 * Called by tileset selection when the current tileset should change.
	 *
	 * @param tileset - Specify the tileset name to use.
	 */
	selectTileset(tileset: string): void;

	/**
	 * Called by tilesize selection when the current tilesize should change.
	 *
	 * @param tilesize - Specify the tilesize name to use.
	 */
	selectTilesize(tilesize: string): void;

	/**
	 * Called by the view when it has rendered and can now be used.
	 */
	initialized(): void;
}
