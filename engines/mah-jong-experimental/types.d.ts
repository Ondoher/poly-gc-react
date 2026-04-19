export type DifficultyLevel =
	| 'easy'
	| 'standard'
	| 'challenging'
	| 'expert'
	| 'nightmare';

export interface NumberRange {
	min: number;
	max: number;
}

export type MatchType = 'either' | 'both';

export interface SuspensionRules {
	frequency: number;
	maxSuspended: number;
	maxNested: number;
	maxOpenCount: NumberRange;
	placementCount: NumberRange;
	matchType: MatchType;
	forceReleaseAtEffectiveOpen: number;
	suspendAtEffectiveOpen: number;
}

export interface FaceAvoidanceRules {
	enabled?: boolean;
	weight?: number;
	suspensionWeight?: number;
	maxWeight?: number;
}

export interface FaceAssignmentRules {
	preferredMultiplier?: number;
	easyReuseDuplicateScale?: number;
}

export interface TilePickerRules {
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

export interface DifficultySettings {
	generationDifficulty: number;
	suspensionRules: SuspensionRules | null;
	tilePickerRules: TilePickerRules;
	faceAssignmentRules: FaceAssignmentRules;
	faceAvoidanceRules: FaceAvoidanceRules;
}

export interface GenerateParameters {
	difficulty: DifficultyLevel;
	settingsOverrides?: Partial<DifficultySettings>;
}

export interface TileSuspensionInit {
	tile?: TileKey;
	faces?: Face[];
	placedAt?: number;
	placementCount?: number;
	openCount?: number;
	originalPair?: TileKey[];
	faceGroup?: FaceGroup;
}
