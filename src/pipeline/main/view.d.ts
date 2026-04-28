/**
 * Define the service contract for the top-level React root view.
 */
interface MainViewService {
	/**
	 * Render the supplied component inside the pipeline root App.
	 *
	 * @param component - Carry the app-shell component to render.
	 */
	render(component: import('react').ReactNode): void;
}
