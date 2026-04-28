/**
 * Define the service contract for top-level pipeline coordination.
 */
interface MainControllerService {
	/**
	 * Mount the initial app-shell component through the main view.
	 */
	mount(): void;
}
