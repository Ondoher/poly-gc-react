/**
 * Defines the configuration used to open the feedback collection.
 */
interface FeedbackDbOptions {
	/** Identifies the Mongo connection string. */
	uri: string;

	/** Identifies the Mongo database name. */
	dbName: string;

	/** Identifies the Mongo collection name. */
	collectionName: string;
}

/**
 * Defines the optional context snapshot stored alongside a feedback record.
 */
interface MjStoredFeedbackContext {
	/** Identifies the board number associated with the feedback. */
	boardNbr: number | null;

	/** Carries the selected difficulty key. */
	difficulty: string;

	/** Carries the selected layout key. */
	layout: string;

	/** Records the total elapsed play time in milliseconds. */
	elapsedTimeMs: number;

	/** Records the terminal session result when one is known. */
	result: "won" | "lost" | "abandoned" | "";

	/** Carries the replayable tile-pair sequence for the session. */
	tileSequence: [number, number][];
}

/**
 * Defines the server-side telemetry record stored in Mongo.
 */
interface MjStoredTelemetryRecord extends MjTelemetryPayload {
	/** Records when the telemetry document was created. */
	submittedAt: string;
}

/**
 * Defines the server-side feedback record stored in Mongo.
 */
interface MjStoredFeedbackRecord extends MjFeedbackPayload {
	/** Records when the feedback document was created. */
	submittedAt: string;

	/** Stores the linked telemetry record id when feedback references telemetry. */
	telemetryId: string | null;

	/** Stores the optional board context snapshot captured with the feedback. */
	context: MjStoredFeedbackContext | null;
}
