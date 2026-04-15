import { Service, Registry } from "@polylith/core";

/**
 * Collect gameplay actions from the MJ runtime and rebroadcast them for other
 * services such as telemetry trackers.
 */
export default class ActionCollectorService extends Service {
	/**
	 * @param {Registry} [registry] - Manage service lookup and registration.
	 */
	constructor(registry) {
		super("mj:action-collector", registry);
		this.implement(["recordAction"]);
	}

	/**
	 * Record one gameplay action and fire it for downstream listeners.
	 *
	 * @param {MjGameplayAction} action - Describe one gameplay action that occurred in the active session.
	 * @returns {MjGameplayAction | false} Return the normalized action or false when the payload is invalid.
	 */
	recordAction(action) {
		if (!action || typeof action !== "object" || Array.isArray(action)) {
			return false;
		}

		let normalizedAction = {
			recordedAt: Date.now(),
			...action,
		};

		this.fire("action", normalizedAction);
		return normalizedAction;
	}
}

new ActionCollectorService();
