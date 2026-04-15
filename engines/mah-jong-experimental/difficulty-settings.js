export const DIFFICULTY_LEVELS = {
	easy: 'easy',
	standard: 'standard',
	challenging: 'challenging',
	expert: 'expert',
	nightmare: 'nightmare',
};

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

export const DIFFICULTY_SETTINGS = {
	easy: {
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

export function resolveDifficultySettings(parameters = {}) {
	let difficulty = parameters.difficulty || DIFFICULTY_LEVELS.standard;
	let baseSettings = DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS.standard;
	let settingsOverrides = parameters.settingsOverrides || {};

	return {
		...baseSettings,
		...settingsOverrides,
		suspensionRules: settingsOverrides.suspensionRules ?? baseSettings.suspensionRules,
		tilePickerRules: {
			...baseSettings.tilePickerRules,
			...(settingsOverrides.tilePickerRules || {}),
		},
		faceAssignmentRules: {
			...baseSettings.faceAssignmentRules,
			...(settingsOverrides.faceAssignmentRules || {}),
		},
		faceAvoidanceRules: {
			...baseSettings.faceAvoidanceRules,
			...(settingsOverrides.faceAvoidanceRules || {}),
		},
	};
}
