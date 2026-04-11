export const SUSPENSION_RULE_PRESETS = {
	aggressive: {
		frequency: 0.8,
		maxSuspended: 40,
		maxNested: 4,
		placementCount: {
			min: 8,
			max: 16,
		},
		maxOpenCount: {
			min: 4,
			max: 8,
		},
		matchType: 'both',
		forceReleaseAtEffectiveOpen: 4,
		suspendAtEffectiveOpen: 6,
	},
};

export const DIFFICULTY_LEVELS = {
	easy: {
		id: 'easy',
		label: 'Easy',
		generationDifficulty: 0,
		suspensionRules: null,
		tilePickerRules: {},
		faceAssignmentRules: {
			preferredMultiplier: 0.5,
			easyReuseDuplicateScale: 2,
		},
		faceAvoidanceRules: {
			enabled: false,
		},
	},
	standard: {
		id: 'standard',
		label: 'Standard',
		generationDifficulty: 0.35,
		suspensionRules: null,
		tilePickerRules: {},
		faceAssignmentRules: {
			preferredMultiplier: 0.5,
			easyReuseDuplicateScale: 0,
		},
		faceAvoidanceRules: {
			enabled: false,
		},
	},
	challenging: {
		id: 'challenging',
		label: 'Challenging',
		generationDifficulty: 0.6,
		suspensionRules: SUSPENSION_RULE_PRESETS.aggressive,
		tilePickerRules: {},
		faceAssignmentRules: {
			preferredMultiplier: 0.5,
			easyReuseDuplicateScale: 0,
		},
		faceAvoidanceRules: {
			enabled: false,
		},
	},
	expert: {
		id: 'expert',
		label: 'Expert',
		generationDifficulty: 0.75,
		suspensionRules: SUSPENSION_RULE_PRESETS.aggressive,
		tilePickerRules: {
			openPressureMultiplier: 1,
			maxFreedPressure: 6,
			balancePressureMultiplier: 1,
			maxBalanceMargin: 48,
		},
		faceAssignmentRules: {
			preferredMultiplier: 0.5,
			easyReuseDuplicateScale: 0,
		},
		faceAvoidanceRules: {
			enabled: true,
			weight: 1,
			suspensionWeight: 3,
			maxWeight: 8,
		},
	},
	nightmare: {
		id: 'nightmare',
		label: 'Nightmare',
		generationDifficulty: 1,
		suspensionRules: {
			...SUSPENSION_RULE_PRESETS.aggressive,
			forceReleaseAtEffectiveOpen: 3,
			suspendAtEffectiveOpen: 5,
		},
		tilePickerRules: {
			openPressureMultiplier: 1,
			maxFreedPressure: 6,
			balancePressureMultiplier: 1,
			maxBalanceMargin: 48,
			shortHorizonProbeMoves: 8,
			shortHorizonPressureMultiplier: 1,
		},
		faceAssignmentRules: {
			preferredMultiplier: 0.5,
			easyReuseDuplicateScale: 0,
		},
		faceAvoidanceRules: {
			enabled: true,
			weight: 1,
			suspensionWeight: 3,
			maxWeight: 8,
		},
	},
};

export function applyDifficultyPreset(engine, difficultyId = 'standard') {
	let preset = DIFFICULTY_LEVELS[difficultyId] || DIFFICULTY_LEVELS.standard;

	engine.setupDifficulty(preset.generationDifficulty);
	engine.setupSuspensionRules(preset.suspensionRules || {frequency: 0});
	engine.setupTilePickerRules(preset.tilePickerRules || {});
	engine.setupFaceAssignmentRules(preset.faceAssignmentRules || {});
	engine.setupFaceAvoidanceRules(preset.faceAvoidanceRules || {enabled: false});

	return preset;
}
