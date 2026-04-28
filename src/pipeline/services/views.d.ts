/**
 * Define the service contract for registered pipeline views.
 */
interface ViewsService {
	/**
	 * Register one view service under a view id.
	 *
	 * Fires `view-added` when the view id becomes available.
	 *
	 * @param viewId - Identify the registered view.
	 * @param serviceName - Name the service that provides the view.
	 */
	add(viewId: string, serviceName: string): void;

	/**
	 * Return a React presentation component for a registered view.
	 *
	 * @param viewId - Identify the registered view.
	 * @param props - Carry props for the registered view.
	 */
	get(viewId: string, props?: Record<string, unknown>): import('react').ReactElement | null;

	/**
	 * Return whether a view id has been registered.
	 *
	 * @param viewId - Identify the registered view.
	 */
	has(viewId: string): boolean;
}
