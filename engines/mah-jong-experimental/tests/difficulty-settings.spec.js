import {
	DIFFICULTY_LEVELS,
	DIFFICULTY_SETTINGS,
	resolveDifficultySettings,
} from '../difficulty-settings.js';

describe('difficulty settings', () => {
	it('resolves standard settings by default', () => {
		let settings = resolveDifficultySettings();

		expect(settings).toEqual(DIFFICULTY_SETTINGS.standard);
	});

	it('resolves a named difficulty level', () => {
		let settings = resolveDifficultySettings({
			difficulty: DIFFICULTY_LEVELS.expert,
		});

		expect(settings).toEqual(DIFFICULTY_SETTINGS.expert);
	});

	it('merges nested overrides onto the base difficulty settings', () => {
		let settings = resolveDifficultySettings({
			difficulty: DIFFICULTY_LEVELS.nightmare,
			settingsOverrides: {
				generationDifficulty: 0.9,
				tilePickerRules: {
					shortHorizonProbeMoves: 12,
				},
				faceAvoidanceRules: {
					maxWeight: 10,
				},
			},
		});

		expect(settings.generationDifficulty).toBe(0.9);
		expect(settings.tilePickerRules.openPressureMultiplier).toBe(1);
		expect(settings.tilePickerRules.shortHorizonProbeMoves).toBe(12);
		expect(settings.faceAvoidanceRules.enabled).toBe(true);
		expect(settings.faceAvoidanceRules.maxWeight).toBe(10);
	});
});
