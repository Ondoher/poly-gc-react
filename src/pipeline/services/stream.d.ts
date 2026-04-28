/**
 * Define the pipeline Socket.IO stream service.
 */
interface StreamService {
	/**
	 * Create or return a namespace connection.
	 *
	 * @param name - Namespace name, such as `/asset-pipeline`.
	 */
	namespace(name: string): Promise<object>;

	/**
	 * Listen for a namespace event.
	 *
	 * @param namespaceName - Namespace name.
	 * @param eventName - Event to observe.
	 * @param listener - Event handler.
	 */
	on(namespaceName: string, eventName: string, listener: (...args: unknown[]) => void): Promise<Function>;

	/**
	 * Remove a namespace event listener.
	 *
	 * @param namespaceName - Namespace name.
	 * @param eventName - Event to stop observing.
	 * @param listener - Event handler to remove.
	 */
	off(namespaceName: string, eventName: string, listener: (...args: unknown[]) => void): Promise<void>;

	/**
	 * Send a message without waiting for a response.
	 *
	 * @param namespaceName - Namespace name.
	 * @param message - Message name.
	 * @param data - Message payload.
	 */
	send(namespaceName: string, message: string, data?: object): Promise<void>;

	/**
	 * Send a message and wait for the Socket.IO acknowledgement.
	 *
	 * @param namespaceName - Namespace name.
	 * @param message - Message name.
	 * @param data - Message payload.
	 */
	get(namespaceName: string, message: string, data?: object): Promise<unknown>;
}
