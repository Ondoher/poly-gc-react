import { Service, Registry } from "@polylith/core";
import { readMjPreferencesCookie } from "../utils/preferencesCookies.js";

/**
 * Send feedback records from the MJ frontend to the GC server.
 */
export default class FeedbackModelService extends Service {
	/**
	 * @param {Registry} [registry] - Manage service lookup and registration.
	 */
	constructor(registry) {
		super("mj:feedback-model", registry);
		this.implement(["start", "ready", "submit", "submitTelemetry", "getTelemetryReference"]);
	}

	/**
	 * Start the feedback-model service lifecycle.
	 */
	start() {
		this.trackingModel = null;
		this.lastTelemetrySubmission = null;
	}

	/**
	 * Mark the feedback-model service as ready by wiring its dependent services.
	 */
	ready() {
		this.trackingModel = this.registry.subscribe("mj:tracking-model");

		if (this.trackingModel) {
			this.trackingModel.listen("session-complete", this.onSessionComplete.bind(this));
		}
	}

	/**
	 * Build one stable session key for telemetry-reference lookups.
	 *
	 * @param {MjGameplaySession | MjTelemetryPayload | null} session - Carry the gameplay snapshot to key.
	 * @returns {string} Return one stable serialized session key or an empty string when unavailable.
	 */
	buildSessionKey(session) {
		if (!session || typeof session !== "object") {
			return "";
		}

		let boardNbr = Number(session.boardNbr);
		let elapsedTimeMs = Number(session.elapsedTimeMs);
		let tileSequence = Array.isArray(session.tileSequence)
			? session.tileSequence
			: [];

		return JSON.stringify({
			boardNbr: Number.isFinite(boardNbr) ? boardNbr : null,
			difficulty: typeof session.difficulty === "string" ? session.difficulty : "",
			layout: typeof session.layout === "string" ? session.layout : "",
			elapsedTimeMs: Number.isFinite(elapsedTimeMs)
				? Math.max(0, Math.floor(elapsedTimeMs))
				: 0,
			result:
				session.result === "won" ||
				session.result === "abandoned"
					? session.result
					: "",
			tileSequence,
		});
	}

	isTelemetryOptedIn() {
		let preferences = readMjPreferencesCookie();
		return preferences?.telemetryConsent === true;
	}

	/**
	 * Called by the tracking model when one gameplay session completes.
	 *
	 * @param {MjGameplaySession | null} session - Describe the completed gameplay session snapshot.
	 */
	async onSessionComplete(session) {
		if (!session || !this.isTelemetryOptedIn()) {
			return;
		}

		let telemetry = {
			boardNbr: session.boardNbr,
			difficulty: session.difficulty,
			layout: session.layout,
			elapsedTimeMs: session.elapsedTimeMs,
			result: session.result,
			tileSequence: session.tileSequence,
		};
		let result = await this.submitTelemetry(telemetry);

		if (result && result.success && typeof result.id === "string") {
			this.lastTelemetrySubmission = {
				sessionKey: this.buildSessionKey(telemetry),
				id: result.id,
			};
		}
	}

	/**
	 * Return the telemetry id previously saved for one completed session.
	 *
	 * @param {MjGameplaySession | null} session - Carry the feedback context snapshot to match.
	 * @returns {string} Return the telemetry id when the snapshot matches the most recent saved telemetry.
	 */
	getTelemetryReference(session) {
		if (!this.lastTelemetrySubmission) {
			return "";
		}

		return this.lastTelemetrySubmission.sessionKey === this.buildSessionKey(session)
			? this.lastTelemetrySubmission.id
			: "";
	}

	/**
	 * Submit a feedback payload to the GC feedback endpoint.
	 *
	 * @param {MjFeedbackPayload} payload - Carry the feedback request body sent by the dialog.
	 * @returns {Promise<MjFeedbackSubmitResult>} Return the parsed server response or a normalized failure result.
	 */
	async submit(payload) {
		try {
			let response = await fetch("/gc/api/feedback", {
				method: "POST",
				headers: {
					"Accept": "application/json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});

			let data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					status: response.status,
					data,
				};
			}

			return data;
		} catch (error) {
			console.warn("Feedback submit failed");
			console.warn(error);
			return {
				success: false,
				failureMode: "exception",
				error,
			};
		}
	}

	/**
	 * Submit one gameplay telemetry payload to the GC telemetry endpoint.
	 *
	 * @param {MjTelemetryPayload} payload - Carry the compact gameplay telemetry payload.
	 * @returns {Promise<MjTelemetrySubmitResult>} Return the parsed server response or a normalized failure result.
	 */
	async submitTelemetry(payload) {
		try {
			let response = await fetch("/gc/api/telemetry", {
				method: "POST",
				headers: {
					"Accept": "application/json",
					"Content-Type": "application/json",
				},
				body: JSON.stringify(payload),
			});

			let data = await response.json();

			if (!response.ok) {
				return {
					success: false,
					status: response.status,
					data,
				};
			}

			return data;
		} catch (error) {
			console.warn("Telemetry submit failed");
			console.warn(error);
			return {
				success: false,
				failureMode: "exception",
				error,
			};
		}
	}
}

new FeedbackModelService();
