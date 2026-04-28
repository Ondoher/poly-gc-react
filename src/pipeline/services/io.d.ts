/**
 * Define options for one backend request.
 */
type IoRequestOptions = {
	/**
	 * Target the backend URL.
	 */
	url: string;

	/**
	 * Choose the HTTP method.
	 */
	method?: string;

	/**
	 * Send JSON-compatible request data.
	 */
	body?: unknown;

	/**
	 * Add or override request headers.
	 */
	headers?: Record<string, string>;
};

/**
 * Describe one normalized IO response.
 */
type IoResponse = {
	/**
	 * Indicate whether the backend request succeeded.
	 */
	success: boolean;

	/**
	 * Store the HTTP response status.
	 */
	status: number;

	/**
	 * Carry parsed response data.
	 */
	data: unknown;

	/**
	 * Describe the failure category when the request failed.
	 */
	failureMode?: string;

	/**
	 * Describe the failure when the request failed.
	 */
	message?: string;
};

/**
 * Define the service contract for backend IO.
 */
interface IoService {
	/**
	 * Send one backend request.
	 *
	 * @param options - Configure the request.
	 */
	send(options: IoRequestOptions): Promise<IoResponse>;

	/**
	 * Return the latest source-state revision token observed by IO.
	 */
	getSourceStateUpdatedOn(): string;
}
