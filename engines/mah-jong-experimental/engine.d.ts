export interface GridPoint {
	x: number;
	y: number;
	z: number;
}

export interface GridBox extends GridPoint {
	width?: number;
	height?: number;
	depth?: number;
}

export interface GridData {
	occupied: NumberSet[][];
}

export interface MjGameState {
	boardNbr: number;
	layout: Layout | null;
	grid: GridData | null;
	board: Board | null;
	solution: TileKey[];
	placedTiles: NumberSet;
}

export interface MjRuntimeState {
	gameState: MjGameState | null;
	undoStack: TilePair[];
	redoStack: TilePair[];
	selectedTileKey: number;
}

export interface MjDerivedState {
	canUndo: boolean;
	canRedo: boolean;
	remaining: number;
	won: boolean;
	lost: boolean;
	open: NumberSet;
	played: NumberSet;
}

export interface GeneratedGamePayload {
	gameState: MjGameState;
	solution: TileKey[];
}
