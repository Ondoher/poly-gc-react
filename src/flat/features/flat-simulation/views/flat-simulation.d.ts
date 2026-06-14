export interface FlatSimulationView {
	/**
	 * Get the flat-simulation React page component.
	 */
	getComponent(): unknown;

	/**
	 * Get current flat-simulation page state.
	 */
	getState(): Record<string, unknown>;
}
