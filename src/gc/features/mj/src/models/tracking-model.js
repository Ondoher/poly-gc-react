import { Service, Registry } from "@polylith/core";

/**
 * Build one compact gameplay session snapshot from emitted MJ gameplay
 * actions. This snapshot is intended for telemetry and optional feedback
 * context.
 */
export default class TrackingModelService extends Service {
	/**
	 * @param {Registry} [registry] - Manage service lookup and registration.
	 */
	constructor(registry) {
		super("mj:tracking-model", registry);
		this.implement([
			"getSessionSnapshot",
			"getFeedbackContextSnapshot",
			"hasSessionHistory",
			"hasFeedbackContext",
			"clearSession"
		]);

		/** @type {MjGameplaySession | null} */
		this.currentSession = null;

		/** @type {MjGameplaySession | null} */
		this.lastCompletedSession = null;

		this.actionCollector = this.registry.subscribe("mj:action-collector");

		if (this.actionCollector) {
			this.actionCollector.listen("action", this.onAction.bind(this));
		}
	}

	/**
	 * Build one new gameplay session from a start action.
	 *
	 * @param {MjSessionStartedAction} action - Describe the new session boundary.
	 * @returns {MjGameplaySession} Return the initialized gameplay session.
	 */
	createSession(action) {
		return {
			boardNbr: action.boardNbr,
			difficulty: action.difficulty,
			layout: action.layout,
			elapsedTimeMs: 0,
			result: "",
			completed: false,
			tileSequence: [],
		};
	}

	/**
	 * Return whether the current session has enough activity to be worth finalizing.
	 *
	 * @returns {boolean} Return true when the current session has recorded gameplay actions.
	 */
	hasPlayableHistory() {
		return Boolean(
			this.currentSession &&
			this.currentSession.completed !== true &&
			Array.isArray(this.currentSession.tileSequence) &&
			this.currentSession.tileSequence.length > 0
		);
	}

	/**
	 * Return whether the active session currently has any tracked move history.
	 *
	 * @returns {boolean} Return true when the active session has at least one tracked tile-pair action.
	 */
	hasSessionHistory() {
		return Boolean(
			this.currentSession &&
			Array.isArray(this.currentSession.tileSequence) &&
			this.currentSession.tileSequence.length > 0
		);
	}

	/**
	 * Return whether there is any session snapshot suitable for feedback
	 * context, either from the active session or the most recently completed
	 * session.
	 *
	 * @returns {boolean} Return true when feedback can include replayable game data.
	 */
	hasFeedbackContext() {
		return Boolean(this.getFeedbackContextSnapshot());
	}

	/**
	 * Finalize the active session and emit it to listeners.
	 *
	 * @param {"won" | "lost" | "abandoned"} result - Describe how the session ended.
	 */
	finalizeSession(result) {
		if (!this.currentSession) {
			return;
		}

		this.currentSession.result = result;
		this.currentSession.completed = true;
		this.lastCompletedSession = this.getSessionSnapshot();
		this.fire("session-complete", this.lastCompletedSession);
	}

	/**
	 * Called by the action collector when a gameplay action is recorded.
	 *
	 * @param {MjGameplayAction} action - Describe one gameplay action from the live session.
	 */
	onAction(action) {
		if (!action || typeof action.type !== "string") {
			return;
		}

		switch (action.type) {
			case "session-started":
				if (this.hasPlayableHistory()) {
					this.finalizeSession("abandoned");
				}
				this.currentSession = this.createSession(action);
				break;

			case "session-elapsed":
				if (this.currentSession) {
					this.currentSession.elapsedTimeMs = action.elapsedTimeMs;
				}
				break;

			case "session-ended":
				if (this.currentSession) {
					this.finalizeSession(action.result);
				}
				break;

			case "play-pair":
			case "undo-pair":
			case "redo-pair":
				if (this.currentSession) {
					this.currentSession.tileSequence.push([action.tile1, action.tile2]);
				}
				break;
		}
	}

	/**
	 * Return a snapshot of the active gameplay session.
	 *
	 * @returns {MjGameplaySession | null} Return the active session snapshot or null when none exists.
	 */
	getSessionSnapshot() {
		if (!this.currentSession) {
			return null;
		}

		return {
			...this.currentSession,
			tileSequence: this.currentSession.tileSequence.map(function(pair) {
				return [pair[0], pair[1]];
			}),
		};
	}

	/**
	 * Return the best available session snapshot for feedback context.
	 *
	 * Prefer the active session when it already contains move history; otherwise
	 * fall back to the most recently completed session.
	 *
	 * @returns {MjGameplaySession | null} Return the best available feedback context snapshot.
	 */
	getFeedbackContextSnapshot() {
		if (this.hasSessionHistory()) {
			return this.getSessionSnapshot();
		}

		if (!this.lastCompletedSession) {
			return null;
		}

		return {
			...this.lastCompletedSession,
			tileSequence: this.lastCompletedSession.tileSequence.map(function(pair) {
				return [pair[0], pair[1]];
			}),
		};
	}

	/**
	 * Clear the tracked active gameplay session.
	 */
	clearSession() {
		this.currentSession = null;
		this.lastCompletedSession = null;
	}
}

new TrackingModelService();
