/**
 * Defines the player's self-reported Mahjong skill level.
 *
 * - **beginner** - the player considers themselves new to Mahjong Solitaire
 * - **intermediate** - the player considers themselves somewhat experienced
 * - **experienced** - the player considers themselves highly experienced
 * - **""** - no skill level was selected
 */
type MjFeedbackSkillLevel =
	| "beginner"
	| "intermediate"
	| "experienced"
	| "";

/**
 * Defines how difficult the player felt the board was.
 *
 * - **too-easy** - the board felt easier than the player wanted
 * - **about-right** - the board felt appropriately difficult
 * - **too-hard** - the board felt harder than the player wanted
 * - **""** - no difficulty rating was selected
 */
type MjFeedbackDifficultyFeeling =
	| "too-easy"
	| "about-right"
	| "too-hard"
	| "";

/**
 * Defines how fair or frustrating the player felt the board was.
 *
 * - **fair** - the board felt fair or enjoyable
 * - **frustrating** - the board felt somewhat frustrating
 * - **very-frustrating** - the board felt strongly frustrating
 * - **""** - no fairness rating was selected
 */
type MjFeedbackFairnessFeeling =
	| "fair"
	| "frustrating"
	| "very-frustrating"
	| "";

/**
 * This is the compact gameplay session snapshot that can optionally travel
 * with one feedback submission.
 */
type MjFeedbackContext = {
	/** The board number currently associated with the active session. */
	boardNbr: number | null;

	/** The selected difficulty key for the active session. */
	difficulty: string;

	/** The selected layout key for the active session. */
	layout: string;

	/** The current total elapsed play time in milliseconds. */
	elapsedTimeMs: number;

	/** The terminal result for the session when one is known. */
	result: "won" | "lost" | "abandoned" | "";

	/** The replayable sequence of tile-pair actions recorded for the session. */
	tileSequence: [number, number][];
}

/**
 * This is the feedback payload shared between the MJ frontend and the GC server.
 */
interface MjFeedbackPayload {
	/** The board number currently being played. */
	boardNbr: number | null;

	/** The human-readable difficulty label shown to the player. */
	difficultyLabel: string;

	/** The human-readable layout title shown to the player. */
	layoutTitle: string;

	/** Whether board context should be stored with the feedback submission. */
	includeContext: boolean;

	/** The player's self-reported Mahjong skill level. */
	skillLevel: MjFeedbackSkillLevel;

	/** How difficult the player felt the board was. */
	difficultyFeeling: MjFeedbackDifficultyFeeling;

	/** How fair or frustrating the player felt the board was. */
	fairnessFeeling: MjFeedbackFairnessFeeling;

	/** Free-form player comments about the board or play session. */
	comment: string;

	/** The optional compact gameplay session snapshot sent with feedback. */
	context?: MjFeedbackContext | null;
}

/**
 * This is the normalized feedback submit result returned to the MJ frontend.
 */
interface MjFeedbackSubmitResult {
	/** Indicates whether the server accepted and saved the feedback. */
	success: boolean;

	/** The inserted feedback identifier returned by the server on success. */
	id?: string;

	/** The HTTP status returned when the request failed. */
	status?: number;

	/** The parsed response body returned with a failed HTTP response. */
	data?: object;

	/** Identifies a client-side failure mode such as a thrown fetch exception. */
	failureMode?: "exception";

	/** Carries the original thrown error when the submit request fails locally. */
	error?: unknown;
}
