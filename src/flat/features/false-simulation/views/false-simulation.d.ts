export interface FalseSimulationView {
	/**
	 * Get the false-simulation React page component.
	 */
	getComponent(): unknown;

	/**
	 * Get current false-simulation page state.
	 */
	getState(): Record<string, unknown>;
}
