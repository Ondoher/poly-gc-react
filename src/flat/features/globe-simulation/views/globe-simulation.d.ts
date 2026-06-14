export interface GlobeSimulationView {
	/**
	 * Get the globe React page component.
	 */
	getComponent(): unknown;

	/**
	 * Get current globe page state.
	 */
	getState(): Record<string, unknown>;
}
