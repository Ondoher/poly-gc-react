
type Suit  =
	"bamboo" |
	"characters" |
	"dots" |
	"winds" |
	"dragons" |
	"seasons" |
	"flowers";

type SuitRange = number[];

type SuitSpec = {[suit: Suit]: SuitRange}



/**
 * This is the position of where a tile can be placed on the board. The board
 * is made up of virtual positions in a three dimensional grid that is 30
 * horizontal (x), 20(y) vertical and stacked 7 high (z). Each tile occupies 2
 * horizontal, 2 vertical and 1 high.
 */
type TilePosition = {
	x: number;
	y: number;
	z: number;
}

/**
 * This represents the exact positions of where tiles can be placed for a
 * specific layout. This game has only encoded the standard turtle layout, but
 * any layout with up to 144 tiles can be specified.
 */
type PositionSet = TilePosition[];

/**
 * This is the layout object
 */
type Layout = {
	id: String;
	tiles: number;
	positions: PositionSet;
}

/**
 * This is a representation of tiles that match. When tiles are drawn to be
 * placed on the board, two tiles from a single face set will be removed. There
 * are 144 tiles in a Mah Jongg set. Of those tiles each one can be matched in
 * sets of four. For instance, there will be four red dragon tiles that will
 * match with each other. A faceSet is the specific tiles within the 144 that
 * will match. There are 36 groups of four matching tiles. These are sequential
 * numbers. There is a correlation between each number and the image that will
 * be rendered on the screen.
 */
type FaceSet = {
	id: FaceGroup;
	suit: Suit;
	faces: number[];
}

/**
 * This is a reference to one set of matching faces
 */
type FaceGroup = number;

/**
 * This represents the mah jongg tiles that have not yet been placed on the
 * board. When the board is generated, pairs of tiles will be removed from this
 * pile to be placed.
 */
type DrawPile = {
	faceSets: Map<number, FaceSet>
}

/**
 * The face represents the specific tile being shown. MahJong tiles come in three
 * suites (dots, bamboo and character) numbered 1-9. Then there are the dragon
 * tiles, green white and red. There are four of each of these tiles. The winds
 * are north, south, east and west, also four of each, and there are four
 * unique flower and four unique season tiles. The wind and seasons tiles will
 * match with each other. This is an index into the possible 144 tiles
 */
type Face = number;

type FaceAvoidanceRules = {
	enabled?: boolean;
	weight?: number;
	suspensionWeight?: number;
	maxWeight?: number;
}

type FaceAssignmentRules = {
	preferredMultiplier?: number;
	easyReuseDuplicateScale?: number;
}

type GeneratedPairRecord = {
	tiles: TileKey[];
	preferredFaceGroup: FaceGroup | false;
	faceGroup?: FaceGroup | false;
	face1?: Face;
	face2?: Face;
	avoidanceTargets: TileKey[];
	avoidanceWeight: number;
}

/**
 * This represent a specific tile that has been placed on the game board
 */
type Piece = {
	pos: TilePosition;
	face: Face;
}

/**
 * This specifies which tiles have been drawn and where.
 */
type Board = {
	count: number;
	pieces: Piece[];
}

/**
 * This is an index into the pieces array of a board. The board represent the
 * current layout of the tiles and their faces
 */
type TileKey = number;

/**
 * This is a pair of tiles, usually used to describe a match
 */
type TilePair = {
	tile1: TileKey;
	tile2: TileKey;
}

/**
 * This type describes the current state of the game
 */
type GameState = {
	canUndo: Boolean;
	canRedo: Boolean;
	remaining: number;
	lost: Boolean;
	open: NumberSet;
	placed: NumberSet;
	multiUndoHistory?: MultiUndoHistoryEntry[];
	allowedTilesizes?: String[];
	maxTileSize?: String | null;
	isBelowMinimum?: Boolean;
}

type MultiUndoHistoryEntry = {
	id: string;
	moveNumber: number;
	tile1: TileKey;
	tile2: TileKey;
	face1: Face;
	face2: Face;
}

/**
 * Defines one suspended tile
 */
type Suspended = {
	/** which tile as been suspended.  */
	tile: number;

	/** the faces to assign the suspended tile and its to match when suspended */
	faces: Face[];

	/** the number of pairs placed when the suspension was created */
	placedAt: number;

	/** how more many tiles to be placed before being released */
	placementCount: number;

	/** The maximum open tiles must be available before being released. */
	openCount: number;

	/** The original pair that created this suspension. */
	originalPair?: TileKey[];

	/** The stable face-group id reserved for this suspension. */
	faceGroup: FaceGroup;
}

type pickTileOptions = {
	remove: boolean,
	useTile: number | false
}

type TilePickScore = {
	tile: TileKey;
	weight: number;
	freedCount: number;
	freedRank: number;
	openPressure: number;
	z: number;
	zWeight: number;
	zPressure: number;
	horizontalIntersections: number;
	verticalIntersections: number;
	balanceMargin: number;
	balancePressure: number;
	shortHorizonMoves: number;
	shortHorizonRemainingTiles: number;
	shortHorizonPressure: number;
	shortHorizonEnabled: boolean;
	shortHorizonCollapsed: boolean;
}

type TilePickPair = {
	tile1: TileKey;
	tile2: TileKey;
	picks: TilePickScore[];
}

type TilePickSuspensionTriple = {
	placed: TileKey[];
	suspended: TileKey;
	picks: TilePickScore[];
}

type AssignedFacePair = {
	tile1: TileKey;
	tile2: TileKey;
	faceGroup: FaceGroup;
}

type RankedFaces = {
	faceGroup: FaceGroup;
	distance: number | null;
	previousIndex: number;
	isReuse: boolean;
	availableFaces: number;
	preferred: boolean;
	sortValue: number;
}

type TilePickerOptions = {
	openTiles?: TileKey[];
	difficulty?: number;
	minWindowRatio?: number;
	highestZOrder?: number;
	horizontalMultiplier?: number;
	verticalMultiplier?: number;
	openPressureMultiplier?: number;
	maxFreedPressure?: number;
	balancePressureMultiplier?: number;
	maxBalanceMargin?: number;
	shortHorizonProbeMoves?: number;
	shortHorizonPressureMultiplier?: number;
	enforceStackBalance?: boolean;
	pendingRemovedTiles?: TileKey[];
}

type MatchType = "either" | "both"

type NumberRange = {
	min: number;
	max: number;
}

type FacePair = {
	faceGroup: FaceGroup,
	face1: Face,
	face2: Face
}

/**
 * Defines the rules for how suspension should be initiated and released
 */
type SuspensionRules = {
	/** the probability that a suspension will be attempted. A number between 0 and 1 inclusive  */
	frequency: number;

	/** the maximum number of suspended tiles allowed */
	maxSuspended: number;

	/** the maximum number of suspended tiles allowed to be active at any one time */
	maxNested: number;

	/** a suspension cannot be released until the number of tiles open to be
	 * played is below this threshold. This is a range, the value cor each suspension will
	 * be chosen in a normal distribution  */
	maxOpenCount: NumberRange;

	/** How many tiles to play before releasing suspension, specified as a range.
	 * During suspension a normalized random value will be chosen within this range */
	placementCount: NumberRange;

	/** defines how the release conditions must be met */
	matchType: MatchType;

	/** force release a suspension when effective open tiles falls below this value */
	forceReleaseAtEffectiveOpen: number;

	/** allow starting a suspension only when effective open tiles is at least this value */
	suspendAtEffectiveOpen: number;
}

type ToRelease = {
	pair: Face[] | false;
	tile: number | false;
}

/**
 * This event is fired when the state of the game has changed
 *
 * @event updateState
 * @type {GameState}
 */

/**
 * This event is fired when the game should remove a tile from the board
 *
 * @event removeTile
 * @type {TileKey}
 */

/**
 * This event is fired when the game should add a tile to the board
 *
 * @event addTile
 * @type {TileKey}
 */

/**
 * This event is fired when there is a new game board
 *
 * @event newBoard
 * @type {Board}
 */
