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
		this.implement(["submit", "submitTelemetry"]);
		this.trackingModel = this.registry.subscribe("mj:tracking-model");

		if (this.trackingModel) {
			this.trackingModel.listen("session-complete", this.onSessionComplete.bind(this));
		}
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

		await this.submitTelemetry({
			boardNbr: session.boardNbr,
			difficulty: session.difficulty,
			layout: session.layout,
			elapsedTimeMs: session.elapsedTimeMs,
			result: session.result,
			tileSequence: session.tileSequence,
		});
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
