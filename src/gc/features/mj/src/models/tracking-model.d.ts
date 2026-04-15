/**
 * Describe one compact gameplay session snapshot for telemetry or feedback
 * context.
 */
type MjGameplaySession = {
	boardNbr: number | null;
	difficulty: string;
	layout: string;
	elapsedTimeMs: number;
	result: "won" | "lost" | "abandoned" | "";
	completed?: boolean;
	tileSequence: [TileKey, TileKey][];
}

/**
 * Describe the service that accumulates MJ gameplay tracking state.
 */
interface TrackingModelService {
	/**
	 * Return a snapshot of the active gameplay session.
	 *
	 * @returns {MjGameplaySession | null} Return the active session snapshot or null when no session is active.
	 */
	getSessionSnapshot(): MjGameplaySession | null;

	/**
	 * Return the best available gameplay snapshot for feedback context.
	 *
	 * @returns {MjGameplaySession | null} Return the active session when it has moves, otherwise the most recent completed session.
	 */
	getFeedbackContextSnapshot(): MjGameplaySession | null;

	/**
	 * Return whether the active gameplay session has any tracked move history.
	 *
	 * @returns {boolean} Return true when the session has at least one tracked tile-pair action.
	 */
	hasSessionHistory(): boolean;

	/**
	 * Return whether feedback can currently include replayable game data.
	 *
	 * @returns {boolean} Return true when either the active or most recently completed session has usable context.
	 */
	hasFeedbackContext(): boolean;

	/**
	 * Clear the tracked active gameplay session.
	 */
	clearSession(): void;
}
