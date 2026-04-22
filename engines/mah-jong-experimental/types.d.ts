/**
 * A single occupied coordinate in the generator's sparse 3D grid.
 */
interface GridPoint {
	/** Horizontal grid coordinate. */
	x: number;

	/** Vertical grid coordinate. */
	y: number;

	/** Stack depth coordinate. */
	z: number;
}

/**
 * A rectangular 3D grid region anchored at a grid point.
 */
interface GridBox extends GridPoint {
	/** Optional horizontal span. Defaults are supplied by grid helpers. */
	width?: number;

	/** Optional vertical span. Defaults are supplied by grid helpers. */
	height?: number;

	/** Optional depth span. Defaults are supplied by grid helpers. */
	depth?: number;
}

/**
 * Serialized sparse-grid occupancy data.
 */
interface GridData {
	/** Occupancy buckets indexed by sparse x/y coordinates. */
	occupied: NumberSet[][];
}

/**
 * Runtime state owned by the UI-less game engine shell.
 */
interface MjRuntimeState {
	/** Active game state, or `null` before a game is loaded. */
	gameState: GameState | null;

	/** Tile pairs already played and available for undo. */
	undoStack: TilePair[];

	/** Tile pairs undone and available for redo. */
	redoStack: TilePair[];

	/** Currently selected tile key, or `-1` when nothing is selected. */
	selectedTileKey: number;
}

/**
 * Derived runtime state calculated from the active game state.
 */
interface MjDerivedState {
	/** Whether at least one undo step is available. */
	canUndo: boolean;

	/** Whether at least one redo step is available. */
	canRedo: boolean;

	/** Number of tiles still placed on the board. */
	remaining: number;

	/** Whether every tile has been removed. */
	won: boolean;

	/** Whether the board has no playable pairs while tiles remain. */
	lost: boolean;

	/** Currently open tile keys. */
	open: NumberSet;

	/** Tile keys that have already been played. */
	played: NumberSet;
}

/**
 * Supported generator difficulty preset ids.
 */
type DifficultyLevel =
	| 'easy'
	| 'standard'
	| 'challenging'
	| 'expert'
	| 'nightmare';

/**
 * Inclusive numeric range used by rule settings.
 */
interface NumberRange {
	/** Minimum accepted value. */
	min: number;

	/** Maximum accepted value. */
	max: number;
}

/**
 * How suspension face matching should be interpreted.
 */
type MatchType = 'either' | 'both';

/**
 * Rule bundle for delayed-match suspension generation.
 */
interface SuspensionRules {
	/** Relative chance of choosing a suspension step. */
	frequency: number;

	/** Maximum number of active suspended records. */
	maxSuspended: number;

	/** Maximum nested suspension depth. */
	maxNested: number;

	/** Open-count range where suspension may be considered. */
	maxOpenCount: NumberRange;

	/** Placement-count range where suspension may be considered. */
	placementCount: NumberRange;

	/** Required matching style for release candidates. */
	matchType: MatchType;

	/** Effective open-count threshold where release becomes forced. */
	forceReleaseAtEffectiveOpen: number;

	/** Effective open-count threshold where new suspensions may be created. */
	suspendAtEffectiveOpen: number;
}

/**
 * Soft-penalty settings for avoiding repeated nearby face assignment.
 */
interface FaceAvoidanceRules {
	/** Whether face-avoidance penalties are active. */
	enabled?: boolean;

	/** Base avoidance penalty weight. */
	weight?: number;

	/** Extra avoidance penalty weight for suspension-related tiles. */
	suspensionWeight?: number;

	/** Maximum accumulated avoidance penalty. */
	maxWeight?: number;
}

/**
 * Settings used while choosing faces for prepared tile pairs.
 */
interface FaceAssignmentRules {
	/** Multiplier applied when a preferred face group is available. */
	preferredMultiplier?: number;

	/** Easy-difficulty scaling for duplicate face-group reuse. */
	easyReuseDuplicateScale?: number;
}

/**
 * Difficulty-resolved behavior settings for structural tile picking.
 */
interface TilePickerRules {
	/** Minimum ranked-window ratio allowed during weighted selection. */
	minWindowRatio?: number;

	/** Highest z-order used to normalize elevation pressure. */
	highestZOrder?: number;

	/** Weight applied to horizontal relationship pressure. */
	horizontalMultiplier?: number;

	/** Weight applied to depth relationship pressure. */
	depthMultiplier?: number;

	/** Reserved weight for vertical relationship pressure. */
	verticalMultiplier?: number;

	/** Weight applied to open-pressure scoring. */
	openPressureMultiplier?: number;

	/** Maximum freed-tile count used to normalize open pressure. */
	maxFreedPressure?: number;

	/** Weight applied to stack-balance scoring. */
	balancePressureMultiplier?: number;

	/** Maximum stack-balance margin used to normalize balance pressure. */
	maxBalanceMargin?: number;

	/** Number of hypothetical moves to probe after a candidate removal. */
	shortHorizonProbeMoves?: number;

	/** Weight applied when short-horizon probing detects pressure. */
	shortHorizonPressureMultiplier?: number;

	/** Whether stack-balance danger should be enforced as a hard rule. */
	enforceStackBalance?: boolean;
}

/**
 * A structural tile pair of board-local tile keys.
 *
 * `TilePair` identifies two tile slots on the generated board. It does not
 * describe concrete faces or face inventory.
 */
interface TilePair {
	/** First tile key in the tile pair. */
	tile1: TileKey;

	/** Second tile key in the tile pair. */
	tile2: TileKey;
}

/**
 * Options for probing whether a hypothetical state collapses soon.
 */
interface ShortHorizonProbeOptions {
	/** Maximum number of hypothetical tile-pair removals to simulate. */
	shortHorizonProbeMoves?: number;

	/** Weight applied when the probe identifies near-future pressure. */
	shortHorizonPressureMultiplier?: number;
}

/**
 * Result of a short-horizon hypothetical-state probe.
 */
interface ShortHorizonProbeResult {
	/** Whether the probe was enabled for this call. */
	enabled: boolean;

	/** Whether the probe encountered a non-playable state before clearing. */
	collapsed: boolean;

	/** Number of hypothetical tile-pair removals performed. */
	moves: number;

	/** Number of tiles remaining after the probe stopped. */
	remainingTiles: number;

	/** Normalized pressure contribution from the probe. */
	pressure: number;
}

/**
 * Summary of stack distribution after a hypothetical operation.
 */
interface StackBalanceSummary {
	/** Number of stack groups that still contain placed tiles. */
	stackGroupCount: number;

	/** Tallest remaining stack height. */
	maxStackHeight: number;

	/** Number of non-dominant stack groups. */
	otherStackGroupCount: number;

	/** Difference between the dominant stack and the rest of the board. */
	balanceMargin: number;

	/** Whether the state creates a concerning dominant stack. */
	createsDominantStack: boolean;
}

/**
 * Open-pressure ranking contribution for one tile candidate.
 */
interface OpenPressureFactor {
	/** Number of tiles that become open after removing the candidate. */
	freedCount: number;

	/** Normalized open-pressure multiplier. */
	openPressureFactor: number;
}

/**
 * Stack-balance ranking contribution for one tile candidate.
 */
interface BalanceFactor {
	/** Difference between the dominant stack and the rest of the board. */
	balanceMargin: number;

	/** Normalized stack-balance multiplier. */
	balanceFactor: number;

	/** Whether the candidate creates a concerning dominant stack. */
	createsDominantStack: boolean;
}

/**
 * Short-horizon ranking contribution for one tile candidate.
 */
interface ShortHorizonFactor {
	/** Normalized short-horizon multiplier. */
	shortHorizonFactor: number;

	/** Number of hypothetical tile-pair removals performed. */
	shortHorizonMoves: number;

	/** Number of tiles remaining after the probe stopped. */
	shortHorizonRemainingTiles: number;

	/** Whether short-horizon probing was enabled for this candidate. */
	shortHorizonEnabled: boolean;

	/** Whether the probe encountered a non-playable state before clearing. */
	shortHorizonCollapsed: boolean;
}

/**
 * Combined analyzer-backed ranking contribution for one tile candidate.
 */
interface AnalyzerFactor extends OpenPressureFactor, BalanceFactor, ShortHorizonFactor {
	/** Combined analyzer multiplier. */
	analyzerFactor: number;
}

/**
 * Complete weighted ranking record for one tile candidate.
 */
interface RankedTileCandidate extends AnalyzerFactor {
	/** Candidate tile key. */
	tileKey: TileKey;

	/** Candidate z-order. */
	z: number;

	/** Normalized z-order multiplier. */
	zIndexFactor: number;

	/** Count of horizontal-space intersections with reference tiles. */
	horizontalIntersections: number;

	/** Count of depth-space intersections with reference tiles. */
	depthIntersections: number;

	/** Combined spatial-relationship multiplier. */
	spatialRelationshipFactor: number;

	/** Final candidate weight used by weighted selection. */
	weight: number;
}

/**
 * Backward-compatible name for the older tile-score record.
 */
interface TileScore extends RankedTileCandidate {
}

/**
 * A difficulty-shaped slice of ranked candidate values.
 */
interface RankedWindow<T> {
	/** Selected values inside the ranked window. */
	window: T[];

	/** Inclusive start index of the selected window. */
	start: number;

	/** Exclusive end index of the selected window. */
	end: number;

	/** Number of values in the selected window. */
	size: number;

	/** Total number of ranked values considered. */
	count: number;

	/** Difficulty value used to bias the window. */
	difficulty: number;
}

/**
 * Options for selecting a difficulty-shaped ranked window.
 */
interface RankedWindowOptions {
	/** Difficulty value normalized from easy `0` to hard `1`. */
	difficulty?: number;

	/** Minimum ranked-window ratio allowed during weighted selection. */
	minWindowRatio?: number;
}

/**
 * Supported tile soft-link construction methods.
 */
type SoftLinkType = 'open-tiles' | 'grouped';

/**
 * Options for asking the tile domain to derive open-tile soft-link payloads
 * from the current working board.
 */
interface OpenTilesSoftLinkOptions {
	/** Tile keys to hypothetically remove before links are derived. */
	removeTiles?: TileKey[];

	/** Tile keys to exclude from the derived links. */
	ignoreTiles?: TileKey[];
}

/**
 * Shared tile soft-link fields.
 */
interface SoftLinkBase {
	/** Stable generation-run soft-link id. */
	id: number;

	/** How this soft link was constructed. */
	type: SoftLinkType;

	/** Context for why this link was created. */
	role: string;

	/** Tile keys connected by this soft link. */
	tiles: TileKey[];
}

/**
 * A soft link created from graph/rule analysis of open tiles.
 */
interface OpenTilesSoftLink extends SoftLinkBase {
	/** Open-tile soft-link construction method. */
	type: 'open-tiles';

	/** Source tiles used to create the open-tile snapshot. */
	sourceTiles: TileKey[];
}

/**
 * A soft link created by explicitly grouping known related tiles.
 */
interface GroupedSoftLink extends SoftLinkBase {
	/** Manual grouping construction method. */
	type: 'grouped';

	/** Optional face group associated with this conceptual group. */
	faceGroup?: FaceGroup;

	/** Optional face count expected by the consumer that interprets this link. */
	requiredFaces?: number;
}

/**
 * Non-structural relationship between tile keys created during generation.
 */
type SoftLink = OpenTilesSoftLink | GroupedSoftLink;

/**
 * Initializer for tile soft-link records before the registry assigns an id.
 */
type SoftLinkInit =
	| Omit<OpenTilesSoftLink, 'id'>
	| Omit<GroupedSoftLink, 'id'>;

/**
 * Constructor options for the cross-domain suspension orchestrator.
 */
interface SuspensionsOptions {
	/** Shared generator state. */
	state: GeneratorState;

	/** Tile-domain orchestrator used through its public API. */
	tiles: Tiles;

	/** Face-domain orchestrator used through its public API. */
	faces: Faces;
}

/**
 * Simple registry filters for finding tile soft links.
 */
interface SoftLinkFindOptions {
	/** Optional construction method filter. */
	type?: SoftLinkType;

	/** Optional creation-context filter. */
	role?: string;

	/** Require the link's tiles to contain all listed tiles. */
	tiles?: TileKey[];

	/** Require the link's source tiles to contain all listed source tiles. */
	sourceTiles?: TileKey[];
}

/**
 * Fully resolved settings for one generation run.
 */
interface DifficultySettings {
	/** Difficulty value normalized from easy `0` to hard `1`. */
	generationDifficulty: number;

	/** Suspension rules, or `null` when suspension generation is disabled. */
	suspensionRules: SuspensionRules | null;

	/** Tile-picker ranking and selection rules. */
	tilePickerRules: TilePickerRules;

	/** Face-assignment rules. */
	faceAssignmentRules: FaceAssignmentRules;

	/** Face-avoidance rules. */
	faceAvoidanceRules: FaceAvoidanceRules;
}

/**
 * Caller-provided parameters for one generated game.
 */
interface GenerateParameters {
	/** Difficulty preset id. */
	difficulty: DifficultyLevel;

	/** Optional partial settings override applied over the difficulty preset. */
	settingsOverrides?: Partial<DifficultySettings>;
}

/**
 * Payload returned by the experimental generator.
 */
interface GeneratorPayload {
	/** Fully restored generated game state. */
	gameState: GeneratorState;

	/** Known generated solution path in tile-key removal order. */
	solution: TileKey[];
}

/**
 * Plain-data initializer and serialized shape for `GeneratedPair`.
 *
 * A generated pair starts as a prepared tile-pair record: it has two tile keys
 * and is ready for face assignment. Once `faces` and `faceGroup` are set, it
 * represents an assigned pair. It represents a generated pair only after all
 * generation stages have completed.
 */
interface GeneratedPairInit {
	/** First board-local tile key in the prepared tile pair. */
	tile1?: TileKey;

	/** Second board-local tile key in the prepared tile pair. */
	tile2?: TileKey;

	/** Preferred face group for later face assignment, when one exists. */
	preferredFaceGroup?: FaceGroup;

	/** Face group assigned through the selected face pair. */
	faceGroup?: FaceGroup;

	/** Concrete face pair assigned to the prepared tile pair. */
	faces?: Face[];
}

/**
 * One complete four-face set selected from a face group.
 */
interface FullFaceSet {
	/** Face group that supplied the selected concrete faces. */
	faceGroup: FaceGroup;

	/** All four concrete faces from the selected face group. */
	faces: Face[];
}

/**
 * Constructor options for the face-domain generator orchestrator.
 */
interface FacesOptions {
	/** Optional lower-level face inventory, mostly useful for focused tests. */
	faceInventory?: FaceInventory;
}

/**
 * Lookup from face id to suit id.
 */
interface FaceSuitMap {
	/** Suit id keyed by face id. */
	[face: Face]: Suit;
}

/**
 * Plain-data initializer and serialized shape for `TileSuspension`.
 */
interface TileSuspensionInit {
	/** Suspended tile key. */
	tile?: TileKey;

	/** Face pair reserved or associated with this suspension. */
	faces?: Face[];

	/** Generated placement index where the suspension was created. */
	placedAt?: number;

	/** Number of placements made when the suspension was created. */
	placementCount?: number;

	/** Number of open tiles when the suspension was created. */
	openCount?: number;

	/** Original structural tile pair associated with the suspension. */
	originalPair?: TileKey[];

	/** Face group reserved by the suspension. */
	faceGroup?: FaceGroup;
}
