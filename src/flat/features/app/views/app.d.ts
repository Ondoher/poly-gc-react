export interface AppView {
	/**
	 * Get the app shell React component.
	 */
	getComponent(props?: Record<string, unknown>): unknown;

	/**
	 * Get current shell state.
	 */
	getShellState(preferredPageId?: string): Record<string, unknown>;

	/**
	 * Request a page by id.
	 */
	requestPage(pageId: string): unknown;
}
