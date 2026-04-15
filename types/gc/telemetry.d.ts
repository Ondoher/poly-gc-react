/**
 * This is one compact gameplay telemetry payload sent from the MJ frontend to
 * the GC server.
 */
interface MjTelemetryPayload {
	/** The board number currently associated with the session. */
	boardNbr: number | null;

	/** The selected difficulty key for the session. */
	difficulty: string;

	/** The selected layout key for the session. */
	layout: string;

	/** The total elapsed play time in milliseconds. */
	elapsedTimeMs: number;

	/** The terminal result for the session. */
	result: "won" | "lost" | "abandoned" | "";

	/** The replayable sequence of tile-pair actions recorded for the session. */
	tileSequence: [number, number][];
}

/**
 * This is the normalized telemetry submit result returned to the MJ frontend.
 */
interface MjTelemetrySubmitResult {
	/** Indicates whether the server accepted and saved the telemetry. */
	success: boolean;

	/** The inserted telemetry identifier returned by the server on success. */
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

/**
 * This is the telemetry record stored in Mongo.
 */
interface MjStoredTelemetryRecord extends MjTelemetryPayload {
	/** Records when the telemetry was captured by the server. */
	submittedAt: string;
}
