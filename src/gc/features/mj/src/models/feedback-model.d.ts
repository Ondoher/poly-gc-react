/**
 * Send feedback records from the MJ frontend to the GC server.
 */
export interface FeedbackModelService {
	/**
	 * Submit a feedback payload to the GC feedback endpoint.
	 *
	 * @param payload - Carry the feedback request body sent by the dialog.
	 */
	submit(payload: MjFeedbackPayload): Promise<MjFeedbackSubmitResult>;
}
