/**
 * Describe one replayable gameplay action captured from the live MJ session.
 */
type MjGameplayAction =
	MjSessionStartedAction |
	MjSessionElapsedAction |
	MjSessionEndedAction |
	MjDeadEndAction |
	MjTilePairAction;

/**
 * Describe the start of one gameplay session.
 */
type MjSessionStartedAction = {
	type: "session-started";
	recordedAt?: number;
	boardNbr: number | null;
	difficulty: string;
	layout: string;
}

/**
 * Describe one elapsed-time update for the active gameplay session.
 */
type MjSessionElapsedAction = {
	type: "session-elapsed";
	recordedAt?: number;
	elapsedTimeMs: number;
}

/**
 * Describe the end of one gameplay session.
 */
type MjSessionEndedAction = {
	type: "session-ended";
	recordedAt?: number;
	result: "won" | "abandoned";
}

/**
 * Describe one recoverable dead-end marker inside the active gameplay session.
 *
 * This does not end the session. Downstream tracking should encode it into the
 * replay stream as a sentinel tile pair of `[-1, -1]`.
 */
type MjDeadEndAction = {
	type: "dead-end";
	recordedAt?: number;
}

/**
 * Describe one tile-pair action in the active gameplay session.
 */
type MjTilePairAction = {
	type: "play-pair" | "undo-pair" | "redo-pair";
	recordedAt?: number;
	tile1: TileKey;
	tile2: TileKey;
}

/**
 * Describe the service that collects MJ gameplay actions and rebroadcasts them.
 */
interface ActionCollectorService {
	/**
	 * Record one gameplay action and rebroadcast it to listeners.
	 *
	 * @param {MjGameplayAction} action - Describe one gameplay action that occurred in the active session.
	 * @returns {MjGameplayAction | false} Return the normalized action or false when the payload is invalid.
	 */
	recordAction(action: MjGameplayAction): MjGameplayAction | false;
}
