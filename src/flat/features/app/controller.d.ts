export interface AppController {
	/**
	 * Get registered shell pages.
	 */
	getPages(): unknown[];

	/**
	 * Get current shell state for presentation.
	 */
	getShellState(preferredPageId?: string): Record<string, unknown>;

	/**
	 * Ensure a page is active.
	 */
	ensureActivePage(preferredPageId?: string): unknown;

	/**
	 * Request the app shell to mount a page feature.
	 */
	requestPage(pageId: string, options?: Record<string, unknown>): unknown;

	/**
	 * Get the app shell React component.
	 */
	getComponent(props?: Record<string, unknown>): unknown;
}
